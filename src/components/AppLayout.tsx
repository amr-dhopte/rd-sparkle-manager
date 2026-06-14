import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Calculator, MessageSquare, Table, IndianRupee, LogOut } from "lucide-react";
import { ReminderBanner } from "./ReminderBanner";
import { useAppData } from "@/lib/rd-store";
import { AuthGate } from "./AuthGate";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "./ui/button";
import { ThemeToggle } from "./ThemeToggle";

const NAV = [
  { to: "/", label: "Ledger", icon: LayoutDashboard },
  { to: "/calculator", label: "RD Calculator", icon: Calculator },
  { to: "/templates", label: "Message Templates", icon: MessageSquare },
  { to: "/reference", label: "Maturity Chart", icon: Table },
];

export function AppLayout() {
  return (
    <AuthGate>
      <AppShell />
    </AuthGate>
  );
}

function AppShell() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data } = useAppData();

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="sticky top-0 z-30 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <IndianRupee className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-semibold leading-tight">{data.settings.agencyName}</div>
              <div className="text-xs text-muted-foreground">
                {data.settings.agentName} · {data.settings.agentId}
              </div>
            </div>
          </div>
          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
            <ThemeToggle />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => supabase.auth.signOut()}
              className="ml-2"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </nav>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-2 pb-2 md:hidden">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {item.label}
              </Link>
            );
          })}
          <ThemeToggle />
        </nav>
      </header>
      <ReminderBanner />
      <main className="mx-auto max-w-7xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
