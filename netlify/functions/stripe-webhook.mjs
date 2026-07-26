import Stripe from "stripe";
import { PRODUCT } from "./pricing.mjs";
import { json } from "./http.mjs";

const getStripe = () => {
  const key = String(process.env.STRIPE_SECRET_KEY || "").trim();
  return key ? new Stripe(key) : null;
};

const buildOrderPayload = (session, eventId) => ({
  eventId,
  stripeSessionId: session.id,
  orderReference: session.metadata?.order_reference || session.client_reference_id || "",
  amountTotal: session.amount_total,
  currency: session.currency,
  paymentStatus: session.payment_status,
  customer: {
    name: session.customer_details?.name || "",
    email: session.customer_details?.email || "",
    phone: session.customer_details?.phone || ""
  },
  shipping: session.collected_information?.shipping_details || session.shipping_details || null,
  metadata: session.metadata || {}
});

const notifyExternalOrderSystem = async (payload) => {
  const endpoint = String(process.env.ORDER_NOTIFICATION_WEBHOOK_URL || "").trim();
  if (!endpoint) return;

  const headers = { "Content-Type": "application/json" };
  const token = String(process.env.ORDER_NOTIFICATION_TOKEN || "").trim();
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(payload)
  });

  if (!response.ok) throw new Error(`Order notification failed with HTTP ${response.status}.`);
};

export default async (request) => {
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405, { Allow: "POST" });

  const stripe = getStripe();
  const webhookSecret = String(process.env.STRIPE_WEBHOOK_SECRET || "").trim();
  if (!stripe || !webhookSecret) return json({ error: "Stripe webhook is not configured." }, 503);

  const signature = request.headers.get("stripe-signature");
  if (!signature) return json({ error: "Missing Stripe signature." }, 400);

  let event;
  try {
    const rawBody = await request.text();
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (error) {
    console.error("Stripe signature verification failed", error);
    return json({ error: "Invalid webhook signature." }, 400);
  }

  try {
    const session = event.data.object;
    const isPaidCompletion = event.type === "checkout.session.completed" &&
      (session.payment_status === "paid" || session.payment_status === "no_payment_required");
    const isAsyncSuccess = event.type === "checkout.session.async_payment_succeeded";

    if ((isPaidCompletion || isAsyncSuccess) && session.metadata?.product_slug === PRODUCT.slug) {
      const payload = buildOrderPayload(session, event.id);
      console.log("PAID LADFOX ORDER", JSON.stringify(payload));
      await notifyExternalOrderSystem(payload);
    }

    if (event.type === "checkout.session.async_payment_failed") {
      console.warn("LADFOX PAYMENT FAILED", session.id);
    }

    return json({ received: true });
  } catch (error) {
    console.error("Stripe webhook processing failed", error);
    return json({ error: "Webhook processing failed." }, 500);
  }
};
