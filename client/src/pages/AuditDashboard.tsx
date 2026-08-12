import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ShieldAlert, CheckCircle2, Wrench, Search, ArrowUpDown, RefreshCw, AlertTriangle, FileText, Clock, DollarSign } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";

export default function AuditDashboard() {

  const utils = trpc.useUtils();
  const { data: findings = [], isLoading, refetch } = trpc.audit.getFindings.useQuery();

  const fixMutation = trpc.audit.fixFinding.useMutation({
    onSuccess: (res) => {
      toast.success(res.message);
      refetch();
    },
    onError: (err) => {
      toast.error(err.message ?? "Remediation failed");
    }
  });

  // Filtering and sorting state
  const [searchQuery, setSearchQuery] = useState("");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"severity" | "date" | "quoteId">("severity");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const severityRank = { critical: 4, high: 3, medium: 2, low: 1 };

  const filteredAndSortedFindings = useMemo(() => {
    return findings.filter(f => {
      const matchQuery = 
        f.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (f.salesforceNumber && f.salesforceNumber.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (f.customerName && f.customerName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (f.supplierName && f.supplierName.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchSeverity = severityFilter === "all" || f.severity === severityFilter;
      const matchType = typeFilter === "all" || f.type === typeFilter;

      return matchQuery && matchSeverity && matchType;
    }).sort((a, b) => {
      let cmp = 0;
      if (sortBy === "severity") {
        cmp = (severityRank[b.severity as keyof typeof severityRank] || 0) - (severityRank[a.severity as keyof typeof severityRank] || 0);
      } else if (sortBy === "date") {
        cmp = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      } else if (sortBy === "quoteId") {
        cmp = b.quoteId - a.quoteId;
      }
      return sortOrder === "asc" ? -cmp : cmp;
    });
  }, [findings, searchQuery, severityFilter, typeFilter, sortBy, sortOrder]);

  const stats = useMemo(() => {
    return {
      total: findings.length,
      critical: findings.filter(f => f.severity === "critical").length,
      high: findings.filter(f => f.severity === "high").length,
      medium: findings.filter(f => f.severity === "medium").length,
    };
  }, [findings]);

  const handleFix = (finding: any) => {
    let actionType: "fix_document" | "advance_workflow" | "confirm_fx" | "recompute_totals" = "fix_document";
    if (finding.type === "missing_document") actionType = "fix_document";
    if (finding.type === "stale_workflow") actionType = "advance_workflow";
    if (finding.type === "missing_fx_stamp") actionType = "confirm_fx";
    if (finding.type === "calculation_drift") actionType = "recompute_totals";

    fixMutation.mutate({
      findingId: finding.id,
      quoteId: finding.quoteId,
      actionType,
    });
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Audit Agent Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Automated health checks for quotation calculations, workflow integrity, missing documents, and FX audit stamps.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/">
            <Button variant="outline">Back to Quotes</Button>
          </Link>
          <Button onClick={() => refetch()} variant="default" className="gap-2">
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            Run Audit Scan
          </Button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card className="border-l-4 border-l-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Findings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground mt-1">Active discrepancies detected</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-600 bg-red-50/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-red-700">Critical / Drift</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.critical}</div>
            <p className="text-xs text-red-600 mt-1">Require immediate numerical review</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500 bg-amber-50/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-amber-700">High Priority</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{stats.high}</div>
            <p className="text-xs text-amber-600 mt-1">Missing documents & FX stamps</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500 bg-blue-50/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-blue-700">Medium / Stale</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.medium}</div>
            <p className="text-xs text-blue-600 mt-1">Stale drafts & in-review quotes</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search Toolbar */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative w-full md:w-96">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search findings, customer, supplier, quote..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <Select value={severityFilter} onValueChange={setSeverityFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Severity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Severities</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                </SelectContent>
              </Select>

              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Error Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Error Types</SelectItem>
                  <SelectItem value="calculation_drift">Calculation Drift</SelectItem>
                  <SelectItem value="missing_document">Missing Document</SelectItem>
                  <SelectItem value="missing_fx_stamp">Missing FX Stamp</SelectItem>
                  <SelectItem value="stale_workflow">Stale Workflow</SelectItem>
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={(val: any) => setSortBy(val)}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="severity">Sort: Severity</SelectItem>
                  <SelectItem value="date">Sort: Date</SelectItem>
                  <SelectItem value="quoteId">Sort: Quote #</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSortOrder(prev => prev === "asc" ? "desc" : "asc")}
                title="Toggle sort direction"
              >
                <ArrowUpDown className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Findings Table */}
      <Card>
        <CardHeader>
          <CardTitle>Discrepancies & Audit Findings ({filteredAndSortedFindings.length})</CardTitle>
          <CardDescription>
            Click "Fix Now" for automated remediation or inspect the quotation directly.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-12 text-center text-muted-foreground">Running audit scans across quotes...</div>
          ) : filteredAndSortedFindings.length === 0 ? (
            <div className="py-12 text-center flex flex-col items-center justify-center">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mb-3" />
              <h3 className="text-lg font-medium text-slate-900">No discrepancies found</h3>
              <p className="text-sm text-muted-foreground mt-1">
                All quotes comply with pricing, calculation, and document validation rules.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                TableHeader
                <TableHeader>
                  <TableRow>
                    <TableHead>Severity</TableHead>
                    <TableHead>Quote / Ref</TableHead>
                    <TableHead>Customer / Supplier</TableHead>
                    <TableHead>Issue Type</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAndSortedFindings.map((finding) => (
                    <TableRow key={finding.id} className="hover:bg-slate-50/50">
                      <TableCell>
                        <Badge
                          variant={
                            finding.severity === "critical"
                              ? "destructive"
                              : finding.severity === "high"
                              ? "default"
                              : "secondary"
                          }
                          className="capitalize"
                        >
                          {finding.severity}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">
                        <Link href={`/quotes/${finding.quoteId}`} className="text-blue-600 hover:underline">
                          {finding.salesforceNumber || `Quote #${finding.quoteId}`}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{finding.customerName || "Unassigned Customer"}</div>
                        <div className="text-xs text-muted-foreground">{finding.supplierName || "General"}</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 font-medium text-slate-800">
                          {finding.type === "calculation_drift" && <DollarSign className="w-4 h-4 text-red-600" />}
                          {finding.type === "missing_document" && <FileText className="w-4 h-4 text-amber-600" />}
                          {finding.type === "missing_fx_stamp" && <AlertTriangle className="w-4 h-4 text-amber-600" />}
                          {finding.type === "stale_workflow" && <Clock className="w-4 h-4 text-blue-600" />}
                          {finding.title}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-md text-sm text-muted-foreground">
                        {finding.description}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link href={`/quotes/${finding.quoteId}`}>
                            <Button variant="outline" size="sm">Inspect</Button>
                          </Link>
                          <Button
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                            onClick={() => handleFix(finding)}
                            disabled={fixMutation.isPending}
                          >
                            <Wrench className="w-3.5 h-3.5" />
                            Fix Now
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
