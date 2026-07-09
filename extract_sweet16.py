"""Extract Sweet 16 Collection products + images from PDF."""
from __future__ import annotations

import base64
import json
import re
from pathlib import Path

import fitz

PDF = Path(r"c:\Users\m.premchand\Downloads\Sweet 16 Collection_compressed.pdf")
OUT_DIR = Path(r"d:\PMJ Projects website\Anchor Catlouge\assets\sweet16")
OUT_DIR.mkdir(parents=True, exist_ok=True)

doc = fitz.open(PDF)
print(f"pages={doc.page_count}")

# Dump text per page for product parsing
text_pages = []
for i, page in enumerate(doc):
    text = page.get_text("text")
    text_pages.append(text)
    print(f"\n===== PAGE {i+1} =====")
    print(text[:2500] if len(text) > 2500 else text)

(OUT_DIR / "pdf_text.txt").write_text("\n\n===== PAGE BREAK =====\n\n".join(text_pages), encoding="utf-8")

# Extract images — keep larger ones (product photos)
img_meta = []
seen_xrefs = set()
for page_index, page in enumerate(doc):
    for img_i, img in enumerate(page.get_images(full=True)):
        xref = img[0]
        if xref in seen_xrefs:
            continue
        seen_xrefs.add(xref)
        try:
            pix = fitz.Pixmap(doc, xref)
            if pix.n - pix.alpha >= 4:  # CMYK
                pix = fitz.Pixmap(fitz.csRGB, pix)
            w, h = pix.width, pix.height
            # skip tiny icons / logos
            if w < 180 or h < 180:
                continue
            name = f"p{page_index+1:02d}_img{img_i+1:02d}_{xref}"
            out_path = OUT_DIR / f"{name}.png"
            pix.save(out_path)
            img_meta.append({
                "page": page_index + 1,
                "xref": xref,
                "file": out_path.name,
                "w": w,
                "h": h,
                "bytes": out_path.stat().st_size,
            })
            print(f"saved {out_path.name} {w}x{h}")
        except Exception as e:
            print(f"skip xref={xref}: {e}")

(OUT_DIR / "images_meta.json").write_text(json.dumps(img_meta, indent=2), encoding="utf-8")
print(f"\nExtracted {len(img_meta)} images -> {OUT_DIR}")
