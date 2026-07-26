export const PRODUCT = Object.freeze({
  slug: "signature-petal-collection",
  name: "LADFOX Signature Petal Collection",
  currency: "gbp",
  priceVersion: "2026-07-26-sale"
});

export const SALE = Object.freeze({
  discountPercent: 20,
  // End of Sunday 2 August 2026 in UK summer time.
  endsAt: "2026-08-03T00:00:00+01:00"
});

const PRICE_CONFIG = Object.freeze({
  minimumSalePrice: 1999,
  gemstoneDiscountMultiplier: 0.83,
  metalAddons: Object.freeze({
    "14k Gold": 0,
    "18k Gold": 110,
    "14k White Gold": 30,
    "18k White Gold": 130,
    "14k Rose Gold": 30,
    "18k Rose Gold": 130,
    "Platinum": 230
  }),
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
  clarityAddons: Object.freeze({
    VS2: 20,
    VS1: 45,
    VVS2: 75,
    VVS1: 100,
    "Internally Flawless": 130,
    Flawless: 150
  }),
  colourAddons: Object.freeze({
    D: 0,
    E: -20,
    F: -40,
    G: -40,
    H: -40
  }),
  ringSizeAddonPerHalfSizeAboveM: 12,
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
  colours: new Set(["D", "E", "F", "G", "H"]),
  clarities: new Set(Object.keys(PRICE_CONFIG.clarityAddons)),
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
  const rounded = Math.round(carat * 10) / 10;
  if (Math.abs(carat - rounded) > 0.0001) throw new Error("Centre stone size must use 0.1 ct increments.");
  return rounded;
};

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
    stoneSize: `${carat.toFixed(1)} ct`,
    carat,
    colour: isGemstone ? "" : requireAllowed(raw.colour, ALLOWED.colours, "diamond colour"),
    clarity: isGemstone ? "" : requireAllowed(raw.clarity, ALLOWED.clarities, "diamond clarity"),
    ringSize
  };
}

export function validateAndPrice(rawSelections = {}, now = new Date()) {
  const selections = validateSelections(rawSelections);
  const isGemstone = selections.stoneType === "Lab Gemstone";
  const elongatedAddon = ALLOWED.elongatedShapes.has(selections.shape) && selections.elongated === "Yes"
    ? PRICE_CONFIG.elongatedAddon : 0;
  const stoneAddon = isGemstone
    ? PRICE_CONFIG.gemstoneAddons[selections.gemstone]
    : PRICE_CONFIG.clarityAddons[selections.clarity];
  const colourAddon = isGemstone ? 0 : PRICE_CONFIG.colourAddons[selections.colour];
  const diamondBasePrice = interpolateDiamondBasePrice(selections.carat);
  const basePrice = isGemstone
    ? diamondBasePrice * PRICE_CONFIG.gemstoneDiscountMultiplier
    : diamondBasePrice;

  // These are the existing LADFOX sale prices. The regular price is derived so the reduction is exactly 20%.
  const salePriceGbp = Math.max(PRICE_CONFIG.minimumSalePrice, Math.round(
    basePrice +
    PRICE_CONFIG.metalAddons[selections.metal] +
    PRICE_CONFIG.shapeAddons[selections.shape] +
    elongatedAddon +
    stoneAddon +
    colourAddon +
    getRingSizeAddon(selections.ringSize)
  ));
  const regularPriceGbp = Math.ceil((salePriceGbp / 0.8) / 10) * 10;
  const saleActive = now.getTime() < new Date(SALE.endsAt).getTime();
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
    saleEndsAt: SALE.endsAt,
    discountPercent: SALE.discountPercent,
    unitAmount: priceGbp * 100,
    priceVersion: PRODUCT.priceVersion,
    selections,
    imagePath: getImagePath(selections),
    description: `${selections.metal} · ${selections.stoneSize} ${displayShape} · ${stoneDescription} · UK size ${selections.ringSize}`,
    customerMessage: saleActive
      ? `20% sale price. Offer ends at midnight after Sunday 2 August 2026.`
      : "This price is calculated securely from the selected specification and includes insured UK delivery."
  };
}
