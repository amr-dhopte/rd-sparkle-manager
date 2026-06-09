import { useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  useAppData,
  calcCustomerFinancials,
  formatINR,
  formatMonth,
  maturityDate,
  ensurePaymentsBackfilled,
  type Customer,
} from "@/lib/rd-store";
import { MessageCircle, CheckCheck, Calendar } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  customerId: string | null;
}

export function CustomerProfileDialog({ open, onOpenChange, customerId }: Props) {
  const { data, update } = useAppData();
  const customer = data.customers.find((c) => c.id === customerId) || null;

  const fin = useMemo(() => (customer ? calcCustomerFinancials(customer) : null), [customer]);

  if (!customer || !fin) return null;

  const mDate = maturityDate(customer.startDate, customer.tenureMonths);

  const sendWhatsApp = () => {
    const template = data.settings.messageTemplate;
    const currentMonthLabel = new Date().toLocaleString("en-IN", { month: "long", year: "numeric" });
    const message = template
      .replaceAll("{name}", customer.name)
      .replaceAll("{amount}", String(customer.rdAmount))
      .replaceAll("{month}", currentMonthLabel)
      .replaceAll("{account}", customer.accountNumber)
      .replaceAll("{agent}", data.settings.agentName);
    const phone = customer.mobile.replace(/\D/g, "");
    const normalized = phone.length === 10 ? `91${phone}` : phone;
    window.open(`https://wa.me/${normalized}?text=${encodeURIComponent(message)}`, "_blank");
  };

  const markAllPastPaid = () => {
    update((d) => ({
      ...d,
      customers: d.customers.map((c) => {
        if (c.id !== customer.id) return c;
        const backfilled = ensurePaymentsBackfilled(c);
        return {
          ...backfilled,
          payments: backfilled.payments.map((p) => ({
            ...p,
            mode: p.mode === "pending" ? ("paid" as const) : p.mode,
          })),
        };
      }),
    }));
    toast.success("All past months marked as paid");
  };

  const modeBadge = (mode: string) => {
    const cls =
      mode === "online"
        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
        : mode === "cash"
          ? "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200"
          : mode === "paid"
            ? "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200"
            : "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200";
    return <span className={`rounded px-2 py-0.5 text-xs font-medium ${cls}`}>{mode}</span>;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-2">
            <span>{customer.name}</span>
            <Button size="sm" onClick={sendWhatsApp} className="bg-emerald-600 hover:bg-emerald-700">
              <MessageCircle className="mr-1.5 h-4 w-4" /> WhatsApp
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 rounded-lg border bg-muted/30 p-4 text-sm md:grid-cols-4">
          <Detail label="Mobile" value={customer.mobile} />
          <Detail label="Account No." value={customer.accountNumber} />
          <Detail label="Age" value={customer.age?.toString() || "—"} />
          <Detail label="Monthly RD" value={formatINR(customer.rdAmount)} />
          <Detail label="Start Date" value={new Date(customer.startDate).toLocaleDateString("en-IN")} />
          <Detail label="Maturity Date" value={mDate.toLocaleDateString("en-IN")} />
          <Detail label="Interest Rate" value={`${customer.interestRate}% p.a.`} />
          <Detail label="Tenure" value={`${customer.tenureMonths} months`} />
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Metric label="Invested Till Date" value={formatINR(fin.invested)} tone="default" />
          <Metric label="Interest Earned (est.)" value={formatINR(fin.interestSoFar)} tone="success" />
          <Metric label="Maturity Amount" value={formatINR(fin.maturity)} tone="primary" />
        </div>

        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold">Payment History</h4>
          <Button size="sm" variant="outline" onClick={markAllPastPaid}>
            <CheckCheck className="mr-1.5 h-4 w-4" /> Mark all past as Paid
          </Button>
        </div>

        <ScrollArea className="h-64 rounded-md border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted/60 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Month</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Date / Time</th>
              </tr>
            </thead>
            <tbody>
              {[...customer.payments].reverse().map((p) => (
                <tr key={p.month} className="border-t">
                  <td className="px-3 py-2 font-medium">{formatMonth(p.month)}</td>
                  <td className="px-3 py-2">{modeBadge(p.mode)}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {p.timestamp ? (
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(p.timestamp).toLocaleString("en-IN")}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "default" | "success" | "primary";
}) {
  const cls =
    tone === "primary"
      ? "bg-primary text-primary-foreground"
      : tone === "success"
        ? "bg-emerald-600 text-white"
        : "bg-card border";
  return (
    <div className={`rounded-lg p-4 ${cls}`}>
      <div className="text-xs opacity-80">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
    </div>
  );
}
