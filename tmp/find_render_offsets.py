import re
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from io import BytesIO
from pathlib import Path
from PIL import Image, ImageChops, ImageFilter, ImageStat

ROOT = Path(__file__).resolve().parents[1]
HTML = (ROOT / "classic-solitaire.html").read_text(encoding="utf-8")
BASE = "https://image25.thepersonalizedbest.com/image/api_image61/"
CARATS = [0.33, 0.5, 0.75, 1, 1.5, 2, 2.5, 3, 4, 5, 6]
FAMILIES = [("yellowGold", "9k"), ("yellowGold", "14k"), ("yellowGold", "18k"),
            ("whiteGold", "9k"), ("whiteGold", "14k"), ("whiteGold", "18k"),
            ("roseGold", "9k"), ("roseGold", "14k"), ("roseGold", "18k")]
GROUP = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
SHAPE = "BGLQV16"

collection = HTML.split("const SIGNATURE_COLLECTION_IMAGES = ", 1)[1].split("const SIGNATURE_RENDERS", 1)[0]
mapping = {}
for index, (metal, purity) in enumerate(FAMILIES):
    metal_start = collection.index(f"{metal}: {{")
    next_starts = [collection.find(f"{candidate}: {{", metal_start + 1) for candidate in ("yellowGold", "whiteGold", "roseGold")]
    next_starts = [value for value in next_starts if value >= 0]
    metal_end = min(next_starts) if next_starts else len(collection)
    block = collection[metal_start:metal_end]
    values = re.search(rf'"{purity}":\s*\{{([^}}]+)\}}', block).group(1)
    mapping[(metal, purity)] = dict(re.findall(r'(\w+):"([A-Z0-9]+)"', values))

platinum_block = HTML.split("platinum: {", 1)[1].split("},\n    yellowGold", 1)[0]
platinum_round = dict((float(size), image_id) for size, image_id in re.findall(r'(\d+(?:\.\d+)?):"([A-Z0-9]+)"', re.search(r'round:\s*\{([^}]+)\}', platinum_block).group(1)))

def decode(image_id):
    start = len(image_id) - 9
    return ((GROUP.index(image_id[start]) * len(GROUP)) + GROUP.index(image_id[start + 1])) * len(SHAPE) + SHAPE.index(image_id[start + 2])

def encode(value):
    shape = value % len(SHAPE)
    group = value // len(SHAPE)
    return f"{GROUP[group // len(GROUP)]}{GROUP[group % len(GROUP)]}{SHAPE[shape]}"

def replace_variant(image_id, value):
    start = len(image_id) - 9
    return f"{image_id[:start]}{encode(value)}{image_id[start + 3:]}"

def fetch(image_id):
    with urllib.request.urlopen(f"{BASE}{image_id}.jpg?v=1", timeout=20) as response:
        return Image.open(BytesIO(response.read())).convert("L").resize((128, 128)).filter(ImageFilter.FIND_EDGES)

def difference(left, right):
    return sum(ImageStat.Stat(ImageChops.difference(left, right)).mean)

platinum_one = decode(platinum_round[1])
reference_base = mapping[("yellowGold", "9k")]["round"]
jobs = []
for carat in CARATS:
    if carat not in platinum_round:
        continue
    platinum_delta = decode(platinum_round[carat]) - platinum_one
    reference_id = replace_variant(reference_base, decode(reference_base) + platinum_delta)
    jobs.append(("reference", carat, 0, reference_id))
    for family in FAMILIES[1:]:
        base_id = mapping[family]["round"]
        predicted = decode(base_id) + platinum_delta
        for correction in range(-10, 11):
            jobs.append((family, carat, correction, replace_variant(base_id, predicted + correction)))

def run(job):
    return (*job[:3], job[3], fetch(job[3]))

with ThreadPoolExecutor(max_workers=20) as pool:
    results = list(pool.map(run, jobs))

references = {carat: image for family, carat, correction, image_id, image in results if family == "reference"}
best = {}
for family, carat, correction, image_id, image in results:
    if family == "reference":
        continue
    score = difference(references[carat], image)
    current = best.get((family, carat))
    if current is None or score < current[0]:
        best[(family, carat)] = (score, correction, image_id)

for family in FAMILIES[1:]:
    print(f"{family[0]} {family[1]}")
    print(" ".join(f"{carat:g}:{best[(family, carat)][1]:+d}" for carat in CARATS if (family, carat) in best))
