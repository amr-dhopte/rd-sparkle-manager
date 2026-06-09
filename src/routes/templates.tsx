import { createFileRoute } from "@tanstack/react-router";
import { useAppData } from "@/lib/rd-store";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/templates")({
  head: () => ({ meta: [{ title: "Message Templates & Settings" }] }),
  component: TemplatesPage,
});

function TemplatesPage() {
  const { data, hydrated, update } = useAppData();
  const [form, setForm] = useState(data.settings);

  useEffect(() => {
    if (hydrated) setForm(data.settings);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  if (!hydrated) return null;

  const save = () => {
    update((d) => ({ ...d, settings: { ...d.settings, ...form } }));
    toast.success("Settings saved");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings & WhatsApp Template</h1>
        <p className="text-sm text-muted-foreground">
          Configure your agency details and the message sent to customers from their profile.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="rounded-lg border bg-card p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold">Agent / Agency</h3>
          <div className="space-y-3">
            <Field label="Agent Name" value={form.agentName} onChange={(v) => setForm({ ...form, agentName: v })} />
            <Field label="Agent ID" value={form.agentId} onChange={(v) => setForm({ ...form, agentId: v })} />
            <Field label="Agency Name" value={form.agencyName} onChange={(v) => setForm({ ...form, agencyName: v })} />
            <div>
              <Label>Current Prevailing RD Rate (% p.a.)</Label>
              <Input
                type="number"
                step="0.1"
                value={form.currentRate}
                onChange={(e) => setForm({ ...form, currentRate: Number(e.target.value) || 0 })}
              />
            </div>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold">WhatsApp Reminder Template</h3>
          <Textarea
            rows={10}
            value={form.messageTemplate}
            onChange={(e) => setForm({ ...form, messageTemplate: e.target.value })}
            className="font-mono text-sm"
          />
          <p className="mt-2 text-xs text-muted-foreground">
            Placeholders: <code>{"{name}"}</code>, <code>{"{amount}"}</code>, <code>{"{month}"}</code>,{" "}
            <code>{"{account}"}</code>, <code>{"{agent}"}</code>
          </p>
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={save}>Save Settings</Button>
      </div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <Label>{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
