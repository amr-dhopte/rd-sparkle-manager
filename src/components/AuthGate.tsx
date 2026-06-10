import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { initStoreForUser, teardownStore } from "@/lib/rd-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { IndianRupee, Loader2 } from "lucide-react";
import { toast } from "sonner";

export function AuthGate({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<"loading" | "in" | "out">("loading");

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      if (data.session?.user) {
        setStatus("in");
        initStoreForUser(data.session.user.id);
      } else {
        setStatus("out");
      }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session?.user) {
        setStatus("in");
        initStoreForUser(session.user.id);
      } else if (event === "SIGNED_OUT") {
        teardownStore();
        setStatus("out");
      }
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (status === "out") return <AuthPage />;
  return <>{children}</>;
}

function AuthPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success("Account created. You're now signed in.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  const google = async () => {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (result.error) {
      toast.error(result.error instanceof Error ? result.error.message : "Google sign-in failed");
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-lg">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <IndianRupee className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold leading-tight">RD Agent Pro</h1>
            <p className="text-xs text-muted-foreground">Sign in to sync across devices</p>
          </div>
        </div>

        <Button type="button" variant="outline" className="w-full" onClick={google} disabled={loading}>
          Continue with Google
        </Button>

        <div className="my-4 flex items-center gap-2 text-xs text-muted-foreground">
          <div className="h-px flex-1 bg-border" /> or <div className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={submit} className="space-y-3">
          <div>
            <Label>Email</Label>
            <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </div>
          <div>
            <Label>Password</Label>
            <Input
              type="password" required minLength={6}
              value={password} onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === "signup" ? "Create Account" : "Sign In"}
          </Button>
        </form>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          {mode === "signup" ? "Already have an account?" : "New here?"}{" "}
          <button
            type="button"
            className="font-medium text-primary hover:underline"
            onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
          >
            {mode === "signup" ? "Sign in" : "Create one"}
          </button>
        </p>
      </div>
    </div>
  );
}