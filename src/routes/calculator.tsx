import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { calcRDMaturity, formatINR } from "@/lib/rd-store";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";

export const Route = createFileRoute("/calculator")({
  head: () => ({ meta: [{ title: "RD Calculator" }] }),
  component: CalculatorPage,
});

function CalculatorPage() {
  const [monthly, setMonthly] = useState(2000);
  const [rate, setRate] = useState(6.7);
  const [years, setYears] = useState(5);

  const months = years * 12;
  const { maturity, invested, interest, yearly } = useMemo(() => {
    const maturity = calcRDMaturity(monthly, rate, months);
    const invested = monthly * months;
    const interest = maturity - invested;
    const yearly: { year: number; deposit: number; balance: number; interest: number }[] = [];
    for (let y = 1; y <= years; y++) {
      const m = y * 12;
      const bal = calcRDMaturity(monthly, rate, m);
      const dep = monthly * m;
      yearly.push({ year: y, deposit: dep, balance: bal, interest: bal - dep });
    }
    return { maturity, invested, interest, yearly };
  }, [monthly, rate, months, years]);

  const pieData = [
    { name: "Invested", value: Math.round(invested) },
    { name: "Interest", value: Math.round(Math.max(interest, 0)) },
  ];
  const COLORS = ["#0ea5e9", "#10b981"];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">RD Interactive Calculator</h1>
        <p className="text-sm text-muted-foreground">
          Calculate Post Office Recurring Deposit maturity using the official quarterly compounding formula.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-4 rounded-lg border bg-card p-5 shadow-sm">
          <div>
            <Label>Monthly Deposit (₹)</Label>
            <Input type="number" value={monthly} onChange={(e) => setMonthly(Number(e.target.value) || 0)} />
          </div>
          <div>
            <Label>Interest Rate (% p.a.)</Label>
            <Input type="number" step="0.1" value={rate} onChange={(e) => setRate(Number(e.target.value) || 0)} />
          </div>
          <div>
            <Label>Tenure (Years)</Label>
            <Input type="number" value={years} onChange={(e) => setYears(Number(e.target.value) || 0)} />
          </div>

          <div className="space-y-2 pt-2">
            <Row label="Total Deposited" value={formatINR(invested)} />
            <Row label="Total Interest Earned" value={formatINR(interest)} tone="success" />
            <Row label="Maturity Value" value={formatINR(maturity)} tone="primary" />
          </div>
        </div>

        <div className="rounded-lg border bg-card p-5 shadow-sm lg:col-span-2">
          <h3 className="mb-2 text-sm font-semibold">Investment vs Interest</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={100} paddingAngle={2}>
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => formatINR(v)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="rounded-lg border bg-card shadow-sm">
        <div className="border-b px-5 py-3">
          <h3 className="text-sm font-semibold">Yearly Breakdown</h3>
        </div>
        <ScrollArea className="h-80">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left">Year</th>
                <th className="px-4 py-2 text-right">Total Deposit</th>
                <th className="px-4 py-2 text-right">Interest</th>
                <th className="px-4 py-2 text-right">Balance</th>
              </tr>
            </thead>
            <tbody>
              {yearly.map((r) => (
                <tr key={r.year} className="border-t">
                  <td className="px-4 py-2 font-medium">Year {r.year}</td>
                  <td className="px-4 py-2 text-right">{formatINR(r.deposit)}</td>
                  <td className="px-4 py-2 text-right text-emerald-600">{formatINR(r.interest)}</td>
                  <td className="px-4 py-2 text-right font-semibold">{formatINR(r.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollArea>
      </div>
    </div>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: "primary" | "success" }) {
  const cls =
    tone === "primary"
      ? "text-primary"
      : tone === "success"
        ? "text-emerald-600"
        : "text-foreground";
  return (
    <div className="flex items-center justify-between border-b py-2 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`font-semibold ${cls}`}>{value}</span>
    </div>
  );
}
