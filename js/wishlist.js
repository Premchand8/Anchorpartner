/* Wishlist drawer & enquiry submission */
const drawer = document.getElementById('drawer');
const overlay = document.getElementById('overlay');
const drawerBody = document.getElementById('drawerBody');
const drawerForm = document.getElementById('drawerForm');
const successView = document.getElementById('successView');
const drawerMain = document.getElementById('drawerMain');

function openDrawer(opts = {}){
  const dramatic = opts?.dramatic === true;
  drawer.classList.remove('drawer-landed');
  overlay.classList.remove('overlay-wishlist-reveal');
  drawer.classList.add('open');
  overlay.classList.add('open');
  if (dramatic) {
    overlay.classList.add('overlay-wishlist-reveal');
    drawer.classList.add('drawer-landed');
    window.setTimeout(() => drawer.classList.remove('drawer-landed'), 820);
  }
  if (opts?.highlight) {
    window.__pmjLastWishlistAdd = opts.highlight;
    window.__pmjWishlistDramaticEntry = dramatic;
    renderDrawer();
    window.__pmjWishlistDramaticEntry = false;
    window.requestAnimationFrame(() => {
      const row = drawerBody.querySelector(`.wl-item[data-id="${CSS.escape(String(opts.highlight))}"]`);
      row?.scrollIntoView({ behavior: dramatic ? 'smooth' : 'auto', block: 'nearest' });
    });
  }
}
function closeDrawer(){ drawer.classList.remove('open', 'drawer-landed'); overlay.classList.remove('open', 'overlay-wishlist-reveal'); }
document.getElementById('openDrawer')?.addEventListener('click', () => openDrawer());
document.getElementById('closeDrawer')?.addEventListener('click', closeDrawer);
overlay.addEventListener('click', closeDrawer);

function renderDrawer(){
  const lastAdded = window.__pmjLastWishlistAdd;
  const drawerOpen = drawer?.classList.contains('open');
  if(wishlist.length === 0){
    drawerBody.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="#f6f1e7" stroke-width="1.2"><path d="M12 21s-7.5-4.7-10-9.3C.4 8.1 2 4.5 5.6 4c2-.3 3.8.7 4.9 2.4C11.6 4.7 13.4 3.7 15.4 4c3.6.5 5.2 4.1 3.6 7.7C19.5 16.3 12 21 12 21z"/></svg>
        <p>Nothing saved yet.<br>Tap the heart on any piece to add it here.</p>
      </div>`;
    drawerForm.style.display = 'none';
    window.__pmjLastWishlistAdd = null;
    return;
  }
  drawerForm.style.display = 'block';
  drawerBody.innerHTML = wishlist.map(id=>{
    const p = getProductData(id);
    const avail = getAvailabilityMeta(p.availability);
    const dramaticEntry = window.__pmjWishlistDramaticEntry && drawerOpen && id === lastAdded;
    const enterClass = dramaticEntry ? ' wl-item-enter wl-item-enter-dramatic' : (drawerOpen && id === lastAdded ? ' wl-item-enter' : '');
    return `
      <div class="wl-item${enterClass}" data-id="${p.id}">
        <div class="wl-thumb"><img src="${IMAGES[p.images[0]]}" alt=""></div>
        <div class="wl-info">
          <div class="n">${p.name}</div>
          <div class="p">${p.catLabel} · ${p.price}</div>
          <span class="availability-inline ${avail.badgeClass}">${avail.short}</span>
        </div>
        <span class="wl-remove" data-id="${p.id}">Remove</span>
      </div>`;
  }).join('');
}
renderDrawer();

drawerBody.addEventListener('click', (e)=>{
  const rm = e.target.closest('.wl-remove');
  if(!rm) return;
  toggleWishlist(rm.dataset.id, rm);
});

/* =========================================================
   SUBMIT ENQUIRY
   Hook up real email delivery here (see notes below).
   Recommended: EmailJS — https://www.emailjs.com
   ========================================================= */
const EMAILJS_SERVICE_ID = 'YOUR_SERVICE_ID';
const EMAILJS_TEMPLATE_INTERNAL = 'YOUR_INTERNAL_TEMPLATE_ID';
const EMAILJS_TEMPLATE_CUSTOMER = 'YOUR_CUSTOMER_TEMPLATE_ID';
const EMAILJS_PUBLIC_KEY = 'YOUR_PUBLIC_KEY';

const submitBtn = document.getElementById('submitBtn');
const submitLabel = document.getElementById('submitLabel');
submitBtn.addEventListener('click', sendEnquiry);

function buildItemsSummary(){
  return wishlist.map(id=>{
    const p = getProductData(id);
    const avail = getAvailabilityMeta(p.availability);
    return `${p.name} (${p.catLabel}, ${p.id}) — ${avail.label}`;
  }).join('\n');
}

async function sendEnquiry(){
  const name = document.getElementById('fName').value.trim();
  const email = document.getElementById('fEmail').value.trim();
  const phone = document.getElementById('fPhone').value.trim();
  const msg = document.getElementById('fMsg').value.trim();

  if(!name || !email){ alert('Please enter your name and email so we can reach you.'); return; }
  if(wishlist.length === 0){ alert('Add at least one piece to your wishlist before submitting.'); return; }

  submitBtn.disabled = true;
  submitLabel.textContent = 'Sending…';
  const refCode = 'PMJ-' + Math.random().toString(36).slice(2,8).toUpperCase();

  /* ---- REAL EMAIL SEND (uncomment once EmailJS is configured) ----
  const payload = {
    customer_name: name, customer_email: email, customer_phone: phone,
    customer_message: msg, wishlist_items: buildItemsSummary(), reference_code: refCode
  };
  try {
    await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_INTERNAL, payload, EMAILJS_PUBLIC_KEY);
    await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_CUSTOMER, payload, EMAILJS_PUBLIC_KEY);
  } catch (err) {
    submitBtn.disabled = false; submitLabel.textContent = 'Submit Wishlist Enquiry';
    alert('Something went wrong sending your enquiry. Please try again.');
    return;
  }
  ------------------------------------------------------------------ */

  await new Promise(r => setTimeout(r, 900));
  document.getElementById('refCode').textContent = 'Reference: ' + refCode;
  drawerMain.style.display = 'none';
  successView.classList.add('show');
  submitBtn.disabled = false;
  submitLabel.textContent = 'Submit Wishlist Enquiry';
}

document.getElementById('newEnquiry').addEventListener('click', (e)=>{
  e.preventDefault();
  wishlist = [];
  renderGrid(); updateCount(); renderDrawer();
  ['fName','fEmail','fPhone','fMsg'].forEach(id=> document.getElementById(id).value = '');
  successView.classList.remove('show');
  drawerMain.style.display = 'block';
});

window.openWishlistDrawer = openDrawer;
window.closeWishlistDrawer = closeDrawer;
