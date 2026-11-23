// ============================================================
//  طبقة البيانات: Firebase (التشغيل الفعلي) أو وضع تجريبي محلي
// ============================================================
const FB_VER = "10.12.2";

export const DEFAULTS = {
  branches: [
    { id: "sky", name: "سكاي مول", region: "الرياض" },
    { id: "waha", name: "الواحة", region: "الرياض" },
    { id: "mansoura", name: "المنصورة", region: "الرياض" },
    { id: "qassim1", name: "القصيم – الفرع الأول", region: "القصيم" },
    { id: "qassim2", name: "القصيم – الفرع الثاني", region: "القصيم" },
    { id: "dammam", name: "الدمام", region: "الدمام" },
    { id: "hail", name: "حائل", region: "حائل" }
  ],
  // code = رمز القسم في النظام ، sys = عدد الموظفين المسجلين في النظام (من صور النظام)
  departments: [
    ["37","القسم التقني",7],["2","قسم ادارة البيانات",15],["801","قسم الأجهزة الكهربائية",2],
    ["10","قسم الاجبان",53],["39","قسم الاجبان",2],["323","قسم الادارة",35],["53","قسم الادارة",21],
    ["3","قسم الادارة المالية",1],["1","قسم الادخال",47],["627","قسم الادوات المدرسية والمكتبية + الالعاب",11],
    ["25","قسم الاسماك",38],["14","قسم الالعاب",0],["22","قسم الاواني المنزلية",15],["29","قسم الايسكريم",7],
    ["17","قسم البطاطس",10],["21","قسم البلاستيك",7],["4","قسم الحسابات",38],["7","قسم الحلويات",85],
    ["632","قسم الحليبات",8],["9","قسم الخضار",162],["630","قسم الدعم الفني والصيانة",16],["18","قسم الدواجن",17],
    ["40","قسم السواقين",18],["619","قسم السواقيين",5],["26","قسم الشاميات",7],["16","قسم الشاي والقهوة",9],
    ["31","قسم الشعبيات",12],["27","قسم الصالة",275],["34","قسم العصير الطازج",3],["11","قسم العضوي",11],
    ["19","قسم العطارة",36],["12","قسم الغذائية",121],["6","قسم الفرش",24],["36","قسم الكاميرات",13],
    ["13","قسم الكماليات",53],["28","قسم الكواشير ( المبيعات )",191],["8","قسم المجمدات",31],["32","قسم المحمصة",10],
    ["23","قسم المخبز",91],["41","قسم المستودع",92],["30","قسم المشتريات",26],["15","قسم المشروبات",46],
    ["33","قسم المكينة",7],["24","قسم الملحمة",40],["20","قسم المنظفات",49],["35","قسم مقطع وجاهز",1],["38","مستودع 901",5]
  ].map(([code, name, sys]) => ({ code, name, sys })),
  roles: ["مشرف","مساعد مشرف","كاشير","مكيّس","بائع","منظم رفوف","موظف مرتجعات","موظف أمانات","موظف بوابة",
    "أمين مستودع","عامل مستودع","مدخل بيانات","محاسب","إداري","مشتريات","سائق","فني صيانة","فني كاميرات",
    "جزار","خباز","حلواني","طباخ / معد طعام","عامل تقطيع وتجهيز","محمصاتي","عامل نظافة","حارس أمن","عامل"],
  statuses: ["على رأس العمل","تحت التجربة","إجازة","منقطع عن العمل","موقوف","منقول لقسم أو فرع آخر","أخرى"],
  nationalities: ["سعودي","مصري","يمني","سوداني","أردني","سوري","فلسطيني","باكستاني","هندي","بنغلاديشي",
    "نيبالي","فلبيني","إندونيسي","سريلانكي","إثيوبي","أخرى"],
  deadlines: {} // branchId -> ISO
};

export function mergeConfig(c) {
  const d = structuredClone(DEFAULTS);
  if (!c) return d;
  for (const k of Object.keys(d)) if (c[k] !== undefined && c[k] !== null) d[k] = c[k];
  return d;
}

const cfg = window.APP_CONFIG || {};
export const isDemo = new URLSearchParams(location.search).has("demo") || !(cfg.firebase && cfg.firebase.apiKey);

// ---------------- Demo backend (localStorage) ----------------
function lsGet(k, def) { try { return JSON.parse(localStorage.getItem(k)) ?? def; } catch { return def; } }
function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
const demo = {
  mode: "demo",
  async getConfig() { return mergeConfig(lsGet("rr_config", null)); },
  async saveConfig(c) { lsSet("rr_config", c); },
  async getInvite(t) { return lsGet("rr_invites", {})[t] || null; },
  async listInvites() { return Object.values(lsGet("rr_invites", {})); },
  async saveInvite(inv) { const m = lsGet("rr_invites", {}); m[inv.token] = inv; lsSet("rr_invites", m); },
  async saveInvites(list) { const m = lsGet("rr_invites", {}); list.forEach(i => m[i.token] = i); lsSet("rr_invites", m); },
  async deleteInvite(t) { const m = lsGet("rr_invites", {}); delete m[t]; lsSet("rr_invites", m); },
  async getSub(t) { return lsGet("rr_subs", {})[t] || null; },
  async saveSub(t, s) { const m = lsGet("rr_subs", {}); m[t] = s; lsSet("rr_subs", m); },
  async listSubs() { return Object.values(lsGet("rr_subs", {})); },
  async deleteSub(t) { const m = lsGet("rr_subs", {}); delete m[t]; lsSet("rr_subs", m); },
  async getReg(c) { return lsGet("rr_regs", {})[c] || null; },
  async listRegs() { return Object.values(lsGet("rr_regs", {})); },
  async saveRegs(list) { const m = lsGet("rr_regs", {}); list.forEach(r => m[r.code] = r); lsSet("rr_regs", m); },
  async deleteReg(c) { const m = lsGet("rr_regs", {}); delete m[c]; lsSet("rr_regs", m); },
  onAuth(cb) { cb({ email: "demo@local", displayName: "وضع تجريبي" }); },
  async signIn() {}, async signOut() {},
  isAdminEmail() { return true; }
};

// ---------------- Firebase backend ----------------
async function firebaseBackend() {
  const base = `https://www.gstatic.com/firebasejs/${FB_VER}/`;
  const { initializeApp } = await import(base + "firebase-app.js");
  const fs = await import(base + "firebase-firestore.js");
  const au = await import(base + "firebase-auth.js");
  const app = initializeApp(cfg.firebase);
  const db = fs.getFirestore(app);
  const auth = au.getAuth(app);
  const D = (c, id) => fs.doc(db, c, id);
  const all = async c => (await fs.getDocs(fs.collection(db, c))).docs.map(x => x.data());
  const admins = (cfg.adminEmails || []).map(e => e.toLowerCase().trim());
  return {
    mode: "firebase",
    async getConfig() { const s = await fs.getDoc(D("config", "settings")); return mergeConfig(s.exists() ? s.data() : null); },
    async saveConfig(c) { await fs.setDoc(D("config", "settings"), c); },
    async getInvite(t) { const s = await fs.getDoc(D("invites", t)); return s.exists() ? s.data() : null; },
    async listInvites() { return all("invites"); },
    async saveInvite(inv) { await fs.setDoc(D("invites", inv.token), inv); },
    async saveInvites(list) {
      for (let i = 0; i < list.length; i += 400) {
        const b = fs.writeBatch(db);
        list.slice(i, i + 400).forEach(inv => b.set(D("invites", inv.token), inv));
        await b.commit();
      }
    },
    async deleteInvite(t) { await fs.deleteDoc(D("invites", t)); },
    async getSub(t) { const s = await fs.getDoc(D("subs", t)); return s.exists() ? s.data() : null; },
    async saveSub(t, s) { await fs.setDoc(D("subs", t), s); },
    async listSubs() { return all("subs"); },
    async deleteSub(t) { await fs.deleteDoc(D("subs", t)); },
    async getReg(c) { const s = await fs.getDoc(D("regs", c)); return s.exists() ? s.data() : null; },
    async listRegs() { return all("regs"); },
    async saveRegs(list) {
      for (let i = 0; i < list.length; i += 400) {
        const b = fs.writeBatch(db);
        list.slice(i, i + 400).forEach(r => b.set(D("regs", r.code), r));
        await b.commit();
      }
    },
    async deleteReg(c) { await fs.deleteDoc(D("regs", c)); },
    onAuth(cb) { au.onAuthStateChanged(auth, cb); },
    async signIn() { await au.signInWithPopup(auth, new au.GoogleAuthProvider()); },
    async signOut() { await au.signOut(auth); },
    isAdminEmail(e) { return !!e && admins.includes(e.toLowerCase()); }
  };
}

let _backend = null;
export async function backend() {
  if (_backend) return _backend;
  _backend = isDemo ? demo : await firebaseBackend();
  return _backend;
}
