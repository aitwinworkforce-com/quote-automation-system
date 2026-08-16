import { useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { BrandHeader } from "@/components/BrandHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft, ArrowRight, CheckCircle2, CloudUpload, FileText, Landmark,
  Loader2, RefreshCw, Sparkles, TriangleAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types local to the wizard
// ---------------------------------------------------------------------------
interface WizardLineItem {
  description: string;
  quantity: number;
  listUnitPrice: number;
  discountPct: number | null;
}

const STEPS = [
  { id: 1, label: "Upload" },
  { id: 2, label: "Review Extraction" },
  { id: 3, label: "Exchange Rate" },
  { id: 4, label: "Costing" },
  { id: 5, label: "Finalise" },
] as const;

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="mb-8 flex items-center gap-2 overflow-x-auto pb-1">
      {STEPS.map((s, i) => (
        <div key={s.id} className="flex items-center gap-2">
          <div
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold",
              current > s.id
                ? "border-primary bg-primary text-primary-foreground"
                : current === s.id
                  ? "border-primary text-primary"
                  : "border-muted-foreground/30 text-muted-foreground",
            )}
          >
            {current > s.id ? <CheckCircle2 className="h-4 w-4" /> : s.id}
          </div>
          <span
            className={cn(
              "whitespace-nowrap text-sm",
              current === s.id ? "font-semibold text-foreground" : "text-muted-foreground",
            )}
          >
            {s.label}
          </span>
          {i < STEPS.length - 1 && <div className="h-px w-8 bg-border" />}
        </div>
      ))}
    </div>
  );
}

const num = (v: string, fallback = 0) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
};
const fmt = (n: number | null | undefined, currency = "") =>
  n == null || !Number.isFinite(n)
    ? "—"
    : `${currency}${n.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function NewQuote() {
  const { isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();
  const [step, setStep] = useState(1);

  // Step 1 — upload & extraction progress
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [extractionStage, setExtractionStage] = useState<"idle" | "uploading" | "parsing" | "analyzing" | "complete" | "error">("idle");
  const [extractionProgress, setExtractionProgress] = useState(0);

  // Created quote
  const [quoteId, setQuoteId] = useState<number | null>(null);
  const [matchedSupplierName, setMatchedSupplierName] = useState<string | null>(null);
  const [pricingModel, setPricingModel] = useState<string>("as_is");

  // Reference tracking — which fields were auto-filled from the verified index
  const [referenceApplied, setReferenceApplied] = useState(false);
  const [referenceValues, setReferenceValues] = useState<{ marginPct: string; discountPct: string; currency: string } | null>(null);
  const [overrides, setOverrides] = useState<Array<{ field: string; from: string; to: string; at: string }>>([]);

  // Step 2 — extraction review
  const [supplierName, setSupplierName] = useState("");
  const [supplierQuoteRef, setSupplierQuoteRef] = useState("");
  const [currency, setCurrency] = useState<"EUR" | "USD" | "AUD">("EUR");
  const [customerName, setCustomerName] = useState("");
  const [customerContact, setCustomerContact] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [productCategory, setProductCategory] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [footerPricingNote, setFooterPricingNote] = useState("");
  const [lineItems, setLineItems] = useState<WizardLineItem[]>([]);
  const [distributionDiscountPct, setDistributionDiscountPct] = useState<string>("");

  // Step 3 — exchange rate
  const [confirmedRate, setConfirmedRate] = useState<number | null>(null);
  const [rateOverride, setRateOverride] = useState<string>("");
  const [rateConfirmChecked, setRateConfirmChecked] = useState(false);

  // Step 4 — costing
  const [marginPct, setMarginPct] = useState("25");
  const [freight, setFreight] = useState("0");
  const [installation, setInstallation] = useState("0");
  const [otherLocal, setOtherLocal] = useState("0");
  const [footerIndicatesNet, setFooterIndicatesNet] = useState(false);
  const [costingResult, setCostingResult] = useState<any>(null);

  // Step 5 — finalize
  const [sfNumber, setSfNumber] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [deliveryTerms, setDeliveryTerms] = useState("");
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);

  // ---- tRPC hooks ----
  const upload = trpc.quotes.uploadAndExtract.useMutation();
  const ratesQuery = trpc.quotes.fetchRates.useQuery(undefined, {
    enabled: step === 3,
    refetchOnWindowFocus: false,
  });
  const confirmRate = trpc.quotes.confirmRate.useMutation();
  const runCosting = trpc.quotes.calculateCosting.useMutation();
  const updateDetails = trpc.quotes.updateDetails.useMutation();
  const setSf = trpc.quotes.setSalesforceNumber.useMutation();
  const generatePdf = trpc.pdf.generateQuote.useMutation();
  const utils = trpc.useUtils();

  const pair = currency === "EUR" ? "AUD/EUR" : currency === "USD" ? "AUD/USD" : "AUD/AUD";
  const liveRate = useMemo(() => {
    if (!ratesQuery.data) return null;
    if (currency === "EUR") return ratesQuery.data.audEur;
    if (currency === "USD") return ratesQuery.data.audUsd;
    return 1;
  }, [ratesQuery.data, currency]);

  // ---- handlers ----
  const handleFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Please upload a PDF file");
      return;
    }
    setFileName(file.name);
    const b64 = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve((r.result as string).split(",")[1]);
      r.onerror = reject;
      r.readAsDataURL(file);
    });
    try {
      const res = await upload.mutateAsync({ fileName: file.name, fileBase64: b64 });
      setQuoteId(res.quoteId);
      const ex = res.extracted;
      setSupplierName(res.matchedSupplier?.name ?? ex.supplier_name ?? "");
      setMatchedSupplierName(res.matchedSupplier?.name ?? null);
      setPricingModel(res.matchedSupplier?.pricingModel ?? "as_is");
      // Auto-fill from verified supplier reference index
      if (res.supplierDefaults) {
        const sd = res.supplierDefaults;
        setMarginPct(String(sd.marginPct));
        setCurrency(sd.currency as "EUR" | "USD" | "AUD");
        if (sd.discountPct > 0 && !ex.distribution_discount_pct) {
          setDistributionDiscountPct(String(sd.discountPct));
        }
        setReferenceApplied(true);
        setReferenceValues({
          marginPct: String(sd.marginPct),
          discountPct: sd.discountPct > 0 ? String(sd.discountPct) : "",
          currency: sd.currency,
        });
        setOverrides([]);
      }
      setSupplierQuoteRef(ex.supplier_quote_number ?? "");
      // Currency from extraction overrides reference if present
      if (ex.currency) setCurrency(ex.currency as "EUR" | "USD" | "AUD");
      setCustomerName(ex.customer_name ?? "");
      setCustomerContact(ex.customer_contact ?? "");
      setCustomerAddress(ex.customer_address ?? "");
      setProductCategory(ex.product_name ?? "");
      setProductDescription(ex.product_description ?? "");
      setFooterPricingNote(ex.footer_pricing_note ?? "");
      setFooterIndicatesNet(/net/i.test(ex.footer_pricing_note ?? ""));
      setDistributionDiscountPct(
        ex.distribution_discount_pct != null ? String(ex.distribution_discount_pct) : "",
      );
      setPaymentTerms(ex.payment_terms ?? "");
      setDeliveryTerms(ex.delivery_terms ?? "");
      setLineItems(
        (ex.line_items ?? []).map((li: any) => ({
          description: li.description,
          quantity: li.quantity,
          listUnitPrice: li.unit_price,
          discountPct: li.discount_pct ?? null,
        })),
      );
      toast.success("Extraction complete — please review the data");
      setStep(2);
    } catch (e: any) {
      toast.error(e.message ?? "Extraction failed");
    }
  };

  const handleConfirmRate = async () => {
    if (!quoteId) return;
    const rate = rateOverride ? num(rateOverride) : liveRate;
    if (!rate || rate <= 0) {
      toast.error("No valid exchange rate available");
      return;
    }
    if (!rateConfirmChecked) {
      toast.error("Please tick the confirmation box to approve the exchange rate");
      return;
    }
    try {
      await confirmRate.mutateAsync({
        quoteId,
        pair: pair as "AUD/EUR" | "AUD/USD" | "AUD/AUD",
        rate,
        source: rateOverride
          ? "Manual override by user"
          : (ratesQuery.data?.source ?? "live"),
      });
      setConfirmedRate(rate);
      toast.success(`Exchange rate ${rate.toFixed(4)} confirmed`);
      setStep(4);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to confirm rate");
    }
  };

  const handleCosting = async () => {
    if (!quoteId) return;
    try {
      const res = await runCosting.mutateAsync({
        quoteId,
        marginPct: num(marginPct),
        lineItems: lineItems.map(li => ({
          description: li.description,
          quantity: li.quantity,
          listUnitPrice: li.listUnitPrice,
          discountPct: li.discountPct,
        })),
        distributionDiscountPct: distributionDiscountPct ? num(distributionDiscountPct) : null,
        footerIndicatesNet,
        freightCostAud: num(freight),
        installationCostAud: num(installation),
        otherLocalCostAud: num(otherLocal),
      });
      setCostingResult(res);
      toast.success("Costing calculated");
    } catch (e: any) {
      toast.error(e.message ?? "Costing failed");
    }
  };

  const handleFinalize = async () => {
    if (!quoteId) return;
    if (!sfNumber.trim()) {
      toast.error("Enter the Salesforce quotation number before generating the PDF");
      return;
    }
    try {
      await updateDetails.mutateAsync({
        quoteId,
        customerName, customerContact, customerAddress,
        productCategory, productDescription,
        supplierQuoteRef,
        paymentTerms: paymentTerms || undefined,
        deliveryTerms: deliveryTerms || undefined,
      });
      await setSf.mutateAsync({ quoteId, salesforceQuoteNumber: sfNumber.trim() });
      const res = await generatePdf.mutateAsync({ quoteId });
      setGeneratedUrl(res.url);
      utils.quotes.list.invalidate();
      toast.success("Quotation PDF generated");
    } catch (e: any) {
      toast.error(e.message ?? "PDF generation failed");
    }
  };

  // ---- auth gates ----
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Skeleton className="h-8 w-48" />
      </div>
    );
  }
  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen flex-col">
        <BrandHeader />
        <div className="flex flex-1 flex-col items-center justify-center gap-4">
          <p className="text-muted-foreground">Please sign in to create quotes.</p>
          <Button onClick={() => startLogin()}>Sign in</Button>
        </div>
      </div>
    );
  }

  const busy =
    upload.isPending || confirmRate.isPending || runCosting.isPending ||
    updateDetails.isPending || setSf.isPending || generatePdf.isPending;

  return (
    <div className="flex min-h-screen flex-col bg-muted/40">
      <BrandHeader />
      <main className="container max-w-5xl flex-1 py-8">
        <Button variant="ghost" size="sm" className="mb-4" onClick={() => navigate("/")}>
          <ArrowLeft className="h-4 w-4" /> Dashboard
        </Button>
        <h1 className="mb-1 text-2xl font-bold tracking-tight">New Quotation</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Guided workflow: upload the supplier quote, review the AI extraction, confirm the
          exchange rate, apply costing, then finalise with the Salesforce number.
        </p>
        <StepIndicator current={step} />

        {/* ------------------------------------------------ Step 1: Upload */}
        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CloudUpload className="h-5 w-5 text-primary" /> Upload supplier quote PDF
              </CardTitle>
              <CardDescription>
                The AI will extract the quotation number, line items, quantities and prices
                automatically. Supported suppliers: Collimatic, Marlin / Duravant, Foodmate,
                Nutri Soy, Phenova (others are treated as-is).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div
                className={cn(
                  "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-14 text-center transition-colors",
                  dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25",
                  upload.isPending && "pointer-events-none opacity-60",
                )}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => {
                  e.preventDefault();
                  setDragOver(false);
                  const f = e.dataTransfer.files?.[0];
                  if (f) void handleFile(f);
                }}
              >
                {upload.isPending ? (
                  <div className="flex w-full max-w-md flex-col items-center gap-4">
                    <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Sparkles className="absolute -top-1 -right-1 h-5 w-5 animate-bounce text-primary" />
                      <Loader2 className="h-8 w-8 animate-spin" />
                    </div>
                    <div className="w-full space-y-2 text-center">
                      <div className="flex items-center justify-between text-sm font-medium text-foreground">
                        <span>
                          {extractionStage === "uploading" && "Uploading PDF to secure storage..."}
                          {extractionStage === "parsing" && "Parsing document layout & structure..."}
                          {extractionStage === "analyzing" && "Running AI extraction & supplier rule matching..."}
                          {extractionStage === "complete" && "Extraction successful! Preparing review..."}
                        </span>
                        <span>{extractionProgress}%</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full bg-primary transition-all duration-500 ease-out"
                          style={{ width: `${extractionProgress}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {fileName ? `Processing ${fileName} — please wait` : "Please wait while our intelligent agent analyzes the quotation..."}
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    <FileText className="h-10 w-10 text-muted-foreground/60" />
                    <p className="font-medium">Drop the supplier PDF here, or click to browse</p>
                    <p className="text-sm text-muted-foreground">PDF up to 25 MB</p>
                  </>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (f) void handleFile(f);
                  }}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* -------------------------------------- Step 2: Review extraction */}
        {step === 2 && (
          <div className="space-y-6">
            <Alert>
              <Sparkles className="h-4 w-4" />
              <AlertTitle>AI extraction complete</AlertTitle>
              <AlertDescription>
                {matchedSupplierName ? (
                  <>Supplier matched: <strong>{matchedSupplierName}</strong> — pricing model{" "}
                    <strong>{pricingModel.replaceAll("_", " ")}</strong> will be applied.</>
                ) : (
                  <>Supplier not recognised in the configuration — prices will be used as-is.
                    Review carefully.</>
                )}
              </AlertDescription>
            </Alert>
            <Card>
              <CardHeader>
                <CardTitle>Quote header</CardTitle>
                <CardDescription>All fields are editable — correct anything the AI misread.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Supplier</Label>
                  <Input value={supplierName} onChange={e => setSupplierName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Supplier quote reference</Label>
                  <Input value={supplierQuoteRef} onChange={e => setSupplierQuoteRef(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Currency</Label>
                  <div className="flex gap-2">
                    {(["EUR", "USD", "AUD"] as const).map(c => (
                      <Button
                        key={c}
                        type="button"
                        variant={currency === c ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCurrency(c)}
                      >
                        {c}
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Customer name</Label>
                  <Input value={customerName} onChange={e => setCustomerName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Customer contact</Label>
                  <Input value={customerContact} onChange={e => setCustomerContact(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Customer address</Label>
                  <Input value={customerAddress} onChange={e => setCustomerAddress(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Product / machine</Label>
                  <Input value={productCategory} onChange={e => setProductCategory(e.target.value)} />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Product description</Label>
                  <Textarea
                    rows={3}
                    value={productDescription}
                    onChange={e => setProductDescription(e.target.value)}
                  />
                </div>
                {footerPricingNote && (
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>Footer pricing note (detected)</Label>
                    <Textarea rows={2} value={footerPricingNote} onChange={e => setFooterPricingNote(e.target.value)} />
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Line items ({lineItems.length})</CardTitle>
                <CardDescription>Prices shown in {currency} as extracted from the supplier quote.</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[45%]">Description</TableHead>
                      <TableHead>Qty</TableHead>
                      <TableHead>Unit price ({currency})</TableHead>
                      <TableHead>Stated discount %</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lineItems.map((li, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          <Textarea
                            rows={1}
                            className="min-h-9"
                            value={li.description}
                            onChange={e =>
                              setLineItems(arr => arr.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))
                            }
                          />
                        </TableCell>
                        <TableCell className="w-24">
                          <Input
                            type="number"
                            value={li.quantity}
                            onChange={e =>
                              setLineItems(arr => arr.map((x, j) => (j === i ? { ...x, quantity: num(e.target.value, 1) } : x)))
                            }
                          />
                        </TableCell>
                        <TableCell className="w-36">
                          <Input
                            type="number"
                            value={li.listUnitPrice}
                            onChange={e =>
                              setLineItems(arr => arr.map((x, j) => (j === i ? { ...x, listUnitPrice: num(e.target.value) } : x)))
                            }
                          />
                        </TableCell>
                        <TableCell className="w-28">
                          <Input
                            type="number"
                            placeholder="—"
                            value={li.discountPct ?? ""}
                            onChange={e =>
                              setLineItems(arr =>
                                arr.map((x, j) =>
                                  j === i ? { ...x, discountPct: e.target.value === "" ? null : num(e.target.value) } : x,
                                ),
                              )
                            }
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() =>
                    setLineItems(arr => [...arr, { description: "", quantity: 1, listUnitPrice: 0, discountPct: null }])
                  }
                >
                  Add line item
                </Button>
              </CardContent>
            </Card>
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
              <Button onClick={() => setStep(3)} disabled={lineItems.length === 0}>
                Continue to exchange rate <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* -------------------------------------------- Step 3: FX confirm */}
        {step === 3 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Landmark className="h-5 w-5 text-primary" /> Confirm exchange rate — {pair}
              </CardTitle>
              <CardDescription>
                Live rates are fetched but are <strong>never applied without your approval</strong>.
                Confirm the rate below, or override it manually.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {currency === "AUD" ? (
                <Alert>
                  <AlertTitle>Supplier quote is already in AUD</AlertTitle>
                  <AlertDescription>No conversion required — a rate of 1.0000 will be recorded.</AlertDescription>
                </Alert>
              ) : ratesQuery.isLoading ? (
                <div className="flex items-center gap-3 rounded-lg border p-6">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <p className="text-sm">Fetching live {pair} rate…</p>
                </div>
              ) : ratesQuery.error ? (
                <Alert variant="destructive">
                  <TriangleAlert className="h-4 w-4" />
                  <AlertTitle>Could not fetch live rates</AlertTitle>
                  <AlertDescription>Enter the rate manually below, or retry.</AlertDescription>
                </Alert>
              ) : (
                <div className="rounded-lg border bg-muted/40 p-6">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Live rate — {pair}</p>
                      <p className="text-4xl font-bold text-primary">{liveRate?.toFixed(4)}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Source: {ratesQuery.data?.source} · fetched{" "}
                        {ratesQuery.data ? new Date(ratesQuery.data.fetchedAt).toLocaleTimeString("en-AU") : ""}
                      </p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => ratesQuery.refetch()}>
                      <RefreshCw className="h-4 w-4" /> Refresh
                    </Button>
                  </div>
                </div>
              )}

              {currency !== "AUD" && (
                <div className="grid gap-2 sm:max-w-xs">
                  <Label>Manual override (optional)</Label>
                  <Input
                    type="number"
                    step="0.0001"
                    placeholder={liveRate ? liveRate.toFixed(4) : "e.g. 0.6000"}
                    value={rateOverride}
                    onChange={e => setRateOverride(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Leave blank to use the live rate. Overrides are logged as manual entries.
                  </p>
                </div>
              )}

              <label className="flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
                <Checkbox
                  checked={rateConfirmChecked}
                  onCheckedChange={v => setRateConfirmChecked(v === true)}
                  className="mt-0.5"
                />
                <span className="text-sm">
                  I confirm the {pair} exchange rate of{" "}
                  <strong>
                    {currency === "AUD"
                      ? "1.0000"
                      : rateOverride
                        ? num(rateOverride).toFixed(4)
                        : (liveRate?.toFixed(4) ?? "—")}
                  </strong>{" "}
                  and approve its use in this quotation's costing.
                </span>
              </label>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(2)}>
                  <ArrowLeft className="h-4 w-4" /> Back
                </Button>
                <Button
                  onClick={() => {
                    if (currency === "AUD" && !rateOverride) setRateOverride("1");
                    void handleConfirmRate();
                  }}
                  disabled={confirmRate.isPending || (!liveRate && !rateOverride && currency !== "AUD")}
                >
                  {confirmRate.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  Confirm rate & continue <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ------------------------------------------------ Step 4: Costing */}
        {step === 4 && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Costing inputs</CardTitle>
                <CardDescription>
                  Pricing model: <strong>{pricingModel.replaceAll("_", " ")}</strong> · Confirmed rate:{" "}
                  <strong>{confirmedRate?.toFixed(4)}</strong> ({pair})
                </CardDescription>
                {referenceApplied && (
                  <div className="mt-2 flex items-center gap-2 rounded-md bg-green-50 border border-green-200 px-3 py-1.5 text-sm text-green-800">
                    <svg className="h-4 w-4 text-green-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    <span><strong>Reference Applied</strong> — Verified defaults from supplier index ({matchedSupplierName})</span>
                  </div>
                )}
                {overrides.length > 0 && (
                  <div className="mt-2 rounded-md bg-amber-50 border border-amber-200 px-3 py-1.5 text-sm text-amber-800">
                    <strong>Manual overrides ({overrides.length}):</strong>{" "}
                    {overrides.map((o, i) => (
                      <span key={i}>{o.field} ({o.from} → {o.to}){i < overrides.length - 1 ? ", " : ""}</span>
                    ))}
                  </div>
                )}
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-1.5">
                  <Label>Margin %</Label>
                  <Input type="number" value={marginPct} onChange={e => {
                    const newVal = e.target.value;
                    if (referenceValues && newVal !== referenceValues.marginPct) {
                      setOverrides(prev => [...prev.filter(o => o.field !== "Margin %"), { field: "Margin %", from: referenceValues.marginPct + "%", to: newVal + "%", at: new Date().toISOString() }]);
                    }
                    setMarginPct(newVal);
                  }} />
                </div>
                {pricingModel === "list_minus_distribution" && (
                  <div className="space-y-1.5">
                    <Label>Distribution discount %</Label>
                    <Input
                      type="number"
                      value={distributionDiscountPct}
                      onChange={e => {
                        const newVal = e.target.value;
                        if (referenceValues && newVal !== referenceValues.discountPct) {
                          setOverrides(prev => [...prev.filter(o => o.field !== "Discount %"), { field: "Discount %", from: referenceValues.discountPct + "%", to: newVal + "%", at: new Date().toISOString() }]);
                        }
                        setDistributionDiscountPct(newVal);
                      }}
                    />
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label>Freight (AUD)</Label>
                  <Input type="number" value={freight} onChange={e => setFreight(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Installation (AUD)</Label>
                  <Input type="number" value={installation} onChange={e => setInstallation(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Other local costs (AUD)</Label>
                  <Input type="number" value={otherLocal} onChange={e => setOtherLocal(e.target.value)} />
                </div>
                {pricingModel === "footer_based" && (
                  <label className="flex items-center gap-2 pt-6 text-sm sm:col-span-2">
                    <Checkbox
                      checked={footerIndicatesNet}
                      onCheckedChange={v => setFooterIndicatesNet(v === true)}
                    />
                    Footer indicates prices are <strong>net</strong>
                    {footerPricingNote && (
                      <span className="text-xs text-muted-foreground">("{footerPricingNote}")</span>
                    )}
                  </label>
                )}
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button onClick={() => void handleCosting()} disabled={runCosting.isPending}>
                {runCosting.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Calculate costing
              </Button>
            </div>

            {costingResult && (
              <Card>
                <CardHeader>
                  <CardTitle>Costing result</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[40%]">Item</TableHead>
                        <TableHead>Qty</TableHead>
                        <TableHead>Net cost ({currency})</TableHead>
                        <TableHead>Sell unit ({currency})</TableHead>
                        <TableHead>Sell total ({currency})</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {costingResult.lineItems.map((li: any, i: number) => (
                        <TableRow key={i}>
                          <TableCell className="max-w-[280px] truncate">{li.description}</TableCell>
                          <TableCell>{li.quantity}</TableCell>
                          <TableCell>{fmt(li.netUnitCost)}</TableCell>
                          <TableCell>{fmt(li.sellUnitPrice)}</TableCell>
                          <TableCell className="font-medium">{fmt(li.sellTotalPrice)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className="grid gap-3 rounded-lg bg-muted/40 p-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Total sell ({currency})</p>
                      <p className="text-lg font-semibold">{fmt(costingResult.totalSellForeign)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Total sell (AUD)</p>
                      <p className="text-lg font-semibold">{fmt(costingResult.totalSellAud, "$")}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Local costs (AUD)</p>
                      <p className="text-lg font-semibold">
                        {fmt(
                          costingResult.freightCostAud +
                            costingResult.installationCostAud +
                            costingResult.otherLocalCostAud,
                          "$",
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Grand total (AUD, ex GST)</p>
                      <p className="text-xl font-bold text-primary">{fmt(costingResult.grandTotalAud, "$")}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(3)}>
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
              <Button onClick={() => setStep(5)} disabled={!costingResult}>
                Continue to finalise <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* ----------------------------------------------- Step 5: Finalise */}
        {step === 5 && (
          <div className="space-y-6">
            {generatedUrl ? (
              <Card className="border-emerald-300 bg-emerald-50/50">
                <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
                  <CheckCircle2 className="h-12 w-12 text-emerald-600" />
                  <div>
                    <p className="text-xl font-bold">Quotation {sfNumber} generated</p>
                    <p className="text-sm text-muted-foreground">
                      The branded PDF has been stored and the quote marked as finalised.
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <Button asChild>
                      <a href={generatedUrl} target="_blank" rel="noreferrer">
                        <FileText className="h-4 w-4" /> Download PDF
                      </a>
                    </Button>
                    <Button variant="outline" onClick={() => navigate("/")}>Back to dashboard</Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <>
                <Alert className="border-violet-300 bg-violet-50 text-violet-900">
                  <TriangleAlert className="h-4 w-4" />
                  <AlertTitle>Salesforce quotation number required</AlertTitle>
                  <AlertDescription>
                    Create the quotation record in Salesforce now, then paste the generated
                    quotation number below. The final PDF cannot be produced without it.
                  </AlertDescription>
                </Alert>
                <Card>
                  <CardHeader>
                    <CardTitle>Finalise quotation</CardTitle>
                    <CardDescription>
                      Customer: <strong>{customerName || "—"}</strong> · Product:{" "}
                      <strong>{productCategory || "—"}</strong> · Grand total:{" "}
                      <strong>{fmt(costingResult?.grandTotalAud, "$")} AUD ex GST</strong>
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-2 sm:max-w-sm">
                      <Label className="font-semibold">Salesforce quotation number *</Label>
                      <Input
                        placeholder="e.g. QU-8452"
                        value={sfNumber}
                        onChange={e => setSfNumber(e.target.value)}
                        className="border-primary/50 text-lg font-semibold"
                      />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label>Payment terms (optional override)</Label>
                        <Textarea rows={3} value={paymentTerms} onChange={e => setPaymentTerms(e.target.value)}
                          placeholder="Default Oestergaard payment terms will be used if left blank" />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Delivery terms (optional override)</Label>
                        <Textarea rows={3} value={deliveryTerms} onChange={e => setDeliveryTerms(e.target.value)}
                          placeholder="Default delivery wording will be used if left blank" />
                      </div>
                    </div>
                    <div className="flex justify-between pt-2">
                      <Button variant="outline" onClick={() => setStep(4)}>
                        <ArrowLeft className="h-4 w-4" /> Back
                      </Button>
                      <Button size="lg" onClick={() => void handleFinalize()} disabled={busy || !sfNumber.trim()}>
                        {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                        Generate Oestergaard quotation PDF
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
