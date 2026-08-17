import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ShieldAlert, CheckCircle2, Search, RefreshCw, Sparkles, Loader2, ChevronDown, ChevronRight, AlertCircle, FileWarning, Clock, Calculator } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";

const TYPE_META: Record<string, { label: string; icon: any; color: string; action: string }> = {
  calculation_drift: { label: "Calculation Drift", icon: Calculator, color: "text-red-600 bg-red-50 border-red-200", action: "Recompute totals" },
  missing_document: { label: "Missing Documents", icon: FileWarning, color: "text-amber-600 bg-amber-50 border-amber-200", action: "Flag for upload" },
  missing_fx_stamp: { label: "Missing FX Stamp", icon: AlertCircle, color: "text-orange-600 bg-orange-50 border-orange-200", action: "Request confirmation" },
  stale_workflow: { label: "Stale Workflows", icon: Clock, color: "text-blue-600 bg-blue-50 border-blue-200", action: "Advance workflow" },
};

export default function AuditDashboard() {
  const { data: findings = [], isLoading, refetch } = trpc.audit.getFindings.useQuery();
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(["calculation_drift", "missing_document", "missing_fx_stamp", "stale_workflow"]));
  const [isScanning, setIsScanning] = useState(false);
  const [fixingId, setFixingId] = useState<string | null>(null);

  const fixMutation = trpc.audit.fixFinding.useMutation({
    onSuccess: (res) => { toast.success(res.message); setFixingId(null); refetch(); },
    onError: (err) => { toast.error(err.message ?? "Fix failed"); setFixingId(null); },
  });

  const filtered = useMemo(() => {
    if (!searchQuery) return findings;
    const q = searchQuery.toLowerCase();
    return findings.filter(f =>
      f.title.toLowerCase().includes(q) ||
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

  const handleScan = async () => {
    setIsScanning(true);
    await refetch();
    setTimeout(() => setIsScanning(false), 800);
  };

  const handleFix = (finding: any) => {
    setFixingId(finding.id);
    let actionType: "fix_document" | "advance_workflow" | "confirm_fx" | "recompute_totals" = "fix_document";
    if (finding.type === "stale_workflow") actionType = "advance_workflow";
    if (finding.type === "missing_fx_stamp") actionType = "confirm_fx";
    if (finding.type === "calculation_drift") actionType = "recompute_totals";
    fixMutation.mutate({ findingId: finding.id, quoteId: finding.quoteId, actionType });
  };

  const severityDot = (s: string) =>
    s === "critical" ? "bg-red-500" : s === "high" ? "bg-amber-500" : s === "medium" ? "bg-blue-400" : "bg-slate-300";

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <ShieldAlert className="w-7 h-7 text-indigo-600" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Audit Agent</h1>
            <p className="text-xs text-muted-foreground">Real-time quote health checks</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/"><Button variant="outline" size="sm">Dashboard</Button></Link>
          <Button onClick={handleScan} size="sm" className="gap-1.5">
            <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? "animate-spin" : ""}`} />
            Scan
          </Button>
        </div>
      </div>

      {/* Compact KPI Row */}
      <div className="flex gap-4 mb-5 text-sm">
        <span className="font-semibold">{stats.total} findings</span>
        {stats.critical > 0 && <span className="text-red-600 font-medium">{stats.critical} critical</span>}
        {stats.high > 0 && <span className="text-amber-600 font-medium">{stats.high} high</span>}
        {stats.medium > 0 && <span className="text-blue-600 font-medium">{stats.medium} medium</span>}
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 h-9" />
      </div>

      {/* Findings */}
      {isLoading ? (
        <div className="py-12 text-center text-muted-foreground flex flex-col items-center gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
          <p className="text-sm">Scanning quotes...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center flex flex-col items-center">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mb-2" />
          <h3 className="font-semibold">All Clear</h3>
          <p className="text-sm text-muted-foreground">No issues found.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {Object.entries(grouped).map(([type, items]) => {
            const meta = TYPE_META[type] || { label: type, icon: ShieldAlert, color: "text-slate-600 bg-slate-50 border-slate-200", action: "Fix" };
            const Icon = meta.icon;
            const isExpanded = expandedGroups.has(type);

            return (
              <div key={type} className={`rounded-lg border overflow-hidden ${meta.color}`}>
                <button
                  onClick={() => toggleGroup(type)}
                  className="w-full flex items-center justify-between px-4 py-2.5 hover:opacity-80 transition-opacity"
                >
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4" />
                    <span className="font-medium text-sm">{meta.label}</span>
                    <Badge variant="secondary" className="text-xs rounded-full px-2 py-0">{items.length}</Badge>
                  </div>
                  {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>

                {isExpanded && (
                  <div className="border-t bg-background divide-y">
                    {items.map((finding) => (
                      <div key={finding.id} className="flex items-center gap-3 px-4 py-2 hover:bg-muted/30">
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${severityDot(finding.severity)}`} />
                        <span className="text-sm flex-1 truncate">{finding.title}</span>
                        <Link href={`/quotes/${finding.quoteId}`} className="text-xs text-blue-600 hover:underline flex-shrink-0">
                          {finding.salesforceNumber || `#${finding.quoteId}`}
                        </Link>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2.5 text-xs flex-shrink-0"
                          disabled={fixingId === finding.id}
                          onClick={() => handleFix(finding)}
                        >
                          {fixingId === finding.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <>{meta.action}</>
                          )}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
