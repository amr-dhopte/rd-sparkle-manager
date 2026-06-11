import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { sendResendPasswordReset } from "@/lib/password-reset.functions";
import { initStoreForUser, teardownStore } from "@/lib/rd-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, IndianRupee, Loader2 } from "lucide-react";
import { PasswordInput } from "@/components/PasswordInput";
import { toast } from "sonner";

export function AuthGate({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<"loading" | "in" | "out">("loading");
  const [recovery, setRecovery] = useState(false);

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
      if (event === "PASSWORD_RECOVERY") {
        setRecovery(true);
        setStatus("out");
      } else if (event === "SIGNED_IN" && session?.user) {
        setStatus("in");
        initStoreForUser(session.user.id);
      } else if (event === "SIGNED_OUT") {
        teardownStore();
        setStatus("out");
        setRecovery(false);
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
  if (recovery) return <ResetPasswordPage onDone={() => setRecovery(false)} />;
  if (status === "out") return <AuthPage />;
  return <>{children}</>;
}

function AuthPage() {
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
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
      } else if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  const sendReset = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      toast.error("Please enter a valid email address.");
      return;
    }
    setLoading(true);
    try {
      await sendResendPasswordReset({
        data: { email: trimmed, redirectTo: `${window.location.origin}/` },
      });
      toast.success(
        "If an account exists for this email, a password reset link has been sent. Please check your inbox and spam folder."
      );
      setMode("signin");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send reset email.");
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

  if (mode === "forgot") {
    return (
      <Shell subtitle="Reset Your Password">
        <p className="mb-4 text-sm text-muted-foreground">
          Enter your registered email and we'll send you a secure link to reset your password.
        </p>
        <form onSubmit={sendReset} className="space-y-3">
          <div>
            <Label>Email</Label>
            <Input
              type="email" required value={email}
              onChange={(e) => setEmail(e.target.value)} autoComplete="email"
              placeholder="you@example.com"
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Send Reset Link
          </Button>
        </form>
        <button
          type="button"
          onClick={() => setMode("signin")}
          className="mt-4 inline-flex w-full items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Login
        </button>
      </Shell>
    );
  }

  return (
    <Shell subtitle="Sign in to sync across devices">
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
          <div className="flex items-center justify-between">
            <Label>Password</Label>
            {mode === "signin" && (
              <button
                type="button"
                onClick={() => setMode("forgot")}
                className="text-xs font-medium text-primary hover:underline"
              >
                Forgot Password?
              </button>
            )}
          </div>
          <PasswordInput
            required minLength={6}
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
    </Shell>
  );
}

function Shell({ children, subtitle }: { children: ReactNode; subtitle: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-lg">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <IndianRupee className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold leading-tight">RD Agent Pro</h1>
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

function ResetPasswordPage({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Password updated. You're now signed in.");
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Shell subtitle="Set a new password">
      <form onSubmit={submit} className="space-y-3">
        <div>
          <Label>New password</Label>
          <PasswordInput required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
        </div>
        <div>
          <Label>Confirm password</Label>
          <PasswordInput required minLength={6} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Update Password
        </Button>
      </form>
    </Shell>
  );
}