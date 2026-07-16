import { supabase } from './utils/supabase.js';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';

// 1. Session & Role Validation
let currentAdmin = null;

async function authenticateAdmin() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    window.location.href = './login.html';
    return;
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error || !profile || (profile.role !== 'admin' && profile.role !== 'super_admin')) {
    await supabase.auth.signOut();
    window.location.href = './login.html';
    return;
  }

  currentAdmin = profile;
  document.getElementById('currentAdminEmail').textContent = profile.email;
  
  // Load initial statistics
  loadDashboardData();
  subscribeRealtimeUpdates();
}

function subscribeRealtimeUpdates() {
  supabase
    .channel('admin-dashboard-sync')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'wishlists' }, () => {
      loadDashboardData();
      if (typeof loadCustomerSelections === 'function') loadCustomerSelections();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => {
      loadDashboardData();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'collections' }, () => {
      loadDashboardData();
    })
    .subscribe();
}

// 2. Tab Navigation Router
const navItems = document.querySelectorAll('.nav-item');
const panels = document.querySelectorAll('.panel');
const panelHeading = document.getElementById('panelHeading');

navItems.forEach(item => {
  item.addEventListener('click', () => {
    const target = item.getAttribute('data-target');
    
    navItems.forEach(i => i.classList.remove('active'));
    panels.forEach(p => p.classList.remove('active'));
    
    item.classList.add('active');
    document.getElementById(target).classList.add('active');
    panelHeading.textContent = item.querySelector('a').textContent.trim();
    
    // Lazy-load data based on active tab
    if (target === 'panelCollections') loadCollectionsCMS();
    if (target === 'panelProducts') loadProductCatalogue();
    if (target === 'panelPricing') loadPricingSettings();
    if (target === 'panelEmail') loadEmailSettings();
    if (target === 'panelSelections') loadCustomerSelections();
    if (target === 'panelLogs') loadAuditLogs();
  });
});

// 3. System Logging Helper
async function writeLog(action, target, metadata = {}) {
  if (!currentAdmin) return;
  await supabase.from('audit_logs').insert({
    user_id: currentAdmin.id,
    user_email: currentAdmin.email,
    action,
    target,
    metadata
  });
}

// 4. Dashboard Stats Loader
async function loadDashboardData() {
  try {
    const { count: productCount } = await supabase.from('products').select('*', { count: 'exact', head: true });
    const { count: collectionCount } = await supabase.from('collections').select('*', { count: 'exact', head: true });
    const { count: selectionCount } = await supabase.from('wishlists').select('*', { count: 'exact', head: true });
    
    document.getElementById('statTotalProducts').textContent = productCount || 0;
    document.getElementById('statTotalCollections').textContent = collectionCount || 0;
    document.getElementById('statSubmittedSelections').textContent = selectionCount || 0;
    
    // Load current gold rate
    const { data: pricing } = await supabase
      .from('pricing_settings')
      .select('*')
      .order('effective_date', { ascending: false })
      .limit(1)
      .single();
      
    if (pricing) {
      document.getElementById('statGoldRate').textContent = `$${parseFloat(pricing.gold_rate).toFixed(2)}`;
    }

    // Load recent selections
    const { data: recent } = await supabase
      .from('wishlists')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);
      
    const tbody = document.getElementById('dashboardActivityBody');
    if (recent && recent.length > 0) {
      tbody.innerHTML = recent.map(w => `
        <tr>
          <td>${new Date(w.created_at).toLocaleDateString()}</td>
          <td>${w.partner_name || 'N/A'}</td>
          <td>${w.customer_name || 'N/A'}</td>
          <td>${w.quantity}</td>
          <td>$${parseFloat(w.estimated_value || 0).toLocaleString()}</td>
          <td><span style="padding: 4px 8px; border-radius: 12px; font-size: 11px; background: ${w.status === 'Submitted' ? 'var(--warning)' : 'var(--success)'}">${w.status}</span></td>
        </tr>
      `).join('');
    }
  } catch (err) {
    console.error('Error loading dashboard numbers:', err);
  }
}

// 5. Collections CMS Logic
const collectionSelect = document.getElementById('selectCollectionId');
const cmsForm = document.getElementById('collectionsCmsForm');

let activeCoverUrl = '';
let activeDesktopUrl = '';
let activeMobileUrl = '';

let pendingCoverFile = null;
let pendingDesktopFile = null;
let pendingMobileFile = null;

collectionSelect.addEventListener('change', loadCollectionsCMS);

// Set up file select change events
document.getElementById('colCoverInput')?.addEventListener('change', (e) => {
  if (e.target.files.length) {
    pendingCoverFile = e.target.files[0];
    document.getElementById('colCoverStatus').textContent = `Pending: ${pendingCoverFile.name}`;
  }
});
document.getElementById('colDesktopInput')?.addEventListener('change', (e) => {
  if (e.target.files.length) {
    pendingDesktopFile = e.target.files[0];
    document.getElementById('colDesktopStatus').textContent = `Pending: ${pendingDesktopFile.name}`;
  }
});
document.getElementById('colMobileInput')?.addEventListener('change', (e) => {
  if (e.target.files.length) {
    pendingMobileFile = e.target.files[0];
    document.getElementById('colMobileStatus').textContent = `Pending: ${pendingMobileFile.name}`;
  }
});

// Set up remove button clicks
document.getElementById('btnRemoveCover')?.addEventListener('click', () => {
  activeCoverUrl = '';
  pendingCoverFile = null;
  document.getElementById('colCoverStatus').textContent = 'Cleared (Save to apply)';
});
document.getElementById('btnRemoveDesktop')?.addEventListener('click', () => {
  activeDesktopUrl = '';
  pendingDesktopFile = null;
  document.getElementById('colDesktopStatus').textContent = 'Cleared (Save to apply)';
});
document.getElementById('btnRemoveMobile')?.addEventListener('click', () => {
  activeMobileUrl = '';
  pendingMobileFile = null;
  document.getElementById('colMobileStatus').textContent = 'Cleared (Save to apply)';
});

async function uploadOrConvertImage(file, collectionId, type) {
  try {
    const ext = file.name.split('.').pop();
    const filePath = `${collectionId}/${type}_${Date.now()}.${ext}`;
    
    // Attempt standard Supabase Storage upload
    const { error } = await supabase.storage
      .from('collections')
      .upload(filePath, file, { cacheControl: '3600', upsert: true });
      
    if (!error) {
      const { data: { publicUrl } } = supabase.storage
        .from('collections')
        .getPublicUrl(filePath);
      return publicUrl;
    }
  } catch (err) {
    console.warn('Supabase storage upload failed, falling back to base64 encoding:', err);
  }

  // Fallback to base64 Data URL
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}

async function loadCollectionsCMS() {
  const colId = collectionSelect.value;
  const { data: col } = await supabase.from('collections').select('*').eq('id', colId).single();
  
  // Clear file states
  pendingCoverFile = null;
  pendingDesktopFile = null;
  pendingMobileFile = null;
  
  if (col) {
    document.getElementById('colTitle').value = col.title || '';
    document.getElementById('colSubtitle').value = col.subtitle || '';
    document.getElementById('colKicker').value = col.kicker || '';
    document.getElementById('colStory').value = col.story_text || '';
    document.getElementById('colCrafts').value = col.craftsmanship_text || '';
    
    // Load CTA Configurations
    document.getElementById('colCtaText').value = col.cta_text || '';
    document.getElementById('colCtaUrl').value = col.cta_url || '';
    document.getElementById('colCtaTarget').value = col.cta_target || '_self';
    
    activeCoverUrl = col.cover_image || '';
    activeDesktopUrl = col.desktop_banner || '';
    activeMobileUrl = col.mobile_banner || '';
    
    document.getElementById('colCoverStatus').textContent = activeCoverUrl ? 'Image loaded' : 'No image uploaded';
    document.getElementById('colDesktopStatus').textContent = activeDesktopUrl ? 'Image loaded' : 'No image uploaded';
    document.getElementById('colMobileStatus').textContent = activeMobileUrl ? 'Image loaded' : 'No image uploaded';
  } else {
    cmsForm.reset();
    activeCoverUrl = '';
    activeDesktopUrl = '';
    activeMobileUrl = '';
    document.getElementById('colCoverStatus').textContent = 'No image uploaded';
    document.getElementById('colDesktopStatus').textContent = 'No image uploaded';
    document.getElementById('colMobileStatus').textContent = 'No image uploaded';
  }
}

cmsForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const colId = collectionSelect.value;
  
  // Disable save button during processing
  const submitBtn = cmsForm.querySelector('button[type="submit"]');
  const originalText = submitBtn.textContent;
  submitBtn.textContent = 'Uploading Assets...';
  submitBtn.disabled = true;

  try {
    if (pendingCoverFile) {
      activeCoverUrl = await uploadOrConvertImage(pendingCoverFile, colId, 'cover');
    }
    if (pendingDesktopFile) {
      activeDesktopUrl = await uploadOrConvertImage(pendingDesktopFile, colId, 'desktop');
    }
    if (pendingMobileFile) {
      activeMobileUrl = await uploadOrConvertImage(pendingMobileFile, colId, 'mobile');
    }

    const payload = {
      id: colId,
      title: document.getElementById('colTitle').value,
      subtitle: document.getElementById('colSubtitle').value,
      kicker: document.getElementById('colKicker').value,
      story_text: document.getElementById('colStory').value,
      craftsmanship_text: document.getElementById('colCrafts').value,
      cta_text: document.getElementById('colCtaText').value,
      cta_url: document.getElementById('colCtaUrl').value,
      cta_target: document.getElementById('colCtaTarget').value,
      cover_image: activeCoverUrl,
      desktop_banner: activeDesktopUrl,
      mobile_banner: activeMobileUrl,
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase.from('collections').upsert(payload);
    if (error) {
      alert('Failed to save collection: ' + error.message);
    } else {
      alert('Collection updated successfully!');
      writeLog('Update Collection', colId, payload);
      loadCollectionsCMS();
    }
  } catch (err) {
    alert('Failed to save collection contents: ' + err.message);
  } finally {
    submitBtn.textContent = originalText;
    submitBtn.disabled = false;
  }
});

// 6. Pricing Rules Logic
const pricingForm = document.getElementById('pricingSettingsForm');

async function loadPricingSettings() {
  const { data: pricing } = await supabase
    .from('pricing_settings')
    .select('*')
    .order('effective_date', { ascending: false })
    .limit(1)
    .single();

  if (pricing) {
    document.getElementById('goldRate').value = pricing.gold_rate;
    document.getElementById('importDuty').value = pricing.import_duty;
    document.getElementById('defaultWastage').value = pricing.default_wastage;
  }
}

pricingForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = {
    gold_rate: parseFloat(document.getElementById('goldRate').value),
    import_duty: parseFloat(document.getElementById('importDuty').value),
    default_wastage: parseFloat(document.getElementById('defaultWastage').value),
    effective_date: new Date().toISOString()
  };

  const { error } = await supabase.from('pricing_settings').insert(payload);
  if (error) {
    alert('Failed to save pricing: ' + error.message);
  } else {
    alert('Gold rate and duty configurations updated!');
    writeLog('Update Pricing Rules', 'System Settings', payload);
    loadDashboardData();
  }
});

// 7. SMTP & Templates Logic
const smtpForm = document.getElementById('smtpSettingsForm');
const templateForm = document.getElementById('emailTemplateForm');

async function loadEmailSettings() {
  const { data: smtp } = await supabase.from('email_config').select('*').eq('id', 1).single();
  if (smtp) {
    document.getElementById('smtpHost').value = smtp.smtp_host || '';
    document.getElementById('smtpPort').value = smtp.port || '';
    document.getElementById('smtpUsername').value = smtp.username || '';
    document.getElementById('smtpPassword').value = smtp.password || '';
  }

  const { data: template } = await supabase.from('email_templates').select('*').eq('id', 'customer_selection').single();
  if (template) {
    document.getElementById('templateSubject').value = template.subject || '';
    document.getElementById('templateBody').value = template.body || '';
  }
}

smtpForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = {
    id: 1,
    smtp_host: document.getElementById('smtpHost').value,
    port: parseInt(document.getElementById('smtpPort').value, 10),
    username: document.getElementById('smtpUsername').value,
    password: document.getElementById('smtpPassword').value,
    sender_email: document.getElementById('smtpUsername').value, // Simple default
    sender_name: 'PMJ Jewels Portal',
    updated_at: new Date().toISOString()
  };

  const { error } = await supabase.from('email_config').upsert(payload);
  if (error) {
    alert('Failed to save SMTP: ' + error.message);
  } else {
    alert('SMTP Configurations updated!');
    writeLog('Update SMTP Configuration', 'System SMTP');
  }
});

templateForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = {
    id: 'customer_selection',
    subject: document.getElementById('templateSubject').value,
    body: document.getElementById('templateBody').value
  };

  const { error } = await supabase.from('email_templates').upsert(payload);
  if (error) {
    alert('Failed to save template: ' + error.message);
  } else {
    alert('Confirmation Email Template saved!');
    writeLog('Update Email Template', 'customer_selection');
  }
});

// 8. Selections Review Logic
async function loadCustomerSelections() {
  const { data: list } = await supabase
    .from('wishlists')
    .select('*')
    .order('created_at', { ascending: false });

  const tbody = document.getElementById('selectionsTableBody');
  if (list && list.length > 0) {
    tbody.innerHTML = list.map(w => `
      <tr>
        <td>${new Date(w.created_at).toLocaleDateString()}</td>
        <td>${w.partner_name || 'N/A'}</td>
        <td>${w.customer_name || 'N/A'}</td>
        <td>${w.quantity} pieces</td>
        <td>$${parseFloat(w.estimated_value || 0).toLocaleString()}</td>
        <td>
          <select class="form-control" style="padding: 4px; font-size:12px; width:auto;" onchange="updateSelectionStatus('${w.id}', this.value)">
            <option value="Submitted" ${w.status === 'Submitted' ? 'selected' : ''}>Submitted</option>
            <option value="Reviewed" ${w.status === 'Reviewed' ? 'selected' : ''}>Reviewed</option>
            <option value="Approved" ${w.status === 'Approved' ? 'selected' : ''}>Approved</option>
            <option value="Rejected" ${w.status === 'Rejected' ? 'selected' : ''}>Rejected</option>
          </select>
        </td>
        <td>
          <button class="btn-submit" style="padding: 6px 12px; font-size:11px;" onclick="viewSelectionItems('${w.id}')">View Items</button>
        </td>
      </tr>
    `).join('');
  }
}

// Attach selectors to window so inline onchange and onclick work cleanly
window.updateSelectionStatus = async (id, status) => {
  const { error } = await supabase.from('wishlists').update({ status }).eq('id', id);
  if (error) alert('Failed to update status: ' + error.message);
  else writeLog('Update Selection Status', id, { status });
};

window.viewSelectionItems = async (id) => {
  const modal = document.getElementById('wishlistDetailsModal');
  const body = document.getElementById('wishlistModalBody');
  
  if (!modal || !body) return;
  
  body.innerHTML = `
    <div style="text-align: center; padding: 48px; color: var(--text-muted);">
      <i class="fa-solid fa-spinner fa-spin" style="font-size: 24px; color: var(--gold);"></i>
      <p style="margin-top: 14px; font-size: 13px; letter-spacing: 0.05em;">Retrieving curated pieces...</p>
    </div>
  `;
  modal.style.display = 'flex';

  try {
    // 1. Fetch wishlist curation record
    const { data: selection, error } = await supabase
      .from('wishlists')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !selection) throw new Error(error?.message || 'Wishlist selection not found.');

    // 2. Fetch all products details in the wishlist
    const items = selection.items || [];
    if (!items.length) {
      body.innerHTML = `
        <div style="text-align: center; padding: 24px; color: var(--text-muted);">
          <p>No pieces found in this wishlist selection.</p>
        </div>
      `;
      return;
    }

    const productIds = items.map(item => item.id);
    const { data: products } = await supabase
      .from('products')
      .select('*')
      .in('id', productIds);

    const productMap = {};
    if (products) {
      products.forEach(p => {
        productMap[p.id] = p;
      });
    }

    // 3. Render Selection Metadata & Items Grid
    const formattedDate = new Date(selection.created_at).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short'
    });

    let html = `
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 24px; margin-bottom: 28px; padding-bottom: 24px; border-bottom: 1px solid var(--line);">
        <div>
          <span style="font-size: 10px; text-transform: uppercase; color: var(--gold); font-weight: 600; letter-spacing: 0.1em; display: block; margin-bottom: 6px;">Customer Details</span>
          <p style="font-weight: 500; font-size: 15px; color: var(--text);">${selection.customer_name || 'Store Walk-in'}</p>
          <p style="font-size: 12px; color: var(--text-muted); margin-top: 4px;"><i class="fa-solid fa-phone" style="font-size: 10px; margin-right: 4px;"></i> ${selection.customer_phone || 'N/A'}</p>
        </div>
        <div>
          <span style="font-size: 10px; text-transform: uppercase; color: var(--gold); font-weight: 600; letter-spacing: 0.1em; display: block; margin-bottom: 6px;">Consultant & Store</span>
          <p style="font-weight: 500; font-size: 15px; color: var(--text);">${selection.partner_name || 'Retail Client'}</p>
          <p style="font-size: 12px; color: var(--text-muted); margin-top: 4px;"><i class="fa-solid fa-store" style="font-size: 10px; margin-right: 4px;"></i> ${selection.executive_name || 'N/A'}</p>
        </div>
        <div>
          <span style="font-size: 10px; text-transform: uppercase; color: var(--gold); font-weight: 600; letter-spacing: 0.1em; display: block; margin-bottom: 6px;">Value & Log Date</span>
          <p style="font-weight: 500; font-size: 15px; color: var(--gold);">$${parseFloat(selection.estimated_value || 0).toLocaleString()}</p>
          <p style="font-size: 12px; color: var(--text-muted); margin-top: 4px;"><i class="fa-solid fa-calendar-days" style="font-size: 10px; margin-right: 4px;"></i> ${formattedDate}</p>
        </div>
      </div>

      <div class="table-container" style="max-height: 400px; overflow-y: auto;">
        <table style="width:100%; border-collapse:collapse;">
          <thead>
            <tr>
              <th style="padding:12px 16px;">Product Image</th>
              <th style="padding:12px 16px;">Description</th>
              <th style="padding:12px 16px;">Specifications</th>
              <th style="padding:12px 16px; text-align:center;">Qty</th>
              <th style="padding:12px 16px; text-align:right;">Estimated Price</th>
            </tr>
          </thead>
          <tbody>
    `;

    items.forEach(item => {
      const prod = productMap[item.id] || {};
      const img = prod.image_url || 'https://via.placeholder.com/150';
      const name = prod.name || 'Shortlisted Item';
      const cat = prod.cat_label || prod.cat || 'Jewelry';
      const purity = prod.purity || '18 KT';
      const weight = prod.gross_weight || '0 g';
      
      let displayPrice = 'Price on Request';
      if (prod.price) {
        if (String(prod.price).startsWith('$')) {
          displayPrice = prod.price;
        } else {
          const parsedPrice = parseFloat(prod.price);
          if (parsedPrice > 0) displayPrice = `$${parsedPrice.toLocaleString()}`;
        }
      }

      let priceBreakdownHtml = '';
      if (prod.description && String(prod.description).startsWith('{')) {
        try {
          const parsed = JSON.parse(prod.description);
          if (parsed.is_price_details && parsed.details) {
            const d = parsed.details;
            priceBreakdownHtml = `
              <div style="margin-top: 8px;">
                <details style="cursor: pointer; font-size: 10px; color: var(--gold);">
                  <summary style="font-weight: 600; outline: none; margin-bottom: 4px;">View Price Breakup</summary>
                  <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); padding: 8px; border-radius: 4px; line-height: 1.4; color: var(--text-muted); pointer-events: none; text-align: left;">
                    <div>• Status: <strong>${d.product_status || 'Ready'}</strong></div>
                    <div>• Gold Net Wt: <strong>${d.net_wt} g</strong></div>
                    <div>• Dia Wt: <strong>${d.tot_dia_cts} ct</strong></div>
                    <div>• Barcode Val: <strong>$${parseFloat(d.barcode_value || 0).toFixed(2)}</strong></div>
                    <div>• Gold Diff: <strong>₹${parseFloat(d.diff || 0).toFixed(2)}</strong></div>
                    <div>• Wastage (Wsg): <strong>${d.wsg}%</strong></div>
                    <div>• Gold Amt Diff: <strong>$${parseFloat(d.gold_amt_diff || 0).toFixed(2)}</strong></div>
                    <div>• New Tag Val: <strong>$${parseFloat(d.new_tag_value || 0).toFixed(2)}</strong></div>
                    <div>• Duty (15.5%): <strong>$${parseFloat(d.duty_value || 0).toFixed(2)}</strong></div>
                    <div style="color: var(--gold); font-weight: 600; margin-top: 4px; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 4px;">• Total Tag: ${displayPrice}</div>
                  </div>
                </details>
              </div>
            `;
          }
        } catch (e) {}
      }

      html += `
        <tr>
          <td style="padding:12px 16px; width: 70px;">
            <img src="${img}" alt="${name}" style="width: 54px; height: 54px; object-fit: cover; border-radius: 2px; border: 1px solid var(--line); background:#fff;">
          </td>
          <td style="padding:12px 16px; vertical-align: top;">
            <div style="font-weight: 500; color: var(--text); font-size:13px;">${name}</div>
            <div style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">ID: <strong>${item.id}</strong></div>
          </td>
          <td style="padding:12px 16px; font-size: 11px; line-height: 1.5; vertical-align: top; color: var(--text-muted);">
            <div>Category: ${cat}</div>
            <div>Purity: ${purity}</div>
            <div>Gross Wt: ${weight}</div>
            ${priceBreakdownHtml}
          </td>
          <td style="padding:12px 16px; text-align:center; font-weight: 500; font-size:13px; color: var(--text);">${item.qty || 1}</td>
          <td style="padding:12px 16px; text-align:right; font-weight: 600; color: var(--gold); font-size:13px;">
            ${displayPrice}
          </td>
        </tr>
      `;
    });

    html += `
          </tbody>
        </table>
      </div>
    `;

    if (selection.notes) {
      html += `
        <div style="margin-top: 24px; padding: 16px; background: rgba(176,137,71,0.03); border-left: 2px solid var(--gold); border-radius: 2px;">
          <strong style="font-size: 10px; text-transform: uppercase; color: var(--gold); display: block; margin-bottom: 6px; letter-spacing:0.05em;">Curator Remarks / Notes</strong>
          <span style="font-size: 12px; color: var(--text); font-style: italic; line-height:1.5;">"${selection.notes}"</span>
        </div>
      `;
    }

    body.innerHTML = html;

  } catch (err) {
    body.innerHTML = `
      <div style="text-align: center; padding: 48px; color: var(--error);">
        <i class="fa-solid fa-triangle-exclamation" style="font-size: 24px;"></i>
        <p style="margin-top: 14px; font-size:13px;">${err.message}</p>
      </div>
    `;
  }
};

window.closeWishlistModal = () => {
  const modal = document.getElementById('wishlistDetailsModal');
  if (modal) modal.style.display = 'none';
};

// 9. Excel Bulk Importer Logic
const excelDropZone = document.getElementById('excelDropZone');
const excelFileInput = document.getElementById('excelFileInput');

excelDropZone.addEventListener('click', () => excelFileInput.click());
excelDropZone.addEventListener('dragover', (e) => { e.preventDefault(); excelDropZone.style.borderColor = 'var(--gold)'; });
excelDropZone.addEventListener('dragleave', () => { excelDropZone.style.borderColor = 'var(--line)'; });
excelDropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  excelDropZone.style.borderColor = 'var(--line)';
  if (e.dataTransfer.files.length) handleExcelFile(e.dataTransfer.files[0]);
});
excelFileInput.addEventListener('change', () => {
  if (excelFileInput.files.length) handleExcelFile(excelFileInput.files[0]);
});

function handleExcelFile(file) {
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet);

      if (!rows.length) throw new Error('Excel/CSV sheet is empty.');

      let created = 0;
      let updated = 0;
      let failed = 0;

      for (const row of rows) {
        // Find key in a case-insensitive, space-trimmed way
        const getValueByRegex = (patterns, fallback = '') => {
          for (const pattern of patterns) {
            const key = Object.keys(row).find(k => 
              k.toLowerCase().replace(/\s+/g, '').includes(pattern.toLowerCase().replace(/\s+/g, ''))
            );
            if (key !== undefined) return row[key];
          }
          return fallback;
        };

        const barcodeVal = getValueByRegex(['labelno', 'barcode']);
        if (!barcodeVal) { failed++; continue; }
        const id = String(barcodeVal).trim();

        const productStatus = String(getValueByRegex(['productstatus', 'status'], '')).trim();
        const itemType = String(getValueByRegex(['itemtype', 'category'], 'Ring')).trim();
        const purityVal = String(getValueByRegex(['purity'], '18')).trim();
        const weight = parseFloat(getValueByRegex(['weight'])) || 0;
        const netWt = parseFloat(getValueByRegex(['net_wt', 'netwt'])) || 0;
        const totDiaCts = parseFloat(getValueByRegex(['totdiacts', 'totdia'])) || 0;
        const totStCts = parseFloat(getValueByRegex(['totstcts', 'totst'])) || 0;
        const type = String(getValueByRegex(['type'], 'DIAMOND')).trim();
        const bValue = parseFloat(getValueByRegex(['barcodevalue'])) || 0;
        const bRate = parseFloat(String(getValueByRegex(['barcoderate']) || '0').replace(/,/g, '')) || 0;
        const todayGoldRate = parseFloat(String(getValueByRegex(['todaygoldrate']) || '0').replace(/,/g, '')) || 0;
        const wsg = parseFloat(getValueByRegex(['wsg'])) || 76;

        const diff = parseFloat(getValueByRegex(['diff.'])) || (todayGoldRate - bRate);
        const purityGoldRate = parseFloat(getValueByRegex(['puritygoldrate'])) || (diff * (wsg / 100));
        
        // 95.68 exchange rate factor as derived from the sheet
        const exchangeRate = 95.68;
        const goldAmtDiff = parseFloat(getValueByRegex(['goldamtdiff'])) || ((netWt * purityGoldRate) / exchangeRate);
        
        const newTagValue = parseFloat(getValueByRegex(['newtagvalue'])) || (bValue + goldAmtDiff);
        const dutyPercentage = 15.5; // Duty @ 15.5%
        const dutyValue = parseFloat(getValueByRegex(['duty@', 'dutyvalue'])) || (newTagValue * (dutyPercentage / 100));
        
        const totalTagValue = parseFloat(getValueByRegex(['totaltagvalue'])) || (newTagValue + dutyValue);
        const finalPrice = `$${totalTagValue.toFixed(2)}`;

        const priceDetails = {
          product_status: productStatus,
          item_type: itemType,
          purity: purityVal,
          weight: weight,
          net_wt: netWt,
          tot_dia_cts: totDiaCts,
          tot_st_cts: totStCts,
          type: type,
          barcode_value: bValue,
          barcode_rate: bRate,
          today_gold_rate: todayGoldRate,
          diff: diff,
          purity_gold_rate: purityGoldRate,
          wsg: wsg,
          gold_amt_diff: goldAmtDiff,
          new_tag_value: newTagValue,
          duty_value: dutyValue,
          total_tag_value: totalTagValue
        };

        const descriptionJson = JSON.stringify({
          is_price_details: true,
          details: priceDetails
        });

        let cat = itemType.toLowerCase().trim();
        if (cat.includes('ring') && !cat.includes('ear')) cat = 'ring';
        else if (cat.includes('earring') || cat.includes('ear-ring')) cat = 'earring';
        else if (cat.includes('bracelet')) cat = 'bracelet';
        else if (cat.includes('pendant')) cat = 'pendant';
        else if (cat.includes('necklace')) cat = 'necklace';
        else if (cat.includes('bangle') || cat.includes('bangel')) cat = 'bangle';
        else if (cat.includes('mangalsutra')) cat = 'mangalsutra';

        const payload = {
          id: id,
          name: row.Name || `${itemType} Piece`,
          cat: cat,
          cat_label: itemType,
          purity: purityVal.includes('KT') || purityVal.includes('K') ? purityVal : `${purityVal} KT`,
          gross_weight: `${weight} g`,
          net_gold: `${netWt} g`,
          diamond_weight: `${totDiaCts} ct`,
          stones: type,
          price: finalPrice,
          description: descriptionJson,
          availability: productStatus.toUpperCase() === 'RTS' ? 'ready' : 'mto',
          collections: row.Collections ? row.Collections.split(',').map(s => s.trim()) : [],
          updated_at: new Date().toISOString()
        };

        const { count: exists } = await supabase.from('products').select('*', { count: 'exact', head: true }).eq('id', payload.id);
        const { error } = await supabase.from('products').upsert(payload);
        
        if (error) {
          failed++;
        } else {
          if (exists) updated++;
          else created++;
        }
      }

      alert(`Excel processed:\n- Created: ${created}\n- Updated: ${updated}\n- Failed: ${failed}`);
      writeLog('Bulk Excel Import', file.name, { created, updated, failed });
      
      // Save import audit log
      await supabase.from('upload_history').insert({
        file_name: file.name,
        uploaded_by: currentAdmin.email,
        total_records: rows.length,
        created_count: created,
        updated_count: updated,
        failed_count: failed
      });

      loadProductCatalogue();
    } catch (err) {
      alert('Error parsing Excel: ' + err.message);
    }
  };
  reader.readAsArrayBuffer(file);
}

// 10. Products Catalogue View Logic
async function loadProductCatalogue() {
  const { data: list } = await supabase
    .from('products')
    .select('*')
    .order('created_at', { ascending: false });

  const tbody = document.getElementById('productsTableBody');
  if (list && list.length > 0) {
    tbody.innerHTML = list.map(p => `
      <tr>
        <td><strong>${p.id}</strong></td>
        <td>${p.name}</td>
        <td>${p.cat_label || p.cat}</td>
        <td>${p.purity || 'N/A'}</td>
        <td>${p.gross_weight || 'N/A'}</td>
        <td>$${p.price || 'N/A'}</td>
        <td>
          <button class="btn-submit" style="padding: 6px 12px; font-size:11px; background:var(--error);" onclick="deleteProduct('${p.id}')">Delete</button>
        </td>
      </tr>
    `).join('');
  } else {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--ink-soft);">No products loaded in catalogue.</td></tr>`;
  }
}

window.deleteProduct = async (id) => {
  if (confirm(`Are you sure you want to delete product ${id}?`)) {
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) alert('Failed to delete: ' + error.message);
    else {
      writeLog('Delete Product', id);
      loadProductCatalogue();
    }
  }
};

// 11. Audit Logs Loader
async function loadAuditLogs() {
  const { data: list } = await supabase
    .from('audit_logs')
    .select('*')
    .order('created_at', { ascending: false });

  const tbody = document.getElementById('logsTableBody');
  if (list && list.length > 0) {
    tbody.innerHTML = list.map(l => `
      <tr>
        <td>${new Date(l.created_at).toLocaleTimeString()}</td>
        <td>${l.user_email}</td>
        <td>${l.action}</td>
        <td>${l.target || 'N/A'}</td>
        <td>${l.metadata ? JSON.stringify(l.metadata) : 'None'}</td>
      </tr>
    `).join('');
  }
}

// Logout script trigger
document.getElementById('logoutBtn').addEventListener('click', async () => {
  if (confirm('Logout from Admin session?')) {
    await supabase.auth.signOut();
    localStorage.removeItem('pmj_admin_mode');
    window.location.href = './login.html';
  }
});

// 12. Theme Switching Logic
const themeBtn = document.getElementById('themeToggleBtn');

function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('admin_theme', theme);
  if (theme === 'dark') {
    if (themeBtn) themeBtn.innerHTML = '<i class="fa-solid fa-sun"></i> <span>Light Mode</span>';
  } else {
    if (themeBtn) themeBtn.innerHTML = '<i class="fa-solid fa-moon"></i> <span>Dark Mode</span>';
  }
}

if (themeBtn) {
  // Load saved or default to dark
  const savedTheme = localStorage.getItem('admin_theme') || 'dark';
  setTheme(savedTheme);

  themeBtn.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    setTheme(current === 'dark' ? 'light' : 'dark');
  });
}

// 13. Interactive Pricing Calculator Logic
let calculatorProducts = [];

const calcDropZone = document.getElementById('calcDropZone');
const calcFileInput = document.getElementById('calcFileInput');
const calcTableBody = document.getElementById('calcTableBody');
const calcResultsWrapper = document.getElementById('calcResultsWrapper');

if (calcDropZone && calcFileInput) {
  calcDropZone.addEventListener('click', () => calcFileInput.click());
  calcDropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    calcDropZone.style.borderColor = 'var(--gold)';
  });
  calcDropZone.addEventListener('dragleave', () => {
    calcDropZone.style.borderColor = 'rgba(199, 162, 82, 0.3)';
  });
  calcDropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    calcDropZone.style.borderColor = 'rgba(199, 162, 82, 0.3)';
    if (e.dataTransfer.files.length) handleCalculatorFile(e.dataTransfer.files[0]);
  });
  calcFileInput.addEventListener('change', () => {
    if (calcFileInput.files.length) handleCalculatorFile(calcFileInput.files[0]);
  });
}

function handleCalculatorFile(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet);

      if (!rows.length) {
        alert('The uploaded spreadsheet contains no data rows.');
        return;
      }

      calculatorProducts = rows;
      recalculateTableData();
      calcResultsWrapper.style.display = 'block';
    } catch (err) {
      alert('Error parsing Excel: ' + err.message);
    }
  };
  reader.readAsArrayBuffer(file);
}

function recalculateTableData() {
  if (!calculatorProducts.length) return;

  const todayGoldRate = parseFloat(document.getElementById('calcGoldRate').value) || 14396;
  const exchangeRate = parseFloat(document.getElementById('calcExchangeRate').value) || 95.68;
  const dutyPercentage = parseFloat(document.getElementById('calcDuty').value) || 15.5;

  const getValueByRegex = (row, patterns, fallback = '') => {
    for (const pattern of patterns) {
      const key = Object.keys(row).find(k => 
        k.toLowerCase().replace(/\s+/g, '').includes(pattern.toLowerCase().replace(/\s+/g, ''))
      );
      if (key !== undefined) return row[key];
    }
    return fallback;
  };

  calcTableBody.innerHTML = calculatorProducts.map((row, index) => {
    const sno = getValueByRegex(row, ['sno'], index + 1);
    const barcodeVal = getValueByRegex(row, ['labelno', 'barcode']);
    const id = barcodeVal ? String(barcodeVal).trim() : `ITEM-${index + 1}`;
    
    const itemType = String(getValueByRegex(row, ['itemtype', 'category'], 'Ring')).trim();
    const purityVal = String(getValueByRegex(row, ['purity'], '18')).trim();
    const weight = parseFloat(getValueByRegex(row, ['weight'])) || 0;
    const netWt = parseFloat(getValueByRegex(row, ['net_wt', 'netwt'])) || 0;
    const totDiaCts = parseFloat(getValueByRegex(row, ['totdiacts', 'totdia'])) || 0;
    const totStCts = parseFloat(getValueByRegex(row, ['totstcts', 'totst'])) || 0;
    const type = String(getValueByRegex(row, ['type'], 'DIAMOND')).trim();
    
    const bValue = parseFloat(getValueByRegex(row, ['barcodevalue'])) || 0;
    const bRate = parseFloat(String(getValueByRegex(row, ['barcoderate']) || '0').replace(/,/g, '')) || 0;
    const wsg = parseFloat(getValueByRegex(row, ['wsg'])) || 76;

    const diff = todayGoldRate - bRate;
    const purityGoldRate = diff * (wsg / 100);
    const goldAmtDiff = (netWt * purityGoldRate) / exchangeRate;
    const newTagValue = bValue + goldAmtDiff;
    const dutyValue = newTagValue * (dutyPercentage / 100);
    const totalTagValue = newTagValue + dutyValue;

    // Save calculations back into row object for exporting
    row._computed = {
      id,
      itemType,
      purityVal,
      weight,
      netWt,
      totDiaCts,
      totStCts,
      type,
      bValue,
      bRate,
      wsg,
      diff,
      purityGoldRate,
      goldAmtDiff,
      newTagValue,
      dutyValue,
      totalTagValue
    };

    return `
      <tr style="border-bottom: 1px solid var(--line);">
        <td style="padding: 10px 14px;">${sno}</td>
        <td style="padding: 10px 14px; font-weight: 600; color: var(--gold);">${id}</td>
        <td style="padding: 10px 14px;">${itemType}</td>
        <td style="padding: 10px 14px; text-align: center;">${purityVal}K</td>
        <td style="padding: 10px 14px; text-align: right;">${weight.toFixed(2)}</td>
        <td style="padding: 10px 14px; text-align: right;">${netWt.toFixed(2)}</td>
        <td style="padding: 10px 14px; text-align: right;">${totDiaCts.toFixed(2)}</td>
        <td style="padding: 10px 14px; text-align: right;">$${bValue.toFixed(2)}</td>
        <td style="padding: 10px 14px; text-align: right;">₹${bRate.toLocaleString()}</td>
        <td style="padding: 10px 14px; text-align: right; color: #52b788;">₹${todayGoldRate.toLocaleString()}</td>
        <td style="padding: 10px 14px; text-align: right;">₹${diff.toLocaleString()}</td>
        <td style="padding: 10px 14px; text-align: right;">${wsg}%</td>
        <td style="padding: 10px 14px; text-align: right;">₹${purityGoldRate.toFixed(2)}</td>
        <td style="padding: 10px 14px; text-align: right; color: var(--gold); font-weight: 500;">$${goldAmtDiff.toFixed(2)}</td>
        <td style="padding: 10px 14px; text-align: right;">$${newTagValue.toFixed(2)}</td>
        <td style="padding: 10px 14px; text-align: right;">$${dutyValue.toFixed(2)}</td>
        <td style="padding: 10px 14px; text-align: right; font-weight: 700; color: var(--gold); background: rgba(199,162,82,0.05);">$${totalTagValue.toFixed(2)}</td>
      </tr>
    `;
  }).join('');
}

document.getElementById('btnApplyCalcSettings')?.addEventListener('click', () => {
  recalculateTableData();
  alert('Recalculation completed using the updated parameters!');
});

document.getElementById('btnPushCalcMaster')?.addEventListener('click', async () => {
  if (!calculatorProducts.length) return;

  if (!confirm(`Are you sure you want to push these ${calculatorProducts.length} calculated products to the live database catalog?`)) {
    return;
  }

  let created = 0;
  let updated = 0;
  let failed = 0;

  for (const row of calculatorProducts) {
    if (!row._computed) continue;
    const c = row._computed;

    const priceDetails = {
      product_status: String(row['Product Status'] || '').toUpperCase().trim(),
      item_type: c.itemType,
      purity: c.purityVal,
      weight: c.weight,
      net_wt: c.netWt,
      tot_dia_cts: c.totDiaCts,
      tot_st_cts: c.totStCts,
      type: c.type,
      barcode_value: c.bValue,
      barcode_rate: c.bRate,
      today_gold_rate: parseFloat(document.getElementById('calcGoldRate').value) || 14396,
      diff: c.diff,
      purity_gold_rate: c.purityGoldRate,
      wsg: c.wsg,
      gold_amt_diff: c.goldAmtDiff,
      new_tag_value: c.newTagValue,
      duty_value: c.dutyValue,
      total_tag_value: c.totalTagValue
    };

    let cat = c.itemType.toLowerCase().trim();
    if (cat.includes('ring') && !cat.includes('ear')) cat = 'ring';
    else if (cat.includes('earring') || cat.includes('ear-ring')) cat = 'earring';
    else if (cat.includes('bracelet')) cat = 'bracelet';
    else if (cat.includes('pendant')) cat = 'pendant';
    else if (cat.includes('necklace')) cat = 'necklace';
    else if (cat.includes('bangle') || cat.includes('bangel')) cat = 'bangle';
    else if (cat.includes('mangalsutra')) cat = 'mangalsutra';

    const payload = {
      id: c.id,
      name: row.Name || `${c.itemType} Piece`,
      cat: cat,
      cat_label: c.itemType,
      purity: c.purityVal.includes('KT') || c.purityVal.includes('K') ? c.purityVal : `${c.purityVal} KT`,
      gross_weight: `${c.weight} g`,
      net_gold: `${c.netWt} g`,
      diamond_weight: `${c.totDiaCts} ct`,
      stones: c.type,
      price: `$${c.totalTagValue.toFixed(2)}`,
      description: JSON.stringify({ is_price_details: true, details: priceDetails }),
      availability: String(row['Product Status'] || '').toUpperCase() === 'RTS' ? 'ready' : 'mto',
      collections: row.Collections ? row.Collections.split(',').map(s => s.trim()) : [],
      updated_at: new Date().toISOString()
    };

    const { count: exists } = await supabase.from('products').select('*', { count: 'exact', head: true }).eq('id', payload.id);
    const { error } = await supabase.from('products').upsert(payload);
    
    if (error) {
      failed++;
    } else {
      if (exists) updated++;
      else created++;
    }
  }

  alert(`Database catalog updated successfully:\n- Created: ${created}\n- Updated: ${updated}\n- Failed: ${failed}`);
  writeLog('Pricing Calculator Sync', `${calculatorProducts.length} items`, { created, updated, failed });
});

document.getElementById('btnExportCalcCsv')?.addEventListener('click', () => {
  if (!calculatorProducts.length) return;

  try {
    const exportRows = calculatorProducts.map((row, index) => {
      const c = row._computed || {};
      return {
        'SNO': index + 1,
        'LabelNo': c.id || '',
        'Product Status': row['Product Status'] || 'MTO',
        'Item Type': c.itemType || '',
        'Purity': c.purityVal || '',
        'WEIGHT': c.weight || 0,
        'NET_WT': c.netWt || 0,
        'Tot Dia cts': c.totDiaCts || 0,
        'Tot St cts': c.totStCts || 0,
        'Type': c.type || '',
        'Barcode Value': c.bValue || 0,
        'Barcode Rate': c.bRate || 0,
        'Today Gold Rate': parseFloat(document.getElementById('calcGoldRate').value) || 14396,
        'Diff.': c.diff || 0,
        'Purity Gold Rate': c.purityGoldRate || 0,
        'Wsg': c.wsg || 76,
        'Gold Amt Diff': parseFloat(c.goldAmtDiff || 0).toFixed(2),
        'New Tag Value': parseFloat(c.newTagValue || 0).toFixed(2),
        'Duty @ 15.5%': parseFloat(c.dutyValue || 0).toFixed(2),
        'Total Tag Value': parseFloat(c.totalTagValue || 0).toFixed(2)
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Calculations");
    XLSX.writeFile(workbook, "Calculated_Tag_Prices.xlsx");
  } catch (err) {
    alert("Export failed: " + err.message);
  }
});

// Run immediate authentication checks
authenticateAdmin();
