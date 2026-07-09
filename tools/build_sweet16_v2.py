"""Build Sweet 16 products with both model and product images."""
import json
import re
import os
from pathlib import Path
from PIL import Image

ROOT = Path(r"d:\PMJ Projects website\Anchor Catlouge")
SRC = ROOT / "assets" / "sweet16"
OPT = SRC / "optimized"
OPT.mkdir(parents=True, exist_ok=True)

META = json.loads((SRC / "images_meta.json").read_text(encoding="utf-8"))

PRODUCTS_BY_PAGE = {
    2: ["SBRC887806", "SRNG920359"],
    3: ["SPST909296", "SMAT909342"],
    4: ["SERN895430", "NBRC901545", "SERN931794"],
    5: ["SMAT932512", "SPST932513", "SBRC926223"],
    6: ["SRNG900970", "SRNG935277", "SRNG967440"],
    7: ["SNEC951544", "SERN933646"],
    8: ["SBRC878178", "SERN936326", "SBRC951194"],
    9: ["SNEC939957"],
    10: ["SBRC887805", "SRNG928656"],
    11: ["SPST911141", "SMAT911178"],
    12: ["SERN935620", "SERN948867", "SBRC938633"],
    13: ["SNEC917387", "SERN951053"],
    14: ["SERN961550", "SBRC868995", "SBRC939773", "SERN917197"],
    15: ["SPST8794513", "SMAT879452"],
    16: ["SNEC935558", "SBRC862323", "SMAT935557"],
    17: ["SNEC939967"],
    18: ["SMAT9442891", "SPST944291"],
    19: ["SMAT924824", "SPST924827"],
    20: ["SBRC884457", "SRNG951197", "SBRC782666", "SRNG924006"]
}

def optimize(src: Path, dest: Path, max_side=1100, quality=78):
    im = Image.open(src).convert("RGB")
    w, h = im.size
    scale = min(1.0, max_side / max(w, h))
    if scale < 1:
        im = im.resize((int(w * scale), int(h * scale)), Image.Resampling.LANCZOS)
    im.save(dest, "JPEG", quality=quality, optimize=True)
    return dest

def main():
    # Group images by page
    images_by_page = {}
    for img in META:
        page = img["page"]
        images_by_page.setdefault(page, []).append(img)

    assignments = {}
    
    for page, skus in PRODUCTS_BY_PAGE.items():
        page_imgs = images_by_page.get(page, [])
        # Classify as model (tall, ratio > 1.2) or product cutout (square-ish)
        models = []
        cutouts = []
        for img in page_imgs:
            ratio = img["h"] / max(img["w"], 1)
            if ratio > 1.2:
                models.append(img)
            else:
                cutouts.append(img)

        # Sort models: largest first or by ratio
        models.sort(key=lambda x: -(x["w"] * x["h"]))
        # Sort cutouts by filename/xref to preserve order
        cutouts.sort(key=lambda x: x["file"])

        print(f"Page {page}: SKUs={len(skus)}, Models={len(models)}, Cutouts={len(cutouts)}")

        # Special manual override mappings for complex pages
        if page == 4:
            assignments["SERN895430"] = {"model": "p04_img02_96.png", "product": "p04_img03_102.png"}
            assignments["NBRC901545"] = {"model": "p04_img02_96.png", "product": "p04_img04_108.png"}
            assignments["SERN931794"] = {"model": "p04_img01_93.png", "product": "p04_img01_93.png"}
        elif page == 12:
            assignments["SERN935620"] = {"model": "p12_img01_250.png", "product": "p12_img01_250.png"}
            assignments["SERN948867"] = {"model": "p12_img01_250.png", "product": "p12_img01_250.png"}
            assignments["SBRC938633"] = {"model": "p12_img02_253.png", "product": "p12_img02_253.png"}
        elif page == 14:
            assignments["SERN961550"] = {"model": "p14_img01_279.png", "product": "p14_img01_279.png"}
            assignments["SERN917197"] = {"model": "p14_img01_279.png", "product": "p14_img01_279.png"}
            assignments["SBRC868995"] = {"model": "p14_img03_282.png", "product": "p14_img03_282.png"}
            assignments["SBRC939773"] = {"model": "p14_img03_282.png", "product": "p14_img03_282.png"}
        else:
            # General sequential mapping
            for idx, sku in enumerate(skus):
                model_img = models[0]["file"] if models else (cutouts[0]["file"] if cutouts else None)
                if cutouts:
                    product_img = cutouts[min(idx, len(cutouts)-1)]["file"]
                else:
                    product_img = model_img
                assignments[sku] = {"model": model_img, "product": product_img}

    image_entries = {}
    
    cover_src = SRC / "p01_img02_35.png"
    if cover_src.exists():
        optimize(cover_src, OPT / "sweet16_cover.jpg", max_side=1400, quality=82)
        image_entries["sweet16_cover"] = "assets/sweet16/optimized/sweet16_cover.jpg"

    for sku, files in assignments.items():
        model_file = files["model"]
        product_file = files["product"]

        model_key = f"{sku}_model"
        product_key = f"{sku}_product"

        if model_file:
            optimize(SRC / model_file, OPT / f"{model_key}.jpg")
            image_entries[model_key] = f"assets/sweet16/optimized/{model_key}.jpg"
        if product_file:
            optimize(SRC / product_file, OPT / f"{product_key}.jpg")
            image_entries[product_key] = f"assets/sweet16/optimized/{product_key}.jpg"

    lines = ["/* Sweet 16 Collection images — file paths */", "Object.assign(IMAGES, {"]
    for k, v in sorted(image_entries.items()):
        lines.append(f'  "{k}": "{v}",')
    lines.append("});")
    (ROOT / "js" / "sweet16-images.js").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"Generated {len(image_entries)} optimized images in sweet16-images.js")

    products_js_path = ROOT / "js" / "products.js"
    js_content = products_js_path.read_text(encoding="utf-8")

    for sku in assignments.keys():
        old_pattern = f"images:\\s*\\[\\s*'{sku}_hero'\\s*\\]"
        new_replacement = f"images:['{sku}_model','{sku}_product']"
        js_content = re.sub(old_pattern, new_replacement, js_content)

    products_js_path.write_text(js_content, encoding="utf-8")
    print("Updated js/products.js image mappings")

if __name__ == "__main__":
    main()
