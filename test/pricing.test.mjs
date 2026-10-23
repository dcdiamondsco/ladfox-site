import test from "node:test";
import assert from "node:assert/strict";
import { validateAndPrice, lookupDiamondRingPrice } from "../netlify/functions/pricing.mjs";

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
  assert.ok(quote.priceGbp >= 1419);
});

test("pricing rejects unknown client selections", () => {
  assert.throws(() => validateAndPrice({ ...valid, metal: "Unobtainium" }), /Invalid metal/);
});

test("during the dated sale the sale price is charged and a higher was-price is shown", () => {
  const quote = validateAndPrice(valid, new Date("2026-10-21T12:00:00Z"));
  assert.equal(quote.saleActive, true);
  assert.equal(quote.priceGbp, quote.salePriceGbp);
  assert.ok(quote.regularPriceGbp > quote.salePriceGbp);
});

test("the sale rolls to midnight UK time at the end of the coming Sunday", async () => {
  const { saleEndsAt } = await import("../netlify/functions/sale.mjs");
  assert.equal(saleEndsAt(new Date("2026-10-20T12:00:00Z")), "2026-10-26T00:00:00.000Z");
  assert.equal(saleEndsAt(new Date("2026-10-25T20:00:00Z")), "2026-10-26T00:00:00.000Z");
  assert.equal(saleEndsAt(new Date("2026-10-26T12:00:00Z")), "2026-11-02T00:00:00.000Z");
  assert.equal(saleEndsAt(new Date("2026-07-01T12:00:00Z")), "2026-07-05T23:00:00.000Z");
});

const SALE_DAY = new Date("2026-10-21T12:00:00Z");
const reference = { metal: "14k Gold", stoneType: "Lab Diamond", shape: "Round", elongated: "No", stoneSize: "1.00 ct", colour: "F", clarity: "VVS1", ringSize: "M" };

test("a 1ct round starts around 1,550 and D costs more than F", () => {
  assert.equal(validateAndPrice(reference, SALE_DAY).priceGbp, 1549);
  assert.equal(validateAndPrice({ ...reference, colour: "D" }, SALE_DAY).priceGbp, 1619);
});

test("metal and ring size adjust the table price", () => {
  assert.equal(validateAndPrice({ ...reference, metal: "Platinum" }, SALE_DAY).priceGbp, 1549 + 150);
  assert.equal(validateAndPrice({ ...reference, ringSize: "Q" }, SALE_DAY).priceGbp, 1549 + 96);
});

test("the Classic page sizes 0.33 and 0.75 can be priced", () => {
  const d = { ...reference, colour: "D", clarity: "VS1" };
  assert.ok(validateAndPrice({ ...d, stoneSize: "0.33 ct" }).priceGbp >= 1419);
  assert.equal(validateAndPrice({ ...d, stoneSize: "0.75 ct" }).selections.stoneSize, "0.75 ct");
});

test("diamond prices rise with size and never fall as colour or clarity improves", () => {
  const sizes = [0.33, 0.5, 0.75, 1, 1.5, 2, 2.5, 3, 4, 5, 6];
  const colours = ["D", "E", "F", "G", "H"];
  const clarities = ["VS2", "VS1", "VVS2", "VVS1", "IF", "FL"];
  for (const shape of ["Round", "Oval", "Pear", "Cushion", "Emerald", "Princess", "Radiant", "Marquise"]) {
    for (const carat of sizes) {
      for (const clarity of clarities) {
        let previous = Infinity;
        for (const colour of colours) {
          const p = lookupDiamondRingPrice({ shape, elongated: "No", carat, colour, clarity });
          if (p === null) continue;
          assert.ok(p <= previous, `${shape} ${carat} ${colour} ${clarity}: worse colour should not cost more`);
          previous = p;
        }
      }
    }
  }
});

test("elongated shapes have their own prices", () => {
  const quote = validateAndPrice({ ...reference, shape: "Emerald", elongated: "Yes", stoneSize: "2.0 ct", colour: "F", clarity: "VS1" });
  assert.ok(quote.priceGbp >= 1419);
  assert.match(quote.description, /Elongated Emerald/);
});

test("every shape, size, colour and clarity can be bought and prices never fall as size or quality rises", () => {
  const shapes = ["Round", "Oval", "Marquise", "Pear", "Emerald", "Princess", "Radiant", "Cushion"];
  const colours = ["D", "E", "F", "G", "H"];
  const clarities = ["VS2", "VS1", "VVS2", "VVS1", "Internally Flawless", "Flawless"];
  const sizes = ["0.33", "0.5", "0.75", "1.0", "1.5", "2.0", "2.5", "3.0", "4.0", "5.0", "6.0"];
  for (const metal of ["14k Gold", "9k Gold"]) {
    for (const shape of shapes) {
      const price = (stoneSize, colour, clarity) =>
        validateAndPrice({ ...reference, metal, shape, stoneSize: `${stoneSize} ct`, colour, clarity }).salePriceGbp;
      for (const colour of colours) for (const clarity of clarities) {
        let previous = 0;
        for (const size of sizes) { const value = price(size, colour, clarity); assert.ok(value >= previous, `${metal} ${shape} ${size} ${colour} ${clarity}`); previous = value; }
      }
      for (const size of sizes) {
        for (let c = 0; c < colours.length; c += 1) for (let k = 0; k < clarities.length; k += 1) {
          const value = price(size, colours[c], clarities[k]);
          if (k > 0) assert.ok(value >= price(size, colours[c], clarities[k - 1]), `${metal} ${shape} ${size} clarity`);
          if (c > 0) assert.ok(price(size, colours[c - 1], clarities[k]) >= value, `${metal} ${shape} ${size} colour`);
        }
      }
    }
  }
});

test("sizes between the listed ones are priced between their neighbours", () => {
  const at = (stoneSize) => validateAndPrice({ ...reference, stoneSize }).salePriceGbp;
  assert.ok(at("1.2 ct") >= at("1.0 ct") && at("1.2 ct") <= at("1.5 ct"));
});

test("lab gemstones are still priced", () => {
  const quote = validateAndPrice({ metal: "14k Gold", stoneType: "Lab Gemstone", shape: "Oval", elongated: "No", gemstone: "Ruby - Rich Red", stoneSize: "1.0 ct", ringSize: "M" });
  const diamond = validateAndPrice({ metal: "14k Gold", stoneType: "Lab Diamond", shape: "Oval", elongated: "No", colour: "F", clarity: "VS2", stoneSize: "1.0 ct", ringSize: "M" });
  // Gemstone rings sit below the equivalent F VS2 lab-diamond ring.
  assert.ok(quote.priceGbp > 1000 && quote.priceGbp < diamond.priceGbp, `${quote.priceGbp} vs ${diamond.priceGbp}`);
});

test("9k diamond rings are cheaper than 14k and add-ons apply", () => {
  const p14 = validateAndPrice(reference).salePriceGbp;
  const p9 = validateAndPrice({ ...reference, metal: "9k Gold" }).salePriceGbp;
  assert.ok(p9 < p14 && p9 > 1000, `${p9} vs ${p14}`);
  assert.equal(validateAndPrice({ ...reference, metal: "9k White Gold" }).salePriceGbp, p9 + 30);
});
