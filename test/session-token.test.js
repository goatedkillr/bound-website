import assert from 'node:assert/strict';
import test from 'node:test';

process.env.SESSION_SECRET = 'test-session-secret-not-for-production';

import {
  issueSessionToken, verifySessionToken, parseCookies, requireSameOrigin, SessionError,
} from '../server/auth.js';

test('signs and verifies a session token round trip', () => {
  const token = issueSessionToken({ discordUserId: '123456789012345678', name: 'Test User', avatar: 'abc123' });
  const claims = verifySessionToken(token);
  assert.equal(claims.discordUserId, '123456789012345678');
  assert.equal(claims.name, 'Test User');
  assert.equal(claims.avatar, 'abc123');
});

test('rejects a tampered signature', () => {
  const token = issueSessionToken({ discordUserId: '123456789012345678' });
  const [payload, signature] = token.split('.');
  const flipped = signature.at(-1) === 'a' ? 'b' : 'a';
  assert.equal(verifySessionToken(`${payload}.${signature.slice(0, -1)}${flipped}`), null);
});

test('rejects a tampered payload', () => {
  const token = issueSessionToken({ discordUserId: '123456789012345678' });
  const [, signature] = token.split('.');
  const forgedPayload = Buffer.from(JSON.stringify({ v: 1, sub: '999999999999999999', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url');
  assert.equal(verifySessionToken(`${forgedPayload}.${signature}`), null);
});

test('rejects an expired token', () => {
  const originalNow = Date.now;
  try {
    Date.now = () => originalNow() - 40 * 24 * 60 * 60 * 1000; // 40 days ago, past the 30-day TTL
    const token = issueSessionToken({ discordUserId: '123456789012345678' });
    Date.now = originalNow;
    assert.equal(verifySessionToken(token), null);
  } finally {
    Date.now = originalNow;
  }
});

test('rejects malformed or empty tokens', () => {
  assert.equal(verifySessionToken(''), null);
  assert.equal(verifySessionToken('not-a-token'), null);
  assert.equal(verifySessionToken(null), null);
  assert.equal(verifySessionToken(undefined), null);
});

test('issueSessionToken rejects a non-snowflake discord id', () => {
  assert.throws(() => issueSessionToken({ discordUserId: 'not-a-snowflake' }), SessionError);
});

test('parses cookies from a request header', () => {
  const req = { headers: { cookie: 'bound_session=abc123; bound_signed_in=1; other=%20value' } };
  const cookies = parseCookies(req);
  assert.equal(cookies.bound_session, 'abc123');
  assert.equal(cookies.bound_signed_in, '1');
  assert.equal(cookies.other, ' value');
});

test('parseCookies handles a missing cookie header', () => {
  assert.deepEqual(parseCookies({ headers: {} }), {});
});

test('requireSameOrigin allows a request with no origin/referer', () => {
  assert.doesNotThrow(() => requireSameOrigin({ headers: { host: 'boundbot.com' } }));
});

test('requireSameOrigin allows a matching origin', () => {
  assert.doesNotThrow(() => requireSameOrigin({ headers: { host: 'boundbot.com', origin: 'https://boundbot.com' } }));
});

test('requireSameOrigin rejects a mismatched origin', () => {
  assert.throws(() => requireSameOrigin({ headers: { host: 'boundbot.com', origin: 'https://evil.example' } }), SessionError);
});
