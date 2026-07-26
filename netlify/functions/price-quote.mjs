import { validateAndPrice } from "./pricing.mjs";
import { json, readJsonBody } from "./http.mjs";

export default async (request) => {
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405, { Allow: "POST" });
  try {
    const body = await readJsonBody(request);
    const quote = validateAndPrice(body?.selections);
    return json({
      checkoutAllowed: true,
      priceGbp: quote.priceGbp,
      salePriceGbp: quote.salePriceGbp,
      regularPriceGbp: quote.regularPriceGbp,
      saleActive: quote.saleActive,
      saleEndsAt: quote.saleEndsAt,
      discountPercent: quote.discountPercent,
      currency: "GBP",
      description: quote.description,
      message: quote.customerMessage,
      priceVersion: quote.priceVersion
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "The specification could not be priced." }, 400);
  }
};
