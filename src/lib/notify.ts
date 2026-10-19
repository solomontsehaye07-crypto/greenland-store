/** Email via Resend REST API (no SDK needed). Returns false when not configured. */
export async function sendEmail(opts: {
  to: string | string[];
  subject: string;
  html: string;
  attachments?: { filename: string; content: Uint8Array }[];
  replyTo?: string;
}) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, error: "RESEND_API_KEY not set" };
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM ?? "Greenland Afro Asia Store <onboarding@resend.dev>",
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      reply_to: opts.replyTo,
      attachments: opts.attachments?.map((a) => ({ filename: a.filename, content: Buffer.from(a.content).toString("base64") })),
    }),
  });
  if (!r.ok) return { ok: false, error: await r.text() };
  return { ok: true };
}

/** Normalises German numbers like 0152 1234567 → 491521234567 */
export function waNumber(raw: string) {
  let n = raw.replace(/[^\d+]/g, "");
  if (n.startsWith("+")) n = n.slice(1);
  else if (n.startsWith("00")) n = n.slice(2);
  else if (n.startsWith("0")) n = "49" + n.slice(1);
  return n;
}

/** Click-to-chat link with a prefilled message (works without any API account). */
export const waLink = (phone: string, message: string) => `https://wa.me/${waNumber(phone)}?text=${encodeURIComponent(message)}`;

/**
 * Sends a PDF document through the WhatsApp Cloud API when WHATSAPP_TOKEN is configured.
 * Note: outside a 24h customer-service window Meta requires an approved template message first.
 */
export async function sendWhatsAppDocument(phone: string, pdfUrl: string, filename: string, caption: string) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneId) return { ok: false, error: "WhatsApp Cloud API not configured" };
  const r = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: waNumber(phone),
      type: "document",
      document: { link: pdfUrl, filename, caption },
    }),
  });
  if (!r.ok) return { ok: false, error: await r.text() };
  return { ok: true };
}
