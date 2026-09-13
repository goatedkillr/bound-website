import { databaseCount } from '../server/database.js';

function send(res,status,body){
  res.setHeader('Cache-Control','public, s-maxage=300, stale-while-revalidate=900');
  res.setHeader('Content-Type','application/json; charset=utf-8');
  return res.status(status).json(body);
}

const count=databaseCount;

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
