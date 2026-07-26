import { useState } from "react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Loader2, Pencil, Plus, ShieldAlert } from "lucide-react";

const PRICING_MODELS = [
  { value: "net_price", label: "Net price (quote already at cost)" },
  { value: "list_minus_distribution", label: "List minus distribution discount" },
  { value: "as_is", label: "As-is (use quoted prices directly)" },
  { value: "list_minus_stated_discount", label: "List minus discount stated on quote" },
  { value: "footer_based", label: "Footer-based (pricing note in footer)" },
] as const;

type SupplierRow = {
  id: number;
  name: string;
  pricingModel: string;
  defaultDiscountPct: string | null;
  defaultMarginPct: string | null;
  notes: string | null;
};

function EditSupplierDialog({ supplier, onSaved }: { supplier: SupplierRow; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [pricingModel, setPricingModel] = useState(supplier.pricingModel);
  const [discount, setDiscount] = useState(supplier.defaultDiscountPct ? String(Number(supplier.defaultDiscountPct)) : "");
  const [margin, setMargin] = useState(supplier.defaultMarginPct ? String(Number(supplier.defaultMarginPct)) : "");
  const [notes, setNotes] = useState(supplier.notes ?? "");
  const update = trpc.suppliersAdmin.update.useMutation();

  const handleSave = async () => {
    const discountNum = discount.trim() === "" ? null : Number(discount);
    const marginNum = margin.trim() === "" ? null : Number(margin);
    if (discountNum !== null && (!Number.isFinite(discountNum) || discountNum < 0 || discountNum >= 100)) {
      toast.error("Distribution discount must be between 0 and 99.9");
      return;
    }
    if (marginNum !== null && (!Number.isFinite(marginNum) || marginNum < 0 || marginNum >= 100)) {
      toast.error("Default margin must be between 0 and 99.9");
      return;
    }
    try {
      await update.mutateAsync({
        id: supplier.id,
        pricingModel: pricingModel as any,
        defaultDiscountPct: discountNum,
        defaultMarginPct: marginNum,
        notes: notes.trim() || null,
      });
      toast.success(`${supplier.name} updated`);
      setOpen(false);
      onSaved();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to update supplier");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil className="h-3.5 w-3.5" /> Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit {supplier.name}</DialogTitle>
          <DialogDescription>
            Changes apply to all future quote uploads for this supplier. Existing quotes are not affected.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>Pricing model</Label>
            <Select value={pricingModel} onValueChange={setPricingModel}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PRICING_MODELS.map(m => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Distribution discount %</Label>
              <Input
                type="number" min="0" max="99.9" step="0.1" placeholder="e.g. 30"
                value={discount} onChange={e => setDiscount(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Applied off list price when the quote doesn't state a discount.</p>
            </div>
            <div className="grid gap-2">
              <Label>Default margin %</Label>
              <Input
                type="number" min="0" max="99.9" step="0.1" placeholder="e.g. 20"
                value={margin} onChange={e => setMargin(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Pre-fills the margin field in the costing step.</p>
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Notes</Label>
            <Textarea
              rows={3} placeholder="Internal notes about this supplier's pricing arrangement"
              value={notes} onChange={e => setNotes(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => void handleSave()} disabled={update.isPending}>
            {update.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddSupplierDialog({ onSaved }: { onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [pricingModel, setPricingModel] = useState("as_is");
  const [discount, setDiscount] = useState("");
  const [margin, setMargin] = useState("");
  const [notes, setNotes] = useState("");
  const create = trpc.suppliersAdmin.create.useMutation();

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error("Supplier name is required");
      return;
    }
    try {
      await create.mutateAsync({
        name: name.trim(),
        pricingModel: pricingModel as any,
        defaultDiscountPct: discount.trim() === "" ? null : Number(discount),
        defaultMarginPct: margin.trim() === "" ? null : Number(margin),
        notes: notes.trim() || undefined,
      });
      toast.success(`${name.trim()} added`);
      setOpen(false);
      setName(""); setDiscount(""); setMargin(""); setNotes("");
      onSaved();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to add supplier");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" /> Add supplier
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add supplier</DialogTitle>
          <DialogDescription>
            New supplier quotes will be matched by name during AI extraction.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>Supplier name *</Label>
            <Input placeholder="e.g. Marel" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>Pricing model</Label>
            <Select value={pricingModel} onValueChange={setPricingModel}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PRICING_MODELS.map(m => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Distribution discount %</Label>
              <Input type="number" min="0" max="99.9" step="0.1" value={discount} onChange={e => setDiscount(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Default margin %</Label>
              <Input type="number" min="0" max="99.9" step="0.1" value={margin} onChange={e => setMargin(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Notes</Label>
            <Textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => void handleCreate()} disabled={create.isPending}>
            {create.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Add supplier
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function SupplierSettings() {
  const { user, isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();
  const { data: suppliers, isLoading, refetch } = trpc.suppliersAdmin.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });

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
          <p className="text-muted-foreground">Please sign in to manage supplier settings.</p>
          <Button onClick={() => startLogin()}>Sign in</Button>
        </div>
      </div>
    );
  }

  const isAdmin = user?.role === "admin";

  return (
    <div className="flex min-h-screen flex-col bg-muted/40">
      <BrandHeader />
      <main className="container max-w-5xl flex-1 py-8">
        <Button variant="ghost" size="sm" className="mb-4" onClick={() => navigate("/")}>
          <ArrowLeft className="h-4 w-4" /> Dashboard
        </Button>

        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Supplier settings</h1>
            <p className="text-sm text-muted-foreground">
              Pricing rules applied automatically when supplier quotes are uploaded.
            </p>
          </div>
          {isAdmin && <AddSupplierDialog onSaved={() => void refetch()} />}
        </div>

        {!isAdmin && (
          <Card className="mb-6 border-amber-300 bg-amber-50">
            <CardContent className="flex items-center gap-3 py-4 text-sm text-amber-900">
              <ShieldAlert className="h-5 w-5 shrink-0" />
              You have read-only access. Ask an administrator to change pricing settings.
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Suppliers</CardTitle>
            <CardDescription>
              The distribution discount is used when a quote doesn't state one; the default margin pre-fills the costing step.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Pricing model</TableHead>
                  <TableHead>Distribution discount</TableHead>
                  <TableHead>Default margin</TableHead>
                  <TableHead className="w-[35%]">Notes</TableHead>
                  {isAdmin && <TableHead className="w-20" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {(suppliers ?? []).map(s => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell className="capitalize">
                      {PRICING_MODELS.find(m => m.value === s.pricingModel)?.label ?? s.pricingModel.replaceAll("_", " ")}
                    </TableCell>
                    <TableCell>{s.defaultDiscountPct ? `${Number(s.defaultDiscountPct)}%` : "—"}</TableCell>
                    <TableCell>{s.defaultMarginPct ? `${Number(s.defaultMarginPct)}%` : "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{s.notes ?? "—"}</TableCell>
                    {isAdmin && (
                      <TableCell>
                        <EditSupplierDialog supplier={s as SupplierRow} onSaved={() => void refetch()} />
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
