/**
 * Shadowfax Pendency Dashboard — Apps Script backend
 *
 * NOTE: this is the public copy. Phone numbers, access-code hashes/salts (SEED.auth) and the
 * ADMIN_PROVISION entries were removed before publishing. Keep the full version in your Apps Script project.
 *
 * One-time setup:
 *   1. Paste this file into a new Apps Script project (script.google.com) as Code.gs.
 *   2. Run setup() once from the editor and approve the permissions.
 *      It connects to the "Pendency Dashboard DB" Google Sheet (SHEET_ID below), creates the Drive folder
 *      "Pendency Dashboard Files", and loads the POC mapping into the Config tab.
 *   3. Deploy > New deployment > Web app. Execute as: Me. Who has access: Anyone.
 *      Copy the Web app URL into API_URL at the top of index.html, then deploy index.html to Vercel.
 *
 * Storage:
 *   Tab "Tasks"        one row per assigned task (readable columns + full task JSON in the last column)
 *   Tab "Updates"      one row per POC update (remarks, status, attachment links)
 *   Tab "POC Mapping"  readable region / DC / L1 / L2 list, rewritten whenever the mapping changes
 *   Tab "Base Uploads" one row per published base file
 *   Tab "Config"       A1 = mapping JSON used by the backend
 *   Tab "Auth"         email | salt | hash | lastLogin   (access codes are stored only as salted SHA-256)
 *   Drive folder    base_data.json, base_suggestions.json, task AWB lists, update attachments
 */

const SHEET_ID = '1MxkEKLW7KKRSbs2ZOGkDS-cFgpT-VV6OKGrv4Nz_4D4'; // Pendency Dashboard DB
const SESSION_DAYS = 30;
const TASK_HEADER = ['Task ID', 'Region', 'DC', 'Pivot', 'Type', 'Priority', 'Task', 'AWBs', 'Still pending', 'Value (Rs)', 'Status', 'Closed how', 'Assigned to', 'Assigned at', 'Assigned by', 'Last seen in base', 'Last update at', 'Last update by', 'Closed at', 'Updates', 'json'];
const KIND_LABEL = { spike: 'Spike manifest', vol: 'Volumetric bags', hov: 'HOV', rto: 'RTO queued', rdcau: 'Action user', rdcbin: 'Bin trend', rdcna: 'No bin scan', pfc: 'Seller Pareto', brsnr: 'BRSNR origin trend', custom: 'Custom action' };
const SEED = {
 "version": 2,
 "regions": [
  {
   "name": "NCR Region",
   "l2": [
    "nesant.kumar@shadowfax.in"
   ],
   "dcs": [
    "NCR Bilaspur DC",
    "OneNCR DC",
    "NCR Bamnoli DC",
    "NCR Tauru DC",
    "Chandigarh DC",
    "Ludhiana DC",
    "NCR_Bamnoli_Large DC",
    "NCR_Tauru_Large DC",
    "TwoNCR DC",
    "Jammu DC",
    "Srinagar DC"
   ]
  },
  {
   "name": "North/West - 2",
   "l2": [
    "nilanjan.mishar@shadowfax.in"
   ],
   "dcs": [
    "Surat DC",
    "Ahmedabad DC",
    "Rajkot DC",
    "Jaipur DC",
    "Jodhpur DC",
    "Udaipur DC",
    "OneAMD DC",
    "OneRJT DC",
    "OneSRT DC"
   ]
  },
  {
   "name": "West",
   "l2": [
    "deepika.r1@shadowfax.in"
   ],
   "dcs": [
    "Mumbai DC",
    "Raipur DC",
    "Indore DC",
    "Bhopal DC",
    "Jabalpur DC",
    "Pune DC",
    "Nagpur DC",
    "Aurangabad DC"
   ]
  },
  {
   "name": "East",
   "l2": [
    "akhil.kumar@shadowfax.in"
   ],
   "dcs": [
    "Kolkata DC",
    "Bhubneshwar DC",
    "Ranchi DC",
    "Guwahati DC",
    "Dibrugarh DC",
    "Silchar DC",
    "CCU_Large DC",
    "Kolkata 2 DC",
    "Kolkata XD DC",
    "Malda DC",
    "Purnia DC",
    "Siliguri DC"
   ]
  },
  {
   "name": "North 1",
   "l2": [
    "akhil.kumar@shadowfax.in"
   ],
   "dcs": [
    "Lucknow DC",
    "Patna DC",
    "Gorakhpur DC",
    "Varanasi DC",
    "Kanpur DC",
    "Moradabad DC",
    "Sambalpur DC"
   ]
  },
  {
   "name": "South",
   "l2": [
    "m.arivazhagan@shadowfax.in"
   ],
   "dcs": [
    "Bangalore DC",
    "Kochi DC",
    "Chennai DC",
    "Kozhikode DC",
    "Hyderabad DC",
    "Rajahmundry DC",
    "Visakhapatnam DC",
    "Vijayawada DC",
    "Hubli DC",
    "Trichy DC",
    "Coimbatore DC",
    "Madurai DC",
    "Hyderabad REV DC",
    "Bangalore XD DC",
    "Mysore DC"
   ]
  }
 ],
 "l1": {
  "NCR Bilaspur DC": [
   "vrushabh.anturkar@shadowfax.in"
  ],
  "OneNCR DC": [
   "manoj.tanti@shadowfax.in",
   "rajat.yadav@shadowfax.in"
  ],
  "NCR Bamnoli DC": [
   "neetesh.jha@shadowfax.in"
  ],
  "NCR Tauru DC": [
   "satyam.tomar@shadowfax.in"
  ],
  "Chandigarh DC": [
   "pawan.kumar11@shadowfax.in"
  ],
  "Ludhiana DC": [
   "pawan.kumar11@shadowfax.in"
  ],
  "Surat DC": [
   "shubham.ashok@shadowfax.in",
   "nitin.gavhane@shadowfax.in"
  ],
  "Ahmedabad DC": [
   "rajesh.chavda@shadowfax.in"
  ],
  "Rajkot DC": [
   "rajesh.chavda@shadowfax.in"
  ],
  "Jaipur DC": [
   "mahesh.kumar3@shadowfax.in"
  ],
  "Jodhpur DC": [
   "mahesh.kumar3@shadowfax.in"
  ],
  "Udaipur DC": [
   "mahesh.kumar3@shadowfax.in"
  ],
  "Mumbai DC": [
   "vicky.kedar@shadowfax.in",
   "mahendra.khandkale@shadowfax.in"
  ],
  "Raipur DC": [
   "krishnakant.kumar@shadowfax.in"
  ],
  "Indore DC": [
   "indore.vigilance@shadowfax.in"
  ],
  "Bhopal DC": [
   "indore.vigilance@shadowfax.in"
  ],
  "Jabalpur DC": [
   "ankit.barai@shadowfax.in"
  ],
  "Pune DC": [
   "ankit.barai@shadowfax.in"
  ],
  "Nagpur DC": [
   "ankit.barai@shadowfax.in"
  ],
  "Kolkata DC": [
   "arun.das@shadowfax.in"
  ],
  "Lucknow DC": [
   "ankit.kumar1@shadowfax.in"
  ],
  "Patna DC": [
   "mohammad.adnan@shadowfax.in"
  ],
  "Bhubneshwar DC": [
   "akhil.kumar@shadowfax.in"
  ],
  "Ranchi DC": [
   "akhil.kumar@shadowfax.in"
  ],
  "Guwahati DC": [
   "biswajit.kalita1@shadowfax.in"
  ],
  "Dibrugarh DC": [
   "biswajit.kalita1@shadowfax.in"
  ],
  "Silchar DC": [
   "biswajit.kalita1@shadowfax.in"
  ],
  "Gorakhpur DC": [
   "akhil.kumar@shadowfax.in"
  ],
  "Varanasi DC": [
   "akhil.kumar@shadowfax.in"
  ],
  "Kanpur DC": [
   "akhil.kumar@shadowfax.in"
  ],
  "Moradabad DC": [
   "akhil.kumar@shadowfax.in"
  ],
  "Sambalpur DC": [
   "akhil.kumar@shadowfax.in"
  ],
  "Bangalore DC": [
   "abel.abraham@shadowfax.in"
  ],
  "Kochi DC": [
   "abel.abraham@shadowfax.in"
  ],
  "Chennai DC": [
   "jagadeeshwaran.sambath@shadowfax.in"
  ],
  "Kozhikode DC": [
   "abel.abraham@shadowfax.in"
  ],
  "Hyderabad DC": [
   "potnuru.jayanth@shadowfax.in"
  ],
  "Rajahmundry DC": [
   "potnuru.jayanth@shadowfax.in"
  ],
  "Visakhapatnam DC": [
   "potnuru.jayanth@shadowfax.in"
  ],
  "Vijayawada DC": [
   "potnuru.jayanth@shadowfax.in"
  ],
  "Hubli DC": [
   "jyotiba.savant@shadowfax.in"
  ],
  "Trichy DC": [
   "abel.abraham@shadowfax.in"
  ],
  "Coimbatore DC": [
   "jagadeeshwaran.sambath@shadowfax.in"
  ],
  "Madurai DC": [
   "jagadeeshwaran.sambath@shadowfax.in"
  ]
 },
 "people": {
  "vrushabh.anturkar@shadowfax.in": { "name": "Vrushabh", "phone": "" },
  "nesant.kumar@shadowfax.in": { "name": "Nesant", "phone": "" },
  "manoj.tanti@shadowfax.in": { "name": "Manoj Tanti", "phone": "" },
  "rajat.yadav@shadowfax.in": { "name": "Rajat Yadav", "phone": "" },
  "neetesh.jha@shadowfax.in": { "name": "Neetesh", "phone": "" },
  "satyam.tomar@shadowfax.in": { "name": "Satyam", "phone": "" },
  "pawan.kumar11@shadowfax.in": { "name": "Pawan", "phone": "" },
  "shubham.ashok@shadowfax.in": { "name": "Shubham", "phone": "" },
  "nilanjan.mishar@shadowfax.in": { "name": "Nilanjan", "phone": "" },
  "nitin.gavhane@shadowfax.in": { "name": "Nitin", "phone": "" },
  "rajesh.chavda@shadowfax.in": { "name": "Rajesh", "phone": "" },
  "mahesh.kumar3@shadowfax.in": { "name": "Mahesh", "phone": "" },
  "vicky.kedar@shadowfax.in": { "name": "Vicky", "phone": "" },
  "deepika.r1@shadowfax.in": { "name": "Deepika", "phone": "" },
  "mahendra.khandkale@shadowfax.in": { "name": "Mahendra", "phone": "" },
  "krishnakant.kumar@shadowfax.in": { "name": "Krishnakant", "phone": "" },
  "indore.vigilance@shadowfax.in": { "name": "Rajat", "phone": "" },
  "ankit.barai@shadowfax.in": { "name": "Ankit Barai", "phone": "" },
  "arun.das@shadowfax.in": { "name": "Arun Das", "phone": "" },
  "akhil.kumar@shadowfax.in": { "name": "Akhil Kumar", "phone": "" },
  "ankit.kumar1@shadowfax.in": { "name": "Ankit Yadav", "phone": "" },
  "mohammad.adnan@shadowfax.in": { "name": "Adnan", "phone": "" },
  "biswajit.kalita1@shadowfax.in": { "name": "Biswajit", "phone": "" },
  "abel.abraham@shadowfax.in": { "name": "Abel", "phone": "" },
  "m.arivazhagan@shadowfax.in": { "name": "Arivazhagan", "phone": "" },
  "jagadeeshwaran.sambath@shadowfax.in": { "name": "Jagan", "phone": "" },
  "potnuru.jayanth@shadowfax.in": { "name": "Jayanth", "phone": "" },
  "jyotiba.savant@shadowfax.in": { "name": "Jyotiba", "phone": "" },
  "joseph.cj@shadowfax.in": { "name": "Joseph", "phone": "" }
 },
 "auth": {}, // removed from the public copy: { email: { hash, salt } } for each person
 "autoPlaced": [
  "CCU_Large DC",
  "Hyderabad REV DC",
  "Kolkata 2 DC",
  "Kolkata XD DC",
  "Malda DC",
  "Purnia DC",
  "Siliguri DC",
  "Aurangabad DC",
  "Bangalore XD DC",
  "Mysore DC",
  "OneAMD DC",
  "OneRJT DC",
  "OneSRT DC",
  "NCR_Bamnoli_Large DC",
  "NCR_Tauru_Large DC",
  "TwoNCR DC",
  "Jammu DC",
  "Srinagar DC"
 ],
 "updatedAt": "2026-10-27T10:45:00Z",
 "admins": [
  "joseph.cj@shadowfax.in"
 ]
};

// ---------------------------------------------------------------- setup
function setup() {
  const props = PropertiesService.getScriptProperties();
  props.setProperty('SHEET_ID', SHEET_ID);
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let folderId = props.getProperty('FOLDER_ID');
  if (!folderId) { folderId = DriveApp.createFolder('Pendency Dashboard Files').getId(); props.setProperty('FOLDER_ID', folderId); }
  const sh = (name, header) => { let s = ss.getSheetByName(name); if (!s) { s = ss.insertSheet(name); if (header) s.appendRow(header); } return s; };
  sh('Tasks', TASK_HEADER); sh('Updates', ['Updated at', 'Task ID', 'Region', 'DC', 'Type', 'Priority', 'Task', 'Updated by', 'Email', 'Status', 'Remarks', 'Attachments', 'Footage link']);
  sh('POC Mapping', ['Region', 'DC', 'L1 POC', 'L1 email', 'L2 POC', 'L2 email', 'Not in matrix']);
  sh('Base Uploads', ['Uploaded at', 'Base date', 'File name', 'AWBs considered', 'Excluded (Ecom Data #N/A)', 'Suggested tasks', 'Uploaded by', 'Side']);
  const cfgSheet = sh('Config'); const authSheet = sh('Auth', ['email', 'salt', 'hash', 'lastLogin']);
  authSheet.getRange('A:C').setNumberFormat('@');
  if (!cfgSheet.getRange('A1').getValue()) {
    const cfg = Object.assign({}, SEED); delete cfg.auth;
    cfgSheet.getRange('A1').setNumberFormat('@').setValue(JSON.stringify(cfg));
  }
  if (authSheet.getLastRow() < 2) {
    const rows = Object.keys(SEED.auth).map(e => [e, SEED.auth[e].salt, SEED.auth[e].hash, '']);
    if (rows.length) authSheet.getRange(2, 1, rows.length, 4).setValues(rows);
  }
  writeMapping_(cfg_());
  Logger.log('Ready. Sheet: ' + ss.getUrl() + '  Folder: https://drive.google.com/drive/folders/' + folderId);
}

// ---------------------------------------------------------------- http
function doGet() { return json_({ ok: true, service: 'Pendency Dashboard API' }); }
function doPost(e) {
  let req;
  try { req = JSON.parse(e.postData.contents); } catch (x) { return json_({ ok: false, error: 'bad_request' }); }
  try {
    if (req.action === 'login') return json_(login_(req));
    const me = session_(req.token);
    const fn = ROUTES[req.action];
    if (!fn) throw err_('unknown_action', 'Unknown action');
    return json_(Object.assign({ ok: true }, fn(req, me)));
  } catch (x) {
    return json_({ ok: false, error: x.code || 'server_error', message: String(x.message || x) });
  }
}
const ROUTES = {
  logout: (r, me) => { PropertiesService.getScriptProperties().deleteProperty('sess:' + r.token); return {}; },
  bootstrap: bootstrap_,
  tasks: (r, me) => ({ tasks: visibleTasks_(me) }),
  suggestionAwbs: (r, me) => { admin_(me); const t = allSug_().tasks.find(x => x.id === r.id); return { awbs: t ? t.awbs : [] }; },
  taskAwbs: taskAwbs_,
  assign: assign_,
  unassign: unassign_,
  createCustom: createCustom_,
  uploadFile: uploadFile_,
  updateTask: updateTask_,
  saveConfig: saveConfig_,
  newCode: newCode_,
  uploadBase: uploadBase_,
  reassign: reassign_,
  cell: cell_,
  reports: reports_,
  floor: floor_,
  rawPart: rawPart_,
  rawDone: rawDone_,
  rawGet: rawGet_,
  prodPut: prodPut_,
  snapGet: snapGet_,
  closures: closures_,
  closurePut: closurePut_,
  cellTask: cellTask_,
  hovSync: hovSync_,
  hovImages: hovImages_,
};

// ---------------------------------------------------------------- helpers
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function err_(code, msg) { const e = new Error(msg || code); e.code = code; return e; }
function ss_() { return SpreadsheetApp.openById(SHEET_ID); }
function folder_() {
  const p = PropertiesService.getScriptProperties(); let id = p.getProperty('FOLDER_ID');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) {} }
  const f = DriveApp.createFolder('Pendency Dashboard Files'); p.setProperty('FOLDER_ID', f.getId()); return f;
}
function sha256_(s) { return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8).map(b => ('0' + (b & 255).toString(16)).slice(-2)).join(''); }
function lock_(fn) { const l = LockService.getScriptLock(); l.waitLock(30000); try { return fn(); } finally { l.releaseLock(); } }
function cfg_() {
  const sh = ss_().getSheetByName('Config');
  let raw = sh ? sh.getRange('A1').getValue() : '';
  if (!raw) { setup(); raw = ss_().getSheetByName('Config').getRange('A1').getValue(); }
  return JSON.parse(raw || '{}');
}
function saveCfg_(c) { ss_().getSheetByName('Config').getRange('A1').setValue(JSON.stringify(c)); }
function admin_(me) { if (!me.admin) throw err_('forbidden', 'Only the central team can do this.'); }
function readJsonFile_(key) { const id = PropertiesService.getScriptProperties().getProperty(key); if (!id) return null; try { return JSON.parse(DriveApp.getFileById(id).getBlob().getDataAsString()); } catch (e) { return null; } }
function writeJsonFile_(key, name, obj) {
  const props = PropertiesService.getScriptProperties(); const old = props.getProperty(key);
  const f = folder_().createFile(name, JSON.stringify(obj), 'application/json');
  props.setProperty(key, f.getId());
  if (old) { try { DriveApp.getFileById(old).setTrashed(true); } catch (e) {} }
  return f.getId();
}
function sideKeys_(side) { return side === 'rev' ? { DATA: 'REV_DATA_FILE', SUG: 'REV_SUG_FILE', AWB: 'REV_AWB_FILE', pfx: 'rev_base_', base: 'revBase' } : { DATA: 'DATA_FILE', SUG: 'SUG_FILE', AWB: 'AWB_FILE', pfx: 'base_', base: 'base' }; }
function sideOfTask_(t) { return (t.side === 'rev' || String(t.pivot || '').indexOf('Rev ') === 0) ? 'rev' : 'fwd'; }
function allSug_() { const a = readJsonFile_('SUG_FILE') || { tasks: [] }, b = readJsonFile_('REV_SUG_FILE') || { tasks: [] }; return { tasks: (a.tasks || []).concat(b.tasks || []), baseDate: a.baseDate || b.baseDate || '' }; }
function subfolder_(name) { const f = folder_(); const it = f.getFoldersByName(name); return it.hasNext() ? it.next() : f.createFolder(name); }

// ---------------------------------------------------------------- central admins (unrestricted access)
// Always admins, whatever the POC mapping says. New ones get their Auth row (salted hash only) on first sign-in.
const ADMIN_EMAILS = ['joseph.cj@shadowfax.in', 'lakshita.arya@shadowfax.in', 'pushkar.verma@shadowfax.in', 'naveed.iqbal@shadowfax.in', 'pratik.kamble@shadowfax.in'];
// Removed from the public copy: [{ email, name, salt, hash }] for each admin that should get an Auth row on first sign-in.
const ADMIN_PROVISION = [];
const ADMIN_NAMES = { 'joseph.cj@shadowfax.in': 'Joseph' }; ADMIN_PROVISION.forEach(p => ADMIN_NAMES[p.email] = p.name);
function ensureAdminLogin_(email, sh, vals) {
  const p = ADMIN_PROVISION.find(x => x.email === email); if (!p) return vals;
  for (let i = 1; i < vals.length; i++) if (String(vals[i][0]).trim().toLowerCase() === email) return vals;
  sh.appendRow([p.email, p.salt, p.hash, '']); return sh.getDataRange().getValues();
}

// ---------------------------------------------------------------- auth
function login_(r) {
  const email = String(r.email || '').trim().toLowerCase();
  const code = String(r.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  cfg_(); // runs first-time setup if it hasn't been run
  const sh = ss_().getSheetByName('Auth'); const vals = ensureAdminLogin_(email, sh, sh.getDataRange().getValues());
  // central admins sign in with their email alone (owner's choice, Nov 2026); everyone else needs their access code
  if (ADMIN_EMAILS.indexOf(email) >= 0) {
    const token = Utilities.getUuid() + Utilities.getUuid().replace(/-/g, '');
    PropertiesService.getScriptProperties().setProperty('sess:' + token, JSON.stringify({ email: email, exp: Date.now() + SESSION_DAYS * 864e5 }));
    for (let i = 1; i < vals.length; i++) if (String(vals[i][0]).trim().toLowerCase() === email) { sh.getRange(i + 1, 4).setValue(new Date().toISOString()); break; }
    cleanSessions_();
    return { ok: true, token: token, email: email };
  }
  if (!code) return { ok: false, error: 'need_code', message: 'Enter your access code.' };
  for (let i = 1; i < vals.length; i++) {
    if (String(vals[i][0]).trim().toLowerCase() === email && sha256_(String(vals[i][1]).trim() + ':' + code) === String(vals[i][2]).trim()) {
      const token = Utilities.getUuid() + Utilities.getUuid().replace(/-/g, '');
      const props = PropertiesService.getScriptProperties();
      props.setProperty('sess:' + token, JSON.stringify({ email: email, exp: Date.now() + SESSION_DAYS * 864e5 }));
      sh.getRange(i + 1, 4).setValue(new Date().toISOString());
      cleanSessions_();
      return { ok: true, token: token, email: email };
    }
  }
  Utilities.sleep(800);
  return { ok: false, error: 'bad_login', message: 'That email and access code don’t match.' };
}
function cleanSessions_() { const p = PropertiesService.getScriptProperties(); const all = p.getProperties(); const now = Date.now(); Object.keys(all).forEach(k => { if (k.indexOf('sess:') === 0) { try { if (JSON.parse(all[k]).exp < now) p.deleteProperty(k); } catch (e) { p.deleteProperty(k); } } }); }
function session_(token) {
  if (!token) throw err_('auth', 'Please sign in.');
  const raw = PropertiesService.getScriptProperties().getProperty('sess:' + token);
  if (!raw) throw err_('auth', 'Your session has ended. Please sign in again.');
  const s = JSON.parse(raw); if (s.exp < Date.now()) throw err_('auth', 'Your session has ended. Please sign in again.');
  return role_(s.email, cfg_());
}
function role_(email, c) {
  const regions = c.regions || [];
  const l2 = regions.filter(g => (g.l2 || []).indexOf(email) >= 0).map(g => g.name);
  const l1 = Object.keys(c.l1 || {}).filter(l => (c.l1[l] || []).indexOf(email) >= 0);
  const dcs = {}; l1.forEach(l => dcs[l] = 1); regions.filter(g => l2.indexOf(g.name) >= 0).forEach(g => (g.dcs || []).forEach(d => dcs[d] = 1));
  const admin = (c.admins || []).indexOf(email) >= 0 || ADMIN_EMAILS.indexOf(email) >= 0;
  return { email: email, name: ((c.people || {})[email] || {}).name || ADMIN_NAMES[email] || email, admin: admin, l2: l2, l1: l1, dcs: Object.keys(dcs) };
}
function pocReg_(t, c) { if (t.pocRegion) return t.pocRegion; const g = (c.regions || []).find(g => (g.dcs || []).indexOf(t.loc) >= 0); return g ? g.name : 'Unplaced'; }
function sees_(t, me, c) { if (me.admin) return true; if (t.assignees && t.assignees.length) return t.assignees.indexOf(me.email) >= 0; if (t.loc) return me.dcs.indexOf(t.loc) >= 0; return me.l2.indexOf(pocReg_(t, c)) >= 0; }

// ---------------------------------------------------------------- bootstrap
function bootstrap_(r, me) {
  const c = cfg_();
  const pub = { regions: c.regions || [], l1: c.l1 || {}, people: {}, autoPlaced: c.autoPlaced || [], admins: [...new Set((c.admins || []).concat(ADMIN_EMAILS))], base: c.base || null, revBase: c.revBase || null, raw: {}, prod: c.prod || {} };
  Object.keys(c.raw || {}).forEach(s => { const x = c.raw[s]; if (x) pub.raw[s] = { name: x.name, size: x.size, n: (x.ids || []).length, uploadedAt: x.uploadedAt, asOf: x.asOf || '' }; });
  Object.keys(ADMIN_NAMES).forEach(e => { if (!pub.people[e]) pub.people[e] = { name: ADMIN_NAMES[e], phone: '' }; });
  Object.keys(c.people || {}).forEach(e => pub.people[e] = { name: c.people[e].name, phone: c.people[e].phone || '' });
  let data = readJsonFile_('DATA_FILE');
  if (data && !me.admin) data = scopeData_(data, me.dcs);
  let revData = readJsonFile_('REV_DATA_FILE');
  if (revData && !me.admin) revData = scopeData_(revData, me.dcs);
  const out = { me: me, config: pub, data: data, revData: revData, tasks: visibleTasks_(me, c) };
  if (me.admin) {
    const s1 = readJsonFile_('SUG_FILE'), s2 = readJsonFile_('REV_SUG_FILE');
    const strip = s => s ? s.tasks.map(t => { const x = Object.assign({}, t); delete x.awbs; return x; }) : [];
    const sug = (s1 || s2) ? Object.assign({}, s1 || s2, { tasks: strip(s1).concat(strip(s2)), baseDate: (s1 || {}).baseDate || (s2 || {}).baseDate || '' }) : null;
    out.suggestions = sug;
    const auth = ss_().getSheetByName('Auth').getDataRange().getValues(); const signed = {};
    for (let i = 1; i < auth.length; i++) if (auth[i][3]) signed[String(auth[i][0]).toLowerCase()] = auth[i][3];
    out.signedIn = signed;
  }
  return out;
}
function scopeData_(D, dcs) {
  const allow = {}; D.dims.loc.forEach((l, i) => { if (dcs.indexOf(l) >= 0) allow[i] = 1; });
  const keep = []; D.cols.l.forEach((l, i) => { if (allow[l]) keep.push(i); });
  const cols = {}; Object.keys(D.cols).forEach(k => cols[k] = keep.map(i => D.cols[k][i]));
  const plan = {}; Object.keys(D.plan || {}).forEach(k => { const rec = D.plan[k]; if (dcs.indexOf(rec[3]) >= 0) plan[k] = rec; });
  let det = D.det;
  if (det && det.cols) { const dk = []; det.cols.l.forEach((l, i) => { if (allow[l]) dk.push(i); }); const dc = {}; Object.keys(det.cols).forEach(k => dc[k] = dk.map(i => det.cols[k][i])); det = { dims: det.dims, cols: dc }; }
  return Object.assign({}, D, { cols: cols, plan: plan, det: det });
}

// ---------------------------------------------------------------- tasks
function taskRows_() {
  const sh = ss_().getSheetByName('Tasks'); const v = sh.getDataRange().getValues(); const out = [];
  for (let i = 1; i < v.length; i++) {
    if (!v[i][0]) continue;
    let js = ''; for (let j = v[i].length - 1; j >= 0; j--) { const s = String(v[i][j] || ''); if (s.charAt(0) === '{') { js = s; break; } }
    try { out.push({ row: i + 1, t: JSON.parse(js) }); } catch (e) {}
  }
  return out;
}
function owners_(t, c) {
  if (t.assignees && t.assignees.length) return t.assignees;
  const l1 = t.loc ? ((c.l1 || {})[t.loc] || []) : [];
  if (l1.length) return l1;
  const g = (c.regions || []).find(g => g.name === pocReg_(t, c)); return g ? (g.l2 || []) : [];
}
function visibleTasks_(me, c) { c = c || cfg_(); return taskRows_().map(x => x.t).filter(t => sees_(t, me, c)).sort((a, b) => String(b.assignedAt).localeCompare(String(a.assignedAt))); }
let HDR_OK_ = false;
function taskVals_(t, c) {
  const own = owners_(t, c).map(e => ((c.people || {})[e] || {}).name || e).join(', ');
  const how = t.status !== 'Closed' ? '' : (t.closedBy === 'auto' ? 'Cleared from pendency' : 'Closed by POC');
  return [t.id, t.pocRegion || t.region || '', t.loc || 'All DCs', t.pivot || 'At Dock', KIND_LABEL[t.kind] || t.kind, t.prio || '', t.title || '', t.total || t.n || '', t.pending == null ? '' : t.pending, t.value || '', t.status, how, own, t.assignedAt || '', t.assignedBy || '', t.lastSeenBase || '', t.lastUpdateAt || '', t.lastUpdateBy || '', t.closedAt || '', (t.updates || []).length, JSON.stringify(t)];
}
function writeTask_(t, row, c) {
  const sh = ss_().getSheetByName('Tasks');
  if (!HDR_OK_) { const hdr = sh.getRange(1, 1, 1, TASK_HEADER.length).getValues()[0]; if (hdr.join('|') !== TASK_HEADER.join('|')) sh.getRange(1, 1, 1, TASK_HEADER.length).setValues([TASK_HEADER]); HDR_OK_ = true; }
  c = c || cfg_();
  const vals = [taskVals_(t, c)];
  if (row) sh.getRange(row, 1, 1, TASK_HEADER.length).setValues(vals); else sh.appendRow(vals[0]);
}
function rewriteTasks_(list, c) {
  const sh = ss_().getSheetByName('Tasks'); const last = sh.getLastRow(); const lastCol = Math.max(sh.getLastColumn(), TASK_HEADER.length);
  sh.getRange(1, 1, 1, TASK_HEADER.length).setValues([TASK_HEADER]); HDR_OK_ = true;
  if (last > 1) sh.getRange(2, 1, last - 1, lastCol).clearContent();
  const rows = list.map(x => taskVals_(x, c));
  if (rows.length) sh.getRange(2, 1, rows.length, TASK_HEADER.length).setValues(rows);
}
// ---------------------------------------------------------------- task AWB lists: one JSON file for all tasks
function awbStore_() { return readJsonFile_('TASK_AWB_FILE') || {}; }
function saveAwbStore_(s) { writeJsonFile_('TASK_AWB_FILE', 'task_awbs.json', s); }
// An AWB can sit in only one open task of a class. HOV tasks are their own class, so a HOV AWB can be in a HOV task
// and in one other task (e.g. a Received at DC action-user task) at the same time.
function cls_(t) { return (t && sideOfTask_(t) === 'rev' ? 'r' : '') + (t && t.kind === 'hov' ? 'hov:' : 'x:'); }
function openAwbMap_(tasks, store) {
  const m = {};
  tasks.forEach(t => { if (t.status === 'Closed') return; const c = cls_(t); taskAwbList_(t.id, store).forEach(a => { const k = c + (a.awb || a); if (!m[k]) m[k] = t.id; }); });
  return m;
}
// Closing a task closes the HOV task(s) at the same DC whose AWBs are now all covered by closed tasks.
function closeLinkedHov_(t, all, store, now, by) {
  if (t.kind === 'hov' || !t.loc) return [];
  const mine = {}; taskAwbList_(t.id, store).forEach(a => mine[a.awb] = 1);
  const closedCover = {}; all.forEach(x => { if (x.kind !== 'hov' && x.status === 'Closed' && x.loc === t.loc && sideOfTask_(x) === sideOfTask_(t)) taskAwbList_(x.id, store).forEach(a => closedCover[a.awb] = 1); });
  const changed = [];
  all.forEach(h => {
    if (h.kind !== 'hov' || h.status === 'Closed' || h.loc !== t.loc || sideOfTask_(h) !== sideOfTask_(t)) return;
    const list = taskAwbList_(h.id, store); const shared = list.filter(a => mine[a.awb]).length; if (!shared) return;
    const left = list.filter(a => !closedCover[a.awb]).length;
    if (!left) { h.status = 'Closed'; h.closedAt = now; h.closedBy = 'linked'; h.lastUpdateAt = now; h.lastUpdateBy = by; h.history = (h.history || []).concat([{ type: 'closedWith', at: now, task: t.id, title: t.title, n: shared }]); }
    else h.history = (h.history || []).concat([{ type: 'partClosedWith', at: now, task: t.id, title: t.title, n: shared, left: left }]);
    changed.push(h);
  });
  return changed;
}
function retitle_(title, oldN, newN) { return oldN === newN ? title : String(title || '').replace(String(oldN), String(newN)).replace(/\b1 AWBs\b/, '1 AWB').replace(/\b1 shipments\b/, '1 shipment'); }
function taskAwbList_(id, store) {
  if (store[id]) return store[id];
  try { const it = subfolder_('task-awbs').getFilesByName(id + '.json'); if (it.hasNext()) { store[id] = JSON.parse(it.next().getBlob().getDataAsString()); return store[id]; } } catch (e) {}
  return [];
}
function taskAwbs_(r, me) {
  const c = cfg_(); const x = taskRows_().find(x => x.t.id === r.id);
  if (!x || !sees_(x.t, me, c)) throw err_('not_found', 'Task not found.');
  return { awbs: taskAwbList_(r.id, awbStore_()) };
}
function assign_(r, me) {
  admin_(me); const c = cfg_();
  const sug = allSug_();
  const byId = {}; sug.tasks.forEach(t => byId[t.id] = t);
  return lock_(() => {
    const rows0 = taskRows_(); const existing = {}; rows0.forEach(x => existing[x.t.id] = 1);
    let n = 0, skipped = 0, trimmed = 0; const store = awbStore_(); const openAwb = openAwbMap_(rows0.map(x => x.t), store);
    (r.ids || []).forEach(id => {
      const s = byId[id]; if (!s || existing[id]) return;
      const c0 = cls_(s); const free = (s.awbs || []).filter(a => !openAwb[c0 + a.awb]);
      if (!free.length) { skipped++; return; }
      trimmed += (s.awbs || []).length - free.length;
      store[id] = free; free.forEach(a => openAwb[c0 + a.awb] = id);
      const t = Object.assign({}, s); delete t.awbs;
      if (free.length !== s.awbs.length) { t.title = retitle_(t.title, s.awbs.length, free.length); t.n = free.length; t.value = free.reduce((x, a) => x + (a.pv || 0), 0); t.spikeN = t.spikeN ? Math.min(t.spikeN, free.length) : t.spikeN; }
      t.manifests = (t.manifests || []).slice(0, 8);
      const now = new Date().toISOString();
      Object.assign(t, { pocRegion: pocReg_(t, c), baseDate: s.baseDate || sug.baseDate, assignedAt: now, assignedBy: me.email, status: 'Open', updates: [], lastUpdateAt: null, closedAt: null, total: free.length, pending: free.length, pendingValue: free.reduce((x, a) => x + (a.pv || 0), 0), lastSeenBase: sug.baseDate });
      t.history = [{ type: 'assigned', at: now, by: me.email, to: owners_(t, c) }];
      writeTask_(t, null, c); n++;
    });
    if (n) saveAwbStore_(store);
    return { assigned: n, skipped: skipped, trimmed: trimmed, tasks: visibleTasks_(me, c) };
  });
}
function unassign_(r, me) {
  admin_(me);
  return lock_(() => {
    const x = taskRows_().find(x => x.t.id === r.id); if (!x) return { tasks: visibleTasks_(me) };
    ss_().getSheetByName('Tasks').deleteRow(x.row);
    const store = awbStore_(); if (store[r.id]) { delete store[r.id]; saveAwbStore_(store); }
    try { const it = subfolder_('task-awbs').getFilesByName(r.id + '.json'); while (it.hasNext()) it.next().setTrashed(true); } catch (e) {}
    return { tasks: visibleTasks_(me) };
  });
}
function createCustom_(r, me) {
  admin_(me); const c = cfg_();
  if (!r.title || !r.region) throw err_('bad_request', 'Add the action item and choose a region.');
  const id = 'custom-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
  const awbs = (r.awbs || []).slice(0, 2000).map(a => ({ awb: String(a) }));
  return lock_(() => {
    let left = 0;
    if (awbs.length) { const store = awbStore_(); const openAwb = openAwbMap_(taskRows_().map(x => x.t), store); const pre = (String(r.pivot || '').indexOf('Rev ') === 0 ? 'r' : '') + 'x:'; const free = awbs.filter(a => !openAwb[pre + a.awb]); left = awbs.length - free.length; awbs.length = 0; free.forEach(a => awbs.push(a)); if (awbs.length) { store[id] = awbs; saveAwbStore_(store); } }
    const now0 = new Date().toISOString(); const ct = { id: id, kind: 'custom', pivot: r.pivot || 'Other', prio: r.prio || 'P1', region: r.region, pocRegion: r.region, loc: r.loc || null, title: String(r.title).slice(0, 200), details: String(r.details || '').slice(0, 4000), due: r.due || null, n: awbs.length || null, baseDate: (c.base || {}).baseDate || '', assignedAt: now0, assignedBy: me.email, status: 'Open', updates: [], lastUpdateAt: null, closedAt: null };
    ct.n = awbs.length || null;
    ct.history = [{ type: 'assigned', at: now0, by: me.email, to: owners_(ct, c) }];
    writeTask_(ct, null, c);
    return { leftOut: left, tasks: visibleTasks_(me, c) };
  });
}
function uploadFile_(r, me) {
  if (!r.data) throw err_('bad_request', 'No file data.');
  const blob = Utilities.newBlob(Utilities.base64Decode(r.data), r.type || 'application/octet-stream', String(r.name || 'attachment').slice(0, 120));
  const f = subfolder_('attachments').createFile(blob);
  f.setDescription('Uploaded by ' + me.email + ' for task ' + (r.taskId || ''));
  try { f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); }
  catch (e) { try { f.setSharing(DriveApp.Access.DOMAIN_WITH_LINK, DriveApp.Permission.VIEW); } catch (e2) {} }
  return { file: { id: f.getId(), name: f.getName(), type: blob.getContentType(), url: 'https://drive.google.com/file/d/' + f.getId() + '/view' } };
}
function updateTask_(r, me) {
  const c = cfg_();
  if (!String(r.remark || '').trim()) throw err_('bad_request', 'Add a remark before posting.');
  if (['Open', 'In progress', 'Closed'].indexOf(r.status) < 0) throw err_('bad_request', 'Pick a status.');
  return lock_(() => {
    const x = taskRows_().find(x => x.t.id === r.id);
    if (!x || !sees_(x.t, me, c)) throw err_('not_found', 'Task not found.');
    const now = new Date().toISOString();
    const up = { byEmail: me.email, at: now, status: r.status, remark: String(r.remark).slice(0, 4000), files: (r.files || []).slice(0, 10), link: /^https:\/\//i.test(r.link || '') ? r.link : null };
    const t = x.t; t.updates = (t.updates || []).concat([up]); t.status = r.status; t.lastUpdateAt = now; t.lastUpdateBy = me.email; t.closedAt = r.status === 'Closed' ? now : null;
    writeTask_(t, x.row, c);
    if (r.status === 'Closed' && t.kind !== 'hov') {
      const rows = taskRows_(); const all = rows.map(y => y.t); const store = awbStore_();
      const me2 = all.find(y => y.id === t.id); if (me2) Object.assign(me2, t);
      closeLinkedHov_(t, all, store, now, me.email).forEach(h => {
        const row = rows.find(y => y.t.id === h.id); writeTask_(h, row.row, c);
        if (h.status === 'Closed') ss_().getSheetByName('Updates').appendRow([now, h.id, pocReg_(h, c), h.loc || '', 'HOV', h.prio || '', h.title || '', me.name, me.email, 'Closed', 'Closed with ' + (KIND_LABEL[t.kind] || t.kind) + ' task ' + t.id + ': ' + up.remark, '', '']);
      });
    }
    ss_().getSheetByName('Updates').appendRow([now, t.id, pocReg_(t, c), t.loc || 'All DCs', KIND_LABEL[t.kind] || t.kind, t.prio || '', t.title || '', me.name, me.email, up.status, up.remark, (up.files || []).map(f => f.url || ('https://drive.google.com/file/d/' + f.id + '/view')).join('\n'), up.link || '']);
    return { tasks: visibleTasks_(me, c) };
  });
}

// ---------------------------------------------------------------- config + access codes
function saveConfig_(r, me) {
  admin_(me);
  return lock_(() => {
    const c = cfg_();
    if (r.regions) c.regions = r.regions;
    if (r.l1) c.l1 = r.l1;
    if (r.people) { Object.keys(r.people).forEach(e => { c.people[e.toLowerCase()] = { name: r.people[e].name, phone: r.people[e].phone || '' }; }); }
    if (r.autoPlaced) c.autoPlaced = r.autoPlaced;
    saveCfg_(c); writeMapping_(c);
    // people without a code get one; return new codes once
    const sh = ss_().getSheetByName('Auth'); const have = {}; sh.getDataRange().getValues().slice(1).forEach(v => have[String(v[0]).toLowerCase()] = 1);
    const codes = {};
    Object.keys(c.people).forEach(e => { if (!have[e]) { codes[e] = setCode_(e); } });
    return { codes: codes };
  });
}
function genCode_() { const A = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; let s = ''; for (let i = 0; i < 8; i++) s += A.charAt(Math.floor(Math.random() * A.length)); return s; }
function setCode_(email) {
  const code = genCode_(); const salt = Utilities.getUuid().replace(/-/g, '').slice(0, 16); const hash = sha256_(salt + ':' + code);
  const sh = ss_().getSheetByName('Auth'); const v = sh.getDataRange().getValues();
  for (let i = 1; i < v.length; i++) if (String(v[i][0]).toLowerCase() === email) { sh.getRange(i + 1, 2, 1, 2).setValues([[salt, hash]]); return code.slice(0, 4) + '-' + code.slice(4); }
  sh.appendRow([email, salt, hash, '']); return code.slice(0, 4) + '-' + code.slice(4);
}
function writeMapping_(c) {
  const sh = ss_().getSheetByName('POC Mapping'); if (!sh) return;
  const P = c.people || {}; const nm = es => (es || []).map(e => (P[e] || {}).name || e).join(', ');
  const rows = [];
  (c.regions || []).forEach(g => (g.dcs || []).forEach(dc => { const l1 = (c.l1 || {})[dc] || []; rows.push([g.name, dc, nm(l1) || '(none)', l1.join(', '), nm(g.l2), (g.l2 || []).join(', '), (c.autoPlaced || []).indexOf(dc) >= 0 ? 'Yes' : '']); }));
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 7).clearContent();
  if (rows.length) sh.getRange(2, 1, rows.length, 7).setValues(rows);
}
function newCode_(r, me) {
  admin_(me); const email = String(r.email || '').toLowerCase();
  if (!cfg_().people[email]) throw err_('not_found', 'Add this person to the mapping first.');
  return lock_(() => {
    const code = setCode_(email);
    // end that person's open sessions
    const p = PropertiesService.getScriptProperties(); const all = p.getProperties();
    Object.keys(all).forEach(k => { if (k.indexOf('sess:') === 0) { try { if (JSON.parse(all[k]).email === email) p.deleteProperty(k); } catch (e) {} } });
    return { code: code };
  });
}

// ---------------------------------------------------------------- base file upload
function uploadBase_(r, me) {
  admin_(me);
  if (!r.data || !r.suggestions) throw err_('bad_request', 'Missing data.');
  return lock_(() => {
    const stamp = r.baseDate || Utilities.formatDate(new Date(), 'Asia/Kolkata', 'yyyy-MM-dd');
    const c = cfg_();
    const side = r.side === 'rev' || r.data.side === 'rev' ? 'rev' : 'fwd'; const K = sideKeys_(side);
    (r.suggestions.tasks || []).forEach(t => t.baseDate = stamp);
    const rec = reconcile_(r.awbs, r.suggestions, stamp, c, side);
    writeJsonFile_(K.DATA, K.pfx + 'data_' + stamp + '.json', r.data);
    writeJsonFile_(K.SUG, K.pfx + 'suggestions_' + stamp + '.json', r.suggestions);
    if (r.awbs) writeJsonFile_(K.AWB, K.pfx + 'awbs_' + stamp + '.json', r.awbs);
    if (r.snap) saveSnap_(c, side, r.snap, stamp);
    if (r.closure) writeJsonFile_(side === 'rev' ? 'REV_CLOSE_FILE' : 'CLOSE_FILE', K.pfx + 'closure_' + stamp + '.json', r.closure);
    const b = { side: side, prodInline: !!(r.awbs && r.awbs.cols && r.awbs.cols.pdc), asOf: r.asOf || '', baseDate: stamp, fileName: r.fileName || '', uploadedAt: new Date().toISOString(), uploadedBy: me.email, awbs: r.data.total - r.data.excludedNA - (r.data.otherReasons || 0), suggestions: r.suggestions.tasks.length, reconcile: rec };
    c[K.base] = b;
    saveCfg_(c);
    ss_().getSheetByName('Base Uploads').appendRow([b.uploadedAt, stamp, b.fileName, b.awbs, r.data.excludedNA, b.suggestions, me.email, side === 'rev' ? 'Reverse' : 'Forward']);
    return { base: b, reconcile: rec, side: side };
  });
}

// Compare assigned tasks with the new base, then fold in today's suggestions.
// An AWB is still pending only if the new base has it under the same pivot and the same current location.
// Open tasks with no pending AWBs left are closed as "cleared from pendency"; HOV and RTO-queued suggestions are assigned automatically.
function reconcile_(A, sug, stamp, c, side) {
  side = side || 'fwd';
  const sum = { carried: 0, cleared: 0, autoAssigned: 0, merged: 0, added: 0 };
  const keyOf = id => String(id).replace(/-\d{4}-\d{2}-\d{2}$/, '');
  const pos = {};
  if (A && A.cols) { const C = A.cols, D = A.dims; for (let i = 0; i < C.awb.length; i++) pos[C.awb[i]] = [D.pivot[C.p[i]], D.loc[C.l[i]], C.pv[i] || 0]; }
  const PIV = { 'At Dock': 'At Dock', 'Received at DC': 'RECEIVED_AT_DC', 'Picked from Client': 'Picked_From_Client', 'BRSNR': 'BRSNR', 'Rev At Dock': 'At Dock', 'Rev Received at DC': 'RECEIVED_AT_DC', 'Rev BRSNR': 'BRSNR' };
  const store = awbStore_(); const tasks = taskRows_().map(x => x.t); const now = new Date().toISOString();
  const byId = {}; tasks.forEach(t => byId[t.id] = t);
  const openByKey = {}; const clearedNow = [];
  if (A && A.cols) tasks.forEach(t => {
    if (t.kind === 'custom' || !t.loc || sideOfTask_(t) !== side) return;
    const list = taskAwbList_(t.id, store); if (!list.length) return;
    const pv = PIV[t.pivot || 'At Dock'] || t.pivot;
    const rem = list.filter(a => { const p = pos[a.awb]; return p && p[0] === pv && p[1] === t.loc; });
    const prev = t.pending == null ? list.length : t.pending;
    t.total = list.length; t.pending = rem.length; t.pendingValue = rem.reduce((s, a) => s + pos[a.awb][2], 0); t.lastSeenBase = stamp;
    if (t.status === 'Closed') return;
    if (!rem.length) {
      t.status = 'Closed'; t.closedAt = now; t.closedBy = 'auto'; t.lastUpdateAt = now; t.lastUpdateBy = 'Auto (base ' + stamp + ')';
      t.history = (t.history || []).concat([{ type: 'cleared', at: now, base: stamp, cleared: prev }]);
      sum.cleared++; clearedNow.push(t);
    } else {
      if (rem.length !== prev) t.history = (t.history || []).concat([{ type: 'carried', at: now, base: stamp, pending: rem.length, cleared: Math.max(prev - rem.length, 0) }]);
      sum.carried++; openByKey[keyOf(t.id)] = t;
    }
  });
  const created = [];
  const openAwb = openAwbMap_(tasks, store);   // an AWB in an open task can't go into another task
  sum.leftOut = 0;
  sug.tasks.forEach(s => {
    const open = openByKey[keyOf(s.id)];
    if (open) {
      const list = taskAwbList_(open.id, store); const have = {}; list.forEach(a => have[a.awb] = 1);
      const c0 = cls_(s); const add = (s.awbs || []).filter(a => !have[a.awb] && (!openAwb[c0 + a.awb] || openAwb[c0 + a.awb] === open.id));
      add.forEach(a => openAwb[c0 + a.awb] = open.id);
      if (add.length) {
        store[open.id] = list.concat(add); open.total = store[open.id].length; open.n = open.total;
        open.pending = (open.pending || 0) + add.length; open.pendingValue = (open.pendingValue || 0) + add.reduce((x, a) => x + (a.pv || 0), 0);
        open.value = store[open.id].reduce((x, a) => x + (a.pv || 0), 0);
        open.history = (open.history || []).concat([{ type: 'added', at: now, base: stamp, added: add.length }]); sum.added += add.length;
      }
      s.id = open.id; sum.merged++; return;
    }
    const c1 = cls_(s); const free = (s.awbs || []).filter(a => !openAwb[c1 + a.awb]);
    const coveredBy = {}; (s.awbs || []).forEach(a => { if (openAwb[c1 + a.awb]) coveredBy[openAwb[c1 + a.awb]] = 1; });
    s.overlap = (s.awbs || []).length - free.length; s.coveredBy = Object.keys(coveredBy).slice(0, 10);
    if ((s.kind === 'hov' || s.kind === 'rto') && !byId[s.id]) {
      if (!free.length) return;
      sum.leftOut += s.overlap;
      store[s.id] = free; free.forEach(a => openAwb[c1 + a.awb] = s.id);
      const t = Object.assign({}, s); delete t.awbs; delete t.overlap; delete t.coveredBy; t.manifests = (t.manifests || []).slice(0, 8);
      if (free.length !== s.awbs.length) { t.title = retitle_(t.title, s.awbs.length, free.length); t.n = free.length; t.value = free.reduce((x, a) => x + (a.pv || 0), 0); }
      Object.assign(t, { pocRegion: pocReg_(t, c), baseDate: stamp, assignedAt: now, assignedBy: 'auto', status: 'Open', updates: [], lastUpdateAt: null, closedAt: null, total: free.length, pending: free.length, pendingValue: free.reduce((x, a) => x + (a.pv || 0), 0), lastSeenBase: stamp });
      t.history = [{ type: 'assigned', at: now, by: 'auto', auto: true, to: owners_(t, c) }];
      created.push(t); byId[t.id] = t; sum.autoAssigned++;
    }
  });
  const all = tasks.concat(created);
  all.forEach(t => { if (t.history && t.history.length > 60) t.history = t.history.slice(-60); });
  saveAwbStore_(store);
  rewriteTasks_(all, c);
  if (clearedNow.length) {
    const rows = clearedNow.map(t => [now, t.id, pocReg_(t, c), t.loc || '', KIND_LABEL[t.kind] || t.kind, t.prio || '', t.title || '', 'Auto', '', 'Closed', 'Cleared from pendency in base ' + stamp + ' (no AWBs left at ' + t.loc + ')', '', '']);
    const u = ss_().getSheetByName('Updates'); u.getRange(u.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
  }
  return sum;
}

// ---------------------------------------------------------------- reassign
function reassign_(r, me) {
  const c = cfg_();
  const to = (r.to || []).map(e => String(e).trim().toLowerCase()).filter((e, i, a) => (c.people || {})[e] && a.indexOf(e) === i);
  if (!to.length) throw err_('bad_request', 'Choose who to reassign this task to.');
  return lock_(() => {
    const x = taskRows_().find(x => x.t.id === r.id);
    if (!x || !sees_(x.t, me, c)) throw err_('not_found', 'Task not found.');
    const t = x.t; const from = owners_(t, c); const now = new Date().toISOString(); const note = String(r.note || '').slice(0, 1000);
    t.assignees = to;
    t.history = (t.history || []).concat([{ type: 'reassigned', at: now, by: me.email, from: from, to: to, note: note }]);
    t.lastUpdateAt = now; t.lastUpdateBy = me.email;
    writeTask_(t, x.row, c);
    const nm = e => ((c.people || {})[e] || {}).name || e;
    ss_().getSheetByName('Updates').appendRow([now, t.id, pocReg_(t, c), t.loc || 'All DCs', KIND_LABEL[t.kind] || t.kind, t.prio || '', t.title || '', me.name, me.email, 'Reassigned', 'From ' + from.map(nm).join(', ') + ' to ' + to.map(nm).join(', ') + (note ? '. ' + note : ''), '', '']);
    return { tasks: visibleTasks_(me, c) };
  });
}

// ---------------------------------------------------------------- cell drill-down (double-click on a pivot number)
function cell_(r, me) {
  const c = cfg_();
  if (!me.admin && me.dcs.indexOf(r.loc) < 0) throw err_('forbidden', 'This DC is outside your view.');
  const side = r.side === 'rev' ? 'rev' : 'fwd'; const K = sideKeys_(side);
  const A = readJsonFile_(K.AWB);
  if (!A) return { n: 0, value: 0, hov: 0, hovValue: 0, held: 0, assigned: 0, dests: [], rows: [], tasks: [], missing: true };
  const D = A.dims, C = A.cols;
  const pi = D.pivot.indexOf(r.pivot), li = D.loc.indexOf(r.loc);
  const holdSet = (r.hold || []).length ? r.hold.map(h => D.hold.indexOf(h)) : null;
  const want = {}; let plus = false; (r.ages || []).forEach(k => { if (k === '21+') plus = true; else want[+k] = 1; });
  // extra filters from the top bar (names or 0/1) and the drop-down path the number sits under
  const f = r.f || {}, sub = r.sub || {}; const conds = [];
  const named = (field, vals) => { if (!C[field] || !D[field]) return; const set = {}; vals.forEach(v => { const k = D[field].indexOf(v); set[k] = 1; }); conds.push(i => set[C[field][i]] === 1); };
  ['vol', 'mp', 'rq'].forEach(k => { if ((f[k] || []).length && C[k]) { const set = {}; f[k].forEach(v => set[+v] = 1); conds.push(i => set[C[k][i]] === 1); } });
  if ((f.pvf || []).length) { const set = {}; f.pvf.forEach(v => set[+v] = 1); conds.push(i => set[C.hov[i] ? 1 : 0] === 1); }
  Object.keys(f).forEach(k => { if (k === 'vol' || k === 'mp' || k === 'rq' || k === 'pvf' || !(f[k] || []).length || !D[k] || !C[k]) return; if ((k === 'bin' || k === 'msg') && (side === 'rev' || r.pivot !== 'RECEIVED_AT_DC')) return; named(k, f[k]); });
  Object.keys(sub).forEach(k => { const v = sub[k];
    if (k === 'md') { const m = D.md.indexOf(v); conds.push(i => C.md[i] === m); }
    else if (k === 'vol' || k === 'mp' || k === 'rq') { conds.push(i => (C[k] ? C[k][i] : 0) === +v); }
    else if (k === 'pvf') { conds.push(i => (C.hov[i] ? 1 : 0) === +v); }
    else if (k === 'hold') { const h = D.hold.indexOf(v); conds.push(i => C.h[i] === h); }
    else if (D[k] && C[k]) named(k, [v]); });
  const idx = [];
  for (let i = 0; i < C.awb.length; i++) {
    if (C.p[i] !== pi || C.l[i] !== li) continue;
    const a = C.a[i]; if (!(want[a] || (plus && a >= 21))) continue;
    if (holdSet && holdSet.indexOf(C.h[i]) < 0) continue;
    if (r.hovOnly && !C.hov[i]) continue;
    let ok = true; for (let q = 0; q < conds.length; q++) if (!conds[q](i)) { ok = false; break; } if (!ok) continue;
    idx.push(i);
  }
  const tasks = visibleTasks_(me, c).filter(t => t.loc === r.loc);
  const awbTask = {}; const store = awbStore_();
  tasks.forEach(t => taskAwbList_(t.id, store).forEach(a => { const k = a.awb || a; if (!awbTask[k] || t.status !== 'Closed') awbTask[k] = t.id; }));
  const nm = (k, i) => (D[k] && C[k] && C[k][i] >= 0) ? D[k][C[k][i]] : '';
  const pfc = r.pivot === 'Picked_From_Client';
  const hHold = D.hold.indexOf('Hold'); const byDest = {}; const tCount = {}; const mcs = {};
  let value = 0, hov = 0, hovV = 0, held = 0, assigned = 0;
  idx.forEach(i => {
    const d = pfc ? (nm('cl', i) || '(blank)') + '\u0001' + (nm('se', i) || '(no seller name)') : (D.md[C.md[i]] || '(blank)');
    const o = byDest[d] || (byDest[d] = { dest: d, n: 0, value: 0, assigned: 0, mc: {} });
    o.n++; o.value += C.pv[i]; o.mc[C.mc[i]] = 1; value += C.pv[i];
    const m = C.mc[i] || '(no manifest)'; const mo = mcs[m] || (mcs[m] = { mc: m, n: 0, md: D.md[C.md[i]] || '', esl: nm('esl', i), esd: nm('esd', i), assigned: 0 }); mo.n++;
    if (C.hov[i]) { hov++; hovV += C.pv[i]; } if (C.h[i] === hHold) held++;
    const tid = awbTask[C.awb[i]]; if (tid) { assigned++; o.assigned++; mo.assigned++; tCount[tid] = (tCount[tid] || 0) + 1; }
  });
  const dests = Object.keys(byDest).map(k => { const o = byDest[k]; o.manifests = Object.keys(o.mc).length; delete o.mc; if (pfc) { const p = k.split('\u0001'); o.client = p[0]; o.seller = p[1]; o.dest = p[0]; } return o; }).sort((a, b) => b.n - a.n);
  const manifests = Object.keys(mcs).map(k => mcs[k]).sort((a, b) => b.n - a.n);
  const rows = idx.slice().sort((a, b) => C.pv[b] - C.pv[a]).slice(0, 500).map(i => ({ awb: C.awb[i], age: C.a[i], md: D.md[C.md[i]], mc: C.mc[i], pv: C.pv[i], hov: !!C.hov[i], hold: D.hold[C.h[i]], task: awbTask[C.awb[i]] || null, cl: nm('cl', i), se: nm('se', i), esl: nm('esl', i), esd: nm('esd', i), srca: nm('srca', i), pdc: nm('pdc', i), pcat: nm('pcat', i), psub: nm('psub', i) }));
  if (rows.some(x => x.hov && !x.pdc && !x.pcat)) { const P = readJsonFile_(side === 'rev' ? 'REV_PROD_FILE' : 'PROD_FILE'); if (P && P.map && P.baseAt === ((c[K.base] || {}).uploadedAt)) rows.forEach(x => { const m = P.map[x.awb]; if (m && !x.pdc && !x.pcat) { x.pdc = m[0] || ''; x.pcat = m[1] || ''; x.psub = m[2] || ''; } }); }
  const tl = tasks.filter(t => tCount[t.id]).map(t => ({ id: t.id, title: t.title, status: t.status, prio: t.prio, kind: t.kind, matched: tCount[t.id], owners: owners_(t, c) }));
  if (r.allAwbs) return { awbs: idx.slice(0, 2000).map(i => C.awb[i]) };
  return { n: idx.length, value: value, hov: hov, hovValue: hovV, held: held, assigned: assigned, dests: dests, rows: rows, tasks: tl, truncated: idx.length > 500, pfc: pfc, manifests: manifests.slice(0, 8), manifestCount: manifests.length, baseAt: (c[K.base] && c[K.base].uploadedAt) || '', baseAsOf: A.asOf || '', side: side };
}

// ---------------------------------------------------------------- raw base file (gzip CSV in ~8 MB parts) for "Download base file"
function rawPart_(r, me) {
  admin_(me);
  if (!r.uploadId || r.idx == null || !r.b64) throw err_('bad_request', 'Missing part.');
  const side = r.side === 'rev' ? 'rev' : 'fwd';
  const blob = Utilities.newBlob(Utilities.base64Decode(r.b64), 'application/gzip', (side === 'rev' ? 'reverse' : 'forward') + '_raw_' + r.uploadId + '_' + r.idx + '.part');
  const f = subfolder_('Raw base files').createFile(blob);
  PropertiesService.getScriptProperties().setProperty('rawp:' + r.uploadId + ':' + r.idx, f.getId());
  return { ok: true, idx: r.idx };
}
function rawDone_(r, me) {
  admin_(me);
  const side = r.side === 'rev' ? 'rev' : 'fwd'; const P = PropertiesService.getScriptProperties();
  const ids = []; for (let i = 0; i < (r.n || 0); i++) { const k = 'rawp:' + r.uploadId + ':' + i; const id = P.getProperty(k); if (!id) throw err_('bad_request', 'Part ' + (i + 1) + ' is missing. Upload again.'); ids.push(id); P.deleteProperty(k); }
  return lock_(() => {
    const c = cfg_(); c.raw = c.raw || {};
    const old = c.raw[side];
    c.raw[side] = { ids: ids, name: r.name || ((side === 'rev' ? 'Reverse' : 'Forward') + '_base.csv'), size: r.size || 0, uploadedAt: new Date().toISOString(), by: me.email, asOf: r.asOf || '' };
    saveCfg_(c);
    if (old && old.ids) old.ids.forEach(id => { if (ids.indexOf(id) < 0) { try { DriveApp.getFileById(id).setTrashed(true); } catch (e) { } } });
    return { raw: { name: c.raw[side].name, size: c.raw[side].size, n: ids.length, uploadedAt: c.raw[side].uploadedAt, asOf: c.raw[side].asOf } };
  });
}
// product details for HOV AWBs of a base that was uploaded before they were saved with it: built once by an admin's browser from the stored full file
// ---------------------------------------------------------------- HOV shipment images (BigQuery -> "HOV Images" tab)
// After each base upload the HOV AWBs of that side are synced: new ones are looked up in BigQuery (sorter + Muvro images,
// last 90 days), AWBs no longer HOV in the base are removed, AWBs that had no image yet are looked up again.
const BQ_PROJECT = 'data-warehousing-391512'; // the Google Cloud project the query runs (and is billed) in
const HOV_IMG_TAB = 'HOV Images';
function hovImgSheet_() {
  const ss = ss_(); let sh = ss.getSheetByName(HOV_IMG_TAB);
  if (!sh) { sh = ss.insertSheet(HOV_IMG_TAB); sh.getRange(1, 1, 1, 6).setValues([['AWB', 'Side', 'Source', 'Image', 'Image URL', 'Checked on']]).setFontWeight('bold'); sh.setFrozenRows(1); sh.setColumnWidth(4, 140); }
  return sh;
}
function bqRows_(sql) {
  let r = BigQuery.Jobs.query({ query: sql, useLegacySql: false, timeoutMs: 120000 }, BQ_PROJECT);
  const ref = r.jobReference;
  while (!r.jobComplete) { Utilities.sleep(1500); r = BigQuery.Jobs.getQueryResults(BQ_PROJECT, ref.jobId, { location: ref.location }); }
  let rows = r.rows || [], tok = r.pageToken;
  while (tok) { const p = BigQuery.Jobs.getQueryResults(BQ_PROJECT, ref.jobId, { pageToken: tok, location: ref.location }); rows = rows.concat(p.rows || []); tok = p.pageToken; }
  return rows.map(x => x.f.map(c => c.v));
}
function hovImgQuery_(awbs) {
  const list = awbs.map(a => "'" + String(a).replace(/[^A-Za-z0-9_\-]/g, '') + "'").join(',');
  return "SELECT manifests_item.awb_number, STRING_AGG(DISTINCT ai.image_url, ' ; ') AS sorter_image, STRING_AGG(DISTINCT ai1.image_url, ' ; ') AS muvro_image\n" +
    "FROM `data-warehousing-391512.ecommerce.manifests_item` manifests_item\n" +
    "LEFT JOIN `data-warehousing-391512.ecommerce.awb_awbimages` ai ON ai.awb_number = manifests_item.dsp_awb_number AND ai.created >= CURRENT_DATE() - INTERVAL 90 DAY\n" +
    "LEFT JOIN `data-warehousing-391512.ecommerce.awb_awbimages` ai1 ON ai1.awb_number = manifests_item.awb_number AND ai1.created >= CURRENT_DATE() - INTERVAL 90 DAY\n" +
    "WHERE manifests_item.created >= CURRENT_DATE() - INTERVAL 90 DAY AND manifests_item.awb_number IN (" + list + ")\nGROUP BY manifests_item.awb_number";
}
function hovSync_(r, me) {
  admin_(me);
  const side = r.side === 'rev' ? 'rev' : 'fwd'; const SIDE = side === 'rev' ? 'Reverse' : 'Forward';
  const A = readJsonFile_(sideKeys_(side).AWB); if (!A || !A.cols) throw err_('not_found', 'No ' + SIDE.toLowerCase() + ' base uploaded yet.');
  const C = A.cols, hov = new Set(); for (let i = 0; i < C.awb.length; i++) if (C.hov[i]) hov.add(String(C.awb[i]));
  return lock_(() => {
    const sh = hovImgSheet_(); const last = sh.getLastRow();
    const vals = last > 1 ? sh.getRange(2, 1, last - 1, 6).getValues() : [];
    const urls = last > 1 ? sh.getRange(2, 4, last - 1, 1).getFormulas() : [];
    const keep = [], have = new Set(), noImg = new Set(); let removed = 0;
    vals.forEach((v, k) => {
      const awb = String(v[0]); if (!awb) return;
      if (v[1] !== SIDE) { keep.push([v[0], v[1], v[2], urls[k][0] || v[3], v[4], v[5]]); return; }
      if (!hov.has(awb)) { removed++; return; }            // closed / no longer HOV: dropped
      if (v[2] === 'No image yet') { noImg.add(awb); return; } // looked up again below
      have.add(awb); keep.push([v[0], v[1], v[2], urls[k][0] || v[3], v[4], v[5]]);
    });
    const ask = [...hov].filter(a => !have.has(a));
    const today = Utilities.formatDate(new Date(), 'Asia/Kolkata', 'dd-MM-yyyy');
    const found = {}; let images = 0;
    for (let i = 0; i < ask.length; i += 2500) {
      bqRows_(hovImgQuery_(ask.slice(i, i + 2500))).forEach(row => {
        const awb = String(row[0]); const add = (s, src) => String(s || '').split(';').map(x => x.trim()).filter(Boolean).forEach(u => { (found[awb] = found[awb] || []).push([src, u]); });
        add(row[1], 'Sorter'); add(row[2], 'Muvro');
      });
    }
    const fresh = [];
    ask.forEach(awb => {
      const L = found[awb] || [];
      if (!L.length) { fresh.push([awb, SIDE, 'No image yet', '', '', today]); return; }
      const seen = new Set(); L.forEach(([src, u]) => { if (seen.has(u)) return; seen.add(u); images++; fresh.push([awb, SIDE, src, '=IMAGE("' + u.replace(/"/g, '%22') + '")', u, today]); });
    });
    const out = keep.concat(fresh);
    if (last > 1) sh.getRange(2, 1, last - 1, 6).clearContent();
    if (out.length) { sh.getRange(2, 1, out.length, 6).setValues(out); sh.setRowHeights(2, out.length, 64); }
    if (sh.getMaxRows() > out.length + 50) sh.deleteRows(out.length + 52, sh.getMaxRows() - out.length - 51);
    CacheService.getScriptCache().remove('hovimg:n');
    return { side: side, hovAwbs: hov.size, lookedUp: ask.length, newImages: images, withImages: Object.keys(found).length, removed: removed, rows: out.length };
  });
}
// images for the AWBs shown in a details pop-up: { awb: [{src, url}] }
function hovImages_(r, me) {
  let map = cacheGet_('hovimg');
  if (!map) {
    map = {}; const sh = ss_().getSheetByName(HOV_IMG_TAB);
    if (sh && sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 5).getValues().forEach(v => { if (v[4]) (map[String(v[0])] = map[String(v[0])] || []).push([v[2], v[4]]); });
    cachePut_('hovimg', map, 21600);
  }
  const out = {}; (r.awbs || []).slice(0, 600).forEach(a => { if (map[a]) out[a] = map[a].map(x => ({ src: x[0], url: x[1] })); });
  return { img: out };
}

// ---------------------------------------------------------------- closures (yesterday's base vs today's)
// the latest and the previous snapshot of AWBs aged 3–20 per side; a same-day re-upload is compared with the day before
function snapKeys_(side) { return side === 'rev' ? ['REV_SNAP_FILE', 'REV_SNAP_PREV_FILE'] : ['SNAP_FILE', 'SNAP_PREV_FILE']; }
function saveSnap_(c, side, snap, stamp) {
  const K = snapKeys_(side), P = PropertiesService.getScriptProperties(); c.snap = c.snap || {}; const s = c.snap[side] || {};
  const cur = P.getProperty(K[0]);
  if (cur && s.asOf && s.asOf !== snap.asOf) { const old = P.getProperty(K[1]); P.setProperty(K[1], cur); if (old) { try { DriveApp.getFileById(old).setTrashed(true); } catch (e) { } } s.prevAsOf = s.asOf; }
  else if (cur) { try { DriveApp.getFileById(cur).setTrashed(true); } catch (e) { } }
  const f = folder_().createFile((side === 'rev' ? 'rev_' : '') + 'closure_snapshot_' + stamp + '.json', JSON.stringify(snap), 'application/json');
  P.setProperty(K[0], f.getId()); s.asOf = snap.asOf; c.snap[side] = s;
}
function snapGet_(r, me) {
  admin_(me); const side = r.side === 'rev' ? 'rev' : 'fwd'; const K = snapKeys_(side); const s = (cfg_().snap || {})[side] || {};
  if (s.asOf && s.asOf !== r.asOf) return { snap: readJsonFile_(K[0]) };
  if (s.prevAsOf && s.prevAsOf !== r.asOf) return { snap: readJsonFile_(K[1]) };
  return { snap: null };
}
function closurePut_(r, me) { admin_(me); const side = r.side === 'rev' ? 'rev' : 'fwd'; if (!r.closure || !r.closure.views) throw err_('bad_request', 'Nothing to save.'); writeJsonFile_(side === 'rev' ? 'REV_CLOSE_FILE' : 'CLOSE_FILE', (side === 'rev' ? 'rev_' : '') + 'closure_' + String(r.closure.to || '').replace(/\W/g, '') + '.json', r.closure); return { ok: true }; }
function closures_(r, me) { return { fwd: readJsonFile_('CLOSE_FILE'), rev: readJsonFile_('REV_CLOSE_FILE') }; }
// a task straight from a pivot number: the AWBs behind that number go to the DC's mapped POC
function cellTask_(r, me) {
  const c = cfg_(); const cell = r.cell || {}; const loc = cell.loc;
  const g = (c.regions || []).find(x => (x.dcs || []).indexOf(loc) >= 0); const region = g ? g.name : '';
  if (!me.admin && !(region && me.l2.indexOf(region) >= 0)) throw err_('forbidden', 'Only the central team and the region\'s L2 can assign tasks here.');
  if (!String(r.title || '').trim()) throw err_('bad_request', 'Write what the DC should do.');
  if (!region) throw err_('bad_request', loc + ' is not mapped to a region yet. Map it in POC mapping first.');
  const res = cell_(Object.assign({}, cell, { allAwbs: true }), me);
  const out = createCustom_({ title: r.title, details: r.details || '', pivot: r.pivot || 'Other', region: region, loc: loc, prio: r.prio || 'P1', awbs: res.awbs || [] }, Object.assign({}, me, { admin: true }));
  return { leftOut: out.leftOut, n: (res.awbs || []).length, tasks: visibleTasks_(me, cfg_()) };
}
function prodPut_(r, me) {
  admin_(me);
  const side = r.side === 'rev' ? 'rev' : 'fwd'; const K = sideKeys_(side);
  return lock_(() => {
    const c = cfg_(); const b = c[K.base]; if (!b) throw err_('not_found', 'No base uploaded.');
    if (r.baseAt && r.baseAt !== b.uploadedAt) throw err_('stale', 'A newer base was uploaded meanwhile.');
    const map = r.map || {};
    writeJsonFile_(side === 'rev' ? 'REV_PROD_FILE' : 'PROD_FILE', K.pfx + 'products_' + b.baseDate + '.json', { baseAt: b.uploadedAt, map: map });
    c.prod = c.prod || {}; c.prod[side] = { baseAt: b.uploadedAt, n: Object.keys(map).length, at: new Date().toISOString() }; saveCfg_(c);
    return { ok: true, n: c.prod[side].n };
  });
}
function rawGet_(r, me) {
  const side = r.side === 'rev' ? 'rev' : 'fwd'; const x = (cfg_().raw || {})[side];
  if (!x || !x.ids || !x.ids.length) throw err_('not_found', 'No base file has been uploaded for ' + (side === 'rev' ? 'reverse' : 'forward') + ' yet.');
  const i = Math.max(0, Math.min(+r.idx || 0, x.ids.length - 1));
  return { b64: Utilities.base64Encode(DriveApp.getFileById(x.ids[i]).getBlob().getBytes()), idx: i, n: x.ids.length, name: x.name, size: x.size };
}

// ---------------------------------------------------------------- linked report sheets (DC processing volumes, closure tracker)
const PROC_SHEET_ID = '15TK7pDY8qao8cZRurBfVwGOmZ7yTmmpA7zvGwGLIQiA';    // DC Processing Volumes – Daily (FWD & REV)
const CLOSURE_SHEET_ID = '11P90GQb7uDARNuSCXB-ypvMHiiKrpKDX88nL2k1SVXw'; // Fwd & Rev Closure Tracker
const MON_ = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
function num_(v) { if (typeof v === 'number') return v; const n = parseFloat(String(v == null ? '' : v).replace(/[,%\s₹]/g, '')); return isFinite(n) ? n : 0; }
function isoDay_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, 'Asia/Kolkata', 'yyyy-MM-dd');
  const m = String(v || '').trim().match(/^(\d{1,2})[-\s]([A-Za-z]{3})[A-Za-z]*[-\s](\d{2,4})$/); if (!m) return '';
  let y = +m[3]; if (y < 100) y += 2000; const p = n => (n < 10 ? '0' : '') + n;
  return y + '-' + p(MON_[m[2].toLowerCase()] || 0) + '-' + p(+m[1]);
}
function readProc_() {
  const ss = SpreadsheetApp.openById(PROC_SHEET_ID); const out = {};
  [['fwd', 'Forward'], ['rev', 'Reverse']].forEach(([k, name]) => {
    const sh = ss.getSheetByName(name); if (!sh) { out[k] = { dates: [], rows: [] }; return; }
    const v = sh.getDataRange().getDisplayValues(); const h = v[0] || [];
    const cols = []; const dates = []; for (let j = 2; j < h.length; j++) { const d = isoDay_(h[j]); if (d) { cols.push(j); dates.push(d); } }
    const rows = [];
    for (let i = 1; i < v.length; i++) { const dc = String(v[i][0] || '').trim(); if (!dc || /^network total$/i.test(dc)) continue; rows.push([dc, String(v[i][1] || '').trim() || 'Unmapped', cols.map(j => num_(v[i][j]))]); }
    out[k] = { dates: dates, rows: rows };
  });
  return out;
}
function readClosure_() {
  const sh = SpreadsheetApp.openById(CLOSURE_SHEET_ID).getSheetByName('Daily Log'); if (!sh) return { dates: [], views: [], sites: [], rows: [] };
  const v = sh.getDataRange().getDisplayValues(); const h = v[0].map(x => String(x).trim().toLowerCase());
  const ix = n => h.indexOf(n); const cD = ix('date'), cV = ix('view'), cS = ix('site'), cC = ix('closed'), cT = ix('total');
  const D = {}, V = {}, S = {}; const dates = [], views = [], sites = []; const rows = [];
  const id = (m, a, k) => { if (!(k in m)) { m[k] = a.length; a.push(k); } return m[k]; };
  for (let i = 1; i < v.length; i++) {
    const d = isoDay_(v[i][cD]); const vw = String(v[i][cV] || '').trim(); const st = String(v[i][cS] || '').trim(); if (!d || !vw || !st) continue;
    rows.push([id(D, dates, d), id(V, views, vw), id(S, sites, st), num_(v[i][cC]), num_(v[i][cT])]);
  }
  return { dates: dates, views: views, sites: sites, rows: rows };
}
function cacheGet_(k) {
  try { const c = CacheService.getScriptCache(); const n = +c.get(k + ':n'); if (!n) return null; const keys = []; for (let i = 0; i < n; i++) keys.push(k + ':' + i);
    const m = c.getAll(keys); let s = ''; for (let i = 0; i < n; i++) { if (m[k + ':' + i] == null) return null; s += m[k + ':' + i]; } return JSON.parse(s); } catch (e) { return null; }
}
function cachePut_(k, obj, sec) {
  try { const s = JSON.stringify(obj); const parts = {}; let n = 0; for (let i = 0; i < s.length; i += 90000) parts[k + ':' + (n++)] = s.slice(i, i + 90000);
    parts[k + ':n'] = String(n); CacheService.getScriptCache().putAll(parts, sec); } catch (e) {}
}
function reports_(r, me) {
  let out = r.fresh ? null : cacheGet_('reports_v1');
  if (!out) {
    out = { fetchedAt: new Date().toISOString(), errors: [] };
    try { out.proc = readProc_(); } catch (e) { out.proc = null; out.errors.push('DC processing sheet: ' + e.message); }
    try { out.closure = readClosure_(); } catch (e) { out.closure = null; out.errors.push('Closure tracker sheet: ' + e.message); }
    if (!out.errors.length) cachePut_('reports_v1', out, 900);
  }
  return out; // network-wide for everyone signed in: every POC sees all regions and DCs in these report tabs
}

// ---------------------------------------------------------------- floor trends sheet (one trend table per tab)
const FLOOR_SHEET_ID = '1AT2K217lUHCKu-JdGwE2nbr7v6xzpWdDfy1OlQpysFQ'; // FLOOR TRENDS
function floor_(r, me) {
  let out = r.fresh ? null : cacheGet_('floor_v1');
  if (!out) {
    out = { fetchedAt: new Date().toISOString(), tabs: [], errors: [] };
    try {
      SpreadsheetApp.openById(FLOOR_SHEET_ID).getSheets().forEach(sh => {
        if (sh.isSheetHidden()) return; // hidden tabs are old or one-off views
        const v = sh.getDataRange().getDisplayValues().slice(0, 400).map(row => { let n = row.length; while (n > 0 && row[n - 1] === '') n--; return row.slice(0, n); });
        out.tabs.push({ name: sh.getName(), values: v });
      });
    } catch (e) { out.errors.push('Floor trends sheet: ' + e.message); }
    if (!out.errors.length) cachePut_('floor_v1', out, 900);
  }
  return out; // network-wide for everyone signed in
}
