import test from "node:test";
import assert from "node:assert/strict";
import { validateAndPrice } from "../netlify/functions/pricing.mjs";

const valid = {
  metal: "Platinum",
  stoneType: "Lab Diamond",
  shape: "Oval",
  elongated: "No",
  stoneSize: "1.0 ct",
  colour: "D",
  clarity: "VS1",
  ringSize: "M"
};

test("pricing calculates a positive GBP amount from allow-listed selections", () => {
  const quote = validateAndPrice(valid, new Date("2026-07-01T12:00:00Z"));
  assert.equal(quote.checkoutAllowed, true);
  assert.equal(quote.unitAmount, quote.priceGbp * 100);
  assert.ok(quote.priceGbp >= 1999);
});

test("pricing rejects unknown client selections", () => {
  assert.throws(() => validateAndPrice({ ...valid, metal: "Unobtainium" }), /Invalid metal/);
});

test("expired sale uses the regular price", () => {
  const quote = validateAndPrice(valid, new Date("2026-09-01T12:00:00Z"));
  assert.equal(quote.saleActive, false);
  assert.equal(quote.priceGbp, quote.regularPriceGbp);
});
