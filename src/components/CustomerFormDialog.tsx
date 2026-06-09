import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useAppData,
  uid,
  ensurePaymentsBackfilled,
  type Customer,
} from "@/lib/rd-store";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing?: Customer | null;
}

const empty = (): Customer => ({
  id: uid(),
  name: "",
  age: null,
  mobile: "",
  accountNumber: "",
  rdAmount: 1000,
  startDate: new Date().toISOString().slice(0, 10),
  tenureMonths: 60,
  interestRate: 6.7,
  groupId: null,
  payments: [],
});

export function CustomerFormDialog({ open, onOpenChange, editing }: Props) {
  const { data, update } = useAppData();
  const [form, setForm] = useState<Customer>(empty());

  useEffect(() => {
    if (open) setForm(editing ? { ...editing } : { ...empty(), interestRate: data.settings.currentRate });
  }, [open, editing, data.settings.currentRate]);

  const set = <K extends keyof Customer>(k: K, v: Customer[K]) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = () => {
    if (!form.name.trim() || !form.mobile.trim() || !form.accountNumber.trim()) {
      toast.error("Name, mobile and account number are required");
      return;
    }
    const backfilled = ensurePaymentsBackfilled(form);
    update((d) => {
      const exists = d.customers.some((c) => c.id === form.id);
      return {
        ...d,
        customers: exists
          ? d.customers.map((c) => (c.id === form.id ? backfilled : c))
          : [...d.customers, backfilled],
      };
    });
    toast.success(editing ? "Customer updated" : "Customer added");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Customer" : "Add New Customer"}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <Label>Full Name</Label>
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} />
          </div>
          <div>
            <Label>Mobile Number</Label>
            <Input value={form.mobile} onChange={(e) => set("mobile", e.target.value)} placeholder="10 digits" />
          </div>
          <div>
            <Label>Age</Label>
            <Input
              type="number"
              value={form.age ?? ""}
              onChange={(e) => set("age", e.target.value ? Number(e.target.value) : null)}
            />
          </div>
          <div>
            <Label>Account Number</Label>
            <Input value={form.accountNumber} onChange={(e) => set("accountNumber", e.target.value)} />
          </div>
          <div>
            <Label>Monthly RD Amount (₹)</Label>
            <Input
              type="number"
              value={form.rdAmount}
              onChange={(e) => set("rdAmount", Number(e.target.value) || 0)}
            />
          </div>
          <div>
            <Label>Interest Rate (% p.a.)</Label>
            <Input
              type="number"
              step="0.1"
              value={form.interestRate}
              onChange={(e) => set("interestRate", Number(e.target.value) || 0)}
            />
          </div>
          <div>
            <Label>RD Starting Date</Label>
            <Input
              type="date"
              value={form.startDate}
              onChange={(e) => set("startDate", e.target.value)}
            />
          </div>
          <div>
            <Label>Tenure (Months)</Label>
            <Input
              type="number"
              value={form.tenureMonths}
              onChange={(e) => set("tenureMonths", Number(e.target.value) || 60)}
            />
          </div>
          <div className="md:col-span-2">
            <Label>Group (optional)</Label>
            <Select
              value={form.groupId ?? "none"}
              onValueChange={(v) => set("groupId", v === "none" ? null : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="No group" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No group</SelectItem>
                {data.groups.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save Customer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
