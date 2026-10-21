# Email setup (Resend + greenland-afroasia.de)

Prepared on 21 Oct 2026. The domain is registered in Resend (region eu-west-1) but **not verified yet**.
Finish these steps once; afterwards customer sign-in codes, order confirmations and invoices go out from your own address.

## 1. DNS records at Porkbun (greenland-afroasia.de → DNS)

| Type  | Name (host)          | Value                                                                                                                                                                                                                                                  | Priority |
|-------|----------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|----------|
| TXT   | `resend._domainkey`  | `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDAqtRW8XlHIp73+AIbPbzLxM6Y8nGz4ARsXWlIr3VvzKmy1OFWVgDmV1xGQykaCmx/Tr//RHu3edTW/vbt9FJEIsfIQt8+gFO3cryeNX//d2QIi7vRsfbc32GGWADJEKp49tavmDBpZ0p27IR0jsqToGOuB3OAid3FKYSG4JBlBQIDAQAB` | –        |
| MX    | `send`               | `feedback-smtp.eu-west-1.amazonses.com`                                                                                                                                                                                                                | 10       |
| TXT   | `send`               | `v=spf1 include:amazonses.com ~all`                                                                                                                                                                                                                    | –        |
| CNAME | `rsend`              | `send.forge.rmta.net`                                                                                                                                                                                                                                  | –        |

(The Porkbun API key saved in the connector is no longer valid, so these must be added by hand — or give the connector a new key and Claude adds them.)

## 2. Verify in Resend
Resend → Domains → greenland-afroasia.de → **Verify**. Takes a few minutes after the DNS records exist.

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
