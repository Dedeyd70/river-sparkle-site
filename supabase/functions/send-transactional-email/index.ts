// Resend-powered transactional email sender for BlueRiver Services.
// Public endpoint (no JWT) so booking & quote forms can trigger emails.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const FROM = "BlueRiver Services <info@blueriverservices.co>";
const REPLY_TO = "info@blueriverservices.co";

type Attachment = { filename: string; content: string };

const ADMIN_INBOX = "info@blueriverservices.co";

type Payload = {
  type:
    | "booking_received"      // user — "we got your request"
    | "booking_confirmed"     // user — "your booking is confirmed"
    | "booking_rescheduled"   // user — "your booking has been moved"
    | "booking_confirmation"  // legacy alias of booking_received
    | "quote_received"        // user — "we got your quote"
    | "admin_new_submission"  // admin alert to ADMIN_INBOX
    | "custom";
  to?: string;
  data?: Record<string, unknown>;
  subject?: string;
  html?: string;
  attachments?: Attachment[];
};

// Resend free-tier safety: max 2 attachments, 1MB each, 2MB total.
const MAX_ATTACHMENTS = 2;
const MAX_ATTACHMENT_BYTES = 1 * 1024 * 1024;
const MAX_TOTAL_ATTACHMENT_BYTES = 2 * 1024 * 1024;

function validateAttachments(att: unknown): { ok: true; value: Attachment[] } | { ok: false; error: string } {
  if (att == null) return { ok: true, value: [] };
  if (!Array.isArray(att)) return { ok: false, error: "attachments must be an array" };
  if (att.length > MAX_ATTACHMENTS) return { ok: false, error: `Max ${MAX_ATTACHMENTS} attachments per email` };
  let total = 0;
  for (const a of att) {
    if (!a || typeof a.filename !== "string" || typeof a.content !== "string") {
      return { ok: false, error: "Each attachment needs filename and base64 content" };
    }
    if (!a.filename.toLowerCase().endsWith(".pdf")) {
      return { ok: false, error: "Only .pdf attachments are allowed" };
    }
    // Decoded base64 size = (length * 3/4) - padding. Approximate via length * 0.75.
    const padding = (a.content.match(/=+$/)?.[0]?.length ?? 0);
    const bytes = Math.floor((a.content.length * 3) / 4) - padding;
    if (bytes > MAX_ATTACHMENT_BYTES) {
      return { ok: false, error: `Attachment ${a.filename} exceeds 1MB limit` };
    }
    total += bytes;
  }
  if (total > MAX_TOTAL_ATTACHMENT_BYTES) {
    return { ok: false, error: "Total attachment size exceeds 2MB limit" };
  }
  return { ok: true, value: att as Attachment[] };
}

const esc = (v: unknown) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const wrap = (title: string, inner: string, opts: { address?: string; unsubscribe?: boolean } = {}) => `
<!doctype html><html><body style="margin:0;background:#f4f7fb;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
  <div style="max-width:560px;margin:0 auto;padding:32px 16px;">
    <div style="background:#1e40af;color:#fff;padding:20px 24px;border-radius:12px 12px 0 0;">
      <h1 style="margin:0;font-size:20px;font-weight:600;">BlueRiver Services</h1>
    </div>
    <div style="background:#fff;padding:28px 24px;border-radius:0 0 12px 12px;border:1px solid #e2e8f0;border-top:0;">
      <h2 style="margin:0 0 12px;font-size:18px;color:#0f172a;">${esc(title)}</h2>
      ${inner}
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;"/>
      <p style="margin:0;font-size:13px;color:#64748b;">Questions? Reply to this email or contact us at <a href="mailto:info@blueriverservices.co" style="color:#1e40af;">info@blueriverservices.co</a>.</p>
      ${opts.unsubscribe ? `<p style="margin:12px 0 0;font-size:12px;color:#94a3b8;">Don't want future review or marketing emails? Reply with "UNSUBSCRIBE" and we'll remove you from these messages.</p>` : ""}
    </div>
    <p style="text-align:center;font-size:12px;color:#94a3b8;margin:16px 0 4px;">© ${new Date().getFullYear()} BlueRiver Services</p>
    ${opts.address ? `<p style="text-align:center;font-size:12px;color:#94a3b8;margin:0;">${esc(opts.address)}</p>` : ""}
  </div>
</body></html>`;

const detailRow = (k: string, v: unknown) =>
  v
    ? `<tr><td style="padding:6px 0;color:#64748b;font-size:14px;">${esc(k)}</td><td style="padding:6px 0;color:#0f172a;font-size:14px;font-weight:500;">${esc(v)}</td></tr>`
    : "";

function bookingReceivedTemplate(d: Record<string, unknown>) {
  const inner = `
    <p style="margin:0 0 16px;font-size:15px;line-height:1.5;">Hi ${esc(d.name) || "there"}, <strong>we have received your request</strong>. Our team will review the details and confirm your booking within 24 hours.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
      ${detailRow("Service", d.service)}
      ${detailRow("Requested date", d.date)}
      ${detailRow("Requested time", d.timeSlot)}
      ${detailRow("Address", d.address)}
      ${d.total ? detailRow("Estimated total", `$${Number(d.total).toFixed(2)}`) : ""}
    </table>
    <p style="margin:16px 0 0;font-size:14px;color:#64748b;">You'll get a separate confirmation email once we lock in your slot.</p>`;
  return { subject: "We've received your booking request", html: wrap("Booking received", inner) };
}

function bookingConfirmedTemplate(d: Record<string, unknown>) {
  const inner = `
    <p style="margin:0 0 16px;font-size:15px;line-height:1.5;">Hi ${esc(d.name) || "there"}, great news — <strong>your booking is confirmed</strong>.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
      ${detailRow("Service", d.service)}
      ${detailRow("Date", d.date)}
      ${detailRow("Time", d.timeSlot)}
      ${detailRow("Address", d.address)}
      ${d.total ? detailRow("Estimated total", `$${Number(d.total).toFixed(2)}`) : ""}
    </table>
    <p style="margin:16px 0 0;font-size:14px;color:#64748b;">Need to reschedule or have questions? Just reply to this email.</p>`;
  return { subject: `Your BlueRiver booking is confirmed${d.date ? ` — ${esc(d.date)}` : ""}`, html: wrap("Booking confirmed", inner) };
}

function quoteTemplate(d: Record<string, unknown>) {
  const inner = `
    <p style="margin:0 0 16px;font-size:15px;line-height:1.5;">Hi ${esc(d.name) || "there"}, thanks for requesting a quote from BlueRiver Services. We've got your details and will reply within 24 hours.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
      ${detailRow("Service", d.service)}
      ${detailRow("Address", d.address)}
    </table>`;
  return { subject: "Your BlueRiver quote request", html: wrap("Quote request received", inner) };
}

function bookingRescheduledTemplate(d: Record<string, unknown>) {
  const inner = `
    <p style="margin:0 0 16px;font-size:15px;line-height:1.5;">Hi ${esc(d.name) || "there"}, your cleaning appointment has been <strong>rescheduled</strong>. Here are the updated details.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
      ${d.oldDate || d.oldTimeSlot ? `<tr><td style="padding:6px 0;color:#64748b;font-size:14px;">Was</td><td style="padding:6px 0;color:#0f172a;font-size:14px;">${esc([d.oldDate, d.oldTimeSlot].filter(Boolean).join(" — "))}</td></tr>` : ""}
      ${d.newDate || d.newTimeSlot ? `<tr><td style="padding:6px 0;color:#64748b;font-size:14px;">Now</td><td style="padding:6px 0;color:#0f172a;font-size:14px;font-weight:600;">${esc([d.newDate, d.newTimeSlot].filter(Boolean).join(" — "))}</td></tr>` : ""}
      ${detailRow("Service", d.service)}
      ${detailRow("Address", d.address)}
    </table>
    ${d.reason ? `<p style="margin:16px 0 0;font-size:14px;line-height:1.5;color:#0f172a;"><strong>Note:</strong> ${esc(d.reason)}</p>` : ""}
    <p style="margin:16px 0 0;font-size:13px;line-height:1.5;color:#dc2626;">Please note the time above is for scheduling purposes; our team may coordinate the exact arrival window with you.</p>
    <p style="margin:12px 0 0;font-size:14px;color:#64748b;">Questions or need another change? Just reply to this email.</p>`;
  return { subject: `Your BlueRiver booking has been rescheduled${d.newDate ? ` — ${esc(d.newDate)}` : ""}`, html: wrap("Booking rescheduled", inner) };
}


function adminAlertTemplate(d: Record<string, unknown>) {
  const kind = String(d.kind || "Submission");
  const title = `New ${kind} Request Received - Check Dashboard`;
  const inner = `
    <p style="margin:0 0 16px;font-size:15px;line-height:1.5;">A new <strong>${esc(kind)}</strong> was just submitted on blueriverservices.co.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
      ${detailRow("Customer", d.name)}
      ${detailRow("Email", d.email)}
      ${detailRow("Phone", d.phone)}
      ${detailRow("Service", d.service)}
      ${detailRow("Date", d.date)}
      ${detailRow("Time", d.timeSlot)}
      ${detailRow("Address", d.address)}
      ${detailRow("Message", d.message)}
    </table>
    <p style="margin:16px 0 0;font-size:14px;">${d.dashboardUrl ? `<a href="${esc(d.dashboardUrl)}" style="background:#1e40af;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:600;">Open Admin Dashboard</a>` : "Log in to the admin dashboard to review."}</p>`;
  return { subject: title, html: wrap(title, inner) };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("RESEND_API_KEY");
    if (!apiKey) throw new Error("RESEND_API_KEY not configured");

    const body = (await req.json()) as Payload;
    if (!body?.type) {
      return new Response(JSON.stringify({ error: "Missing 'type'" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let subject = body.subject ?? "";
    let html = body.html ?? "";
    const data = body.data ?? {};
    // admin_new_submission ALWAYS routes to the shared admin inbox.
    const recipient = body.type === "admin_new_submission" ? ADMIN_INBOX : body.to;

    if (!recipient) {
      return new Response(JSON.stringify({ error: "Missing 'to'" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (body.type === "booking_received" || body.type === "booking_confirmation") {
      const t = bookingReceivedTemplate(data);
      subject ||= t.subject;
      html ||= t.html;
    } else if (body.type === "booking_confirmed") {
      const t = bookingConfirmedTemplate(data);
      subject ||= t.subject;
      html ||= t.html;
    } else if (body.type === "booking_rescheduled") {
      const t = bookingRescheduledTemplate(data);
      subject ||= t.subject;
      html ||= t.html;
    } else if (body.type === "quote_received") {
      const t = quoteTemplate(data);
      subject ||= t.subject;
      html ||= t.html;
    } else if (body.type === "admin_new_submission") {
      const t = adminAlertTemplate(data);
      subject ||= t.subject;
      html ||= t.html;
    }

    if (!subject || !html) {
      return new Response(JSON.stringify({ error: "Missing subject/html for custom type" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // CAN-SPAM compliance: append physical mailing address + unsubscribe note.
    try {
      const supaUrl = Deno.env.get("SUPABASE_URL");
      const supaKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY");
      if (supaUrl && supaKey) {
        const r = await fetch(
          `${supaUrl}/rest/v1/site_settings?select=setting_key,setting_value&setting_key=in.(company_address)`,
          { headers: { apikey: supaKey, Authorization: `Bearer ${supaKey}` } },
        );
        const rows = (await r.json()) as Array<{ setting_key: string; setting_value: string }>;
        const address = rows?.find((x) => x.setting_key === "company_address")?.setting_value || "";
        const isMarketing = body.type === "custom" && /review|unsubscribe|marketing/i.test(`${subject} ${html}`);
        const footer = `
          <div style="max-width:560px;margin:16px auto 0;padding:0 16px;text-align:center;font-size:12px;color:#94a3b8;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
            ${address ? `<p style="margin:0 0 4px;">BlueRiver Services · ${esc(address)}</p>` : ""}
            ${isMarketing ? `<p style="margin:0;">Don't want future review or marketing emails? Reply <strong>UNSUBSCRIBE</strong> and we'll remove you.</p>` : ""}
          </div>`;
        if (/<\/body>/i.test(html)) {
          html = html.replace(/<\/body>/i, `${footer}</body>`);
        } else {
          html = `${html}${footer}`;
        }
      }
    } catch (e) {
      console.warn("CAN-SPAM footer injection failed:", e);
    }


    const attCheck = validateAttachments(body.attachments);
    if (!attCheck.ok) {
      console.error("Attachment validation failed:", attCheck.error);
      return new Response(JSON.stringify({ error: attCheck.error }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resendBody: Record<string, unknown> = {
      from: FROM,
      to: [recipient],
      reply_to: REPLY_TO,
      subject,
      html,
    };
    if (attCheck.value.length > 0) {
      resendBody.attachments = attCheck.value.map((a) => ({
        filename: a.filename,
        content: a.content,
      }));
    }

    console.log("[send-transactional-email]", body.type, "->", recipient, "subject:", subject);

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(resendBody),
    });

    const result = await res.json();
    if (!res.ok) {
      console.error("Resend error:", res.status, result);
      return new Response(JSON.stringify({ error: result }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ id: result?.id ?? null }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("send-transactional-email failed:", err);
    return new Response(JSON.stringify({ error: String(err?.message ?? err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
