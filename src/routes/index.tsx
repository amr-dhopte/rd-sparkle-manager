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
      { title: "Post Office RD Ledger" },
      { name: "description", content: "Manage customers and monthly RD payments." },
    ],
  }),
  component: LedgerPage,
});

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

  const markGroupPaid = (groupId: string, mode: "online" | "cash" = "cash") => {
    update((d) => ({
      ...d,
      customers: d.customers.map((c) => {
        if (c.groupId !== groupId) return c;
        const has = c.payments.some((p) => p.month === month);
        const stamp = new Date().toISOString();
        const payments = has
          ? c.payments.map((p) =>
              p.month === month ? { ...p, mode, timestamp: stamp } : p,
            )
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

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Total Customers" value={String(stats.total)} />
        <StatCard label="Paid This Month" value={`${stats.paid} / ${stats.total}`} tone="success" />
        <StatCard label="Pending" value={String(stats.pending)} tone="danger" />
        <StatCard label="Collected" value={formatINR(stats.collected)} tone="primary" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, account or mobile..."
            className="pl-8"
          />
        </div>
        <Button variant="outline" onClick={() => setGroupOpen(true)}>
          <Users className="mr-1.5 h-4 w-4" /> Groups
        </Button>
        <Button onClick={() => { setEditing(null); setAddOpen(true); }}>
          <Plus className="mr-1.5 h-4 w-4" /> Add Customer
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Customer</th>
                <th className="px-4 py-3 text-left">Account No.</th>
                <th className="px-4 py-3 text-right">RD Amount</th>
                <th className="px-4 py-3 text-center">This Month</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {[...grouped.entries()].map(([gid, custs]) => (
                <GroupBlock
                  key={gid ?? "none"}
                  groupId={gid}
                  groupName={groupName(gid)}
                  customers={custs}
                  onMarkGroup={(mode) => gid && markGroupPaid(gid, mode)}
                  onOpenProfile={setProfileId}
                  onEdit={(c) => { setEditing(c); setAddOpen(true); }}
                  onDelete={deleteCustomer}
                />
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-sm text-muted-foreground">
                    No customers yet. Click <strong>Add Customer</strong> to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
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

function StatCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "success" | "danger" | "primary";
}) {
  const cls =
    tone === "primary"
      ? "bg-primary text-primary-foreground"
      : tone === "success"
        ? "bg-emerald-600 text-white"
        : tone === "danger"
          ? "bg-red-500 text-white"
          : "bg-card border";
  return (
    <div className={`rounded-lg p-4 shadow-sm ${cls}`}>
      <div className="text-xs opacity-80">{label}</div>
      <div className="mt-1 text-2xl font-semibold tracking-tight">{value}</div>
    </div>
  );
}

function GroupBlock({
  groupId,
  groupName,
  customers,
  onMarkGroup,
  onOpenProfile,
  onEdit,
  onDelete,
}: {
  groupId: string | null;
  groupName: string;
  customers: Customer[];
  onMarkGroup: (mode: "online" | "cash") => void;
  onOpenProfile: (id: string) => void;
  onEdit: (c: Customer) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <>
      <tr className="bg-muted/30">
        <td colSpan={4} className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {groupName} <span className="text-muted-foreground/70">({customers.length})</span>
        </td>
        <td className="px-4 py-2 text-right">
          {groupId && (
            <Button size="sm" variant="outline" onClick={() => onMarkGroup("cash")} className="h-7">
              <CheckCheck className="mr-1 h-3.5 w-3.5" /> Mark Group Paid
            </Button>
          )}
        </td>
      </tr>
      {customers.map((c) => (
        <tr key={c.id} className="border-t hover:bg-muted/20">
          <td className="px-4 py-2.5">
            <button
              className="text-left font-medium text-primary hover:underline"
              onClick={() => onOpenProfile(c.id)}
            >
              {c.name}
            </button>
            <div className="text-xs text-muted-foreground">{c.mobile}</div>
          </td>
          <td className="px-4 py-2.5 font-mono text-xs">{c.accountNumber}</td>
          <td className="px-4 py-2.5 text-right font-medium">{formatINR(c.rdAmount)}</td>
          <td className="px-4 py-2.5 text-center">
            <PaymentCell customerId={c.id} />
          </td>
          <td className="px-4 py-2.5 text-right">
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onEdit(c)}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onDelete(c.id)}>
              <Trash2 className="h-3.5 w-3.5 text-red-500" />
            </Button>
          </td>
        </tr>
      ))}
    </>
  );
}
