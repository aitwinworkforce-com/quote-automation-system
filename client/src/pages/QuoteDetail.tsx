import { useState } from "react";
import { useLocation, useRoute } from "wouter";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { BrandHeader } from "@/components/BrandHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft, Download, FileText, Loader2, RefreshCw, Trash2, TriangleAlert,
} from "lucide-react";

const fmt = (v: string | number | null | undefined, prefix = "") => {
  if (v == null || v === "") return "—";
  const n = typeof v === "string" ? parseFloat(v) : v;
  if (!Number.isFinite(n)) return "—";
  return `${prefix}${n.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export default function QuoteDetail() {
  const { isAuthenticated, loading } = useAuth();
  const [, params] = useRoute("/quotes/:id");
  const [, navigate] = useLocation();
  const quoteId = Number(params?.id);

  const [sfNumber, setSfNumber] = useState("");

  const { data, isLoading, refetch } = trpc.quotes.get.useQuery(
    { quoteId },
    { enabled: isAuthenticated && Number.isFinite(quoteId) },
  );
  const setSf = trpc.quotes.setSalesforceNumber.useMutation();
  const generatePdf = trpc.pdf.generateQuote.useMutation();
  const deleteQuote = trpc.quotes.delete.useMutation();
  const utils = trpc.useUtils();

  if (loading || (isAuthenticated && isLoading)) {
    return (
      <div className="flex min-h-screen flex-col">
        <BrandHeader />
        <div className="container flex-1 py-8">
          <Skeleton className="mb-4 h-8 w-64" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }
  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen flex-col">
        <BrandHeader />
        <div className="flex flex-1 flex-col items-center justify-center gap-4">
          <p className="text-muted-foreground">Please sign in to view quotes.</p>
          <Button onClick={() => startLogin()}>Sign in</Button>
        </div>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="flex min-h-screen flex-col">
        <BrandHeader />
        <div className="flex flex-1 flex-col items-center justify-center gap-3">
          <p className="text-muted-foreground">Quote not found.</p>
          <Button variant="outline" onClick={() => navigate("/")}>Back to dashboard</Button>
        </div>
      </div>
    );
  }

  const { quote, lineItems, supplier } = data;
  const needsSf = !quote.salesforceQuoteNumber;
  const canGenerate = !!quote.exchangeRateConfirmed && !!quote.grandTotalAud;

  const handleSetSfAndGenerate = async () => {
    try {
      if (needsSf) {
        if (!sfNumber.trim()) {
          toast.error("Enter the Salesforce quotation number first");
          return;
        }
        await setSf.mutateAsync({ quoteId, salesforceQuoteNumber: sfNumber.trim() });
      }
      const res = await generatePdf.mutateAsync({ quoteId });
      await refetch();
      utils.quotes.list.invalidate();
      toast.success("Quotation PDF generated");
      window.open(res.url, "_blank");
    } catch (e: any) {
      toast.error(e.message ?? "Failed to generate PDF");
    }
  };

  const currency = quote.supplierCurrency ?? "EUR";

  return (
    <div className="flex min-h-screen flex-col bg-muted/40">
      <BrandHeader />
      <main className="container max-w-5xl flex-1 py-8">
        <Button variant="ghost" size="sm" className="mb-4" onClick={() => navigate("/")}>
          <ArrowLeft className="h-4 w-4" /> Dashboard
        </Button>

        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">
                {quote.salesforceQuoteNumber ? `Quotation ${quote.salesforceQuoteNumber}` : `Quote draft #${quote.id}`}
              </h1>
              <StatusBadge status={quote.status} />
            </div>
            <p className="text-sm text-muted-foreground">
              {quote.customerName ?? "Unknown customer"} · {quote.productCategory ?? "—"} · {quote.quoteDate ?? ""}
            </p>
          </div>
          <div className="flex gap-2">
            {quote.supplierPdfUrl && (
              <Button variant="outline" asChild>
                <a href={quote.supplierPdfUrl} target="_blank" rel="noreferrer">
                  <FileText className="h-4 w-4" /> Supplier PDF
                </a>
              </Button>
            )}
            {quote.generatedPdfUrl && (
              <Button asChild>
                <a href={quote.generatedPdfUrl} target="_blank" rel="noreferrer">
                  <Download className="h-4 w-4" /> Quotation PDF
                </a>
              </Button>
            )}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="icon" className="text-destructive">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this quote?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This removes the quote record and its line items. Stored PDFs remain in file storage.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-white hover:bg-destructive/90"
                    onClick={async () => {
                      await deleteQuote.mutateAsync({ quoteId });
                      utils.quotes.list.invalidate();
                      toast.success("Quote deleted");
                      navigate("/");
                    }}
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        <div className="grid gap-6">
          {/* Details */}
          <Card>
            <CardHeader>
              <CardTitle>Quote details</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
                {[
                  ["Customer", quote.customerName],
                  ["Contact", quote.customerContact],
                  ["Address", quote.customerAddress],
                  ["Supplier", quote.supplierName],
                  ["Supplier quote ref", quote.supplierQuoteRef],
                  ["Pricing model", supplier?.pricingModel?.replaceAll("_", " ") ?? "as is"],
                  ["Currency", currency],
                  [
                    "Exchange rate",
                    quote.exchangeRate
                      ? `${Number(quote.exchangeRate).toFixed(4)}${quote.exchangeRateConfirmed ? " (confirmed)" : " (unconfirmed)"}`
                      : null,
                  ],
                  ["Rate source", quote.exchangeRateSource],
                  ["Margin %", quote.marginPct ? `${Number(quote.marginPct)}%` : null],
                  ["Distribution discount", quote.distributionDiscountPct ? `${Number(quote.distributionDiscountPct)}%` : null],
                  ["Product", quote.productCategory],
                ].map(([label, value]) => (
                  <div key={label as string}>
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="font-medium">{(value as string) || "—"}</dd>
                  </div>
                ))}
              </dl>
              {quote.productDescription && (
                <p className="mt-4 rounded-md bg-muted/50 p-3 text-sm">{quote.productDescription}</p>
              )}
            </CardContent>
          </Card>

          {/* Line items */}
          <Card>
            <CardHeader>
              <CardTitle>Line items</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40%]">Description</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>List ({currency})</TableHead>
                    <TableHead>Net cost ({currency})</TableHead>
                    <TableHead>Sell unit ({currency})</TableHead>
                    <TableHead>Sell total ({currency})</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lineItems.map(li => (
                    <TableRow key={li.id}>
                      <TableCell>{li.description}</TableCell>
                      <TableCell>{Number(li.quantity)}</TableCell>
                      <TableCell>{fmt(li.listUnitPrice)}</TableCell>
                      <TableCell>{fmt(li.netUnitCost)}</TableCell>
                      <TableCell>{fmt(li.sellUnitPrice)}</TableCell>
                      <TableCell className="font-medium">{fmt(li.sellTotalPrice)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {quote.grandTotalAud && (
                <div className="mt-4 grid gap-3 rounded-lg bg-muted/40 p-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Total sell ({currency})</p>
                    <p className="text-lg font-semibold">{fmt(quote.totalSellForeign)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Total sell (AUD)</p>
                    <p className="text-lg font-semibold">{fmt(quote.totalSellAud, "$")}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Freight + install + other (AUD)</p>
                    <p className="text-lg font-semibold">
                      {fmt(
                        Number(quote.freightCostAud ?? 0) +
                          Number(quote.installationCostAud ?? 0) +
                          Number(quote.otherLocalCostAud ?? 0),
                        "$",
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Grand total (AUD, ex GST)</p>
                    <p className="text-xl font-bold text-primary">{fmt(quote.grandTotalAud, "$")}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Finalise / regenerate */}
          {quote.status !== "finalized" && (
            <Card>
              <CardHeader>
                <CardTitle>Finalise</CardTitle>
                <CardDescription>
                  {canGenerate
                    ? needsSf
                      ? "Enter the Salesforce quotation number to generate the branded PDF."
                      : "Ready to generate the branded quotation PDF."
                    : "Costing has not been completed for this quote — reopen it via the New Quote workflow."}
                </CardDescription>
              </CardHeader>
              {canGenerate && (
                <CardContent className="space-y-4">
                  {needsSf && (
                    <>
                      <Alert className="border-violet-300 bg-violet-50 text-violet-900">
                        <TriangleAlert className="h-4 w-4" />
                        <AlertTitle>Salesforce quotation number required</AlertTitle>
                        <AlertDescription>
                          Create the quotation in Salesforce, then paste the number below before generating the PDF.
                        </AlertDescription>
                      </Alert>
                      <div className="grid gap-2 sm:max-w-sm">
                        <Label className="font-semibold">Salesforce quotation number *</Label>
                        <Input
                          placeholder="e.g. QU-8452"
                          value={sfNumber}
                          onChange={e => setSfNumber(e.target.value)}
                          className="border-primary/50 font-semibold"
                        />
                      </div>
                    </>
                  )}
                  <Button
                    onClick={() => void handleSetSfAndGenerate()}
                    disabled={setSf.isPending || generatePdf.isPending || (needsSf && !sfNumber.trim())}
                  >
                    {(setSf.isPending || generatePdf.isPending) && <Loader2 className="h-4 w-4 animate-spin" />}
                    Generate quotation PDF
                  </Button>
                </CardContent>
              )}
            </Card>
          )}

          {quote.status === "finalized" && (
            <Card>
              <CardHeader>
                <CardTitle>Regenerate PDF</CardTitle>
                <CardDescription>
                  Re-produce the quotation PDF (e.g. after correcting details). The stored file will be replaced.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  variant="outline"
                  onClick={() => void handleSetSfAndGenerate()}
                  disabled={generatePdf.isPending}
                >
                  {generatePdf.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  Regenerate quotation PDF
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
