import { trpc } from "@/lib/trpc";
import { BrandHeader } from "@/components/BrandHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

export default function OpportunityBySupplier() {
  const { data: quotes, isLoading } = trpc.quotes.list.useQuery();

  // Aggregate by supplier
  const supplierMap = new Map<string, { count: number; totalAud: number; finalized: number }>();
  if (quotes) {
    for (const q of quotes) {
      const name = q.supplierName ?? "Unknown";
      const existing = supplierMap.get(name) ?? { count: 0, totalAud: 0, finalized: 0 };
      existing.count += 1;
      existing.totalAud += Number(q.grandTotalAud ?? 0);
      if (q.status === "finalized") existing.finalized += 1;
      supplierMap.set(name, existing);
    }
  }

  const rows = Array.from(supplierMap.entries())
    .map(([name, data]) => ({ name, ...data, winRate: data.count > 0 ? Math.round((data.finalized / data.count) * 100) : 0 }))
    .sort((a, b) => b.totalAud - a.totalAud);

  const totalQuotes = rows.reduce((s, r) => s + r.count, 0);
  const totalValue = rows.reduce((s, r) => s + r.totalAud, 0);
  const totalFinalized = rows.reduce((s, r) => s + r.finalized, 0);

  return (
    <div className="min-h-screen bg-background">
      <BrandHeader />
      <main className="container py-8">
        <h1 className="text-2xl font-bold mb-1">Opportunity by Supplier</h1>
        <p className="text-muted-foreground mb-6">Quote volume, value, and conversion rate broken down by supplier.</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="pt-5">
              <p className="text-sm text-muted-foreground">Total Quotes</p>
              <p className="text-3xl font-bold text-primary">{totalQuotes}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <p className="text-sm text-muted-foreground">Total Value (AUD)</p>
              <p className="text-3xl font-bold text-primary">${totalValue.toLocaleString("en-AU", { minimumFractionDigits: 2 })}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <p className="text-sm text-muted-foreground">Finalized Quotes</p>
              <p className="text-3xl font-bold text-primary">{totalFinalized}</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="pt-5">
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : rows.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No quote data available yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Supplier</TableHead>
                    <TableHead className="text-right">Quotes</TableHead>
                    <TableHead className="text-right">Total Value (AUD)</TableHead>
                    <TableHead className="text-right">Finalized</TableHead>
                    <TableHead className="text-right">Win Rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map(r => (
                    <TableRow key={r.name}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell className="text-right">{r.count}</TableCell>
                      <TableCell className="text-right font-medium">${r.totalAud.toLocaleString("en-AU", { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell className="text-right">{r.finalized}</TableCell>
                      <TableCell className="text-right">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${r.winRate >= 70 ? "text-green-700 bg-green-50" : r.winRate >= 40 ? "text-amber-700 bg-amber-50" : "text-red-700 bg-red-50"}`}>
                          {r.winRate}%
                        </span>
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
