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
import { ArrowLeft, CloudUpload, Image, Loader2, Pencil, Plus, ShieldAlert, Trash2, X } from "lucide-react";

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

        {/* Bulk Product Image Upload */}
        {isAdmin && suppliers && <BulkImageUpload suppliers={(suppliers as any[]).map(s => ({ id: s.id, name: s.name }))} />}

        {/* Existing Product Images Gallery */}
        {isAdmin && suppliers && <ProductImageGallery suppliers={(suppliers as any[]).map(s => ({ id: s.id, name: s.name }))} />}
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bulk Image Upload Component
// ---------------------------------------------------------------------------
interface PendingImage {
  file: File;
  preview: string;
  productModel: string;
  productName: string;
  tags: string;
}

function BulkImageUpload({ suppliers }: { suppliers: Array<{ id: number; name: string }> }) {
  const [selectedSupplier, setSelectedSupplier] = useState<{ id: number; name: string } | null>(null);
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const uploadMutation = trpc.productImages.upload.useMutation();

  const handleFilesDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith("image/"));
    addFiles(files);
  };

  const handleFilesSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter(f => f.type.startsWith("image/"));
    addFiles(files);
  };

  const addFiles = (files: File[]) => {
    const newImages: PendingImage[] = files.map(file => ({
      file,
      preview: URL.createObjectURL(file),
      productModel: file.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " "),
      productName: "",
      tags: "",
    }));
    setPendingImages(prev => [...prev, ...newImages]);
  };

  const removeImage = (index: number) => {
    setPendingImages(prev => {
      const copy = [...prev];
      URL.revokeObjectURL(copy[index].preview);
      copy.splice(index, 1);
      return copy;
    });
  };

  const updateImage = (index: number, field: keyof PendingImage, value: string) => {
    setPendingImages(prev => {
      const copy = [...prev];
      (copy[index] as any)[field] = value;
      return copy;
    });
  };

  const handleBulkUpload = async () => {
    if (!selectedSupplier || pendingImages.length === 0) return;
    setUploading(true);
    setUploadProgress(0);

    let completed = 0;
    for (const img of pendingImages) {
      try {
        const base64 = await fileToBase64(img.file);
        await uploadMutation.mutateAsync({
          supplierId: selectedSupplier.id,
          supplierName: selectedSupplier.name,
          productModel: img.productModel || img.file.name,
          productName: img.productName || undefined,
          tags: img.tags || undefined,
          fileBase64: base64,
          fileName: img.file.name,
        });
      } catch (err) {
        toast.error(`Failed to upload ${img.file.name}`);
      }
      completed++;
      setUploadProgress(Math.round((completed / pendingImages.length) * 100));
    }

    toast.success(`${completed} image${completed !== 1 ? "s" : ""} uploaded successfully`);
    setPendingImages([]);
    setUploading(false);
    setUploadProgress(0);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Image className="h-5 w-5 text-blue-600" />
          Product Image Library
        </CardTitle>
        <CardDescription>
          Upload product catalogue images for quotation PDFs. Drag and drop multiple files,
          assign a supplier, and add model names for accurate matching.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Supplier selector */}
        <div className="grid gap-2 sm:max-w-xs">
          <Label className="font-semibold">Select supplier</Label>
          <Select
            value={selectedSupplier?.id?.toString() ?? ""}
            onValueChange={v => {
              const s = suppliers.find(s => s.id === Number(v));
              setSelectedSupplier(s ? { id: s.id, name: s.name } : null);
            }}
          >
            <SelectTrigger><SelectValue placeholder="Choose a supplier..." /></SelectTrigger>
            <SelectContent>
              {suppliers.map(s => (
                <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Drop zone */}
        <div
          onDragOver={e => e.preventDefault()}
          onDrop={handleFilesDrop}
          className="flex min-h-[120px] cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/30 p-6 transition hover:border-primary/50 hover:bg-muted/50"
          onClick={() => document.getElementById("bulk-image-input")?.click()}
        >
          <CloudUpload className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Drag & drop product images here, or <span className="font-semibold text-primary">click to browse</span>
          </p>
          <p className="text-xs text-muted-foreground">PNG, JPG, WebP — multiple files supported</p>
          <input
            id="bulk-image-input"
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleFilesSelect}
          />
        </div>

        {/* Pending images list */}
        {pendingImages.length > 0 && (
          <div className="space-y-3">
            <p className="text-sm font-semibold">{pendingImages.length} image{pendingImages.length !== 1 ? "s" : ""} ready to upload</p>
            <div className="max-h-[400px] space-y-2 overflow-y-auto">
              {pendingImages.map((img, i) => (
                <div key={i} className="flex items-start gap-3 rounded-lg border p-3">
                  <img src={img.preview} alt="" className="h-16 w-16 shrink-0 rounded object-contain border bg-white" />
                  <div className="flex-1 space-y-1.5">
                    <Input
                      placeholder="Product model (e.g. HVM650)"
                      value={img.productModel}
                      onChange={e => updateImage(i, "productModel", e.target.value)}
                      className="h-8 text-sm"
                    />
                    <Input
                      placeholder="Product name (optional)"
                      value={img.productName}
                      onChange={e => updateImage(i, "productName", e.target.value)}
                      className="h-8 text-sm"
                    />
                    <Input
                      placeholder="Tags (comma-separated, e.g. mixer, brine, tumbler)"
                      value={img.tags}
                      onChange={e => updateImage(i, "tags", e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => removeImage(i)} className="shrink-0">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            {/* Upload progress */}
            {uploading && (
              <div className="space-y-1">
                <div className="h-2 w-full rounded-full bg-muted">
                  <div className="h-2 rounded-full bg-primary transition-all" style={{ width: `${uploadProgress}%` }} />
                </div>
                <p className="text-xs text-muted-foreground">{uploadProgress}% complete</p>
              </div>
            )}

            <Button
              onClick={handleBulkUpload}
              disabled={!selectedSupplier || uploading}
              className="w-full"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CloudUpload className="h-4 w-4" />}
              {uploading ? `Uploading...` : `Upload ${pendingImages.length} image${pendingImages.length !== 1 ? "s" : ""} to ${selectedSupplier?.name || "..."}`}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1]); // strip data:image/...;base64, prefix
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ---------------------------------------------------------------------------
// Product Image Gallery Component
// ---------------------------------------------------------------------------
function ProductImageGallery({ suppliers }: { suppliers: Array<{ id: number; name: string }> }) {
  const [filterSupplier, setFilterSupplier] = useState<string>("");
  const { data: images, refetch } = trpc.productImages.list.useQuery(
    filterSupplier && filterSupplier !== "all" ? { supplierId: Number(filterSupplier) } : undefined
  );
  const deleteMutation = trpc.productImages.delete.useMutation({
    onSuccess: () => {
      toast.success("Image deleted");
      void refetch();
    },
    onError: () => toast.error("Failed to delete image"),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Image className="h-5 w-5 text-emerald-600" />
          Existing Product Images
        </CardTitle>
        <CardDescription>
          {images?.length ?? 0} image{(images?.length ?? 0) !== 1 ? "s" : ""} in the library.
          These are matched to quotation PDFs during the Image Preview step.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filter by supplier */}
        <div className="grid gap-2 sm:max-w-xs">
          <Label className="text-sm font-medium">Filter by supplier</Label>
          <Select value={filterSupplier} onValueChange={setFilterSupplier}>
            <SelectTrigger><SelectValue placeholder="All suppliers" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All suppliers</SelectItem>
              {suppliers.map(s => (
                <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Image grid */}
        {(!images || images.length === 0) ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
            <Image className="mx-auto h-10 w-10 opacity-40" />
            <p className="mt-2 text-sm">No product images uploaded yet.</p>
            <p className="text-xs">Use the uploader above to add images.</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {images.map((img: any) => (
              <div key={img.id} className="group relative rounded-lg border p-3">
                <img
                  src={img.imageUrl}
                  alt={img.productName || img.productModel}
                  className="h-28 w-full rounded object-contain bg-white"
                />
                <div className="mt-2 space-y-0.5">
                  <p className="text-sm font-semibold truncate">{img.productModel}</p>
                  {img.productName && <p className="text-xs text-muted-foreground truncate">{img.productName}</p>}
                  <p className="text-xs text-muted-foreground">{img.supplierName} · {img.sourceType}</p>
                  {img.tags && <p className="text-xs text-blue-600 truncate">{img.tags}</p>}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                  onClick={() => {
                    if (confirm("Delete this product image?")) {
                      deleteMutation.mutate({ id: img.id });
                    }
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
