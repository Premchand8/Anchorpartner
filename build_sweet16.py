"""Build Sweet 16 products + optimized images for the catalogue."""
from __future__ import annotations

import json
import re
from pathlib import Path

from PIL import Image

ROOT = Path(r"d:\PMJ Projects website\Anchor Catlouge")
SRC = ROOT / "assets" / "sweet16"
OPT = SRC / "optimized"
OPT.mkdir(parents=True, exist_ok=True)

TEXT = (SRC / "pdf_text.txt").read_text(encoding="utf-8")
META = json.loads((SRC / "images_meta.json").read_text(encoding="utf-8"))

CAT_MAP = {
    "SBRC": ("bracelet", "Bracelet"),
    "NBRC": ("bracelet", "Bracelet"),
    "SRNG": ("ring", "Ring"),
    "SERN": ("earring", "Earrings"),
    "SNEC": ("necklace", "Necklace"),
    "SPST": ("pendant", "Pendant"),
    "SMAT": ("mangalsutra", "Mangalsutra"),
}

NAME_BASE = {
    "bracelet": "Sweet 16 Diamond Bracelet",
    "ring": "Sweet 16 Diamond Ring",
    "earring": "Sweet 16 Diamond Earrings",
    "necklace": "Sweet 16 Diamond Necklace",
    "pendant": "Sweet 16 Diamond Pendant",
    "mangalsutra": "Sweet 16 Diamond Mangalsutra",
}


def cat_for(sku: str):
    return CAT_MAP.get(sku[:4], ("pendant", "Pendant"))


def parse_products():
    pages = TEXT.split("===== PAGE BREAK =====")
    products = []
    for page_i, page_text in enumerate(pages, start=1):
        if page_i in (1, 21):
            continue
        lines = [ln.strip() for ln in page_text.splitlines() if ln.strip()]
        page_skus = []
        i = 0
        while i < len(lines):
            m = re.match(r"^([A-Z]{3,4}\d{5,8})$", lines[i])
            if not m:
                i += 1
                continue
            sku = m.group(1)
            fields = {"page": page_i, "id": sku}
            j = i + 1
            while j < len(lines) and not re.match(r"^[A-Z]{3,4}\d{5,8}$", lines[j]):
                line = lines[j]
                if line.startswith("G WT:"):
                    fields["gross"] = line.replace("G WT:", "").strip() + " g"
                elif line.startswith("Dia:"):
                    fields["diamond"] = line.replace("Dia:", "").strip() + " ct"
                elif line.startswith("St:"):
                    fields["stones"] = line.replace("St:", "").strip() + " ct"
                elif re.match(r"^\d+kt$", line, re.I):
                    fields["purity"] = re.sub(r"(?i)kt", " KT", line).upper().replace("  ", " ").strip()
                elif re.match(r"^[A-Z]{2}\s*V[VS]{1,2}$", line):
                    fields["clarity"] = line
                elif line.startswith("$") or re.match(r"^\$?\d", line):
                    price = line if line.startswith("$") else f"${line}"
                    fields["price"] = price
                j += 1
            page_skus.append(fields)
            i = j

        # Share specs from the next filled SKU to preceding empty ones on same page
        last_specs = None
        for p in reversed(page_skus):
            has = any(k in p for k in ("gross", "diamond", "price", "purity"))
            if has:
                last_specs = {k: p[k] for k in ("gross", "diamond", "stones", "purity", "clarity", "price") if k in p}
            elif last_specs:
                for k, v in last_specs.items():
                    p.setdefault(k, v)
        products.extend(page_skus)
    return products


def score_image(meta: dict) -> float:
    w, h = meta["w"], meta["h"]
    if w < 350 or h < 350:
        return -1
    ratio = h / max(w, 1)
    # Prefer product cutouts (near square) over tall model shots
    square_score = 1.0 - min(abs(1.0 - ratio), 1.0)
    size_score = min(w, h) / 1500
    return square_score * 2 + size_score


def page_images():
    by_page: dict[int, list] = {}
    for m in META:
        if m["page"] in (1, 21):
            continue
        s = score_image(m)
        if s < 0:
            continue
        by_page.setdefault(m["page"], []).append((s, m))
    for page, items in by_page.items():
        items.sort(key=lambda x: -x[0])
        by_page[page] = [m for _, m in items]
    return by_page


def optimize(src: Path, dest: Path, max_side=1100, quality=78):
    im = Image.open(src).convert("RGB")
    w, h = im.size
    scale = min(1.0, max_side / max(w, h))
    if scale < 1:
        im = im.resize((int(w * scale), int(h * scale)), Image.Resampling.LANCZOS)
    im.save(dest, "JPEG", quality=quality, optimize=True)
    return dest


def main():
    products = parse_products()
    images_by_page = page_images()
    used = set()
    image_entries = {}
    product_js = []
    cover_src = None

    # First pass: assign best unused image per product on its page
    assignments = {}
    for p in products:
        page = p["page"]
        candidates = [img for img in images_by_page.get(page, []) if img["file"] not in used]
        if not candidates:
            continue
        img = candidates[0]
        used.add(img["file"])
        assignments[p["id"]] = img

    # Second pass: leftover products borrow any unused image from same page, else any leftover
    leftovers = [img for page_imgs in images_by_page.values() for img in page_imgs if img["file"] not in used]
    for p in products:
        if p["id"] in assignments:
            continue
        page_left = [img for img in images_by_page.get(p["page"], []) if img["file"] not in used]
        pick = page_left[0] if page_left else (leftovers.pop(0) if leftovers else None)
        if pick:
            used.add(pick["file"])
            if pick in leftovers:
                leftovers = [x for x in leftovers if x["file"] != pick["file"]]
            assignments[p["id"]] = pick

    for p in products:
        sku = p["id"]
        cat, cat_label = cat_for(sku)
        image_keys = []
        if sku in assignments:
            img_meta = assignments[sku]
            src = SRC / img_meta["file"]
            key = f"{sku}_hero"
            dest = OPT / f"{key}.jpg"
            optimize(src, dest)
            image_entries[key] = f"assets/sweet16/optimized/{key}.jpg"
            image_keys = [key]
            if cover_src is None:
                cover_src = dest

        purity = p.get("purity", "18 KT")
        if purity.replace(" ", "") == "18KT":
            purity = "18 KT"
        diamond = p.get("diamond", "—")
        stones = p.get("stones")
        clarity = p.get("clarity", "")
        stone_line = stones or (f"Diamond {clarity}".strip() if clarity else "Diamond")
        gross = p.get("gross", "—")
        price = p.get("price", "Price on request")
        if isinstance(price, str) and price and not price.startswith("$") and price[0].isdigit():
            price = f"${price}"

        desc = f"Sweet 16 Collection — {cat_label.lower()} in {purity} gold"
        if diamond and diamond != "—":
            desc += f" with {diamond} diamonds"
        if stones:
            desc += f" and {stones} accent stones"
        if clarity:
            desc += f" ({clarity})"
        desc += "."

        product_js.append(
            {
                "id": sku,
                "name": f"{NAME_BASE[cat]}",
                "cat": cat,
                "catLabel": cat_label,
                "availability": "mto",
                "collections": ["sweet-16"],
                "images": image_keys,
                "description": desc,
                "purity": purity,
                "gross": gross,
                "netGold": gross,
                "diamond": diamond,
                "stones": stone_line,
                "price": price,
            }
        )

    if cover_src and cover_src.exists():
        cover_dest = OPT / "sweet16_cover.jpg"
        optimize(cover_src, cover_dest, max_side=1400, quality=82)
        image_entries["sweet16_cover"] = "assets/sweet16/optimized/sweet16_cover.jpg"

    lines = ["/* Sweet 16 Collection images — file paths */", "Object.assign(IMAGES, {"]
    for k, v in sorted(image_entries.items()):
        lines.append(f'  "{k}": "{v}",')
    lines.append("});")
    (ROOT / "js" / "sweet16-images.js").write_text("\n".join(lines) + "\n", encoding="utf-8")
    (SRC / "products.json").write_text(json.dumps(product_js, indent=2), encoding="utf-8")

    print(f"products={len(product_js)} images={len(image_entries)}")
    missing = [p["id"] for p in product_js if not p["images"]]
    print("missing images:", ", ".join(missing) if missing else "none")
    print("sample:", json.dumps(product_js[0], indent=2))


if __name__ == "__main__":
    main()
