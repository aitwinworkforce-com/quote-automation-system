import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ShieldAlert, CheckCircle2, Wrench, Search, ArrowUpDown, RefreshCw, AlertTriangle, FileText, Clock, DollarSign, Sparkles, Loader2 } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";

export default function AuditDashboard() {
  const { data: findings = [], isLoading, refetch } = trpc.audit.getFindings.useQuery();

  const [selectedFinding, setSelectedFinding] = useState<any | null>(null);
  const [aiSuggestion, setAiSuggestion] = useState<string>("");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const suggestionMutation = trpc.audit.getAiSuggestion.useMutation({
    onSuccess: (res) => {
      setAiSuggestion(String(res.suggestion || ""));
      setIsAiLoading(false);
    },
    onError: (err) => {
      setAiSuggestion(`Error fetching AI suggestion: ${err.message}`);
      setIsAiLoading(false);
    }
  });

  const fixMutation = trpc.audit.fixFinding.useMutation({
    onSuccess: (res) => {
      toast.success(res.message);
      setIsModalOpen(false);
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

  const openFixModal = (finding: any) => {
    setSelectedFinding(finding);
    setAiSuggestion("");
    setIsAiLoading(true);
    setIsModalOpen(true);

    suggestionMutation.mutate({
      findingId: finding.id,
      quoteId: finding.quoteId,
      type: finding.type,
      title: finding.title,
      description: finding.description,
    });
  };

  const handleExecuteFix = () => {
    if (!selectedFinding) return;
    let actionType: "fix_document" | "advance_workflow" | "confirm_fx" | "recompute_totals" = "fix_document";
    if (selectedFinding.type === "missing_document") actionType = "fix_document";
    if (selectedFinding.type === "stale_workflow") actionType = "advance_workflow";
    if (selectedFinding.type === "missing_fx_stamp") actionType = "confirm_fx";
    if (selectedFinding.type === "calculation_drift") actionType = "recompute_totals";

    fixMutation.mutate({
      findingId: selectedFinding.id,
      quoteId: selectedFinding.quoteId,
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
            Click "Fix Now" for AI-powered root cause analysis and automated remediation.
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
            <div className="space-y-3">
              {filteredAndSortedFindings.map((finding) => (
                <div
                  key={finding.id}
                  className="flex items-start gap-4 p-4 rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-50/50 transition-colors"
                >
                  {/* Severity indicator */}
                  <div className="flex-shrink-0 pt-0.5">
                    {finding.severity === "critical" && <div className="w-3 h-3 rounded-full bg-red-500" />}
                    {finding.severity === "high" && <div className="w-3 h-3 rounded-full bg-amber-500" />}
                    {finding.severity === "medium" && <div className="w-3 h-3 rounded-full bg-blue-400" />}
                    {finding.severity === "low" && <div className="w-3 h-3 rounded-full bg-slate-300" />}
                  </div>

                  {/* Main content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-sm text-slate-900 truncate">{finding.title}</span>
                      <Badge variant="outline" className="text-[10px] capitalize flex-shrink-0">
                        {finding.severity}
                      </Badge>
                    </div>
                    <p className="text-sm text-slate-600 line-clamp-1 mb-2">
                      {finding.description}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <Link href={`/quotes/${finding.quoteId}`} className="text-blue-600 hover:underline font-medium">
                        {finding.salesforceNumber || `#${finding.quoteId}`}
                      </Link>
                      {finding.customerName && <span>{finding.customerName}</span>}
                      {finding.supplierName && <span className="text-slate-400">• {finding.supplierName}</span>}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Link href={`/quotes/${finding.quoteId}`}>
                      <Button variant="ghost" size="sm" className="text-xs">
                        Inspect
                      </Button>
                    </Link>
                    <Button
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 text-xs"
                      onClick={() => openFixModal(finding)}
                    >
                      <Sparkles className="w-3 h-3" />
                      Fix Now
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* AI Remediation Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Sparkles className="w-5 h-5 text-indigo-600" />
              AI Remediation & Root Cause Analysis
            </DialogTitle>
            <DialogDescription>
              Review the AI assistant's diagnosis and recommended remediation steps before applying automated fixes.
            </DialogDescription>
          </DialogHeader>

          {selectedFinding && (
            <div className="space-y-4 my-2">
              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-slate-900">{selectedFinding.title}</span>
                  <Badge variant="outline" className="capitalize">{selectedFinding.severity} priority</Badge>
                </div>
                <p className="text-sm text-slate-700">{selectedFinding.description}</p>
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-indigo-500" />
                  AI Intelligence & Suggestions
                </h4>
                {isAiLoading ? (
                  <div className="p-8 rounded-lg border border-dashed border-slate-300 flex flex-col items-center justify-center text-muted-foreground gap-3 bg-white">
                    <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
                    <p className="text-sm">Analyzing quotation records and formulating recommendations...</p>
                  </div>
                ) : (
                  <div className="p-4 rounded-lg bg-indigo-50/50 border border-indigo-100 text-sm text-slate-800 whitespace-pre-line leading-relaxed">
                    {aiSuggestion}
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
              onClick={handleExecuteFix}
              disabled={fixMutation.isPending || isAiLoading}
            >
              {fixMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              <Wrench className="w-4 h-4" />
              Apply Automated Fix
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
