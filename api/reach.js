const SUPABASE_URL=process.env.SUPABASE_URL||'https://hpbqoochibnrxzxeuazb.supabase.co';
const SERVICE_KEY=process.env.SUPABASE_SERVICE_ROLE_KEY;

function send(res,status,body){
  res.setHeader('Cache-Control','public, s-maxage=300, stale-while-revalidate=900');
  res.setHeader('Content-Type','application/json; charset=utf-8');
  return res.status(status).json(body);
}

async function count(table,query=''){
  if(!SERVICE_KEY) throw new Error('Missing service key');
  const r=await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*${query}`,{
    method:'HEAD',
    headers:{
      apikey:SERVICE_KEY,
      Authorization:`Bearer ${SERVICE_KEY}`,
      Prefer:'count=exact',
      Range:'0-0'
    }
  });
  if(!r.ok) throw new Error(`${table} count failed`);
  const range=r.headers.get('content-range')||'';
  const total=Number(range.split('/')[1]);
  return Number.isFinite(total)?total:0;
}

export default async function handler(req,res){
  if(req.method!=='GET') return send(res,405,{error:'Method not allowed.'});
  try{
    const [users,servers,relationships,factions]=await Promise.all([
      count('bdsm_discord_user_cache'),
      count('bound_guild_activation'),
      count('ownership_relationships','&status=eq.active'),
      count('factions')
    ]);
    return send(res,200,{
      users,
      servers,
      relationships,
      factions,
      updated_at:new Date().toISOString()
    });
  }catch(error){
    console.error('Public reach stats failed:',error);
    return send(res,200,{users:null,servers:null,relationships:null,factions:null,updated_at:null});
  }
}
