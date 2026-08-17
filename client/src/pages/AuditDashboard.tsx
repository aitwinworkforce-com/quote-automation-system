import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ShieldAlert, CheckCircle2, Wrench, Search, RefreshCw, Sparkles, Loader2, ChevronDown, ChevronRight, AlertCircle, FileWarning, Clock, Calculator } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";

const TYPE_META: Record<string, { label: string; icon: any; color: string }> = {
  calculation_drift: { label: "Calculation Drift", icon: Calculator, color: "text-red-600 bg-red-50 border-red-200" },
  missing_document: { label: "Missing Documents", icon: FileWarning, color: "text-amber-600 bg-amber-50 border-amber-200" },
  missing_fx_stamp: { label: "Missing FX Stamp", icon: AlertCircle, color: "text-orange-600 bg-orange-50 border-orange-200" },
  stale_workflow: { label: "Stale Workflows", icon: Clock, color: "text-blue-600 bg-blue-50 border-blue-200" },
};

export default function AuditDashboard() {
  const { data: findings = [], isLoading, refetch } = trpc.audit.getFindings.useQuery();
  const [selectedFinding, setSelectedFinding] = useState<any | null>(null);
  const [aiSuggestion, setAiSuggestion] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(["calculation_drift", "missing_document", "missing_fx_stamp", "stale_workflow"]));
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [isScanning, setIsScanning] = useState(false);

  const suggestionMutation = trpc.audit.getAiSuggestion.useMutation({
    onSuccess: (res) => { setAiSuggestion(String(res.suggestion || "")); setIsAiLoading(false); },
    onError: (err) => { setAiSuggestion(`Error: ${err.message}`); setIsAiLoading(false); },
  });

  const fixMutation = trpc.audit.fixFinding.useMutation({
    onSuccess: (res) => { toast.success(res.message); setIsModalOpen(false); refetch(); },
    onError: (err) => { toast.error(err.message ?? "Remediation failed"); },
  });

  const filtered = useMemo(() => {
    if (!searchQuery) return findings;
    const q = searchQuery.toLowerCase();
    return findings.filter(f =>
      f.title.toLowerCase().includes(q) ||
      f.description.toLowerCase().includes(q) ||
      (f.salesforceNumber && f.salesforceNumber.toLowerCase().includes(q)) ||
      (f.customerName && f.customerName.toLowerCase().includes(q)) ||
      (f.supplierName && f.supplierName.toLowerCase().includes(q))
    );
  }, [findings, searchQuery]);

  const grouped = useMemo(() => {
    const groups: Record<string, any[]> = {};
    for (const f of filtered) {
      const key = f.type || "other";
      if (!groups[key]) groups[key] = [];
      groups[key].push(f);
    }
    return groups;
  }, [filtered]);

  const stats = useMemo(() => ({
    total: findings.length,
    critical: findings.filter(f => f.severity === "critical").length,
    high: findings.filter(f => f.severity === "high").length,
    medium: findings.filter(f => f.severity === "medium").length,
  }), [findings]);

  const toggleGroup = (key: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const toggleItem = (id: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleScan = async () => {
    setIsScanning(true);
    await refetch();
    setTimeout(() => setIsScanning(false), 800);
  };

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
    fixMutation.mutate({ findingId: selectedFinding.id, quoteId: selectedFinding.quoteId, actionType });
  };

  const severityDot = (s: string) => {
    if (s === "critical") return "bg-red-500";
    if (s === "high") return "bg-amber-500";
    if (s === "medium") return "bg-blue-400";
    return "bg-slate-300";
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="relative">
            <ShieldAlert className="w-8 h-8 text-indigo-600" />
            {stats.total > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full animate-pulse" />
            )}
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Audit Agent</h1>
            <p className="text-sm text-muted-foreground">Real-time quote health monitoring</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/"><Button variant="outline" size="sm">Dashboard</Button></Link>
          <Button onClick={handleScan} size="sm" className="gap-2">
            <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? "animate-spin" : ""}`} />
            {isScanning ? "Scanning..." : "Run Scan"}
          </Button>
        </div>
      </div>

      {/* Compact KPI Row */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        <div className="flex items-center gap-3 rounded-lg border p-3 bg-background">
          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
            <ShieldAlert className="w-5 h-5 text-slate-600" />
          </div>
          <div>
            <div className="text-xl font-bold">{stats.total}</div>
            <div className="text-xs text-muted-foreground">Total</div>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-lg border border-red-200 p-3 bg-red-50/50">
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
            <AlertCircle className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <div className="text-xl font-bold text-red-600">{stats.critical}</div>
            <div className="text-xs text-red-600">Critical</div>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-lg border border-amber-200 p-3 bg-amber-50/50">
          <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
            <FileWarning className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <div className="text-xl font-bold text-amber-600">{stats.high}</div>
            <div className="text-xs text-amber-600">High</div>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-lg border border-blue-200 p-3 bg-blue-50/50">
          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
            <Clock className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <div className="text-xl font-bold text-blue-600">{stats.medium}</div>
            <div className="text-xs text-blue-600">Medium</div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search findings..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 h-9"
        />
      </div>

      {/* Dynamic Grouped Findings */}
      {isLoading ? (
        <div className="py-16 text-center text-muted-foreground flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
          <p>Running audit scans...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center flex flex-col items-center">
          <CheckCircle2 className="w-14 h-14 text-emerald-500 mb-3" />
          <h3 className="text-lg font-semibold">All Clear</h3>
          <p className="text-sm text-muted-foreground">No discrepancies detected across all quotes.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {Object.entries(grouped).map(([type, items]) => {
            const meta = TYPE_META[type] || { label: type, icon: ShieldAlert, color: "text-slate-600 bg-slate-50 border-slate-200" };
            const Icon = meta.icon;
            const isExpanded = expandedGroups.has(type);

            return (
              <div key={type} className={`rounded-lg border overflow-hidden ${meta.color}`}>
                {/* Group header — clickable to collapse */}
                <button
                  onClick={() => toggleGroup(type)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:opacity-80 transition-opacity"
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4" />
                    <span className="font-semibold text-sm">{meta.label}</span>
                    <Badge variant="secondary" className="text-xs rounded-full px-2 py-0">
                      {items.length}
                    </Badge>
                  </div>
                  {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>

                {/* Collapsible items */}
                {isExpanded && (
                  <div className="border-t bg-background divide-y">
                    {items.map((finding) => {
                      const itemExpanded = expandedItems.has(finding.id);
                      return (
                        <div key={finding.id} className="px-4 py-2.5 hover:bg-muted/30 transition-colors">
                          <div className="flex items-center gap-3 cursor-pointer" onClick={() => toggleItem(finding.id)}>
                            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${severityDot(finding.severity)}`} />
                            <span className="text-sm font-medium flex-1 truncate">{finding.title}</span>
                            <Link href={`/quotes/${finding.quoteId}`} className="text-xs text-blue-600 hover:underline flex-shrink-0" onClick={(e: any) => e.stopPropagation()}>
                              {finding.salesforceNumber || `#${finding.quoteId}`}
                            </Link>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 flex-shrink-0"
                              onClick={(e) => { e.stopPropagation(); openFixModal(finding); }}
                            >
                              <Sparkles className="w-3 h-3 mr-1" /> Fix
                            </Button>
                          </div>
                          {/* Expanded detail */}
                          {itemExpanded && (
                            <div className="mt-2 ml-5 pl-3 border-l-2 border-muted text-xs text-muted-foreground space-y-1 pb-1">
                              <p>{finding.description}</p>
                              <div className="flex gap-3 pt-1">
                                {finding.customerName && <span>Customer: <strong>{finding.customerName}</strong></span>}
                                {finding.supplierName && <span>Supplier: <strong>{finding.supplierName}</strong></span>}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* AI Remediation Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-600" />
              AI Fix Assistant
            </DialogTitle>
            <DialogDescription>Review the diagnosis before applying the fix.</DialogDescription>
          </DialogHeader>
          {selectedFinding && (
            <div className="space-y-3 my-2">
              <div className="p-3 rounded-lg bg-muted/50 border">
                <span className="font-medium text-sm">{selectedFinding.title}</span>
                <p className="text-xs text-muted-foreground mt-1">{selectedFinding.description}</p>
              </div>
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">AI Recommendation</h4>
                {isAiLoading ? (
                  <div className="p-6 border border-dashed rounded-lg flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" /> Analyzing...
                  </div>
                ) : (
                  <div className="p-3 rounded-lg bg-indigo-50 border border-indigo-100 text-sm whitespace-pre-line leading-relaxed">
                    {aiSuggestion}
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
              onClick={handleExecuteFix}
              disabled={fixMutation.isPending || isAiLoading}
            >
              {fixMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <Wrench className="w-3.5 h-3.5" /> Apply Fix
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
