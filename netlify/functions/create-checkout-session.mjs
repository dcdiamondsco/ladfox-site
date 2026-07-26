import Stripe from "stripe";
import { validateAndPrice } from "./pricing.mjs";

const stripeKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeKey ? new Stripe(stripeKey) : null;

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  }
});

const cleanMetadata = (value, maxLength = 450) => String(value ?? "").trim().slice(0, maxLength);

export default async (request) => {
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
  if (!stripe) return json({ error: "Stripe has not been configured on Netlify yet." }, 503);

  try {
    const body = await request.json();
    const priced = validateAndPrice(body?.selections);
    const attribution = body?.attribution && typeof body.attribution === "object" ? body.attribution : {};
    const origin = process.env.SITE_URL || new URL(request.url).origin;

    const orderReference = `LFX-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
    const metadataValues = {
      order_reference: orderReference,
      product: "Signature Petal Collection",
      metal: cleanMetadata(priced.selections.metal),
      stone_type: cleanMetadata(priced.selections.stoneType),
      shape: cleanMetadata(priced.selections.shape),
      elongated: cleanMetadata(priced.selections.elongated),
      gemstone: cleanMetadata(priced.selections.gemstone),
      stone_size: cleanMetadata(priced.selections.stoneSize),
      colour: cleanMetadata(priced.selections.colour),
      clarity: cleanMetadata(priced.selections.clarity),
      ring_size: cleanMetadata(priced.selections.ringSize),
      quoted_price_gbp: String(priced.priceGbp)
    };

    for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid", "gbraid", "wbraid"]) {
      if (attribution[key]) metadataValues[key] = cleanMetadata(attribution[key], 200);
    }

    const metadata = Object.fromEntries(
      Object.entries(metadataValues).filter(([, value]) => value !== "")
    );

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      locale: "en-GB",
      client_reference_id: orderReference,
      customer_creation: "always",
      billing_address_collection: "required",
      phone_number_collection: { enabled: true },
      shipping_address_collection: { allowed_countries: ["GB"] },
      success_url: `${origin}/checkout-success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/signature-collection.html?checkout=cancelled`,
      line_items: [{
        quantity: 1,
        price_data: {
          currency: "gbp",
          unit_amount: priced.unitAmount,
          product_data: {
            name: "LADFOX Signature Petal Collection",
            description: priced.description,
            metadata
          }
        }
      }],
      metadata,
      payment_intent_data: { metadata },
      custom_text: {
        submit: {
          message: "Your ring will be made to the specification shown above. LADFOX will contact you to confirm the production details."
        }
      }
    });

    return json({ url: session.url });
  } catch (error) {
    console.error("Checkout session error", error);
    const message = error instanceof Error ? error.message : "Checkout could not be started.";
    return json({ error: message }, 400);
  }
};
