# LADFOX Stripe Checkout starter

This package turns the Signature Petal Collection button into a secure Stripe-hosted checkout.

## What is protected

The browser sends ring selections only. `netlify/functions/pricing.mjs` validates every selection and recalculates the price. A price sent by the customer is never trusted.

## Install

1. Copy these files into the root of the LADFOX GitHub/Netlify project. Merge the `netlify/functions` folder if it already exists.
2. Replace the live `signature-collection.html` with the supplied version.
3. Run `npm install` locally, then commit `package.json` and the generated `package-lock.json` before pushing to GitHub.
4. In Netlify: **Site configuration → Environment variables**, add:
   - `STRIPE_SECRET_KEY` using a Stripe test secret key beginning `sk_test_`
   - `SITE_URL` as `https://ladfox.com`
5. Deploy the site.
6. In Stripe test mode, add a webhook endpoint:
   `https://ladfox.com/.netlify/functions/stripe-webhook`
7. Subscribe it to:
   - `checkout.session.completed`
   - `checkout.session.async_payment_succeeded`
   - `checkout.session.async_payment_failed`
8. Copy the webhook signing secret beginning `whsec_` into Netlify as `STRIPE_WEBHOOK_SECRET`, then redeploy.
9. Test checkout using Stripe's test card `4242 4242 4242 4242`, any future expiry and any CVC.
10. Check the payment in Stripe. The complete ring specification is stored in the Checkout Session and PaymentIntent metadata.

## Before switching to live mode

- Verify every value in `netlify/functions/pricing.mjs` against supplier cost, VAT, Stripe fees, delivery, resizing allowance and required margin.
- Replace the test secret key and test webhook secret with their live equivalents.
- Create the webhook again in Stripe live mode.
- Make one low-value live test order and refund it.

## Important

The webhook currently writes paid-order details to Netlify Function logs. Stripe remains the source of truth. The next stage should send successful orders automatically to your preferred order system or email inbox.
