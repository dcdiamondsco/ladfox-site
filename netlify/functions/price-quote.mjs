import { validateAndPrice } from "./pricing.mjs";
import { validateSelections as validateTrilogySelections, priceSelections as priceTrilogySelections } from "./create-trilogy-checkout-session.mjs";
import { json, readJsonBody } from "./http.mjs";

export default async (request) => {
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405, { Allow: "POST" });
  try {
    const body = await readJsonBody(request);
    const trilogy = body?.setting === "Trilogy";
    const quote = trilogy
      ? priceTrilogySelections(validateTrilogySelections(body?.selections))
      : validateAndPrice(body?.selections);
    return json({
      checkoutAllowed: true,
      priceGbp: quote.priceGbp,
      salePriceGbp: quote.salePriceGbp,
      regularPriceGbp: quote.regularPriceGbp,
      saleActive: quote.saleActive,
      saleEndsAt: quote.saleEndsAt,
      discountPercent: quote.discountPercent ?? Math.round((1 - quote.salePriceGbp / quote.regularPriceGbp) * 100),
      currency: "GBP",
      description: quote.description,
      message: trilogy ? "Trilogy price calculated from your selected specification." : quote.customerMessage,
      priceVersion: quote.priceVersion
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "The specification could not be priced." }, 400);
  }
};
