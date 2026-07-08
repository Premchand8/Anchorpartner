# Deploy PMJ Partner Catalogue — GitHub → Netlify (prototype)

Static partner catalogue for prototype review. Partners enter the access code; admins edit products, prices, images, made-to-order flags, hero, and banner from the live Netlify URL.

## What works on Netlify

| Feature | Partner (`PMJVIP2026`) | Admin (`PMJADMIN26`) |
|--------|------------------------|----------------------|
| Login + cinematic intro | Yes | Yes |
| Catalogue, filters, sort, wishlist | Yes | Yes |
| Product PDP + 360 viewer | Yes | Yes |
| Edit product specs, price, MTO/ready | — | Yes |
| Display settings (hero, banner, motion) | Sees published result | Yes |
| **Publish to all visitors** | — | Yes (auto after save on Netlify) |

Admin saves are stored in **Netlify Blobs** via `netlify/functions/site-config.mjs`. Every visitor loads the latest published config on page load.

Local dev (`python tools/ui_log_server.py`) still works; publish falls back to browser-only storage until deployed on Netlify.

---

## 1. Push to GitHub

```bash
cd "d:\PMJ Projects website\Anchor Catlouge"
git init
git add .
git commit -m "Initial prototype catalogue for Netlify"
git branch -M main
git remote add origin https://github.com/YOUR_ORG/pmj-partner-catalogue.git
git push -u origin main
```

Do **not** commit secrets. Access codes are client-side for prototype only (see security note below).

---

## 2. Connect Netlify

1. [Netlify](https://app.netlify.com) → **Add new site** → **Import from Git** → choose the repo.
2. Build settings (already in `netlify.toml`):
   - **Build command:** *(leave empty)*
   - **Publish directory:** `.`
3. Deploy.

Optional environment variable (recommended before public URL):

| Variable | Value | Purpose |
|----------|-------|---------|
| `PMJ_ADMIN_CODE` | your secret code | Overrides default admin code on server publish API |

Partner code stays in `js/intro.js` (`PMJVIP2026`) until you change it in a future release.

---

## 3. Admin workflow on the live URL

1. Open `https://YOUR-SITE.netlify.app`
2. Unlock admin either:
   - Header **⚙ Admin** → enter `PMJADMIN26`, or
   - Shortcut: `https://YOUR-SITE.netlify.app/?admin=PMJADMIN26`
3. **Admin mode** pill appears (bottom-left).
4. Edit:
   - Open any product → **Edit details** (price, weights, description, **Made to Order** / ready)
   - **Display** → hero copy/images, promo banner, 3D motion
5. Save — changes **publish live** automatically (~2 seconds after save). Pill shows **Live** when synced.

Partners refresh the page to see updates (no redeploy needed).

---

## 4. Image size tips

Hero and banner uploads are stored as base64 in published config. Keep each image **under ~400 KB** (JPG or optimised PNG) to stay within Netlify function limits.

Product images ship in `js/images.js` (~4.6 MB). First visit may be slow; cache headers are set in `netlify.toml`.

---

## 5. Updating the codebase

```bash
git add .
git commit -m "Describe change"
git push
```

Netlify redeploys automatically. **Published admin content in Blobs is kept** across deploys.

---

## 6. Security (prototype phase)

- Partner and admin codes are checked in the browser and on the publish API.
- Suitable for **private prototype links**, not production secrets.
- Before wider launch: move auth + CMS to a proper backend, rotate codes, and set `PMJ_ADMIN_CODE` in Netlify.

---

## 7. Troubleshooting

| Issue | Fix |
|-------|-----|
| Admin saves but partners see old data | Hard refresh (Ctrl+Shift+R). Confirm pill shows **Live**, not **Offline**. |
| Publish shows **Offline** | Only happens off Netlify or if Functions failed — check Netlify **Functions** log. |
| Blank catalogue after login | Check browser console; ensure `js/images.js` loaded. |
| Stale CSS | Hard refresh; Netlify caches CSS 24h (`netlify.toml`). |

---

## Access codes (prototype)

- **Partner:** `PMJVIP2026`
- **Admin:** `PMJADMIN26` (or `PMJ_ADMIN_CODE` env on Netlify)
