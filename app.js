
function fmtDateOnly(value){
  const d = toDate(value);
  if(!d) return '—';
  return d.toLocaleDateString('fr-CA',{
    weekday:'short',
    day:'numeric',
    month:'short',
    year:'numeric'
  });
}

import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, addDoc, updateDoc, collection, getDocs, query, where, orderBy, serverTimestamp, Timestamp, deleteDoc } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js';

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
const APP_VERSION = '3.12.0';



function isOwnerEmail(email) {
  return (email || '').trim().toLowerCase() === OWNER_EMAIL;
}


// ===== Gestion des rôles v3.2 =====
const ROLE_EMPLOYEE = 'employee';
const ROLE_FOREMAN = 'foreman';
const ROLE_ADMIN = 'admin';

function normalizeRole(role){
  if(role === ROLE_ADMIN || role === ROLE_FOREMAN || role === ROLE_EMPLOYEE) return role;
  return ROLE_EMPLOYEE;
}

function currentRole(){
  if(isOwnerEmail(auth.currentUser?.email)) return ROLE_ADMIN;
  return normalizeRole(currentProfile?.role);
}

function foremanManagedIds(){
  return Array.isArray(currentProfile?.managedEmployeeIds)
    ? currentProfile.managedEmployeeIds
    : (Array.isArray(foremanAssignment?.employeeIds) ? foremanAssignment.employeeIds : []);
}

function canManageTime(){
  const r = currentRole();
  return r === ROLE_FOREMAN || r === ROLE_ADMIN;
}

function canManageUsers(){
  return currentRole() === ROLE_ADMIN;
}

function canApproveHours(){
  const r = currentRole();
  return r === ROLE_FOREMAN || r === ROLE_ADMIN;
}

function canEditUserRole(targetRole){
  return currentRole() === ROLE_ADMIN;
}

function roleLabel(role){
  if(role === ROLE_ADMIN) return 'Administrateur';
  if(role === ROLE_FOREMAN) return 'Contremaître';
  return 'Employé';
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


// ===== Mode hors connexion v3.11 TEST =====
const OFFLINE_QUEUE_KEY='punchTravail.offlineQueue.v311';
const OFFLINE_PROFILE_PREFIX='punchTravail.profile.';
const OFFLINE_SITES_KEY='punchTravail.sites.v311';
const OFFLINE_SESSION_PREFIX='punchTravail.openSession.';
const OFFLINE_HISTORY_PREFIX='punchTravail.history.';

function offlineUid(){return currentUser?.uid||auth.currentUser?.uid||''}
function localKey(prefix){return prefix+offlineUid()}
function safeJsonParse(raw,fallback){try{return raw?JSON.parse(raw):fallback}catch(e){return fallback}}
function uuidv4(){return globalThis.crypto?.randomUUID?globalThis.crypto.randomUUID():'off-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2)}
function localTs(){return Timestamp.fromDate(new Date())}
function serializeForQueue(v){
 if(v==null)return v;
 if(v?.toDate&&typeof v.toDate==='function')return{__ts:v.toDate().toISOString()};
 if(v instanceof Date)return{__ts:v.toISOString()};
 if(Array.isArray(v))return v.map(serializeForQueue);
 if(typeof v==='object'){const o={};for(const[k,x]of Object.entries(v))o[k]=serializeForQueue(x);return o}
 return v;
}
function restoreFromQueue(v){
 if(v==null)return v;
 if(Array.isArray(v))return v.map(restoreFromQueue);
 if(typeof v==='object'){
  if(v.__ts)return Timestamp.fromDate(new Date(v.__ts));
  const o={};for(const[k,x]of Object.entries(v))o[k]=restoreFromQueue(x);return o;
 }
 return v;
}
function getOfflineQueue(){return safeJsonParse(localStorage.getItem(OFFLINE_QUEUE_KEY),[])}
function setOfflineQueue(q){localStorage.setItem(OFFLINE_QUEUE_KEY,JSON.stringify(q));updateSyncStatus()}
function enqueueOffline(type,sessionId,payload){const q=getOfflineQueue();q.push({id:uuidv4(),type,sessionId,payload:serializeForQueue(payload),userId:offlineUid()});setOfflineQueue(q)}
function cacheProfile(p){if(offlineUid()&&p)localStorage.setItem(localKey(OFFLINE_PROFILE_PREFIX),JSON.stringify(p))}
function cachedProfile(){return safeJsonParse(localStorage.getItem(localKey(OFFLINE_PROFILE_PREFIX)),null)}
function cacheSites(s){localStorage.setItem(OFFLINE_SITES_KEY,JSON.stringify(s||[]))}
function cachedSites(){return safeJsonParse(localStorage.getItem(OFFLINE_SITES_KEY),[])}
function cacheOpenSession(s){if(!offlineUid())return;if(s)localStorage.setItem(localKey(OFFLINE_SESSION_PREFIX),JSON.stringify(serializeForQueue(s)));else localStorage.removeItem(localKey(OFFLINE_SESSION_PREFIX))}
function cachedOpenSession(){return restoreFromQueue(safeJsonParse(localStorage.getItem(localKey(OFFLINE_SESSION_PREFIX)),null))}
function cacheHistory(rows){if(offlineUid())localStorage.setItem(localKey(OFFLINE_HISTORY_PREFIX),JSON.stringify(serializeForQueue(rows||[])))}
function cachedHistory(){return restoreFromQueue(safeJsonParse(localStorage.getItem(localKey(OFFLINE_HISTORY_PREFIX)),[]))}
function isOfflineNow(){return navigator.onLine===false}
function updateSyncStatus(custom=''){
 const el=$('syncStatus');if(!el)return;
 const pending=getOfflineQueue().filter(x=>!offlineUid()||x.userId===offlineUid()).length;
 if(custom){el.textContent=custom;return}
 if(!navigator.onLine){el.className='sync-status offline';el.textContent=`📴 Hors ligne${pending?` • ${pending}`:''}`}
 else if(pending){el.className='sync-status pending';el.textContent=`🟠 ${pending} en attente`}
 else{el.className='sync-status online';el.textContent='● Synchronisé'}
}
async function syncOfflineQueue(){
 if(!navigator.onLine||!currentUser){updateSyncStatus();return}
 let q=getOfflineQueue(),mine=q.filter(x=>x.userId===currentUser.uid);
 if(!mine.length){updateSyncStatus();return}
 updateSyncStatus('🔄 Synchronisation…');
 for(const evt of mine){
  try{
   await setDoc(doc(db,'punches',evt.sessionId),restoreFromQueue(evt.payload),{merge:true});
   q=q.filter(x=>x.id!==evt.id);localStorage.setItem(OFFLINE_QUEUE_KEY,JSON.stringify(q));
  }catch(e){console.warn('Synchronisation différée:',e);updateSyncStatus();return}
 }
 updateSyncStatus();try{await refreshAll()}catch(e){console.warn(e)}
}
window.addEventListener('online',()=>{updateSyncStatus();setTimeout(syncOfflineQueue,300)});
window.addEventListener('offline',updateSyncStatus);
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&navigator.onLine)syncOfflineQueue()});
setInterval(()=>{if(navigator.onLine&&getOfflineQueue().length)syncOfflineQueue()},30000);

const MEAL_MINUTES=30;
let mealTimer=null;

function mealDeductionMinutes(r, endOverride=null){
  if(!r?.mealStartAt)return 0;
  const start=toDate(r.mealStartAt);
  const recordedEnd=r.mealEndAt?toDate(r.mealEndAt):null;
  const effectiveEnd=recordedEnd || (endOverride?toDate(endOverride):new Date());
  if(!start||!effectiveEnd)return 0;
  return Math.max(0,Math.min(MEAL_MINUTES,(effectiveEnd-start)/60000));
}
function paidHoursBetweenSession(r,endOverride=null){
  const end=endOverride || r?.endAt;
  if(!r?.startAt||!end)return 0;
  return Math.max(0,hoursBetween(r.startAt,end)-mealDeductionMinutes(r,end)/60);
}
async function finalizeMealIfNeeded(){
 if(!currentOpenSession?.mealStartAt||currentOpenSession?.mealEndAt)return;
 const start=toDate(currentOpenSession.mealStartAt),elapsed=(Date.now()-start.getTime())/60000;if(elapsed<MEAL_MINUTES)return;
 const end=Timestamp.fromDate(new Date(start.getTime()+MEAL_MINUTES*60000)),patch={mealEndAt:end,mealDurationMinutes:MEAL_MINUTES,updatedAt:localTs()};
 if(isOfflineNow()){enqueueOffline('mealEnd',currentOpenSession.id,patch);currentOpenSession={...currentOpenSession,...patch};cacheOpenSession(currentOpenSession);return}
 await updateDoc(doc(db,'punches',currentOpenSession.id),{mealEndAt:end,mealDurationMinutes:MEAL_MINUTES,updatedAt:serverTimestamp()});currentOpenSession={...currentOpenSession,...patch};cacheOpenSession(currentOpenSession);
}
function renderMealBreak(){
  const wrap=$('mealBreakWrap'),btn=$('mealBreakBtn'),status=$('mealBreakStatus');
  if(!wrap||!btn||!status)return;
  clearInterval(mealTimer);mealTimer=null;
  const on=!!currentOpenSession;
  wrap.classList.toggle('hidden',!on);
  if(!on){status.textContent='';return;}
  const used=!!currentOpenSession.mealStartAt;
  btn.disabled=used || currentProfile?.active===false;
  if(!used){btn.textContent='🍽️ Repas 30 min';status.textContent='';return;}
  const update=async()=>{
    const start=toDate(currentOpenSession.mealStartAt);
    const elapsed=Math.max(0,Date.now()-start.getTime());
    const remaining=Math.max(0,MEAL_MINUTES*60000-elapsed);
    if(remaining<=0){
      clearInterval(mealTimer);mealTimer=null;
      try{await finalizeMealIfNeeded();}catch(e){console.warn(e)}
      btn.textContent='🍽️ Repas utilisé';
      status.textContent='Repas terminé — temps de travail repris automatiquement.';
      return;
    }
    const totalSec=Math.ceil(remaining/1000),m=Math.floor(totalSec/60),s=totalSec%60;
    btn.textContent='🍽️ Repas en cours';
    status.textContent=`Pause repas : ${m}:${String(s).padStart(2,'0')} restante`;
  };
  update();mealTimer=setInterval(update,1000);
}
async function startMealBreak(){
 try{
  if(!currentOpenSession)throw new Error('Tu dois être punché au travail.');
  if(currentOpenSession.mealStartAt)throw new Error('Le repas de 30 minutes a déjà été utilisé pour ce quart.');
  const at=localTs(),patch={mealStartAt:at,mealEndAt:null,mealDurationMinutes:0,mealUsed:true,updatedAt:at};
  if(isOfflineNow()){enqueueOffline('mealStart',currentOpenSession.id,patch);currentOpenSession={...currentOpenSession,...patch};cacheOpenSession(currentOpenSession);renderMealBreak();return}
  await updateDoc(doc(db,'punches',currentOpenSession.id),{mealStartAt:serverTimestamp(),mealEndAt:null,mealDurationMinutes:0,mealUsed:true,updatedAt:serverTimestamp()});await findOpenSession();renderMealBreak();
 }catch(e){alert(e.message)}
}

const show=(id,on=true)=>$(id).classList.toggle('hidden',!on);
const msg=(id,text)=>$(id).textContent=text||'';
const dtLocal=d=>{if(!d)return'';const x=toDate(d),pad=n=>String(n).padStart(2,'0');return `${x.getFullYear()}-${pad(x.getMonth()+1)}-${pad(x.getDate())}T${pad(x.getHours())}:${pad(x.getMinutes())}`};

async function getPosition(){ return Promise.resolve({lat:null,lng:null,accuracy:null,gpsDisabled:true}); }

async function loadProfile(uid){
 if(isOfflineNow())return cachedProfile();
 try{const s=await getDoc(doc(db,'users',uid));const p=s.exists()?s.data():null;if(p)cacheProfile(p);return p}
 catch(e){const p=cachedProfile();if(p)return p;throw e}
}

async function ensureOwnerAdmin(){
  if(!currentUser || currentUser.email?.toLowerCase()!==OWNER_EMAIL) return;
  if(currentProfile?.role==='admin') return;
  try{
    await updateDoc(doc(db,'users',currentUser.uid),{role:'admin',active:true,updatedAt:serverTimestamp()});
    currentProfile={...currentProfile,role:'admin',active:true};
  }catch(e){ console.warn('Promotion admin à faire dans Firestore:',e); }
}

async function loadSites(){
 let all=[];
 if(isOfflineNow())all=cachedSites();
 else{try{const snap=await getDocs(collection(db,'sites'));all=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(a.name||'').localeCompare(b.name||''));cacheSites(all)}catch(e){all=cachedSites();if(!all.length)throw e}}
 allSites=all.filter(s=>s.active!==false);
 $('siteSelect').innerHTML='<option value="">Choisir un chantier…</option>'+allSites.map(s=>`<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');
 if(currentProfile?.role==='admin'&&navigator.onLine){renderSitesAdmin(all);v3populateAdvancedSites(all)}
}
function renderSitesAdmin(sites){
  $('siteList').innerHTML=sites.length?sites.map(s=>`<div class="list-item site-admin"><div><strong>${escapeHtml(s.name)}</strong><br><small>${s.active===false?'Désactivé':'Actif'}</small></div><div class="row-actions"><button class="ghost compact" data-site-rename="${s.id}">Renommer</button><button class="${s.active===false?'success':'danger'} compact" data-site-toggle="${s.id}" data-active="${s.active!==false}">${s.active===false?'Activer':'Désactiver'}</button><button class="delete compact" data-delete-site="${s.id}" data-site-name="${escapeHtml(s.name||'')}">Supprimer</button></div></div>`).join(''):'<p class="muted">Aucun chantier.</p>';
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
 if(isOfflineNow()){currentOpenSession=cachedOpenSession();renderPresence();return}
 try{const qy=query(collection(db,'punches'),where('userId','==',currentUser.uid),where('status','==','open'));const snap=await getDocs(qy);currentOpenSession=snap.empty?null:{id:snap.docs[0].id,...snap.docs[0].data()};cacheOpenSession(currentOpenSession)}
 catch(e){currentOpenSession=cachedOpenSession();if(!currentOpenSession)throw e}
 renderPresence();
}
function renderPresence(){
  const on=!!currentOpenSession;
  $('presenceDot').className='dot '+(on?'on':'off'); $('presenceText').textContent=on?'Présent au travail':'Hors travail';
  $('punchInBtn').disabled=on || currentProfile?.active===false; $('punchOutBtn').disabled=!on || currentProfile?.active===false;
  $('siteSelect').disabled=on || currentProfile?.active===false;
  $('workTypeField').classList.toggle('hidden', !on);
  $('workTypeSelect').disabled=!on || currentProfile?.active===false;
  if(on&&currentOpenSession.siteId)$('siteSelect').value=currentOpenSession.siteId;
  $('workTypeSelect').value=(on&&currentOpenSession.workType)?currentOpenSession.workType:'';
  renderMealBreak();
  show('changeWorkBtn', on && currentProfile?.active!==false);
  applyRoleUI();
}

async function punchIn(){
 try{
  if(currentProfile?.active===false)throw new Error('Ton compte est désactivé.');
  if(currentOpenSession)return;
  const siteId=$('siteSelect').value;if(!siteId)throw new Error('Choisis un chantier.');
  $('punchInBtn').disabled=true;$('gpsStatus').textContent='';
  const gps={lat:null,lng:null,accuracy:null,gpsDisabled:true}
  const site=allSites.find(s=>s.id===siteId),at=localTs();
  if(isOfflineNow()){
   const id=uuidv4(),payload={userId:currentUser.uid,userName:currentProfile.name||currentUser.email,userEmail:currentUser.email,siteId,siteName:site?.name||'',startAt:at,endAt:null,status:'open',startGps:gps,endGps:null,createdAt:at,offlineCreated:true};
   enqueueOffline('punchIn',id,payload);currentOpenSession={id,...payload};cacheOpenSession(currentOpenSession);renderPresence();
   $('gpsStatus').textContent='📴 Entrée enregistrée hors connexion. Synchronisation automatique au retour du réseau.';return;
  }
  await addDoc(collection(db,'punches'),{userId:currentUser.uid,userName:currentProfile.name||currentUser.email,userEmail:currentUser.email,siteId,siteName:site?.name||'',startAt:serverTimestamp(),endAt:null,status:'open',startGps:gps,endGps:null,createdAt:serverTimestamp()});
  $('gpsStatus').textContent='Entrée enregistrée.';await refreshAll();
 }catch(e){$('gpsStatus').textContent=e.message;$('punchInBtn').disabled=false}
}
async function punchOut(){
 try{
  if(!currentOpenSession)return;
  const workType=$('workTypeSelect').value||currentOpenSession.workType||currentOpenSession.task;if(!workType)throw new Error('Choisis sur quoi tu as travaillé avant de faire ton punch sortie.');
  $('punchOutBtn').disabled=true;$('gpsStatus').textContent='';
  const gps={lat:null,lng:null,accuracy:null,gpsDisabled:true}
  const at=localTs(),patch={workType,endAt:at,status:'closed',endGps:gps,updatedAt:at};
  if(currentOpenSession.mealStartAt&&!currentOpenSession.mealEndAt){patch.mealEndAt=at;patch.mealDurationMinutes=Math.min(MEAL_MINUTES,mealDeductionMinutes(currentOpenSession,new Date()))}
  if(Array.isArray(currentOpenSession.workSegments)&&currentOpenSession.workSegments.length){const segs=[...currentOpenSession.workSegments];if(!segs[segs.length-1].endAt)segs[segs.length-1]={...segs[segs.length-1],endAt:at};patch.workSegments=segs}
  if(isOfflineNow()){enqueueOffline('punchOut',currentOpenSession.id,patch);cacheOpenSession(null);currentOpenSession=null;renderPresence();$('gpsStatus').textContent='📴 Sortie enregistrée hors connexion. Synchronisation automatique au retour du réseau.';return}
  await updateDoc(doc(db,'punches',currentOpenSession.id),{...patch,endAt:serverTimestamp(),updatedAt:serverTimestamp(),...(patch.mealEndAt?{mealEndAt:serverTimestamp()}:{})});
  cacheOpenSession(null);$('gpsStatus').textContent='Sortie enregistrée.';await refreshAll();
 }catch(e){$('gpsStatus').textContent=e.message;$('punchOutBtn').disabled=false}
}
async function loadHistory(){
 if(isOfflineNow()){myRows=cachedHistory();const local=cachedOpenSession();if(local&&!myRows.some(r=>r.id===local.id))myRows.unshift(local)}
 else{try{const snap=await getDocs(query(collection(db,'punches'),where('userId','==',currentUser.uid)));myRows=snap.docs.map(d=>({id:d.id,...d.data()}));cacheHistory(myRows)}catch(e){myRows=cachedHistory();if(!myRows.length)throw e}}

  $('historyBody').innerHTML = myRows.length ? myRows.map(r=>{
    const total = r.endAt ? paidHoursBetweenSession(r).toFixed(2)+' h' : 'En cours';
    const meal = r.mealStartAt ? Math.round(mealDeductionMinutes(r,r.endAt||new Date())) : 0;
    return `<div class="history-card">
      <div class="history-card-head">
        <div>
          <strong>${fmtDateOnly(r.startAt)}</strong>
          <div class="muted small">${historySegmentsHtml(r)}</div>
        </div>
        <div class="history-total">${total}</div>
      </div>
      ${meal ? `<div class="history-meal">🍽️ Repas : ${meal} min</div>` : ''}
      <div class="history-actions">
        <button class="secondary compact" data-correct="${r.id}">Correction</button>
      </div>
    </div>`;
  }).join('') : '<p class="muted">Aucun historique.</p>';

  bindHistoryCorrectionButtons();
  document.querySelectorAll('[data-request-edit]').forEach(b=>b.onclick=()=>openEditModal(b.dataset.requestEdit,false));
  const now=new Date(),startToday=new Date(now.getFullYear(),now.getMonth(),now.getDate()),day=now.getDay(),startWeek=new Date(startToday);startWeek.setDate(startToday.getDate()-day);
  let today=0,week=0;for(const r of myRows){if(!r.startAt)continue;const s=toDate(r.startAt),end=r.endAt||Timestamp.fromDate(now),h=paidHoursBetweenSession(r,end);if(s>=startToday)today+=h;if(s>=startWeek)week+=h}
  $('todayHours').textContent=today.toFixed(2)+' h';$('weekHours').textContent=week.toFixed(2)+' h';if($('overtimeHours'))$('overtimeHours').textContent='0 h';
}


let payWeekOffset=0;
function startOfPayWeek(offset=0){
  const now=new Date();
  const d=new Date(now.getFullYear(),now.getMonth(),now.getDate());
  d.setDate(d.getDate()-d.getDay()+(offset*7)); // dimanche
  d.setHours(0,0,0,0);
  return d;
}
function endOfPayWeek(offset=0){const d=startOfPayWeek(offset);d.setDate(d.getDate()+7);return d;}
function shortFrDate(d){return d.toLocaleDateString('fr-CA',{day:'numeric',month:'short'});}
function longFrDay(d){return d.toLocaleDateString('fr-CA',{weekday:'long',day:'numeric',month:'long'});}
function renderGroupedTimesheets(allRows){
  const box=$('adminTimesGrouped'); if(!box)return;
  const start=startOfPayWeek(payWeekOffset), end=endOfPayWeek(payWeekOffset);
  const rows=(allRows||[]).filter(r=>r.startAt && toDate(r.startAt)>=start && toDate(r.startAt)<end)
    .sort((a,b)=>toDate(a.startAt)-toDate(b.startAt));
  if($('payWeekLabel')) $('payWeekLabel').textContent=payWeekOffset===0?'Semaine en cours':payWeekOffset===-1?'Semaine précédente':'Semaine sélectionnée';
  if($('payWeekDates')) $('payWeekDates').textContent=`${shortFrDate(start)} au ${shortFrDate(new Date(end.getTime()-86400000))}`;
  const people=new Map();
  rows.forEach(r=>{const key=r.userId||r.userEmail||r.userName||'inconnu';if(!people.has(key))people.set(key,{name:(r.userName||r.userEmail||'Employé'),email:r.userEmail||'',rows:[]});people.get(key).rows.push(r);});
  if(!people.size){box.innerHTML='<p class="muted empty-week">Aucune heure pour cette semaine.</p>';return;}
  box.innerHTML=[...people.values()].sort((a,b)=>a.name.localeCompare(b.name,'fr')).map(person=>{
    const days=new Map(); let weekTotal=0;
    person.rows.forEach(r=>{const d=toDate(r.startAt), key=`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;if(!days.has(key))days.set(key,{date:d,rows:[]});days.get(key).rows.push(r);if(r.endAt)weekTotal+=paidHoursBetweenSession(r);});
    const dayHtml=[...days.values()].map(day=>{
      let dayTotal=0;
      const entries=day.rows.map(r=>{const h=r.endAt?paidHoursBetweenSession(r):0;dayTotal+=h;const meal=r.mealStartAt?`<span class="meal-chip">Repas -${Math.round(mealDeductionMinutes(r,r.endAt||new Date()))} min</span>`:'';return `<div class="time-entry"><div class="time-entry-main"><strong>${escapeHtml(r.siteName||'Sans chantier')}</strong><span>${escapeHtml(r.workType||'Type non précisé')}</span></div><div class="time-entry-hours"><span>${fmtTime(r.startAt)} → ${r.endAt?fmtTime(r.endAt):'En cours'}</span>${meal}<strong>${r.endAt?h.toFixed(2)+' h':'—'}</strong></div><button class="ghost compact" data-admin-edit="${r.id}">Modifier</button></div>`;}).join('');
      return `<section class="timesheet-day"><div class="timesheet-day-head"><strong>${longFrDay(day.date)}</strong><span>${dayTotal.toFixed(2)} h</span></div>${entries}</section>`;
    }).join('');
    return `<article class="employee-timesheet"><div class="employee-timesheet-head"><div><h3>${escapeHtml(person.name)}</h3>${person.email?`<small>${escapeHtml(person.email)}</small>`:''}</div><div class="week-total"><span>Total semaine</span><strong>${weekTotal.toFixed(2)} h</strong></div></div>${dayHtml}</article>`;
  }).join('');
}
function changePayWeek(delta){payWeekOffset+=delta;renderGroupedTimesheets(window.__adminRows||[]);document.querySelectorAll('[data-admin-edit]').forEach(b=>b.onclick=()=>openEditModal(b.dataset.adminEdit,true));}

async function loadAdmin(){
  if(!canManageTime()) return;

  try{
    const openSnap=await getDocs(query(collection(db,'punches'),where('status','==','open')));
    const present=openSnap.docs.map(d=>({id:d.id,...d.data()})).filter(foremanCanSeeRecord);
    $('presentList').innerHTML=present.length
      ? present.map(r=>`<div class="list-item"><div><strong>${escapeHtml(r.userName||r.userEmail)}</strong><br><small>${escapeHtml(r.siteName||'')} • ${escapeHtml(r.workType||'Type non précisé')} • depuis ${fmtTime(r.startAt)}</small></div><span class="dot on"></span></div>`).join('')
      : '<p class="muted">Personne n’est punché présentement.</p>';
  }catch(e){
    console.warn('Présents maintenant:',e);
  }

  try{
    const snap=await getDocs(collection(db,'punches'));
    const rows=snap.docs.map(d=>({id:d.id,...d.data()})).filter(foremanCanSeeRecord);
    window.__adminRows=rows;
    renderGroupedTimesheets(rows);
    document.querySelectorAll('[data-admin-edit]').forEach(b=>b.onclick=()=>openEditModal(b.dataset.adminEdit,true));
  }catch(e){
    console.warn('Feuilles de temps:',e);
  }

  if(canManageUsers()){
    try{
      await loadEmployees();
      setTimeout(()=>{
        try{enhanceEmployeeDeleteButtons();}catch(e){}
        try{enhanceEmployeeEditButtons();}catch(e){}
      },0);
    }catch(e){
      console.error('Chargement employés:',e);
      if($('employeeList')) $('employeeList').innerHTML='<p class="muted">Erreur de chargement des employés : '+escapeHtml(e.message||String(e))+'</p>';
    }
  }

  try{ await loadCorrections(); }catch(e){ console.warn('Corrections:',e); }
  try{ enhanceSiteDeleteButtons(); }catch(e){}
}

async function loadEmployees(){
  const snap=await getDocs(collection(db,'users')); const users=snap.docs.map(d=>({id:d.id,...d.data()})).filter(u=>u.deleted!==true).sort((a,b)=>(a.name||a.email||'').localeCompare(b.name||b.email||''));
  $('employeeList').innerHTML=users.map(u=>`<div class="list-item employee-row"><div><strong>${escapeHtml(u.name||u.email||'Sans nom')}</strong><br><small>${escapeHtml(u.email||'')} • ${u.active===false?'Désactivé':'Actif'}</small></div><div class="row-actions"><select class="mini-select" data-role-user="${u.id}" ${u.email?.toLowerCase()===OWNER_EMAIL?'disabled':''}><option value="employee" ${normalizeRole(u.role)==='employee'?'selected':''}>Employé</option><option value="foreman" ${normalizeRole(u.role)==='foreman'?'selected':''}>Contremaître</option><option value="admin" ${normalizeRole(u.role)==='admin'?'selected':''}>Admin</option></select><button class="${u.active===false?'success':'danger'} compact" data-user-toggle="${u.id}" data-active="${u.active!==false}" ${u.email?.toLowerCase()===OWNER_EMAIL?'disabled':''}>${u.active===false?'Activer':'Désactiver'}</button><button class="secondary compact edit-employee-btn" data-edit-employee="${u.id}">Modifier</button>${u.email?.toLowerCase()===OWNER_EMAIL?'':`<button class="delete compact" data-delete-employee="${u.id}" data-employee-name="${escapeHtml(u.name||u.email||'Employé')}" data-employee-email="${escapeHtml(u.email||'')}">Supprimer</button>`}</div></div>`).join('');
  document.querySelectorAll('[data-role-user]').forEach(s=>s.onchange=()=>setUserRole(s.dataset.roleUser,s.value));
  document.querySelectorAll('[data-user-toggle]').forEach(b=>b.onclick=()=>setUserActive(b.dataset.userToggle,b.dataset.active!=='true'));
}
async function setUserRole(uid,role){
  if(!canManageUsers()) throw new Error('Seul un administrateur peut modifier les rôles.');try{await updateDoc(doc(db,'users',uid),{role,updatedAt:serverTimestamp()});await loadEmployees()}catch(e){alert('Impossible de changer le rôle : '+e.message)}}
async function setUserActive(uid,active){if(!canManageUsers())return alert('Seul un administrateur peut activer ou désactiver un compte.');try{await updateDoc(doc(db,'users',uid),{active,updatedAt:serverTimestamp()});await loadEmployees()}catch(e){alert('Impossible de modifier le compte : '+e.message)}}

function taskBaseAndOther(value){
  const v=(value||'').trim();
  if(v.startsWith('Autres — ')) return {base:'Autres',other:v.slice(9).trim()};
  const allowed=['Bâtiment / structure','Béton fondation/plancher','Transport','Autres'];
  return allowed.includes(v)?{base:v,other:''}:{base:'Autres',other:v};
}
function selectedTask(prefix){
  let v=$(prefix+'Task')?.value||'Autres';
  const other=$(prefix+'OtherTask')?.value.trim()||'';
  if(v==='Autres'&&other)v='Autres — '+other;
  return v;
}
function populateEditSites(selectId,currentId,currentName){
  const el=$(selectId); if(!el)return;
  const sites=[...allSites];
  if(currentId && !sites.some(x=>x.id===currentId)) sites.unshift({id:currentId,name:currentName||'Chantier actuel'});
  el.innerHTML=sites.map(x=>`<option value="${escapeHtml(x.id)}">${escapeHtml(x.name||'Sans nom')}</option>`).join('');
  if(currentId)el.value=currentId;
}
function setEditTab(tab){
  const split=tab==='split';
  show('editDetailsPanel',!split); show('editSplitPanel',split);
  $('editDetailsTab')?.classList.toggle('active',!split); $('editSplitTab')?.classList.toggle('active',split);
  msg('editMsg',''); if(split) updateSplitPreview();
}
function updateSplitPreview(){
  if(!editingSession)return;
  const a=new Date($('editStart').value),b=new Date($('editEnd').value),x=new Date($('splitAt').value);
  const el=$('splitPreview'); if(!el)return;
  if(!isFinite(a)||!isFinite(b)||!isFinite(x)||x<=a||x>=b){el.innerHTML='<span class="muted small">Choisis une heure située entre l’entrée et la sortie.</span>';return}
  const h1=(x-a)/3600000,h2=(b-x)/3600000;
  el.innerHTML=`<strong>La journée sera divisée en 2 périodes</strong><br><span>${a.toLocaleTimeString('fr-CA',{hour:'2-digit',minute:'2-digit'})} → ${x.toLocaleTimeString('fr-CA',{hour:'2-digit',minute:'2-digit'})} (${h1.toFixed(2)} h)</span><br><span>${x.toLocaleTimeString('fr-CA',{hour:'2-digit',minute:'2-digit'})} → ${b.toLocaleTimeString('fr-CA',{hour:'2-digit',minute:'2-digit'})} (${h2.toFixed(2)} h)</span>`;
}
function openEditModal(sessionId,asAdmin){
  const rows=asAdmin?(window.__adminRows||[]):myRows; editingSession=rows.find(r=>r.id===sessionId); if(!editingSession)return;
  if(asAdmin && isForemanMode() && !foremanCanSeeRecord(editingSession)){editingSession=null;return alert('Cet employé ne fait pas partie de ton équipe.');}
  editingAsAdmin=asAdmin; $('editModalTitle').textContent=asAdmin?'Modifier les heures':'Demander une correction';
  $('editStart').value=dtLocal(editingSession.startAt); $('editEnd').value=dtLocal(editingSession.endAt); $('editReason').value=''; show('reasonWrap',!asAdmin);
  show('editManagerFields',asAdmin); show('editWorkFields',asAdmin); show('deletePunchBtn',asAdmin);
  populateEditSites('editSite',editingSession.siteId||'',editingSession.siteName||'');
  populateEditSites('splitSite',editingSession.siteId||'',editingSession.siteName||'');
  const t=taskBaseAndOther(editingSession.workType||editingSession.task||'Autres');
  $('editTask').value=t.base; $('editOtherTask').value=t.other; show('editOtherTaskWrap',t.base==='Autres');
  $('splitTask').value=t.base; $('splitOtherTask').value=t.other; show('splitOtherTaskWrap',t.base==='Autres');
  if(editingSession.startAt&&editingSession.endAt){
    const a=toDate(editingSession.startAt),b=toDate(editingSession.endAt),mid=new Date((a.getTime()+b.getTime())/2); $('splitAt').value=dtLocal(mid);
  } else $('splitAt').value='';
  $('editSplitTab').disabled=!asAdmin||!editingSession.endAt;
  $('saveEditBtn').textContent=asAdmin?'Enregistrer les modifications':'Envoyer la demande'; msg('editMsg',''); setEditTab('details'); show('editModal',true);
}
function closeEdit(){show('editModal',false);editingSession=null}
async function saveEdit(){
  try{
    if(!editingSession)return; const start=$('editStart').value,end=$('editEnd').value;
    if(!start)throw new Error('L’heure d’entrée est obligatoire.'); if(end && new Date(end)<=new Date(start))throw new Error('La sortie doit être après l’entrée.');
    if(editingAsAdmin){
      const siteId=$('editSite').value,site=allSites.find(x=>x.id===siteId); const task=selectedTask('edit');
      if(!siteId)throw new Error('Choisis un chantier.'); if(!task)throw new Error('Choisis une tâche.');
      await updateDoc(doc(db,'punches',editingSession.id),{startAt:Timestamp.fromDate(new Date(start)),endAt:end?Timestamp.fromDate(new Date(end)):null,status:end?'closed':'open',siteId,siteName:site?.name||$('editSite').selectedOptions[0]?.textContent||editingSession.siteName||'',workType:task,task,workSegments:[],updatedAt:serverTimestamp(),editedByAdmin:currentUser.uid});
      closeEdit();await refreshAll();return;
    }
    const reason=$('editReason').value.trim();if(!reason)throw new Error('Inscris la raison de la correction.');
    await addDoc(collection(db,'correctionRequests'),{sessionId:editingSession.id,userId:currentUser.uid,userName:currentProfile.name||currentUser.email,userEmail:currentUser.email,siteId:editingSession.siteId||'',siteName:editingSession.siteName||'',originalStart:editingSession.startAt,originalEnd:editingSession.endAt||null,requestedStart:Timestamp.fromDate(new Date(start)),requestedEnd:end?Timestamp.fromDate(new Date(end)):null,reason,status:'pending',createdAt:serverTimestamp()});
    msg('editMsg','Demande envoyée à l’administrateur.');setTimeout(closeEdit,900);
  }catch(e){msg('editMsg',e.message)}
}
async function splitEditingPunch(){
  try{
    if(!editingSession||!editingAsAdmin||!editingSession.endAt)throw new Error('Ce punch ne peut pas être fractionné.');
    if(isForemanMode()&&!foremanCanSeeRecord(editingSession))throw new Error('Cette personne ne fait pas partie de tes employés supervisés.');
    const start=new Date($('editStart').value),end=new Date($('editEnd').value),split=new Date($('splitAt').value);
    if(!isFinite(start)||!isFinite(end)||!isFinite(split))throw new Error('Vérifie les heures.');
    if(split<=start||split>=end)throw new Error('Le fractionnement doit être entre l’entrée et la sortie.');
    const site2Id=$('splitSite').value,site2=allSites.find(x=>x.id===site2Id),task2=selectedTask('split');
    if(!site2Id)throw new Error('Choisis le chantier de la 2e période.');
    if(!confirm(`Fractionner ce punch à ${split.toLocaleTimeString('fr-CA',{hour:'2-digit',minute:'2-digit'})} ?`))return;
    $('confirmSplitBtn').disabled=true; $('confirmSplitBtn').textContent='Fractionnement…';

    // Le repas est conservé dans une seule période seulement.
    const mealStart=editingSession.mealStartAt?toDate(editingSession.mealStartAt):null;
    const mealEnd=editingSession.mealEndAt?toDate(editingSession.mealEndAt):null;
    const mealInSecond=mealStart && mealStart>=split;
    const clearMeal={mealStartAt:null,mealEndAt:null,mealDurationMinutes:0,mealUsed:false};
    const firstMeal=mealInSecond?clearMeal:{};
    const secondMeal=mealInSecond?{
      mealStartAt:editingSession.mealStartAt||null,mealEndAt:editingSession.mealEndAt||null,
      mealDurationMinutes:editingSession.mealDurationMinutes||0,mealUsed:editingSession.mealUsed===true
    }:clearMeal;

    await updateDoc(doc(db,'punches',editingSession.id),{
      startAt:Timestamp.fromDate(start),endAt:Timestamp.fromDate(split),status:'closed',workSegments:[],...firstMeal,updatedAt:serverTimestamp(),editedByAdmin:currentUser.uid,splitGroupId:editingSession.splitGroupId||editingSession.id
    });
    await addDoc(collection(db,'punches'),{
      userId:editingSession.userId,userName:editingSession.userName||'',userEmail:editingSession.userEmail||'',
      siteId:site2Id,siteName:site2?.name||$('splitSite').selectedOptions[0]?.textContent||'',workType:task2,task:task2,
      startAt:Timestamp.fromDate(split),endAt:Timestamp.fromDate(end),status:'closed',startGps:null,endGps:null,workSegments:[],...secondMeal,
      createdAt:serverTimestamp(),updatedAt:serverTimestamp(),editedByAdmin:currentUser.uid,splitFrom:editingSession.id,splitGroupId:editingSession.splitGroupId||editingSession.id
    });
    closeEdit(); await refreshAll();
  }catch(e){msg('editMsg',e.message)}
  finally{if($('confirmSplitBtn')){$('confirmSplitBtn').disabled=false;$('confirmSplitBtn').textContent='Fractionner la journée'}}
}

async function deleteEditingPunch(){
  try{
    if(!editingSession || !editingAsAdmin) return;

    if(isForemanMode() && !foremanCanSeeRecord(editingSession)){
      throw new Error('Cette personne ne fait pas partie de tes employés supervisés.');
    }

    const employeeName=editingSession.userName||editingSession.userEmail||'cet employé';
    const dateText=fmtDateTime(editingSession.startAt);

    if(!confirm(`Supprimer complètement ce punch de ${employeeName} (${dateText}) ?`)) return;
    if(!confirm('Cette suppression enlèvera les heures du total de la semaine. Confirmer la suppression ?')) return;

    $('deletePunchBtn').disabled=true;
    $('deletePunchBtn').textContent='Suppression…';

    await deleteDoc(doc(db,'punches',editingSession.id));

    closeEdit();
    await refreshAll();
  }catch(e){
    msg('editMsg','Impossible de supprimer : '+e.message);
  }finally{
    if($('deletePunchBtn')){
      $('deletePunchBtn').disabled=false;
      $('deletePunchBtn').textContent='Supprimer ce punch';
    }
  }
}

async function loadCorrections(){
  const snap=await getDocs(query(collection(db,'correctionRequests'),where('status','==','pending')));
  let reqs=snap.docs.map(d=>({id:d.id,...d.data()}));

  if(isForemanMode()){
    const visible=[];
    for(const r of reqs){
      if(!foremanCanSeeCorrection(r)) continue;
      visible.push(r);
    }
    reqs=visible;
  }

  $('correctionList').innerHTML=reqs.length?reqs.map(r=>`<div class="list-item correction-row"><div><strong>${escapeHtml(r.userName||r.userEmail)}</strong><br><small>${fmtDateTime(r.originalStart)} → ${fmtDateTime(r.originalEnd)}<br>Demandé : ${fmtDateTime(r.requestedStart)} → ${fmtDateTime(r.requestedEnd)}<br>${escapeHtml(r.reason||'')}</small></div><div class="row-actions"><button class="success compact" data-approve="${r.id}">Approuver</button><button class="danger compact" data-reject="${r.id}">Refuser</button></div></div>`).join(''):'<p class="muted">Aucune demande en attente pour ton équipe.</p>';

  document.querySelectorAll('[data-approve]').forEach(b=>b.onclick=()=>reviewCorrection(b.dataset.approve,true));
  document.querySelectorAll('[data-reject]').forEach(b=>b.onclick=()=>reviewCorrection(b.dataset.reject,false));
}
async function reviewCorrection(id,approve){
  const snap=await getDoc(doc(db,'correctionRequests',id));if(!snap.exists())return;const r=snap.data();
  if(isForemanMode()){
    if(!foremanCanSeeCorrection(r)) return alert('Cette demande ne fait pas partie de ton équipe.');
    if(r.sessionId){
      const punchSnap=await getDoc(doc(db,'punches',r.sessionId));
      if(!punchSnap.exists() || !foremanCanSeeRecord({id:punchSnap.id,...punchSnap.data()})) return alert('Cette demande ne fait pas partie des personnes que tu supervises.');
    }
  }
  try{
    if(approve){await updateDoc(doc(db,'punches',r.sessionId),{startAt:r.requestedStart,endAt:r.requestedEnd||null,status:r.requestedEnd?'closed':'open',updatedAt:serverTimestamp(),corrected:true});}
    await updateDoc(doc(db,'correctionRequests',id),{status:approve?'approved':'rejected',reviewedAt:serverTimestamp(),reviewedBy:currentUser.uid});await refreshAll();
  }catch(e){alert('Impossible de traiter la demande : '+e.message)}
}

function exportCsv(){
  const rows=window.__adminRows||[],lines=[['Employé','Courriel','Date','Chantier','Type de travail','Entrée','Sortie','Total heures']];
  for(const r of rows)lines.push([r.userName||'',r.userEmail||'',fmtDate(r.startAt),r.siteName||'',r.workType||'',fmtTime(r.startAt),fmtTime(r.endAt),r.endAt?paidHoursBetweenSession(r).toFixed(2):'']);
  const csv=lines.map(a=>a.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\n'),blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}),a=document.createElement('a');
  a.href=URL.createObjectURL(blob);a.download='feuilles-de-temps.csv';a.click();URL.revokeObjectURL(a.href);
}
async function refreshAll(){await loadSites();await findOpenSession();await loadHistory();if(canManageTime()&&navigator.onLine)await loadAdmin();updateSyncStatus()}

$('loginBtn').onclick=async()=>{
  const btn=$('loginBtn');
  try{
    msg('authMsg','Connexion...');
    if(btn) btn.disabled=true;
    await signInWithEmailAndPassword(
      auth,
      $('email').value.trim(),
      $('password').value
    );
  }catch(e){
    console.error('Connexion Firebase:',e);
    msg('authMsg','Connexion impossible : '+(e.code||e.message||'erreur inconnue'));
  }finally{
    if(btn) btn.disabled=false;
  }
};
$('showRegisterBtn').onclick=()=>{show('authView',false);show('registerView',true)};$('backLoginBtn').onclick=()=>{show('registerView',false);show('authView',true)};
$('registerBtn').onclick=async()=>{try{msg('regMsg','');const name=$('regName').value.trim();if(!name)throw new Error('Inscris ton nom.');const cred=await createUserWithEmailAndPassword(auth,$('regEmail').value.trim(),$('regPassword').value);await setDoc(doc(db,'users',cred.user.uid),{name,email:cred.user.email,role:'employee',active:true,createdAt:serverTimestamp()})}catch(e){msg('regMsg',e.message)}};

if($('payWeekPrev'))$('payWeekPrev').onclick=()=>changePayWeek(-1);
if($('payWeekNext'))$('payWeekNext').onclick=()=>changePayWeek(1);
$('logoutBtn').onclick=()=>signOut(auth);$('punchInBtn').onclick=punchIn;$('punchOutBtn').onclick=punchOut;if($('mealBreakBtn'))$('mealBreakBtn').onclick=startMealBreak;$('refreshBtn').onclick=refreshAll;$('addSiteBtn').onclick=addSite;$('exportCsvBtn').onclick=exportCsv;$('refreshCorrectionsBtn').onclick=loadCorrections;
$('closeEditModal').onclick=closeEdit;$('saveEditBtn').onclick=saveEdit;
$('editDetailsTab').onclick=()=>setEditTab('details');$('editSplitTab').onclick=()=>setEditTab('split');
$('editTask').onchange=()=>show('editOtherTaskWrap',$('editTask').value==='Autres');$('splitTask').onchange=()=>show('splitOtherTaskWrap',$('splitTask').value==='Autres');
$('splitAt').oninput=updateSplitPreview;$('confirmSplitBtn').onclick=splitEditingPunch;
$('deletePunchBtn').onclick=deleteEditingPunch;$('editModal').onclick=e=>{if(e.target===$('editModal'))closeEdit()};

onAuthStateChanged(auth,async user=>{
  currentUser=user;

  if(!user){
    currentProfile=null;
    currentOpenSession=null;
    show('authView',true);
    show('registerView',false);
    show('dashboard',false);
    show('logoutBtn',false);
    show('menuToggleBtn',false);
    show('dailyNoteSection',false);
    closeRoleDrawer();
    return;
  }

  try{
    currentProfile=await loadProfile(user.uid);if(currentProfile)cacheProfile(currentProfile);

    if(!currentProfile){
      await setDoc(doc(db,'users',user.uid),{
        name:user.email,
        email:user.email,
        role:'employee',
        active:true,
        createdAt:serverTimestamp()
      });
      currentProfile=await loadProfile(user.uid);
    }

    // Le propriétaire est toujours admin dans l'interface,
    // même si la synchronisation du rôle Firestore est refusée.
    await ensureOwnerAdmin();

    $('userLine').textContent =
      `${currentProfile.name||user.email} • ${roleLabel(currentRole())}` +
      `${currentProfile.active===false?' • Compte désactivé':''}`;

    show('authView',false);
    show('registerView',false);
    show('dashboard',true);
    show('logoutBtn',true);
    show('menuToggleBtn',true);
    show('dailyNoteSection',true);
    show('adminPanel',false);

    prepareRoleViews();
    setupRoleMenu();
    refreshRoleMenu();

    // Ces fonctions ne doivent jamais bloquer la connexion.
    try{ await loadForemanAssignment(); }catch(e){ console.warn('Équipe contremaître:',e); }
    try{ await switchRoleTab('employee'); }catch(e){ console.warn('Onglet employé:',e); }
    try{ await refreshAll(); if(navigator.onLine)setTimeout(syncOfflineQueue,500); }catch(e){
      console.error('Chargement des données:',e);
      const punchMsg=$('punchMsg');
      if(punchMsg) punchMsg.textContent='Connexion réussie, mais certaines données n’ont pas pu être chargées.';
    }
  }catch(e){
    console.error('Erreur après connexion:',e);

    // L'utilisateur est authentifié : on affiche le tableau de bord au lieu
    // de le laisser coincé sur l'écran Connexion.
    show('authView',false);
    show('registerView',false);
    show('dashboard',true);
    show('logoutBtn',true);
    show('menuToggleBtn',true);
    show('dailyNoteSection',true);

    const punchMsg=$('punchMsg');
    if(punchMsg) punchMsg.textContent='Connecté. Erreur de chargement : '+(e.message||e);
  }
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

function v3gps(){ return Promise.resolve({lat:null,lng:null,accuracy:null,gpsDisabled:true}); }

function v3siteSelect(){
  return v3el("siteSelect") || document.querySelector('select[name="site"]') || document.querySelector("select");
}

function v3advancedSiteSelect(){
  return v3el("advancedSiteSelect");
}

function v3populateAdvancedSites(sites=allSites){
  const sel=v3advancedSiteSelect();
  if(!sel) return;
  const previous=sel.value;
  sel.innerHTML='<option value="">Choisir un chantier…</option>'+sites.map(s=>`<option value="${s.id}">${escapeHtml(s.name||"Sans nom")}${s.active===false?' (désactivé)':''}</option>`).join('');
  if(previous && sites.some(s=>s.id===previous)) sel.value=previous;
}

async function v3selectedSite(){
  const id=(currentProfile?.role==='admin' && v3advancedSiteSelect()?.value) || v3siteSelect()?.value;
  if(!id) return null;
  if(isOfflineNow())return allSites.find(s=>s.id===id)||cachedSites().find(s=>s.id===id)||null;
  const s=await getDoc(doc(db,"sites",id));return s.exists()?{id:s.id,...s.data()}:null;
}

async function v3loadSiteDetails(){
  const s=await v3selectedSite();
  if(v3el("advancedSiteTitle")) v3el("advancedSiteTitle").textContent=s?`Gestion avancée — ${s.name||"Chantier"}`:"Gestion chantier avancée";
  if(!s){
    ["projectNumberInput","foremanInput","siteAddressInput","siteLatInput","siteLngInput"].forEach(id=>{if(v3el(id))v3el(id).value=""});
    if(v3el("siteRadiusInput")) v3el("siteRadiusInput").value=250;
    return;
  }
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

async function v3checkGeofence(){return {ok:true,bypass:true,site:null};}

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
  const end=v3endValue(p);
  return end?paidHoursBetweenSession(p,end):0;
}

function v3isClosedPunch(p){
  return !!(p.endAt||p.endTime||p.clockOut) || p.status==='closed';
}

function v3startValue(p){ return p.startAt||p.startTime||p.clockIn||p.createdAt; }
function v3endValue(p){ return p.endAt||p.endTime||p.clockOut; }

async function v3approvals(){
  const box=v3el("approvalList"); if(!box) return;
  const [q,userMap]=await Promise.all([getDocs(collection(db,"punches")),currentUserDirectory()]);
  const rows=q.docs.map(d=>({id:d.id,...d.data()})).filter(p=>v3isClosedPunch(p)&&p.approved!==true).filter(foremanCanSeeRecord).sort((a,b)=>v3toMillis(v3startValue(a))-v3toMillis(v3startValue(b)));
  const groups=new Map();
  rows.forEach(p=>{const key=p.userId||p.userEmail||p.userName||'x';if(!groups.has(key))groups.set(key,{name:currentEmployeeName(userMap,p.userId,p.userName,p.userEmail),rows:[]});groups.get(key).rows.push(p);});
  box.innerHTML=groups.size?[...groups.values()].map(g=>`<div class="approval-employee"><div class="approval-employee-head"><strong>${escapeHtml(g.name)}</strong><span>${g.rows.reduce((n,p)=>n+v3hours(p),0).toFixed(2)} h à approuver</span></div>${g.rows.map(p=>{const d=new Date(v3toMillis(v3startValue(p)));return `<div class="approval-item"><div><strong>${longFrDay(d)}</strong><span>${escapeHtml(p.siteName||p.site||'Chantier')} · ${fmtTime(v3startValue(p))} → ${fmtTime(v3endValue(p))}</span></div><strong>${v3hours(p).toFixed(2)} h</strong><button data-v3approve="${p.id}" class="btn-primary small">Approuver</button></div>`}).join('')}</div>`).join(""):'<p class="muted">Aucune heure en attente.</p>';
  box.querySelectorAll("[data-v3approve]").forEach(b=>b.onclick=async()=>{await updateDoc(doc(db,"punches",b.dataset.v3approve),{approved:true,approvedBy:auth.currentUser?.uid||"",approvedAt:serverTimestamp()});await v3approvals(); await v3reports();});
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
  const rows=q.docs.map(d=>d.data()).filter(p=>v3isClosedPunch(p)&&p.approved===true);
  const out=[["Employé","Courriel","Chantier","Type de travail","Projet","Entrée","Sortie","Heures"]];
  rows.forEach(p=>{
    const a=new Date(v3toMillis(v3startValue(p))), b=new Date(v3toMillis(v3endValue(p)));
    out.push([p.userName||"",p.userEmail||"",p.siteName||p.site||"",p.workType||"",p.projectNumber||"",a.toLocaleString("fr-CA"),b.toLocaleString("fr-CA"),v3hours(p).toFixed(2)]);
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
  v3siteSelect()?.addEventListener("change",()=>{ if(currentProfile?.role!=="admin" || !v3advancedSiteSelect()?.value) v3loadSiteDetails(); });
  v3advancedSiteSelect()?.addEventListener("change",v3loadSiteDetails);

  const sync=()=>{
    const role=currentRole();
    const isAdmin=role===ROLE_ADMIN, isManager=isAdmin||role===ROLE_FOREMAN;
    ["constructionAdmin","siteReportsAdmin"].forEach(id=>v3el(id)?.classList.toggle("hidden",!isAdmin));
    v3el("approvalAdmin")?.classList.toggle("hidden",!isManager);
    if(isManager)v3approvals().catch(console.warn);
    if(isAdmin)v3reports().catch(console.warn);
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



function applyRoleUI(){
  const r = currentRole();
  const isAdmin = r === ROLE_ADMIN;
  const isForeman = r === ROLE_FOREMAN;

  document.querySelectorAll('[data-role-label]').forEach(el=>{
    el.textContent = roleLabel(r);
  });

  // Les vrais onglets gèrent maintenant la visibilité des sections.
  try{ refreshRoleMenu(); }catch(e){}
}



async function setEmployeeRoleV32(userId, newRole){
  if(!canManageUsers()) throw new Error('Seul un administrateur peut modifier les rôles.');
  const role = normalizeRole(newRole);
  await updateDoc(doc(db,'users',userId), { role, updatedAt:serverTimestamp() });
}

async function approvePunchV32(punchId){
  if(!canApproveHours()) throw new Error('Accès réservé au contremaître ou à l’administrateur.');
  await updateDoc(doc(db,'punches',punchId), {
    approved:true,
    approvedBy:auth.currentUser?.uid || '',
    approvedAt:serverTimestamp(),
    updatedAt:serverTimestamp()
  });
}

async function updatePunchTimeV32(punchId, patch){
  if(!canManageTime()) throw new Error('Accès réservé au contremaître ou à l’administrateur.');
  await updateDoc(doc(db,'punches',punchId), {
    ...patch,
    editedBy:auth.currentUser?.uid || '',
    editedAt:serverTimestamp(),
    updatedAt:serverTimestamp()
  });
}




// ===== Affectation Contremaître v3.5 =====
let foremanAssignment = { employeeIds:[] };

function isForemanMode(){
  return currentRole() === ROLE_FOREMAN;
}

function managedEmployeeSet(){
  return new Set(foremanAssignment.employeeIds || []);
}

function foremanCanSeeRecord(record){
  if(!isForemanMode()) return true;
  return managedEmployeeSet().has(record.userId);
}

function foremanCanSeeCorrection(req){
  if(!isForemanMode()) return true;
  return managedEmployeeSet().has(req.userId);
}

async function loadForemanAssignment(){
  if(!currentUser || !canManageTime()) return;
  const snap = await getDoc(doc(db,'users',currentUser.uid));
  const data = snap.exists() ? snap.data() : {};
  foremanAssignment = {
    employeeIds: Array.isArray(data.managedEmployeeIds) ? data.managedEmployeeIds : []
  };
  await populateForemanAssignmentUI();
}

async function populateForemanAssignmentUI(){
  const picker=$('foremanEmployeePicker');
  if(!picker) return;

  try{
    const usersSnap=await getDocs(collection(db,'users'));
    const users=usersSnap.docs
      .map(d=>({id:d.id,...d.data()}))
      .filter(u=>u.deleted!==true && u.active!==false && u.id!==currentUser.uid)
      .sort((a,b)=>(a.name||a.email||'').localeCompare(b.name||b.email||''));

    const selected=new Set(foremanAssignment.employeeIds||[]);

    picker.innerHTML=users.length ? users.map(u=>`
      <label class="foreman-employee-choice">
        <input type="checkbox" data-foreman-employee="${u.id}" ${selected.has(u.id)?'checked':''}>
        <span>
          <strong>${escapeHtml(u.name||u.email||'Utilisateur')}</strong>
          <small>${escapeHtml(u.email||'')} • ${escapeHtml(roleLabel(normalizeRole(u.role)))}</small>
        </span>
      </label>
    `).join('') : '<p class="muted">Aucun autre utilisateur actif.</p>';

    picker.querySelectorAll('[data-foreman-employee]').forEach(cb=>{
      cb.addEventListener('change',updateForemanEmployeeCount);
    });
    updateForemanEmployeeCount();
  }catch(e){
    console.error('Chargement équipe contremaître:',e);
    picker.innerHTML='<p class="muted">Erreur de chargement des utilisateurs : '+escapeHtml(e.message||String(e))+'</p>';
  }
}

function updateForemanEmployeeCount(){
  const count = document.querySelectorAll('#foremanEmployeePicker [data-foreman-employee]:checked').length;
  const label = $('foremanEmployeesCount');
  if(label) label.textContent = `${count} sélectionné${count>1?'s':''}`;
}

async function saveForemanAssignment(){
  if(!canManageTime()) return;

  const employeeIds = [...document.querySelectorAll('#foremanEmployeePicker [data-foreman-employee]:checked')]
    .map(cb=>cb.dataset.foremanEmployee)
    .filter(id=>id && id!==currentUser.uid);

  if(!employeeIds.length){
    alert('Sélectionne au moins une personne à superviser.');
    return;
  }

  await updateDoc(doc(db,'users',currentUser.uid),{
    managedEmployeeIds: employeeIds,
    foremanAssignmentUpdatedAt: serverTimestamp()
  });

  foremanAssignment = { employeeIds };

  if($('foremanAssignmentStatus')){
    $('foremanAssignmentStatus').textContent = 'Employés supervisés enregistrés.';
  }

  await loadAdmin();
  setTimeout(()=>refreshVisibleTimesheetNames(),100);
  if(typeof v3approvals === 'function') await v3approvals();
  if(typeof loadForemanPayrollPreview === 'function') await loadForemanPayrollPreview();
}

function setupForemanAssignmentUI(){
  $('saveForemanAssignmentBtn')?.addEventListener('click', async()=>{
    try{
      await saveForemanAssignment();
    }catch(e){
      alert('Impossible d’enregistrer l’équipe : '+e.message);
    }
  });
}
document.addEventListener('DOMContentLoaded', setupForemanAssignmentUI);



// ===== Suppression avec confirmation v3.6 =====
async function deleteSiteWithConfirm(siteId, siteName){
  if(currentRole() !== ROLE_ADMIN){
    return alert('Seul un administrateur peut supprimer un chantier.');
  }

  const ok = confirm(
    `Supprimer définitivement le chantier « ${siteName || 'Sans nom'} » ?\n\n` +
    `Il ne sera plus disponible pour les nouveaux punchs. Les anciennes feuilles de temps seront conservées.`
  );
  if(!ok) return;

  const second = confirm(
    `Confirmation finale : veux-tu vraiment supprimer « ${siteName || 'ce chantier'} » ?`
  );
  if(!second) return;

  try{
    await deleteDoc(doc(db,'sites',siteId));
    await loadSites();
    await loadAdmin();
    alert('Chantier supprimé.');
  }catch(e){
    alert('Impossible de supprimer le chantier : ' + e.message);
  }
}

async function removeEmployeeWithConfirm(userId, userName, userEmail){
  if(currentRole() !== ROLE_ADMIN){
    return alert('Seul un administrateur peut supprimer un employé.');
  }

  if(userId === currentUser?.uid){
    return alert('Tu ne peux pas supprimer ton propre compte administrateur.');
  }

  const label = userName || userEmail || 'cet employé';
  const ok = confirm(
    `Retirer « ${label} » de l’application ?\n\n` +
    `Ses anciennes feuilles de temps et punchs seront conservés.`
  );
  if(!ok) return;

  const second = confirm(
    `Confirmation finale : supprimer « ${label} » de la liste des employés ?`
  );
  if(!second) return;

  try{
    // Soft-delete pour préserver l'historique et éviter de briser les anciens punchs.
    await updateDoc(doc(db,'users',userId),{
      active:false,
      deleted:true,
      deletedAt:serverTimestamp(),
      deletedBy:currentUser?.uid || ''
    });

    // Retirer cet employé des équipes des contremaîtres.
    const usersSnap = await getDocs(collection(db,'users'));
    for(const d of usersSnap.docs){
      const u = d.data();
      if(Array.isArray(u.managedEmployeeIds) && u.managedEmployeeIds.includes(userId)){
        await updateDoc(doc(db,'users',d.id),{
          managedEmployeeIds:u.managedEmployeeIds.filter(id=>id!==userId),
          updatedAt:serverTimestamp()
        });
      }
    }

    await loadEmployees();
    await loadAdmin();
    alert('Employé retiré.');
  }catch(e){
    alert('Impossible de retirer l’employé : ' + e.message);
  }
}


// ===== Menu hamburger + vrais onglets par rôle v3.4 =====
let activeRoleTab = 'employee';
let roleViewsPrepared = false;

function roleRank(role){
  if(role === ROLE_ADMIN || role === 'admin') return 3;
  if(role === ROLE_FOREMAN || role === 'foreman') return 2;
  return 1;
}

function allowedRoleTab(tab){
  return roleRank(currentRole()) >= roleRank(tab);
}

function prepareRoleViews(){
  if(roleViewsPrepared && document.getElementById('roleViewEmployee')?.children.length) return;

  const employeeView = document.getElementById('roleViewEmployee');
  const foremanView = document.getElementById('roleViewForeman');
  const adminView = document.getElementById('roleViewAdmin');
  if(!employeeView || !foremanView || !adminView) return;

  // ESPACE EMPLOYÉ:
  // Carte punch + statistiques (leur grille commune)
  const employeeSection = document.getElementById('employeeSection');
  const topGrid = employeeSection?.closest('.grid.two');
  if(topGrid) employeeView.appendChild(topGrid);

  // Historique personnel
  const historyBody = document.getElementById('historyBody');
  const historyCard = historyBody?.closest('.card');
  if(historyCard) employeeView.appendChild(historyCard);

  // Journal / note quotidienne
  const dailyNote = document.getElementById('dailyNoteSection');
  if(dailyNote){
    dailyNote.classList.remove('hidden');
    employeeView.appendChild(dailyNote);
  }

  // ESPACE CONTREMAÎTRE:
  // Présents maintenant
  const presentCard = document.getElementById('presentList')?.closest('.card');
  if(presentCard) foremanView.appendChild(presentCard);

  // Demandes de correction
  const correctionCard = document.getElementById('correctionList')?.closest('.card');
  if(correctionCard) foremanView.appendChild(correctionCard);

  // Feuilles de temps / modifications
  const timesCard = document.getElementById('adminTimesBody')?.closest('.card');
  if(timesCard) foremanView.appendChild(timesCard);

  // Approbation des heures
  const approvals = document.getElementById('foremanSection') || document.getElementById('approvalAdmin');
  if(approvals) {
    approvals.classList.remove('hidden');
    foremanView.appendChild(approvals);
  }

  // ESPACE ADMIN:
  // Gestion des chantiers
  const siteCard = document.getElementById('siteList')?.closest('.card');
  if(siteCard) adminView.appendChild(siteCard);

  // Gestion des employés et rôles
  const employeesCard = document.getElementById('employeeList')?.closest('.card');
  if(employeesCard) adminView.appendChild(employeesCard);

  // Gestion chantier avancée
  const construction = document.getElementById('constructionAdmin');
  if(construction) {
    construction.classList.remove('hidden');
    adminView.appendChild(construction);
  }

  // Rapports
  const reports = document.getElementById('siteReportsAdmin');
  if(reports) {
    reports.classList.remove('hidden');
    adminView.appendChild(reports);
  }

  // Explication des permissions
  const rolesInfo = document.getElementById('rolesInfo');
  if(rolesInfo) {
    rolesInfo.classList.remove('hidden');
    adminView.appendChild(rolesInfo);
  }

  // Ancien conteneur admin: on le garde invisible, puisque ses cartes
  // ont été déplacées dans les vrais onglets.
  const oldAdminPanel = document.getElementById('adminPanel');
  if(oldAdminPanel) oldAdminPanel.classList.add('hidden');

  roleViewsPrepared = true;
}

function refreshRoleMenu(){
  const role = currentRole();
  const rank = roleRank(role);

  const label = document.getElementById('drawerRoleLabel');
  if(label) label.textContent = roleLabel(role);

  document.querySelectorAll('.drawer-link[data-min-role]').forEach(btn=>{
    const visible = rank >= roleRank(btn.dataset.minRole || 'employee');
    btn.classList.toggle('hidden', !visible);
  });

  if(!allowedRoleTab(activeRoleTab)){
    switchRoleTab('employee');
  }
}

async function switchRoleTab(tab){
  prepareRoleViews();

  if(!allowedRoleTab(tab)) tab = 'employee';
  activeRoleTab = tab;

  const employee = document.getElementById('roleViewEmployee');
  const foreman = document.getElementById('roleViewForeman');
  const admin = document.getElementById('roleViewAdmin');

  // Force l'affichage au lieu de dépendre seulement des anciennes classes.
  [employee, foreman, admin].forEach(el=>{
    if(el){
      el.classList.add('hidden');
      el.style.display = 'none';
    }
  });

  const target = tab === 'admin' ? admin : (tab === 'foreman' ? foreman : employee);
  if(target){
    target.classList.remove('hidden');
    target.style.display = 'block';
  }

  // Recharge les données nécessaires au moment où on ouvre un onglet.
  try{
    if(tab === 'foreman' && canManageTime()){
      await loadForemanAssignment();
      try{ await populateForemanAssignmentUI(); }catch(e){ console.warn(e); }
      await loadAdmin();
      if(typeof v3approvals === 'function') await v3approvals();
    }
    if(tab === 'admin' && currentRole() === ROLE_ADMIN){
      await loadAdmin();
      await loadEmployees();
      if(typeof v3approvals === 'function') await v3approvals();
      if(typeof v3reports === 'function') await v3reports();
    }
  }catch(err){
    console.warn('Chargement onglet:', err);
  }

  document.querySelectorAll('.drawer-link[data-role-tab]').forEach(btn=>{
    btn.classList.toggle('active', btn.dataset.roleTab === tab);
  });

  closeRoleDrawer();
  setTimeout(()=>window.scrollTo({top:0, behavior:'smooth'}),50);
}

function openRoleDrawer(){
  refreshRoleMenu();
  document.getElementById('roleDrawer')?.classList.add('open');
  document.getElementById('drawerBackdrop')?.classList.remove('hidden');
  document.getElementById('roleDrawer')?.setAttribute('aria-hidden','false');
  document.getElementById('menuToggleBtn')?.setAttribute('aria-expanded','true');
}

function closeRoleDrawer(){
  document.getElementById('roleDrawer')?.classList.remove('open');
  document.getElementById('drawerBackdrop')?.classList.add('hidden');
  document.getElementById('roleDrawer')?.setAttribute('aria-hidden','true');
  document.getElementById('menuToggleBtn')?.setAttribute('aria-expanded','false');
}

function setupRoleMenu(){
  prepareRoleViews();

  const toggle = document.getElementById('menuToggleBtn');
  if(toggle){
    toggle.onclick = ()=>{
      const isOpen = document.getElementById('roleDrawer')?.classList.contains('open');
      isOpen ? closeRoleDrawer() : openRoleDrawer();
    };
  }

  const close = document.getElementById('drawerCloseBtn');
  if(close) close.onclick = closeRoleDrawer;

  const backdrop = document.getElementById('drawerBackdrop');
  if(backdrop) backdrop.onclick = closeRoleDrawer;

  document.querySelectorAll('.drawer-link[data-role-tab]').forEach(btn=>{
    btn.onclick = async (e)=>{
      e.preventDefault();
      e.stopPropagation();
      await switchRoleTab(btn.dataset.roleTab);
    };
  });

  refreshRoleMenu();
}

// Fallback iPhone/Safari : capture tous les clics sur les boutons du menu.
document.addEventListener('click', async (e)=>{
  const btn = e.target.closest?.('.drawer-link[data-role-tab]');
  if(!btn) return;
  e.preventDefault();
  e.stopPropagation();
  await switchRoleTab(btn.dataset.roleTab);
}, true);

document.addEventListener('DOMContentLoaded', setupRoleMenu);



function enhanceSiteDeleteButtons(){
  document.querySelectorAll('#siteList .list-item').forEach(item=>{
    if(item.querySelector('[data-delete-site]')) return;
    const rename = item.querySelector('[data-rename-site]');
    const id = rename?.dataset.renameSite;
    if(!id) return;
    const name = item.querySelector('strong')?.textContent?.trim() || 'Sans nom';
    const actions = rename.parentElement;
    const btn = document.createElement('button');
    btn.className = 'delete compact';
    btn.textContent = 'Supprimer';
    btn.dataset.deleteSite = id;
    btn.dataset.siteName = name;
    actions?.appendChild(btn);
  });
}

function enhanceEmployeeDeleteButtons(){
  document.querySelectorAll('#employeeList .list-item').forEach(item=>{
    if(item.querySelector('[data-delete-employee]')) return;
    const roleSelect = item.querySelector('[data-role-user]');
    const activeBtn = item.querySelector('[data-user-toggle]');
    const uid = roleSelect?.dataset.roleUser || activeBtn?.dataset.userToggle;
    if(!uid || uid === currentUser?.uid) return;

    const strong = item.querySelector('strong');
    const name = strong?.textContent?.trim() || 'Employé';
    const small = item.querySelector('small')?.textContent || '';
    const email = small.split('•')[0]?.trim() || '';

    const actions = roleSelect?.parentElement || activeBtn?.parentElement || item;
    const btn = document.createElement('button');
    btn.className = 'delete compact';
    btn.textContent = 'Supprimer';
    btn.dataset.deleteEmployee = uid;
    btn.dataset.employeeName = name;
    btn.dataset.employeeEmail = email;
    actions.appendChild(btn);
  });
}

document.addEventListener('click', async e=>{
  const siteBtn = e.target.closest?.('[data-delete-site]');
  if(siteBtn){
    e.preventDefault();
    e.stopPropagation();
    await deleteSiteWithConfirm(siteBtn.dataset.deleteSite, siteBtn.dataset.siteName);
    return;
  }

  const empBtn = e.target.closest?.('[data-delete-employee]');
  if(empBtn){
    e.preventDefault();
    e.stopPropagation();
    await removeEmployeeWithConfirm(
      empBtn.dataset.deleteEmployee,
      empBtn.dataset.employeeName,
      empBtn.dataset.employeeEmail
    );
  }
}, true);



// ===== Export paie contremaître v3.8 =====
let payrollWeekOffset=0;
function payrollStartOfWeek(base=new Date(),off=0){const d=new Date(base);d.setHours(0,0,0,0);d.setDate(d.getDate()-d.getDay()+off*7);return d}
function payrollEndOfWeek(s){const d=new Date(s);d.setDate(d.getDate()+6);d.setHours(23,59,59,999);return d}
function payrollWeekRange(){const start=payrollStartOfWeek(new Date(),payrollWeekOffset);return{start,end:payrollEndOfWeek(start)}}
function payrollManagedIds(){const ids=new Set((foremanAssignment&&foremanAssignment.employeeIds)||[]);if(currentUser?.uid)ids.add(currentUser.uid);return ids}
function payrollTaskLabel(p){return p.workType||p.task||p.taskName||p.subSite||p.subSiteName||'—'}
function payrollRecordDate(p){return toDate(p.startAt||p.startTime||p.clockIn||p.createdAt)}
function payrollInWeek(p){const d=payrollRecordDate(p);const r=payrollWeekRange();return d&&d>=r.start&&d<=r.end}
function payrollHours(p){
  const end=p.endAt||p.endTime||p.clockOut;
  if(!end)return 0;
  if(typeof paidHoursBetweenSession==='function')return paidHoursBetweenSession(p,end);
  const a=payrollRecordDate(p),b=toDate(end);if(!a||!b)return 0;
  let h=Math.max(0,(b-a)/36e5);
  if(p.mealStartAt)h=Math.max(0,h-0.5);
  return h;
}
function payrollStatus(p){return p.approved===true?'Approuvé':'À approuver'}

async function loadForemanPayrollPreview(){
  const box=$('payrollPreviewList'); if(!box||!currentUser)return;
  const {start,end}=payrollWeekRange();
  if($('payrollWeekLabel'))$('payrollWeekLabel').textContent=`${start.toLocaleDateString('fr-CA',{day:'numeric',month:'short'})} au ${end.toLocaleDateString('fr-CA',{day:'numeric',month:'short',year:'numeric'})}`;
  const ids=payrollManagedIds();
  const [ps,us]=await Promise.all([getDocs(collection(db,'punches')),getDocs(collection(db,'users'))]);
  const users=new Map(us.docs.map(d=>[d.id,{id:d.id,...d.data()}]));
  const punches=ps.docs.map(d=>({id:d.id,...d.data()})).filter(p=>ids.has(p.userId)&&payrollInWeek(p));
  box.innerHTML=[...ids].map(uid=>{
    const u=users.get(uid)||{}, rows=punches.filter(p=>p.userId===uid);
    const total=rows.reduce((s,p)=>s+payrollHours(p),0);
    const byDay={};
    rows.forEach(p=>{const d=payrollRecordDate(p);const k=d?d.toISOString().slice(0,10):'x';(byDay[k]??=[]).push(p)});
    const days=Object.entries(byDay).sort((a,b)=>a[0].localeCompare(b[0])).map(([k,rr])=>{
      const d=new Date(k+'T12:00:00'),dt=rr.reduce((s,p)=>s+payrollHours(p),0);
      return `<div class="payroll-day"><div class="payroll-day-head"><strong>${d.toLocaleDateString('fr-CA',{weekday:'long',day:'numeric',month:'short'})}</strong><span>${dt.toFixed(2)} h</span></div>${rr.map(p=>`<div class="payroll-line"><strong>${escapeHtml(p.siteName||p.site||'Chantier')}</strong><div class="muted">Tâche : ${escapeHtml(payrollTaskLabel(p))}</div><div class="muted">${fmtDateTime(p.startAt||p.startTime||p.clockIn)} → ${fmtDateTime(p.endAt||p.endTime||p.clockOut)}</div><div class="muted">Repas : ${p.mealStartAt?30:0} min · ${payrollStatus(p)}</div></div>`).join('')}</div>`
    }).join('');
    return `<div class="payroll-employee"><div class="payroll-employee-head"><strong>${escapeHtml(u.name||u.email||'Employé')}</strong><span>${total.toFixed(2)} h</span></div>${days||'<p class="muted small payroll-empty">Aucune heure cette semaine.</p>'}</div>`
  }).join('');
}

async function approveForemanOwnWeek(){
  const ps=await getDocs(collection(db,'punches'));
  const own=ps.docs.map(d=>({id:d.id,...d.data()})).filter(p=>p.userId===currentUser.uid&&payrollInWeek(p)&&(p.endAt||p.endTime||p.clockOut));
  for(const p of own) if(p.approved!==true) await updateDoc(doc(db,'punches',p.id),{approved:true,approvedBy:currentUser.uid,approvedAt:serverTimestamp(),updatedAt:serverTimestamp()});
  if($('payrollExportStatus'))$('payrollExportStatus').textContent='Tes heures sont approuvées.';
  await loadForemanPayrollPreview();
}


// ===== Export CSV par segments v3.10.4 =====
function payrollSegmentHours(p, segment){
  const a=toDate(segment.startAt);
  const b=toDate(segment.endAt || p.endAt || p.endTime || p.clockOut);
  if(!a || !b) return 0;
  let ms=Math.max(0,b-a);

  // Déduire seulement la portion du repas qui chevauche ce segment.
  if(p.mealStartAt){
    const mealStart=toDate(p.mealStartAt);
    let mealEnd=p.mealEndAt?toDate(p.mealEndAt):null;
    if(mealStart && !mealEnd) mealEnd=new Date(mealStart.getTime()+30*60000);
    if(mealStart && mealEnd){
      const overlap=Math.max(0,Math.min(b,mealEnd)-Math.max(a,mealStart));
      ms=Math.max(0,ms-overlap);
    }
  }
  return ms/36e5;
}
function payrollSegmentsForExport(p){
  const segs=Array.isArray(p.workSegments) ? p.workSegments.filter(s=>s&&s.startAt) : [];
  if(!segs.length){
    return [{
      siteName:p.siteName||p.site||'',
      task:payrollTaskLabel(p),
      startAt:p.startAt||p.startTime||p.clockIn,
      endAt:p.endAt||p.endTime||p.clockOut,
      hours:payrollHours(p)
    }];
  }
  return segs.map((s,i)=>({
    siteName:s.siteName||p.siteName||p.site||'',
    task:s.task||s.workType||'—',
    startAt:s.startAt,
    endAt:s.endAt || (i===segs.length-1 ? (p.endAt||p.endTime||p.clockOut) : null),
    hours:payrollSegmentHours(p,s)
  }));
}

async function exportForemanPayrollCsv(){
  const ids=payrollManagedIds(),{start,end}=payrollWeekRange();
  const [ps,us]=await Promise.all([getDocs(collection(db,'punches')),getDocs(collection(db,'users'))]);
  const users=new Map(us.docs.map(d=>[d.id,{id:d.id,...d.data()}]));
  const rows=ps.docs.map(d=>({id:d.id,...d.data()})).filter(p=>ids.has(p.userId)&&payrollInWeek(p)&&(p.endAt||p.endTime||p.clockOut));

  const byEmployee=new Map();
  rows.forEach(p=>{
    if(!byEmployee.has(p.userId)) byEmployee.set(p.userId,[]);
    byEmployee.get(p.userId).push(p);
  });

  const employeeIds=[...byEmployee.keys()].sort((a,b)=>{
    const ua=users.get(a)||{},ub=users.get(b)||{};
    return currentEmployeeName(users,a,ua.name,ua.email).localeCompare(currentEmployeeName(users,b,ub.name,ub.email),'fr',{sensitivity:'base'});
  });

  const data=[];
  data.push(['SEMAINE DE PAIE',`${start.toLocaleDateString('fr-CA')} au ${end.toLocaleDateString('fr-CA')}`]);
  data.push([]);

  employeeIds.forEach((uid,index)=>{
    const u=users.get(uid)||{};
    const name=u.name||u.email||'Employé';
    const employeeRows=byEmployee.get(uid).sort((a,b)=>payrollRecordDate(a)-payrollRecordDate(b));
    const weeklyTotal=employeeRows.reduce((sum,p)=>sum+payrollHours(p),0);

    data.push(['EMPLOYÉ',name]);
    if(u.email) data.push(['COURRIEL',u.email]);
    data.push(['Date','Chantier','Tâche effectuée','Début segment','Fin segment','Repas (min)','Heures segment','Statut']);

    employeeRows.forEach(p=>{
      const punchDate=payrollRecordDate(p);
      const segments=payrollSegmentsForExport(p);
      const hasMultiple=segments.length>1;

      segments.forEach(seg=>{
        const a=toDate(seg.startAt),b=toDate(seg.endAt);
        let mealMinutes=0;
        if(p.mealStartAt && a && b){
          const mealStart=toDate(p.mealStartAt);
          let mealEnd=p.mealEndAt?toDate(p.mealEndAt):null;
          if(mealStart&&!mealEnd) mealEnd=new Date(mealStart.getTime()+30*60000);
          if(mealStart&&mealEnd) mealMinutes=Math.round(Math.max(0,Math.min(b,mealEnd)-Math.max(a,mealStart))/60000);
        }
        data.push([
          punchDate?.toLocaleDateString('fr-CA')||'',
          seg.siteName||'',
          seg.task||'—',
          a?.toLocaleTimeString('fr-CA',{hour:'2-digit',minute:'2-digit'})||'',
          b?.toLocaleTimeString('fr-CA',{hour:'2-digit',minute:'2-digit'})||'',
          mealMinutes,
          Number(seg.hours||0).toFixed(2),
          payrollStatus(p)
        ]);
      });

      if(hasMultiple){
        data.push(['TOTAL QUART','','','','','',payrollHours(p).toFixed(2),payrollStatus(p)]);
      }
    });

    data.push(['TOTAL SEMAINE','','','','','',weeklyTotal.toFixed(2),'']);
    if(index<employeeIds.length-1){data.push([]);data.push([]);}
  });

  const csv=data.map(r=>r.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(',')).join('\r\n');
  const blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=`paie_${start.toISOString().slice(0,10)}_${end.toISOString().slice(0,10)}.csv`;a.click();URL.revokeObjectURL(url);
}

document.addEventListener('DOMContentLoaded',()=>{
  $('payrollPrevWeekBtn')?.addEventListener('click',async()=>{payrollWeekOffset--;await loadForemanPayrollPreview()});
  $('payrollNextWeekBtn')?.addEventListener('click',async()=>{payrollWeekOffset++;await loadForemanPayrollPreview()});
  $('approveOwnWeekBtn')?.addEventListener('click',async()=>{try{await approveForemanOwnWeek()}catch(e){alert(e.message)}});
  $('exportForemanPayrollCsvBtn')?.addEventListener('click',async()=>{try{await exportForemanPayrollCsv()}catch(e){alert(e.message)}});
});


// ===== Changement chantier/tâche v3.9 =====
async function openChangeWorkModal(){
 if(!currentOpenSession)return alert('Tu dois être punché.');
 const s=$('changeWorkSite'); const sites=isOfflineNow()?allSites:(await getDocs(collection(db,'sites'))).docs.map(d=>({id:d.id,...d.data()})).filter(x=>x.active!==false);
 s.innerHTML=sites.map(x=>`<option value="${x.id}" data-name="${escapeHtml(x.name||'')}">${escapeHtml(x.name||'Sans nom')}</option>`).join('');
 if(currentOpenSession.siteId)s.value=currentOpenSession.siteId;
 const task=$('changeWorkTask');
 const currentTask=currentOpenSession.workType||currentOpenSession.task||'';
 if(task && currentTask){
   const has=[...task.options].some(o=>o.value===currentTask || o.textContent===currentTask);
   task.value=has?currentTask:'Autres';
 }
 if($('changeWorkOtherWrap')) $('changeWorkOtherWrap').classList.toggle('hidden', task?.value!=='Autres');
 show('changeWorkModal',true);
}
function closeChangeWorkModal(){show('changeWorkModal',false)}
async function confirmChangeWork(){
 if(!currentOpenSession)return;
 const s=$('changeWorkSite'),siteId=s.value,siteName=s.selectedOptions[0]?.dataset.name||s.selectedOptions[0]?.textContent||'';
 let task=$('changeWorkTask').value,other=$('changeWorkOther')?.value.trim()||'';if(task==='Autres'&&other)task='Autres — '+other;
 const now=localTs(),segments=Array.isArray(currentOpenSession.workSegments)?[...currentOpenSession.workSegments]:[];
 if(segments.length&&!segments[segments.length-1].endAt)segments[segments.length-1]={...segments[segments.length-1],endAt:now};
 if(!segments.length)segments.push({siteId:currentOpenSession.siteId||'',siteName:currentOpenSession.siteName||'',task:currentOpenSession.workType||currentOpenSession.task||'',startAt:currentOpenSession.startAt,endAt:now});
 segments.push({siteId,siteName,task,startAt:now,endAt:null});
 const patch={siteId,siteName,workType:task,task,workSegments:segments,updatedAt:now};
 if(isOfflineNow()){enqueueOffline('changeWork',currentOpenSession.id,patch);currentOpenSession={...currentOpenSession,...patch};cacheOpenSession(currentOpenSession);closeChangeWorkModal();if($('punchMsg'))$('punchMsg').textContent='📴 Changement enregistré hors connexion. Le compteur continue.';return}
 await updateDoc(doc(db,'punches',currentOpenSession.id),{siteId,siteName,workType:task,task,workSegments:segments,updatedAt:serverTimestamp()});currentOpenSession={...currentOpenSession,...patch};cacheOpenSession(currentOpenSession);closeChangeWorkModal();if($('punchMsg'))$('punchMsg').textContent='Changement enregistré. Le compteur continue.';
}
function refreshChangeWorkButton(){show('changeWorkBtn',!!currentOpenSession)}
document.addEventListener('DOMContentLoaded',()=>{
 $('changeWorkBtn')?.addEventListener('click',openChangeWorkModal);
 $('closeChangeWorkBtn')?.addEventListener('click',closeChangeWorkModal);
 $('confirmChangeWorkBtn')?.addEventListener('click',()=>confirmChangeWork().catch(e=>alert(e.message)));
 $('changeWorkTask')?.addEventListener('change',e=>$('changeWorkOtherWrap')?.classList.toggle('hidden',e.target.value!=='Autres'));

});



// ===== Historique avec segments chantier/tâche v3.9.2 =====
function historySegmentsHtml(r){
  const segs = Array.isArray(r.workSegments) ? r.workSegments : [];
  if(!segs.length){
    const site = r.siteName || r.site || 'Chantier';
    const task = r.workType || r.task || r.subSiteName || '—';
    return `<div class="history-segment">
      <div class="history-segment-main"><strong>${escapeHtml(site)}</strong><span>${escapeHtml(task)}</span></div>
      <div class="history-segment-time">${fmtDateTime(r.startAt||r.startTime||r.clockIn)} → ${fmtDateTime(r.endAt||r.endTime||r.clockOut)}</div>
    </div>`;
  }

  return segs.map((s,i)=>{
    const end = s.endAt || (i===segs.length-1 ? (r.endAt||r.endTime||r.clockOut) : null);
    return `<div class="history-segment">
      <div class="history-segment-main">
        <strong>${escapeHtml(s.siteName||'Chantier')}</strong>
        <span>${escapeHtml(s.task||'—')}</span>
      </div>
      <div class="history-segment-time">${fmtDateTime(s.startAt)} → ${fmtDateTime(end)}</div>
    </div>`;
  }).join('');
}


function bindHistoryCorrectionButtons(){
  document.querySelectorAll('[data-correct]').forEach(b=>b.onclick=()=>openEditModal(b.dataset.correct,false));
}



// ===== Modifier employé v3.10 =====
let editingEmployeeId = null;

async function openEditEmployeeModal(userId){
  if(currentRole() !== ROLE_ADMIN){
    return alert('Seul un administrateur peut modifier un employé.');
  }

  const snap = await getDoc(doc(db,'users',userId));
  if(!snap.exists()) return alert('Employé introuvable.');

  const u = snap.data();
  editingEmployeeId = userId;

  $('editEmployeeName').value = u.name || '';
  $('editEmployeeEmail').value = u.email || '';
  $('editEmployeeRole').value = normalizeRole(u.role);
  $('editEmployeeActive').checked = u.active !== false;
  $('editEmployeeMsg').textContent = '';

  // Le propriétaire principal ne peut pas perdre son rôle Admin.
  const isOwnerAccount = (u.email || '').toLowerCase() === 'benoit2568@hotmail.com';
  $('editEmployeeRole').disabled = isOwnerAccount;
  $('editEmployeeActive').disabled = isOwnerAccount;

  show('editEmployeeModal', true);
}

function closeEditEmployeeModal(){
  editingEmployeeId = null;
  show('editEmployeeModal', false);
}

async function saveEditEmployee(){
  if(currentRole() !== ROLE_ADMIN || !editingEmployeeId) return;

  const snap = await getDoc(doc(db,'users',editingEmployeeId));
  if(!snap.exists()) return alert('Employé introuvable.');
  const old = snap.data();

  const isOwnerAccount = (old.email || '').toLowerCase() === 'benoit2568@hotmail.com';
  const name = $('editEmployeeName').value.trim();
  let role = normalizeRole($('editEmployeeRole').value);
  let active = $('editEmployeeActive').checked;

  if(!name) return alert('Entre le nom de l’employé.');

  if(isOwnerAccount){
    role = ROLE_ADMIN;
    active = true;
  }

  await updateDoc(doc(db,'users',editingEmployeeId),{
    name,
    role,
    active,
    updatedAt:serverTimestamp()
  });

  $('editEmployeeMsg').textContent = 'Modifications enregistrées.';
  await loadEmployees();
  try{ await loadAdmin(); }catch(e){ console.warn(e); }
  setTimeout(closeEditEmployeeModal, 350);
}

function enhanceEmployeeEditButtons(){
  document.querySelectorAll('#employeeList .list-item').forEach(item=>{
    if(item.querySelector('[data-edit-employee]')) return;

    const roleSelect = item.querySelector('[data-role-user]');
    const activeBtn = item.querySelector('[data-user-toggle]');
    const uid = roleSelect?.dataset.roleUser || activeBtn?.dataset.userToggle;
    if(!uid) return;

    const actions = roleSelect?.parentElement || activeBtn?.parentElement || item;

    const btn = document.createElement('button');
    btn.className = 'secondary compact edit-employee-btn';
    btn.textContent = 'Modifier';
    btn.dataset.editEmployee = uid;
    actions.appendChild(btn);
  });
}

document.addEventListener('click', e=>{
  const btn = e.target.closest?.('[data-edit-employee]');
  if(!btn) return;
  e.preventDefault();
  e.stopPropagation();
  openEditEmployeeModal(btn.dataset.editEmployee).catch(err=>alert(err.message));
}, true);

document.addEventListener('DOMContentLoaded',()=>{
  $('closeEditEmployeeBtn')?.addEventListener('click',closeEditEmployeeModal);
  $('saveEditEmployeeBtn')?.addEventListener('click',()=>saveEditEmployee().catch(e=>alert(e.message)));
});



// ===== Nom employé actuel dans les feuilles de temps v3.10.2 =====
async function currentUserDirectory(){
  const snap = await getDocs(collection(db,'users'));
  return new Map(snap.docs.map(d=>[d.id,{id:d.id,...d.data()}]));
}

function currentEmployeeName(userMap, userId, fallbackName='', fallbackEmail=''){
  const u = userMap?.get(userId);
  return u?.name || u?.email || fallbackName || fallbackEmail || 'Employé';
}



async function refreshVisibleTimesheetNames(){
  try{
    const userMap = await currentUserDirectory();

    // Cards generated in Feuilles de temps.
    document.querySelectorAll('[data-timesheet-user-id]').forEach(el=>{
      const uid = el.dataset.timesheetUserId;
      const u = userMap.get(uid);
      const nameEl = el.querySelector('[data-timesheet-user-name]');
      if(u && nameEl) nameEl.textContent = u.name || u.email || 'Employé';
    });

    // Fallback for existing cards without data attributes:
    // match displayed email to the current user profile, then replace the nearest heading.
    document.querySelectorAll('.payroll-employee, .timesheet-employee, .employee-week-card').forEach(card=>{
      const txt = card.textContent || '';
      for(const [uid,u] of userMap){
        if(u.email && txt.includes(u.email)){
          const head = card.querySelector('h3,h4,.employee-name,.payroll-employee-head strong,strong');
          if(head) head.textContent = u.name || u.email;
          break;
        }
      }
    });
  }catch(e){
    console.warn('Mise à jour noms feuilles de temps:',e);
  }
}

document.addEventListener('DOMContentLoaded',updateSyncStatus);
