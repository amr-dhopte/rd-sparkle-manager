import { useEffect, useState, useCallback } from "react";

export type PaymentMode = "online" | "cash" | "paid" | "pending";

export interface Payment {
  month: string; // YYYY-MM
  mode: PaymentMode;
  timestamp: string | null;
}

export interface Customer {
  id: string;
  name: string;
  age: number | null;
  mobile: string;
  accountNumber: string;
  rdAmount: number;
  startDate: string; // YYYY-MM-DD
  tenureMonths: number; // typically 60
  interestRate: number; // annual %
  groupId?: string | null;
  payments: Payment[];
}

export interface Group {
  id: string;
  name: string;
  customerIds: string[];
}

export interface Settings {
  agentName: string;
  agentId: string;
  agencyName: string;
  messageTemplate: string;
  currentRate: number;
  reminderDismissedFor: string | null; // YYYY-MM
}

export interface AppData {
  customers: Customer[];
  groups: Group[];
  settings: Settings;
}

const STORAGE_KEY = "po-rd-agent-data-v1";

const DEFAULT_TEMPLATE =
  "Namaste {name} ji,\nApki Post Office RD ki monthly kist ₹{amount} ke liye reminder hai ({month}). Kripya jaldi jama karwayein.\nDhanyavaad,\n{agent}";

const defaultData: AppData = {
  customers: [],
  groups: [],
  settings: {
    agentName: "RD Agent",
    agentId: "AGT-0001",
    agencyName: "Post Office RD Agency",
    messageTemplate: DEFAULT_TEMPLATE,
    currentRate: 6.7,
    reminderDismissedFor: null,
  },
};

function load(): AppData {
  if (typeof window === "undefined") return defaultData;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultData;
    const parsed = JSON.parse(raw) as AppData;
    return {
      ...defaultData,
      ...parsed,
      settings: { ...defaultData.settings, ...parsed.settings },
    };
  } catch {
    return defaultData;
  }
}

function save(data: AppData) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  window.dispatchEvent(new Event("po-rd-data-changed"));
}

export function useAppData() {
  const [data, setData] = useState<AppData>(defaultData);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setData(load());
    setHydrated(true);
    const handler = () => setData(load());
    window.addEventListener("po-rd-data-changed", handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("po-rd-data-changed", handler);
      window.removeEventListener("storage", handler);
    };
  }, []);

  const update = useCallback((updater: (d: AppData) => AppData) => {
    const next = updater(load());
    save(next);
    setData(next);
  }, []);

  return { data, hydrated, update };
}

// ========= Helpers =========

export function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export function currentMonthKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function monthKeyFromDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function formatMonth(key: string) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleString("en-IN", { month: "short", year: "numeric" });
}

export function listMonthsBetween(startISO: string, endDate: Date): string[] {
  const start = new Date(startISO);
  const months: string[] = [];
  const cur = new Date(start.getFullYear(), start.getMonth(), 1);
  const end = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
  while (cur <= end) {
    months.push(monthKeyFromDate(cur));
    cur.setMonth(cur.getMonth() + 1);
  }
  return months;
}

// Indian Post Office RD Maturity Formula (quarterly compounding on monthly deposit)
// M = R * [(1+i)^n - 1] / [1 - (1+i)^(-1/3)]
// where i = annualRate/400 (quarterly), n = number of quarters
export function calcRDMaturity(monthly: number, annualRate: number, months: number) {
  const i = annualRate / 400;
  const n = months / 3;
  if (i === 0) return monthly * months;
  const maturity = monthly * (Math.pow(1 + i, n) - 1) / (1 - Math.pow(1 + i, -1 / 3));
  return maturity;
}

export function calcCustomerFinancials(c: Customer) {
  const paidMonths = c.payments.filter((p) => p.mode !== "pending").length;
  const invested = paidMonths * c.rdAmount;
  const totalDeposit = c.tenureMonths * c.rdAmount;
  const maturity = calcRDMaturity(c.rdAmount, c.interestRate, c.tenureMonths);
  const investedSoFarMaturity = calcRDMaturity(c.rdAmount, c.interestRate, Math.max(paidMonths, 0));
  const interestSoFar = Math.max(0, investedSoFarMaturity - invested);
  return {
    paidMonths,
    invested,
    totalDeposit,
    maturity,
    totalInterest: maturity - totalDeposit,
    interestSoFar,
  };
}

export function maturityDate(startISO: string, tenureMonths: number) {
  const d = new Date(startISO);
  d.setMonth(d.getMonth() + tenureMonths);
  return d;
}

export function ensurePaymentsBackfilled(c: Customer): Customer {
  const months = listMonthsBetween(c.startDate, new Date());
  const existing = new Map(c.payments.map((p) => [p.month, p]));
  const payments = months.map(
    (m) => existing.get(m) ?? { month: m, mode: "pending" as PaymentMode, timestamp: null },
  );
  return { ...c, payments };
}

export function formatINR(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}
