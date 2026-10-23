import test from "node:test";
import assert from "node:assert/strict";
import priceQuote from "../netlify/functions/price-quote.mjs";
import createCheckout from "../netlify/functions/create-checkout-session.mjs";
import createCadCheckout from "../netlify/functions/create-cad-checkout-session.mjs";

const post = (body) => new Request("https://ladfox.com/.netlify/functions/test", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body)
});

test("price quote returns a purchasable GBP quote for a valid classic ring", async () => {
  const response = await priceQuote(post({
    selections: {
      metal: "Platinum",
      stoneType: "Lab Diamond",
      shape: "Oval",
      elongated: "No",
      stoneSize: "1.0 ct",
      colour: "D",
      clarity: "VS1",
      ringSize: "M"
    }
  }));
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.checkoutAllowed, true);
  assert.equal(body.currency, "GBP");
  assert.ok(Number.isInteger(body.priceGbp) && body.priceGbp > 0);
});

test("price quote rejects unsupported HTTP methods", async () => {
  const response = await priceQuote(new Request("https://ladfox.com/.netlify/functions/price-quote"));
  assert.equal(response.status, 405);
  assert.equal(response.headers.get("allow"), "POST");
});

test("checkout endpoints fail safely when Stripe is unavailable", async () => {
  const originalKey = process.env.STRIPE_SECRET_KEY;
  delete process.env.STRIPE_SECRET_KEY;
  try {
    for (const handler of [createCheckout, createCadCheckout]) {
      const response = await handler(post({}));
      assert.equal(response.status, 503);
      assert.deepEqual(await response.json(), { error: "Secure checkout is temporarily unavailable." });
    }
  } finally {
    if (originalKey === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = originalKey;
  }
});
