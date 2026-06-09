import { Bell, X } from "lucide-react";
import { useAppData, currentMonthKey } from "@/lib/rd-store";

export function ReminderBanner() {
  const { data, hydrated, update } = useAppData();
  if (!hydrated) return null;

  const today = new Date();
  const day = today.getDate();
  const month = currentMonthKey(today);

  if (day < 1 || day > 5) return null;
  if (data.settings.reminderDismissedFor === month) return null;

  const pending = data.customers.filter((c) => {
    const cur = c.payments.find((p) => p.month === month);
    return !cur || cur.mode === "pending";
  }).length;

  return (
    <div className="border-b bg-amber-50 dark:bg-amber-950/30">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2.5 text-sm">
        <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200">
          <Bell className="h-4 w-4 shrink-0" />
          <span>
            Monthly collection reminder — <strong>{pending}</strong> customer{pending === 1 ? "" : "s"} still pending for this month.
          </span>
        </div>
        <button
          onClick={() =>
            update((d) => ({ ...d, settings: { ...d.settings, reminderDismissedFor: month } }))
          }
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-amber-900 hover:bg-amber-100 dark:text-amber-200 dark:hover:bg-amber-900/40"
        >
          <X className="h-3 w-3" /> Turn off for this month
        </button>
      </div>
    </div>
  );
}
