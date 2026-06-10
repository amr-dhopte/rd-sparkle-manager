import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

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

function loadCache(): AppData {
  if (typeof window === "undefined") return defaultData;
  try {
    const raw = localStorage.getItem(cacheKey());
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

function saveCache(data: AppData) {
  if (typeof window === "undefined") return;
  localStorage.setItem(cacheKey(), JSON.stringify(data));
}

// ====== Cloud-synced global store ======

let currentUserId: string | null = null;
let state: AppData = defaultData;
let lastSynced: AppData = defaultData;
let hydratedFlag = false;
const subscribers = new Set<() => void>();
let realtimeChannel: ReturnType<typeof supabase.channel> | null = null;
let reloadDebounce: ReturnType<typeof setTimeout> | null = null;

const LOCAL_FALLBACK_KEY = "po-rd-agent-data-v1";

function cacheKey() {
  return currentUserId ? `po-rd-agent-data-v1:${currentUserId}` : LOCAL_FALLBACK_KEY;
}

function notify() {
  subscribers.forEach((fn) => fn());
}

function setState(next: AppData, opts: { markSynced?: boolean } = {}) {
  state = next;
  if (opts.markSynced) lastSynced = next;
  saveCache(next);
  notify();
}

function clone(d: AppData): AppData {
  return JSON.parse(JSON.stringify(d));
}

function mapRowToCustomer(row: {
  id: string; name: string; age: number | null; mobile: string;
  account_number: string; rd_amount: number | string; start_date: string;
  tenure_months: number; interest_rate: number | string; group_id: string | null;
}, payments: Payment[]): Customer {
  return {
    id: row.id,
    name: row.name,
    age: row.age,
    mobile: row.mobile,
    accountNumber: row.account_number,
    rdAmount: Number(row.rd_amount),
    startDate: row.start_date,
    tenureMonths: row.tenure_months,
    interestRate: Number(row.interest_rate),
    groupId: row.group_id,
    payments,
  };
}

async function fetchFromCloud(userId: string): Promise<AppData> {
  const [gs, cs, ps, st] = await Promise.all([
    supabase.from("groups").select("*"),
    supabase.from("customers").select("*"),
    supabase.from("payments").select("*"),
    supabase.from("agent_settings").select("*").eq("user_id", userId).maybeSingle(),
  ]);
  const paymentsByCust = new Map<string, Payment[]>();
  for (const p of ps.data ?? []) {
    const list = paymentsByCust.get(p.customer_id) ?? [];
    list.push({ month: p.month, mode: p.mode as PaymentMode, timestamp: p.paid_at });
    paymentsByCust.set(p.customer_id, list);
  }
  const customers = (cs.data ?? []).map((row) =>
    mapRowToCustomer(row, (paymentsByCust.get(row.id) ?? []).sort((a, b) => a.month.localeCompare(b.month))),
  );
  const groups: Group[] = (gs.data ?? []).map((g) => ({
    id: g.id,
    name: g.name,
    customerIds: customers.filter((c) => c.groupId === g.id).map((c) => c.id),
  }));
  const settings: Settings = st.data
    ? {
        agentName: st.data.agent_name,
        agentId: st.data.agent_id,
        agencyName: st.data.agency_name,
        messageTemplate: st.data.message_template,
        currentRate: Number(st.data.current_rate),
        reminderDismissedFor: st.data.reminder_dismissed_for,
      }
    : { ...defaultData.settings };
  return { customers, groups, settings };
}

function remapIdsToUUID(d: AppData): AppData {
  const groupMap = new Map(d.groups.map((g) => [g.id, crypto.randomUUID()] as const));
  const custMap = new Map(d.customers.map((c) => [c.id, crypto.randomUUID()] as const));
  return {
    settings: d.settings,
    groups: d.groups.map((g) => ({ ...g, id: groupMap.get(g.id)!, customerIds: g.customerIds.map((cid) => custMap.get(cid) ?? cid) })),
    customers: d.customers.map((c) => ({
      ...c,
      id: custMap.get(c.id)!,
      groupId: c.groupId ? groupMap.get(c.groupId) ?? null : null,
    })),
  };
}

async function reconcile(prev: AppData, next: AppData, userId: string) {
  const ops: Promise<unknown>[] = [];

  // Groups
  const prevG = new Map(prev.groups.map((g) => [g.id, g]));
  const nextG = new Map(next.groups.map((g) => [g.id, g]));
  for (const g of next.groups) {
    const old = prevG.get(g.id);
    if (!old) ops.push(supabase.from("groups").insert({ id: g.id, user_id: userId, name: g.name }));
    else if (old.name !== g.name) ops.push(supabase.from("groups").update({ name: g.name }).eq("id", g.id));
  }
  for (const g of prev.groups) if (!nextG.has(g.id)) ops.push(supabase.from("groups").delete().eq("id", g.id));

  // Customers
  const prevC = new Map(prev.customers.map((c) => [c.id, c]));
  const nextC = new Map(next.customers.map((c) => [c.id, c]));
  for (const c of next.customers) {
    const old = prevC.get(c.id);
    const row = {
      id: c.id, user_id: userId, name: c.name, age: c.age, mobile: c.mobile,
      account_number: c.accountNumber, rd_amount: c.rdAmount, start_date: c.startDate,
      tenure_months: c.tenureMonths, interest_rate: c.interestRate, group_id: c.groupId ?? null,
    };
    if (!old) ops.push(supabase.from("customers").insert(row));
    else if (
      old.name !== c.name || old.age !== c.age || old.mobile !== c.mobile ||
      old.accountNumber !== c.accountNumber || old.rdAmount !== c.rdAmount ||
      old.startDate !== c.startDate || old.tenureMonths !== c.tenureMonths ||
      old.interestRate !== c.interestRate || old.groupId !== c.groupId
    ) {
      const { id: _id, user_id: _u, ...upd } = row;
      ops.push(supabase.from("customers").update(upd).eq("id", c.id));
    }

    // Payments diff per customer
    const oldP = new Map((old?.payments ?? []).map((p) => [p.month, p]));
    const newP = new Map(c.payments.map((p) => [p.month, p]));
    for (const p of c.payments) {
      const prior = oldP.get(p.month);
      if (!prior) {
        ops.push(supabase.from("payments").insert({
          user_id: userId, customer_id: c.id, month: p.month, mode: p.mode, paid_at: p.timestamp,
        }));
      } else if (prior.mode !== p.mode || prior.timestamp !== p.timestamp) {
        ops.push(supabase.from("payments").update({ mode: p.mode, paid_at: p.timestamp })
          .eq("customer_id", c.id).eq("month", p.month));
      }
    }
    for (const p of old?.payments ?? []) {
      if (!newP.has(p.month)) {
        ops.push(supabase.from("payments").delete().eq("customer_id", c.id).eq("month", p.month));
      }
    }
  }
  for (const c of prev.customers) if (!nextC.has(c.id)) ops.push(supabase.from("customers").delete().eq("id", c.id));

  // Settings
  const ps = prev.settings, ns = next.settings;
  if (
    ps.agentName !== ns.agentName || ps.agentId !== ns.agentId || ps.agencyName !== ns.agencyName ||
    ps.messageTemplate !== ns.messageTemplate || ps.currentRate !== ns.currentRate ||
    ps.reminderDismissedFor !== ns.reminderDismissedFor
  ) {
    ops.push(supabase.from("agent_settings").upsert({
      user_id: userId,
      agent_name: ns.agentName,
      agent_id: ns.agentId,
      agency_name: ns.agencyName,
      message_template: ns.messageTemplate,
      current_rate: ns.currentRate,
      reminder_dismissed_for: ns.reminderDismissedFor,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" }));
  }

  const results = await Promise.all(ops);
  for (const r of results) {
    const err = (r as { error?: { message: string } })?.error;
    if (err) console.error("[rd-store] sync error", err);
  }
}

function scheduleReload() {
  if (reloadDebounce) clearTimeout(reloadDebounce);
  reloadDebounce = setTimeout(async () => {
    if (!currentUserId) return;
    const fresh = await fetchFromCloud(currentUserId);
    setState(fresh, { markSynced: true });
  }, 250);
}

function subscribeRealtime(userId: string) {
  if (realtimeChannel) supabase.removeChannel(realtimeChannel);
  realtimeChannel = supabase
    .channel(`rd-sync-${userId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "customers", filter: `user_id=eq.${userId}` }, scheduleReload)
    .on("postgres_changes", { event: "*", schema: "public", table: "groups", filter: `user_id=eq.${userId}` }, scheduleReload)
    .on("postgres_changes", { event: "*", schema: "public", table: "payments", filter: `user_id=eq.${userId}` }, scheduleReload)
    .on("postgres_changes", { event: "*", schema: "public", table: "agent_settings", filter: `user_id=eq.${userId}` }, scheduleReload)
    .subscribe();
}

export async function initStoreForUser(userId: string) {
  currentUserId = userId;
  hydratedFlag = false;
  // show cache immediately
  state = loadCache();
  notify();

  const cloud = await fetchFromCloud(userId);
  const cloudEmpty = cloud.customers.length === 0 && cloud.groups.length === 0;

  // Migrate any pre-auth local data once
  let legacy: AppData | null = null;
  try {
    const raw = typeof window !== "undefined" ? localStorage.getItem(LOCAL_FALLBACK_KEY) : null;
    if (raw) legacy = JSON.parse(raw) as AppData;
  } catch { /* ignore */ }

  if (cloudEmpty && legacy && (legacy.customers?.length || legacy.groups?.length)) {
    const migrated = remapIdsToUUID({
      ...defaultData,
      ...legacy,
      settings: { ...defaultData.settings, ...legacy.settings },
    });
    setState(migrated);
    await reconcile(cloud, migrated, userId);
    lastSynced = migrated;
    try { localStorage.removeItem(LOCAL_FALLBACK_KEY); } catch { /* ignore */ }
  } else {
    setState(cloud, { markSynced: true });
  }

  hydratedFlag = true;
  notify();
  subscribeRealtime(userId);
}

export function teardownStore() {
  if (realtimeChannel) {
    supabase.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }
  currentUserId = null;
  state = defaultData;
  lastSynced = defaultData;
  hydratedFlag = false;
  notify();
}

export function useAppData() {
  const [, force] = useState(0);
  useEffect(() => {
    const fn = () => force((n) => n + 1);
    subscribers.add(fn);
    return () => { subscribers.delete(fn); };
  }, []);

  const update = useCallback((updater: (d: AppData) => AppData) => {
    const prev = state;
    const next = updater(clone(prev));
    setState(next);
    if (currentUserId) {
      reconcile(lastSynced, next, currentUserId)
        .then(() => { lastSynced = next; })
        .catch((e) => console.error("[rd-store] reconcile failed", e));
    }
  }, []);

  return { data: state, hydrated: hydratedFlag, update };
}

// ========= Helpers =========

export function uid() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
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
