import Stripe from "stripe";
import { json } from "./http.mjs";
import {
  getDb, normaliseEmail, validEmail, upsertCustomer, createProject, sendEmail, emailShell, escapeHtml, siteUrl,
  loadProject, saveProject, emailCustomerNote, sheetEvent
} from "./account-lib.mjs";

const ALLOWED_PRODUCTS = new Set(["signature-petal-collection", "our-trilogy-ring", "bespoke-ring-cad-service"]);

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

const describeOrder = (m = {}) => [
  m.metal, m.stone_size,
  m.elongated === "Yes" && !/^Elongated /i.test(m.shape || "") ? `Elongated ${m.shape}` : m.shape,
  m.colour ? `${m.colour} / ${m.clarity}` : m.gemstone,
  m.ring_size ? `UK size ${m.ring_size}` : ""
].filter(Boolean).join(" · ");

// Adds the paid order to the customer's LADFOX account. Never blocks the payment webhook.
const recordAccountOrder = async (request, payload) => {
  try {
    const email = normaliseEmail(payload.customer.email);
    if (!validEmail(email)) return;
    const db = await getDb();
    const seenKey = `orders-seen/${payload.stripeSessionId}`;
    if (await db.get(seenKey)) return;
    await db.set(seenKey, "1");
    await upsertCustomer(db, email, { name: payload.customer.name, phone: payload.customer.phone });
    const m = payload.metadata || {};
    const project = await createProject(db, {
      email, name: payload.customer.name, type: "order",
      title: m.product || "LADFOX ring",
      details: describeOrder(m),
      orderReference: payload.orderReference,
      amountTotal: payload.amountTotal,
      stage: 2,
      standard: true,
      firstUpdate: "Thank you for your order. We have received your payment and will update this page as your ring progresses."
    });
    try {
      const link = `${siteUrl(request)}/account`;
      await sendEmail({
        to: email,
        subject: "Your LADFOX order is in your account",
        text: `Thank you for your order. You can follow its progress, and message us, at ${link} (sign in with this email address).`,
        html: emailShell("Thank you for your order",
          `<p style="margin:0 0 10px">We have received your payment for "<strong>${escapeHtml(project.title)}</strong>".</p><p style="margin:0">You can follow its progress and message us at any time from your LADFOX account. Sign in with this email address and we will send you a link.</p>`,
          "Open my account", link)
      });
    } catch (error) {
      console.error("order confirmation email failed", error.message);
    }
  } catch (error) {
    console.error("recording account order failed", error);
  }
};

// A customer paid a payment request from their LADFOX account.
const recordAccountPayment = async (request, session) => {
  try {
    const m = session.metadata || {};
    const email = normaliseEmail(m.customer_email);
    const db = await getDb();
    const project = validEmail(email) ? await loadProject(db, email, m.project_id) : null;
    const payment = project?.payments?.find((p) => p.id === m.payment_id);
    if (!payment || payment.status === "paid") return;
    if (session.amount_total !== payment.amountPence || session.currency !== "gbp") {
      console.error("account payment amount mismatch", session.id);
      return;
    }
    const now = new Date().toISOString();
    payment.status = "paid";
    payment.paidAt = now;
    payment.method = "stripe";
    payment.stripeSessionId = session.id;
    project.updates.push({ at: now, by: "ladfox", text: `Payment received: ${payment.label}. Thank you!`, stage: Math.max(project.stage, 2) });
    if (project.stage < 2) project.stage = 2;
    project.progress = 8;
    project.updatedAt = now;
    await saveProject(db, project);
    await sheetEvent({ type: "progress", email: project.email, title: project.title, progress: 8 });
    try {
      await emailCustomerNote(request, project, "Payment received, thank you",
        "Payment received",
        `<p style="margin:0">Thank you. We have received your payment of £${(payment.amountPence / 100).toFixed(2)} for "<strong>${escapeHtml(project.title)}</strong>".</p>`,
        `Thank you. We have received your payment of £${(payment.amountPence / 100).toFixed(2)} for "${project.title}".`);
    } catch (error) { console.error("payment email failed", error.message); }
  } catch (error) {
    console.error("recording account payment failed", error);
  }
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

    if ((isPaidCompletion || isAsyncSuccess) && session.metadata?.account_payment === "1") {
      await recordAccountPayment(request, session);
    } else if ((isPaidCompletion || isAsyncSuccess) && ALLOWED_PRODUCTS.has(session.metadata?.product_slug || "")) {
      const payload = buildOrderPayload(session, event.id);
      console.log("PAID LADFOX ORDER", JSON.stringify(payload));
      await recordAccountOrder(request, payload);
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
