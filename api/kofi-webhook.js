const PRIVATE_SUPABASE_URL = process.env.PRIVATE_SUPABASE_URL || 'https://hobmczasripcpemntobi.supabase.co';
const PRIVATE_SERVICE_KEY = process.env.PRIVATE_SUPABASE_SERVICE_ROLE_KEY;
const KOFI_VERIFICATION_TOKEN = process.env.KOFI_VERIFICATION_TOKEN;
const DARK_SIDE_GUILD_ID = '1222024653795496006';

function json(res, status, body) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  return res.status(status).json(body);
}

async function privateRest(path, { method = 'GET', body, prefer = 'return=representation' } = {}) {
  if (!PRIVATE_SERVICE_KEY) throw new Error('PRIVATE_SUPABASE_SERVICE_ROLE_KEY is missing');
  const response = await fetch(`${PRIVATE_SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: PRIVATE_SERVICE_KEY,
      Authorization: `Bearer ${PRIVATE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: prefer,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let data = null;
  if (text) {
    try { data = JSON.parse(text); } catch { data = text; }
  }
  if (!response.ok) throw new Error(`Supabase ${response.status}: ${typeof data === 'string' ? data : JSON.stringify(data)}`);
  return data;
}

function parsePayload(req) {
  const body = req.body ?? {};
  if (typeof body === 'string') {
    const params = new URLSearchParams(body);
    const raw = params.get('data');
    return raw ? JSON.parse(raw) : JSON.parse(body);
  }
  if (typeof body?.data === 'string') return JSON.parse(body.data);
  return body;
}

function clean(value, max = 500) {
  const text = String(value ?? '').trim();
  return text ? text.slice(0, max) : null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'Method not allowed' });
  if (!KOFI_VERIFICATION_TOKEN) return json(res, 503, { ok: false, error: 'Ko-fi is not configured' });

  try {
    const payload = parsePayload(req);
    if (!payload || payload.verification_token !== KOFI_VERIFICATION_TOKEN) {
      return json(res, 401, { ok: false, error: 'Invalid verification token' });
    }

    const messageId = clean(payload.message_id, 200);
    if (!messageId) return json(res, 400, { ok: false, error: 'Missing message_id' });

    const email = clean(payload.email, 320)?.toLowerCase() ?? null;
    const tierName = clean(payload.tier_name, 200);
    const paymentType = clean(payload.type, 100);
    const amount = Number.parseFloat(String(payload.amount ?? ''));

    const links = email
      ? await privateRest(`tds_kofi_user_links?select=discord_user_id&guild_id=eq.${DARK_SIDE_GUILD_ID}&kofi_email=eq.${encodeURIComponent(email)}&active=eq.true&limit=1`)
      : [];
    const discordUserId = links?.[0]?.discord_user_id ?? null;

    const mappings = tierName
      ? await privateRest(`tds_kofi_tier_mappings?select=subscription_tier&guild_id=eq.${DARK_SIDE_GUILD_ID}&kofi_tier_name=eq.${encodeURIComponent(tierName)}&active=eq.true&limit=1`)
      : [];
    const subscriptionTier = mappings?.[0]?.subscription_tier ?? null;

    let paymentStatus = 'received';
    if (payload.is_subscription_payment === true || paymentType === 'Subscription') {
      if (!subscriptionTier) paymentStatus = 'pending_tier';
      else if (!discordUserId) paymentStatus = 'pending_link';
      else paymentStatus = 'ready';
    } else {
      paymentStatus = discordUserId ? 'tip_received' : 'tip_unlinked';
    }

    const row = {
      message_id: messageId,
      guild_id: DARK_SIDE_GUILD_ID,
      discord_user_id: discordUserId,
      kofi_email: email,
      kofi_name: clean(payload.from_name, 200),
      payment_type: paymentType,
      tier_name: tierName,
      subscription_tier: subscriptionTier,
      amount: Number.isFinite(amount) ? amount : null,
      currency: clean(payload.currency, 20),
      is_subscription_payment: Boolean(payload.is_subscription_payment),
      is_first_subscription_payment: Boolean(payload.is_first_subscription_payment),
      transaction_id: clean(payload.kofi_transaction_id ?? payload.transaction_id, 200),
      payment_status: paymentStatus,
      raw_payload: payload,
      received_at: new Date().toISOString(),
    };

    await privateRest('tds_kofi_payments?on_conflict=message_id', {
      method: 'POST',
      prefer: 'resolution=ignore-duplicates,return=minimal',
      body: row,
    });

    return json(res, 200, { ok: true });
  } catch (error) {
    console.error('Ko-fi webhook error', error);
    return json(res, 500, { ok: false, error: 'Webhook processing failed' });
  }
}
