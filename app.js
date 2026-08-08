import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, addDoc, updateDoc, collection, getDocs, query, where, orderBy, serverTimestamp, Timestamp } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "AIzaSyAYCAZEqryNI9wQ6kpnHmCsHK04R5Qk2Lg",
  authDomain: "punch-emelco.firebaseapp.com",
  projectId: "punch-emelco",
  storageBucket: "punch-emelco.firebasestorage.app",
  messagingSenderId: "428594930757",
  appId: "1:428594930757:web:51b317d4d1c046a14eaf2c"
};

// Ce compte devient automatiquement administrateur lors de sa prochaine connexion.
const OWNER_EMAIL = 'benoit2568@hotmail.com';
const APP_VERSION = '3.0.0';



function isOwnerEmail(email) {
  return (email || '').trim().toLowerCase() === OWNER_EMAIL;
}


function toMillisSafe(value) {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (value.seconds) return value.seconds * 1000;
  const d = new Date(value);
  return isNaN(d.getTime()) ? 0 : d.getTime();
}

function sortPunchesNewestFirst(items) {
  return [...items].sort((a, b) => {
    const aTime = toMillisSafe(a.startTime || a.clockIn || a.createdAt || a.date);
    const bTime = toMillisSafe(b.startTime || b.clockIn || b.createdAt || b.date);
    return bTime - aTime;
  });
}



async function ensureOwnerAdminProfile(user, profileRef) {
  if (!user || !isOwnerEmail(user.email) || !profileRef) return;
  try {
    await setDoc(profileRef, {
      email: user.email,
      role: 'admin',
      isOwner: true,
      active: true
    }, { merge: true });
  } catch (err) {
    console.warn('Impossible de synchroniser le rôle propriétaire:', err);
  }
}

const app=initializeApp(firebaseConfig), auth=getAuth(app), db=getFirestore(app);
const $=id=>document.getElementById(id);
let currentUser=null,currentProfile=null,currentOpenSession=null,allSites=[],myRows=[],editingSession=null,editingAsAdmin=false;

const escapeHtml=(s='')=>String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const toDate=t=>t?.toDate?t.toDate():(t?new Date(t):null);
const fmtTime=t=>t?toDate(t).toLocaleTimeString('fr-CA',{hour:'2-digit',minute:'2-digit'}):'—';
const fmtDate=t=>t?toDate(t).toLocaleDateString('fr-CA'):'—';
const fmtDateTime=t=>t?toDate(t).toLocaleString('fr-CA',{dateStyle:'short',timeStyle:'short'}):'—';
const hoursBetween=(a,b)=>{if(!a||!b)return 0;return Math.max(0,(toDate(b)-toDate(a))/36e5)};
const show=(id,on=true)=>$(id).classList.toggle('hidden',!on);
const msg=(id,text)=>$(id).textContent=text||'';
const dtLocal=d=>{if(!d)return'';const x=toDate(d),pad=n=>String(n).padStart(2,'0');return `${x.getFullYear()}-${pad(x.getMonth()+1)}-${pad(x.getDate())}T${pad(x.getHours())}:${pad(x.getMinutes())}`};

async function getPosition(){
  if(!navigator.geolocation) throw new Error('GPS non disponible sur cet appareil.');
  return new Promise((res,rej)=>navigator.geolocation.getCurrentPosition(
    p=>res({lat:p.coords.latitude,lng:p.coords.longitude,accuracy:p.coords.accuracy}),
    ()=>rej(new Error('Position GPS refusée ou indisponible.')),
    {enableHighAccuracy:true,timeout:15000,maximumAge:0}
  ));
}

async function loadProfile(uid){const s=await getDoc(doc(db,'users',uid));return s.exists()?s.data():null}

async function ensureOwnerAdmin(){
  if(!currentUser || currentUser.email?.toLowerCase()!==OWNER_EMAIL) return;
  if(currentProfile?.role==='admin') return;
  try{
    await updateDoc(doc(db,'users',currentUser.uid),{role:'admin',active:true,updatedAt:serverTimestamp()});
    currentProfile={...currentProfile,role:'admin',active:true};
  }catch(e){ console.warn('Promotion admin à faire dans Firestore:',e); }
}

async function loadSites(){
  const snap=await getDocs(collection(db,'sites'));
  const all=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(a.name||'').localeCompare(b.name||''));
  allSites=all.filter(s=>s.active!==false);
  $('siteSelect').innerHTML='<option value="">Choisir un chantier…</option>'+allSites.map(s=>`<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');
  if(currentProfile?.role==='admin') renderSitesAdmin(all);
}

function renderSitesAdmin(sites){
  $('siteList').innerHTML=sites.length?sites.map(s=>`<div class="list-item site-admin"><div><strong>${escapeHtml(s.name)}</strong><br><small>${s.active===false?'Désactivé':'Actif'}</small></div><div class="row-actions"><button class="ghost compact" data-site-rename="${s.id}">Renommer</button><button class="${s.active===false?'success':'danger'} compact" data-site-toggle="${s.id}" data-active="${s.active!==false}">${s.active===false?'Activer':'Désactiver'}</button></div></div>`).join(''):'<p class="muted">Aucun chantier.</p>';
  document.querySelectorAll('[data-site-rename]').forEach(b=>b.onclick=()=>renameSite(b.dataset.siteRename));
  document.querySelectorAll('[data-site-toggle]').forEach(b=>b.onclick=()=>toggleSite(b.dataset.siteToggle,b.dataset.active==='true'));
}

async function addSite(){
  const name=$('newSiteName').value.trim(); if(!name)return;
  try{await addDoc(collection(db,'sites'),{name,active:true,createdAt:serverTimestamp()});$('newSiteName').value='';await loadSites()}catch(e){alert('Impossible d’ajouter le chantier : '+e.message)}
}
async function renameSite(id){const site=(await getDoc(doc(db,'sites',id))).data();const name=prompt('Nouveau nom du chantier :',site?.name||'');if(!name?.trim())return;await updateDoc(doc(db,'sites',id),{name:name.trim(),updatedAt:serverTimestamp()});await loadSites()}
async function toggleSite(id,isActive){await updateDoc(doc(db,'sites',id),{active:!isActive,updatedAt:serverTimestamp()});await loadSites()}

async function findOpenSession(){
  const qy=query(collection(db,'punches'),where('userId','==',currentUser.uid),where('status','==','open'));
  const snap=await getDocs(qy); currentOpenSession=snap.empty?null:{id:snap.docs[0].id,...snap.docs[0].data()}; renderPresence();
}
function renderPresence(){
  const on=!!currentOpenSession;
  $('presenceDot').className='dot '+(on?'on':'off'); $('presenceText').textContent=on?'Présent au travail':'Hors travail';
  $('punchInBtn').disabled=on || currentProfile?.active===false; $('punchOutBtn').disabled=!on || currentProfile?.active===false;
  $('siteSelect').disabled=on || currentProfile?.active===false;
  if(on&&currentOpenSession.siteId)$('siteSelect').value=currentOpenSession.siteId;
}

async function punchIn(){
  try{
    if(currentProfile?.active===false) throw new Error('Ton compte est désactivé.');
    if(currentOpenSession)return; const siteId=$('siteSelect').value;if(!siteId)throw new Error('Choisis un chantier.');
    $('punchInBtn').disabled=true;$('gpsStatus').textContent='Localisation GPS en cours…';const gps=await getPosition();
    const site=allSites.find(s=>s.id===siteId);
    await addDoc(collection(db,'punches'),{userId:currentUser.uid,userName:currentProfile.name||currentUser.email,userEmail:currentUser.email,siteId,siteName:site?.name||'',startAt:serverTimestamp(),endAt:null,status:'open',startGps:gps,endGps:null,createdAt:serverTimestamp()});
    $('gpsStatus').textContent=`Entrée enregistrée. Précision GPS ±${Math.round(gps.accuracy)} m.`;await refreshAll();
  }catch(e){$('gpsStatus').textContent=e.message;$('punchInBtn').disabled=false}
}
async function punchOut(){
  try{
    if(!currentOpenSession)return;$('punchOutBtn').disabled=true;$('gpsStatus').textContent='Localisation GPS en cours…';const gps=await getPosition();
    await updateDoc(doc(db,'punches',currentOpenSession.id),{endAt:serverTimestamp(),status:'closed',endGps:gps,updatedAt:serverTimestamp()});
    $('gpsStatus').textContent=`Sortie enregistrée. Précision GPS ±${Math.round(gps.accuracy)} m.`;await refreshAll();
  }catch(e){$('gpsStatus').textContent=e.message;$('punchOutBtn').disabled=false}
}

async function loadHistory(){
  const snap=await getDocs(query(collection(db,'punches'), where('userId','==',currentUser.uid)));
  myRows=snap.docs.map(d=>({id:d.id,...d.data()}));
  $('historyBody').innerHTML=myRows.length?myRows.map(r=>`<tr><td>${fmtDate(r.startAt)}</td><td>${escapeHtml(r.siteName||'')}</td><td>${fmtTime(r.startAt)}</td><td>${fmtTime(r.endAt)}</td><td>${r.endAt?hoursBetween(r.startAt,r.endAt).toFixed(2)+' h':'En cours'}</td><td>${r.status==='closed'?`<button class="ghost compact" data-request-edit="${r.id}">Correction</button>`:''}</td></tr>`).join(''):'<tr><td colspan="6">Aucun punch.</td></tr>';
  document.querySelectorAll('[data-request-edit]').forEach(b=>b.onclick=()=>openEditModal(b.dataset.requestEdit,false));
  const now=new Date(),startToday=new Date(now.getFullYear(),now.getMonth(),now.getDate()),day=(now.getDay()+6)%7,startWeek=new Date(startToday);startWeek.setDate(startToday.getDate()-day);
  let today=0,week=0;for(const r of myRows){if(!r.startAt)continue;const s=toDate(r.startAt),end=r.endAt||Timestamp.fromDate(now),h=hoursBetween(r.startAt,end);if(s>=startToday)today+=h;if(s>=startWeek)week+=h}
  $('todayHours').textContent=today.toFixed(2)+' h';$('weekHours').textContent=week.toFixed(2)+' h';$('overtimeHours').textContent=Math.max(0,week-40).toFixed(2)+' h';
}

async function loadAdmin(){
  if(currentProfile?.role!=='admin')return;
  const openSnap=await getDocs(query(collection(db,'punches'),where('status','==','open')));
  const present=openSnap.docs.map(d=>({id:d.id,...d.data()}));
  $('presentList').innerHTML=present.length?present.map(r=>`<div class="list-item"><div><strong>${escapeHtml(r.userName||r.userEmail)}</strong><br><small>${escapeHtml(r.siteName||'')} • depuis ${fmtTime(r.startAt)}</small></div><span class="dot on"></span></div>`).join(''):'<p class="muted">Personne n’est punché présentement.</p>';

  const snap=await getDocs(collection(db,'punches'));const rows=snap.docs.map(d=>({id:d.id,...d.data()}));window.__adminRows=rows;
  $('adminTimesBody').innerHTML=rows.length?rows.map(r=>`<tr><td>${escapeHtml(r.userName||r.userEmail)}</td><td>${fmtDate(r.startAt)}</td><td>${escapeHtml(r.siteName||'')}</td><td>${fmtTime(r.startAt)}</td><td>${fmtTime(r.endAt)}</td><td>${r.endAt?hoursBetween(r.startAt,r.endAt).toFixed(2)+' h':'En cours'}</td><td><button class="ghost compact" data-admin-edit="${r.id}">Modifier</button></td></tr>`).join(''):'<tr><td colspan="7">Aucune feuille de temps.</td></tr>';
  document.querySelectorAll('[data-admin-edit]').forEach(b=>b.onclick=()=>openEditModal(b.dataset.adminEdit,true));
  await loadEmployees(); await loadCorrections();
}

async function loadEmployees(){
  const snap=await getDocs(collection(db,'users')); const users=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(a.name||a.email||'').localeCompare(b.name||b.email||''));
  $('employeeList').innerHTML=users.map(u=>`<div class="list-item employee-row"><div><strong>${escapeHtml(u.name||u.email||'Sans nom')}</strong><br><small>${escapeHtml(u.email||'')} • ${u.active===false?'Désactivé':'Actif'}</small></div><div class="row-actions"><select class="mini-select" data-role-user="${u.id}" ${u.email?.toLowerCase()===OWNER_EMAIL?'disabled':''}><option value="employee" ${u.role!=='admin'?'selected':''}>Employé</option><option value="admin" ${u.role==='admin'?'selected':''}>Admin</option></select><button class="${u.active===false?'success':'danger'} compact" data-user-toggle="${u.id}" data-active="${u.active!==false}" ${u.email?.toLowerCase()===OWNER_EMAIL?'disabled':''}>${u.active===false?'Activer':'Désactiver'}</button></div></div>`).join('');
  document.querySelectorAll('[data-role-user]').forEach(s=>s.onchange=()=>setUserRole(s.dataset.roleUser,s.value));
  document.querySelectorAll('[data-user-toggle]').forEach(b=>b.onclick=()=>setUserActive(b.dataset.userToggle,b.dataset.active!=='true'));
}
async function setUserRole(uid,role){try{await updateDoc(doc(db,'users',uid),{role,updatedAt:serverTimestamp()});await loadEmployees()}catch(e){alert('Impossible de changer le rôle : '+e.message)}}
async function setUserActive(uid,active){try{await updateDoc(doc(db,'users',uid),{active,updatedAt:serverTimestamp()});await loadEmployees()}catch(e){alert('Impossible de modifier le compte : '+e.message)}}

function openEditModal(sessionId,asAdmin){
  const rows=asAdmin?(window.__adminRows||[]):myRows; editingSession=rows.find(r=>r.id===sessionId); if(!editingSession)return;
  editingAsAdmin=asAdmin; $('editModalTitle').textContent=asAdmin?'Modifier les heures':'Demander une correction';
  $('editStart').value=dtLocal(editingSession.startAt); $('editEnd').value=dtLocal(editingSession.endAt); $('editReason').value=''; show('reasonWrap',!asAdmin);
  $('saveEditBtn').textContent=asAdmin?'Enregistrer':'Envoyer la demande'; msg('editMsg',''); show('editModal',true);
}
function closeEdit(){show('editModal',false);editingSession=null}
async function saveEdit(){
  try{
    if(!editingSession)return; const start=$('editStart').value,end=$('editEnd').value;
    if(!start)throw new Error('L’heure d’entrée est obligatoire.'); if(end && new Date(end)<=new Date(start))throw new Error('La sortie doit être après l’entrée.');
    if(editingAsAdmin){
      await updateDoc(doc(db,'punches',editingSession.id),{startAt:Timestamp.fromDate(new Date(start)),endAt:end?Timestamp.fromDate(new Date(end)):null,status:end?'closed':'open',updatedAt:serverTimestamp(),editedByAdmin:currentUser.uid});
      closeEdit();await refreshAll();return;
    }
    const reason=$('editReason').value.trim();if(!reason)throw new Error('Inscris la raison de la correction.');
    await addDoc(collection(db,'correctionRequests'),{sessionId:editingSession.id,userId:currentUser.uid,userName:currentProfile.name||currentUser.email,userEmail:currentUser.email,originalStart:editingSession.startAt,originalEnd:editingSession.endAt||null,requestedStart:Timestamp.fromDate(new Date(start)),requestedEnd:end?Timestamp.fromDate(new Date(end)):null,reason,status:'pending',createdAt:serverTimestamp()});
    msg('editMsg','Demande envoyée à l’administrateur.');setTimeout(closeEdit,900);
  }catch(e){msg('editMsg',e.message)}
}

async function loadCorrections(){
  const snap=await getDocs(query(collection(db,'correctionRequests'),where('status','==','pending')));const reqs=snap.docs.map(d=>({id:d.id,...d.data()}));
  $('correctionList').innerHTML=reqs.length?reqs.map(r=>`<div class="list-item correction-row"><div><strong>${escapeHtml(r.userName||r.userEmail)}</strong><br><small>${fmtDateTime(r.originalStart)} → ${fmtDateTime(r.originalEnd)}<br>Demandé : ${fmtDateTime(r.requestedStart)} → ${fmtDateTime(r.requestedEnd)}<br>${escapeHtml(r.reason||'')}</small></div><div class="row-actions"><button class="success compact" data-approve="${r.id}">Approuver</button><button class="danger compact" data-reject="${r.id}">Refuser</button></div></div>`).join(''):'<p class="muted">Aucune demande en attente.</p>';
  document.querySelectorAll('[data-approve]').forEach(b=>b.onclick=()=>reviewCorrection(b.dataset.approve,true));document.querySelectorAll('[data-reject]').forEach(b=>b.onclick=()=>reviewCorrection(b.dataset.reject,false));
}
async function reviewCorrection(id,approve){
  const snap=await getDoc(doc(db,'correctionRequests',id));if(!snap.exists())return;const r=snap.data();
  try{
    if(approve){await updateDoc(doc(db,'punches',r.sessionId),{startAt:r.requestedStart,endAt:r.requestedEnd||null,status:r.requestedEnd?'closed':'open',updatedAt:serverTimestamp(),corrected:true});}
    await updateDoc(doc(db,'correctionRequests',id),{status:approve?'approved':'rejected',reviewedAt:serverTimestamp(),reviewedBy:currentUser.uid});await refreshAll();
  }catch(e){alert('Impossible de traiter la demande : '+e.message)}
}

function exportCsv(){
  const rows=window.__adminRows||[],lines=[['Employé','Courriel','Date','Chantier','Entrée','Sortie','Total heures']];
  for(const r of rows)lines.push([r.userName||'',r.userEmail||'',fmtDate(r.startAt),r.siteName||'',fmtTime(r.startAt),fmtTime(r.endAt),r.endAt?hoursBetween(r.startAt,r.endAt).toFixed(2):'']);
  const csv=lines.map(a=>a.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\n'),blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}),a=document.createElement('a');
  a.href=URL.createObjectURL(blob);a.download='feuilles-de-temps.csv';a.click();URL.revokeObjectURL(a.href);
}
async function refreshAll(){await loadSites();await findOpenSession();await loadHistory();if(currentProfile?.role==='admin')await loadAdmin()}

$('loginBtn').onclick=async()=>{try{msg('authMsg','');await signInWithEmailAndPassword(auth,$('email').value.trim(),$('password').value)}catch(e){msg('authMsg','Connexion impossible. Vérifie le courriel et le mot de passe.')}};
$('showRegisterBtn').onclick=()=>{show('authView',false);show('registerView',true)};$('backLoginBtn').onclick=()=>{show('registerView',false);show('authView',true)};
$('registerBtn').onclick=async()=>{try{msg('regMsg','');const name=$('regName').value.trim();if(!name)throw new Error('Inscris ton nom.');const cred=await createUserWithEmailAndPassword(auth,$('regEmail').value.trim(),$('regPassword').value);await setDoc(doc(db,'users',cred.user.uid),{name,email:cred.user.email,role:'employee',active:true,createdAt:serverTimestamp()})}catch(e){msg('regMsg',e.message)}};
$('logoutBtn').onclick=()=>signOut(auth);$('punchInBtn').onclick=punchIn;$('punchOutBtn').onclick=punchOut;$('refreshBtn').onclick=refreshAll;$('addSiteBtn').onclick=addSite;$('exportCsvBtn').onclick=exportCsv;$('refreshCorrectionsBtn').onclick=loadCorrections;
$('closeEditModal').onclick=closeEdit;$('saveEditBtn').onclick=saveEdit;$('editModal').onclick=e=>{if(e.target===$('editModal'))closeEdit()};

onAuthStateChanged(auth,async user=>{
  currentUser=user;
  if(!user){currentProfile=null;currentOpenSession=null;show('authView',true);show('registerView',false);show('dashboard',false);show('logoutBtn',false);return}
  currentProfile=await loadProfile(user.uid);
  if(!currentProfile){await setDoc(doc(db,'users',user.uid),{name:user.email,email:user.email,role:'employee',active:true,createdAt:serverTimestamp()});currentProfile=await loadProfile(user.uid)}
  await ensureOwnerAdmin();
  $('userLine').textContent=`${currentProfile.name||user.email} • ${currentProfile.role==='admin'?'Administrateur':'Employé'}${currentProfile.active===false?' • Compte désactivé':''}`;
  show('authView',false);show('registerView',false);show('dashboard',true);show('logoutBtn',true);show('adminPanel',currentProfile.role==='admin');await refreshAll();
});

if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js');


// ===== Punch Travail v3.0 chantier =====
function v3el(id){ return document.getElementById(id); }

function v3toMillis(v){
  if (!v) return 0;
  if (typeof v.toMillis === "function") return v.toMillis();
  if (v.seconds) return v.seconds * 1000;
  const d = new Date(v); return isNaN(d.getTime()) ? 0 : d.getTime();
}

function v3distanceM(a,b,c,d){
  const R=6371000, rad=x=>x*Math.PI/180;
  const d1=rad(c-a), d2=rad(d-b);
  const q=Math.sin(d1/2)**2 + Math.cos(rad(a))*Math.cos(rad(c))*Math.sin(d2/2)**2;
  return 2*R*Math.asin(Math.sqrt(q));
}

function v3gps(){
  return new Promise((resolve,reject)=>{
    if(!navigator.geolocation) return reject(new Error("GPS non disponible"));
    navigator.geolocation.getCurrentPosition(
      p=>resolve({lat:p.coords.latitude,lng:p.coords.longitude,accuracy:p.coords.accuracy}),
      e=>reject(new Error(e.message||"Position refusée")),
      {enableHighAccuracy:true,timeout:15000,maximumAge:15000}
    );
  });
}

function v3siteSelect(){
  return v3el("siteSelect") || document.querySelector('select[name="site"]') || document.querySelector("select");
}

async function v3selectedSite(){
  const id=v3siteSelect()?.value;
  if(!id) return null;
  const s=await getDoc(doc(db,"sites",id));
  return s.exists()?{id:s.id,...s.data()}:null;
}

async function v3loadSiteDetails(){
  const s=await v3selectedSite(); if(!s) return;
  if(v3el("projectNumberInput")) v3el("projectNumberInput").value=s.projectNumber||"";
  if(v3el("foremanInput")) v3el("foremanInput").value=s.foreman||"";
  if(v3el("siteAddressInput")) v3el("siteAddressInput").value=s.address||"";
  if(v3el("siteLatInput")) v3el("siteLatInput").value=s.lat??"";
  if(v3el("siteLngInput")) v3el("siteLngInput").value=s.lng??"";
  if(v3el("siteRadiusInput")) v3el("siteRadiusInput").value=s.radiusM||250;
}

async function v3saveSiteDetails(){
  const s=await v3selectedSite(); if(!s) return alert("Choisis un chantier.");
  await setDoc(doc(db,"sites",s.id),{
    projectNumber:(v3el("projectNumberInput")?.value||"").trim(),
    foreman:(v3el("foremanInput")?.value||"").trim(),
    address:(v3el("siteAddressInput")?.value||"").trim(),
    lat:Number(v3el("siteLatInput")?.value)||null,
    lng:Number(v3el("siteLngInput")?.value)||null,
    radiusM:Number(v3el("siteRadiusInput")?.value)||250,
    updatedAt:serverTimestamp()
  },{merge:true});
  alert("Détails du chantier enregistrés.");
}

async function v3checkGeofence(){
  const s=await v3selectedSite();
  if(!s || s.lat==null || s.lng==null || !s.radiusM) return {ok:true,bypass:true,site:s};
  const g=await v3gps();
  const d=v3distanceM(g.lat,g.lng,Number(s.lat),Number(s.lng));
  return {ok:d<=Number(s.radiusM),distance:d,site:s,gps:g};
}

async function v3saveDailyNote(){
  const u=auth.currentUser; if(!u) return;
  const s=await v3selectedSite(); if(!s) return alert("Choisis un chantier.");
  let photoData=null;
  const f=v3el("dailyPhotoInput")?.files?.[0];
  if(f){
    if(f.size>900000) return alert("Photo trop lourde (max 900 Ko).");
    photoData=await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(f);});
  }
  await addDoc(collection(db,"dailyNotes"),{
    userId:u.uid,userEmail:u.email||"",siteId:s.id,siteName:s.name||s.title||"",
    projectNumber:s.projectNumber||"",note:(v3el("dailyNoteInput")?.value||"").trim(),
    photoData,createdAt:serverTimestamp()
  });
  v3el("dailyNoteInput").value="";
  if(v3el("dailyPhotoInput")) v3el("dailyPhotoInput").value="";
  if(v3el("dailyNoteStatus")) v3el("dailyNoteStatus").textContent="Note enregistrée.";
}

function v3hours(p){
  const a=v3toMillis(p.startTime||p.clockIn||p.createdAt), b=v3toMillis(p.endTime||p.clockOut);
  return a&&b&&b>=a?(b-a)/3600000:0;
}

async function v3approvals(){
  const box=v3el("approvalList"); if(!box) return;
  const q=await getDocs(collection(db,"punches"));
  const rows=q.docs.map(d=>({id:d.id,...d.data()})).filter(p=>(p.endTime||p.clockOut)&&p.approved!==true);
  box.innerHTML=rows.length?rows.map(p=>`<div class="approval-item"><strong>${p.userName||p.userEmail||"Employé"}</strong><span>${p.siteName||p.site||"Chantier"} — ${v3hours(p).toFixed(2)} h</span><button data-v3approve="${p.id}" class="btn-primary small">Approuver</button></div>`).join(""):'<p class="muted">Aucune heure en attente.</p>';
  box.querySelectorAll("[data-v3approve]").forEach(b=>b.onclick=async()=>{await updateDoc(doc(db,"punches",b.dataset.v3approve),{approved:true,approvedBy:auth.currentUser?.uid||"",approvedAt:serverTimestamp()});v3approvals();});
}

async function v3reports(){
  const box=v3el("siteReportsList"); if(!box) return;
  const q=await getDocs(collection(db,"punches")), g={};
  q.docs.forEach(d=>{const p=d.data(), n=p.siteName||p.site||"Sans chantier"; if(!g[n])g[n]={h:0,a:0,c:0}; const h=v3hours(p); g[n].h+=h; if(p.approved===true)g[n].a+=h; g[n].c++;});
  const rows=Object.entries(g).sort((a,b)=>b[1].h-a[1].h);
  box.innerHTML=rows.length?rows.map(([n,v])=>`<div class="report-item"><strong>${n}</strong><span>${v.h.toFixed(2)} h totales</span><span>${v.a.toFixed(2)} h approuvées</span><span>${v.c} punch(s)</span></div>`).join(""):'<p class="muted">Aucune donnée.</p>';
}

async function v3exportPayroll(){
  const q=await getDocs(collection(db,"punches"));
  const rows=q.docs.map(d=>d.data()).filter(p=>(p.endTime||p.clockOut)&&p.approved===true);
  const out=[["Employé","Courriel","Chantier","Projet","Entrée","Sortie","Heures"]];
  rows.forEach(p=>{
    const a=new Date(v3toMillis(p.startTime||p.clockIn)), b=new Date(v3toMillis(p.endTime||p.clockOut));
    out.push([p.userName||"",p.userEmail||"",p.siteName||p.site||"",p.projectNumber||"",a.toLocaleString("fr-CA"),b.toLocaleString("fr-CA"),v3hours(p).toFixed(2)]);
  });
  const csv=out.map(r=>r.map(v=>`"${String(v??"").replace(/"/g,'""')}"`).join(",")).join("\n");
  const blob=new Blob([csv],{type:"text/csv;charset=utf-8"}),url=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=url;a.download="punch-travail-paie.csv";a.click();URL.revokeObjectURL(url);
}

document.addEventListener("DOMContentLoaded",()=>{
  v3el("saveSiteDetailsBtn")?.addEventListener("click",v3saveSiteDetails);
  v3el("useCurrentLocationBtn")?.addEventListener("click",async()=>{try{const g=await v3gps();v3el("siteLatInput").value=g.lat.toFixed(7);v3el("siteLngInput").value=g.lng.toFixed(7);}catch(e){alert(e.message);}});
  v3el("saveDailyNoteBtn")?.addEventListener("click",v3saveDailyNote);
  v3el("refreshSiteReportsBtn")?.addEventListener("click",v3reports);
  v3el("exportPayrollBtn")?.addEventListener("click",v3exportPayroll);
  v3siteSelect()?.addEventListener("change",v3loadSiteDetails);

  const sync=()=>{
    const isAdmin=(document.body.innerText||"").includes("Administrateur");
    ["constructionAdmin","approvalAdmin","siteReportsAdmin"].forEach(id=>v3el(id)?.classList.toggle("hidden",!isAdmin));
    if(isAdmin){v3approvals().catch(console.warn);v3reports().catch(console.warn);}
  };
  setTimeout(sync,700); setInterval(sync,5000);
});

// géofence avant punch entrée
document.addEventListener("click",async ev=>{
  const b=ev.target?.closest?.("button"); if(!b) return;
  if(!(b.textContent||"").toLowerCase().includes("punch entrée")) return;
  if(b.dataset.v3ok==="1"){delete b.dataset.v3ok;return;}
  try{
    const r=await v3checkGeofence();
    if(!r.ok){ev.preventDefault();ev.stopImmediatePropagation();return alert(`Tu es à environ ${Math.round(r.distance)} m du chantier. Rayon autorisé : ${r.site.radiusM} m.`);}
    if(!r.bypass){ev.preventDefault();ev.stopImmediatePropagation();b.dataset.v3ok="1";b.click();}
  }catch(e){ev.preventDefault();ev.stopImmediatePropagation();alert("Impossible de valider le GPS : "+e.message);}
},true);
