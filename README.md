# Greenland Afro Asia Store

The online shop and back office for Greenland Afro Asia Store in Kaiserslautern. It is built with Next.js 15 and Supabase and is hosted on Vercel.

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

## Deploy (about 10 minutes)

1. Go to **Vercel → Add New → Project → Import** and choose `solomontsehaye07-crypto/greenland-store`. Keep the framework as Next.js.
2. Add the environment variables from `.env.example`. The minimum is:
   - `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (copy them from `.env.example`)
   - `SUPABASE_SERVICE_ROLE_KEY` (in Supabase: Project Settings → API Keys → secret key)
   - `NEXT_PUBLIC_SITE_URL` (your Vercel URL or domain)
   - `CRON_SECRET` (any long random string)
3. Click Deploy.
4. In Supabase, go to **Authentication → URL Configuration** and add `https://<your-site>/admin/auth/callback` to the redirect URLs.
5. Open `/admin/login` and sign in with **solomon.tsehaye07@gmail.com**. Leave the password empty to get a magic link by email. That account becomes admin automatically.

### Payment setup
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
