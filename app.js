import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, addDoc, updateDoc, collection, getDocs, query, where, orderBy, serverTimestamp, Timestamp } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js';

// === COLLE TON CONFIG FIREBASE ICI ===
const firebaseConfig = {
  apiKey: "REMPLACE_MOI",
  authDomain: "REMPLACE_MOI.firebaseapp.com",
  projectId: "REMPLACE_MOI",
  storageBucket: "REMPLACE_MOI.firebasestorage.app",
  messagingSenderId: "REMPLACE_MOI",
  appId: "REMPLACE_MOI"
};

const app=initializeApp(firebaseConfig), auth=getAuth(app), db=getFirestore(app);
const $=id=>document.getElementById(id);
let currentUser=null,currentProfile=null,currentOpenSession=null,allSites=[];

const fmtTime=t=>t?new Date(t.toDate?t.toDate():t).toLocaleTimeString('fr-CA',{hour:'2-digit',minute:'2-digit'}):'—';
const fmtDate=t=>t?new Date(t.toDate?t.toDate():t).toLocaleDateString('fr-CA'):'—';
const hoursBetween=(a,b)=>{if(!a||!b)return 0;const d1=a.toDate?a.toDate():new Date(a),d2=b.toDate?b.toDate():new Date(b);return Math.max(0,(d2-d1)/36e5)};
const show=(id,on=true)=>$(id).classList.toggle('hidden',!on);
const msg=(id,text)=>$(id).textContent=text||'';

async function getPosition(){
  if(!navigator.geolocation) throw new Error('GPS non disponible sur cet appareil.');
  return new Promise((res,rej)=>navigator.geolocation.getCurrentPosition(p=>res({lat:p.coords.latitude,lng:p.coords.longitude,accuracy:p.coords.accuracy}),()=>rej(new Error('Position GPS refusée ou indisponible.')),{enableHighAccuracy:true,timeout:15000,maximumAge:0}));
}

async function loadProfile(uid){const s=await getDoc(doc(db,'users',uid));return s.exists()?s.data():null}

async function loadSites(){
  const snap=await getDocs(query(collection(db,'sites'),where('active','==',true)));
  allSites=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>a.name.localeCompare(b.name));
  $('siteSelect').innerHTML='<option value="">Choisir un chantier…</option>'+allSites.map(s=>`<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');
  $('siteList').innerHTML=allSites.length?allSites.map(s=>`<div class="list-item"><span>${escapeHtml(s.name)}</span><small>Actif</small></div>`).join(''):'<p class="muted">Aucun chantier.</p>';
}

async function findOpenSession(){
  const q=query(collection(db,'sessions'),where('userId','==',currentUser.uid),where('status','==','open'));
  const snap=await getDocs(q); currentOpenSession=snap.empty?null:{id:snap.docs[0].id,...snap.docs[0].data()}; renderPresence();
}
function renderPresence(){const on=!!currentOpenSession;$('presenceDot').className='dot '+(on?'on':'off');$('presenceText').textContent=on?'Présent au travail':'Hors travail';$('punchInBtn').disabled=on;$('punchOutBtn').disabled=!on;if(on&&currentOpenSession.siteId)$('siteSelect').value=currentOpenSession.siteId}

async function punchIn(){
  try{
    if(currentOpenSession)return; const siteId=$('siteSelect').value;if(!siteId)throw new Error('Choisis un chantier.');
    $('punchInBtn').disabled=true;$('gpsStatus').textContent='Localisation GPS en cours…';const gps=await getPosition();
    const site=allSites.find(s=>s.id===siteId);
    await addDoc(collection(db,'sessions'),{userId:currentUser.uid,userName:currentProfile.name||currentUser.email,userEmail:currentUser.email,siteId,siteName:site?.name||'',startAt:serverTimestamp(),endAt:null,status:'open',startGps:gps,endGps:null,createdAt:serverTimestamp()});
    $('gpsStatus').textContent=`Entrée enregistrée. Précision GPS ±${Math.round(gps.accuracy)} m.`;await refreshAll();
  }catch(e){$('gpsStatus').textContent=e.message;$('punchInBtn').disabled=false}
}

async function punchOut(){
  try{
    if(!currentOpenSession)return;$('punchOutBtn').disabled=true;$('gpsStatus').textContent='Localisation GPS en cours…';const gps=await getPosition();
    await updateDoc(doc(db,'sessions',currentOpenSession.id),{endAt:serverTimestamp(),status:'closed',endGps:gps,updatedAt:serverTimestamp()});
    $('gpsStatus').textContent=`Sortie enregistrée. Précision GPS ±${Math.round(gps.accuracy)} m.`;await refreshAll();
  }catch(e){$('gpsStatus').textContent=e.message;$('punchOutBtn').disabled=false}
}

async function loadHistory(){
  const snap=await getDocs(query(collection(db,'sessions'),where('userId','==',currentUser.uid),orderBy('startAt','desc')));
  const rows=snap.docs.map(d=>({id:d.id,...d.data()}));
  $('historyBody').innerHTML=rows.length?rows.map(r=>`<tr><td>${fmtDate(r.startAt)}</td><td>${escapeHtml(r.siteName||'')}</td><td>${fmtTime(r.startAt)}</td><td>${fmtTime(r.endAt)}</td><td>${r.endAt?hoursBetween(r.startAt,r.endAt).toFixed(2)+' h':'En cours'}</td></tr>`).join(''):'<tr><td colspan="5">Aucun punch.</td></tr>';
  const now=new Date(),startToday=new Date(now.getFullYear(),now.getMonth(),now.getDate()); const day=(now.getDay()+6)%7,startWeek=new Date(startToday);startWeek.setDate(startToday.getDate()-day);
  let today=0,week=0;for(const r of rows){if(!r.startAt)continue;const s=r.startAt.toDate();const end=r.endAt||Timestamp.fromDate(now);const h=hoursBetween(r.startAt,end);if(s>=startToday)today+=h;if(s>=startWeek)week+=h}
  $('todayHours').textContent=today.toFixed(2)+' h';$('weekHours').textContent=week.toFixed(2)+' h';$('overtimeHours').textContent=Math.max(0,week-40).toFixed(2)+' h';
}

async function loadAdmin(){
  if(currentProfile?.role!=='admin')return;
  const openSnap=await getDocs(query(collection(db,'sessions'),where('status','==','open')));
  const present=openSnap.docs.map(d=>d.data());
  $('presentList').innerHTML=present.length?present.map(r=>`<div class="list-item"><div><strong>${escapeHtml(r.userName||r.userEmail)}</strong><br><small>${escapeHtml(r.siteName||'')} • depuis ${fmtTime(r.startAt)}</small></div><span class="dot on"></span></div>`).join(''):'<p class="muted">Personne n’est punché présentement.</p>';
  const snap=await getDocs(query(collection(db,'sessions'),orderBy('startAt','desc')));const rows=snap.docs.map(d=>d.data());
  $('adminTimesBody').innerHTML=rows.map(r=>`<tr><td>${escapeHtml(r.userName||r.userEmail)}</td><td>${fmtDate(r.startAt)}</td><td>${escapeHtml(r.siteName||'')}</td><td>${fmtTime(r.startAt)}</td><td>${fmtTime(r.endAt)}</td><td>${r.endAt?hoursBetween(r.startAt,r.endAt).toFixed(2)+' h':'En cours'}</td></tr>`).join('');
  window.__adminRows=rows;
}

async function addSite(){const name=$('newSiteName').value.trim();if(!name)return;await addDoc(collection(db,'sites'),{name,active:true,createdAt:serverTimestamp()});$('newSiteName').value='';await loadSites()}
function exportCsv(){const rows=window.__adminRows||[];const lines=[['Employé','Courriel','Date','Chantier','Entrée','Sortie','Total heures']];for(const r of rows)lines.push([r.userName||'',r.userEmail||'',fmtDate(r.startAt),r.siteName||'',fmtTime(r.startAt),fmtTime(r.endAt),r.endAt?hoursBetween(r.startAt,r.endAt).toFixed(2):'']);const csv=lines.map(a=>a.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\n');const blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='feuilles-de-temps.csv';a.click();URL.revokeObjectURL(a.href)}
function escapeHtml(s=''){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
async function refreshAll(){await findOpenSession();await loadHistory();if(currentProfile?.role==='admin')await loadAdmin()}

$('loginBtn').onclick=async()=>{try{msg('authMsg','');await signInWithEmailAndPassword(auth,$('email').value.trim(),$('password').value)}catch(e){msg('authMsg','Connexion impossible. Vérifie le courriel et le mot de passe.')}};
$('showRegisterBtn').onclick=()=>{show('authView',false);show('registerView',true)};$('backLoginBtn').onclick=()=>{show('registerView',false);show('authView',true)};
$('registerBtn').onclick=async()=>{try{msg('regMsg','');const name=$('regName').value.trim();if(!name)throw new Error('Inscris ton nom.');const cred=await createUserWithEmailAndPassword(auth,$('regEmail').value.trim(),$('regPassword').value);await setDoc(doc(db,'users',cred.user.uid),{name,email:cred.user.email,role:'employee',active:true,createdAt:serverTimestamp()})}catch(e){msg('regMsg',e.message)}};
$('logoutBtn').onclick=()=>signOut(auth);$('punchInBtn').onclick=punchIn;$('punchOutBtn').onclick=punchOut;$('refreshBtn').onclick=refreshAll;$('addSiteBtn').onclick=addSite;$('exportCsvBtn').onclick=exportCsv;

onAuthStateChanged(auth,async user=>{
  currentUser=user;
  if(!user){currentProfile=null;currentOpenSession=null;show('authView',true);show('registerView',false);show('dashboard',false);show('logoutBtn',false);return}
  currentProfile=await loadProfile(user.uid);
  if(!currentProfile){await setDoc(doc(db,'users',user.uid),{name:user.email,email:user.email,role:'employee',active:true,createdAt:serverTimestamp()});currentProfile=await loadProfile(user.uid)}
  $('userLine').textContent=`${currentProfile.name||user.email} • ${currentProfile.role==='admin'?'Administrateur':'Employé'}`;
  show('authView',false);show('registerView',false);show('dashboard',true);show('logoutBtn',true);show('adminPanel',currentProfile.role==='admin');await loadSites();await refreshAll();
});

if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js');
