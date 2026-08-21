const PRIVATE_SUPABASE_URL = process.env.PRIVATE_SUPABASE_URL || 'https://hobmczasripcpemntobi.supabase.co';
const PRIVATE_SERVICE_KEY = process.env.PRIVATE_SUPABASE_SERVICE_ROLE_KEY;
const KOFI_VERIFICATION_TOKEN = process.env.KOFI_VERIFICATION_TOKEN;
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const DARK_SIDE_GUILD_ID = '1222024653795496006';
const TIER_LABELS = { vip: 'VIP', filthy: 'Filthy Rich', plus: 'Plus' };

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

async function discord(path, { method = 'GET', body } = {}) {
  if (!DISCORD_TOKEN) throw new Error('DISCORD_TOKEN is missing from Vercel');
  const response = await fetch(`https://discord.com/api/v10${path}`, {
    method,
    headers: {
      Authorization: `Bot ${DISCORD_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (response.status === 204) return null;
  const text = await response.text();
  let data = null;
  if (text) {
    try { data = JSON.parse(text); } catch { data = text; }
  }
  if (!response.ok) throw new Error(`Discord ${response.status}: ${typeof data === 'string' ? data : JSON.stringify(data)}`);
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

function bodySize(req) {
  const body = req.body ?? '';
  return Buffer.byteLength(typeof body === 'string' ? body : JSON.stringify(body));
}

// The verification token proves the webhook is genuine, but it must never be
// copied into the payment audit row along with the rest of Ko-fi's payload.
function safeRawPayload(payload) {
  const { verification_token: _verificationToken, ...safePayload } = payload;
  return safePayload;
}

function clean(value, max = 500) {
  const text = String(value ?? '').trim();
  return text ? text.slice(0, max) : null;
}

async function syncSubscription(discordUserId, tier, messageId, payload) {
  const settingsRows = await privateRest(`tds_subscription_settings?select=vip_role_id,filthy_role_id,plus_role_id&guild_id=eq.${DARK_SIDE_GUILD_ID}&limit=1`);
  const settings = settingsRows?.[0];
  if (!settings) throw new Error('Dark Side subscription settings are not configured');

  const roleMap = { vip: settings.vip_role_id, filthy: settings.filthy_role_id, plus: settings.plus_role_id };
  const targetRole = roleMap[tier];
  if (!targetRole) throw new Error(`${TIER_LABELS[tier]} entitlement role is not configured`);

  const member = await discord(`/guilds/${DARK_SIDE_GUILD_ID}/members/${discordUserId}`);
  const currentRows = await privateRest(`tds_subscriptions?select=custom_role_id,extra_role_id,can_share_role&guild_id=eq.${DARK_SIDE_GUILD_ID}&user_id=eq.${discordUserId}&limit=1`);
  const current = currentRows?.[0] ?? {};
  const isVip = tier === 'vip';
  const isPlus = tier === 'plus';
  const customRoleId = isVip ? null : current.custom_role_id ?? null;
  const extraRoleId = isVip ? null : isPlus ? current.extra_role_id ?? null : (current.extra_role_id === current.custom_role_id ? current.extra_role_id ?? null : null);

  await privateRest('tds_subscriptions?on_conflict=guild_id,user_id', {
    method: 'POST',
    prefer: 'resolution=merge-duplicates,return=minimal',
    body: {
      guild_id: DARK_SIDE_GUILD_ID,
      user_id: discordUserId,
      tier,
      custom_role_id: customRoleId,
      extra_role_id: extraRoleId,
      can_share_role: isVip ? false : isPlus ? true : Boolean(current.can_share_role),
      role_setup_enabled: !isVip,
      custom_role_admin_managed: false,
      active: true,
      assigned_by: 'kofi',
      updated_at: new Date().toISOString(),
    },
  });

  for (const [tierKey, roleId] of Object.entries(roleMap)) {
    if (!roleId) continue;
    const hasRole = Array.isArray(member?.roles) && member.roles.includes(roleId);
    if (tierKey === tier && !hasRole) {
      await discord(`/guilds/${DARK_SIDE_GUILD_ID}/members/${discordUserId}/roles/${roleId}`, { method: 'PUT' });
    } else if (tierKey !== tier && hasRole) {
      await discord(`/guilds/${DARK_SIDE_GUILD_ID}/members/${discordUserId}/roles/${roleId}`, { method: 'DELETE' });
    }
  }

  const kofiSettingsRows = await privateRest(`tds_kofi_settings?select=payment_log_channel_id,renewal_days&guild_id=eq.${DARK_SIDE_GUILD_ID}&limit=1`);
  const kofiSettings = kofiSettingsRows?.[0] ?? { payment_log_channel_id: null, renewal_days: 31 };
  const membershipRows = await privateRest(`tds_kofi_memberships?select=paid_until&guild_id=eq.${DARK_SIDE_GUILD_ID}&discord_user_id=eq.${discordUserId}&limit=1`);
  const currentPaidUntil = membershipRows?.[0]?.paid_until ? new Date(membershipRows[0].paid_until) : null;
  const now = new Date();
  const base = currentPaidUntil && currentPaidUntil > now ? currentPaidUntil : now;
  const paidUntil = new Date(base.getTime() + Number(kofiSettings.renewal_days || 31) * 86400000);

  await privateRest('tds_kofi_memberships?on_conflict=guild_id,discord_user_id', {
    method: 'POST',
    prefer: 'resolution=merge-duplicates,return=minimal',
    body: {
      guild_id: DARK_SIDE_GUILD_ID,
      discord_user_id: discordUserId,
      kofi_email: clean(payload.email, 320)?.toLowerCase() ?? null,
      kofi_name: clean(payload.from_name, 200),
      kofi_tier_name: clean(payload.tier_name, 200),
      subscription_tier: tier,
      paid_until: paidUntil.toISOString(),
      active: true,
      last_payment_id: messageId,
      last_payment_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  });

  const dm = await discord('/users/@me/channels', { method: 'POST', body: { recipient_id: discordUserId } });
  const roleGuide = tier === 'vip'
    ? ['VIP does not include custom subscription roles']
    : tier === 'filthy'
      ? ['Open `/subscription-panel`', 'Create or customise your Personal Role', 'Choose the name colour gradient holographic style and role icon', 'If your role is enabled as giveable you can share it with `/subscription-give-role`']
      : ['Open `/subscription-panel`', 'Create or customise your Personal Role first', 'Then create or customise your Giveable Role', 'Both roles support a custom name solid colour gradient holographic style and role icon', 'Use `/subscription-give-role` to give remove or ping your giveable role'];

  await discord(`/channels/${dm.id}/messages`, {
    method: 'POST',
    body: {
      embeds: [{
        color: 0xffd84d,
        title: `Ko-fi ${TIER_LABELS[tier]} Activated`,
        description: [
          `Your **${TIER_LABELS[tier]}** membership in **The Dark Side** is now active`,
          '',
          '**Start here**',
          ...roleGuide,
          '',
          '**More perks**',
          'Set your ping emojis',
          'Set your autoresponder',
          'Claim your subscriber rewards',
          tier === 'vip' ? '' : 'Edit your role grant and removal messages',
          '',
          `Premium is currently active until <t:${Math.floor(paidUntil.getTime() / 1000)}:F>`,
        ].filter(Boolean).join('\n'),
        footer: { text: 'The Dark Side • Ko-fi Membership' },
        timestamp: new Date().toISOString(),
      }],
      allowed_mentions: { parse: [] },
    },
  });

  if (kofiSettings.payment_log_channel_id) {
    const amount = clean(payload.amount, 50) ?? 'Unknown';
    await discord(`/channels/${kofiSettings.payment_log_channel_id}/messages`, {
      method: 'POST',
      body: {
        embeds: [{
          color: 0xffd84d,
          title: 'New TDS Subscription',
          description: [
            `**Tier** ${TIER_LABELS[tier]}`,
            `**Price** ${clean(payload.currency, 20) ?? ''} ${amount}`.trim(),
          ].join('\n'),
          footer: { text: 'The Dark Side • Ko-fi' },
          timestamp: new Date().toISOString(),
        }],
        allowed_mentions: { parse: [] },
      },
    }).catch(() => undefined);
  }

  return paidUntil;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'Method not allowed' });
  if (!KOFI_VERIFICATION_TOKEN) return json(res, 503, { ok: false, error: 'Ko-fi is not configured' });
  if (bodySize(req) > 64_000) return json(res, 413, { ok: false, error: 'Webhook payload is too large' });

  try {
    const payload = parsePayload(req);
    if (!payload || payload.verification_token !== KOFI_VERIFICATION_TOKEN) {
      return json(res, 401, { ok: false, error: 'Invalid verification token' });
    }

    const messageId = clean(payload.message_id, 200);
    if (!messageId) return json(res, 400, { ok: false, error: 'Missing message_id' });

    const existing = await privateRest(`tds_kofi_payments?select=message_id,payment_status&message_id=eq.${encodeURIComponent(messageId)}&limit=1`);
    if (existing?.length) return json(res, 200, { ok: true, duplicate: true });

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
    const isSubscription = payload.is_subscription_payment === true || paymentType === 'Subscription';

    let paymentStatus = isSubscription ? 'received' : (discordUserId ? 'tip_received' : 'tip_unlinked');
    if (isSubscription) {
      if (!subscriptionTier) paymentStatus = 'pending_tier';
      else if (!discordUserId) paymentStatus = 'pending_link';
      else paymentStatus = 'processing';
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
      raw_payload: safeRawPayload(payload),
      received_at: new Date().toISOString(),
    };

    await privateRest('tds_kofi_payments', { method: 'POST', prefer: 'return=minimal', body: row });

    if (isSubscription && discordUserId && subscriptionTier) {
      try {
        await syncSubscription(discordUserId, subscriptionTier, messageId, payload);
        await privateRest(`tds_kofi_payments?message_id=eq.${encodeURIComponent(messageId)}`, {
          method: 'PATCH',
          prefer: 'return=minimal',
          body: { payment_status: 'processed', processed_at: new Date().toISOString() },
        });
      } catch (error) {
        console.error('Ko-fi automatic subscription sync failed', error);
        await privateRest(`tds_kofi_payments?message_id=eq.${encodeURIComponent(messageId)}`, {
          method: 'PATCH',
          prefer: 'return=minimal',
          body: { payment_status: 'ready' },
        }).catch(() => undefined);
      }
    }

    return json(res, 200, { ok: true });
  } catch (error) {
    console.error('Ko-fi webhook error', error);
    return json(res, 500, { ok: false, error: 'Webhook processing failed' });
  }
}

