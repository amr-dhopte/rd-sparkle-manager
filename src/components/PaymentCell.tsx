import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useAppData, currentMonthKey, type PaymentMode } from "@/lib/rd-store";
import { Banknote, Globe, X } from "lucide-react";

export function PaymentCell({ customerId }: { customerId: string }) {
  const { data, update } = useAppData();
  const customer = data.customers.find((c) => c.id === customerId);
  if (!customer) return null;
  const month = currentMonthKey();
  const current = customer.payments.find((p) => p.month === month);
  const mode: PaymentMode = current?.mode ?? "pending";

  const setMode = (m: PaymentMode) => {
    update((d) => ({
      ...d,
      customers: d.customers.map((c) => {
        if (c.id !== customerId) return c;
        const payments = c.payments.some((p) => p.month === month)
          ? c.payments.map((p) =>
              p.month === month
                ? { ...p, mode: m, timestamp: m === "pending" ? null : new Date().toISOString() }
                : p,
            )
          : [
              ...c.payments,
              { month, mode: m, timestamp: m === "pending" ? null : new Date().toISOString() },
            ];
        return { ...c, payments };
      }),
    }));
  };

  const styles: Record<PaymentMode, string> = {
    online: "bg-emerald-500 text-white hover:bg-emerald-600",
    cash: "bg-sky-500 text-white hover:bg-sky-600",
    paid: "bg-violet-500 text-white hover:bg-violet-600",
    pending: "bg-red-500 text-white hover:bg-red-600",
  };

  const label: Record<PaymentMode, string> = {
    online: "Online",
    cash: "Cash",
    paid: "Paid",
    pending: "Pending",
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={`inline-flex w-24 items-center justify-center rounded-md px-2 py-1.5 text-xs font-semibold shadow-sm transition ${styles[mode]}`}
        >
          {label[mode]}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setMode("online")}>
          <Globe className="mr-2 h-4 w-4 text-emerald-600" /> Mark Online
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setMode("cash")}>
          <Banknote className="mr-2 h-4 w-4 text-sky-600" /> Mark Cash
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => setMode("pending")} className="text-red-600">
          <X className="mr-2 h-4 w-4" /> Mark Pending
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
