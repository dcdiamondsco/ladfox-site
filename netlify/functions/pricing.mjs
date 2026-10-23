import { saleEndsAt } from "./sale.mjs";
import { RING_PRICES, RING_PRICES_9K, COLOUR_ORDER, CLARITY_ORDER, PRICE_TABLE_VERSION } from "./diamond-ring-prices.mjs";

export const PRODUCT = Object.freeze({
  slug: "signature-petal-collection",
  name: "LADFOX Classic Collection",
  currency: "gbp",
  priceVersion: `2026-10-19-${PRICE_TABLE_VERSION}`
});

// Rolling weekly sale ending midnight UK time on Sunday (see sale.mjs).
// The "was" price is the sale price x regularMarkup.
export const SALE = Object.freeze({ regularMarkup: 1.2 });

const PRICE_CONFIG = Object.freeze({
  minimumSalePrice: 1999,
  gemstoneDiscountMultiplier: 0.83,
  // Gemstone rings are priced at this share of the equivalent F VS2 lab-diamond ring (plus colour add-on).
  gemstoneFromDiamondMultiplier: 0.8,
  // Metal differences apply to lab diamonds and gemstones. The diamond table is priced in 14k yellow gold.
  metalAddons: Object.freeze({
    // 9k diamond rings use RING_PRICES_9K (real 9KT mount prices); these add-ons are on top of the 9k yellow price. White/rose offsets copied from 14k, unverified for 9k.
    "9k Gold": 0,
    "9k White Gold": 30,
    "9k Rose Gold": 10,
    "14k Gold": 0,
    "18k Gold": 190,
    "14k White Gold": 30,
    "18k White Gold": 220,
    "14k Rose Gold": 10,
    "18k Rose Gold": 200,
    "Platinum": 150
  }),
  // The shape, elongated, clarity and colour adjustments below now apply to lab GEMSTONES only.
  // Lab diamonds are priced directly from RING_PRICES (shape, size, colour and clarity are all in the table).
  shapeAddons: Object.freeze({
    Round: 0,
    Oval: 45,
    Pear: 70,
    Marquise: 95,
    Emerald: 85,
    Heart: 0,
    Princess: 65,
    Radiant: 75,
    Cushion: 55
  }),
  elongatedAddon: 60,
  gemstoneAddons: Object.freeze({
    "Ruby - Deep Red": 80,
    "Ruby - Rich Red": 95,
    "Ruby - Bright Red": 110,
    "Pink Sapphire - Vivid Pink": 120,
    "Pink Sapphire - Strong Pink": 130,
    "Pink Sapphire - Hot Pink": 140,
    "Pink Sapphire - Bubblegum Pink": 150,
    "Pink Sapphire - Soft Pink": 125,
    "Blue Sapphire - Royal Blue": 150,
    "Blue Sapphire - Bright Blue": 140,
    "Blue Sapphire - Violet Blue": 145,
    "Blue Sapphire - Cornflower Blue": 155,
    "Blue Sapphire - Aqua Blue": 135,
    "Blue Sapphire - Icy Blue": 130,
    "Yellow Sapphire - Deep Gold": 125,
    "Yellow Sapphire - Golden Yellow": 120,
    "Yellow Sapphire - Light Yellow": 110,
    "Purple Sapphire - Deep Purple": 145,
    "Purple Sapphire - Bright Orchid": 135,
    "Purple Sapphire - Violet": 130,
    "Purple Sapphire - Soft Lilac": 120,
    "Emerald - Mint Green": 160,
    "Emerald - Rich Green": 175,
    "Emerald - Teal Green": 170,
    "Alexandrite - Colour Changing": 220
  }),
  // Customer-facing clarity names mapped to the codes used in RING_PRICES.
  clarityCodes: Object.freeze({
    VS2: "VS2",
    VS1: "VS1",
    VVS2: "VVS2",
    VVS1: "VVS1",
    "Internally Flawless": "IF",
    Flawless: "FL"
  }),
  ringSizeAddonPerHalfSizeAboveM: 12,
  // Used by gemstones only.
  diamondPricePoints: Object.freeze([
    { size: 0.3, price: 1999 },
    { size: 0.5, price: 2199 },
    { size: 1.0, price: 2199 },
    { size: 1.5, price: 2399 },
    { size: 2.0, price: 2499 },
    { size: 2.5, price: 2499 },
    { size: 3.0, price: 2999 },
    { size: 3.5, price: 3499 },
    { size: 4.0, price: 3999 },
    { size: 4.5, price: 4999 },
    { size: 5.0, price: 7499 },
    { size: 5.5, price: 8999 },
    { size: 6.0, price: 11999 }
  ])
});

// The sizes the Classic configurator offers.
const SIGNATURE_SIZES = Object.freeze([0.33, 0.5, 0.75, 1, 1.5, 2, 2.5, 3, 4, 5, 6]);

const RING_SIZES = Object.freeze([
  "J", "J 1/2", "K", "K 1/2", "L", "L 1/2", "M", "M 1/2",
  "N", "N 1/2", "O", "O 1/2", "P", "P 1/2", "Q"
]);

const GEMSTONES = Object.freeze(Object.keys(PRICE_CONFIG.gemstoneAddons));
const ALLOWED = Object.freeze({
  stoneTypes: new Set(["Lab Diamond", "Lab Gemstone"]),
  shapes: new Set(Object.keys(PRICE_CONFIG.shapeAddons)),
  metals: new Set(Object.keys(PRICE_CONFIG.metalAddons)),
  elongated: new Set(["Yes", "No"]),
  elongatedShapes: new Set(["Emerald", "Radiant", "Cushion"]),
  gemstones: new Set(GEMSTONES),
  colours: new Set(COLOUR_ORDER),
  clarities: new Set(Object.keys(PRICE_CONFIG.clarityCodes)),
  ringSizes: new Set(RING_SIZES)
});

const cleanText = (value, maxLength = 120) => String(value ?? "").trim().slice(0, maxLength);
const requireAllowed = (value, allowed, fieldName) => {
  const cleaned = cleanText(value);
  if (!allowed.has(cleaned)) throw new Error(`Invalid ${fieldName}.`);
  return cleaned;
};

const parseCarat = (value) => {
  const carat = Number.parseFloat(String(value ?? "").replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(carat) || carat < 0.3 || carat > 6.0) {
    throw new Error("Centre stone size must be between 0.3 ct and 6.0 ct.");
  }
  const listed = SIGNATURE_SIZES.find((size) => Math.abs(size - carat) < 0.0001);
  if (listed !== undefined) return listed;
  const rounded = Math.round(carat * 10) / 10;
  if (Math.abs(carat - rounded) > 0.0001) throw new Error("Centre stone size must use 0.1 ct increments.");
  return rounded;
};

// 1 -> "1", 0.33 -> "0.33", 2.5 -> "2.5" (the keys used in RING_PRICES).
const sizeKey = (carat) => String(Number(carat.toFixed(2)));
const formatCarat = (carat) => (Math.abs(carat * 10 - Math.round(carat * 10)) < 1e-6 ? carat.toFixed(1) : carat.toFixed(2));

const interpolateDiamondBasePrice = (carat) => {
  const points = PRICE_CONFIG.diamondPricePoints;
  if (carat <= points[0].size) return points[0].price;
  for (let i = 1; i < points.length; i += 1) {
    const previous = points[i - 1];
    const current = points[i];
    if (carat <= current.size) {
      const progress = (carat - previous.size) / (current.size - previous.size);
      return previous.price + ((current.price - previous.price) * progress);
    }
  }
  return points[points.length - 1].price;
};

// Whole-ring price for a lab diamond in 14k yellow gold, or null when the combination is not sold online.
export const lookupDiamondRingPrice = ({ shape, elongated, carat, colour, clarity, metal = "" }) => {
  const tableShape = elongated === "Yes" ? `Elongated ${shape}` : shape;
  const sizes = (String(metal).startsWith("9k") ? RING_PRICES_9K : RING_PRICES)[tableShape];
  if (!sizes) return null;
  const index = COLOUR_ORDER.indexOf(colour) * CLARITY_ORDER.length + CLARITY_ORDER.indexOf(PRICE_CONFIG.clarityCodes[clarity]);
  const listed = Object.keys(sizes).map(Number).filter((size) => Number.isFinite(sizes[String(size)]?.[index])).sort((x, y) => x - y);
  if (!listed.length) return null;
  const price = (size) => sizes[String(size)][index];
  if (carat <= listed[0]) return price(listed[0]);
  if (carat >= listed[listed.length - 1]) return price(listed[listed.length - 1]);
  const exact = listed.find((size) => Math.abs(size - carat) < 1e-6);
  if (exact !== undefined) return price(exact);
  // Sizes between the listed ones are priced on a straight line between their neighbours, rounded up to end in 9.
  const upper = listed.find((size) => size > carat);
  const lower = [...listed].reverse().find((size) => size < carat);
  const raw = price(lower) + (price(upper) - price(lower)) * ((carat - lower) / (upper - lower));
  return Math.ceil((raw + 1) / 10) * 10 - 1;
};

// Reference lab-diamond ring price for a gemstone ring: F VS2 where the table has it, otherwise the cheapest
// listed colour/clarity for that shape and size, interpolated between listed sizes. Shapes missing from the
// table (e.g. Heart) use Round plus the shape add-on.
const gemstoneReferencePrice = ({ shape, elongated, carat, metal }) => {
  const table = String(metal).startsWith("9k") ? RING_PRICES_9K : RING_PRICES;
  const tableShape = elongated === "Yes" ? `Elongated ${shape}` : shape;
  const rows = table[tableShape] || table[shape] || table.Round;
  const shapeExtra = table[tableShape] || table[shape] ? 0 : PRICE_CONFIG.shapeAddons[shape] ?? 0;
  const f = COLOUR_ORDER.indexOf("F") * CLARITY_ORDER.length + CLARITY_ORDER.indexOf("VS2");
  const points = Object.entries(rows).map(([size, row]) => {
    const preferred = row[f];
    const cheapest = Math.min(...row.filter(Number.isFinite));
    return { size: Number(size), price: Number.isFinite(preferred) ? preferred : cheapest };
  }).filter((point) => Number.isFinite(point.price)).sort((x, y) => x.size - y.size);
  // A bigger stone never costs less than a smaller one.
  points.forEach((point, i) => { if (i > 0) point.price = Math.max(point.price, points[i - 1].price); });
  if (!points.length) return interpolateDiamondBasePrice(carat) + shapeExtra;
  if (carat <= points[0].size) return points[0].price + shapeExtra;
  for (let i = 1; i < points.length; i += 1) {
    if (carat <= points[i].size) {
      const t = (carat - points[i - 1].size) / (points[i].size - points[i - 1].size);
      return points[i - 1].price + (points[i].price - points[i - 1].price) * t + shapeExtra;
    }
  }
  return points[points.length - 1].price + shapeExtra;
};

const getRingSizeAddon = (ringSize) => {
  const selected = RING_SIZES.indexOf(ringSize);
  const base = RING_SIZES.indexOf("M");
  return selected > base ? (selected - base) * PRICE_CONFIG.ringSizeAddonPerHalfSizeAboveM : 0;
};

const getImagePath = ({ metal, shape, elongated }) => {
  const metalKey = metal === "Platinum" || metal.includes("White Gold")
    ? "platinum"
    : metal.includes("Rose Gold") ? "rose gold" : "gold";
  const shapeKey = `${elongated === "Yes" ? "elongated " : ""}${shape.toLowerCase()}`;
  if (shape === "Round" && metalKey === "gold") return "Images/Signature Collection/Round Gold.jpg";
  if (shape === "Round" && metalKey === "platinum") return "Images/Signature Collection/Round Platinum.jpg";
  return `Images/Signature Collection/${shapeKey} ${metalKey}.png`;
};

export function validateSelections(raw = {}) {
  const stoneType = requireAllowed(raw.stoneType, ALLOWED.stoneTypes, "stone type");
  const shape = requireAllowed(raw.shape, ALLOWED.shapes, "shape");
  const metal = requireAllowed(raw.metal, ALLOWED.metals, "metal");
  const ringSize = requireAllowed(raw.ringSize, ALLOWED.ringSizes, "ring size");
  const elongated = ALLOWED.elongatedShapes.has(shape)
    ? requireAllowed(raw.elongated || "No", ALLOWED.elongated, "stone proportion") : "No";
  const carat = parseCarat(raw.stoneSize);
  const isGemstone = stoneType === "Lab Gemstone";
  return {
    metal,
    stoneType,
    shape,
    elongated,
    gemstone: isGemstone ? requireAllowed(raw.gemstone, ALLOWED.gemstones, "gemstone colour") : "",
    stoneSize: `${formatCarat(carat)} ct`,
    carat,
    colour: isGemstone ? "" : requireAllowed(raw.colour, ALLOWED.colours, "diamond colour"),
    clarity: isGemstone ? "" : requireAllowed(raw.clarity, ALLOWED.clarities, "diamond clarity"),
    ringSize
  };
}

export function validateAndPrice(rawSelections = {}, now = new Date()) {
  const selections = validateSelections(rawSelections);
  const isGemstone = selections.stoneType === "Lab Gemstone";

  let rawPrice;
  if (isGemstone) {
    // Gemstones are priced off the lab-diamond ring table (same shape and size, F colour, VS2 clarity, in the
    // selected metal family) less the gemstone discount, plus the colour add-on. Falls back to the old list
    // for any shape/size the diamond table does not cover.
    const base = gemstoneReferencePrice(selections) * PRICE_CONFIG.gemstoneFromDiamondMultiplier;
    rawPrice = base +
      PRICE_CONFIG.metalAddons[selections.metal] +
      PRICE_CONFIG.gemstoneAddons[selections.gemstone] +
      getRingSizeAddon(selections.ringSize);
  } else {
    const tablePrice = lookupDiamondRingPrice(selections);
    if (tablePrice === null) {
      // The message starts with "Centre stone" so checkout shows it to the customer.
      throw new Error("Centre stone combination is made to order, so please contact LADFOX for a personal quote.");
    }
    rawPrice = tablePrice + PRICE_CONFIG.metalAddons[selections.metal] + getRingSizeAddon(selections.ringSize);
  }

    const salePriceGbp = Math.round(rawPrice);
  const regularPriceGbp = Math.ceil((salePriceGbp * SALE.regularMarkup + 1) / 10) * 10 - 1;
  const saleEndsAtIso = saleEndsAt(now);
  const saleActive = true;
  const priceGbp = saleActive ? salePriceGbp : regularPriceGbp;
  const displayShape = `${selections.elongated === "Yes" ? "Elongated " : ""}${selections.shape}`;
  const stoneDescription = isGemstone
    ? selections.gemstone
    : `${selections.colour} colour, ${selections.clarity} clarity lab-grown diamond`;

  return {
    checkoutAllowed: true,
    priceGbp,
    salePriceGbp,
    regularPriceGbp,
    saleActive,
    saleEndsAt: saleEndsAtIso,
    discountPercent: Math.round((1 - salePriceGbp / regularPriceGbp) * 100),
    unitAmount: priceGbp * 100,
    priceVersion: PRODUCT.priceVersion,
    selections,
    imagePath: getImagePath(selections),
    description: `${selections.metal} · ${selections.stoneSize} ${displayShape} · ${stoneDescription} · UK size ${selections.ringSize}`,
    customerMessage: "This price is calculated securely from the selected specification and includes insured UK delivery."
  };
}
