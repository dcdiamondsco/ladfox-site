import Stripe from "stripe";
import { PRODUCT, validateAndPrice } from "./pricing.mjs";
import { cleanMetadata, getSiteUrl, json, readJsonBody } from "./http.mjs";

const getStripe = () => {
  const key = String(process.env.STRIPE_SECRET_KEY || "").trim();
  return key ? new Stripe(key) : null;
};

const validRequestId = (value) => /^[A-Za-z0-9_-]{12,100}$/.test(String(value || ""));

export default async (request) => {
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405, { Allow: "POST" });

  const stripe = getStripe();
  if (!stripe) return json({ error: "Secure checkout is temporarily unavailable." }, 503);

  try {
    const body = await readJsonBody(request);
    const priced = validateAndPrice(body?.selections);
    if (!priced.checkoutAllowed || !priced.unitAmount) {
      return json({ error: priced.customerMessage, quoteRequired: true }, 409);
    }

    const requestId = cleanMetadata(body?.requestId, 100);
    if (!validRequestId(requestId)) throw new Error("Invalid checkout request.");

    const attribution = body?.attribution && typeof body.attribution === "object" ? body.attribution : {};
    const siteUrl = getSiteUrl(request);
    const orderReference = `LFX-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;

    const metadataValues = {
      order_reference: orderReference,
      product_slug: PRODUCT.slug,
      product: PRODUCT.name,
      price_version: priced.priceVersion,
      metal: priced.selections.metal,
      stone_type: priced.selections.stoneType,
      shape: priced.selections.shape,
      elongated: priced.selections.elongated,
      stone_size: priced.selections.stoneSize,
      gemstone: priced.selections.gemstone,
      colour: priced.selections.colour,
      clarity: priced.selections.clarity,
      ring_size: priced.selections.ringSize,
      charged_price_gbp: String(priced.priceGbp),
      regular_price_gbp: String(priced.regularPriceGbp),
      sale_active: String(priced.saleActive),
      sale_ends_at: priced.saleEndsAt
    };

    for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid", "gbraid", "wbraid"]) {
      if (attribution[key]) metadataValues[key] = cleanMetadata(attribution[key], 200);
    }

    const metadata = Object.fromEntries(
      Object.entries(metadataValues)
        .map(([key, value]) => [key, cleanMetadata(value)])
        .filter(([, value]) => value !== "")
    );

    const productImage = new URL(priced.imagePath, `${siteUrl}/`).href;
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      locale: "en-GB",
      submit_type: "pay",
      client_reference_id: orderReference,
      customer_creation: "always",
      billing_address_collection: "required",
      phone_number_collection: { enabled: true },
      shipping_address_collection: { allowed_countries: ["GB"] },
      success_url: `${siteUrl}/checkout-success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/signature-collection.html?checkout=cancelled`,
      line_items: [{
        quantity: 1,
        price_data: {
          currency: PRODUCT.currency,
          unit_amount: priced.unitAmount,
          product_data: {
            name: PRODUCT.name,
            description: `${priced.description}${priced.saleActive ? " · 20% sale price" : ""}`,
            images: [productImage],
            metadata
          }
        }
      }],
      metadata,
      payment_intent_data: { metadata },
      custom_text: {
        submit: {
          message: "Your made-to-order ring specification and total are shown above. LADFOX will contact you before manufacture begins."
        }
      }
    }, {
      idempotencyKey: `ladfox-${requestId}`
    });

    if (!session.url) throw new Error("Stripe did not return a checkout URL.");

    return json({
      url: session.url,
      sessionId: session.id,
      orderReference,
      priceGbp: priced.priceGbp
    });
  } catch (error) {
    console.error("create-checkout-session failed", error);
    const isCustomerError = error instanceof Error && /^(Invalid|Centre stone|Request)/.test(error.message);
    return json({
      error: isCustomerError ? error.message : "Secure checkout could not be started. Please try again or contact LADFOX."
    }, isCustomerError ? 400 : 500);
  }
};
