import os
import time
from selenium import webdriver
from selenium.webdriver.chrome.service import Service

expected = {
  "Gold": ["6FQ5XKV6B0L1M9A","6FQ5XKV6Q0L1M9A","6FQ5XKV6L0L1M9A","6FQ5XKV6G0L1M9A","6FQ5XKV610L1M9A","6FQ5XKV6V0L1M9A","6FQ5XKV660L1M9A","6FQ5XKV7B0L1M9A"],
  "White Gold": ["6QB0L1M9A","6QQ0L1M9A","6QL0L1M9A","6QG0L1M9A","6Q10L1M9A","6QV0L1M9A","6Q60L1M9A","6RB0L1M9A"],
  "Rose Gold": ["6K81LVILB0L1M9A","6K81LVILQ0L1M9A","6K81LVILL0L1M9A","6K81LVILG0L1M9A","6K81LVIL10L1M9A","6K81LVILV0L1M9A","6K81LVIL60L1M9A","6K81LVIMB0L1M9A"]
}
shapes = ["Round","Oval","Cushion","Princess","Pear","Emerald","Marquise","Radiant"]
options = webdriver.ChromeOptions()
options.binary_location = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
options.add_argument("--headless=new")
options.add_argument("--disable-gpu")
driver = webdriver.Chrome(service=Service(r"C:\Users\dj_dm\.cache\selenium\chromedriver\win64\155.0.8059.79\chromedriver.exe"), options=options)
failures = []
try:
  driver.get(os.environ["LADFOX_AUDIT_BASE"].rstrip("/") + "/classic-solitaire.html?verify-9k=1")
  time.sleep(1)
  for metal, ids in expected.items():
    for shape, image_id in zip(shapes, ids):
      driver.execute_script("""
        const click = (slider, value) => document.querySelector(`[data-option-slider="${slider}"] [data-option-value="${value}"]`).click();
        click('signatureMetalBase', arguments[0]); click('signatureMetalKarat', '9k'); click('signatureShape', arguments[1]);
      """, metal, shape)
      time.sleep(.15)
      source = driver.execute_script('return document.querySelector(\'[data-render-thumb="1"]\').dataset.nivodaSource || ""')
      if image_id not in source:
        failures.append({"metal": metal, "shape": shape, "expected": image_id, "source": source})
  print({"checked": 24, "failures": failures})
finally:
  driver.quit()
