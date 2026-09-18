import Stripe from "stripe";
import { cleanMetadata, getSiteUrl, json, readJsonBody } from "./http.mjs";

const PRODUCT = Object.freeze({
  slug: "bespoke-ring-cad-service",
  name: "Bespoke Ring CAD Service",
  priceGbp: 149,
  currency: "gbp",
  imagePath: "Images/jamie cad.jpeg"
});
const VALID_REQUEST_ID = /^[A-Za-z0-9_-]{12,100}$/;

const getStripe = () => {
  const key = String(process.env.STRIPE_SECRET_KEY || "").trim();
  return key ? new Stripe(key) : null;
};

export default async (request) => {
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405, { Allow: "POST" });
  const stripe = getStripe();
  if (!stripe) return json({ error: "Secure checkout is temporarily unavailable." }, 503);

  try {
    const body = await readJsonBody(request);
    const requestId = cleanMetadata(body?.requestId, 100);
    if (!VALID_REQUEST_ID.test(requestId)) throw new Error("Invalid checkout request.");

    const siteUrl = getSiteUrl(request);
    const orderReference = `LFX-CAD-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
    const metadata = {
      order_reference: orderReference,
      product_slug: PRODUCT.slug,
      product: PRODUCT.name,
      charged_price_gbp: String(PRODUCT.priceGbp),
      service_description: "Bespoke ring CAD design; fee credited toward a LADFOX ring order."
    };

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      locale: "en-GB",
      submit_type: "pay",
      client_reference_id: orderReference,
      customer_creation: "always",
      billing_address_collection: "required",
      phone_number_collection: { enabled: true },
      success_url: `${siteUrl}/checkout-success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/cad-design?checkout=cancelled`,
      line_items: [{
        quantity: 1,
        price_data: {
          currency: PRODUCT.currency,
          unit_amount: PRODUCT.priceGbp * 100,
          product_data: {
            name: PRODUCT.name,
            description: "A bespoke ring CAD design. The £149 fee is deducted from the final ring total if you proceed with LADFOX.",
            images: [new URL(PRODUCT.imagePath, `${siteUrl}/`).href],
            metadata
          }
        }
      }],
      metadata,
      payment_intent_data: { metadata },
      custom_text: {
        submit: { message: "After payment, LADFOX will contact you to collect your ring brief and reference material." }
      }
    }, { idempotencyKey: `ladfox-cad-${requestId}` });

    if (!session.url) throw new Error("Stripe did not return a checkout URL.");
    return json({ url: session.url, sessionId: session.id, orderReference, priceGbp: PRODUCT.priceGbp });
  } catch (error) {
    console.error("create-cad-checkout-session failed", error);
    const isCustomerError = error instanceof Error && /^(Invalid|Request)/.test(error.message);
    return json({ error: isCustomerError ? error.message : "Secure checkout could not be started. Please try again or contact LADFOX." }, isCustomerError ? 400 : 500);
  }
};
