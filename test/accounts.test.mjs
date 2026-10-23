import test from "node:test";
import assert from "node:assert/strict";

const mem = new Map();
globalThis.__LADFOX_TEST_STORE = {
  async get(k, o) {
    const v = mem.get(k); if (v === undefined) return null;
    if (o?.type === "json") return JSON.parse(v);
    if (o?.type === "arrayBuffer") { const b = Buffer.from(v); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); }
    return v;
  },
  async set(k, v) { mem.set(k, Buffer.isBuffer(v) ? Buffer.from(v) : String(v)); },
  async setJSON(k, v) { mem.set(k, JSON.stringify(v)); },
  async delete(k) { mem.delete(k); },
  async list({ prefix = "" } = {}) { return { blobs: [...mem.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })) }; }
};
process.env.SMTP_USER = "david@ladfox.com";
process.env.SMTP_PASS = "abcd efgh ijkl mnop";
process.env.ADMIN_PASSWORD = "correct-horse-battery";
process.env.SITE_URL = "https://ladfox.com";

const sent = [];
globalThis.__LADFOX_TEST_MAIL = { async sendMail(m) { sent.push({ body: { ...m, to: [m.to] } }); } };

const auth = (await import("../netlify/functions/account-auth.mjs")).default;
const account = (await import("../netlify/functions/account.mjs")).default;
const admin = (await import("../netlify/functions/admin.mjs")).default;
const accountFile = (await import("../netlify/functions/account-file.mjs")).default;

const req = (url, method, body, headers = {}) => new Request("https://ladfox.com" + url, {
  method, headers: { "content-type": "application/json", ...headers }, body: body ? JSON.stringify(body) : undefined
});
let cookie = "";

test("signed-out is rejected", async () => {
  assert.equal((await account(req("/x", "GET"))).status, 401);
});

test("sign-in link flow, single use", async () => {
  let r = await auth(req("/a", "POST", { action: "request", email: "Sarah@Example.com", name: "Sarah Collins" }));
  assert.equal(r.status, 200);
  const link = sent.at(-1).body.text.match(/token=([^\s]+)/)[1];
  assert.equal(sent.at(-1).body.to[0], "sarah@example.com");
  r = await auth(req("/a", "POST", { action: "verify", token: "bogus" }));
  assert.equal(r.status, 400);
  r = await auth(req("/a", "POST", { action: "verify", token: decodeURIComponent(link) }));
  assert.equal(r.status, 200);
  cookie = r.headers.get("set-cookie").split(";")[0];
  assert.match(r.headers.get("set-cookie"), /HttpOnly; Secure; SameSite=Lax/);
  r = await auth(req("/a", "POST", { action: "verify", token: decodeURIComponent(link) }));
  assert.equal(r.status, 400, "link must be single use");
});

test("rate limit gives generic reply without second email", async () => {
  const before = sent.length;
  const r = await auth(req("/a", "POST", { action: "request", email: "sarah@example.com" }));
  assert.equal(r.status, 200);
  assert.equal(sent.length, before);
});

test("invalid email rejected", async () => {
  assert.equal((await auth(req("/a", "POST", { action: "request", email: "nope" }))).status, 400);
});

test("request a design, message, and isolation between customers", async () => {
  let r = await account(req("/x", "POST", { action: "request", title: "Oval halo", details: "2ct oval, hidden halo, rose gold", ringType: "Engagement ring" }, { cookie }));
  assert.equal(r.status, 200);
  const { project } = await r.json();
  assert.equal(project.stage, 0);
  r = await account(req("/x", "POST", { action: "message", id: project.id, text: "<script>alert(1)</script> hello" }, { cookie }));
  assert.equal(r.status, 200);
  r = await account(req("/x", "GET", null, { cookie }));
  const data = await r.json();
  assert.equal(data.projects.length, 1);
  assert.equal(data.customer.name, "Sarah Collins");
  // another customer sees nothing
  await auth(req("/a", "POST", { action: "request", email: "other@example.com" }));
  const t2 = decodeURIComponent(sent.at(-1).body.text.match(/token=([^\s]+)/)[1]);
  const v2 = await auth(req("/a", "POST", { action: "verify", token: t2 }));
  const c2 = v2.headers.get("set-cookie").split(";")[0];
  const d2 = await (await account(req("/x", "GET", null, { cookie: c2 }))).json();
  assert.equal(d2.projects.length, 0);
  const steal = await account(req("/x", "POST", { action: "message", id: project.id, text: "hi" }, { cookie: c2 }));
  assert.equal(steal.status, 404);
});

test("form-style cross-site POST (non-JSON) is refused", async () => {
  const r = await account(new Request("https://ladfox.com/x", { method: "POST", headers: { "content-type": "text/plain", cookie }, body: "{}" }));
  assert.equal(r.status, 400);
});

test("admin needs password, can update, customer is emailed", async () => {
  assert.equal((await admin(req("/x", "GET", null, { authorization: "Bearer wrong" }))).status, 401);
  const H = { authorization: "Bearer correct-horse-battery" };
  const list = await (await admin(req("/x", "GET", null, H))).json();
  assert.equal(list.projects.length, 1);
  assert.equal(list.projects[0].customerUnread, true);
  const p = list.projects[0];
  const before = sent.length;
  const r = await admin(req("/x", "POST", { action: "update", email: p.email, id: p.id, stage: 5, estimate: "12 December", note: "CAD ready for you", notify: true }, H));
  assert.equal(r.status, 200);
  assert.equal((await r.json()).emailed, true);
  assert.equal(sent.length, before + 1);
  assert.match(sent.at(-1).body.subject, /In production/);
  const mine = await (await account(req("/x", "GET", null, { cookie }))).json();
  assert.equal(mine.projects[0].stage, 5);
  assert.equal(mine.projects[0].estimate, "12 December");
  assert.equal(mine.projects[0].customerUnread, undefined);
});

test("admin can add an existing order", async () => {
  const H = { authorization: "Bearer correct-horse-battery" };
  const r = await admin(req("/x", "POST", { action: "create", email: "new@example.com", name: "New", title: "3ct emerald", stage: 3 }, H));
  assert.equal(r.status, 200);
  assert.equal((await r.json()).project.stage, 3);
});

test("logout invalidates session", async () => {
  await auth(req("/a", "POST", { action: "logout" }, { cookie }));
  assert.equal((await account(req("/x", "GET", null, { cookie }))).status, 401);
});


test("falls back to Resend when no SMTP settings", async () => {
  delete process.env.SMTP_USER; delete process.env.SMTP_PASS; process.env.RESEND_API_KEY = "re_x";
  const calls = [];
  const real = globalThis.fetch;
  globalThis.fetch = async (url, init) => { calls.push(url); return new Response("{}", { status: 200 }); };
  const { sendEmail } = await import("../netlify/functions/account-lib.mjs");
  await sendEmail({ to: "a@b.co", subject: "x", text: "x", html: "x" });
  assert.deepEqual(calls, ["https://api.resend.com/emails"]);
  delete process.env.RESEND_API_KEY;
  await assert.rejects(() => sendEmail({ to: "a@b.co", subject: "x", text: "x", html: "x" }), /not configured/);
  globalThis.fetch = real;
  process.env.SMTP_USER = "david@ladfox.com"; process.env.SMTP_PASS = "abcd efgh ijkl mnop";
});

/* ---------- designs, approval, payments ---------- */
const adminH = { authorization: "Bearer correct-horse-battery" };
const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64, 1)]);
let proj, cookie2, other;
async function signIn(email) {
  await auth(req("/a", "POST", { action: "request", email }));
  const tok = decodeURIComponent(sent.at(-1).body.text.match(/token=([^\s]+)/)[1]);
  return (await auth(req("/a", "POST", { action: "verify", token: tok }))).headers.get("set-cookie").split(";")[0];
}

test("setup: new signed-in customer with a design request", async () => {
  other = await signIn("someone-else@example.com");
  await auth(req("/a", "POST", { action: "request", email: "pay@example.com", name: "Pat" }));
  const tok = decodeURIComponent(sent.at(-1).body.text.match(/token=([^\s]+)/)[1]);
  const v = await auth(req("/a", "POST", { action: "verify", token: tok }));
  cookie2 = v.headers.get("set-cookie").split(";")[0];
  const r = await account(req("/x", "POST", { action: "request", title: "Pear trilogy", details: "pear centre with two pear sides" }, { cookie: cookie2 }));
  proj = (await r.json()).project;
  assert.equal(proj.stage, 0);
});

test("admin uploads a sketch; wrong type rejected; customer can fetch it, others cannot", async () => {
  const bad = await admin(req("/x", "POST", { action: "upload", email: "pay@example.com", id: proj.id, name: "evil.html", data: Buffer.from("<script>alert(1)</script>").toString("base64") }, adminH));
  assert.equal(bad.status, 400);
  const ok = await admin(req("/x", "POST", { action: "upload", email: "pay@example.com", id: proj.id, name: "sketch.png", data: png.toString("base64"), note: "Complimentary sketch created", notify: true }, adminH));
  assert.equal(ok.status, 200);
  const file = (await ok.json()).project.files[0];
  assert.equal(file.type, "image/png");
  const get = await accountFile(req(`/f?p=${proj.id}&f=${file.id}`, "GET", null, { cookie: cookie2 }));
  assert.equal(get.status, 200);
  assert.equal(get.headers.get("content-type"), "image/png");
  assert.equal(Buffer.from(await get.arrayBuffer()).equals(png), true);
  assert.equal((await accountFile(req(`/f?p=${proj.id}&f=${file.id}`, "GET", null, { cookie: other }))).status, 404);
  assert.equal((await accountFile(req(`/f?p=${proj.id}&f=${file.id}`, "GET"))).status, 401);
  assert.equal((await accountFile(req(`/f?p=${proj.id}&f=${file.id}&e=pay@example.com`, "GET", null, adminH))).status, 200);
});

test("approval only works at Design in progress", async () => {
  let r = await account(req("/x", "POST", { action: "approve", id: proj.id }, { cookie: cookie2 }));
  assert.equal(r.status, 400, "not yet at stage 3");
  await admin(req("/x", "POST", { action: "update", email: "pay@example.com", id: proj.id, stage: 3 }, adminH));
  r = await account(req("/x", "POST", { action: "approve", id: proj.id }, { cookie: cookie2 }));
  assert.equal(r.status, 200);
  assert.equal((await r.json()).project.stage, 4);
  r = await account(req("/x", "POST", { action: "approve", id: proj.id }, { cookie: cookie2 }));
  assert.equal(r.status, 400);
});

test("payment request, customer checkout uses server amount, webhook marks paid", async () => {
  assert.equal((await admin(req("/x", "POST", { action: "request-payment", email: "pay@example.com", id: proj.id, amount: "0.5" }, adminH))).status, 400);
  let r = await admin(req("/x", "POST", { action: "request-payment", email: "pay@example.com", id: proj.id, amount: "1850", notify: true }, adminH));
  assert.equal(r.status, 200);
  const payment = (await r.json()).project.payments[0];
  assert.equal(payment.amountPence, 185000);
  assert.equal((await admin(req("/x", "POST", { action: "request-payment", email: "pay@example.com", id: proj.id, amount: "10" }, adminH))).status, 400, "only one open request");

  let created;
  globalThis.__LADFOX_TEST_STRIPE = { checkout: { sessions: { create: async (args) => { created = args; return { url: "https://checkout.stripe.test/s" }; } } } };
  assert.equal((await account(req("/x", "POST", { action: "pay", id: proj.id, paymentId: payment.id }, { cookie: other }))).status, 404);
  r = await account(req("/x", "POST", { action: "pay", id: proj.id, paymentId: payment.id, amount: 1 }, { cookie: cookie2 }));
  assert.equal(r.status, 200);
  assert.equal(created.line_items[0].price_data.unit_amount, 185000, "amount comes from the server record");
  assert.equal(created.customer_email, "pay@example.com");
  delete globalThis.__LADFOX_TEST_STRIPE;

  const secret = "whsec_test"; process.env.STRIPE_WEBHOOK_SECRET = secret; process.env.STRIPE_SECRET_KEY = "sk_test_x";
  const { default: Stripe } = await import("stripe");
  const stripe = new Stripe("sk_test_x");
  const event = { id: "evt_1", object: "event", type: "checkout.session.completed", data: { object: {
    id: "cs_test_abc", payment_status: "paid", amount_total: 185000, currency: "gbp",
    metadata: { account_payment: "1", project_id: proj.id, payment_id: payment.id, customer_email: "pay@example.com" } } } };
  const payload = JSON.stringify(event);
  const wh = (await import("../netlify/functions/stripe-webhook.mjs")).default;
  const sign = (p) => Stripe.webhooks.generateTestHeaderString({ payload: p, secret });
  const hook = await wh(new Request("https://ladfox.com/w", { method: "POST", headers: { "stripe-signature": sign(payload) }, body: payload }));
  assert.equal(hook.status, 200);
  const mine = await (await account(req("/x", "GET", null, { cookie: cookie2 }))).json();
  const p = mine.projects.find((x) => x.id === proj.id);
  assert.equal(p.payments[0].status, "paid");
  assert.equal(p.stage, 4, "stage is not moved backwards by a payment");
  const before = p.updates.length;
  await wh(new Request("https://ladfox.com/w", { method: "POST", headers: { "stripe-signature": sign(payload) }, body: payload }));
  const again = (await (await account(req("/x", "GET", null, { cookie: cookie2 }))).json()).projects.find((x) => x.id === proj.id);
  assert.equal(again.updates.length, before, "replay does nothing");
});

test("a wrong-amount payment event is refused", async () => {
  const secret = "whsec_test"; const { default: Stripe } = await import("stripe"); const stripe = new Stripe("sk_test_x");
  // a fresh open request on a new project
  const r = await account(req("/x", "POST", { action: "request", title: "Second ring", details: "another design please" }, { cookie: cookie2 }));
  const p2 = (await r.json()).project;
  const pr = await admin(req("/x", "POST", { action: "request-payment", email: "pay@example.com", id: p2.id, amount: "500" }, adminH));
  const pay = (await pr.json()).project.payments[0];
  const bad = JSON.stringify({ id: "evt_9", object: "event", type: "checkout.session.completed", data: { object: { id: "cs_9", payment_status: "paid", amount_total: 100, currency: "gbp",
    metadata: { account_payment: "1", project_id: p2.id, payment_id: pay.id, customer_email: "pay@example.com" } } } });
  const wh = (await import("../netlify/functions/stripe-webhook.mjs")).default;
  await wh(new Request("https://ladfox.com/w", { method: "POST", headers: { "stripe-signature": Stripe.webhooks.generateTestHeaderString({ payload: bad, secret }) }, body: bad }));
  const list = await (await admin(req("/x", "GET", null, adminH))).json();
  assert.equal(list.projects.find((x) => x.id === p2.id).payments[0].status, "requested");
});

test("a paid website order starts at Payment received and is marked standard", async () => {
  const secret = "whsec_test"; process.env.STRIPE_WEBHOOK_SECRET = secret; process.env.STRIPE_SECRET_KEY = "sk_test_x"; const { default: Stripe } = await import("stripe");
  const event = { id: "evt_3", object: "event", type: "checkout.session.completed", data: { object: {
    id: "cs_test_order", payment_status: "paid", amount_total: 150000, currency: "gbp", client_reference_id: "LF-1",
    customer_details: { name: "Web Buyer", email: "web@example.com" },
    metadata: { product_slug: "our-trilogy-ring", product: "Our Trilogy Ring", metal: "18K white gold", order_reference: "LF-1" } } } };
  const payload = JSON.stringify(event);
  const wh = (await import("../netlify/functions/stripe-webhook.mjs")).default;
  const hook = await wh(new Request("https://ladfox.com/w", { method: "POST", headers: { "stripe-signature": Stripe.webhooks.generateTestHeaderString({ payload, secret }) }, body: payload }));
  assert.equal(hook.status, 200);
  const list = await (await admin(req("/x", "GET", null, adminH))).json();
  const o = list.projects.find((x) => x.email === "web@example.com");
  assert.equal(o.stage, 2); assert.equal(o.standard, true);
  assert.equal(list.stages[2], "Payment received");
  assert.equal(list.stages[1], "Complimentary sketch created");
});

/* ---------- save your progress (ring enquiry) ---------- */
const saveFn = (await import("../netlify/functions/save-progress.mjs")).default;
const lib = await import("../netlify/functions/account-lib.mjs");
let draftTok;

test("start rejects bad email, saves a draft, emails links, records opt-in", async () => {
  assert.equal((await saveFn(req("/s", "POST", { action: "start", email: "nope" }))).status, 400);
  const before = sent.length;
  const r = await saveFn(req("/s", "POST", { action: "start", email: "Ring.Buyer@Example.com", marketing: true, answers: { ring_metal: "Platinum", evil: "x" } }));
  assert.equal(r.status, 200);
  const data = await r.json();
  assert.ok(data.token && data.token.length > 20);
  draftTok = data.token;
  assert.equal(sent.length, before + 1);
  const mail = sent.at(-1).body;
  assert.equal(mail.to[0], "ring.buyer@example.com");
  assert.match(mail.text, new RegExp(`/design/your-ring\\?resume=${draftTok}`));
  assert.match(mail.text, /\/account\?token=/);
  const cust = await globalThis.__LADFOX_TEST_STORE.get(lib.customerKey("ring.buyer@example.com"), { type: "json" });
  assert.equal(cust.marketingOptIn, "yes");
});

test("a second start inside a minute does not send a second email", async () => {
  const before = sent.length;
  const r = await saveFn(req("/s", "POST", { action: "start", email: "ring.buyer@example.com" }));
  assert.equal(r.status, 200);
  assert.equal(sent.length, before);
  // the first draft token was replaced by the new one
  const d = await (await saveFn(req("/s", "POST", { action: "load", token: draftTok }))).json();
  assert.equal(d.ok, undefined);
  draftTok = (await globalThis.__LADFOX_TEST_STORE.get(lib.draftKey("ring.buyer@example.com"), { type: "json" })).token;
});

test("save and load keep only known answers; wrong token is refused", async () => {
  let r = await saveFn(req("/s", "POST", { action: "save", token: draftTok, stepKey: "ring_metal", answers: { ring_metal: "Platinum", stone_shape: "Oval", hacker: "<script>", email: "x@y.zz" } }));
  assert.equal(r.status, 200);
  r = await saveFn(req("/s", "POST", { action: "load", token: draftTok }));
  const d = await r.json();
  assert.deepEqual(d.answers, { ring_metal: "Platinum", stone_shape: "Oval" });
  assert.equal(d.stepKey, "ring_metal");
  assert.equal((await saveFn(req("/s", "POST", { action: "load", token: "nope" }))).status, 404);
  assert.equal((await saveFn(req("/s", "POST", { action: "save", token: "nope", answers: {} }))).status, 404);
  assert.equal((await saveFn(new Request("https://ladfox.com/s", { method: "GET" }))).status, 405);
});

test("signed-in customer sees the saved design; completing creates a project once", async () => {
  const ck = await signIn("ring.buyer@example.com");
  let me = await (await account(req("/x", "GET", null, { cookie: ck }))).json();
  assert.match(me.draft.resumeUrl, /^\/design\/your-ring\?resume=/);
  assert.equal(me.projects.length, 0);

  let r = await saveFn(req("/s", "POST", { action: "complete", token: draftTok, answers: { ring_metal: "Platinum", stone_shape: "Oval", multi_stone_style: "Trilogy", budget: "4000" } }));
  const first = await r.json();
  assert.ok(first.projectId);
  r = await saveFn(req("/s", "POST", { action: "complete", token: draftTok, answers: {} }));
  assert.equal((await r.json()).projectId, first.projectId, "no duplicate project");
  me = await (await account(req("/x", "GET", null, { cookie: ck }))).json();
  assert.equal(me.projects.length, 1);
  assert.match(me.projects[0].details, /Metal: Platinum/);
  assert.equal(me.projects[0].stage, 0);
  assert.equal(me.draft, null, "draft no longer offered once the enquiry is sent");
});

test("completing without a draft still creates an account project from the email", async () => {
  const before = sent.length;
  const r = await saveFn(req("/s", "POST", { action: "complete", email: "late@example.com", answers: { ring_metal: "18K yellow gold" } }));
  assert.ok((await r.json()).projectId);
  assert.equal(sent.at(-1).body.to[0], "late@example.com");
  assert.equal(sent.length, before + 1);
  const none = await saveFn(req("/s", "POST", { action: "complete", answers: { ring_metal: "x" } }));
  assert.equal((await none.json()).skipped, true);
});

test("sketch intent emails a link that opens the request form", async () => {
  const before = sent.length;
  const r = await auth(req("/a", "POST", { action: "request", email: "sketch.fan@example.com", intent: "sketch" }));
  assert.equal(r.status, 200);
  assert.equal(sent.length, before + 1);
  const mail = sent.at(-1).body;
  assert.match(mail.subject, /complimentary/i);
  assert.match(mail.text, /\/account\?token=[^\s&]+&new=1/);
  const plain = await auth(req("/a", "POST", { action: "request", email: "plain.signin@example.com" }));
  assert.equal(plain.status, 200);
  assert.doesNotMatch(sent.at(-1).body.text, /new=1/);
});
