/* Customer Selection (Wishlist) drawer & enquiry submission */
const drawer = document.getElementById('drawer');
const overlay = document.getElementById('overlay');
const drawerBody = document.getElementById('drawerBody');
const successView = document.getElementById('successView');
const drawerMain = document.getElementById('drawerMain');

const drawerViewForm = document.getElementById('drawerViewForm');
const drawerViewItems = document.getElementById('drawerViewItems');

// Form input fields
const cMobile = document.getElementById('cMobile');
const cName = document.getElementById('cName');
const cEmail = document.getElementById('cEmail');
const cDob = document.getElementById('cDob');
const cAnniversary = document.getElementById('cAnniversary');
const cCity = document.getElementById('cCity');
const cRemarks = document.getElementById('cRemarks');

const pId = document.getElementById('pId');
const pName = document.getElementById('pName');
const pStore = document.getElementById('pStore');
const pExecutive = document.getElementById('pExecutive');

const btnSaveDetails = document.getElementById('btnSaveDetails');
const btnEditCustInfo = document.getElementById('btnEditCustInfo');
const sumRemarks = document.getElementById('sumRemarks');
const submitBtn = document.getElementById('submitBtn');

let activeCustomer = null;

// Initial loading of active customer and partner details
function initDetails() {
  // Load saved partner details
  try {
    const savedPartner = JSON.parse(localStorage.getItem('pmj_partner_info') || '{}');
    if (savedPartner.id) pId.value = savedPartner.id;
    if (savedPartner.name) pName.value = savedPartner.name;
    if (savedPartner.store) pStore.value = savedPartner.store;
    if (savedPartner.executive) pExecutive.value = savedPartner.executive;
  } catch (e) {}

  // Load active customer session
  try {
    const active = sessionStorage.getItem('pmj_active_customer');
    if (active) {
      activeCustomer = JSON.parse(active);
    }
  } catch (e) {}
}

// Mobile Number Lookup Event
cMobile.addEventListener('input', (e) => {
  const mobile = e.target.value.trim();
  const status = document.getElementById('cMobileStatus');
  if (mobile.length === 10) {
    try {
      const customers = JSON.parse(localStorage.getItem('pmj_customers') || '[]');
      const cust = customers.find(c => c.mobile === mobile);
      if (cust) {
        cName.value = cust.name || '';
        cEmail.value = cust.email || '';
        cDob.value = cust.dob || '';
        cAnniversary.value = cust.anniversary || '';
        cCity.value = cust.city || '';
        cRemarks.value = cust.remarks || '';
        status.textContent = '✓ Existing customer loaded';
        status.style.color = '#52b788';
      } else {
        status.textContent = 'New customer';
        status.style.color = '#c7a252';
      }
    } catch (err) {}
  } else {
    status.textContent = '';
  }
});

// Save Customer/Partner Details and proceed to items
btnSaveDetails.addEventListener('click', () => {
  const mobile = cMobile.value.trim();
  const name = cName.value.trim();
  const email = cEmail.value.trim();
  const dob = cDob.value.trim();
  const city = cCity.value.trim();

  const partnerId = pId.value.trim();
  const partnerName = pName.value.trim();
  const store = pStore.value.trim();
  const execName = pExecutive.value.trim();

  if (!mobile || !name || !email || !dob || !city) {
    alert('Please fill in all required customer fields (*).');
    return;
  }
  if (!partnerId || !partnerName || !store || !execName) {
    alert('Please fill in all required partner details (*).');
    return;
  }

  // Save partner details for next time
  const partnerInfo = { id: partnerId, name: partnerName, store: store, executive: execName };
  localStorage.setItem('pmj_partner_info', JSON.stringify(partnerInfo));

  // Set active customer
  activeCustomer = {
    mobile,
    name,
    email,
    dob,
    anniversary: cAnniversary.value.trim(),
    city,
    remarks: cRemarks.value.trim()
  };
  sessionStorage.setItem('pmj_active_customer', JSON.stringify(activeCustomer));

  renderDrawer();
});

// Edit Details back click
btnEditCustInfo.addEventListener('click', () => {
  if (activeCustomer) {
    cMobile.value = activeCustomer.mobile || '';
    cName.value = activeCustomer.name || '';
    cEmail.value = activeCustomer.email || '';
    cDob.value = activeCustomer.dob || '';
    cAnniversary.value = activeCustomer.anniversary || '';
    cCity.value = activeCustomer.city || '';
    cRemarks.value = activeCustomer.remarks || '';
  }
  
  drawerViewItems.style.display = 'none';
  drawerViewForm.style.display = 'block';
  document.getElementById('drawerTitle').textContent = 'Enter Selection Details';
});

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
  
  renderDrawer();

  if (opts?.highlight && activeCustomer) {
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

function closeDrawer(){ 
  drawer.classList.remove('open', 'drawer-landed'); 
  overlay.classList.remove('open', 'overlay-wishlist-reveal'); 
}

document.getElementById('openDrawer')?.addEventListener('click', () => openDrawer());
document.getElementById('closeDrawer')?.addEventListener('click', closeDrawer);
overlay.addEventListener('click', closeDrawer);

function renderDrawer(){
  const lastAdded = window.__pmjLastWishlistAdd;
  const drawerOpen = drawer?.classList.contains('open');

  if(wishlist.length === 0){
    drawerViewForm.style.display = 'none';
    drawerViewItems.style.display = 'block';
    document.getElementById('drawerTitle').textContent = 'Customer Selection';
    
    // Hide summary card and footer actions when empty
    drawerViewItems.querySelector('.customer-summary-card').style.display = 'none';
    drawerViewItems.querySelector('.drawer-footer-actions').style.display = 'none';
    
    drawerBody.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="#f6f1e7" stroke-width="1.2"><path d="M12 21s-7.5-4.7-10-9.3C.4 8.1 2 4.5 5.6 4c2-.3 3.8.7 4.9 2.4C11.6 4.7 13.4 3.7 15.4 4c3.6.5 5.2 4.1 3.6 7.7C19.5 16.3 12 21 12 21z"/></svg>
        <p>No pieces selected.<br>Tap the heart icon on any piece to add it here.</p>
      </div>`;
    window.__pmjLastWishlistAdd = null;
    return;
  }

  // If customer details are not entered yet, show form view
  if (!activeCustomer) {
    drawerViewItems.style.display = 'none';
    drawerViewForm.style.display = 'block';
    document.getElementById('drawerTitle').textContent = 'Enter Selection Details';
    return;
  }

  // Show selection view
  drawerViewForm.style.display = 'none';
  drawerViewItems.style.display = 'block';
  document.getElementById('drawerTitle').textContent = 'Review Selection';
  
  // Show summary card and footer actions
  drawerViewItems.querySelector('.customer-summary-card').style.display = 'flex';
  drawerViewItems.querySelector('.drawer-footer-actions').style.display = 'block';

  // Populate summary labels
  document.getElementById('sumCustName').textContent = activeCustomer.name;
  document.getElementById('sumCustMobile').textContent = activeCustomer.mobile;
  
  const savedPartner = JSON.parse(localStorage.getItem('pmj_partner_info') || '{}');
  document.getElementById('sumStore').textContent = savedPartner.store || '-';
  document.getElementById('sumExec').textContent = savedPartner.executive || '-';

  // Render list of selected items grouped/labeled with details
  drawerBody.innerHTML = `
    <div style="font-size: 10px; text-transform: uppercase; letter-spacing: 0.12em; color: var(--gold); padding: 0 20px 8px; border-bottom: 1px solid rgba(255, 255, 255, 0.08);">
      Selected Pieces (${wishlist.length} Items)
    </div>
  ` + wishlist.map(id => {
    const p = getProductData(id);
    const avail = getAvailabilityMeta(p.availability);
    const dramaticEntry = window.__pmjWishlistDramaticEntry && drawerOpen && id === lastAdded;
    const enterClass = dramaticEntry ? ' wl-item-enter wl-item-enter-dramatic' : (drawerOpen && id === lastAdded ? ' wl-item-enter' : '');
    
    // Extract collection and category information
    const collectionLabel = p.collections && p.collections.length ? p.collections.map(c => {
      const colObj = typeof getCollectionById === 'function' ? getCollectionById(c) : null;
      return colObj ? colObj.title : c;
    }).join(', ') : 'Sweet 16';
    
    return `
      <div class="wl-item${enterClass}" data-id="${p.id}" style="padding: 16px 20px;">
        <div class="wl-thumb"><img src="${IMAGES[p.images[0]]}" alt=""></div>
        <div class="wl-info">
          <div class="n" style="font-weight: 500;">${p.name}</div>
          <div class="p" style="font-size: 11px; margin-top: 2px;">
            Code: <strong>${p.id}</strong><br>
            Collection: ${collectionLabel} · Cat: ${p.catLabel}
          </div>
          <span class="availability-inline ${avail.badgeClass}" style="margin-top: 6px;">${avail.short}</span>
        </div>
        <span class="wl-remove" data-id="${p.id}" style="font-size: 10px; cursor: pointer; text-decoration: underline;">Remove</span>
      </div>`;
  }).join('');
}

drawerBody.addEventListener('click', (e)=>{
  const rm = e.target.closest('.wl-remove');
  if(!rm) return;
  toggleWishlist(rm.dataset.id, rm);
});

// Submit Button Listener
submitBtn.addEventListener('click', submitSelection);

async function submitSelection() {
  if (!activeCustomer) {
    alert('Customer details are missing.');
    return;
  }
  if (wishlist.length === 0) {
    alert('Add at least one piece to submit a selection.');
    return;
  }

  submitBtn.disabled = true;
  const submitLabel = document.getElementById('submitLabel');
  if (submitLabel) submitLabel.textContent = 'Saving Selection…';

  // Generate Wishlist Number: WL-yymmdd-xxxx
  const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, '');
  const randCode = Math.random().toString(36).slice(2, 6).toUpperCase();
  const wlNumber = `WL-${dateStr}-${randCode}`;

  const savedPartner = JSON.parse(localStorage.getItem('pmj_partner_info') || '{}');
  const remarksText = sumRemarks.value.trim() || activeCustomer.remarks;

  // Create products list
  const selectedProducts = wishlist.map(id => {
    const p = getProductData(id);
    const collectionLabel = p.collections && p.collections.length ? p.collections[0] : 'sweet-16';
    return {
      productId: p.id,
      productCode: p.id,
      collection: collectionLabel,
      category: p.cat,
      quantity: 1
    };
  });

  // Create Selection Payload
  const payload = {
    partnerInfo: {
      partnerId: savedPartner.id || '',
      partnerName: savedPartner.name || '',
      storeName: savedPartner.store || '',
      salesExecutiveName: savedPartner.executive || ''
    },
    customerInfo: {
      customerName: activeCustomer.name,
      mobile: activeCustomer.mobile,
      email: activeCustomer.email,
      dob: activeCustomer.dob,
      anniversary: activeCustomer.anniversary,
      city: activeCustomer.city
    },
    wishlistInfo: {
      wishlistNumber: wlNumber,
      createdDate: new Date().toISOString(),
      status: 'Submitted',
      remarks: remarksText
    },
    selectedProducts
  };

  // 1. Save submission to log list in localStorage
  try {
    const submissions = JSON.parse(localStorage.getItem('pmj_submitted_wishlists') || '[]');
    submissions.push(payload);
    localStorage.setItem('pmj_submitted_wishlists', JSON.stringify(submissions));
  } catch (e) {}

  // 2. Save customer record to database in localStorage so they can be looked up by Mobile Number next time
  try {
    const customers = JSON.parse(localStorage.getItem('pmj_customers') || '[]');
    const existingIdx = customers.findIndex(c => c.mobile === activeCustomer.mobile);
    
    const custRecord = {
      mobile: activeCustomer.mobile,
      name: activeCustomer.name,
      email: activeCustomer.email,
      dob: activeCustomer.dob,
      anniversary: activeCustomer.anniversary,
      city: activeCustomer.city,
      remarks: remarksText
    };

    if (existingIdx !== -1) {
      customers[existingIdx] = custRecord;
    } else {
      customers.push(custRecord);
    }
    localStorage.setItem('pmj_customers', JSON.stringify(customers));
  } catch (e) {}

  // Simulate server/processing lag
  await new Promise(r => setTimeout(r, 800));

  // Display Success View
  document.getElementById('refCode').innerHTML = `
    <div style="font-size: 14px; margin-bottom: 8px;"><strong>Selection Details Saved</strong></div>
    <div style="font-size: 13px; color: var(--gold); font-family: monospace;">${wlNumber}</div>
    <div style="margin-top: 12px; font-size: 11px; opacity: 0.85;">
      Customer: <strong>${activeCustomer.name}</strong><br>
      Total Pieces: <strong>${wishlist.length}</strong>
    </div>
  `;

  const successP = successView.querySelector('p');
  if (successP) {
    successP.textContent = `The selection has been successfully logged under partner ${savedPartner.name || ''} and associated with customer ${activeCustomer.name}.`;
  }

  drawerMain.style.display = 'none';
  successView.classList.add('show');
  
  submitBtn.disabled = false;
  if (submitLabel) submitLabel.textContent = 'Submit Customer Selection';
}

// Reset Selection and start fresh
document.getElementById('newEnquiry').addEventListener('click', (e)=>{
  e.preventDefault();
  
  // Reset selection states
  wishlist = [];
  activeCustomer = null;
  sessionStorage.removeItem('pmj_active_customer');
  
  // Clear inputs (except partner details)
  ['cMobile', 'cName', 'cEmail', 'cDob', 'cAnniversary', 'cCity', 'cRemarks', 'sumRemarks'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  
  document.getElementById('cMobileStatus').textContent = '';

  // Re-render
  if (typeof renderGrid === 'function') renderGrid();
  if (typeof updateCount === 'function') updateCount();
  if (typeof refreshWishlistUi === 'function') refreshWishlistUi();
  
  renderDrawer();
  
  successView.classList.remove('show');
  drawerMain.style.display = 'block';
});

// Setup Initial state on load
initDetails();
renderDrawer();

window.openWishlistDrawer = openDrawer;
window.closeWishlistDrawer = closeDrawer;
window.refreshWishlistDrawer = renderDrawer;
