import os
import time
from selenium import webdriver
from selenium.webdriver.chrome.service import Service

metals = ["Gold", "White Gold", "Rose Gold"]
purities = ["9k", "14k", "18k"]
shapes = ["Round", "Oval", "Cushion", "Princess", "Pear", "Emerald", "Marquise", "Radiant"]

options = webdriver.ChromeOptions()
options.binary_location = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
options.add_argument("--headless=new")
options.add_argument("--disable-gpu")
driver = webdriver.Chrome(
    service=Service(r"C:\Users\dj_dm\.cache\selenium\chromedriver\win64\155.0.8059.79\chromedriver.exe"),
    options=options,
)
failures = []
checked = 0
try:
    driver.get(os.environ["LADFOX_AUDIT_BASE"].rstrip("/") + "/classic-solitaire.html?verify-gold-sizes=1")
    time.sleep(1)
    for metal in metals:
        for purity in purities:
            for shape in shapes:
                driver.execute_script("""
                  const click = (slider, value) => document.querySelector(`[data-option-slider="${slider}"] [data-option-value="${value}"]`).click();
                  click('signatureMetalBase', arguments[0]);
                  click('signatureMetalKarat', arguments[1]);
                  click('signatureShape', arguments[2]);
                  const standard = document.querySelector('[data-option-slider="signatureElongated"] [data-option-value="No"]');
                  if (standard && !standard.hidden) standard.click();
                """, metal, purity, shape)
                time.sleep(.08)
                result = driver.execute_async_script("""
                  const done = arguments[arguments.length - 1];
                  const range = document.querySelector('[data-size-range="signatureStoneSize"]');
                  const thumb = document.querySelector('[data-render-thumb="1"]');
                  const read = () => thumb.dataset.nivodaSource || '';
                  const choose = async (value) => {
                    const prior = read();
                    range.value = String(value);
                    range.dispatchEvent(new Event('input', {bubbles:true}));
                    const started = performance.now();
                    while (performance.now() - started < 4000) {
                      if (read() && read() !== prior && thumb.complete && thumb.naturalWidth > 0) return read();
                      await new Promise(resolve => setTimeout(resolve, 40));
                    }
                    return read();
                  };
                  (async () => {
                    const smallest = await choose(range.min);
                    const largest = await choose(range.max);
                    done({smallest, largest, min:range.min, max:range.max, loaded:thumb.naturalWidth > 0});
                  })();
                """)
                checked += 1
                if not result["smallest"] or not result["largest"] or result["smallest"] == result["largest"] or not result["loaded"]:
                    failures.append({"metal": metal, "purity": purity, "shape": shape, **result})
    print({"checked": checked, "failures": failures})
finally:
    driver.quit()
