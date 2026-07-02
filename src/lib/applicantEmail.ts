import { supabase } from "@/integrations/supabase/client";

const esc = (v: unknown) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

/** Wrap plain paragraphs (split on blank lines) into branded email HTML. */
const wrapBody = (title: string, message: string) => {
  const paragraphs = message
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map(
      (p) =>
        `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#0f172a;">${esc(p).replace(/\n/g, "<br/>")}</p>`,
    )
    .join("");
  return `
<!doctype html><html><body style="margin:0;background:#f4f7fb;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
  <div style="max-width:560px;margin:0 auto;padding:32px 16px;">
    <div style="background:#1e40af;color:#fff;padding:20px 24px;border-radius:12px 12px 0 0;">
      <h1 style="margin:0;font-size:20px;font-weight:600;">BlueRiver Services</h1>
    </div>
    <div style="background:#fff;padding:28px 24px;border-radius:0 0 12px 12px;border:1px solid #e2e8f0;border-top:0;">
      <h2 style="margin:0 0 16px;font-size:18px;color:#0f172a;">${esc(title)}</h2>
      ${paragraphs}
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;"/>
      <p style="margin:0;font-size:13px;color:#64748b;">Questions? Reply to this email or contact us at <a href="mailto:info@blueriverservices.co" style="color:#1e40af;">info@blueriverservices.co</a>.</p>
    </div>
    <p style="text-align:center;font-size:12px;color:#94a3b8;margin:16px 0 4px;">© ${new Date().getFullYear()} BlueRiver Services</p>
  </div>
</body></html>`;
};

/** Send a custom branded email through the existing transactional email function. */
export async function sendApplicantEmail(opts: {
  to: string;
  subject: string;
  title?: string;
  message: string;
}) {
  return supabase.functions.invoke("send-transactional-email", {
    body: {
      type: "custom",
      to: opts.to.trim(),
      subject: opts.subject,
      html: wrapBody(opts.title ?? opts.subject, opts.message),
    },
  });
}

/** Auto-acknowledgement sent to an applicant right after they submit. */
export async function sendApplicationAcknowledgement(to: string, firstName: string) {
  const message = `Hi ${firstName || "there"},

Thank you for applying to join the BlueRiver Services cleaning team! We've received your application and our hiring team will review it shortly.

If your experience matches what we're looking for, we'll reach out with the next steps. This usually takes a few business days.

We appreciate your interest in working with us.

— The BlueRiver Services Team`;
  return sendApplicantEmail({
    to,
    subject: "We received your application — BlueRiver Services",
    title: "Application received",
    message,
  });
}

export type DecisionKey =
  | "interview"
  | "shortlisted"
  | "more_info"
  | "hired"
  | "rejected";

/** Which lifecycle stage a decision moves the applicant to. */
export const DECISION_TO_STAGE: Record<DecisionKey, string> = {
  interview: "interview",
  shortlisted: "shortlisted",
  more_info: "reviewing",
  hired: "hired",
  rejected: "rejected",
};

export interface ResponsePreset {
  key: DecisionKey;
  label: string;
  subject: string;
  body: (firstName: string) => string;
}

/** Editable presets shown in the admin response panel. */
export const RESPONSE_PRESETS: ResponsePreset[] = [
  {
    key: "interview",
    label: "Invite to interview",
    subject: "Interview invitation — BlueRiver Services",
    body: (n) => `Hi ${n || "there"},

Thank you for applying to BlueRiver Services. We were impressed with your application and would love to invite you to an interview.

Please reply to this email with a few dates and times that work for you over the next week, and we'll confirm a slot.

We look forward to speaking with you.

— The BlueRiver Services Team`,
  },
  {
    key: "shortlisted",
    label: "Shortlisted",
    subject: "Your application is moving forward — BlueRiver Services",
    body: (n) => `Hi ${n || "there"},

Good news — your application has been shortlisted for our cleaning team. Our hiring team is reviewing the final candidates and we'll be in touch soon with next steps.

Thank you for your patience.

— The BlueRiver Services Team`,
  },
  {
    key: "more_info",
    label: "Request more info",
    subject: "A quick follow-up on your application — BlueRiver Services",
    body: (n) => `Hi ${n || "there"},

Thank you for applying to BlueRiver Services. Before we move forward, we'd like a little more information from you.

Could you please reply to this email with:
- Your availability over the coming weeks
- Any relevant cleaning experience or certifications

Once we have this, we'll continue reviewing your application.

— The BlueRiver Services Team`,
  },
  {
    key: "hired",
    label: "Approved / Hired",
    subject: "Welcome to the team! — BlueRiver Services",
    body: (n) => `Hi ${n || "there"},

Congratulations! We're delighted to offer you a place on the BlueRiver Services cleaning team.

We'll follow up shortly with your onboarding details, paperwork, and your first schedule. If you have any questions in the meantime, just reply to this email.

Welcome aboard!

— The BlueRiver Services Team`,
  },
  {
    key: "rejected",
    label: "Not moving forward",
    subject: "Update on your application — BlueRiver Services",
    body: (n) => `Hi ${n || "there"},

Thank you for taking the time to apply to BlueRiver Services and for your interest in joining our team.

After careful consideration, we've decided not to move forward with your application at this time. This was a difficult decision and it doesn't diminish your skills or experience.

We wish you all the best and encourage you to apply again in the future.

— The BlueRiver Services Team`,
  },
];
