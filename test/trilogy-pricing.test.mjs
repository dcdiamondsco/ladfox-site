import test from "node:test";
import assert from "node:assert/strict";

import {
  priceSelections,
  validateSelections
} from "../netlify/functions/create-trilogy-checkout-session.mjs";

test("Trilogy checkout charges the current rolling-sale price", () => {
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
  assert.equal(quote.priceGbp, 1999);
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
  assert.equal(quote.priceGbp, 2937);
});

test("Trilogy pricing accepts 9k yellow, white and rose gold", () => {
  const prices = [];
  for (const metal of ["9k Yellow Gold", "9k White Gold", "9k Rose Gold"]) {
    const selections = validateSelections({
      metal, shape: "Round", stoneSize: "2.0 ct", colour: "D", clarity: "SI1", ringSize: "M"
    });
    prices.push(priceSelections(selections).salePriceGbp);
  }
  assert.equal(new Set(prices).size, 1);
  const fourteen = priceSelections(validateSelections({
    metal: "14k Yellow Gold", shape: "Round", stoneSize: "2.0 ct", colour: "D", clarity: "SI1", ringSize: "M"
  })).salePriceGbp;
  assert.equal(fourteen - prices[0], 250);
});

test("all shop Trilogy arrangements are validated and priced", () => {
  const designs = [
    ["Oval", "pear"], ["Oval", "tapered baguette"],
    ["Round", "pear"], ["Round", "tapered baguette"],
    ["Emerald", "trapezoid"], ["Emerald", "tapered baguette"],
    ["Radiant", "trapezoid"], ["Radiant", "pear"],
    ["Elongated cushion", "pear"], ["Elongated cushion", "trapezoid"],
    ["Cushion", "pear"], ["Pear", "pear"],
    ["Marquise", "pear"], ["Asscher", "trapezoid"]
  ];
  for (const [shape, sideShape] of designs) {
    const selections = validateSelections({
      metal: "18k Yellow Gold", shape, sideShape,
      design: `${shape} centre with ${sideShape} sides`,
      elongated: shape === "Elongated cushion" ? "Yes" : "No",
      stoneSize: "2.0 ct", colour: "D", clarity: "VS2", ringSize: "M"
    });
    assert.ok(priceSelections(selections).priceGbp > 0);
  }
});

test("centre shape and elongated adjustments affect Trilogy price; side styles share a price", () => {
  const base = { metal: "18k Yellow Gold", stoneSize: "2.0 ct", colour: "D", clarity: "VS2", ringSize: "M" };
  const ovalPear = priceSelections(validateSelections({ ...base, shape: "Oval", sideShape: "pear", design: "Oval centre with pear sides" }));
  const ovalBaguette = priceSelections(validateSelections({ ...base, shape: "Oval", sideShape: "tapered baguette", design: "Oval centre with tapered baguette sides" }));
  const emeraldStandard = priceSelections(validateSelections({ ...base, shape: "Emerald", sideShape: "trapezoid", design: "Emerald centre with trapezoid sides" }));
  const emeraldElongated = priceSelections(validateSelections({ ...base, shape: "Emerald", sideShape: "trapezoid", design: "Emerald centre with trapezoid sides", elongated: "Yes" }));
  assert.equal(ovalPear.priceGbp, ovalBaguette.priceGbp);
  assert.equal(emeraldElongated.salePriceGbp - emeraldStandard.salePriceGbp, 60);
  assert.equal(emeraldStandard.salePriceGbp - ovalPear.salePriceGbp, 40);
  assert.throws(() => validateSelections({ ...base, shape: "Asscher", sideShape: "trapezoid", design: "Asscher centre with trapezoid sides", elongated: "Yes" }), /Invalid stone proportion/);
});
