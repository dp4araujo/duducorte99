// API da Du Ducorte 99 (Cloudflare Pages Functions + D1). Binding do banco: DB. Segredos: ADMIN_PASSWORD, SESSION_SECRET.
const J=(d,s=200,h={})=>new Response(JSON.stringify(d),{status:s,headers:{'content-type':'application/json','cache-control':'no-store',...h}});
const enc=new TextEncoder(),ST=['agendado','confirmado','andamento','concluido','cancelado','nao'];
const hmac=async(v,k)=>{const key=await crypto.subtle.importKey('raw',enc.encode(k),{name:'HMAC',hash:'SHA-256'},false,['sign']);return btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.sign('HMAC',key,enc.encode(v)))))};
const isAdm=async(req,env)=>{const m=(req.headers.get('cookie')||'').match(/dd_s=(\d+)\.([^;]+)/);return !!(m&&+m[1]>Date.now()&&env.SESSION_SECRET&&m[2]===await hmac(m[1],env.SESSION_SECRET))};
const nowSP=()=>{const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date()).map(x=>[x.type,x.value]));return{d:`${p.year}-${p.month}-${p.day}`,m:+p.hour*60+ +p.minute}};
const addDays=(d,n)=>new Date(new Date(d+'T12:00:00Z').getTime()+n*864e5).toISOString().slice(0,10);
async function cfg(DB){const c=await DB.prepare('SELECT * FROM settings WHERE id=1').first();return{open:c.open_min,close:c.close_min,lunchS:c.lunch_s,lunchE:c.lunch_e,step:c.step_min,minAdv:c.min_adv,maxDays:c.max_days,days:JSON.parse(c.days),closed:JSON.parse(c.closed)}}
const slotOk=(c,d,s,du)=>/^\d{4}-\d{2}-\d{2}$/.test(d)&&Number.isInteger(s)&&c.days[new Date(d+'T12:00:00Z').getUTCDay()]==1&&!c.closed.includes(d)&&s>=c.open&&s+du<=c.close&&!(s<c.lunchE&&s+du>c.lunchS);
const BK="SELECT id,code,name,phone,notes,date,start_min AS start,end_min AS \"end\",dur,items,total,status FROM bookings";
export async function onRequest({request,env}){
 const DB=env.DB,u=new URL(request.url),p=u.pathname.replace(/^\/api\//,''),post=request.method==='POST';
 const body=post?await request.json().catch(()=>({})):{};
 try{
 if(p==='public'){const r=await DB.prepare('SELECT id,name,descr AS "desc",price,dur,active,sort AS "order" FROM services WHERE active=1 ORDER BY sort').all();return J({services:r.results.map(s=>({...s,active:true})),settings:await cfg(DB)})}
 if(p==='busy'){const d=u.searchParams.get('date')||'';const r=await DB.prepare("SELECT start_min s,end_min e FROM bookings WHERE date=? AND status NOT IN('cancelado','nao')").bind(d).all();return J(r.results)}
 if(p==='book'&&post){const c=await cfg(DB),n=nowSP(),{name,phone,notes,date,start,services}=body;
  if(typeof name!=='string'||name.trim().length<3||!/^\d{10,11}$/.test(phone||'')||!Array.isArray(services)||!services.length||services.length>10)return J({error:'dados invalidos'},400);
  const ids=[...new Set(services)],r=await DB.prepare(`SELECT name n,price p,dur d FROM services WHERE active=1 AND id IN (${ids.map(()=>'?').join()})`).bind(...ids).all();
  if(r.results.length!==ids.length)return J({error:'servico invalido'},400);
  const tp=r.results.reduce((a,x)=>a+x.p,0),td=r.results.reduce((a,x)=>a+x.d,0);
  if(!slotOk(c,date,start,td)||date<n.d||date>addDays(n.d,c.maxDays)||(date===n.d&&start<n.m+c.minAdv))return J({error:'horario indisponivel'},409);
  const code='DD'+[...crypto.getRandomValues(new Uint8Array(5))].map(b=>'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b%32]).join('');
  try{await DB.prepare('INSERT INTO bookings(id,code,name,phone,notes,date,start_min,end_min,dur,items,total) VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),code,name.trim(),phone,String(notes||'').slice(0,300),date,start,start+td,td,JSON.stringify(r.results),tp).run()}catch(e){return J({error:'horario ocupado'},409)}
  return J({code})}
 if(p==='login'&&post){const ok=env.ADMIN_PASSWORD&&env.SESSION_SECRET&&await hmac(String(body.password||''),env.SESSION_SECRET)===await hmac(env.ADMIN_PASSWORD,env.SESSION_SECRET);
  if(!ok){await new Promise(r=>setTimeout(r,1000));return J({error:'senha incorreta'},401)}
  const exp=Date.now()+6048e5;return J({ok:1},200,{'set-cookie':`dd_s=${exp}.${await hmac(String(exp),env.SESSION_SECRET)}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=604800`})}
 if(p==='logout')return J({ok:1},200,{'set-cookie':'dd_s=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0'});
 const adm=await isAdm(request,env);
 if(p==='me')return J({admin:adm});
 if(!p.startsWith('admin/'))return J({error:'nao encontrado'},404);
 if(!adm)return J({error:'nao autorizado'},401);
 const c=await cfg(DB);
 if(p==='admin/bookings'){const r=await DB.prepare(BK).all();return J(r.results.map(b=>({...b,items:JSON.parse(b.items)})))}
 if(p==='admin/status'&&post){if(!ST.includes(body.status))return J({error:'status'},400);try{await DB.prepare('UPDATE bookings SET status=? WHERE id=?').bind(body.status,body.id).run()}catch(e){return J({error:'conflito'},409)}return J({ok:1})}
 if(p==='admin/move'&&post){const b=await DB.prepare('SELECT dur FROM bookings WHERE id=?').bind(body.id).first();if(!b||!slotOk(c,body.date,body.start,b.dur))return J({error:'fora do funcionamento'},409);
  try{await DB.prepare('UPDATE bookings SET date=?,start_min=?,end_min=? WHERE id=?').bind(body.date,body.start,body.start+b.dur,body.id).run()}catch(e){return J({error:'conflito'},409)}return J({ok:1})}
 if(p==='admin/swap'&&post){const A=await DB.prepare('SELECT * FROM bookings WHERE id=?').bind(body.a).first(),B=await DB.prepare('SELECT * FROM bookings WHERE id=?').bind(body.b).first();
  if(!A||!B||A.date!==B.date||!slotOk(c,A.date,B.start_min,A.dur)||!slotOk(c,A.date,A.start_min,B.dur))return J({error:'troca impossivel'},409);
  const U='UPDATE bookings SET start_min=?,end_min=? WHERE id=?';
  try{await DB.batch([DB.prepare(U).bind(100000,100000+A.dur,A.id),DB.prepare(U).bind(A.start_min,A.start_min+B.dur,B.id),DB.prepare(U).bind(B.start_min,B.start_min+A.dur,A.id)])}catch(e){return J({error:'conflito'},409)}return J({ok:1})}
 if(p==='admin/service'&&post){const s=body,pr=+s.price,du=+s.dur;if(!(pr>=0)||!(du>=5&&du<=480)||!String(s.name||'').trim())return J({error:'dados invalidos'},400);
  if(s.id)await DB.prepare('UPDATE services SET name=?,descr=?,price=?,dur=?,active=?,sort=? WHERE id=?').bind(s.name,s.descr||'',pr,du,s.active?1:0,s.sort|0,s.id).run();
  else await DB.prepare('INSERT INTO services(id,name,descr,price,dur,active,sort) VALUES(?,?,?,?,?,?,?)').bind(crypto.randomUUID(),s.name,s.descr||'',pr,du,s.active===false?0:1,s.sort|0).run();return J({ok:1})}
 if(p==='admin/services'){const r=await DB.prepare('SELECT id,name,descr AS "desc",price,dur,active,sort AS "order" FROM services ORDER BY sort').all();return J(r.results.map(s=>({...s,active:!!s.active})))}
 if(p==='admin/settings'&&post){const s=body;await DB.prepare('UPDATE settings SET open_min=?,close_min=?,lunch_s=?,lunch_e=?,step_min=?,min_adv=?,max_days=?,days=?,closed=? WHERE id=1').bind(s.open|0,s.close|0,s.lunchS|0,s.lunchE|0,Math.max(5,s.step|0),s.minAdv|0,s.maxDays|0,JSON.stringify((s.days||[]).map(x=>x?1:0)),JSON.stringify((s.closed||[]).filter(x=>/^\d{4}-\d{2}-\d{2}$/.test(x)))).run();return J({ok:1})}
 return J({error:'nao encontrado'},404)
 }catch(e){return J({error:'erro interno'},500)}}
