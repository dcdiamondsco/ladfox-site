import json, time
from selenium import webdriver
from selenium.webdriver.chrome.service import Service

options = webdriver.ChromeOptions()
options.binary_location = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
options.add_argument("--headless=new")
driver = webdriver.Chrome(service=Service(r"C:\Users\dj_dm\.cache\selenium\chromedriver\win64\155.0.8059.79\chromedriver.exe"), options=options)
out = []
try:
    for page, widths in {"contact-us.html": [390, 768], "cad-service.html": [390, 768, 1440]}.items():
        for width in widths:
            driver.execute_cdp_cmd("Emulation.setDeviceMetricsOverride", {"width": width, "height": 900, "deviceScaleFactor": 1, "mobile": width <= 480})
            driver.get(f"http://127.0.0.1:4173/{page}?overflow-probe=1")
            time.sleep(.4)
            offenders = driver.execute_script("""
              const vw = document.documentElement.clientWidth;
              return [...document.querySelectorAll('body *')].map(el => {
                const r = el.getBoundingClientRect(), s = getComputedStyle(el);
                return {tag:el.tagName, cls:el.className, id:el.id, left:r.left, right:r.right, width:r.width,
                        display:s.display, position:s.position, overflowX:s.overflowX};
              }).filter(x => x.width > 0 && (x.right > vw + 2 || x.left < -2))
                .sort((a,b) => (b.right-vw) - (a.right-vw)).slice(0,20);
            """)
            before = driver.execute_script("return document.documentElement.scrollWidth")
            after_fixed = driver.execute_script("""
              document.querySelectorAll('.cookie-consent,.quick-message-bubble,.quick-message-callout').forEach(el => el.remove());
              return document.documentElement.scrollWidth;
            """)
            without_intro_art = driver.execute_script("""
              const style=document.createElement('style'); style.textContent='.intro::before{display:none!important}.atelier::after{display:none!important}';
              document.head.append(style); return document.documentElement.scrollWidth;
            """)
            out.append({"page":page,"width":width,"scrollWidth":before,"withoutFixed":after_fixed,"withoutArt":without_intro_art,"offenders":offenders})
finally:
    driver.quit()
print(json.dumps(out, indent=2))
