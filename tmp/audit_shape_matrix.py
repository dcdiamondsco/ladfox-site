import re
import urllib.request
import sys
import json
from concurrent.futures import ThreadPoolExecutor
from io import BytesIO
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
HTML = (ROOT / "classic-solitaire.html").read_text(encoding="utf-8")
OUT = ROOT / "tmp" / "shape-matrix"
OUT.mkdir(parents=True, exist_ok=True)
SHAPES = ["round", "oval", "cushion", "princess", "pear", "emerald", "marquise", "radiant"]
METALS = [("yellowGold", "Yellow"), ("whiteGold", "White"), ("roseGold", "Rose")]
BASE = "https://image25.thepersonalizedbest.com/image/api_image61/"
CARAT = float(sys.argv[1]) if len(sys.argv) > 1 else 1.0
CORRECTIONS = {
    ("Yellow", "9k"): {}, ("Yellow", "14k"): {0.5:-1},
    ("Yellow", "18k"): {0.33:-1,0.5:-1,2:-1,2.5:-1,3:-1,4:-1,5:-1,6:-1},
    ("White", "9k"): {0.33:-1,0.5:-1,3:-1,4:-1,5:-1,6:-1},
    ("White", "14k"): {0.33:-1,0.5:-1,2:-1,2.5:-1,3:-1,4:-1,5:-1,6:-1},
    ("White", "18k"): {0.33:-1,0.5:-1,6:-1},
    ("Rose", "9k"): {0.33:-1,0.5:-1,4:-1,5:-1,6:-1},
    ("Rose", "14k"): {0.33:-1,0.5:-1,3:-1,4:-1,5:-1,6:-1},
    ("Rose", "18k"): {0.5:-1},
}
OFFSETS_PATH = ROOT / "tmp" / "shape-matrix" / "shape-offsets.json"
SHAPE_OFFSETS = json.loads(OFFSETS_PATH.read_text(encoding="utf-8")) if OFFSETS_PATH.exists() else {}

mapping = {}
collection = HTML.split("const SIGNATURE_COLLECTION_IMAGES = ", 1)[1].split("const SIGNATURE_RENDERS", 1)[0]
for index, (key, label) in enumerate(METALS):
    start = collection.index(f"{key}: {{")
    end = collection.index(f"{METALS[index + 1][0]}: {{", start) if index + 1 < len(METALS) else len(collection)
    block = collection[start:end]
    for purity, values in re.findall(r'"(9k|14k|18k)":\s*\{([^}]+)\}', block):
        mapping[(label, purity)] = dict(re.findall(r'(\w+):"([A-Z0-9]+)"', values))

platinum_block = HTML.split("platinum: {", 1)[1].split("},\n    yellowGold", 1)[0]
platinum = {}
for shape, values in re.findall(r'(\w+):\s*\{([^}]+)\}', platinum_block):
    one = re.search(r'(?:^|,)1:"([A-Z0-9]+)"', values)
    if one:
        platinum[shape] = one.group(1)
mapping[("Platinum", "950")] = platinum

group_alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
shape_alphabet = "BGLQV16"
def decode_variant(image_id):
    start = len(image_id) - 9
    return ((group_alphabet.index(image_id[start]) * len(group_alphabet)) + group_alphabet.index(image_id[start + 1])) * len(shape_alphabet) + shape_alphabet.index(image_id[start + 2])
def encode_variant(value):
    shape = value % len(shape_alphabet)
    group = value // len(shape_alphabet)
    return f"{group_alphabet[group // len(group_alphabet)]}{group_alphabet[group % len(group_alphabet)]}{shape_alphabet[shape]}"
def derive(base_id, shape, carat, family):
    if carat == 1:
        return base_id
    shape_line = re.search(rf'{shape}:\s*\{{([^}}]+)\}}', platinum_block).group(1)
    selected = re.search(rf'(?:^|,){carat:g}:"([A-Z0-9]+)"', shape_line)
    if not selected:
        return base_id
    one = re.search(r'(?:^|,)1:"([A-Z0-9]+)"', shape_line).group(1)
    start = len(base_id) - 9
    family_key = {"Yellow":"yellowGold", "White":"whiteGold", "Rose":"roseGold"}[family[0]] + ":" + family[1]
    offset_entry = SHAPE_OFFSETS.get(family_key, {}).get(f"{carat:g}", {}).get(shape)
    correction = offset_entry["correction"] if offset_entry else CORRECTIONS.get(family, {}).get(carat, 0)
    variant = encode_variant(decode_variant(base_id) + decode_variant(selected.group(1)) - decode_variant(one) + correction)
    return f"{base_id[:start]}{variant}{base_id[start + 3:]}"

font = ImageFont.load_default()
cell_w, cell_h, label_w, header_h = 260, 260, 90, 28
rows = [("Platinum", "950")] + [(label, purity) for label in ("Yellow", "White", "Rose") for purity in ("9k", "14k", "18k")]
sheet = Image.new("RGB", (label_w + cell_w * len(SHAPES), header_h + cell_h * len(rows)), "#111111")
draw = ImageDraw.Draw(sheet)
for col, shape in enumerate(SHAPES):
    draw.text((label_w + col * cell_w + 8, 8), shape.title(), fill="white", font=font)

def fetch_image(item):
    row, row_key, col, shape = item
    image_id = mapping[row_key][shape]
    if row_key != ("Platinum", "950"):
        image_id = derive(image_id, shape, CARAT, row_key)
    elif CARAT != 1:
        shape_line = re.search(rf'{shape}:\s*\{{([^}}]+)\}}', platinum_block).group(1)
        selected = re.search(rf'(?:^|,){CARAT:g}:"([A-Z0-9]+)"', shape_line)
        if selected:
            image_id = selected.group(1)
    url = f"{BASE}{image_id}.jpg?v=1"
    with urllib.request.urlopen(url, timeout=20) as response:
        image = Image.open(BytesIO(response.read())).convert("RGB")
    image.thumbnail((cell_w - 8, cell_h - 28), Image.Resampling.LANCZOS)
    return row, row_key, col, shape, image_id, image

items = [(row, row_key, col, shape) for row, row_key in enumerate(rows) for col, shape in enumerate(SHAPES)]
with ThreadPoolExecutor(max_workers=12) as pool:
    fetched = list(pool.map(fetch_image, items))

for row, row_key in enumerate(rows):
    draw.text((8, header_h + row * cell_h + 10), f"{row_key[0]}\n{row_key[1]}", fill="white", font=font)
for row, row_key, col, shape, image_id, image in fetched:
    x = label_w + col * cell_w + (cell_w - image.width) // 2
    y = header_h + row * cell_h + 20 + (cell_h - 24 - image.height) // 2
    sheet.paste(image, (x, y))
    draw.text((label_w + col * cell_w + 5, header_h + row * cell_h + 4), image_id, fill="#dddddd", font=font)

output = OUT / f"{CARAT:g}-carat-shape-matrix.jpg"
sheet.save(output, quality=92)
for row, row_key in enumerate(rows):
    row_image = sheet.crop((0, header_h + row * cell_h, sheet.width, header_h + (row + 1) * cell_h))
    row_image.save(OUT / f"{CARAT:g}-{row_key[0].lower()}-{row_key[1]}.jpg", quality=94)
print(output)
