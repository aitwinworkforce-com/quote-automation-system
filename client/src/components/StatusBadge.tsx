import { Badge } from "@/components/ui/badge";
import { STATUS_LABELS, type QuoteStatus } from "@shared/types";
import { cn } from "@/lib/utils";

const STYLES: Record<QuoteStatus, string> = {
  draft: "bg-slate-100 text-slate-700 border-slate-200",
  extracted: "bg-sky-50 text-sky-700 border-sky-200",
  costed: "bg-amber-50 text-amber-700 border-amber-200",
  awaiting_sf_number: "bg-violet-50 text-violet-700 border-violet-200",
  in_review: "bg-orange-50 text-orange-700 border-orange-200",
  finalized: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

export function StatusBadge({ status }: { status: string }) {
  const s = (status in STYLES ? status : "draft") as QuoteStatus;
  return (
    <Badge variant="outline" className={cn("font-medium", STYLES[s])}>
      {STATUS_LABELS[s] ?? status}
    </Badge>
  );
}
