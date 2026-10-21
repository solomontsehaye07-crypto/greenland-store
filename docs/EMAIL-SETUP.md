# Email setup (Resend + greenland-afroasia.de)

Prepared on 21 Oct 2026. The domain is registered in Resend (region eu-west-1) but **not verified yet**.
Finish these steps once; afterwards customer sign-in codes, order confirmations and invoices go out from your own address.

## 1. DNS — done (21 Oct 2026)

DNS for greenland-afroasia.de is now hosted on **Cloudflare** (zone in the same account as the store; nameservers
`elsa.ns.cloudflare.com` / `mark.ns.cloudflare.com`, set at Porkbun). The zone holds:

- Worker custom domains `greenland-afroasia.de` and `www.greenland-afroasia.de` → the store.
- The Resend records (DKIM `resend._domainkey`, MX + SPF on `send`, CNAME `rsend`) and `_dmarc` (`v=DMARC1; p=none;`).
- The old A2 Hosting records (`mail`, `webmail`, `cpanel`, …, MX → `mail.greenland-afroasia.de`, DNS only) kept for a future mailbox.

## 2. Verify in Resend
Resend → Domains → greenland-afroasia.de → **Verify** (Claude triggered it; if it shows "failed", press Verify again once the nameserver change has spread — up to 48 h).

## 3. API key for the shop
Resend → API Keys → Create ("greenland-store", Sending access). Paste it in **Admin → Account & receipts → Email**,
sender e.g. `Greenland Afro Asia Store <bestellung@greenland-afroasia.de>`. Never commit the key anywhere.

## 4. Sign-in codes (Supabase Auth)
Supabase → Project → Authentication → SMTP Settings → enable custom SMTP:
- Host `smtp.resend.com`, port `465`, user `resend`, password = the same API key
- Sender `login@greenland-afroasia.de`, name "Greenland Afro Asia Store"
Without this, Supabase's built-in mailer only sends a handful of codes per hour.

## 5. Optional
Add a DMARC record so Gmail/Outlook trust the mails: TXT `_dmarc` = `v=DMARC1; p=none; rua=mailto:postmaster@greenland-afroasia.de`.
