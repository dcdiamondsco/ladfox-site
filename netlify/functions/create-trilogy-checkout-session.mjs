import Stripe from "stripe";
import { cleanMetadata, getSiteUrl, json, readJsonBody } from "./http.mjs";

const PRODUCT = Object.freeze({
  slug: "our-trilogy-ring",
  name: "Our Trilogy Ring",
  currency: "gbp",
  imagePath: "Images/trilogy.png"
});

const SALE_ENDS_AT = "2026-08-03T00:00:00+01:00";
const VALID_REQUEST_ID = /^[A-Za-z0-9_-]{12,100}$/;
const ALLOWED = Object.freeze({
  metals: new Set(["14k Yellow Gold", "18k Yellow Gold", "14k White Gold", "18k White Gold", "14k Rose Gold", "18k Rose Gold", "Platinum"]),
  colours: new Set(["D", "E", "F", "G"]),
  clarities: new Set(["SI1", "VS2", "VS1", "VVS2", "VVS1", "FL"]),
  ringSizes: new Set(["J", "J 1/2", "K", "K 1/2", "L", "L 1/2", "M", "M 1/2", "N", "N 1/2", "O", "O 1/2", "P", "P 1/2", "Q"]),
  shapes: new Set(["Round"])
});

const getStripe = () => {
  const key = String(process.env.STRIPE_SECRET_KEY || "").trim();
  return key ? new Stripe(key) : null;
};

const cleanText = (value, maxLength = 120) => String(value ?? "").trim().slice(0, maxLength);
const requireAllowed = (value, allowed, fieldName) => {
  const cleaned = cleanText(value);
  if (!allowed.has(cleaned)) throw new Error(`Invalid ${fieldName}.`);
  return cleaned;
};

const parseCarat = (value) => {
  const numeric = Number.parseFloat(String(value ?? "").replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(numeric) || numeric < 0.5 || numeric > 6) {
    throw new Error("Centre stone size must be between 0.5 ct and 6.0 ct.");
  }
  const rounded = Math.round(numeric * 10) / 10;
  if (Math.abs(numeric - rounded) > 0.0001) throw new Error("Centre stone size must use 0.1 ct increments.");
  return rounded;
};

const sizeMultiplier = (size) => {
  if (size <= 1.0) return 1;
  if (size <= 1.2) return 1.05;
  if (size <= 1.5) return 1.12;
  if (size <= 1.8) return 1.22;
  if (size <= 2.2) return 1.339;
  if (size <= 2.5) return 1.48;
  if (size <= 3.0) return 1.68;
  if (size <= 3.5) return 1.92;
  if (size <= 4.0) return 2.2;
  if (size <= 4.5) return 2.54;
  return 2.9;
};

const clarityMultiplierMap = Object.freeze({
  SI1: 1,
  VS2: 1.03,
  VS1: 1.06,
  VVS2: 1.09,
  VVS1: 1.12,
  FL: 1.18
});

const colourAdjustmentMap = Object.freeze({
  D: 0,
  E: -60,
  F: -120,
  G: -220
});

const metalAdjustmentMap = Object.freeze({
  "14k Yellow Gold": -120,
  "18k Yellow Gold": 0,
  "14k White Gold": -40,
  "18k White Gold": 80,
  "14k Rose Gold": -40,
  "18k Rose Gold": 80,
  Platinum: 220
});

const validateSelections = (raw = {}) => {
  const metal = requireAllowed(raw.metal, ALLOWED.metals, "metal");
  const shape = requireAllowed(raw.shape || "Round", ALLOWED.shapes, "shape");
  const clarity = requireAllowed(raw.clarity, ALLOWED.clarities, "clarity");
  const colour = requireAllowed(raw.colour, ALLOWED.colours, "colour");
  const ringSize = requireAllowed(raw.ringSize || raw.ring_size, ALLOWED.ringSizes, "ring size");
  const carat = parseCarat(raw.stoneSize || raw.stone_size);

  return {
    metal,
    shape,
    clarity,
    colour,
    ringSize,
    carat,
    stoneSize: `${carat.toFixed(1)} ct`
  };
};

const priceSelections = (selections) => {
  const rawPrice = (1999 * sizeMultiplier(selections.carat) * clarityMultiplierMap[selections.clarity])
    + colourAdjustmentMap[selections.colour]
    + metalAdjustmentMap[selections.metal];
  const salePriceGbp = Math.max(1999, Math.round(rawPrice));
  const regularPriceGbp = Math.round(salePriceGbp * 1.2);

  return {
    ...selections,
    salePriceGbp,
    regularPriceGbp,
    priceGbp: salePriceGbp,
    saleEndsAt: SALE_ENDS_AT,
    description: `${selections.metal} trilogy ring with a ${selections.stoneSize} round lab-grown diamond, ${selections.colour} colour, ${selections.clarity} clarity, UK size ${selections.ringSize}.`
  };
};

export default async (request) => {
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405, { Allow: "POST" });

  const stripe = getStripe();
  if (!stripe) return json({ error: "Secure checkout is temporarily unavailable." }, 503);

  try {
    const body = await readJsonBody(request);
    const selections = validateSelections(body?.selections);
    const priced = priceSelections(selections);

    const requestId = cleanMetadata(body?.requestId, 100);
    if (!VALID_REQUEST_ID.test(requestId)) throw new Error("Invalid checkout request.");

    const siteUrl = getSiteUrl(request);
    const orderReference = `LFX-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
    const metadata = Object.fromEntries(
      Object.entries({
        order_reference: orderReference,
        product_slug: PRODUCT.slug,
        product: PRODUCT.name,
        metal: priced.metal,
        shape: priced.shape,
        stone_size: priced.stoneSize,
        colour: priced.colour,
        clarity: priced.clarity,
        ring_size: priced.ringSize,
        charged_price_gbp: String(priced.priceGbp),
        regular_price_gbp: String(priced.regularPriceGbp),
        sale_ends_at: priced.saleEndsAt
      }).map(([key, value]) => [key, cleanMetadata(value)]).filter(([, value]) => value !== "")
    );

    const productImage = new URL(PRODUCT.imagePath, `${siteUrl}/`).href;
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
      cancel_url: `${siteUrl}/trilogy-ring.html?checkout=cancelled`,
      line_items: [{
        quantity: 1,
        price_data: {
          currency: PRODUCT.currency,
          unit_amount: priced.priceGbp * 100,
          product_data: {
            name: PRODUCT.name,
            description: priced.description,
            images: [productImage],
            metadata
          }
        }
      }],
      metadata,
      payment_intent_data: { metadata },
      custom_text: {
        submit: {
          message: "Your trilogy ring specification and total are shown above. LADFOX will contact you before manufacture begins."
        }
      }
    }, {
      idempotencyKey: `ladfox-trilogy-${requestId}`
    });

    if (!session.url) throw new Error("Stripe did not return a checkout URL.");

    return json({
      url: session.url,
      sessionId: session.id,
      orderReference,
      priceGbp: priced.priceGbp
    });
  } catch (error) {
    console.error("create-trilogy-checkout-session failed", error);
    const isCustomerError = error instanceof Error && /^(Invalid|Centre stone|Request)/.test(error.message);
    return json({
      error: isCustomerError ? error.message : "Secure checkout could not be started. Please try again or contact LADFOX."
    }, isCustomerError ? 400 : 500);
  }
};
