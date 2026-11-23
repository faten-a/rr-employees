import { backend, isDemo } from "./data.js";
import { $, $$, esc, cleanText, cleanNum, normName, lev, validateEmployee, findDuplicates, parseCode, fmtCode,
  uid, fmtDate, countdown, toast, modal, confirmBox, footerHTML, deptLabel, normPhone } from "./common.js";

const APP = window.APP_CONFIG || {};
const app = $("#app");
let B, CFG, INV, SUB, TOKEN;
let step = 1, editingId = null, query = "", onlyIssues = false;
let sticky = { role: "", nationality: "", status: "على رأس العمل" };
let saveTimer = null, dirty = false, timerInt = null;

$("#foot").innerHTML = footerHTML(APP);
if (isDemo) $("#demo-flag").classList.remove("hidden");

// ---------------- boot ----------------
(async function boot() {
  try { B = await backend(); CFG = await B.getConfig(); }
  catch (e) { console.error(e); return fatal("تعذّر الاتصال بالخادم. تأكد من اتصال الإنترنت ثم أعد تحميل الصفحة."); }
  const fromUrl = parseCode(new URLSearchParams(location.search).get("i") || "");
  let saved = ""; try { saved = parseCode(localStorage.getItem("rr_last_token") || ""); } catch {}
  if (fromUrl) return enter(fromUrl, false);
  if (saved) return enter(saved, true);
  landing();
})();

function fatal(msg) { app.innerHTML = `<div class="banner err">${esc(msg)}</div>`; }

function landing(err = "") {
  setSave(null);
  app.innerHTML = `
  <div class="hero"><img src="${IMG.emblem}" alt="">
    <div><h1>أهلًا بك في منصة حصر بيانات الموظفين</h1>
    <p>للدخول، الصق رابط الدعوة أو رمز الدعوة الذي وصلك عبر الواتساب.</p></div></div>
  <div class="card">
    <h2>الدخول برمز الدعوة</h2>
    ${err ? `<div class="banner err">${esc(err)}</div>` : ""}
    <div class="field"><label for="code">رمز الدعوة أو رابط الدعوة</label>
      <input id="code" class="input ltr" placeholder="ABCDE-12345" autocomplete="off" autocapitalize="characters"></div>
    <div class="row end" style="margin-top:14px"><button id="go" class="btn primary">دخول</button></div>
  </div>`;
  const go = async () => { const t = parseCode($("#code").value); if (t.length < 6) return toast("أدخل رمز الدعوة كاملًا", "err"); await enter(t); };
  $("#go").onclick = go;
  $("#code").addEventListener("keydown", e => { if (e.key === "Enter") go(); });
  $("#code").focus();
}

async function enter(t, silent = false) {
  app.innerHTML = `<div class="spinner"></div>`;
  let inv;
  try { inv = await B.getInvite(t); } catch (e) { console.error(e); inv = null; }
  if (!inv) { try { localStorage.removeItem("rr_last_token"); } catch {} return landing(silent ? "" : "رمز الدعوة غير صحيح. تأكد من نسخه كاملًا كما وصلك."); }
  if (inv.active === false) return landing("هذه الدعوة موقوفة. تواصل مع مديرة المشروع.");
  INV = inv; TOKEN = t;
  try { localStorage.setItem("rr_last_token", t); } catch {}
  if (new URLSearchParams(location.search).get("i") !== t) history.replaceState(null, "", `?i=${t}${isDemo && location.search.includes("demo") ? "&demo" : ""}`);
  SUB = await B.getSub(t);
  if (!SUB) {
    SUB = { token: t, branchId: inv.branchId || "", deptCode: inv.deptCode || "",
      supervisor: { name: inv.name || "", phone: inv.phone || "", empNo: "", title: "", expected: "" },
      employees: [], status: "draft", createdAt: new Date().toISOString(), updatedAt: null };
  }
  if (SUB.status === "submitted") return renderSubmitted();
  // مستخدم عائد: يكمل من حيث توقف
  step = !SUB.branchId || !SUB.deptCode ? 1 : !SUB.updatedAt || !/^05\d{8}$/.test(SUB.supervisor?.phone || "") ? (SUB.updatedAt ? 2 : 1) : 3;
  render();
}

// ---------------- helpers ----------------
const branch = id => CFG.branches.find(b => b.id === id);
const dept = code => CFG.departments.find(d => String(d.code) === String(code));
const deadline = () => CFG.deadlines?.[SUB.branchId] || null;

function setSave(state, txt) {
  const el = $("#save-state");
  if (!state) return el.classList.add("hidden");
  el.classList.remove("hidden", "saving", "err");
  if (state !== "ok") el.classList.add(state);
  $(".txt", el).textContent = txt;
}
function markDirty() {
  dirty = true; setSave("saving", "لم يُحفظ بعد…");
  clearTimeout(saveTimer); saveTimer = setTimeout(() => save(), 1500);
}
async function save(force = false) {
  if (!dirty && !force) return true;
  clearTimeout(saveTimer);
  setSave("saving", "جارٍ الحفظ…");
  SUB.updatedAt = new Date().toISOString();
  try {
    await B.saveSub(TOKEN, SUB); dirty = false;
    setSave("ok", "تم الحفظ " + new Date().toLocaleTimeString("ar-SA-u-nu-latn", { hour: "numeric", minute: "2-digit" }));
    return true;
  } catch (e) {
    console.error(e); setSave("err", "تعذّر الحفظ – أعد المحاولة");
    toast("تعذّر الحفظ. تحقق من الإنترنت ثم اضغط «حفظ».", "err", 4000); return false;
  }
}
window.addEventListener("beforeunload", e => { if (dirty) { save(); e.preventDefault(); e.returnValue = ""; } });

function deadlineBanner() {
  const d = deadline();
  if (!d) return "";
  const c = countdown(d);
  if (c.over) return `<div class="banner err"><b>انتهت المهلة المحددة لهذا الفرع (${esc(fmtDate(d))}).</b> أكمل البيانات وأرسلها في أقرب وقت.</div>`;
  return `<div class="banner ${c.urgent ? "warn" : "info"}" id="cd">
    <div><b>المهلة المتبقية لإنهاء التعبئة:</b>
      <div class="countdown" style="margin-top:6px"><span class="u">${c.d}<small>يوم</small></span><span class="u">${c.h}<small>ساعة</small></span><span class="u">${c.m}<small>دقيقة</small></span>
      <span style="font-size:13px">آخر موعد: ${esc(fmtDate(d))}</span></div></div></div>`;
}

function stepper() {
  const names = ["الفرع والقسم", "بيانات المشرف", "الموظفون", "المراجعة والإقرار"];
  return `<ol class="steps">${names.map((n, i) => {
    const s = i + 1, cls = s === step ? "on" : s < step ? "done" : "";
    return `<li class="${cls}" data-step="${s}" ${s < step ? 'style="cursor:pointer"' : ""}><span>${n}</span></li>`;
  }).join("")}</ol>`;
}

function render() {
  clearInterval(timerInt);
  const head = `${deadlineBanner()}${stepper()}`;
  if (step === 1) app.innerHTML = head + viewStep1();
  if (step === 2) app.innerHTML = head + viewStep2();
  if (step === 3) app.innerHTML = head + viewStep3();
  if (step === 4) app.innerHTML = head + viewStep4();
  $$(".steps li[data-step]").forEach(li => li.onclick = () => { const s = +li.dataset.step; if (s < step) { step = s; render(); } });
  ({ 1: bind1, 2: bind2, 3: bind3, 4: bind4 })[step]();
  if (deadline()) timerInt = setInterval(() => { const el = $("#cd"); if (el) el.outerHTML = deadlineBanner(); }, 30000);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ---------------- step 1 ----------------
function viewStep1() {
  const lockB = !!INV.branchId, lockD = !!INV.deptCode;
  return `<div class="card">
    <h2>مرحبًا ${esc(INV.name || "")}</h2>
    <p class="sub">نشكرك على تعاونك في تحديث بيانات موظفي الشركة. اختر الفرع والقسم الذي تشرف عليه.</p>
    <div class="grid g2">
      <div class="field"><label>الفرع <span class="req">*</span></label>
        <select id="b" class="input" ${lockB ? "disabled" : ""}><option value="">اختر الفرع…</option>
        ${CFG.branches.map(b => `<option value="${esc(b.id)}" ${b.id === SUB.branchId ? "selected" : ""}>${esc(b.region)} – ${esc(b.name)}</option>`).join("")}</select></div>
      <div class="field"><label>القسم <span class="req">*</span></label>
        <select id="d" class="input" ${lockD ? "disabled" : ""}><option value="">اختر القسم…</option>
        ${CFG.departments.map(d => `<option value="${esc(d.code)}" ${String(d.code) === String(SUB.deptCode) ? "selected" : ""}>${esc(deptLabel(d))}</option>`).join("")}</select></div>
    </div>
    ${lockB || lockD ? `<p class="hint">الفرع والقسم محددان مسبقًا في دعوتك. إن كان هناك خطأ تواصل مع مديرة المشروع.</p>` : ""}
    <div class="row end" style="margin-top:18px"><button id="n1" class="btn primary">التالي ←</button></div>
  </div>`;
}
function bind1() {
  $("#n1").onclick = () => {
    const b = $("#b").value, d = $("#d").value;
    if (!b) return toast("اختر الفرع", "err");
    if (!d) return toast("اختر القسم", "err");
    if (b !== SUB.branchId || d !== SUB.deptCode) { SUB.branchId = b; SUB.deptCode = d; markDirty(); }
    step = 2; render();
  };
}

// ---------------- step 2 ----------------
function viewStep2() {
  const s = SUB.supervisor;
  return `<div class="card">
    <h2>بيانات المشرف</h2>
    <p class="sub">${esc(branch(SUB.branchId)?.name || "")} · ${esc(deptLabel(dept(SUB.deptCode)))}</p>
    <div class="grid g2">
      <div class="field span2"><label>الاسم الكامل <span class="req">*</span></label><input id="s-name" class="input" value="${esc(s.name)}" autocomplete="name"></div>
      <div class="field"><label>الرقم الوظيفي <span class="opt">(اختياري)</span></label><input id="s-emp" class="input ltr" inputmode="numeric" value="${esc(s.empNo)}"></div>
      <div class="field"><label>رقم الجوال <span class="req">*</span></label><input id="s-phone" class="input ltr" inputmode="tel" placeholder="05XXXXXXXX" value="${esc(s.phone)}"></div>
      <div class="field"><label>المسمى الوظيفي <span class="opt">(اختياري)</span></label><input id="s-title" class="input" list="roles-dl" value="${esc(s.title)}" placeholder="مثال: مشرف قسم"></div>
      <div class="field"><label>عدد موظفي القسم تقريبًا <span class="opt">(اختياري)</span></label><input id="s-exp" class="input ltr" inputmode="numeric" value="${esc(s.expected)}"><div class="hint">يساعدنا في التأكد من اكتمال القائمة.</div></div>
    </div>
    <datalist id="roles-dl">${CFG.roles.map(r => `<option value="${esc(r)}">`).join("")}</datalist>
    <div class="row between" style="margin-top:18px"><button id="p2" class="btn ghost">→ السابق</button><button id="n2" class="btn primary">التالي ←</button></div>
  </div>`;
}
function bind2() {
  const collect = () => {
    const s = SUB.supervisor;
    const v = { name: cleanText($("#s-name").value), empNo: cleanNum($("#s-emp").value), phone: normPhone($("#s-phone").value),
      title: cleanText($("#s-title").value), expected: cleanNum($("#s-exp").value) };
    if (JSON.stringify(v) !== JSON.stringify({ name: s.name, empNo: s.empNo, phone: s.phone, title: s.title, expected: s.expected })) {
      Object.assign(s, v); markDirty();
    }
  };
  $("#p2").onclick = () => { collect(); step = 1; render(); };
  $("#n2").onclick = () => {
    collect();
    if (SUB.supervisor.name.split(" ").length < 2) return toast("اكتب اسمك الكامل", "err");
    if (!/^05\d{8}$/.test(SUB.supervisor.phone)) return toast("رقم الجوال يجب أن يكون 10 أرقام ويبدأ بـ 05", "err");
    step = 3; render(); save();
  };
}

// ---------------- step 3 ----------------
function issuesMap() {
  const dups = findDuplicates(SUB.employees);
  const m = new Map();
  SUB.employees.forEach((e, i) => {
    const list = validateEmployee(e).concat((dups.get(i) || []).map(msg => ({ level: "warn", msg })));
    if (list.length) m.set(e.id, list);
  });
  return m;
}
function viewStep3() {
  const n = SUB.employees.length;
  const exp = +SUB.supervisor.expected || 0;
  return `
  <div class="card">
    <div class="row between"><div><h2>موظفو القسم</h2>
      <p class="sub" style="margin-bottom:0">${esc(branch(SUB.branchId)?.name || "")} · ${esc(deptLabel(dept(SUB.deptCode)))}</p></div>
      <button id="bulk" class="btn sm">📋 لصق قائمة من إكسل</button></div>
  </div>
  <div class="add-box" id="add-box">
    <h3 id="add-title">إضافة موظف</h3>
    <div class="grid g3">
      <div class="field span2"><label>اسم الموظف <span class="req">*</span></label><input id="e-name" class="input" placeholder="الاسم الثلاثي أو الرباعي" autocomplete="off"><div id="name-hint" class="hint"></div></div>
      <div class="field"><label>الرقم الوظيفي <span class="opt">(إن وُجد)</span></label><input id="e-emp" class="input ltr" inputmode="numeric" autocomplete="off"></div>
      <div class="field"><label>الوظيفة / الدور</label><input id="e-role" class="input" list="roles-dl" placeholder="اختر أو اكتب" value="${esc(sticky.role)}"></div>
      <div class="field"><label>الحالة الوظيفية</label><select id="e-status" class="input">${CFG.statuses.map(s => `<option ${s === sticky.status ? "selected" : ""}>${esc(s)}</option>`).join("")}</select></div>
      <div class="field"><label>الجنسية</label><select id="e-nat" class="input"><option value="">—</option>${CFG.nationalities.map(s => `<option ${s === sticky.nationality ? "selected" : ""}>${esc(s)}</option>`).join("")}</select></div>
      <div class="field"><label>رقم الهوية / الإقامة <span class="opt">(اختياري)</span></label><input id="e-nid" class="input ltr" inputmode="numeric" maxlength="10" autocomplete="off"></div>
      <div class="field span2"><label>ملاحظات <span class="opt">(اختياري)</span></label><input id="e-notes" class="input" autocomplete="off"></div>
    </div>
    <datalist id="roles-dl">${CFG.roles.map(r => `<option value="${esc(r)}">`).join("")}</datalist>
    <div class="row end" style="margin-top:12px">
      <button id="e-cancel" class="btn ghost hidden">إلغاء التعديل</button>
      <button id="e-add" class="btn primary">+ إضافة الموظف</button></div>
    <p class="hint" style="margin:6px 0 0">تبقى الوظيفة والحالة والجنسية محفوظة للموظف التالي لتسريع الإدخال. اضغط Enter بعد الاسم للإضافة.</p>
  </div>
  <div class="card">
    <div class="emp-toolbar">
      <input id="q" class="input" placeholder="بحث بالاسم أو الرقم…" value="${esc(query)}">
      <label class="check" style="font-weight:500;font-size:14px"><input type="checkbox" id="oi" ${onlyIssues ? "checked" : ""}> عرض ما يحتاج مراجعة فقط</label>
      <div class="sp" style="flex:1"></div>
      <div class="counters" id="counters"></div>
    </div>
    <div id="list"></div>
    ${exp && n !== exp ? `<p class="hint" id="exp-hint">أدخلت ${n} من أصل ${exp} موظفًا حسب العدد التقريبي الذي ذكرته.</p>` : ""}
  </div>
  <div class="row between">
    <button id="p3" class="btn ghost">→ السابق</button>
    <div class="row"><button id="s3" class="btn">💾 حفظ والعودة لاحقًا</button><button id="n3" class="btn primary">المراجعة والإرسال ←</button></div>
  </div>`;
}
function renderList() {
  const im = issuesMap();
  const q = normName(query), qn = cleanNum(query);
  let rows = SUB.employees.map((e, i) => ({ e, i }));
  if (q) rows = rows.filter(({ e }) => normName(e.name).includes(q) || (qn && (cleanNum(e.empNo).includes(qn) || cleanNum(e.nid).includes(qn))));
  if (onlyIssues) rows = rows.filter(({ e }) => im.has(e.id));
  const warnCount = [...im.values()].length;
  $("#counters").innerHTML = `<span class="badge b-gold">العدد: ${SUB.employees.length}</span>` +
    (warnCount ? `<span class="badge b-warn">تحتاج مراجعة: ${warnCount}</span>` : SUB.employees.length ? `<span class="badge b-ok">لا توجد ملاحظات</span>` : "");
  if (!SUB.employees.length) { $("#list").innerHTML = `<div class="empty"><b>لم تُضف أي موظف بعد</b>ابدأ بإضافة أول موظف من النموذج أعلاه، أو الصق قائمة من إكسل.</div>`; return; }
  if (!rows.length) { $("#list").innerHTML = `<div class="empty">لا توجد نتائج مطابقة.</div>`; return; }
  $("#list").innerHTML = `<div class="emp-list">${rows.map(({ e, i }) => {
    const iss = im.get(e.id) || [];
    const cls = iss.some(x => x.level === "err") ? "has-err" : iss.length ? "has-warn" : "";
    const meta = [e.role, e.status, e.nationality].filter(Boolean).map(esc).join(" · ");
    const ids = [e.empNo ? "رقم وظيفي: " + esc(e.empNo) : "", e.nid ? "هوية: " + esc(e.nid) : ""].filter(Boolean).join(" · ");
    return `<div class="emp ${cls} ${editingId === e.id ? "editing" : ""}" data-id="${e.id}">
      <div class="n">${i + 1}</div><div class="nm">${esc(e.name)}${e.notes ? `<div class="meta">📝 ${esc(e.notes)}</div>` : ""}</div>
      <div class="meta">${meta || "—"}</div><div class="meta ltr" style="direction:rtl">${ids || '<span style="color:var(--muted)">بدون رقم</span>'}</div><div></div>
      <div class="acts"><button class="icon-btn" data-ed title="تعديل" aria-label="تعديل">✎</button><button class="icon-btn" data-del title="حذف" aria-label="حذف">🗑</button></div>
      ${iss.length ? `<div class="issues">${iss.map(x => `<span class="badge ${x.level === "err" ? "b-err" : "b-warn"}">⚠ ${esc(x.msg)}</span>`).join("")}</div>` : ""}
    </div>`;
  }).join("")}</div>`;
  $$("#list [data-ed]").forEach(b => b.onclick = () => startEdit(b.closest(".emp").dataset.id));
  $$("#list [data-del]").forEach(b => b.onclick = async () => {
    const id = b.closest(".emp").dataset.id, e = SUB.employees.find(x => x.id === id);
    if (await confirmBox("حذف موظف", `هل تريد حذف «${esc(e.name)}» من القائمة؟`, "حذف", "danger")) {
      SUB.employees = SUB.employees.filter(x => x.id !== id); if (editingId === id) resetForm();
      markDirty(); renderList(); toast("تم الحذف");
    }
  });
}
function readForm() {
  return { name: cleanText($("#e-name").value), empNo: cleanNum($("#e-emp").value), role: cleanText($("#e-role").value),
    status: $("#e-status").value, nationality: $("#e-nat").value, nid: cleanNum($("#e-nid").value), notes: cleanText($("#e-notes").value) };
}
function resetForm() {
  editingId = null;
  ["e-name", "e-emp", "e-nid", "e-notes"].forEach(id => $("#" + id).value = "");
  $("#e-role").value = sticky.role; $("#e-status").value = sticky.status; $("#e-nat").value = sticky.nationality;
  $("#add-title").textContent = "إضافة موظف"; $("#e-add").textContent = "+ إضافة الموظف"; $("#e-cancel").classList.add("hidden");
  $("#name-hint").innerHTML = ""; $("#e-name").focus();
}
function startEdit(id) {
  const e = SUB.employees.find(x => x.id === id); if (!e) return;
  editingId = id;
  $("#e-name").value = e.name; $("#e-emp").value = e.empNo || ""; $("#e-role").value = e.role || ""; $("#e-status").value = e.status || CFG.statuses[0];
  $("#e-nat").value = e.nationality || ""; $("#e-nid").value = e.nid || ""; $("#e-notes").value = e.notes || "";
  $("#add-title").textContent = "تعديل بيانات موظف"; $("#e-add").textContent = "حفظ التعديل"; $("#e-cancel").classList.remove("hidden");
  $("#add-box").scrollIntoView({ behavior: "smooth", block: "start" }); $("#e-name").focus(); renderList();
}
function nameHint() {
  const v = normName($("#e-name").value);
  if (v.length < 4) return $("#name-hint").innerHTML = "";
  const same = SUB.employees.find(e => e.id !== editingId && normName(e.name) === v);
  const sim = !same && v.length >= 8 && SUB.employees.find(e => e.id !== editingId && lev(normName(e.name), v) <= 2);
  $("#name-hint").innerHTML = same ? `<span class="badge b-err">⚠ هذا الاسم مضاف مسبقًا في القائمة</span>` :
    sim ? `<span class="badge b-warn">⚠ يوجد اسم مشابه: ${esc(sim.name)}</span>` : "";
}
function bind3() {
  renderList();
  $("#e-name").addEventListener("input", nameHint);
  $("#e-name").addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); $("#e-add").click(); } });
  $("#e-add").onclick = async () => {
    const v = readForm();
    if (!v.name) { $("#e-name").classList.add("bad"); toast("اسم الموظف مطلوب", "err"); return $("#e-name").focus(); }
    $("#e-name").classList.remove("bad");
    const dupe = SUB.employees.find(e => e.id !== editingId && normName(e.name) === normName(v.name));
    if (dupe && !(await confirmBox("اسم مكرر", `الاسم «${esc(v.name)}» موجود مسبقًا في القائمة. هل هو موظف آخر بنفس الاسم؟`, "نعم، أضفه", "primary"))) return;
    sticky = { role: v.role, status: v.status, nationality: v.nationality };
    if (editingId) { Object.assign(SUB.employees.find(e => e.id === editingId), v); toast("تم حفظ التعديل"); }
    else { SUB.employees.push({ id: uid(), ...v }); toast(`تمت إضافة ${v.name}`); }
    markDirty(); resetForm(); renderList();
  };
  $("#e-cancel").onclick = () => { resetForm(); renderList(); };
  $("#q").addEventListener("input", e => { query = e.target.value; renderList(); });
  $("#oi").onchange = e => { onlyIssues = e.target.checked; renderList(); };
  $("#bulk").onclick = bulkPaste;
  $("#p3").onclick = () => { step = 2; render(); };
  $("#s3").onclick = async () => { if (await save(true)) modal({ title: "تم حفظ بياناتك", html: `<p>يمكنك العودة لإكمال التعبئة في أي وقت باستخدام نفس رابط الدعوة.</p><p>رمز الدعوة الخاص بك: <b class="ltr">${fmtCode(TOKEN)}</b></p>`, actions: [{ label: "حسنًا", kind: "primary" }] }); };
  $("#n3").onclick = async () => {
    if (!SUB.employees.length && !(await confirmBox("لا يوجد موظفون", "لم تُضف أي موظف. هل القسم فعلًا لا يحتوي على موظفين؟", "نعم، متابعة"))) return;
    step = 4; render(); save();
  };
}
async function bulkPaste() {
  const r = await modal({ title: "لصق قائمة موظفين من إكسل", wide: true,
    html: `<p class="hint" style="margin-top:0">انسخ الأعمدة من إكسل والصقها هنا، كل موظف في سطر. الترتيب المقبول للأعمدة:<br>
      <b>الاسم</b> | الرقم الوظيفي | الوظيفة | الجنسية | رقم الهوية | الحالة — يكفي عمود الاسم وحده.</p>
      <textarea id="bp" class="input" style="min-height:220px" placeholder="محمد أحمد علي&#9;1052&#9;كاشير&#9;سعودي"></textarea>
      <div class="grid g3" style="margin-top:12px">
        <div class="field"><label>الوظيفة الافتراضية</label><input id="bp-role" class="input" list="roles-dl" value="${esc(sticky.role)}"></div>
        <div class="field"><label>الحالة الافتراضية</label><select id="bp-st" class="input">${CFG.statuses.map(s => `<option ${s === sticky.status ? "selected" : ""}>${esc(s)}</option>`).join("")}</select></div>
        <div class="field"><label>الجنسية الافتراضية</label><select id="bp-nat" class="input"><option value="">—</option>${CFG.nationalities.map(s => `<option ${s === sticky.nationality ? "selected" : ""}>${esc(s)}</option>`).join("")}</select></div>
      </div><p id="bp-c" class="hint"></p>`,
    onOpen: w => { $("#bp", w).addEventListener("input", () => { const n = $("#bp", w).value.split(/\r?\n/).filter(l => cleanText(l)).length; $("#bp-c", w).textContent = n ? `سيتم إضافة ${n} موظف` : ""; }); $("#bp", w).focus(); },
    actions: [{ label: "إلغاء", kind: "ghost", value: null }, { label: "إضافة القائمة", kind: "primary", onClick: w => ({
      text: $("#bp", w).value, role: cleanText($("#bp-role", w).value), status: $("#bp-st", w).value, nationality: $("#bp-nat", w).value }) }] });
  if (!r || !r.text) return;
  const added = [];
  r.text.split(/\r?\n/).forEach(line => {
    if (!cleanText(line)) return;
    const c = line.split(/\t|;|\|/).map(cleanText);
    const name = c[0]; if (!name || /^(الاسم|اسم الموظف|name)$/i.test(name)) return;
    const st = CFG.statuses.includes(c[5]) ? c[5] : r.status;
    const nat = c[3] ? (CFG.nationalities.find(n => normName(n) === normName(c[3])) || c[3]) : r.nationality;
    added.push({ id: uid(), name, empNo: cleanNum(c[1]), role: c[2] || r.role, nationality: nat, nid: cleanNum(c[4]), status: st, notes: "" });
  });
  if (!added.length) return toast("لم يتم العثور على أسماء", "err");
  SUB.employees.push(...added); markDirty(); renderList();
  toast(`تمت إضافة ${added.length} موظف. راجع التنبيهات إن وُجدت.`, "ok", 3500);
}

// ---------------- step 4 ----------------
function viewStep4() {
  const im = issuesMap(), n = SUB.employees.length, b = branch(SUB.branchId), d = dept(SUB.deptCode);
  const byStatus = {}; SUB.employees.forEach(e => byStatus[e.status || "—"] = (byStatus[e.status || "—"] || 0) + 1);
  const noEmp = SUB.employees.filter(e => !e.empNo).length;
  const exp = +SUB.supervisor.expected || 0;
  const s = SUB.supervisor;
  return `
  <div class="tiles">
    <div class="tile gold"><div class="k">إجمالي الموظفين</div><div class="v">${n}</div><div class="s">${esc(d?.name || "")}</div></div>
    ${Object.entries(byStatus).map(([k, v]) => `<div class="tile"><div class="k">${esc(k)}</div><div class="v">${v}</div></div>`).join("")}
    <div class="tile"><div class="k">بدون رقم وظيفي</div><div class="v">${noEmp}</div></div>
  </div>
  ${im.size ? `<div class="card"><h2>تنبيهات تحتاج مراجعتك (${im.size})</h2>
    <div class="tbl-wrap" style="max-height:260px"><table class="tbl"><thead><tr><th>الموظف</th><th>التنبيه</th></tr></thead><tbody>
    ${SUB.employees.filter(e => im.has(e.id)).map(e => `<tr><td>${esc(e.name || "—")}</td><td class="wrap">${im.get(e.id).map(x => esc(x.msg)).join("<br>")}</td></tr>`).join("")}
    </tbody></table></div>
    <div class="row" style="margin-top:10px"><button id="fix" class="btn sm">→ العودة للتصحيح</button></div>
    <label class="check" style="margin-top:12px"><input type="checkbox" id="ack"> راجعت التنبيهات أعلاه وأؤكد أن البيانات صحيحة</label></div>` : ""}
  ${exp && exp !== n ? `<div class="banner warn">ذكرت أن عدد موظفي القسم تقريبًا ${exp}، وأدخلت ${n}. تأكد من إضافة جميع الموظفين.</div>` : ""}
  <div class="card">
    <h2>الإقرار والتوقيع</h2>
    <div class="declaration">
      أقر أنا <b>${esc(s.name)}</b>، مشرف <b>${esc(d?.name || "")}</b> (رمز ${esc(d?.code || "")}) في فرع <b>${esc(b?.name || "")}</b>،
      بأن بيانات الموظفين المدخلة في هذه المنصة وعددهم <b>${n}</b> موظفًا صحيحة ومكتملة وتمثل جميع الموظفين العاملين تحت إشرافي فعليًا حتى تاريخه،
      وأتحمل كامل المسؤولية عن صحتها، وألتزم بإبلاغ إدارة الموارد البشرية بأي تغيير يطرأ عليها.
    </div>
    <div class="grid g2" style="margin-top:14px">
      <div class="field"><label>الاسم الكامل للمُقر <span class="req">*</span></label><input id="d-name" class="input" value="${esc(s.name)}"></div>
      <div class="field"><label>التاريخ</label><input class="input" readonly value="${esc(fmtDate(new Date().toISOString(), false))}"></div>
    </div>
    <div class="field" style="margin-top:14px"><label>التوقيع <span class="req">*</span> <span class="opt">(وقّع بإصبعك أو بالفأرة)</span></label>
      <canvas id="sig" class="sig-pad"></canvas>
      <div class="row" style="margin-top:6px"><button id="sig-clear" class="btn sm ghost">مسح التوقيع</button></div></div>
    <label class="check" style="margin-top:12px"><input type="checkbox" id="agree"> أقر بصحة جميع البيانات أعلاه وأتحمل مسؤوليتها</label>
  </div>
  <div class="row between">
    <button id="p4" class="btn ghost">→ العودة للموظفين</button>
    <button id="submit" class="btn ok">✓ إرسال البيانات نهائيًا</button>
  </div>`;
}
let sigDirty = false;
function initSig() {
  const c = $("#sig"), ctx = c.getContext("2d");
  const fit = () => { const r = c.getBoundingClientRect(), dpr = window.devicePixelRatio || 1; c.width = r.width * dpr; c.height = r.height * dpr; ctx.scale(dpr, dpr); ctx.lineWidth = 2.4; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = "#1d2a5a"; };
  fit(); sigDirty = false;
  let drawing = false;
  const pos = e => { const r = c.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  c.addEventListener("pointerdown", e => { drawing = true; c.setPointerCapture(e.pointerId); ctx.beginPath(); ctx.moveTo(...pos(e)); });
  c.addEventListener("pointermove", e => { if (!drawing) return; ctx.lineTo(...pos(e)); ctx.stroke(); sigDirty = true; });
  const end = () => drawing = false;
  c.addEventListener("pointerup", end); c.addEventListener("pointercancel", end);
  $("#sig-clear").onclick = () => { ctx.clearRect(0, 0, c.width, c.height); sigDirty = false; };
}
function sigData() {
  const c = $("#sig"), out = document.createElement("canvas");
  out.width = 420; out.height = Math.round(420 * c.height / c.width);
  const x = out.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, out.width, out.height); x.drawImage(c, 0, 0, out.width, out.height);
  return out.toDataURL("image/jpeg", 0.7);
}
function bind4() {
  initSig();
  $("#p4").onclick = () => { step = 3; render(); };
  $("#fix") && ($("#fix").onclick = () => { onlyIssues = true; step = 3; render(); });
  $("#submit").onclick = async () => {
    const im = issuesMap();
    if (im.size && !$("#ack").checked) return toast("أكّد مراجعة التنبيهات أولًا", "err");
    const dn = cleanText($("#d-name").value);
    if (dn.split(" ").length < 2) return toast("اكتب اسمك الكامل في الإقرار", "err");
    if (!sigDirty) return toast("أضف توقيعك", "err");
    if (!$("#agree").checked) return toast("ضع علامة على الإقرار بصحة البيانات", "err");
    const ok = await confirmBox("تأكيد الإرسال النهائي",
      `سيتم إرسال بيانات <b>${SUB.employees.length}</b> موظفًا لقسم <b>${esc(dept(SUB.deptCode)?.name || "")}</b> – فرع <b>${esc(branch(SUB.branchId)?.name || "")}</b>.<br><br>
       بعد الإرسال <b>لن تتمكن من التعديل</b> إلا بطلب من مديرة المشروع. هل أنت متأكد من صحة جميع البيانات؟`, "نعم، أرسل البيانات", "ok");
    if (!ok) return;
    const now = new Date().toISOString(), dl = deadline();
    SUB.declaration = { name: dn, signature: sigData(), agreedAt: now, warningsAcknowledged: im.size };
    SUB.status = "submitted"; SUB.submittedAt = now; SUB.late = !!(dl && new Date(now) > new Date(dl));
    $("#submit").disabled = true;
    if (await save(true)) { toast("تم إرسال البيانات بنجاح"); renderSubmitted(); }
    else { SUB.status = "draft"; $("#submit").disabled = false; }
  };
}

// ---------------- submitted ----------------
function renderSubmitted() {
  clearInterval(timerInt); setSave(null);
  const b = branch(SUB.branchId), d = dept(SUB.deptCode);
  app.innerHTML = `
  <div class="hero"><img src="${IMG.emblem}" alt="">
    <div><h1>شكرًا لك، تم استلام البيانات ✓</h1>
    <p>تم إرسال بيانات <b>${SUB.employees.length}</b> موظفًا لقسم ${esc(d?.name || "")} – فرع ${esc(b?.name || "")} بتاريخ ${esc(fmtDate(SUB.submittedAt))}.</p></div></div>
  <div class="card"><h2>ملخص ما تم إرساله</h2>
    <div class="tbl-wrap"><table class="tbl"><thead><tr><th>#</th><th>الاسم</th><th>الرقم الوظيفي</th><th>الوظيفة</th><th>الحالة</th></tr></thead><tbody>
    ${SUB.employees.map((e, i) => `<tr><td class="num">${i + 1}</td><td>${esc(e.name)}</td><td class="num">${esc(e.empNo || "—")}</td><td>${esc(e.role || "—")}</td><td>${esc(e.status || "—")}</td></tr>`).join("")}
    </tbody></table></div>
    <p class="hint">إذا اكتشفت خطأً بعد الإرسال، تواصل مع مديرة المشروع لإعادة فتح النموذج.</p>
    <div class="row end"><button id="pr" class="btn">🖨 طباعة نسخة الإقرار</button></div>
  </div>`;
  $("#pr").onclick = () => {
    $("#print-area").innerHTML = `<div class="rp"><img class="rp-banner" src="${IMG.banner}" alt="">
      <h1>إقرار صحة بيانات الموظفين</h1><div class="meta-line">${esc(b?.name || "")} · ${esc(deptLabel(d))} · ${esc(fmtDate(SUB.submittedAt))}</div>
      <p style="line-height:2">أقر أنا <b>${esc(SUB.declaration?.name)}</b> بأن بيانات الموظفين أدناه وعددهم <b>${SUB.employees.length}</b> صحيحة ومكتملة وأتحمل مسؤوليتها.</p>
      <table><thead><tr><th>#</th><th>الاسم</th><th>الرقم الوظيفي</th><th>الوظيفة</th><th>الجنسية</th><th>رقم الهوية</th><th>الحالة</th></tr></thead><tbody>
      ${SUB.employees.map((e, i) => `<tr><td>${i + 1}</td><td>${esc(e.name)}</td><td>${esc(e.empNo)}</td><td>${esc(e.role)}</td><td>${esc(e.nationality)}</td><td>${esc(e.nid)}</td><td>${esc(e.status)}</td></tr>`).join("")}</tbody></table>
      <div class="sig">التوقيع: <img src="${SUB.declaration?.signature || ""}" alt=""></div>
      <div class="foot"><span>${esc(APP.companyName || "")}</span><span>إعداد: ${esc(APP.preparedBy || "")}</span></div></div>`;
    document.body.classList.add("printing"); setTimeout(() => { window.print(); document.body.classList.remove("printing"); }, 300);
  };
}
