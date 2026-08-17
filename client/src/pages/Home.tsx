import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { BrandHeader } from "@/components/BrandHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { QUOTE_STATUSES, STATUS_LABELS, type QuoteStatus } from "@shared/types";
import {
  FilePlus2,
  FileText,
  Search,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Landmark,
} from "lucide-react";
import { Download } from "lucide-react";

function LandingHero() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <BrandHeader />
      <main className="flex-1">
        <section className="relative overflow-hidden border-b bg-gradient-to-br from-[#0e3a5c] via-[#1F6FB2] to-[#29ABE2] text-white">
          <div className="container grid gap-10 py-20 md:grid-cols-[3fr_2fr] md:items-center md:py-28">
            <div>
              <p className="mb-3 text-sm font-semibold uppercase tracking-[0.25em] text-sky-200">
                Internal Quoting Platform
              </p>
              <h1 className="max-w-xl text-4xl font-extrabold leading-tight md:text-5xl">
                From supplier PDF to branded quotation in minutes.
              </h1>
              <p className="mt-5 max-w-lg text-lg text-sky-100">
                Upload a supplier quote, let AI extract the line items, apply the correct
                pricing model, confirm live exchange rates, and generate a finished
                Oestergaard quotation — all in one guided workflow.
              </p>
              <Button
                size="lg"
                className="mt-8 bg-white text-[#1F6FB2] hover:bg-sky-50"
                onClick={() => startLogin()}
              >
                Sign in to get started
              </Button>
            </div>
            <div className="hidden space-y-4 md:block">
              {[
                { icon: Sparkles, title: "AI extraction", body: "Line items, prices and references pulled straight from supplier PDFs." },
                { icon: Landmark, title: "Live FX with confirmation", body: "AUD/EUR and AUD/USD rates fetched live — never applied without your approval." },
                { icon: TrendingUp, title: "Supplier pricing engine", body: "Collimatic, Marlin/Duravant, Foodmate, Nutri Soy and Phenova rules built in." },
                { icon: ShieldCheck, title: "Branded output", body: "Finished PDFs matching the Oestergaard quotation template." },
              ].map(f => (
                <div key={f.title} className="flex items-start gap-4 rounded-lg bg-white/10 p-4 backdrop-blur">
                  <f.icon className="mt-0.5 h-5 w-5 shrink-0 text-sky-200" />
                  <div>
                    <p className="font-semibold">{f.title}</p>
                    <p className="text-sm text-sky-100">{f.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
        <section className="container py-10 text-center text-sm text-muted-foreground">
          Access is restricted to authorised Oestergaard team members.
        </section>
      </main>
    </div>
  );
}

function Dashboard() {
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [supplierName, setSupplierName] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const { data: suppliers } = trpc.quotes.suppliers.useQuery();
  const { data: quotes, isLoading } = trpc.quotes.list.useQuery({
    search: search || undefined,
    status: status === "all" ? undefined : status,
    supplierName: supplierName === "all" ? undefined : supplierName,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  });

  const stats = {
    total: quotes?.length ?? 0,
    finalized: quotes?.filter(q => q.status === "finalized").length ?? 0,
    inProgress: quotes?.filter(q => q.status !== "finalized").length ?? 0,
  };

  return (
    <div className="flex min-h-screen flex-col bg-muted/40">
      <BrandHeader />
      <main className="container flex-1 py-8">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Quote Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              All quotations generated through the AI quote workflow.
            </p>
          </div>
          <Button onClick={() => navigate("/quotes/new")} size="lg">
            <FilePlus2 className="h-4 w-4" /> New Quote
          </Button>
          {quotes && quotes.length > 0 && (
            <Button
              variant="outline"
              onClick={() => {
                if (!quotes) return;
                const headers = ["Quote #", "Customer", "Product", "Supplier", "Date", "Total (AUD)", "Status", "SF Number"];
                const rows = quotes.map(q => [
                  q.salesforceQuoteNumber || `#${q.id}`,
                  q.customerName || "",
                  q.productCategory || "",
                  q.supplierName || "",
                  q.quoteDate || "",
                  q.grandTotalAud ? Number(q.grandTotalAud).toFixed(2) : "",
                  q.status,
                  q.salesforceQuoteNumber || "",
                ]);
                const csvContent = [headers, ...rows]
                  .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
                  .join("\n");
                const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `oestergaard-quotes-${new Date().toISOString().slice(0, 10)}.csv`;
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              <Download className="h-4 w-4" /> Export CSV
            </Button>
          )}
        </div>

        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          {[
            { label: "Total quotes", value: stats.total },
            { label: "In progress", value: stats.inProgress },
            { label: "Finalised", value: stats.finalized },
          ].map(s => (
            <Card key={s.label}>
              <CardContent className="pt-5">
                <p className="text-sm text-muted-foreground">{s.label}</p>
                <p className="text-3xl font-bold text-primary">{s.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardContent className="pt-5">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <div className="relative min-w-[220px] flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search customer, product, quote number..."
                  className="pl-9"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {QUOTE_STATUSES.map(s => (
                    <SelectItem key={s} value={s}>
                      {STATUS_LABELS[s as QuoteStatus]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={supplierName} onValueChange={setSupplierName}>
                <SelectTrigger className="w-[190px]">
                  <SelectValue placeholder="Supplier" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All suppliers</SelectItem>
                  {suppliers?.map(s => (
                    <SelectItem key={s.id} value={s.name}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={e => setDateFrom(e.target.value)}
                  className="w-[150px]"
                  placeholder="From"
                />
                <span className="text-muted-foreground text-sm">to</span>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={e => setDateTo(e.target.value)}
                  className="w-[150px]"
                  placeholder="To"
                />
                {(dateFrom || dateTo) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setDateFrom(""); setDateTo(""); }}
                    className="text-xs text-muted-foreground"
                  >
                    Clear
                  </Button>
                )}
              </div>
            </div>

            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : !quotes || quotes.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-16 text-center">
                <FileText className="h-10 w-10 text-muted-foreground/50" />
                <p className="font-medium">No quotes yet</p>
                <p className="max-w-sm text-sm text-muted-foreground">
                  Start by uploading a supplier quote PDF — the AI will extract the data and
                  guide you through costing to a finished quotation.
                </p>
                <Button className="mt-2" onClick={() => navigate("/quotes/new")}>
                  <FilePlus2 className="h-4 w-4" /> Create your first quote
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Quote #</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Total (AUD)</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Accuracy</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {quotes.map(q => (
                    <TableRow
                      key={q.id}
                      className="cursor-pointer"
                      onClick={() => navigate(`/quotes/${q.id}`)}
                    >
                      <TableCell className="font-mono text-sm font-medium text-primary">
                        <span className="inline-flex items-center gap-1.5">
                          {q.salesforceQuoteNumber ?? `#${q.id}`}
                          {q.revisionLabel && q.revisionLabel !== "A" && (
                            <span className="rounded bg-primary/10 px-1.5 py-0.5 font-sans text-[10px] font-semibold uppercase tracking-wide text-primary">
                              Rev {q.revisionLabel}
                            </span>
                          )}
                          {q.revisionLabel && q.revisionLabel !== "A" && !q.isLatestRevision && (
                            <span className="rounded bg-muted px-1.5 py-0.5 font-sans text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                              Superseded
                            </span>
                          )}
                        </span>
                      </TableCell>
                      <TableCell>{q.customerName ?? "—"}</TableCell>
                      <TableCell className="max-w-[220px] truncate">{q.productCategory ?? "—"}</TableCell>
                      <TableCell>{q.supplierName ?? "—"}</TableCell>
                      <TableCell className="whitespace-nowrap">{q.quoteDate ?? "—"}</TableCell>
                      <TableCell className="whitespace-nowrap font-medium">
                        {q.grandTotalAud
                          ? `$${Number(q.grandTotalAud).toLocaleString("en-AU", { minimumFractionDigits: 2 })}`
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={q.status} />
                      </TableCell>
                      <TableCell>
                        <AccuracyBadge quoteId={q.id} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

export default function Home() {
  const { isAuthenticated, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Skeleton className="h-8 w-48" />
      </div>
    );
  }
  return isAuthenticated ? <Dashboard /> : <LandingHero />;
}
function AccuracyBadge({ quoteId }: { quoteId: number }) {
  const { data, isLoading, isError } = trpc.audit.scoreQuote.useQuery({ quoteId });
  if (isLoading) return <span className="inline-block h-5 w-10 animate-pulse rounded bg-muted" />;
  if (isError || !data) return <span className="text-xs text-muted-foreground">—</span>;
  const color = data.score >= 90 ? "text-green-700 bg-green-50" : data.score >= 70 ? "text-amber-700 bg-amber-50" : "text-red-700 bg-red-50";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${color}`}>
      {data.score}%
    </span>
  );
}
