import Stripe from "stripe";
import { PRODUCT } from "./pricing.mjs";
import { json } from "./http.mjs";

const getStripe = () => {
  const key = String(process.env.STRIPE_SECRET_KEY || "").trim();
  return key ? new Stripe(key) : null;
};

export default async (request) => {
  if (request.method !== "GET") return json({ error: "Method not allowed." }, 405, { Allow: "GET" });

  const stripe = getStripe();
  if (!stripe) return json({ error: "Payment verification is temporarily unavailable." }, 503);

  const sessionId = new URL(request.url).searchParams.get("session_id") || "";
  if (!/^cs_(test|live)_[A-Za-z0-9]+$/.test(sessionId)) {
    return json({ error: "Invalid checkout reference." }, 400);
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.metadata?.product_slug !== PRODUCT.slug) {
      return json({ error: "This checkout does not belong to the requested product." }, 404);
    }

    const paid = session.payment_status === "paid" || session.payment_status === "no_payment_required";
    return json({
      paid,
      status: session.status,
      paymentStatus: session.payment_status,
      orderReference: session.metadata?.order_reference || session.client_reference_id || "",
      amountTotal: session.amount_total,
      currency: session.currency,
      customerEmail: session.customer_details?.email || "",
      description: session.metadata ? [
        session.metadata.metal,
        session.metadata.stone_size,
        session.metadata.elongated === "Yes" ? `Elongated ${session.metadata.shape}` : session.metadata.shape,
        session.metadata.colour ? `${session.metadata.colour} / ${session.metadata.clarity}` : session.metadata.gemstone,
        session.metadata.ring_size ? `UK size ${session.metadata.ring_size}` : ""
      ].filter(Boolean).join(" · ") : ""
    });
  } catch (error) {
    console.error("get-checkout-session failed", error);
    return json({ error: "We could not verify this payment yet." }, 404);
  }
};
