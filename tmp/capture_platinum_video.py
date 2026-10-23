import os
import time
from pathlib import Path
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service

base = os.environ["LADFOX_AUDIT_BASE"].rstrip("/")
out = Path(__file__).resolve().parent / "platinum-video-draft.png"
options = webdriver.ChromeOptions()
options.binary_location = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
options.add_argument("--headless=new")
options.add_argument("--disable-gpu")
options.add_argument("--window-size=1440,1000")
driver = webdriver.Chrome(
    service=Service(r"C:\Users\dj_dm\.cache\selenium\chromedriver\win64\155.0.8059.79\chromedriver.exe"),
    options=options,
)
try:
    driver.get(base + "/")
    video = driver.find_element(By.CSS_SELECTOR, ".hp-media--platinum-final video")
    driver.execute_script("arguments[0].scrollIntoView({block:'center'}); arguments[0].play();", video)
    time.sleep(1.5)
    video.find_element(By.XPATH, "..").screenshot(str(out))
    print({"objectPosition": driver.execute_script("return getComputedStyle(arguments[0]).objectPosition", video), "screenshot": str(out)})
finally:
    driver.quit()
