# LADFOX live Stripe checkout — 20% sale update

Copy the contents of this package into the root of the GitHub repository connected to Netlify. Replace matching files and merge the `netlify/functions` folder.

## Included changes

- The existing LADFOX prices are restored as the live **20% sale prices**.
- The crossed-out regular price is calculated so the saving is genuinely 20%.
- The countdown ends at `2026-08-03T00:00:00+01:00`, which is midnight immediately after Sunday 2 August 2026 in the UK.
- Stripe and the on-page quote function enforce the same deadline server-side.
- Lab gemstones use the restored fixed price table and go directly to secure Stripe checkout.
- The gemstone enquiry and enquiry thank-you pages have been removed.
- All selections are validated and priced inside Netlify Functions before Stripe can charge the customer.

## Netlify environment variables

Create these with Functions/Runtime access:

- `STRIPE_SECRET_KEY`
  - Production: `sk_live_...`
  - Deploy previews and branch deploys: `sk_test_...`
- `STRIPE_WEBHOOK_SECRET`
  - Production: live webhook signing secret
  - Preview/test contexts: test webhook signing secret
- `SITE_URL`
  - Production: `https://ladfox.com`

Do not place secret keys in HTML, GitHub or `.env.example`.

## Stripe webhook

Endpoint:

`https://ladfox.com/.netlify/functions/stripe-webhook`

Events:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`

## Pricing

Edit prices only in:

`netlify/functions/pricing.mjs`

The current fixed lab-gemstone prices have been restored exactly from the supplied configurator. Check supplier cost, VAT, manufacture, delivery, Stripe fees and margin before promoting the page.

## Deploy

1. Copy all files into the main website folder.
2. Merge the included `netlify/functions` files into the existing `netlify/functions` folder.
3. Commit and push to GitHub.
4. Trigger a fresh Netlify production deploy.
5. Test one configuration for a lab diamond and one for a lab gemstone.
6. Confirm Stripe shows the same price and specification as the website.

Run `npm test` to check the server-side pricing rules.
