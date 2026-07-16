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

collectionSelect.addEventListener('change', loadCollectionsCMS);

async function loadCollectionsCMS() {
  const colId = collectionSelect.value;
  const { data: col } = await supabase.from('collections').select('*').eq('id', colId).single();
  
  if (col) {
    document.getElementById('colTitle').value = col.title || '';
    document.getElementById('colSubtitle').value = col.subtitle || '';
    document.getElementById('colKicker').value = col.kicker || '';
    document.getElementById('colStory').value = col.story_text || '';
    document.getElementById('colCrafts').value = col.craftsmanship_text || '';
  } else {
    cmsForm.reset();
  }
}

cmsForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const colId = collectionSelect.value;
  const payload = {
    id: colId,
    title: document.getElementById('colTitle').value,
    subtitle: document.getElementById('colSubtitle').value,
    kicker: document.getElementById('colKicker').value,
    story_text: document.getElementById('colStory').value,
    craftsmanship_text: document.getElementById('colCrafts').value,
    updated_at: new Date().toISOString()
  };

  const { error } = await supabase.from('collections').upsert(payload);
  if (error) {
    alert('Failed to save collection: ' + error.message);
  } else {
    alert('Collection updated successfully!');
    writeLog('Update Collection', colId, payload);
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
  const { data: selection } = await supabase.from('wishlists').select('items').eq('id', id).single();
  if (selection && selection.items) {
    const listNames = selection.items.map(item => `- ${item.id} (${item.qty} pcs)`).join('\n');
    alert(`Curated Items:\n${listNames}`);
  }
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

      if (!rows.length) throw new Error('Excel sheet is empty.');

      let created = 0;
      let updated = 0;
      let failed = 0;

      for (const row of rows) {
        const barcode = row.Barcode || row.LabelNo;
        if (!barcode) { failed++; continue; }

        const payload = {
          id: String(barcode).trim(),
          name: row.Name || 'Jewellery Piece',
          cat: (row.Category || 'earring').toLowerCase().trim(),
          cat_label: row.CategoryLabel || row.Category || 'Earring',
          purity: row.Purity || '18 KT',
          gross_weight: row.GrossWeight || '0 g',
          net_gold: row.NetWeight || '0 g',
          diamond_weight: row.DiamondWeight || '0 ct',
          stones: row.Stones || 'Diamond',
          price: row.Price ? String(row.Price) : 'Price on Request',
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

// Run immediate authentication checks
authenticateAdmin();
