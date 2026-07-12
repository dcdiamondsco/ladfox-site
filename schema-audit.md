# Schema Audit

## 1. Files checked

- `about-us.html`
- `advice.html`
- `advice/where-to-buy-an-engagement-ring.html`
- `bracelets.html`
- `consultation.html`
- `contact-us.html`
- `create-your-own-ring.html`
- `diamonds.html`
- `faq.html`
- `floral-ring.html`
- `green-diamond-trilogy.html`
- `index.html`
- `jewellery-design.html`
- `lab-emerald-ring.html`
- `LG772667488.html`
- `LG781605782.html`
- `LG790687098.html`
- `necklaces.html`
- `price-match.html`
- `reviews.html`
- `ring-form.html`
- `ring-gallery.html`
- `ringpage.html`
- `robots.txt`
- `tantalum-ring.html`
- `thank-you.html`
- `trilogy-ring.html`

## 2. Existing schema problems found

- Repeated duplicate LADFOX entities using both `https://ladfox.com/#organization` and `https://ladfox.com/#jewelrystore`.
- Incomplete address markup using `Hatton Garden` as if it were a full postal address.
- Service pages marked up as `Product` via `makesOffer` or product-style offers when the visible page content was service-led.
- Some pages had no structured data at all.
- Some pages contained schema that did not align with visible content, including unsupported FAQ markup on pages without matching visible questions.
- Several pages referenced the LADFOX business with inconsistent `@id` values.
- Existing article schema used standalone `Organization` author and publisher nodes instead of the single LADFOX business entity required by the brief.
- Existing product/service pages mixed page entities and business entities inconsistently.
- `robots.txt` did not include an explicit `OAI-SearchBot` allow rule.

## 3. Files changed

- `about-us.html`
- `advice.html`
- `advice/where-to-buy-an-engagement-ring.html`
- `bracelets.html`
- `consultation.html`
- `contact-us.html`
- `create-your-own-ring.html`
- `diamonds.html`
- `faq.html`
- `floral-ring.html`
- `green-diamond-trilogy.html`
- `index.html`
- `jewellery-design.html`
- `lab-emerald-ring.html`
- `LG772667488.html`
- `LG781605782.html`
- `LG790687098.html`
- `necklaces.html`
- `price-match.html`
- `reviews.html`
- `ring-form.html`
- `ring-gallery.html`
- `ringpage.html`
- `robots.txt`
- `tantalum-ring.html`
- `thank-you.html`
- `trilogy-ring.html`

## 4. Schema types added to each page

- `index.html`: `JewelryStore`, `WebSite`, `WebPage`, `OfferCatalog`
- `about-us.html`: `JewelryStore`, `WebSite`, `WebPage`, `AboutPage`, `BreadcrumbList`
- `advice.html`: `JewelryStore`, `WebSite`, `WebPage`, `CollectionPage`, `BreadcrumbList`
- `advice/where-to-buy-an-engagement-ring.html`: `JewelryStore`, `WebSite`, `WebPage`, `Article`, `BreadcrumbList`
- `consultation.html`: `JewelryStore`, `WebSite`, `WebPage`, `Service`, `BreadcrumbList`
- `contact-us.html`: `JewelryStore`, `WebSite`, `WebPage`, `ContactPage`, `BreadcrumbList`
- `diamonds.html`: `JewelryStore`, `WebSite`, `WebPage`, `Service`, `BreadcrumbList`
- `faq.html`: `JewelryStore`, `WebSite`, `WebPage`, `FAQPage`, `BreadcrumbList`
- `jewellery-design.html`: `JewelryStore`, `WebSite`, `WebPage`, `Service`, `FAQPage`, `BreadcrumbList`
- `necklaces.html`: `JewelryStore`, `WebSite`, `WebPage`, `Service`, `BreadcrumbList`
- `price-match.html`: `JewelryStore`, `WebSite`, `WebPage`, `Service`, `BreadcrumbList`
- `reviews.html`: `JewelryStore`, `WebSite`, `WebPage`, `CollectionPage`, `BreadcrumbList`
- `ring-form.html`: `JewelryStore`, `WebSite`, `WebPage`, `BreadcrumbList`
- `ring-gallery.html`: `JewelryStore`, `WebSite`, `WebPage`, `CollectionPage`, `BreadcrumbList`
- `ringpage.html`: `JewelryStore`, `WebSite`, `WebPage`, `Service`, `BreadcrumbList`
- `create-your-own-ring.html`: `JewelryStore`, `WebSite`, `WebPage`, `BreadcrumbList`
- `floral-ring.html`: `JewelryStore`, `WebSite`, `WebPage`, `BreadcrumbList`
- `lab-emerald-ring.html`: `JewelryStore`, `WebSite`, `WebPage`, `BreadcrumbList`
- `trilogy-ring.html`: `JewelryStore`, `WebSite`, `WebPage`, `BreadcrumbList`
- `bracelets.html`: `JewelryStore`, `WebSite`, `WebPage`, `Product`, `BreadcrumbList`
- `green-diamond-trilogy.html`: `JewelryStore`, `WebSite`, `WebPage`, `Product`, `FAQPage`, `BreadcrumbList`
- `LG772667488.html`: `JewelryStore`, `WebSite`, `WebPage`, `Product`, `BreadcrumbList`
- `LG781605782.html`: `JewelryStore`, `WebSite`, `WebPage`, `Product`, `BreadcrumbList`
- `LG790687098.html`: `JewelryStore`, `WebSite`, `WebPage`, `Product`, `BreadcrumbList`
- `tantalum-ring.html`: `JewelryStore`, `WebSite`, `WebPage`, `Product`, `FAQPage`, `BreadcrumbList`
- `thank-you.html`: `JewelryStore`, `WebSite`, `WebPage`, `BreadcrumbList`

## 5. Duplicate entities removed

- Removed the sitewide duplicate `Organization` and `JewelryStore` split.
- Removed old references to `https://ladfox.com/#organization`.
- Removed old references to `https://ladfox.com/#jewelrystore`.
- Removed incomplete `PostalAddress` nodes that treated `Hatton Garden` as a full address.

## 6. The consistent IDs now being used

- Business: `https://ladfox.com/#business`
- Website: `https://ladfox.com/#website`
- Homepage WebPage: `https://ladfox.com/#webpage`
- Offer catalog: `https://ladfox.com/#offer-catalog`
- Page nodes: canonical URL plus `#webpage`
- Breadcrumb nodes: canonical URL plus `#breadcrumb`
- Page services and products: canonical URL plus a page-specific suffix such as `#consultation-service`, `#ring-design-service`, or `#product`

## 7. Details omitted because they could not be verified

- Full public street address
- Public opening hours
- Google Business Profile URL
- `sameAs` social-profile entries
- Aggregate ratings and review-star markup

## 8. Social URLs requiring confirmation

- `https://www.instagram.com/ladfox`
- `https://www.facebook.com/ladfox`

These appeared in old schema blocks but were not clearly verified elsewhere in visible site content, so they were omitted from the rebuilt JSON-LD.

## 9. Address details requiring confirmation

- A full LADFOX public operating address if one is intended to be published

`Hatton Garden` remains in visible copy where already present, but it is no longer used as a structured-data postal address.

## 10. Opening hours requiring confirmation

- Any appointment hours or public opening hours

No `openingHoursSpecification` was added.

## 11. Pages that may benefit from additional visible content

- `create-your-own-ring.html`
- `floral-ring.html`
- `lab-emerald-ring.html`
- `trilogy-ring.html`
- `ring-gallery.html`

These pages now use conservative `WebPage`-led markup because they are concept/configuration pages without strong visible editorial copy or full product data.

## 12. Product pages that still require genuine price or offer data

- `LG781605782.html`

This page visibly shows the diamond as sold, so the structured data keeps the `Product` but omits an `Offer` rather than inventing current price or availability details that are not visibly supported.

## 13. Any robots.txt changes

- Added:
  - `User-agent: OAI-SearchBot`
  - `Allow: /`
- Preserved:
  - existing `User-agent: *` rules
  - `Disallow: /private/`
  - existing sitemap reference `https://ladfox.com/sitemap.xml`

## 14. Any remaining validation concerns

- The LADFOX business and website entities are intentionally repeated across public pages under the same stable `@id` values. This is consistent entity reuse rather than conflicting duplication.
- The article page retains its visible published date of `2026-06-03`; if that date changes editorially, the schema should be updated to match.
- The site still contains Google review badge links that use a Google search-result URL rather than a clean verified Google Business Profile URL. Those visible links were preserved per brief, but the profile URL should be confirmed if LADFOX wants it in `sameAs` later.
- Browser-based JavaScript runtime checks were not executed in a real browser session here, so console-error validation remains a manual QA step.
