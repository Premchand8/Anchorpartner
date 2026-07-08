"""Extract and split PMJ luxury catalogue from transcript into project files."""
import json
import re
from pathlib import Path

ROOT = Path(r"d:\PMJ Projects website\Anchor Catlouge")
TRANSCRIPT = Path(
    r"C:\Users\m.premchand\.cursor\projects\d-PMJ-Projects-website-Anchor-Catlouge"
    r"\agent-transcripts\8211ebf6-3402-45d4-9686-86c58a1dbb94\8211ebf6-3402-45d4-9686-86c58a1dbb94.jsonl"
)

line = TRANSCRIPT.read_text(encoding="utf-8").splitlines()[0]
text = json.loads(line)["message"]["content"][0]["text"]
html_start = text.find("<!DOCTYPE html>")
html = text[html_start:]
html_end = html.rfind("</html>")
html = html[: html_end + 7]

# --- CSS ---
style_start = html.find("<style>") + len("<style>")
style_end = html.find("</style>")
css = html[style_start:style_end].strip()

media_blocks = []

def extract_media(m):
    media_blocks.append(m.group(0))
    return ""

css_base = re.sub(
    r"@media[^{]+\{(?:[^{}]|\{[^{}]*\})*\}",
    extract_media,
    css,
    flags=re.DOTALL,
)

(ROOT / "css").mkdir(exist_ok=True)
(ROOT / "js").mkdir(exist_ok=True)
(ROOT / "assets" / "textures").mkdir(parents=True, exist_ok=True)

(ROOT / "css" / "luxury.css").write_text(css_base, encoding="utf-8")
(ROOT / "css" / "responsive.css").write_text(
    "\n\n".join(media_blocks) or "/* See luxury.css for responsive rules */",
    encoding="utf-8",
)
(ROOT / "css" / "animations.css").write_text(
    """@keyframes tabPulse {
  0% { transform: scale(1); }
  40% { transform: scale(1.08); box-shadow: 0 0 0 6px rgba(199,162,82,.15); }
  100% { transform: scale(1); }
}
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(18px); }
  to { opacity: 1; transform: translateY(0); }
}
.card-enter { animation: fadeUp .55s cubic-bezier(.22,.61,.36,1) both; }
""",
    encoding="utf-8",
)

# --- JavaScript ---
script_start = html.find("<script>") + len("<script>")
script_end = html.rfind("</script>")
js = html[script_start:script_end].strip()

images_m = re.search(r"(const IMAGES = \{[\s\S]*?\};\s*)", js)
products_m = re.search(r"(const PRODUCTS = \[[\s\S]*?\];\s*)", js)

if images_m:
    (ROOT / "js" / "images.js").write_text(
        "/* Auto-generated image data (base64 data URLs) */\n" + images_m.group(1),
        encoding="utf-8",
    )
    js = js.replace(images_m.group(1), "")

if products_m:
    (ROOT / "js" / "products.js").write_text(
        "/* Product catalogue data */\n" + products_m.group(1),
        encoding="utf-8",
    )
    js = js.replace(products_m.group(1), "")

section_pattern = re.compile(
    r"/\* ={3,}\s*\n\s*([^\n*]+?)\s*\n\s*=+\s*\*/",
    re.MULTILINE,
)
parts = section_pattern.split(js)
sections = {}
for i in range(1, len(parts), 2):
    title = parts[i].strip().lower()
    body = parts[i + 1].strip() if i + 1 < len(parts) else ""
    sections[title] = body

def block(*keys):
    return "\n\n".join(sections[k] for k in keys if k in sections)

(ROOT / "js" / "intro.js").write_text(
    "/* Login gate & cinematic intro */\n" + block(
        "access codes — change these before sharing the file",
        "login gate",
    ),
    encoding="utf-8",
)
(ROOT / "js" / "catalogue.js").write_text(
    "/* Catalogue rendering, filters & search */\n" + block(
        "state",
        "render: hero",
        "render: grid",
    ),
    encoding="utf-8",
)
(ROOT / "js" / "modal.js").write_text(
    "/* Product detail modal & gallery */\n" + block("product modal"),
    encoding="utf-8",
)
(ROOT / "js" / "wishlist.js").write_text(
    "/* Wishlist drawer & enquiry submission */\n" + block(
        "wishlist drawer",
        "submit enquiry",
    ),
    encoding="utf-8",
)
(ROOT / "js" / "app.js").write_text(
    "/* Admin mode, bootstrap & global listeners */\n" + block("admin mode"),
    encoding="utf-8",
)

# --- Body HTML (no inline style/script) ---
body_start = html.find("<body>")
body_end = html.rfind("</body>") + len("</body>")
body = html[body_start:body_end]
body = re.sub(r"\n<script>[\s\S]*?</script>\s*", "\n", body)

head = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>PMJ — Partner Wishlist Catalogue</title>
<meta name="description" content="Private partner viewing catalogue — PMJ Fine Jewellery">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,500&family=Jost:wght@300;400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="css/luxury.css">
<link rel="stylesheet" href="css/animations.css">
<link rel="stylesheet" href="css/responsive.css">
</head>
"""

scripts = """
<script src="js/images.js"></script>
<script src="js/products.js"></script>
<script src="js/intro.js"></script>
<script src="js/catalogue.js"></script>
<script src="js/modal.js"></script>
<script src="js/wishlist.js"></script>
<script src="js/app.js"></script>
"""

(ROOT / "index.html").write_text(
    head + body.replace("</body>", scripts + "\n</body>"),
    encoding="utf-8",
)

print("Build complete:")
for p in sorted(ROOT.rglob("*")):
    if p.is_file() and p.name != "extract_project.py":
        print(f"  {p.relative_to(ROOT)}  ({p.stat().st_size:,} bytes)")
