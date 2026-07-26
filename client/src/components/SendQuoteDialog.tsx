import { useEffect, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { CircleCheck, CircleX, Loader2, Mail, Send, TriangleAlert } from "lucide-react";

interface QuoteForEmail {
  id: number;
  customerName: string | null;
  customerContact: string | null;
  salesforceQuoteNumber: string | null;
  productCategory: string | null;
  grandTotalAud: string | null;
  lastSentAt: Date | null;
  lastSentTo: string | null;
  revisionLabel: string | null;
}

function defaultMessage(q: QuoteForEmail): string {
  const contact = q.customerContact?.split(/[,;]/)[0]?.trim();
  const greeting = contact ? `Dear ${contact},` : "Dear Sir/Madam,";
  const revText = q.revisionLabel && q.revisionLabel !== "A" ? ` (Revision ${q.revisionLabel})` : "";
  return `${greeting}

Please find attached our quotation ${q.salesforceQuoteNumber ?? ""}${revText} for the ${q.productCategory ?? "equipment"} as discussed.

The quotation is valid for 30 days from the date of issue. Prices are quoted in Australian Dollars and exclude GST unless otherwise stated.

Please don't hesitate to contact us if you have any questions or would like to discuss any aspect of the proposal.

Kind regards,
Oestergaard Pty Ltd`;
}

export function SendQuoteDialog({ quote }: { quote: QuoteForEmail }) {
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  const { data: config } = trpc.email.isConfigured.useQuery(undefined, { enabled: open });
  const { data: history, refetch: refetchHistory } = trpc.email.history.useQuery(
    { quoteId: quote.id },
    { enabled: open },
  );
  const sendMutation = trpc.email.sendQuote.useMutation();
  const utils = trpc.useUtils();

  // Pre-fill subject/message when the dialog opens
  useEffect(() => {
    if (open) {
      setSubject(
        `Oestergaard Quotation ${quote.salesforceQuoteNumber ?? `#${quote.id}`}${
          quote.revisionLabel && quote.revisionLabel !== "A" ? ` Rev ${quote.revisionLabel}` : ""
        } — ${quote.productCategory ?? "Equipment"}`,
      );
      setMessage(defaultMessage(quote));
      if (quote.lastSentTo) setTo(quote.lastSentTo);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleSend = async () => {
    if (!to.trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to.trim())) {
      toast.error("Enter a valid customer email address");
      return;
    }
    try {
      await sendMutation.mutateAsync({
        quoteId: quote.id,
        to: to.trim(),
        cc: cc.trim() || "",
        subject: subject.trim(),
        message: message.trim(),
      });
      toast.success(`Quotation emailed to ${to.trim()}`);
      utils.quotes.get.invalidate({ quoteId: quote.id });
      void refetchHistory();
      setOpen(false);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to send email");
      void refetchHistory();
    }
  };

  const notConfigured = config && !config.configured;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="default" className="bg-emerald-700 text-white hover:bg-emerald-800">
          <Mail className="h-4 w-4" /> Send to customer
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Send quotation to customer</DialogTitle>
          <DialogDescription>
            Emails the finalized PDF (Quotation {quote.salesforceQuoteNumber ?? `#${quote.id}`}) as an attachment.
          </DialogDescription>
        </DialogHeader>

        {notConfigured && (
          <Alert className="border-amber-300 bg-amber-50 text-amber-900">
            <TriangleAlert className="h-4 w-4" />
            <AlertTitle>Email not configured</AlertTitle>
            <AlertDescription>
              SMTP credentials (SMTP_HOST, SMTP_USER, SMTP_PASS) haven't been set in project secrets yet.
              You can prepare the email, but sending will fail until they're configured.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-4 py-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>To (customer email) *</Label>
              <Input type="email" placeholder="customer@company.com.au" value={to} onChange={e => setTo(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Cc (optional)</Label>
              <Input type="email" placeholder="sales@oestergaard.com.au" value={cc} onChange={e => setCc(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Subject</Label>
            <Input value={subject} onChange={e => setSubject(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>Message</Label>
            <Textarea rows={10} value={message} onChange={e => setMessage(e.target.value)} className="font-mono text-sm" />
            <p className="text-xs text-muted-foreground">Fully editable — the default text is a starting point.</p>
          </div>

          {history && history.length > 0 && (
            <div className="rounded-md border bg-muted/30 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Send history</p>
              <ul className="space-y-1.5">
                {history.map(h => (
                  <li key={h.id} className="flex items-center gap-2 text-sm">
                    {h.status === "sent" ? (
                      <CircleCheck className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                    ) : (
                      <CircleX className="h-3.5 w-3.5 shrink-0 text-destructive" />
                    )}
                    <span className="font-medium">{h.toEmail}</span>
                    <span className="text-muted-foreground">
                      · {h.sentAt ? new Date(h.sentAt).toLocaleString("en-AU") : ""}
                      {h.status === "failed" && " · failed"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => void handleSend()} disabled={sendMutation.isPending}>
            {sendMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Send email
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
