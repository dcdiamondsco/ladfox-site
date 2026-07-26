const PRICE_CONFIG = Object.freeze({
  minimumPrice: 1999,
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
  gemstoneBasePrice: 1999,
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
  diamondPricePoints: Object.freeze([
    { size: 0.5, price: 2199 },
    { size: 1.0, price: 2199 },
    { size: 1.5, price: 2399 },
    { size: 2.0, price: 2499 },
    { size: 2.5, price: 2495 },
    { size: 3.0, price: 2999 },
    { size: 3.5, price: 3499 },
    { size: 4.0, price: 3999 },
    { size: 4.5, price: 4999 },
    { size: 5.0, price: 7499 },
    { size: 5.5, price: 8999 },
    { size: 6.0, price: 11999 }
  ])
});

const ALLOWED = Object.freeze({
  stoneTypes: new Set(["Lab Diamond", "Lab Gemstone"]),
  shapes: new Set(Object.keys(PRICE_CONFIG.shapeAddons)),
  metals: new Set(Object.keys(PRICE_CONFIG.metalAddons)),
  elongated: new Set(["Yes", "No"]),
  elongatedShapes: new Set(["Emerald", "Radiant", "Cushion"]),
  gemstones: new Set(Object.keys(PRICE_CONFIG.gemstoneAddons)),
  colours: new Set(["Not sure", "D", "E", "F", "G", "H"]),
  clarities: new Set(Object.keys(PRICE_CONFIG.clarityAddons)),
  ringSizes: new Set(["J", "J 1/2", "K", "K 1/2", "L", "L 1/2", "M", "M 1/2", "N", "N 1/2", "O", "O 1/2", "P", "P 1/2", "Q"])
});

const cleanText = (value, maxLength = 100) => String(value ?? "").trim().slice(0, maxLength);

const requireAllowed = (value, allowed, fieldName) => {
  const cleaned = cleanText(value);
  if (!allowed.has(cleaned)) throw new Error(`Invalid ${fieldName}.`);
  return cleaned;
};

const normalisedDiamondPricePoints = PRICE_CONFIG.diamondPricePoints.reduce((points, point) => {
  const previousPrice = points.length ? points[points.length - 1].price : 0;
  points.push({ size: point.size, price: Math.max(previousPrice, point.price) });
  return points;
}, []);

const interpolateDiamondBasePrice = (carat) => {
  const first = normalisedDiamondPricePoints[0];
  const last = normalisedDiamondPricePoints[normalisedDiamondPricePoints.length - 1];
  const clamped = Math.max(first.size, Math.min(carat, last.size));
  if (clamped <= first.size) return first.price;

  for (let index = 1; index < normalisedDiamondPricePoints.length; index += 1) {
    const previous = normalisedDiamondPricePoints[index - 1];
    const current = normalisedDiamondPricePoints[index];
    if (clamped <= current.size) {
      const progress = (clamped - previous.size) / (current.size - previous.size);
      return previous.price + ((current.price - previous.price) * progress);
    }
  }
  return last.price;
};

export function validateAndPrice(rawSelections = {}) {
  const stoneType = requireAllowed(rawSelections.stoneType, ALLOWED.stoneTypes, "stone type");
  const shape = requireAllowed(rawSelections.shape, ALLOWED.shapes, "shape");
  const metal = requireAllowed(rawSelections.metal, ALLOWED.metals, "metal");
  const ringSize = requireAllowed(rawSelections.ringSize, ALLOWED.ringSizes, "ring size");
  const elongated = ALLOWED.elongatedShapes.has(shape)
    ? requireAllowed(rawSelections.elongated || "No", ALLOWED.elongated, "elongated selection")
    : "No";

  const carat = Number.parseFloat(String(rawSelections.stoneSize).replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(carat) || carat < 0.5 || carat > 6.0) {
    throw new Error("Centre stone size must be between 0.5 ct and 6.0 ct.");
  }
  const roundedCarat = Math.round(carat * 10) / 10;

  const isGemstone = stoneType === "Lab Gemstone";
  const gemstone = isGemstone
    ? requireAllowed(rawSelections.gemstone, ALLOWED.gemstones, "gemstone")
    : "";
  const colour = isGemstone
    ? ""
    : requireAllowed(rawSelections.colour || "Not sure", ALLOWED.colours, "diamond colour");
  const clarity = isGemstone
    ? ""
    : requireAllowed(rawSelections.clarity, ALLOWED.clarities, "diamond clarity");

  const ringSizes = [...ALLOWED.ringSizes];
  const ringSizeIndex = ringSizes.indexOf(ringSize);
  const baseRingSizeIndex = ringSizes.indexOf("M");
  const ringSizeAddon = ringSizeIndex > baseRingSizeIndex ? (ringSizeIndex - baseRingSizeIndex) * 12 : 0;
  const basePrice = isGemstone ? PRICE_CONFIG.gemstoneBasePrice : interpolateDiamondBasePrice(roundedCarat);
  const elongatedAddon = ALLOWED.elongatedShapes.has(shape) && elongated === "Yes"
    ? PRICE_CONFIG.elongatedAddon
    : 0;
  const stoneAddon = isGemstone
    ? PRICE_CONFIG.gemstoneAddons[gemstone]
    : PRICE_CONFIG.clarityAddons[clarity];

  const priceGbp = Math.max(
    PRICE_CONFIG.minimumPrice,
    Math.round(
      basePrice +
      PRICE_CONFIG.metalAddons[metal] +
      PRICE_CONFIG.shapeAddons[shape] +
      elongatedAddon +
      stoneAddon +
      ringSizeAddon
    )
  );

  const displayShape = `${elongated === "Yes" ? "Elongated " : ""}${shape}`;
  const stoneDescription = isGemstone
    ? gemstone
    : `${colour === "Not sure" ? "best-value colour" : `${colour} colour`}, ${clarity} clarity lab-grown diamond`;

  return {
    priceGbp,
    unitAmount: priceGbp * 100,
    selections: {
      metal,
      stoneType,
      shape,
      elongated,
      gemstone,
      stoneSize: `${roundedCarat.toFixed(1)} ct`,
      colour,
      clarity,
      ringSize
    },
    description: `${metal} · ${roundedCarat.toFixed(1)} ct ${displayShape} · ${stoneDescription} · UK size ${ringSize}`
  };
}
