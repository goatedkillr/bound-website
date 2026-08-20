const SUPABASE_URL = process.env.SUPABASE_URL || 'https://hpbqoochibnrxzxeuazb.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function send(res,status,body){
  res.setHeader('Cache-Control','public, max-age=30, s-maxage=60, stale-while-revalidate=120');
  res.setHeader('X-Content-Type-Options','nosniff');
  return res.status(status).json(body);
}

async function rest(path){
  if(!SERVICE_KEY) throw new Error('Leaderboard database connection is not configured.');
  const r=await fetch(`${SUPABASE_URL}/rest/v1/${path}`,{headers:{apikey:SERVICE_KEY,Authorization:`Bearer ${SERVICE_KEY}`}});
  if(!r.ok) throw new Error(`Leaderboard query failed (${r.status}).`);
  return r.json();
}

export default async function handler(req,res){
  if(req.method!=='GET') return send(res,405,{error:'Method not allowed.'});
  try{
    const [xpRows,moneyRows]=await Promise.all([
      rest('ownership_profiles?select=user_id,display_name,username,avatar_url,bdsm_lifetime_xp,bdsm_level&order=bdsm_lifetime_xp.desc&limit=3'),
      rest('user_balances?select=user_id,money&order=money.desc&limit=3'),
    ]);
    const moneyIds=(moneyRows||[]).map(x=>x.user_id).filter(Boolean);
    const people=moneyIds.length?await rest(`ownership_profiles?select=user_id,display_name,username,avatar_url&user_id=in.(${moneyIds.join(',')})`):[];
    const names=new Map((people||[]).map(x=>[String(x.user_id),x]));
    return send(res,200,{
      bdsm:(xpRows||[]).map((x,i)=>({rank:i+1,user_id:String(x.user_id),name:x.display_name||x.username||`User ${String(x.user_id).slice(-4)}`,avatar_url:x.avatar_url||null,value:Number(x.bdsm_lifetime_xp||0),level:Number(x.bdsm_level||1)})),
      money:(moneyRows||[]).map((x,i)=>{const p=names.get(String(x.user_id))||{};return{rank:i+1,user_id:String(x.user_id),name:p.display_name||p.username||`User ${String(x.user_id).slice(-4)}`,avatar_url:p.avatar_url||null,value:Number(x.money||0)}}),
    });
  }catch(error){
    console.error('leaderboards',error);
    return send(res,500,{error:error instanceof Error?error.message:'Could not load leaderboards.'});
  }
}
