import test from "node:test";
import assert from "node:assert/strict";

import {
  priceSelections,
  validateSelections
} from "../netlify/functions/create-trilogy-checkout-session.mjs";

test("Trilogy checkout charges the current displayed price after the promotion", () => {
  const selections = validateSelections({
    metal: "18k Yellow Gold",
    shape: "Round",
    stoneSize: "1.0 ct",
    colour: "D",
    clarity: "SI1",
    ringSize: "N"
  });
  const quote = priceSelections(selections);

  assert.equal(quote.salePriceGbp, 1999);
  assert.equal(quote.regularPriceGbp, 2399);
  assert.equal(quote.priceGbp, 2399);
});

test("Trilogy pricing includes metal, size, colour and clarity adjustments", () => {
  const selections = validateSelections({
    metal: "Platinum",
    shape: "Round",
    stoneSize: "2.0 ct",
    colour: "F",
    clarity: "VS1",
    ringSize: "J 1/2"
  });
  const quote = priceSelections(selections);

  assert.equal(quote.salePriceGbp, 2937);
  assert.equal(quote.regularPriceGbp, 3524);
  assert.equal(quote.priceGbp, 3524);
});
