import Stripe from "stripe";

const stripeKey = process.env.STRIPE_SECRET_KEY;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
const stripe = stripeKey ? new Stripe(stripeKey) : null;

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json; charset=utf-8" }
});

export default async (request) => {
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
  if (!stripe || !webhookSecret) return json({ error: "Stripe webhook is not configured." }, 503);

  const signature = request.headers.get("stripe-signature");
  if (!signature) return json({ error: "Missing Stripe signature." }, 400);

  try {
    const rawBody = await request.text();
    const event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);

    if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
      const session = event.data.object;
      console.log("PAID LADFOX ORDER", JSON.stringify({
        id: session.id,
        paymentStatus: session.payment_status,
        amountTotal: session.amount_total,
        currency: session.currency,
        customerEmail: session.customer_details?.email || "",
        customerName: session.customer_details?.name || "",
        metadata: session.metadata || {}
      }));

      // Next stage: send this order to Gmail, Airtable, your CRM or an order database.
    }

    if (event.type === "checkout.session.async_payment_failed") {
      console.warn("LADFOX PAYMENT FAILED", event.data.object.id);
    }

    return json({ received: true });
  } catch (error) {
    console.error("Stripe webhook error", error);
    return json({ error: "Invalid webhook signature." }, 400);
  }
};
