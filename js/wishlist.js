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
const draftsList = document.getElementById('draftsList');

let activeCustomer = null;

// Helper to refresh PLP grid reliably
function refreshGridUi() {
  if (typeof window.renderCatalogueGrid === 'function') {
    window.renderCatalogueGrid();
  } else if (typeof renderGrid === 'function') {
    renderGrid(true);
  }
}

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
      window.activeCustomer = activeCustomer;
    }
  } catch (e) {}

  // Load active wishlist items
  try {
    const savedWl = sessionStorage.getItem('pmj_active_wishlist');
    if (savedWl) {
      wishlist = JSON.parse(savedWl);
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

  // ONLY cMobile and cName are required! Everything else is optional!
  if (!mobile) {
    alert('Please enter a Mobile Number.');
    return;
  }
  if (!name) {
    alert('Please enter a Customer Name.');
    return;
  }

  // Save partner details for next time
  const partnerInfo = {
    id: pId.value.trim(),
    name: pName.value.trim(),
    store: pStore.value.trim(),
    executive: pExecutive.value.trim()
  };
  localStorage.setItem('pmj_partner_info', JSON.stringify(partnerInfo));

  // Set active customer
  activeCustomer = {
    mobile,
    name,
    email: cEmail.value.trim(),
    dob: cDob.value.trim(),
    anniversary: cAnniversary.value.trim(),
    city: cCity.value.trim(),
    remarks: cRemarks.value.trim()
  };
  sessionStorage.setItem('pmj_active_customer', JSON.stringify(activeCustomer));

  // Automatically save as draft
  saveCurrentAsDraft();

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

// Start New Selection Session click
const btnStartNewSelection = document.getElementById('btnStartNewSelection');
if (btnStartNewSelection) {
  btnStartNewSelection.addEventListener('click', () => {
    // 1. If we have active customer and items in wishlist, auto-save as draft first so we don't lose progress!
    if (activeCustomer && activeCustomer.mobile && wishlist.length > 0) {
      saveCurrentAsDraft();
    }

    // 2. Reset active states
    wishlist = [];
    activeCustomer = null;
    sessionStorage.removeItem('pmj_active_customer');
    window.showWishlistOnly = false;

    // 3. Clear inputs
    ['cMobile', 'cName', 'cEmail', 'cDob', 'cAnniversary', 'cCity', 'cRemarks', 'sumRemarks'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    document.getElementById('cMobileStatus').textContent = '';

    // 4. Update browsing stage to collections and refresh layout
    window.setBrowseStage?.('collections');
    window.setBrowseVisibility?.();

    // 5. Re-render UI
    refreshGridUi();
    if (typeof updateCount === 'function') updateCount();
    if (typeof refreshWishlistUi === 'function') refreshWishlistUi();

    renderDrawer();

    // 6. Close drawer and scroll to homepage
    closeDrawer();
    setTimeout(() => {
      document.getElementById('collectionsHub')?.scrollIntoView({ behavior: 'smooth' });
    }, 300);
  });
}

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

  // If success view was showing, reset state so it opens clean next time
  if (successView && successView.classList.contains('show')) {
    wishlist = [];
    activeCustomer = null;
    sessionStorage.removeItem('pmj_active_customer');
    window.showWishlistOnly = false;
    
    ['cMobile', 'cName', 'cEmail', 'cDob', 'cAnniversary', 'cCity', 'cRemarks', 'sumRemarks'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    
    const status = document.getElementById('cMobileStatus');
    if (status) status.textContent = '';
    
    window.setBrowseStage?.('collections');
    window.setBrowseVisibility?.();
    
    refreshGridUi();
    if (typeof updateCount === 'function') updateCount();
    if (typeof refreshWishlistUi === 'function') refreshWishlistUi();
    
    renderDrawer();
    
    successView.classList.remove('show');
    drawerMain.classList.remove('hidden');
  }
}

document.getElementById('openDrawer')?.addEventListener('click', () => openDrawer());
document.getElementById('closeDrawer')?.addEventListener('click', closeDrawer);
overlay.addEventListener('click', closeDrawer);

// Drafts Management Logic
function saveCurrentAsDraft() {
  if (!activeCustomer || !activeCustomer.mobile) return;
  try {
    const drafts = JSON.parse(localStorage.getItem('pmj_draft_wishlists') || '[]');
    const draftIdx = drafts.findIndex(d => d.customer.mobile === activeCustomer.mobile);
    const draftData = {
      customer: activeCustomer,
      products: [...wishlist],
      lastUpdated: new Date().toISOString()
    };
    if (draftIdx !== -1) {
      drafts[draftIdx] = draftData;
    } else {
      drafts.push(draftData);
    }
    localStorage.setItem('pmj_draft_wishlists', JSON.stringify(drafts));
  } catch (e) {}
}

function renderDraftsList() {
  if (!draftsList) return;
  try {
    const drafts = JSON.parse(localStorage.getItem('pmj_draft_wishlists') || '[]');
    const draftsSection = document.getElementById('drawerDraftsSection');
    if (drafts.length === 0) {
      draftsSection.style.display = 'none';
      return;
    }
    draftsSection.style.display = 'block';

    draftsList.innerHTML = drafts.map((draft, idx) => {
      const formattedDate = new Date(draft.lastUpdated).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      // Products summary for expansion
      const productsSummaryHtml = draft.products.map(pId => {
        const p = getProductData(pId);
        if (!p) return '';
        return `
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px; padding: 4px; background: rgba(0,0,0,0.15); border-radius: 3px;">
            <img src="${IMAGES[p.images[0]]}" style="width: 24px; height: 24px; object-fit: contain; background: #fff;" alt="">
            <div style="font-size: 10px; line-height: 1.2;">
              <span style="font-weight: 500; display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 220px;">${p.name}</span>
              <span style="opacity: 0.6; font-size: 8px;">Code: ${p.id}</span>
            </div>
          </div>
        `;
      }).join('');

      return `
        <div class="draft-card" data-idx="${idx}" style="background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.08); padding: 10px 14px; border-radius: 4px; display: flex; flex-direction: column; cursor: pointer;">
          <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px;">
            <div style="font-size: 11px; line-height: 1.4; flex: 1;">
              <strong>${draft.customer.name}</strong> (${draft.customer.mobile})<br>
              <span style="opacity: 0.7; font-size: 10px;">${draft.products.length} item(s) · ${formattedDate}</span>
              <span style="color: var(--gold); font-size: 9px; display: block; margin-top: 2px;">▸ Tap to load & browse on page</span>
            </div>
            <div style="display: flex; gap: 8px; flex-shrink: 0;" class="draft-actions">
              <button type="button" class="btn-text-edit btn-load-draft" data-idx="${idx}" style="font-size: 10px; padding: 4px 6px; text-decoration: none; background: rgba(199,162,82,0.15); border-radius: 3px; border: 1px solid rgba(199,162,82,0.3);">Load</button>
              <button type="button" class="btn-text-edit btn-delete-draft" data-idx="${idx}" style="font-size: 10px; color: #ff6b6b; text-decoration: none; padding: 4px 6px;">✕</button>
            </div>
          </div>
          <div class="draft-item-products" id="draftProducts-${idx}">
            <div style="font-size: 9px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--gold); margin-bottom: 8px; font-weight: 600;">Saved Items:</div>
            ${productsSummaryHtml || '<div style="font-size: 10px; opacity: 0.6; font-style: italic;">No items saved in this draft.</div>'}
          </div>
        </div>
      `;
    }).join('');
  } catch (e) {
    console.error(e);
  }
}

// Bind draft buttons & card click
if (draftsList) {
  draftsList.addEventListener('click', (e) => {
    const loadBtn = e.target.closest('.btn-load-draft');
    const deleteBtn = e.target.closest('.btn-delete-draft');
    const card = e.target.closest('.draft-card');
    
    if (deleteBtn) {
      e.stopPropagation();
      const idx = parseInt(deleteBtn.dataset.idx, 10);
      try {
        const drafts = JSON.parse(localStorage.getItem('pmj_draft_wishlists') || '[]');
        drafts.splice(idx, 1);
        localStorage.setItem('pmj_draft_wishlists', JSON.stringify(drafts));
        renderDraftsList();
      } catch (err) {}
    } else if (loadBtn || card) {
      if (loadBtn) e.stopPropagation();
      const target = loadBtn || card;
      const idx = parseInt(target.dataset.idx, 10);
      try {
        const drafts = JSON.parse(localStorage.getItem('pmj_draft_wishlists') || '[]');
        const draft = drafts[idx];
        if (draft) {
          // 1. Populate states
          activeCustomer = draft.customer;
          sessionStorage.setItem('pmj_active_customer', JSON.stringify(activeCustomer));
          wishlist = [...draft.products];
          sessionStorage.setItem('pmj_active_wishlist', JSON.stringify(wishlist));
          
          // 2. Prepopulate form inputs
          cMobile.value = activeCustomer.mobile || '';
          cName.value = activeCustomer.name || '';
          cEmail.value = activeCustomer.email || '';
          cDob.value = activeCustomer.dob || '';
          cAnniversary.value = activeCustomer.anniversary || '';
          cCity.value = activeCustomer.city || '';
          cRemarks.value = activeCustomer.remarks || '';
          
          // 3. Set page filter to show selection only
          window.showWishlistOnly = true;
          
          // 4. Update browsing stage and visibilities
          window.setBrowseStage?.('gallery');
          window.setBrowseVisibility?.();
          
          // 5. Re-render page elements
          refreshGridUi();
          if (typeof updateCount === 'function') updateCount();
          if (typeof refreshWishlistUi === 'function') refreshWishlistUi();
          window.updateGalleryBreadcrumb?.('all');
          
          // 6. Draw drawer elements
          renderDrawer();
          
          // 7. Close drawer and scroll to catalogue section
          closeDrawer();
          setTimeout(() => {
            document.getElementById('catalogue')?.scrollIntoView({ behavior: 'smooth' });
          }, 300);
        }
      } catch (err) {}
    }
  });
}

function renderDrawer(){
  // Sync state to window namespace for global visibility
  window.activeCustomer = activeCustomer;

  const lastAdded = window.__pmjLastWishlistAdd;
  const drawerOpen = drawer?.classList.contains('open');

  // Sync to sessionStorage
  try {
    sessionStorage.setItem('pmj_active_wishlist', JSON.stringify(wishlist));
  } catch (e) {}

  // Update active selection floating status pill
  const pill = document.getElementById('activeSelectionPill');
  const pillText = document.getElementById('activeSelectionPillText');
  if (pill && pillText) {
    if (activeCustomer) {
      pillText.textContent = `Selection: ${activeCustomer.name} (${wishlist.length} pcs)`;
      pill.classList.remove('hidden');
    } else {
      pill.classList.add('hidden');
    }
  }

  // Update selection mode banner on PLP page
  const selBanner = document.getElementById('selectionModeBanner');
  const selBannerName = document.getElementById('selBannerCustName');
  const selBannerCount = document.getElementById('selBannerCustCount');
  if (selBanner && selBannerName && selBannerCount) {
    if (window.showWishlistOnly && activeCustomer) {
      selBannerName.textContent = activeCustomer.name;
      selBannerCount.textContent = wishlist.length;
      selBanner.classList.remove('hidden');
    } else {
      selBanner.classList.add('hidden');
    }
  }

  // Trigger automatic saving of drafts if activeCustomer and wishlist exist
  if (activeCustomer && wishlist.length > 0) {
    saveCurrentAsDraft();
  }

  renderDraftsList();

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
    if (!p) return '';
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
  // Auto-save draft on item removal
  saveCurrentAsDraft();
  renderDraftsList();
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
      email: activeCustomer.email || '',
      dob: activeCustomer.dob || '',
      anniversary: activeCustomer.anniversary || '',
      city: activeCustomer.city || ''
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
      email: activeCustomer.email || '',
      dob: activeCustomer.dob || '',
      anniversary: activeCustomer.anniversary || '',
      city: activeCustomer.city || '',
      remarks: remarksText
    };

    if (existingIdx !== -1) {
      customers[existingIdx] = custRecord;
    } else {
      customers.push(custRecord);
    }
    localStorage.setItem('pmj_customers', JSON.stringify(customers));
  } catch (e) {}

  // 3. Remove from draft list since it's now submitted
  try {
    const drafts = JSON.parse(localStorage.getItem('pmj_draft_wishlists') || '[]');
    const draftIdx = drafts.findIndex(d => d.customer.mobile === activeCustomer.mobile);
    if (draftIdx !== -1) {
      drafts.splice(draftIdx, 1);
      localStorage.setItem('pmj_draft_wishlists', JSON.stringify(drafts));
    }
  } catch (e) {}

  // Simulate server/processing lag
  await new Promise(r => setTimeout(r, 800));

  // Build submitted products HTML for the review section
  const productsHtml = wishlist.map(id => {
    const p = getProductData(id);
    if (!p) return '';
    return `
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px; text-align: left; background: rgba(255,255,255,0.03); padding: 8px; border-radius: 4px;">
        <img src="${IMAGES[p.images[0]]}" style="width: 40px; height: 40px; object-fit: contain; background: #fff;" alt="">
        <div>
          <div style="font-weight: 500; font-size: 11px;">${p.name}</div>
          <div style="font-size: 10px; opacity: 0.7;">Code: ${p.id} · ${p.catLabel}</div>
        </div>
      </div>
    `;
  }).join('');

  // Display Success View (products which are interested review shown in a list)
  document.getElementById('refCode').innerHTML = `
    <div style="font-size: 14px; margin-bottom: 12px;"><strong>Selection Details Saved</strong></div>
    <div style="font-size: 13px; color: var(--gold); font-family: monospace; margin-bottom: 12px;">${wlNumber}</div>
    <div style="margin-top: 12px; font-size: 11px; opacity: 0.85; margin-bottom: 16px;">
      Customer: <strong>${activeCustomer.name}</strong><br>
      Total Pieces: <strong>${wishlist.length}</strong>
    </div>
    <div style="max-height: 180px; overflow-y: auto; margin-bottom: 16px; border: 1px solid rgba(255,255,255,0.08); padding: 8px; border-radius: 4px;">
      ${productsHtml}
    </div>
  `;

  const successP = successView.querySelector('p');
  if (successP) {
    successP.textContent = `The selection has been successfully logged under partner ${savedPartner.name || ''} and associated with customer ${activeCustomer.name}.`;
  }

  drawerMain.classList.add('hidden');
  successView.classList.add('show');
  
  submitBtn.disabled = false;
  if (submitLabel) submitLabel.textContent = 'Submit Customer Selection';

  // Automatically close the drawer and reset to collections homepage after 3 seconds
  setTimeout(() => {
    if (successView.classList.contains('show')) {
      closeDrawer();
    }
  }, 3000);
}

// Reset Selection and start fresh
document.getElementById('newEnquiry').addEventListener('click', (e)=>{
  e.preventDefault();
  
  // Reset selection states
  wishlist = [];
  activeCustomer = null;
  sessionStorage.removeItem('pmj_active_customer');
  window.showWishlistOnly = false;
  
  // Clear inputs (except partner details)
  ['cMobile', 'cName', 'cEmail', 'cDob', 'cAnniversary', 'cCity', 'cRemarks', 'sumRemarks'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  
  document.getElementById('cMobileStatus').textContent = '';

  // Update browsing stage to collections homepage
  window.setBrowseStage?.('collections');
  window.setBrowseVisibility?.();

  // Re-render
  refreshGridUi();
  if (typeof updateCount === 'function') updateCount();
  if (typeof refreshWishlistUi === 'function') refreshWishlistUi();
  
  renderDrawer();
  
  // Reset view visibility classes
  successView.classList.remove('show');
  drawerMain.classList.remove('hidden');

  // Close the drawer and scroll to homepage collections stage
  closeDrawer();
  setTimeout(() => {
    document.getElementById('collectionsHub')?.scrollIntoView({ behavior: 'smooth' });
  }, 300);
});

// Setup Initial state on load
initDetails();
renderDrawer();

window.openWishlistDrawer = openDrawer;
window.closeWishlistDrawer = closeDrawer;
window.refreshWishlistDrawer = renderDrawer;

// Active selection status pill click
const activeSelectionPill = document.getElementById('activeSelectionPill');
if (activeSelectionPill) {
  activeSelectionPill.addEventListener('click', () => {
    openDrawer();
  });
}

// Curation Selection Mode Banner Action buttons click listeners
document.addEventListener('click', (e) => {
  const btnBrowseMore = e.target.closest('#btnBrowseMoreFromCollections');
  const btnOpenReview = e.target.closest('#btnOpenReviewDrawer');
  
  if (btnBrowseMore) {
    e.preventDefault();
    // 1. Reset selection-only filter to show all products
    window.showWishlistOnly = false;
    
    // 2. Set stage to collections (homepage)
    window.setBrowseStage?.('collections');
    window.setBrowseVisibility?.();
    
    // 3. Re-render Grid & update headers
    if (typeof window.renderCatalogueGrid === 'function') {
      window.renderCatalogueGrid();
    } else if (typeof renderGrid === 'function') {
      renderGrid(true);
    }
    window.updateGalleryBreadcrumb?.('all');

    // 4. Update banner state & drawer
    renderDrawer();
    
    // 5. Scroll smoothly to collections page
    document.getElementById('collectionsHub')?.scrollIntoView({ behavior: 'smooth' });
  }
  
  if (btnOpenReview) {
    e.preventDefault();
    openDrawer();
  }
});
