import test from 'node:test';
import assert from 'node:assert/strict';

process.env.KOFI_VERIFICATION_TOKEN = 'test-secret';
process.env.PRIVATE_SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';

const { default: handler } = await import('../api/kofi-webhook.js');

function response() {
  return {
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

test('rejects oversized webhook bodies before parsing them', async () => {
  const res = response();
  await handler({ method: 'POST', body: 'x'.repeat(64_001) }, res);
  assert.equal(res.statusCode, 413);
});

test('does not persist the Ko-fi verification token', async () => {
  const writes = [];
  globalThis.fetch = async (_url, options = {}) => {
    if (options.method === 'POST') writes.push(JSON.parse(options.body));
    return new Response(options.method === 'POST' ? '' : '[]', { status: options.method === 'POST' ? 201 : 200 });
  };

  const res = response();
  await handler({
    method: 'POST',
    body: {
      verification_token: 'test-secret',
      message_id: 'payment-123',
      type: 'Donation',
      amount: '5.00',
      currency: 'GBP',
      from_name: 'Supporter',
    },
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].raw_payload.verification_token, undefined);
  assert.equal(writes[0].raw_payload.message_id, 'payment-123');
});

