import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  useAppData,
  currentMonthKey,
  formatINR,
  uid,
  formatMonth,
  monthKeyFromDate,
  type Customer,
} from "@/lib/rd-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Plus,
  Search,
  Users,
  CheckCheck,
  Pencil,
  Trash2,
  TrendingUp,
  TrendingDown,
  Wallet,
  AlertCircle,
  Activity,
  IndianRupee,
  UserPlus,
  Eye,
  MessageSquare,
  Sparkles,
} from "lucide-react";
import { PaymentCell } from "@/components/PaymentCell";
import { CustomerFormDialog } from "@/components/CustomerFormDialog";
import { CustomerProfileDialog } from "@/components/CustomerProfileDialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "RD Agent Pro — Dashboard" },
      { name: "description", content: "Premium dashboard for Post Office RD agents — track customers, payments and growth." },
    ],
  }),
  component: LedgerPage,
});

type CustomerStatus = "active" | "pending" | "matured";

function getCustomerStatus(c: Customer, month: string): CustomerStatus {
  const start = new Date(c.startDate);
  const matures = new Date(start);
  matures.setMonth(matures.getMonth() + c.tenureMonths);
  if (matures <= new Date()) return "matured";
  const p = c.payments.find((x) => x.month === month);
  if (p && p.mode !== "pending") return "active";
  return "pending";
}

function StatusBadge({ status }: { status: CustomerStatus }) {
  const map: Record<CustomerStatus, { label: string; cls: string; dot: string }> = {
    active:  { label: "Active",  cls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",  dot: "bg-emerald-500" },
    pending: { label: "Pending", cls: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",         dot: "bg-amber-500" },
    matured: { label: "Matured", cls: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20",     dot: "bg-violet-500" },
  };
  const s = map[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium ${s.cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

function LedgerPage() {
  const { data, hydrated, update } = useAppData();
  const [query, setQuery] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [groupOpen, setGroupOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");

  const month = currentMonthKey();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return data.customers;
    return data.customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.accountNumber.toLowerCase().includes(q) ||
        c.mobile.includes(q),
    );
  }, [data.customers, query]);

  const grouped = useMemo(() => {
    const byGroup = new Map<string | null, Customer[]>();
    for (const c of filtered) {
      const key = c.groupId || null;
      const arr = byGroup.get(key) || [];
      arr.push(c);
      byGroup.set(key, arr);
    }
    return byGroup;
  }, [filtered]);

  const stats = useMemo(() => {
    const total = data.customers.length;
    let paid = 0;
    let pendingAmount = 0;
    let collected = 0;
    for (const c of data.customers) {
      const p = c.payments.find((x) => x.month === month);
      if (p && p.mode !== "pending") {
        paid++;
        collected += c.rdAmount;
      } else {
        pendingAmount += c.rdAmount;
      }
    }
    return { total, paid, pendingAmount, collected, pending: total - paid };
  }, [data.customers, month]);

  // Build last-6-months trend data
  const trend = useMemo(() => {
    const out: { month: string; label: string; collected: number; customers: number }[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = monthKeyFromDate(d);
      let collected = 0;
      let activeCust = 0;
      for (const c of data.customers) {
        if (new Date(c.startDate) > d) continue;
        activeCust++;
        const p = c.payments.find((x) => x.month === key);
        if (p && p.mode !== "pending") collected += c.rdAmount;
      }
      out.push({
        month: key,
        label: formatMonth(key).split(" ")[0],
        collected,
        customers: activeCust,
      });
    }
    return out;
  }, [data.customers]);

  const prevCollected = trend.length >= 2 ? trend[trend.length - 2].collected : 0;
  const collectedTrendPct =
    prevCollected > 0
      ? Math.round(((stats.collected - prevCollected) / prevCollected) * 100)
      : stats.collected > 0
        ? 100
        : 0;

  const markGroupPaid = (groupId: string, mode: "online" | "cash" = "cash") => {
    update((d) => ({
      ...d,
      customers: d.customers.map((c) => {
        if (c.groupId !== groupId) return c;
        const has = c.payments.some((p) => p.month === month);
        const stamp = new Date().toISOString();
        const payments = has
          ? c.payments.map((p) => (p.month === month ? { ...p, mode, timestamp: stamp } : p))
          : [...c.payments, { month, mode, timestamp: stamp }];
        return { ...c, payments };
      }),
    }));
    toast.success("Group marked as paid");
  };

  const deleteCustomer = (id: string) => {
    if (!confirm("Delete this customer and all their records?")) return;
    update((d) => ({ ...d, customers: d.customers.filter((c) => c.id !== id) }));
    toast.success("Customer deleted");
  };

  const createGroup = () => {
    if (!newGroupName.trim()) return;
    update((d) => ({
      ...d,
      groups: [...d.groups, { id: uid(), name: newGroupName.trim(), customerIds: [] }],
    }));
    setNewGroupName("");
    toast.success("Group created");
  };

  const deleteGroup = (gid: string) => {
    update((d) => ({
      ...d,
      groups: d.groups.filter((g) => g.id !== gid),
      customers: d.customers.map((c) => (c.groupId === gid ? { ...c, groupId: null } : c)),
    }));
  };

  if (!hydrated) return null;

  const groupName = (id: string | null) => {
    if (!id) return "Ungrouped";
    return data.groups.find((g) => g.id === id)?.name || "Ungrouped";
  };

  const isEmpty = data.customers.length === 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 rounded-full border bg-card/60 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            {formatMonth(month)} overview
          </div>
          <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
            Welcome back, {data.settings.agentName}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Here's how your RD portfolio is performing this month.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" onClick={() => setGroupOpen(true)}>
            <Users className="mr-1.5 h-4 w-4" /> Groups
          </Button>
          <Button onClick={() => { setEditing(null); setAddOpen(true); }}>
            <Plus className="mr-1.5 h-4 w-4" /> Add Customer
          </Button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Total Customers"
          value={String(stats.total)}
          icon={<Users className="h-5 w-5" />}
          gradient="from-blue-500 to-indigo-600"
          trend={stats.total > 0 ? { dir: "up", text: "Real-time updates" } : { dir: "flat", text: "No customers yet" }}
        />
        <KpiCard
          label="Paid This Month"
          value={`${stats.paid} / ${stats.total || 0}`}
          icon={<CheckCheck className="h-5 w-5" />}
          gradient="from-emerald-500 to-teal-600"
          trend={{
            dir: stats.paid >= stats.pending ? "up" : "down",
            text: stats.total ? `${Math.round((stats.paid / stats.total) * 100)}% collection rate` : "Awaiting customers",
          }}
        />
        <KpiCard
          label="Pending"
          value={String(stats.pending)}
          icon={<AlertCircle className="h-5 w-5" />}
          gradient="from-amber-500 to-orange-600"
          trend={{
            dir: stats.pending > 0 ? "down" : "up",
            text: stats.pending > 0 ? `${formatINR(stats.pendingAmount)} outstanding` : "All caught up",
          }}
        />
        <KpiCard
          label="Collected"
          value={formatINR(stats.collected)}
          icon={<IndianRupee className="h-5 w-5" />}
          gradient="from-violet-500 to-fuchsia-600"
          trend={{
            dir: collectedTrendPct >= 0 ? "up" : "down",
            text: `${collectedTrendPct >= 0 ? "+" : ""}${collectedTrendPct}% vs last month`,
          }}
        />
      </div>

      {/* Chart + side panel */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border bg-card p-5 shadow-sm lg:col-span-2">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-primary to-primary/60 text-primary-foreground">
                  <Activity className="h-4 w-4" />
                </div>
                <h2 className="text-base font-semibold">Collection Trends</h2>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Last 6 months of collected RD amounts</p>
            </div>
            <Badge variant="secondary" className="gap-1">
              <TrendingUp className="h-3 w-3" /> Live
            </Badge>
          </div>
          <div className="mt-4 h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="collectedFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis
                  stroke="var(--muted-foreground)"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 10,
                    color: "var(--popover-foreground)",
                    fontSize: 12,
                  }}
                  formatter={(v: number) => [formatINR(v), "Collected"]}
                />
                <Area type="monotone" dataKey="collected" stroke="var(--chart-1)" strokeWidth={2.5} fill="url(#collectedFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
              <TrendingUp className="h-4 w-4" />
            </div>
            <h2 className="text-base font-semibold">Customer Growth</h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Active accounts over time</p>
          <div className="mt-4 h-44 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="custFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="label" hide />
                <YAxis hide />
                <Tooltip
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 10,
                    fontSize: 12,
                  }}
                  formatter={(v: number) => [v, "Customers"]}
                />
                <Area type="monotone" dataKey="customers" stroke="var(--chart-2)" strokeWidth={2.5} fill="url(#custFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-lg border bg-muted/30 p-3">
              <div className="text-muted-foreground">This month</div>
              <div className="mt-0.5 text-lg font-semibold">{stats.total}</div>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3">
              <div className="text-muted-foreground">Pending dues</div>
              <div className="mt-0.5 text-lg font-semibold">{formatINR(stats.pendingAmount)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Ledger */}
      <div className="rounded-2xl border bg-card shadow-sm">
        <div className="flex flex-col gap-3 border-b p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold">Customer Ledger</h2>
            <p className="text-xs text-muted-foreground">
              {data.customers.length} {data.customers.length === 1 ? "customer" : "customers"} · {formatMonth(month)}
            </p>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, account, mobile..."
              className="pl-8"
            />
          </div>
        </div>

        {isEmpty ? (
          <EmptyState onAdd={() => { setEditing(null); setAddOpen(true); }} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 text-left font-semibold">Customer</th>
                  <th className="px-5 py-3 text-left font-semibold">Account No.</th>
                  <th className="px-5 py-3 text-right font-semibold">RD Amount</th>
                  <th className="px-5 py-3 text-center font-semibold">Status</th>
                  <th className="px-5 py-3 text-center font-semibold">This Month</th>
                  <th className="px-5 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {[...grouped.entries()].map(([gid, custs]) => (
                  <GroupBlock
                    key={gid ?? "none"}
                    groupId={gid}
                    groupName={groupName(gid)}
                    customers={custs}
                    month={month}
                    onMarkGroup={(mode) => gid && markGroupPaid(gid, mode)}
                    onOpenProfile={setProfileId}
                    onEdit={(c) => { setEditing(c); setAddOpen(true); }}
                    onDelete={deleteCustomer}
                  />
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center text-sm text-muted-foreground">
                      No customers match your search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CustomerFormDialog open={addOpen} onOpenChange={setAddOpen} editing={editing} />
      <CustomerProfileDialog
        open={!!profileId}
        onOpenChange={(o) => !o && setProfileId(null)}
        customerId={profileId}
      />

      <Dialog open={groupOpen} onOpenChange={setGroupOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage Groups</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="e.g. Sharma Family / Sector 5"
              />
              <Button onClick={createGroup}>Add</Button>
            </div>
            <div className="divide-y rounded-md border">
              {data.groups.length === 0 && (
                <div className="px-3 py-4 text-sm text-muted-foreground">No groups yet.</div>
              )}
              {data.groups.map((g) => (
                <div key={g.id} className="flex items-center justify-between px-3 py-2">
                  <div>
                    <div className="text-sm font-medium">{g.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {data.customers.filter((c) => c.groupId === g.id).length} members
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => deleteGroup(g.id)}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGroupOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function KpiCard({
  label,
  value,
  icon,
  gradient,
  trend,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  gradient: string;
  trend: { dir: "up" | "down" | "flat"; text: string };
}) {
  const TrendIcon = trend.dir === "up" ? TrendingUp : trend.dir === "down" ? TrendingDown : Activity;
  const trendCls =
    trend.dir === "up"
      ? "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10"
      : trend.dir === "down"
        ? "text-red-600 dark:text-red-400 bg-red-500/10"
        : "text-muted-foreground bg-muted";

  return (
    <div className="group relative overflow-hidden rounded-2xl border bg-card p-5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/5">
      <div className={`pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-gradient-to-br ${gradient} opacity-10 blur-2xl transition-opacity duration-300 group-hover:opacity-20`} />
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
          <div className="mt-2 truncate text-2xl font-bold tracking-tight">{value}</div>
        </div>
        <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${gradient} text-white shadow-md shadow-black/10`}>
          {icon}
        </div>
      </div>
      <div className={`mt-4 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${trendCls}`}>
        <TrendIcon className="h-3 w-3" />
        {trend.text}
      </div>
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
      <div className="relative">
        <div className="absolute inset-0 -z-10 rounded-full bg-gradient-to-br from-primary/20 via-violet-500/10 to-transparent blur-2xl" />
        <div className="grid h-20 w-20 place-items-center rounded-2xl border bg-gradient-to-br from-primary/10 to-violet-500/10 shadow-sm">
          <UserPlus className="h-9 w-9 text-primary" />
        </div>
      </div>
      <h3 className="mt-6 text-lg font-semibold">No customers yet</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        Start building your RD portfolio. Add your first customer to begin tracking monthly deposits, maturity and reminders.
      </p>
      <Button size="lg" className="mt-6" onClick={onAdd}>
        <Plus className="mr-1.5 h-4 w-4" /> Add Your First Customer
      </Button>
      <div className="mt-8 grid w-full max-w-md grid-cols-3 gap-3 text-xs text-muted-foreground">
        <div className="rounded-lg border bg-muted/30 p-3">
          <Wallet className="mx-auto h-4 w-4 text-primary" />
          <div className="mt-1">Track RD</div>
        </div>
        <div className="rounded-lg border bg-muted/30 p-3">
          <Activity className="mx-auto h-4 w-4 text-primary" />
          <div className="mt-1">Live insights</div>
        </div>
        <div className="rounded-lg border bg-muted/30 p-3">
          <MessageSquare className="mx-auto h-4 w-4 text-primary" />
          <div className="mt-1">Reminders</div>
        </div>
      </div>
    </div>
  );
}

function GroupBlock({
  groupId,
  groupName,
  customers,
  month,
  onMarkGroup,
  onOpenProfile,
  onEdit,
  onDelete,
}: {
  groupId: string | null;
  groupName: string;
  customers: Customer[];
  month: string;
  onMarkGroup: (mode: "online" | "cash") => void;
  onOpenProfile: (id: string) => void;
  onEdit: (c: Customer) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <>
      <tr className="border-t bg-muted/30">
        <td colSpan={5} className="px-5 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {groupName} <span className="text-muted-foreground/70">({customers.length})</span>
        </td>
        <td className="px-5 py-2 text-right">
          {groupId && (
            <Button size="sm" variant="outline" onClick={() => onMarkGroup("cash")} className="h-7">
              <CheckCheck className="mr-1 h-3.5 w-3.5" /> Mark Group Paid
            </Button>
          )}
        </td>
      </tr>
      {customers.map((c) => {
        const status = getCustomerStatus(c, month);
        return (
          <tr key={c.id} className="border-t transition-colors hover:bg-muted/20">
            <td className="px-5 py-3">
              <div className="flex items-center gap-3">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary/15 to-primary/5 text-xs font-semibold uppercase text-primary">
                  {c.name.slice(0, 2)}
                </div>
                <div className="min-w-0">
                  <button
                    className="block truncate text-left font-medium hover:text-primary hover:underline"
                    onClick={() => onOpenProfile(c.id)}
                  >
                    {c.name}
                  </button>
                  <div className="truncate text-xs text-muted-foreground">{c.mobile || "—"}</div>
                </div>
              </div>
            </td>
            <td className="px-5 py-3 font-mono text-xs text-muted-foreground">{c.accountNumber || "—"}</td>
            <td className="px-5 py-3 text-right font-semibold">{formatINR(c.rdAmount)}</td>
            <td className="px-5 py-3 text-center">
              <StatusBadge status={status} />
            </td>
            <td className="px-5 py-3 text-center">
              <PaymentCell customerId={c.id} />
            </td>
            <td className="px-5 py-3 text-right">
              <div className="inline-flex items-center gap-0.5">
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => onOpenProfile(c.id)} title="View">
                  <Eye className="h-3.5 w-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => onEdit(c)} title="Edit">
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => onDelete(c.id)} title="Delete">
                  <Trash2 className="h-3.5 w-3.5 text-red-500" />
                </Button>
              </div>
            </td>
          </tr>
        );
      })}
    </>
  );
}
