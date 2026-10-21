# Greenland Afro Asia Store

The online shop and back office for Greenland Afro Asia Store in Kaiserslautern. It is built with Next.js 15 and Supabase and is hosted on Cloudflare Workers.

## What it does

**Storefront**
- Three departments, Food, Beauty and Home & Deco, with 25 categories underneath.
- Product search.
- Product pages showing the price per kg or litre, which German law requires.
- A cart and a checkout.

**Payments**
- **Stripe** for cards, Apple Pay, Google Pay, Klarna and SEPA, depending on what you enable in your Stripe account.
- **PayPal**.
- **Viva Wallet**.
- **Cash or card at pickup or local delivery.**

A payment method only shows up at checkout once its keys are set.

**Shipping**
- DHL standard: 5.99 €, free from 69 €.
- EU delivery.
- Frozen express: 19.99 €, minimum order 50 €. Frozen items can't go by standard parcel.
- Local delivery by postcode.
- Pickup in the shop.
- Dropshipping: products marked as dropship are sent to their supplier as a dropship order once the customer has paid.

**Inventory**
- Every stock change is recorded as a movement, so there is a full history per product.
- Deliveries are stored as batches with a best-before date, and the oldest batch is sold first.
- Each product has a reorder point. The daily check creates low-stock and expiry alerts.

**Suppliers and refill orders**
- Draft refill orders are created automatically for each supplier.
- A PDF is generated for each order, and you can:
  - send it by **email** with the PDF attached, or
  - send it on **WhatsApp**: through the Cloud API if it's set up, otherwise WhatsApp opens with the message and PDF link already filled in.
- When the goods arrive, you book them into stock as a batch.

**Batch import**
- Upload a CSV or Excel file for products, stock counts or deliveries, price lists, or supplier price lists.
- You match the columns and see a preview before anything is saved.

## Deploy on Cloudflare (about 10 minutes)

The shop runs as a Cloudflare Worker, built with OpenNext (`@opennextjs/cloudflare`).

1. In Cloudflare go to **Workers & Pages → Create → Import a repository** and choose `solomontsehaye07-crypto/greenland-store`, branch `main`.
2. Build settings:
   - Build command: `npx opennextjs-cloudflare build`
   - Deploy command: `npx wrangler deploy`
3. Deploy once. Cloudflare gives the shop an address like `https://greenland-store.<your-subdomain>.workers.dev`.
4. In the Worker go to **Settings → Variables and Secrets** and add:
   - `SITE_URL` (text): the shop address from step 3, later your own domain
   - `SUPABASE_SERVICE_ROLE_KEY` (secret): in Supabase, Project Settings → API Keys → secret key
   - `CRON_SECRET` (secret): any long random string
   Then redeploy (Deployments → Retry, or push to `main`).
5. In Supabase go to **Authentication → URL Configuration** and add `https://<your-shop-address>/admin/auth/callback` to the redirect URLs.
6. Open `/admin/login` and sign in with **solomon.tsehaye07@gmail.com**. Leave the password empty to get a magic link by email. That account becomes admin automatically.

The daily stock and expiry check runs at 06:00 UTC through the cron trigger in `wrangler.jsonc`. Every push to `main` deploys automatically.

To use your own domain, open the Worker → **Settings → Domains & Routes → Add → Custom domain**, then update `SITE_URL` and the Supabase redirect URL.

Local test on the Cloudflare runtime: `npm run preview`.

### Payment setup (add these as secrets in Cloudflare)
- **Stripe:** add `STRIPE_SECRET_KEY`. Then create a webhook pointing to `https://<site>/api/webhooks/stripe` for the events `checkout.session.completed` and `checkout.session.async_payment_succeeded`, and add its secret as `STRIPE_WEBHOOK_SECRET`.
- **PayPal:** add `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET`, and set `PAYPAL_ENV=live` when you go live.
- **Viva Wallet:** add `VIVA_CLIENT_ID`, `VIVA_CLIENT_SECRET` and `VIVA_SOURCE_CODE`. In Viva, set the payment source's Success URL to `https://<site>/api/payments/viva/return`.
- **Email:** add `RESEND_API_KEY` and `EMAIL_FROM` (the sending domain must be verified in Resend), plus `ALERT_EMAIL_TO` for stock alerts and new-order notifications.

## Database
The migrations are in `supabase/migrations/` and have already been applied to the Supabase project `greenland-store` (prtstuzxigbntxoaoqkm, Frankfurt).

What's in it now:
- 786 active products, priced to match SellDone.
- 10 units of placeholder stock per product. Replace this with real counts using **Batch import → Stock counts**.
- The 5 hidden products (tobacco and unusable entries) are kept but don't show in the shop.

Things to know:
- Product images are linked from SellDone's image server (cdn.selldone.com).
- Supabase free projects pause after about a week without traffic. Upgrade to Pro before you rely on this store.

## Before going live
- Fill in the `[brackets]` on the legal pages (`src/app/(shop)/legal/[page]/page.tsx`): Impressum, AGB and Datenschutz. Have them checked by a legal service.
- Fill in the store details under Admin → Settings. These appear on the refill-order PDFs.
- Drinks in cans and single-use bottles need the 0.25 € Pfand (deposit) shown and charged separately.

## Adding a table

From 30 Oct 2026 Supabase no longer gives new tables in `public` access through the Data API (supabase-js) on its own.
Every migration that creates a table must therefore also grant access, or the shop gets "permission denied":

```sql
alter table public.your_table enable row level security;  -- plus the policies the table needs
grant select on public.your_table to anon;                                   -- only if the public site reads it
grant select, insert, update, delete on public.your_table to authenticated;
grant select, insert, update, delete on public.your_table to service_role;
```

Existing tables are covered by `0011_explicit_api_grants.sql`.
