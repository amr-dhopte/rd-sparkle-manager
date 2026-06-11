import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const InputSchema = z.object({
  email: z.string().email().max(254),
  redirectTo: z.string().url().max(2048),
});

export const sendResendPasswordReset = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data }) => {
    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    if (!LOVABLE_API_KEY || !RESEND_API_KEY) {
      throw new Error("Email service is not configured.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Don't leak whether the account exists.
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email: data.email,
      options: { redirectTo: data.redirectTo },
    });

    if (linkError || !linkData?.properties?.action_link) {
      // Swallow "user not found" style errors to avoid account enumeration.
      return { ok: true };
    }

    const actionLink = linkData.properties.action_link;

    const html = `
      <div style="font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; color: #111;">
        <h2 style="margin:0 0 16px;">Reset your password</h2>
        <p style="line-height:1.5;">We received a request to reset your RD Agent Pro password. Click the button below to choose a new one. This link expires in 1 hour.</p>
        <p style="margin:24px 0;">
          <a href="${actionLink}" style="background:#2563eb;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block;">Reset Password</a>
        </p>
        <p style="font-size:12px;color:#666;">If the button doesn't work, paste this link into your browser:<br/><span style="word-break:break-all;">${actionLink}</span></p>
        <p style="font-size:12px;color:#666;margin-top:24px;">If you didn't request this, you can safely ignore this email.</p>
      </div>
    `;

    const res = await fetch("https://connector-gateway.lovable.dev/resend/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": RESEND_API_KEY,
      },
      body: JSON.stringify({
        from: "RD Agent Pro <onboarding@resend.dev>",
        to: [data.email],
        subject: "Reset your RD Agent Pro password",
        html,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error("[resend] send failed", res.status, body);
      throw new Error("Could not send reset email. Please try again.");
    }

    return { ok: true };
  });