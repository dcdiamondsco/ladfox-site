import json
import os
import time
from pathlib import Path

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service

BASE = os.environ.get("LADFOX_AUDIT_BASE", "http://127.0.0.1:4173/").rstrip("/") + "/"
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "tmp" / "publication-ui"
OUT.mkdir(parents=True, exist_ok=True)

PAGES = [
    "index.html",
    "ringpage.html",
    "classic-collection.html",
    "classic-solitaire.html",
    "trilogy-ring.html",
    "cad-service.html",
    "contact-us.html",
    "diamonds.html",
    "ring-gallery.html",
    "bracelets.html",
    "terms-and-conditions.html",
]
VIEWPORTS = {"mobile": (390, 844), "tablet": (768, 1024), "desktop": (1440, 1000)}

options = webdriver.ChromeOptions()
options.binary_location = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
options.add_argument("--headless=new")
options.add_argument("--disable-gpu")
options.add_argument("--hide-scrollbars")
options.add_argument("--no-first-run")
options.add_argument("--disable-background-networking")
options.set_capability("goog:loggingPrefs", {"browser": "ALL"})

results = []
driver = webdriver.Chrome(
    service=Service(r"C:\Users\dj_dm\.cache\selenium\chromedriver\win64\155.0.8059.79\chromedriver.exe"),
    options=options,
)
try:
    for viewport_name, (width, height) in VIEWPORTS.items():
        driver.execute_cdp_cmd("Emulation.setDeviceMetricsOverride", {
            "width": width, "height": height, "deviceScaleFactor": 1, "mobile": width <= 480,
        })
        for page in PAGES:
            driver.get(BASE + page + "?publication-audit=1")
            time.sleep(0.6)
            measurements = driver.execute_script("""
                const visible = el => {
                  const s = getComputedStyle(el), r = el.getBoundingClientRect();
                  return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0 && r.height > 0;
                };
                const brokenImages = [...document.images]
                  .filter(img => visible(img) && img.currentSrc && img.complete && img.naturalWidth === 0)
                  .map(img => ({src: img.getAttribute('src'), alt: img.alt}));
                const unlabeled = [...document.querySelectorAll('input,select,textarea')]
                  .filter(el => visible(el) && el.type !== 'hidden' && el.type !== 'submit' && el.type !== 'button')
                  .filter(el => !(el.labels && el.labels.length) && !el.getAttribute('aria-label') && !el.getAttribute('aria-labelledby'))
                  .map(el => ({tag: el.tagName, id: el.id, name: el.name, type: el.type}));
                return {
                  title: document.title,
                  readyState: document.readyState,
                  clientWidth: document.documentElement.clientWidth,
                  scrollWidth: document.documentElement.scrollWidth,
                  overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
                  brokenImages,
                  unlabeled,
                  h1Count: document.querySelectorAll('h1').length,
                  formCount: document.forms.length,
                  cookiePopupCount: [...document.querySelectorAll('.cookie-consent,[data-cookie-accept],[data-cookie-reject]')].filter(visible).length,
                  nineKaratOptionCount: [...document.querySelectorAll('[data-option-value="9k"]')].filter(visible).length,
                };
            """)
            severe = [entry for entry in driver.get_log("browser") if entry["level"] == "SEVERE"]
            measurements.update({"page": page, "viewport": viewport_name, "severeConsole": severe})
            results.append(measurements)
            if page in {"index.html", "classic-collection.html", "classic-solitaire.html", "ringpage.html", "contact-us.html"}:
                driver.save_screenshot(str(OUT / f"{Path(page).stem}-{viewport_name}.png"))

    # Non-submitting interaction checks.
    driver.execute_cdp_cmd("Emulation.setDeviceMetricsOverride", {
        "width": 390, "height": 844, "deviceScaleFactor": 1, "mobile": True,
    })
    driver.get(BASE + "index.html?publication-audit=interaction")
    time.sleep(0.5)
    menu = driver.find_element(By.CSS_SELECTOR, ".menu-toggle")
    menu.click()
    results.append({"interaction": "homepage menu", "expanded": menu.get_attribute("aria-expanded"),
                    "panelHidden": driver.find_element(By.ID, "home-menu-panel").get_attribute("hidden")})

    driver.get(BASE + "cad-service.html?publication-audit=interaction")
    time.sleep(0.5)
    trigger = driver.find_element(By.CSS_SELECTOR, "[data-cad-image]")
    driver.execute_script("arguments[0].click()", trigger)
    box = driver.find_element(By.CSS_SELECTOR, "[data-lightbox]")
    results.append({"interaction": "CAD lightbox open", "hidden": box.get_attribute("hidden"),
                    "imageSrc": box.find_element(By.TAG_NAME, "img").get_attribute("src")})
    driver.find_element(By.CSS_SELECTOR, ".lightbox-close").click()
    results.append({"interaction": "CAD lightbox close", "hidden": box.get_attribute("hidden")})

    driver.get(BASE + "classic-solitaire.html?publication-audit=interaction")
    time.sleep(1)
    results.append({"interaction": "Classic Solitaire configurator", "selected": driver.execute_script("""
        return [...document.querySelectorAll('.option-pill.is-selected,[aria-pressed="true"]')]
          .slice(0, 8).map(el => el.textContent.trim() || el.getAttribute('aria-label'));
    """), "checkoutText": driver.find_element(By.CSS_SELECTOR, "[data-checkout-label]").text,
      "diamondSpec": driver.execute_script("""
        const details = document.querySelector('[data-diamond-specification]');
        return {open: details.open, summary: details.querySelector('summary').innerText,
          colour: document.querySelector('#signatureColour').value,
          clarity: document.querySelector('#signatureClarity').value};
      """)})
finally:
    driver.quit()

(OUT / "results.json").write_text(json.dumps(results, indent=2), encoding="utf-8")
print(json.dumps(results, indent=2))
