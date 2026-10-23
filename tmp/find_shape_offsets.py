import json
import re
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from io import BytesIO
from pathlib import Path
from PIL import Image, ImageChops, ImageFilter, ImageStat

ROOT = Path(__file__).resolve().parents[1]
HTML = (ROOT / "classic-solitaire.html").read_text(encoding="utf-8")
BASE = "https://image25.thepersonalizedbest.com/image/api_image61/"
SHAPES = ["round", "oval", "cushion", "princess", "pear", "emerald", "marquise", "radiant"]
FAMILIES = [("yellowGold", "9k"), ("yellowGold", "14k"), ("yellowGold", "18k"),
            ("whiteGold", "9k"), ("whiteGold", "14k"), ("whiteGold", "18k"),
            ("roseGold", "9k"), ("roseGold", "14k"), ("roseGold", "18k")]
GROUP = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
SHAPE_DIGITS = "BGLQV16"

collection = HTML.split("const SIGNATURE_COLLECTION_IMAGES = ", 1)[1].split("const SIGNATURE_RENDERS", 1)[0]
mapping = {}
metal_positions = {metal: collection.index(f"{metal}: {{") for metal in ("yellowGold", "whiteGold", "roseGold")}
ordered_metals = sorted(metal_positions, key=metal_positions.get)
for metal in ordered_metals:
    start = metal_positions[metal]
    following = [metal_positions[candidate] for candidate in ordered_metals if metal_positions[candidate] > start]
    block = collection[start:min(following) if following else len(collection)]
    for purity, values in re.findall(r'"(9k|14k|18k)":\s*\{([^}]+)\}', block):
        mapping[(metal, purity)] = dict(re.findall(r'(\w+):"([A-Z0-9]+)"', values))

platinum_block = HTML.split("platinum: {", 1)[1].split("},\n    yellowGold", 1)[0]
platinum = {}
for shape, values in re.findall(r'(\w+):\s*\{([^}]+)\}', platinum_block):
    platinum[shape] = {float(size): image_id for size, image_id in re.findall(r'(\d+(?:\.\d+)?):"([A-Z0-9]+)"', values)}

def decode(image_id):
    start = len(image_id) - 9
    return ((GROUP.index(image_id[start]) * len(GROUP)) + GROUP.index(image_id[start + 1])) * len(SHAPE_DIGITS) + SHAPE_DIGITS.index(image_id[start + 2])

def encode(value):
    shape = value % len(SHAPE_DIGITS)
    group = value // len(SHAPE_DIGITS)
    return f"{GROUP[group // len(GROUP)]}{GROUP[group % len(GROUP)]}{SHAPE_DIGITS[shape]}"

def replace_variant(image_id, value):
    start = len(image_id) - 9
    return f"{image_id[:start]}{encode(value)}{image_id[start + 3:]}"

def fetch(image_id):
    with urllib.request.urlopen(f"{BASE}{image_id}.jpg?v=1", timeout=30) as response:
        image = Image.open(BytesIO(response.read())).convert("L").resize((128, 128)).filter(ImageFilter.FIND_EDGES)
    return image

def difference(left, right):
    return ImageStat.Stat(ImageChops.difference(left, right)).mean[0]

reference_family = ("yellowGold", "9k")
requests = set()
references = {}
candidates = {}
for shape in SHAPES:
    for carat, platinum_id in platinum[shape].items():
        if not 0.3 <= carat <= 6:
            continue
        delta = decode(platinum_id) - decode(platinum[shape][1])
        reference_id = replace_variant(mapping[reference_family][shape], decode(mapping[reference_family][shape]) + delta)
        references[(shape, carat)] = reference_id
        requests.add(reference_id)
        for family in FAMILIES[1:]:
            base_id = mapping[family][shape]
            predicted = decode(base_id) + delta
            ids = [(correction, replace_variant(base_id, predicted + correction)) for correction in range(-7, 8)]
            candidates[(family, shape, carat)] = ids
            requests.update(image_id for correction, image_id in ids)

with ThreadPoolExecutor(max_workers=24) as pool:
    images = dict(zip(requests, pool.map(fetch, requests)))

result = {}
for key, ids in candidates.items():
    family, shape, carat = key
    reference = images[references[(shape, carat)]]
    ranked = sorted((difference(reference, images[image_id]), correction, image_id) for correction, image_id in ids)
    score, correction, image_id = ranked[0]
    result.setdefault(f"{family[0]}:{family[1]}", {}).setdefault(f"{carat:g}", {})[shape] = {
        "correction": correction, "id": image_id, "score": round(score, 3),
        "margin": round(ranked[1][0] - score, 3)
    }

output = ROOT / "tmp" / "shape-matrix" / "shape-offsets.json"
output.write_text(json.dumps(result, indent=2), encoding="utf-8")
for family, carats in result.items():
    print(family)
    for carat, shapes in carats.items():
        print(carat, " ".join(f"{shape[:2]}:{value['correction']:+d}" for shape, value in shapes.items()))
print(output)
