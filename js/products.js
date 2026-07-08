/* Product catalogue data
   Each product supports: id, name, cat, catLabel, images[], description,
   availability: 'ready' | 'mto'  (ready = dispatch/stock, mto = made to order)
   Optional: modelScale, model, modelRotation
*/
const PRODUCTS = [
  { id:'SBNG1030085', name:'Aurora Gemstone Bangle', cat:'bangle', catLabel:'Bangle', availability:'ready',
    images:['SBNG1030085_hero','SBNG1030085_1','SBNG1030085_2','SBNG1030085_3'],
    description:'Intricately designed bangles studded with multi-coloured gemstones, representing auspiciousness and vibrant tradition.' },
  { id:'SHAR1012267', name:'Uncut Diamond Polki Pendant Chain', cat:'necklace', catLabel:'Necklace', availability:'mto',
    images:['SHAR1012267_hero','SHAR1012267_1','SHAR1012267_2','SHAR1012267_3'],
    description:'An intricately crafted polki pendant with uncut diamonds and emerald drops, reflecting timeless heritage.' },
  { id:'SPND998476', name:'Lakshmi Elephant Temple Pendant', cat:'necklace', catLabel:'Necklace', availability:'ready',
    images:['SPND998476_hero','SPND998476_1','SPND998476_2','SPND998476_3'],
    modelScale: 1,
    description:'An exquisite temple necklace showcasing Goddess Lakshmi, surrounded by intricate elephant motifs, green beads and pearls.' },
  { id:'SPND982328', name:'Lakshmi Peacock Temple Pendant', cat:'necklace', catLabel:'Necklace', availability:'mto',
    images:['SPND982328_1'],
    description:'A regal temple pendant with twin peacocks and Goddess Lakshmi at its heart, finished with emerald and pearl drops.' },
  { id:'SJMK741494', name:'Lakshmi Ruby Jhumka Earrings', cat:'earring', catLabel:'Earrings', availability:'ready',
    images:['SJMK741494_hero'],
    description:'Gold Lakshmi temple earrings with ruby accents, blending tradition with timeless elegance.' },
  { id:'SERN1037986', name:'Peacock Ruby Stud Earrings', cat:'earring', catLabel:'Earrings', availability:'ready',
    images:['SERN1037986_hero'],
    description:'Gold studs featuring peacock motifs, embellished with ruby accents that symbolise beauty and grace.' },
  { id:'SERN1052778', name:'Lakshmi Emerald Sunburst Studs', cat:'earring', catLabel:'Earrings', availability:'mto',
    images:['SERN1052778_hero'],
    description:'Antique-finish studs featuring Goddess Lakshmi, enhanced with emerald and pearl drops for divine elegance.' },
  { id:'SNEC979916', name:'Emerald Lakshmi Temple Necklace', cat:'necklace', catLabel:'Necklace', availability:'mto',
    images:['SNEC979916_hero'],
    description:'A grand temple necklace featuring a prominent goddess motif, accented with green stones and pearl drops.' },
  { id:'SRNG1043042', name:'Sacred Deity Ruby Ring', cat:'ring', catLabel:'Ring', availability:'ready',
    images:['SRNG1043042_hero'],
    description:'A finely detailed gold ring featuring a sacred deity motif, accented with vibrant rubies that enhance its spiritual charm.' },
  { id:'SHAR1013484', name:'Emerald Strand Lakshmi Pendant', cat:'necklace', catLabel:'Necklace', availability:'mto',
    images:['SHAR1013484_hero'],
    description:'Multiple strands of green beads come together with a detailed temple pendant, showcasing divine artistry.' },
  { id:'SJMK1044538', name:'Ruby Emerald Temple Jhumkas', cat:'earring', catLabel:'Earrings', availability:'mto',
    images:['SJMK1044538_hero'],
    description:'Temple-inspired jhumkas featuring ruby and emerald accents, finished with cascading pearls for a classic touch.' },
];

/** Live catalogue — base products + admin uploads (pmj_catalogue_products in localStorage) */
function getCatalogueProducts() {
  let adminProducts = [];
  try {
    const raw = localStorage.getItem('pmj_catalogue_products');
    if (raw) adminProducts = JSON.parse(raw);
  } catch (e) { /* ignore */ }

  const byId = new Map();
  PRODUCTS.forEach((p) => byId.set(p.id, { ...p }));
  if (Array.isArray(adminProducts)) {
    adminProducts.forEach((p) => {
      if (p?.id) byId.set(p.id, { ...byId.get(p.id), ...p });
    });
  }
  return [...byId.values()];
}

window.getCatalogueProducts = getCatalogueProducts;

const SPEC_DEFAULTS = {
  purity: 'Add purity',
  gross: 'Add gross weight',
  netGold: 'Add net gold weight',
  diamond: 'Add diamond / stone weight',
  stones: 'Add stone details',
  price: 'Price on request'
};

