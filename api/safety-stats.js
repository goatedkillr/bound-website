// Public, unauthenticated safety trust-signal stats for the homepage safety
// section. Deliberately returns only aggregate counts - no case content, no
// user IDs - so this is safe to expose without a session, same pattern as
// api/reach.js.
import { databaseCount } from '../server/database.js';

function send(res, status, body) {
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=900');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.status(status).json(body);
}

const count = databaseCount;

export default async function handler(req, res) {
  if (req.method !== 'GET') return send(res, 405, { error: 'Method not allowed.' });
  try {
    const [team, reviewed] = await Promise.all([
      count('safety_team', '&active=eq.true'),
      count('safety_cases', '&status=in.(approved,denied,removed)'),
    ]);
    return send(res, 200, {
      team_count: team,
      cases_reviewed: reviewed,
      updated_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Public safety stats failed:', error);
    return send(res, 200, { team_count: null, cases_reviewed: null, updated_at: null });
  }
}
