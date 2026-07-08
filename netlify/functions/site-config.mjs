import { getStore } from '@netlify/blobs';

const STORE_NAME = 'pmj-catalogue';
const CONFIG_KEY = 'live';

function allowedAdminCode(code) {
  const normalized = String(code || '').trim();
  const envCode = process.env.PMJ_ADMIN_CODE;
  if (envCode && normalized === envCode) return true;
  return normalized === 'PMJADMIN26';
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

export default async (req) => {
  const store = getStore(STORE_NAME);

  if (req.method === 'GET') {
    const config = await store.get(CONFIG_KEY, { type: 'json' });
    return jsonResponse({ ok: true, config: config || null });
  }

  if (req.method === 'POST') {
    const adminHeader = req.headers.get('x-pmj-admin') || req.headers.get('X-PMJ-Admin');
    let body;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ ok: false, error: 'Invalid JSON body' }, 400);
    }

    const code = adminHeader || body.adminCode;
    if (!allowedAdminCode(code)) {
      return jsonResponse({ ok: false, error: 'Unauthorized' }, 401);
    }

    if (!body.config || typeof body.config !== 'object') {
      return jsonResponse({ ok: false, error: 'Missing config object' }, 400);
    }

    const payload = {
      ...body.config,
      version: 1,
      updatedAt: new Date().toISOString(),
    };

    await store.setJSON(CONFIG_KEY, payload);
    return jsonResponse({ ok: true, updatedAt: payload.updatedAt });
  }

  return jsonResponse({ ok: false, error: 'Method not allowed' }, 405);
};
