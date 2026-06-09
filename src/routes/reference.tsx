import { createFileRoute } from "@tanstack/react-router";
import { useAppData, calcRDMaturity, formatINR } from "@/lib/rd-store";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";

export const Route = createFileRoute("/reference")({
  head: () => ({ meta: [{ title: "Maturity Reference Chart" }] }),
  component: ReferencePage,
});

const DENOMS = [100, 200, 500, 1000, 2000, 3000, 4000, 5000, 10000];

function ReferencePage() {
  const { data, hydrated } = useAppData();
  const [rate, setRate] = useState<number | null>(null);
  const [tenure, setTenure] = useState(60);

  if (!hydrated) return null;
  const effectiveRate = rate ?? data.settings.currentRate;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Quick Maturity Reference Chart</h1>
        <p className="text-sm text-muted-foreground">
          Pre-calculated RD values at the current prevailing rate ({effectiveRate}% p.a., quarterly compounding).
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-4 shadow-sm">
        <div>
          <Label>Interest Rate (%)</Label>
          <Input
            type="number"
            step="0.1"
            value={effectiveRate}
            onChange={(e) => setRate(Number(e.target.value))}
            className="w-32"
          />
        </div>
        <div>
          <Label>Tenure (Months)</Label>
          <Input
            type="number"
            value={tenure}
            onChange={(e) => setTenure(Number(e.target.value) || 60)}
            className="w-32"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left">Monthly RD</th>
              <th className="px-4 py-3 text-right">Total Deposit</th>
              <th className="px-4 py-3 text-right">Interest Earned</th>
              <th className="px-4 py-3 text-right">Maturity Amount</th>
            </tr>
          </thead>
          <tbody>
            {DENOMS.map((amt) => {
              const dep = amt * tenure;
              const mat = calcRDMaturity(amt, effectiveRate, tenure);
              return (
                <tr key={amt} className="border-t">
                  <td className="px-4 py-3 font-semibold">{formatINR(amt)}</td>
                  <td className="px-4 py-3 text-right">{formatINR(dep)}</td>
                  <td className="px-4 py-3 text-right text-emerald-600">{formatINR(mat - dep)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-primary">{formatINR(mat)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
