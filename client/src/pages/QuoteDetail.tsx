import { useState } from "react";
import { useLocation, useRoute } from "wouter";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { BrandHeader } from "@/components/BrandHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { SendQuoteDialog } from "@/components/SendQuoteDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft, CheckCircle2, Download, FileText, GitBranch, Loader2, Pencil, RefreshCw,
  ShieldCheck, Trash2, TriangleAlert,
} from "lucide-react";

const fmt = (v: string | number | null | undefined, prefix = "") => {
  if (v == null || v === "") return "—";
  const n = typeof v === "string" ? parseFloat(v) : v;
  if (!Number.isFinite(n)) return "—";
  return `${prefix}${n.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export default function QuoteDetail() {
  const { isAuthenticated, loading, user } = useAuth();
  const [, params] = useRoute("/quotes/:id");
  const [, navigate] = useLocation();
  const quoteId = Number(params?.id);

  const [sfNumber, setSfNumber] = useState("");
  const [revisionNote, setRevisionNote] = useState("");
  const [revisionDialogOpen, setRevisionDialogOpen] = useState(false);
  const [editItems, setEditItems] = useState(false);
  const [editedItems, setEditedItems] = useState<
    { description: string; quantity: string; listUnitPrice: string; netUnitCost: string; sellUnitPrice: string }[]
  >([]);

  const { data, isLoading, refetch } = trpc.quotes.get.useQuery(
    { quoteId },
    { enabled: isAuthenticated && Number.isFinite(quoteId) },
  );
  const { data: revisionChain } = trpc.revisions.chain.useQuery(
    { quoteId },
    { enabled: isAuthenticated && Number.isFinite(quoteId) },
  );
  const setSf = trpc.quotes.setSalesforceNumber.useMutation();
  const generatePdf = trpc.pdf.generateQuote.useMutation();
  const generateDocx = trpc.pdf.generateQuoteDocx.useMutation();
  const deleteQuote = trpc.quotes.delete.useMutation();
  const createRevision = trpc.revisions.create.useMutation();
  const submitForReview = trpc.revisions.submitForReview.useMutation();
  const approveQuote = trpc.revisions.approve.useMutation();
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

  const handleCreateRevision = async () => {
    try {
      let items;
      if (editItems && editedItems.length > 0) {
        items = editedItems.map(li => ({
          description: li.description,
          quantity: Number(li.quantity) || 0,
          listUnitPrice: li.listUnitPrice === "" ? null : Number(li.listUnitPrice),
          netUnitCost: li.netUnitCost === "" ? null : Number(li.netUnitCost),
          sellUnitPrice: Number(li.sellUnitPrice) || 0,
        }));
        if (items.some(li => li.quantity <= 0 || !li.description.trim())) {
          toast.error("Each line item needs a description and a quantity above zero");
          return;
        }
      }
      const res = await createRevision.mutateAsync({
        quoteId,
        note: revisionNote.trim() || undefined,
        items,
      });
      setRevisionDialogOpen(false);
      setRevisionNote("");
      setEditItems(false);
      utils.quotes.list.invalidate();
      utils.revisions.chain.invalidate();
      toast.success(`Revision ${res.revisionLabel} created`);
      navigate(`/quotes/${res.newQuoteId}`);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to create revision");
    }
  };

  const openRevisionDialog = (open: boolean) => {
    if (open) {
      setEditedItems(
        lineItems.map(li => ({
          description: li.description ?? "",
          quantity: String(Number(li.quantity) || 1),
          listUnitPrice: li.listUnitPrice != null ? String(Number(li.listUnitPrice)) : "",
          netUnitCost: li.netUnitCost != null ? String(Number(li.netUnitCost)) : "",
          sellUnitPrice: li.sellUnitPrice != null ? String(Number(li.sellUnitPrice)) : "0",
        })),
      );
      setEditItems(false);
    }
    setRevisionDialogOpen(open);
  };

  const handleSubmitForReview = async () => {
    try {
      await submitForReview.mutateAsync({ quoteId });
      await refetch();
      utils.quotes.list.invalidate();
      toast.success("Quote submitted for review");
    } catch (e: any) {
      toast.error(e.message ?? "Failed to submit for review");
    }
  };

  const handleApprove = async () => {
    try {
      await approveQuote.mutateAsync({ quoteId });
      await refetch();
      utils.quotes.list.invalidate();
      toast.success("Quote approved");
    } catch (e: any) {
      toast.error(e.message ?? "Failed to approve");
    }
  };

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
      const docxRes = await generateDocx.mutateAsync({ quoteId }).catch(() => null);
      await refetch();
      utils.quotes.list.invalidate();
      toast.success("Quotation documents generated");
      window.open(docxRes?.url ?? res.url, "_blank");
    } catch (e: any) {
      toast.error(e.message ?? "Failed to generate documents");
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
              {quote.revisionLabel && quote.revisionLabel !== "A" && (
                <Badge variant="secondary" className="font-semibold">Rev {quote.revisionLabel}</Badge>
              )}
              <StatusBadge status={quote.status} />
            </div>
            <p className="text-sm text-muted-foreground">
              {quote.customerName ?? "Unknown customer"} · {quote.productCategory ?? "—"} · {quote.quoteDate ?? ""}
            </p>
          </div>
          <div className="flex gap-2">
            <Dialog open={revisionDialogOpen} onOpenChange={openRevisionDialog}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <GitBranch className="h-4 w-4" /> New revision
                </Button>
              </DialogTrigger>
              <DialogContent className={editItems ? "sm:max-w-3xl" : "sm:max-w-md"}>
                <DialogHeader>
                  <DialogTitle>Create revision {quote.revisionLabel ? `(next after Rev ${quote.revisionLabel})` : ""}</DialogTitle>
                  <DialogDescription>
                    Clones this quote's details, costing and line items into a new linked draft.
                    You'll enter a new Salesforce number and regenerate the PDF for the revision.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-2 py-2">
                  <Label>Reason for revision (optional)</Label>
                  <Textarea
                    rows={3}
                    placeholder="e.g. Customer requested updated freight allowance"
                    value={revisionNote}
                    onChange={e => setRevisionNote(e.target.value)}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant={editItems ? "secondary" : "outline"}
                    size="sm"
                    onClick={() => setEditItems(v => !v)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    {editItems ? "Editing line items" : "Edit line items in this revision"}
                  </Button>
                  {!editItems && (
                    <span className="text-xs text-muted-foreground">Otherwise items are copied unchanged.</span>
                  )}
                </div>
                {editItems && (
                  <div className="max-h-72 overflow-y-auto rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[40%]">Description</TableHead>
                          <TableHead>Qty</TableHead>
                          <TableHead>Net cost ({currency})</TableHead>
                          <TableHead>Sell unit ({currency})</TableHead>
                          <TableHead>Sell total ({currency})</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {editedItems.map((li, idx) => (
                          <TableRow key={idx}>
                            <TableCell>
                              <Input
                                value={li.description}
                                onChange={e =>
                                  setEditedItems(items =>
                                    items.map((it, i) => (i === idx ? { ...it, description: e.target.value } : it)),
                                  )
                                }
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min="0"
                                className="w-20"
                                value={li.quantity}
                                onChange={e =>
                                  setEditedItems(items =>
                                    items.map((it, i) => (i === idx ? { ...it, quantity: e.target.value } : it)),
                                  )
                                }
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                className="w-28"
                                value={li.netUnitCost}
                                onChange={e =>
                                  setEditedItems(items =>
                                    items.map((it, i) => (i === idx ? { ...it, netUnitCost: e.target.value } : it)),
                                  )
                                }
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                className="w-28"
                                value={li.sellUnitPrice}
                                onChange={e =>
                                  setEditedItems(items =>
                                    items.map((it, i) => (i === idx ? { ...it, sellUnitPrice: e.target.value } : it)),
                                  )
                                }
                              />
                            </TableCell>
                            <TableCell className="text-sm font-medium">
                              {fmt((Number(li.quantity) || 0) * (Number(li.sellUnitPrice) || 0))}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
                {editItems && (
                  <p className="text-xs text-muted-foreground">
                    Totals (sell {currency}, AUD and grand total) are recalculated automatically using the
                    original confirmed exchange rate and local costs.
                  </p>
                )}
                <DialogFooter>
                  <Button variant="outline" onClick={() => openRevisionDialog(false)}>Cancel</Button>
                  <Button onClick={() => void handleCreateRevision()} disabled={createRevision.isPending}>
                    {createRevision.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                    Create revision
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
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
            {quote.generatedDocxUrl && (
              <Button asChild variant="default">
                <a href={quote.generatedDocxUrl} target="_blank" rel="noreferrer">
                  <Download className="h-4 w-4" /> Quotation DOCX
                </a>
              </Button>
            )}
            {quote.supplierDocxUrl && (
              <Button variant="outline" asChild>
                <a href={quote.supplierDocxUrl} target="_blank" rel="noreferrer">
                  <FileText className="h-4 w-4" /> Supplier DOCX
                </a>
              </Button>
            )}
            {quote.supplierXlsUrl && (
              <Button variant="outline" asChild>
                <a href={quote.supplierXlsUrl} target="_blank" rel="noreferrer">
                  <FileText className="h-4 w-4" /> Supplier XLS
                </a>
              </Button>
            )}
            {quote.status === "finalized" && <SendQuoteDialog quote={quote} />}
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
          {/* Revision history */}
          {revisionChain && revisionChain.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <GitBranch className="h-4 w-4" /> Revision history
                </CardTitle>
                <CardDescription>
                  {revisionChain.length > 1
                    ? "All iterations of this quotation, linked for a complete audit trail."
                    : "This is the original version (Rev A). Use the \"New revision\" button above to create a linked Rev B when the customer requests changes."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Revision</TableHead>
                      <TableHead>Salesforce #</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Grand total (AUD)</TableHead>
                      <TableHead>Note</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {revisionChain.map(rev => (
                      <TableRow
                        key={rev.id}
                        className={rev.id === quote.id ? "bg-primary/5" : "cursor-pointer hover:bg-muted/50"}
                        onClick={() => rev.id !== quote.id && navigate(`/quotes/${rev.id}`)}
                      >
                        <TableCell className="font-semibold">
                          Rev {rev.revisionLabel}
                          {rev.id === quote.id && <span className="ml-2 text-xs text-muted-foreground">(viewing)</span>}
                          {!!rev.isLatestRevision && (
                            <Badge variant="secondary" className="ml-2 text-[10px]">Latest</Badge>
                          )}
                        </TableCell>
                        <TableCell>{rev.salesforceQuoteNumber ?? "—"}</TableCell>
                        <TableCell><StatusBadge status={rev.status} /></TableCell>
                        <TableCell>{fmt(rev.grandTotalAud, "$")}</TableCell>
                        <TableCell className="max-w-52 truncate text-sm text-muted-foreground">{rev.revisionNote ?? "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {rev.createdAt ? new Date(rev.createdAt).toLocaleDateString("en-AU") : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

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
              {!!quote.exchangeRateConfirmed && quote.rateConfirmedByName && (
                <div className="mt-4 flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                  <ShieldCheck className="h-4 w-4 shrink-0" />
                  <span>
                    Exchange rate confirmed by <strong>{quote.rateConfirmedByName}</strong>
                    {quote.rateConfirmedAt
                      ? ` on ${new Date(quote.rateConfirmedAt).toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short" })}`
                      : ""}
                  </span>
                </div>
              )}
              {quote.approvedByName && (
                <div className="mt-2 flex items-center gap-2 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-800">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>
                    Approved by <strong>{quote.approvedByName}</strong>
                    {quote.approvedAt
                      ? ` on ${new Date(quote.approvedAt).toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short" })}`
                      : ""}
                  </span>
                </div>
              )}
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

          {/* Review & approval */}
          {["costed", "awaiting_sf_number", "in_review"].includes(quote.status) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" /> Review &amp; approval
                </CardTitle>
                <CardDescription>
                  {quote.status === "in_review"
                    ? "This quote is awaiting manager approval before it can be finalised."
                    : "Optionally submit this quote for manager review before finalising."}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center gap-3">
                {quote.status !== "in_review" ? (
                  <Button
                    variant="outline"
                    onClick={() => void handleSubmitForReview()}
                    disabled={submitForReview.isPending}
                  >
                    {submitForReview.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                    Submit for review
                  </Button>
                ) : user?.role === "admin" ? (
                  <Button onClick={() => void handleApprove()} disabled={approveQuote.isPending}>
                    {approveQuote.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                    <CheckCircle2 className="h-4 w-4" /> Approve quote
                  </Button>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Waiting for a manager (admin) to approve. You'll be able to finalise once approved.
                  </p>
                )}
                {quote.submittedForReviewAt && quote.status === "in_review" && (
                  <span className="text-xs text-muted-foreground">
                    Submitted {new Date(quote.submittedForReviewAt).toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short" })}
                  </span>
                )}
              </CardContent>
            </Card>
          )}

          {/* Finalise / regenerate */}
          {quote.status !== "finalized" && quote.status !== "in_review" && (
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
                <CardTitle>Regenerate Documents</CardTitle>
                <CardDescription>
                  Re-produce the quotation DOCX and PDF (e.g. after correcting details). The stored files will be replaced.
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
                  Regenerate quotation documents
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
