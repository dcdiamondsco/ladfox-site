#!/usr/bin/env python3
"""
Ladfox SEO updater

Run this script in the root folder of your Ladfox site, where files such as
index.html, about-us.html, bracelets.html, consultation.html, contact-us.html,
diamonds.html and faq.html are stored.

It makes subtle SEO and AI discoverability improvements without changing the
layout, CSS, section order or visual design.
"""

from __future__ import annotations

from pathlib import Path
import json
import re
import shutil
from datetime import datetime

ROOT = Path.cwd()
BACKUP = ROOT / ("backup-before-seo-update-" + datetime.now().strftime("%Y%m%d-%H%M%S"))

PAGES = {
    "index.html": {
        "title": "Bespoke Engagement Rings & Jewellery | Hatton Garden Jeweller | Ladfox",
        "description": "Private Hatton Garden jeweller creating bespoke engagement rings, wedding bands and custom jewellery with personal guidance, CAD design and lifetime warranty.",
        "og_title": "Bespoke Engagement Rings & Jewellery | Hatton Garden Jeweller | Ladfox",
        "og_description": "Private Hatton Garden jeweller creating bespoke engagement rings, wedding bands and custom jewellery with personal guidance, CAD design and lifetime warranty.",
        "twitter_title": "Bespoke Engagement Rings & Jewellery | Hatton Garden Jeweller | Ladfox",
        "twitter_description": "Private Hatton Garden jeweller creating bespoke engagement rings, wedding bands and custom jewellery with personal guidance, CAD design and lifetime warranty.",
        "replacements": {
            '<span class="eyebrow-hero">Private Hatton Garden Jeweller</span>': '<span class="eyebrow-hero">Private Hatton Garden Jeweller in London</span>',
            "<h1>Bespoke jewellery designed for the one you love</h1>": "<h1>Bespoke engagement rings and jewellery designed for the one you love</h1>",
            "Family run jeweller carefully creating thoughtful pieces with a personal service and a smoother experience from first idea to finished piece.": "Family run Hatton Garden jeweller carefully creating bespoke engagement rings, wedding bands and custom jewellery with personal guidance from first idea to finished piece.",
            '<span class="eyebrow">Our unique bespoke service</span>': '<span class="eyebrow">Our bespoke jewellery design service</span>',
            '<p class="routes-intro">All our pieces include international shipping, engraving, and a lifetime warranty.</p>': '<p class="routes-intro">Ladfox creates bespoke engagement rings and custom jewellery in London, with international shipping, engraving, and a lifetime warranty included.</p>',
            "<h3>Brief sketch and direction</h3>": "<h3>Brief sketch and bespoke design direction</h3>",
            "<h3>CAD and stone pairing</h3>": "<h3>CAD design and diamond selection</h3>",
            "<h3>Make finish and deliver</h3>": "<h3>Make, finish and deliver your jewellery</h3>",
            'alt="Ladfox jewellery campaign visual"': 'alt="Bespoke engagement ring campaign image by Ladfox Hatton Garden jeweller"',
            'alt="Sketch stage ring concept"': 'alt="Bespoke engagement ring sketch stage by Ladfox"',
            'alt="CAD stage ring design"': 'alt="CAD design for bespoke engagement ring"',
            'alt="Diamond selection stage"': 'alt="Diamond selection for bespoke engagement ring"',
            'alt="Google Reviews logo"': 'alt="Ladfox Google reviews badge"',
            'alt="Ladfox logo"': 'alt="Ladfox private Hatton Garden jeweller logo"',
            '<a href="ringpage.html">Rings</a>': '<a href="ringpage.html">Engagement Rings</a>',
            '<a href="diamonds.html">Diamonds</a>': '<a href="diamonds.html">Lab Grown Diamonds</a>',
            '<a href="consultation.html">Consultation</a>': '<a href="consultation.html">Free Consultation</a>',
            '<a class="btn btn-primary" href="ringpage.html">Get your free design</a>': '<a class="btn btn-primary" href="ringpage.html">Design your bespoke engagement ring</a>',
        },
    },
    "about-us.html": {
        "title": "About Ladfox | Bespoke Engagement Rings London | Hatton Garden Jeweller",
        "description": "Discover Ladfox, a private Hatton Garden jeweller creating bespoke engagement rings in London with expert diamond guidance, custom design and fair pricing.",
        "og_title": "About Ladfox | Bespoke Engagement Rings London | Hatton Garden Jeweller",
        "og_description": "Discover Ladfox, a private Hatton Garden jeweller creating bespoke engagement rings in London with expert diamond guidance, custom design and fair pricing.",
        "twitter_title": "About Ladfox | Bespoke Engagement Rings London | Hatton Garden Jeweller",
        "twitter_description": "Discover Ladfox, a private Hatton Garden jeweller creating bespoke engagement rings in London with expert diamond guidance, custom design and fair pricing.",
        "replacements": {
            "<h1>About Ladfox</h1>": "<h1>About Ladfox, a private Hatton Garden jeweller</h1>",
            "Ladfox is a private Hatton Garden jeweller specialising in bespoke engagement rings London clients can approach with confidence.": "Ladfox is a private Hatton Garden jeweller specialising in bespoke engagement rings in London, custom jewellery and carefully selected diamonds.",
            "<h2>A better alternative to traditional jewellery retail</h2>": "<h2>A better alternative to traditional jewellery retail in London</h2>",
            "<h2>Each ring begins with the details that actually matter</h2>": "<h2>Each bespoke ring begins with the details that actually matter</h2>",
            '<a class="btn btn-primary" href="contact-us.html">Make an enquiry</a>': '<a class="btn btn-primary" href="contact-us.html">Start a bespoke jewellery enquiry</a>',
            '<a class="btn btn-secondary" href="diamonds.html">Explore diamonds</a>': '<a class="btn btn-secondary" href="diamonds.html">Explore lab grown diamonds</a>',
            'alt="Ladfox"': 'alt="Ladfox private Hatton Garden jeweller logo"',
            'alt="Google Reviews logo"': 'alt="Ladfox Google reviews badge"',
        },
    },
    "bracelets.html": {
        "title": "Tennis Bracelet | Lab Diamond Bracelet London | Ladfox",
        "description": "Shop a refined tennis bracelet by Ladfox, set with round VVS lab grown diamonds and available in platinum, yellow gold or white gold.",
        "og_title": "Tennis Bracelet | Lab Diamond Bracelet London | Ladfox",
        "og_description": "Shop a refined tennis bracelet by Ladfox, set with round VVS lab grown diamonds and available in premium metal finishes.",
        "twitter_title": "Tennis Bracelet | Lab Diamond Bracelet London | Ladfox",
        "twitter_description": "Shop a refined tennis bracelet by Ladfox, set with round VVS lab grown diamonds and available in premium metal finishes.",
        "replacements": {
            "<html lang=\"en\">": '<html lang="en-GB">',
            "<h1>Tennis Bracelet</h1>": "<h1>Lab Diamond Tennis Bracelet</h1>",
            "A refined tennis bracelet set with round VVS lab diamonds and finished to a clean, classic profile.": "A refined tennis bracelet set with round VVS lab grown diamonds and finished to a clean, classic profile. Available in platinum, yellow gold and white gold.",
            'alt="Ladfox tennis bracelet in platinum"': 'alt="Ladfox lab diamond tennis bracelet in platinum"',
            'alt="Ladfox tennis bracelet in yellow gold"': 'alt="Ladfox lab diamond tennis bracelet in yellow gold"',
            'alt="Ladfox tennis bracelet in white gold"': 'alt="Ladfox lab diamond tennis bracelet in white gold"',
            "<h2>We design all kinds of necklaces.</h2>": "<h2>Looking for custom jewellery?</h2>",
            "<p>If you want something custom, we can design it properly around your brief.</p>": "<p>If you want a custom bracelet, necklace or bespoke jewellery design, we can design it properly around your brief.</p>",
            '<a class="btn btn-secondary" href="ringpage.html">Design custom</a>': '<a class="btn btn-secondary" href="consultation.html">Start a custom jewellery enquiry</a>',
            'alt="Ladfox"': 'alt="Ladfox private Hatton Garden jeweller logo"',
            'alt="Google Reviews logo"': 'alt="Ladfox Google reviews badge"',
        },
    },
    "consultation.html": {
        "title": "Bespoke Engagement Ring Consultation London | Hatton Garden Jeweller | Ladfox",
        "description": "Book a bespoke engagement ring consultation with Ladfox, a private Hatton Garden jeweller in London. Start by phone, email or WhatsApp.",
        "og_title": "Bespoke Engagement Ring Consultation London | Ladfox",
        "og_description": "Book a bespoke engagement ring consultation with Ladfox and speak directly with a private Hatton Garden jeweller.",
        "twitter_title": "Bespoke Engagement Ring Consultation London | Ladfox",
        "twitter_description": "Book a bespoke engagement ring consultation with Ladfox and speak directly with a private Hatton Garden jeweller.",
        "replacements": {
            '<link rel="canonical" href="https://ladfox.com/consultation" />': '<link rel="canonical" href="https://ladfox.com/consultation.html" />',
            'content="https://ladfox.com/consultation"': 'content="https://ladfox.com/consultation.html"',
            "<h1>Book a consultation</h1>": "<h1>Book a bespoke engagement ring consultation</h1>",
            "<p>Choose the most comfortable way to start your engagement ring enquiry.</p>": "<p>Choose the most comfortable way to start your bespoke engagement ring enquiry with Ladfox in London.</p>",
            "<h2>Book your consultation</h2>": "<h2>Book your private jewellery consultation</h2>",
            "Choose how you want to be contacted and give enough detail for a useful first reply.": "Most clients start with a quick WhatsApp message or the short form below. Give enough detail for a useful first reply.",
            'alt="Ladfox"': 'alt="Ladfox private Hatton Garden jeweller logo"',
            'alt="Google Reviews logo"': 'alt="Ladfox Google reviews badge"',
        },
    },
    "contact-us.html": {
        "title": "Contact Hatton Garden Jeweller | Bespoke Engagement Rings London | Ladfox",
        "description": "Contact Ladfox, a private Hatton Garden jeweller in London, about bespoke engagement rings, custom jewellery, diamond sourcing or a price match.",
        "og_title": "Contact Hatton Garden Jeweller | Bespoke Engagement Rings London | Ladfox",
        "og_description": "Contact Ladfox about bespoke engagement rings, custom jewellery, diamond sourcing or a price match.",
        "twitter_title": "Contact Hatton Garden Jeweller | Bespoke Engagement Rings London | Ladfox",
        "twitter_description": "Contact Ladfox about bespoke engagement rings, custom jewellery, diamond sourcing or a price match.",
        "replacements": {
            "<h1>Contact Ladfox</h1>": "<h1>Contact Ladfox, Hatton Garden jeweller</h1>",
            "<p>Choose the most comfortable way to start.</p>": "<p>Choose the most comfortable way to start your bespoke jewellery or engagement ring enquiry.</p>",
            "<h2>Contact us</h2>": "<h2>Contact Ladfox about your jewellery project</h2>",
            "Choose how you want to be contacted and give enough detail for a useful first reply.": "Most clients start with a quick WhatsApp message or the short form below. Give enough detail for a useful first reply.",
            'alt="Ladfox"': 'alt="Ladfox private Hatton Garden jeweller logo"',
            'alt="Google Reviews logo"': 'alt="Ladfox Google reviews badge"',
        },
    },
    "diamonds.html": {
        "title": "Lab Grown Diamonds London | Diamond Sourcing Hatton Garden | Ladfox",
        "description": "Source natural or lab grown diamonds in London with Ladfox. Get tailored diamond recommendations based on shape, carat, colour, clarity and budget.",
        "og_title": "Lab Grown Diamonds London | Diamond Sourcing Hatton Garden | Ladfox",
        "og_description": "Share your diamond brief with Ladfox and get a tailored recommendation for a natural or lab grown diamond.",
        "twitter_title": "Lab Grown Diamonds London | Diamond Sourcing Hatton Garden | Ladfox",
        "twitter_description": "Share your diamond brief with Ladfox and get a tailored recommendation for a natural or lab grown diamond.",
        "replacements": {
            '<h1 class="spotlight-title" id="spotlight-diamonds-title">Spotlight Diamonds</h1>': '<h1 class="spotlight-title" id="spotlight-diamonds-title">Lab Grown Diamonds and Diamond Sourcing</h1>',
            "<h2>Diamond sourcing</h2>": "<h2>Diamond sourcing in London</h2>",
            "We only supply high quality stones with top tier spec, strong visual performance, and final Ladfox approval before anything is recommended.": "We source natural and lab grown diamonds with strong visual performance, carefully checked proportions and final Ladfox approval before anything is recommended.",
            'alt="1ct round LG781605782 diamond"': 'alt="1ct round lab grown diamond LG781605782 by Ladfox"',
            'alt="1.6ct oval diamond"': 'alt="1.6ct oval lab grown diamond by Ladfox"',
            'alt="Emerald cut diamond"': 'alt="2.06ct emerald cut lab grown diamond by Ladfox"',
            'alt="Ladfox"': 'alt="Ladfox private Hatton Garden jeweller logo"',
            'alt="Google Reviews logo"': 'alt="Ladfox Google reviews badge"',
        },
    },
    "faq.html": {
        "title": "FAQ | Bespoke Engagement Rings London | Lab Grown Diamonds | Ladfox",
        "description": "Answers about bespoke engagement rings in London, lab grown diamonds, pricing, timelines, ring design, delivery and aftercare from Ladfox.",
        "og_title": "FAQ | Bespoke Engagement Rings London | Lab Grown Diamonds | Ladfox",
        "og_description": "Answers to common questions about bespoke engagement rings in London, lab grown diamonds, pricing, timelines, ring design, delivery and aftercare from Ladfox.",
        "twitter_title": "FAQ | Bespoke Engagement Rings London | Lab Grown Diamonds | Ladfox",
        "twitter_description": "Answers to common questions about bespoke engagement rings in London, lab grown diamonds, pricing, timelines, ring design, delivery and aftercare from Ladfox.",
        "replacements": {
            "<h1>FAQ</h1>": "<h1>Bespoke Engagement Ring FAQ</h1>",
            'alt="Ladfox"': 'alt="Ladfox private Hatton Garden jeweller logo"',
            'alt="Google Reviews logo"': 'alt="Ladfox Google reviews badge"',
            '<a href="engagement-rings.html">engagement rings</a>': '<a href="ringpage.html">engagement rings</a>',
            '<a href="diamond-finder.html">diamond finder</a>': '<a href="diamonds.html">diamond sourcing</a>',
        },
    },
}

BASE_ORGANIZATION_SCHEMA = {
    "@context": "https://schema.org",
    "@graph": [
        {
            "@type": "Organization",
            "@id": "https://ladfox.com/#organization",
            "name": "Ladfox",
            "url": "https://ladfox.com/",
            "logo": "https://ladfox.com/Images/ladfox-logo.png",
            "image": "https://ladfox.com/Images/og-banner.jpg",
            "telephone": "+447853362904",
            "sameAs": [
                "https://www.instagram.com/ladfox",
                "https://www.facebook.com/ladfox",
            ],
        },
        {
            "@type": "JewelryStore",
            "@id": "https://ladfox.com/#jewelrystore",
            "name": "Ladfox",
            "url": "https://ladfox.com/",
            "image": "https://ladfox.com/Images/og-banner.jpg",
            "telephone": "+447853362904",
            "description": "Private Hatton Garden jeweller creating bespoke engagement rings, wedding bands, lab grown diamond rings and custom jewellery with one to one guidance.",
            "address": {
                "@type": "PostalAddress",
                "addressLocality": "Hatton Garden",
                "addressRegion": "London",
                "addressCountry": "GB",
            },
            "areaServed": [
                "London",
                "Hatton Garden",
                "United Kingdom",
                "International",
            ],
            "priceRange": "Premium",
        },
    ],
}

EXTRA_SCHEMA_BY_PAGE = {
    "index.html": [
        {
            "@type": "WebSite",
            "@id": "https://ladfox.com/#website",
            "name": "Ladfox",
            "url": "https://ladfox.com/",
            "publisher": {"@id": "https://ladfox.com/#organization"},
        },
        {
            "@type": "Service",
            "@id": "https://ladfox.com/#bespoke-jewellery-service",
            "name": "Bespoke engagement rings and jewellery",
            "serviceType": "Bespoke jewellery design",
            "provider": {"@id": "https://ladfox.com/#jewelrystore"},
            "areaServed": "GB",
            "description": "Bespoke engagement rings, wedding bands and custom jewellery designed with private one to one guidance from a Hatton Garden jeweller.",
        },
        {
            "@type": "FAQPage",
            "@id": "https://ladfox.com/#faq",
            "mainEntity": [
                {
                    "@type": "Question",
                    "name": "What does Ladfox do?",
                    "acceptedAnswer": {
                        "@type": "Answer",
                        "text": "Ladfox is a private Hatton Garden jeweller creating bespoke engagement rings, wedding bands and custom jewellery with one to one guidance.",
                    },
                },
                {
                    "@type": "Question",
                    "name": "Can I design a ring from scratch?",
                    "acceptedAnswer": {
                        "@type": "Answer",
                        "text": "Yes. Ladfox can begin with a rough idea, inspiration images or an existing quote, then develop the piece through sketch, CAD design and stone selection.",
                    },
                },
                {
                    "@type": "Question",
                    "name": "Do Ladfox offer lab grown diamonds?",
                    "acceptedAnswer": {
                        "@type": "Answer",
                        "text": "Yes. Ladfox can source carefully selected lab grown diamonds for bespoke engagement rings and custom jewellery.",
                    },
                },
            ],
        },
    ],
    "diamonds.html": [
        {
            "@type": "Service",
            "@id": "https://ladfox.com/diamonds.html#diamond-sourcing",
            "name": "Diamond sourcing",
            "serviceType": "Natural and lab grown diamond sourcing",
            "provider": {"@id": "https://ladfox.com/#jewelrystore"},
            "description": "Diamond sourcing for natural and lab grown diamonds with tailored recommendations based on shape, carat, colour, clarity, proportions and budget.",
        },
        {
            "@type": "FAQPage",
            "@id": "https://ladfox.com/diamonds.html#faq",
            "mainEntity": [
                {
                    "@type": "Question",
                    "name": "Are lab grown diamonds real diamonds?",
                    "acceptedAnswer": {
                        "@type": "Answer",
                        "text": "Yes. Lab grown diamonds have the same physical and chemical properties as natural diamonds. The main difference is origin.",
                    },
                },
                {
                    "@type": "Question",
                    "name": "Does Ladfox source natural and lab grown diamonds?",
                    "acceptedAnswer": {
                        "@type": "Answer",
                        "text": "Yes. Ladfox can advise on natural and lab grown diamonds based on the brief, budget and intended jewellery design.",
                    },
                },
            ],
        },
    ],
    "consultation.html": [
        {
            "@type": "Service",
            "@id": "https://ladfox.com/consultation.html#consultation",
            "name": "Bespoke engagement ring consultation",
            "serviceType": "Jewellery consultation",
            "provider": {"@id": "https://ladfox.com/#jewelrystore"},
            "description": "Private consultation for bespoke engagement rings, custom jewellery, diamond sourcing and ring design.",
        }
    ],
    "contact-us.html": [
        {
            "@type": "ContactPage",
            "@id": "https://ladfox.com/contact-us.html#contact",
            "name": "Contact Ladfox",
            "url": "https://ladfox.com/contact-us.html",
        }
    ],
    "bracelets.html": [
        {
            "@type": "Product",
            "@id": "https://ladfox.com/bracelets.html#tennis-bracelet",
            "name": "Lab Diamond Tennis Bracelet",
            "image": "https://ladfox.com/Images/products/Tennis%20Bracelet%20Platinum.png",
            "description": "A refined tennis bracelet set with round VVS lab grown diamonds, available in platinum, yellow gold and white gold.",
            "brand": {"@type": "Brand", "name": "Ladfox"},
            "offers": {
                "@type": "Offer",
                "price": "1999.00",
                "priceCurrency": "GBP",
                "availability": "https://schema.org/InStock",
                "url": "https://ladfox.com/bracelets.html",
            },
        }
    ],
    "about-us.html": [
        {
            "@type": "AboutPage",
            "@id": "https://ladfox.com/about-us.html#about",
            "name": "About Ladfox",
            "url": "https://ladfox.com/about-us.html",
        }
    ],
}


def replace_tag(html: str, pattern: str, replacement: str) -> str:
    updated, count = re.subn(pattern, replacement, html, count=1, flags=re.I | re.S)
    return updated if count else html


def replace_title(html: str, title: str) -> str:
    return replace_tag(html, r"<title>.*?</title>", f"<title>{title}</title>")


def upsert_meta_name(html: str, name: str, content: str) -> str:
    pattern = rf'<meta\b[^>]*name="{re.escape(name)}"[^>]*content="[^"]*"[^>]*\/?>'
    repl = f'<meta name="{name}" content="{content}" />'
    updated, count = re.subn(pattern, repl, html, count=1, flags=re.I | re.S)
    if count:
        return updated
    return html.replace("</head>", f"  {repl}\n</head>", 1)


def upsert_meta_property(html: str, prop: str, content: str) -> str:
    pattern = rf'<meta\b[^>]*property="{re.escape(prop)}"[^>]*content="[^"]*"[^>]*\/?>'
    repl = f'<meta property="{prop}" content="{content}" />'
    updated, count = re.subn(pattern, repl, html, count=1, flags=re.I | re.S)
    if count:
        return updated
    return html.replace("</head>", f"  {repl}\n</head>", 1)


def remove_ld_json(html: str) -> str:
    return re.sub(
        r"\s*<script\s+type=\"application/ld\+json\">\s*.*?\s*</script>",
        "",
        html,
        flags=re.I | re.S,
    )


def schema_for_page(filename: str) -> str:
    graph = list(BASE_ORGANIZATION_SCHEMA["@graph"])
    graph.extend(EXTRA_SCHEMA_BY_PAGE.get(filename, []))
    data = {"@context": "https://schema.org", "@graph": graph}
    return '<script type="application/ld+json">\n' + json.dumps(data, ensure_ascii=False, indent=2) + "\n  </script>"


def insert_schema(html: str, filename: str) -> str:
    html = remove_ld_json(html)
    schema = schema_for_page(filename)
    return html.replace("</head>", f"  {schema}\n</head>", 1)


def add_homepage_faq_visible(html: str) -> str:
    if "Bespoke jewellery questions" in html:
        return html
    block = """
    <section class="testimonials" aria-label="Bespoke jewellery questions">
      <div class="testimonials-head">
        <h2>Bespoke jewellery questions</h2>
        <p><strong>What does Ladfox do?</strong> Ladfox is a private Hatton Garden jeweller creating bespoke engagement rings, wedding bands and custom jewellery with one to one guidance.</p>
        <p><strong>Can I design a ring from scratch?</strong> Yes. Ladfox can begin with a rough idea, inspiration images or an existing quote, then develop the piece through sketch, CAD design and stone selection.</p>
        <p><strong>Do Ladfox offer lab grown diamonds?</strong> Yes. Ladfox can source carefully selected lab grown diamonds for bespoke engagement rings and custom jewellery.</p>
      </div>
    </section>
"""
    return html.replace("  </main>", block + "\n  </main>", 1)


def add_trust_line_bracelets(html: str) -> str:
    if "Lifetime warranty · Insured UK delivery · 14 day returns" in html:
        return html
    marker = (
        '<div class="actions">\n'
        '              <a class="btn btn-primary" id="braceletBuyButton" href="https://buy.stripe.com/5kQ3cv5Elc7c5z4ctc8ww04" target="_blank" rel="noopener">Buy</a>\n'
        "            </div>"
    )
    replacement = (
        '<div class="actions">\n'
        '              <a class="btn btn-primary" id="braceletBuyButton" href="https://buy.stripe.com/5kQ3cv5Elc7c5z4ctc8ww04" target="_blank" rel="noopener">Buy</a>\n'
        '              <p style="margin:10px 0 0; color:rgba(255,255,255,.7); font-size:.9rem;">Lifetime warranty · Insured UK delivery · 14 day returns</p>\n'
        "            </div>"
    )
    return html.replace(marker, replacement, 1)


def add_diamonds_internal_links(html: str) -> str:
    if "bespoke engagement ring consultation" in html:
        return html
    block = """
        <p class="form-copy">
          Looking for a finished piece as well as a stone? Start a <a href="consultation.html" style="text-decoration:underline;text-underline-offset:4px;">bespoke engagement ring consultation</a> or read more about <a href="about-us.html" style="text-decoration:underline;text-underline-offset:4px;">Ladfox as a private Hatton Garden jeweller</a>.
        </p>
"""
    return html.replace('<div id="diamondContent" class="form-card">', block + '\n        <div id="diamondContent" class="form-card">', 1)


def process_page(path: Path, settings: dict[str, object]) -> None:
    html = path.read_text(encoding="utf-8")
    html = replace_title(html, settings["title"])
    html = upsert_meta_name(html, "description", settings["description"])
    html = upsert_meta_property(html, "og:title", settings["og_title"])
    html = upsert_meta_property(html, "og:description", settings["og_description"])
    html = upsert_meta_name(html, "twitter:title", settings["twitter_title"])
    html = upsert_meta_name(html, "twitter:description", settings["twitter_description"])

    for old, new in settings.get("replacements", {}).items():
        html = html.replace(old, new)

    html = insert_schema(html, path.name)

    if path.name == "index.html":
        html = add_homepage_faq_visible(html)
    if path.name == "bracelets.html":
        html = add_trust_line_bracelets(html)
    if path.name == "diamonds.html":
        html = add_diamonds_internal_links(html)

    path.write_text(html, encoding="utf-8")


def main() -> None:
    BACKUP.mkdir(exist_ok=True)
    changed: list[str] = []
    missing: list[str] = []

    for filename, settings in PAGES.items():
        path = ROOT / filename
        if not path.exists():
            missing.append(filename)
            continue
        shutil.copy2(path, BACKUP / filename)
        process_page(path, settings)
        changed.append(filename)

    print("SEO update complete.")
    print("Updated files:", ", ".join(changed) if changed else "None")
    if missing:
        print("Missing files skipped:", ", ".join(missing))
    print("Backup folder:", BACKUP.name)


if __name__ == "__main__":
    main()
