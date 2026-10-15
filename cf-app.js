const api=async(p,o)=>{try{const r=await fetch('/api/'+p,o?{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(o)}:{});let d=null;try{d=await r.json()}catch(e){}return{ok:r.ok,s:r.status,d}}catch(e){return{ok:false,s:0,d:null}}};
async function loadSv(){const r=ADM?await api('admin/services'):await api('public');if(!r.ok)return renderSv();const pub=await api('public');SV=ADM?r.d:r.d.services;if(pub.ok)CF=pub.d.settings;renderSv()}
async function loadBk(){if(!ADM)return;const r=await api('admin/bookings');if(r.ok)BK=r.d}
async function initAdm(){const r=await api('me');ADM=!!(r.d&&r.d.admin);if(ADM){await loadBk();await loadSv()}}
function login(m=''){$('#bx').innerHTML=`<div class="row" style="justify-content:space-between"><b class="lg" style="color:var(--au2);font-size:22px;flex:3">Painel do Eduardo</b><button class="btn o s" onclick="$('#md').classList.remove('on')">Fechar</button></div>${m?`<div class="msg er">${m}</div>`:''}<label>Senha</label><input id="pw" type="password" autocomplete="current-password" onkeydown="if(event.key=='Enter')doLogin()"><button class="btn" onclick="doLogin()">Entrar</button>`}
async function doLogin(){const r=await api('login',{password:$('#pw').value});if(!r.ok)return login('Senha incorreta.');await initAdm();ADM?adm():login('Não foi possível entrar.')}
async function logout(){await api('logout',{});ADM=false;BK=[];await loadSv();$('#md').classList.remove('on')}
function openAdm(){S={};$('#md').classList.add('on');ADM?adm():login()}
const _adm=adm;adm=function(){_adm();if(!NT&&!MV&&T=='agenda'||T!='agenda'&&!NT&&!MV)$('#bx').insertAdjacentHTML('beforeend','<br><button class="btn s o" onclick="logout()">Sair</button>')};
const _draw=draw;
draw=async function(){if(!ADM&&S.step==2&&S.date&&S.bz!==S.date){S.bz=S.date;const r=await api('busy?date='+S.date);if(r.ok)BK=BK.filter(b=>b.date!==S.date).concat(r.d.map(x=>({id:'x'+x.s,date:S.date,start:x.s,end:x.e,status:'agendado'})))}_draw()};
async function conf(){const b=$('#cf');b.disabled=true;b.textContent='Salvando…';const r=await api('book',{name:S.nm,phone:S.ph,notes:S.ob,date:S.date,start:S.t,services:S.sv});
if(!r.ok){S.t=null;S.step=2;S.bz=null;await draw();$('#bx').insertAdjacentHTML('afterbegin',`<div class="msg er">${r.s==409?'Esse horário não está mais disponível. Escolha outro.':'Não foi possível salvar agora. Tente novamente.'}</div>`);return}
await loadBk();S.code=r.d.code;S.step=5;draw()}
async function stt(id,v){await api('admin/status',{id,status:v});await loadBk();adm()}
const svBody=(s,k,v)=>({...s,descr:s.desc||'',sort:s.order||0,[k]:v});
async function us(id,k,v){if(k==='price'&&v<0||k==='dur'&&v<5)return;const s=SV.find(x=>x.id==id);await api('admin/service',svBody(s,k,v));await loadSv()}
async function seed(){for(const [i,d] of DEF.entries())await api('admin/service',{name:d[0],price:d[1],dur:d[2],descr:d[3],active:true,sort:i});await loadSv();adm()}
async function addS(){const n=prompt('Nome do serviço');if(!n)return;await api('admin/service',{name:n,price:0,dur:30,active:true,sort:SV.length});await loadSv();adm()}
async function svc(){const c={open:tm($('#c1').value),close:tm($('#c2').value),lunchS:tm($('#c3').value),lunchE:tm($('#c4').value),step:+$('#c5').value||30,minAdv:+$('#c6').value||0,maxDays:+$('#c7').value||30,days:[...document.querySelectorAll('.dy')].map(x=>x.checked?1:0),closed:$('#c8').value.split(',').map(x=>x.trim()).filter(Boolean)};const r=await api('admin/settings',c);if(!r.ok)return alert('Erro ao salvar');await loadSv();adm()}
const wa0=n=>{try{window.open(wam(n.b,n.o),'_blank')}catch(e){}};
async function mvGo(){const b=BK.find(x=>x.id==MV.id),o={...b},r=await api('admin/move',{id:b.id,date:MV.date,start:MV.t});if(!r.ok)return er('Horário indisponível. Nada foi alterado.');await loadBk();NT=[{b:BK.find(x=>x.id==b.id),o}];MV=null;ntDraw();wa0(NT[0])}
async function doSwap(ia,ib){const A={...BK.find(x=>x.id==ia)},B={...BK.find(x=>x.id==ib)},r=await api('admin/swap',{a:ia,b:ib});if(!r.ok)return er('Troca impossível: um dos atendimentos não cabe ou há conflito. Os horários originais foram mantidos.');await loadBk();NT=[{b:BK.find(x=>x.id==ia),o:A},{b:BK.find(x=>x.id==ib),o:B}];PK=null;ntDraw();wa0(NT[0])}
(async()=>{$('#adm').style.display='';await initAdm();await loadSv();setInterval(()=>{if(ADM&&$('#md').classList.contains('on')&&S.step===undefined&&!MV&&!NT&&!PK&&T=='agenda')loadBk().then(adm)},20000)})();
