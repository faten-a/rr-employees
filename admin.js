import { backend, isDemo, DEFAULTS } from "./data.js";
import { $, $$, esc, cleanText, cleanNum, normName, validateEmployee, token, fmtCode, fmtDate, countdown, pct,
  normPhone, waPhone, toast, modal, confirmBox, copyText, footerHTML, deptLabel } from "./common.js";

const APP = window.APP_CONFIG || {};
const app = $("#app");
let B, CFG, INVITES = [], SUBS = {}, TAB = "home";
const F = { sup: { q: "", branch: "", status: "" }, emp: { q: "", branch: "", dept: "", status: "", nat: "", sub: "", issues: false }, dec: { branch: "" } };
let reportBranch = "";

const DEFAULT_TEMPLATE =
`السلام عليكم ورحمة الله وبركاته
الأستاذ/ة {الاسم} المحترم/ة
مشرف/ة {القسم} – فرع {الفرع}

ضمن مشروع تحديث بيانات الموظفين في ${APP.companyName || "الشركة"}، نأمل منكم التكرم بالدخول إلى الرابط التالي وتعبئة بيانات جميع موظفي قسمكم، ثم توقيع الإقرار بصحة البيانات:
{الرابط}

رمز الدعوة: {الرمز}
آخر موعد للتعبئة: {الموعد}

يمكنكم حفظ البيانات والعودة لإكمالها في أي وقت قبل الإرسال النهائي.
شاكرين ومقدّرين تعاونكم،
${APP.preparedBy || ""} – ${APP.preparedByTitle || ""}`;

$("#foot").innerHTML = footerHTML(APP);
if (isDemo) $("#demo-flag").classList.remove("hidden");

// ================= auth & load =================
(async function boot() {
  try { B = await backend(); } catch (e) { console.error(e); app.innerHTML = `<div class="banner err">تعذّر الاتصال بـ Firebase. راجع ملف الإعدادات config.js.</div>`; return; }
  B.onAuth(async user => {
    if (!user) return loginView();
    if (!B.isAdminEmail(user.email)) return loginView(`الحساب ${user.email} غير مصرح له بدخول لوحة التحكم.`, true);
    $("#user-box").classList.remove("hidden"); $("#user-mail").textContent = user.email;
    await loadAll();
  });
  $("#logout").onclick = async () => { await B.signOut(); location.reload(); };
  $("#reload").onclick = () => loadAll(true);
})();

function loginView(err = "", signedIn = false) {
  $("#user-box").classList.add("hidden");
  app.innerHTML = `<div class="card login-box"><img src="${IMG.emblem}" alt=""><h2>لوحة تحكم حصر الموظفين</h2>
    <p class="sub">الدخول مخصص لمديرة المشروع عبر حساب Google المعتمد.</p>
    ${err ? `<div class="banner err">${esc(err)}</div>` : ""}
    <button id="gin" class="btn primary" style="width:100%">${signedIn ? "الدخول بحساب آخر" : "الدخول بحساب Google"}</button></div>`;
  $("#gin").onclick = async () => {
    try { if (signedIn) await B.signOut(); await B.signIn(); }
    catch (e) { console.error(e); toast("لم يكتمل تسجيل الدخول", "err"); }
  };
}

async function loadAll(msg = false) {
  app.innerHTML = `<div class="spinner"></div>`;
  try {
    const [c, inv, subs] = await Promise.all([B.getConfig(), B.listInvites(), B.listSubs()]);
    CFG = c; CFG.inviteTemplate = CFG.inviteTemplate || DEFAULT_TEMPLATE;
    INVITES = inv.sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || ""));
    SUBS = Object.fromEntries(subs.map(s => [s.token, s]));
    render(); if (msg) toast("تم تحديث البيانات");
  } catch (e) {
    console.error(e);
    app.innerHTML = `<div class="banner err">تعذّر تحميل البيانات (${esc(e.code || e.message)}). تأكد من أن بريدك مضاف في قواعد الأمان.</div>`;
  }
}

// ================= model helpers =================
const branch = id => CFG.branches.find(b => b.id === id);
const dept = code => CFG.departments.find(d => String(d.code) === String(code));
const bName = id => branch(id)?.name || "—";
const dName = code => dept(code)?.name || (code ? `قسم ${code}` : "—");
function supStatus(inv) {
  const s = SUBS[inv.token];
  if (inv.active === false) return { k: "off", t: "موقوفة", c: "b-muted" };
  if (!s) return { k: "new", t: "لم يبدأ", c: "b-err" };
  if (s.status === "submitted") return { k: "done", t: s.late ? "أُرسل (متأخر)" : "تم الإرسال", c: s.late ? "b-warn" : "b-ok" };
  return { k: "draft", t: "جاري التعبئة", c: "b-info" };
}
// صفوف الموظفين مع بيانات الفرع والقسم
function allRows() {
  const rows = [];
  for (const s of Object.values(SUBS)) {
    const inv = INVITES.find(i => i.token === s.token) || {};
    (s.employees || []).forEach(e => rows.push({ ...e, token: s.token, branchId: s.branchId || inv.branchId, deptCode: s.deptCode || inv.deptCode,
      supervisor: s.supervisor?.name || inv.name || "", subStatus: s.status }));
  }
  return rows;
}
// المكرر على مستوى الشركة
function companyDups(rows) {
  const groups = [];
  const by = (keyFn, label) => {
    const m = new Map();
    rows.forEach(r => { const k = keyFn(r); if (!k) return; if (!m.has(k)) m.set(k, []); m.get(k).push(r); });
    for (const [k, list] of m) if (list.length > 1) groups.push({ type: label, key: k, list });
  };
  by(r => normName(r.name), "الاسم");
  by(r => cleanNum(r.empNo), "الرقم الوظيفي");
  by(r => cleanNum(r.nid), "رقم الهوية");
  return groups;
}
function dupIndex(groups) {
  const m = new Map();
  groups.forEach(g => g.list.forEach(r => { const k = r.token + r.id; if (!m.has(k)) m.set(k, []); m.get(k).push(`${g.type} مكرر`); }));
  return m;
}
function inviteLink(t) { const u = new URL("index.html", location.href); u.search = `?i=${t}`; return u.href; }
function inviteMessage(inv) {
  const dl = CFG.deadlines?.[inv.branchId];
  return (CFG.inviteTemplate || DEFAULT_TEMPLATE)
    .replaceAll("{الاسم}", inv.name || "").replaceAll("{القسم}", dName(inv.deptCode)).replaceAll("{الفرع}", bName(inv.branchId))
    .replaceAll("{الرابط}", inviteLink(inv.token)).replaceAll("{الرمز}", fmtCode(inv.token))
    .replaceAll("{الموعد}", dl ? fmtDate(dl) : "سيتم إشعاركم به");
}
async function markSent(inv) { if (!inv.sentAt) { inv.sentAt = new Date().toISOString(); try { await B.saveInvite(inv); } catch {} } }

// ================= render =================
const TABS = [["home", "الرئيسية"], ["sup", "المشرفون والدعوات"], ["emp", "الموظفون"], ["dup", "المكرر والتنبيهات"],
  ["dec", "الإقرارات"], ["dl", "المواعيد"], ["rep", "تقارير الفروع"], ["set", "الإعدادات"]];
function render() {
  const rows = allRows(), dups = companyDups(rows);
  const counts = { sup: INVITES.length, emp: rows.length, dup: dups.length, dec: Object.values(SUBS).filter(s => s.status === "submitted").length };
  app.innerHTML = `<nav class="tabs">${TABS.map(([k, t]) => `<button data-t="${k}" class="${TAB === k ? "on" : ""}">${t}${counts[k] !== undefined ? `<span class="cnt">${counts[k]}</span>` : ""}</button>`).join("")}</nav><section id="tab"></section>`;
  $$(".tabs button").forEach(b => b.onclick = () => { TAB = b.dataset.t; render(); });
  ({ home: tabHome, sup: tabSup, emp: tabEmp, dup: tabDup, dec: tabDec, dl: tabDl, rep: tabRep, set: tabSet })[TAB](rows, dups);
}
const T = () => $("#tab");

// ---------------- الرئيسية ----------------
function tabHome(rows, dups) {
  const st = INVITES.map(supStatus);
  const n = k => st.filter(s => s.k === k).length;
  const active = INVITES.filter(i => i.active !== false).length;
  const done = n("done");
  const noNum = rows.filter(r => !r.empNo).length;
  const dupRows = dupIndex(dups).size;
  const count = (key) => { const m = {}; rows.forEach(r => { const k = r[key] || "غير محدد"; m[k] = (m[k] || 0) + 1; }); return Object.entries(m).sort((a, b) => b[1] - a[1]); };
  const hb = (list, total) => `<div class="hbars">${list.map(([k, v]) => `<div class="hbar"><span class="lbl" title="${esc(k)}">${esc(k)}</span><div class="bar"><i style="width:${pct(v, total)}%"></i></div><span class="val">${v} (${pct(v, total)}%)</span></div>`).join("") || `<p class="hint">لا توجد بيانات بعد.</p>`}</div>`;
  const late = INVITES.filter(i => { const dl = CFG.deadlines?.[i.branchId]; return dl && new Date(dl) < new Date() && supStatus(i).k !== "done" && i.active !== false; });
  // مقارنة الأقسام مع النظام
  const byDept = {}; rows.forEach(r => byDept[r.deptCode] = (byDept[r.deptCode] || 0) + 1);
  T().innerHTML = `
  <div class="tiles">
    <div class="tile gold"><div class="k">نسبة الإنجاز</div><div class="v">${pct(done, active)}%</div><div class="s">${done} من ${active} مشرف أرسلوا البيانات</div></div>
    <div class="tile"><div class="k">إجمالي الموظفين المُدخلين</div><div class="v">${rows.length}</div><div class="s">منهم ${rows.filter(r => r.subStatus === "submitted").length} في نماذج مُرسلة</div></div>
    <div class="tile"><div class="k">لم يبدأ</div><div class="v" style="color:var(--err)">${n("new")}</div><div class="s">مشرف</div></div>
    <div class="tile"><div class="k">جاري التعبئة</div><div class="v" style="color:var(--info)">${n("draft")}</div><div class="s">مشرف</div></div>
    <div class="tile"><div class="k">بيانات مكررة</div><div class="v" style="color:var(--warn)">${dupRows}</div><div class="s">سجل في ${dups.length} مجموعة</div></div>
    <div class="tile"><div class="k">بدون رقم وظيفي</div><div class="v">${noNum}</div><div class="s">${pct(noNum, rows.length)}% من الموظفين</div></div>
  </div>
  <div class="card"><div class="row between"><h2>تقدم الفروع</h2><button class="btn sm" id="x-all">⬇ تصدير كل البيانات إلى إكسل</button></div>
    <div class="tbl-wrap"><table class="tbl"><thead><tr><th>الفرع</th><th>المنطقة</th><th class="num">المشرفون</th><th class="num">أرسلوا</th><th>الإنجاز</th><th class="num">الموظفون</th><th>المهلة</th><th></th></tr></thead><tbody>
    ${CFG.branches.map(b => {
      const inv = INVITES.filter(i => i.branchId === b.id && i.active !== false), d = inv.filter(i => supStatus(i).k === "done").length;
      const emp = rows.filter(r => r.branchId === b.id).length, dl = CFG.deadlines?.[b.id], c = countdown(dl);
      return `<tr><td><b>${esc(b.name)}</b></td><td>${esc(b.region)}</td><td class="num">${inv.length}</td><td class="num">${d}</td>
        <td style="min-width:150px"><div class="row" style="flex-wrap:nowrap"><div class="bar ${d === inv.length && inv.length ? "ok" : ""}" style="flex:1"><i style="width:${pct(d, inv.length)}%"></i></div><b>${pct(d, inv.length)}%</b></div></td>
        <td class="num">${emp}</td><td>${!dl ? '<span class="badge b-muted">غير محدد</span>' : c.over ? '<span class="badge b-err">انتهت</span>' : `<span class="badge ${c.urgent ? "b-warn" : "b-info"}">${c.d} يوم ${c.h} ساعة</span>`}</td>
        <td><button class="btn sm" data-rep="${b.id}">التقرير</button></td></tr>`;
    }).join("")}</tbody></table></div></div>
  ${late.length ? `<div class="card"><h2>مشرفون تجاوزوا المهلة ولم يرسلوا (${late.length})</h2><div class="tbl-wrap" style="max-height:300px"><table class="tbl"><thead><tr><th>المشرف</th><th>الجوال</th><th>الفرع</th><th>القسم</th><th>الحالة</th><th></th></tr></thead><tbody>
    ${late.map(i => `<tr><td>${esc(i.name)}</td><td class="ltr">${esc(i.phone)}</td><td>${esc(bName(i.branchId))}</td><td>${esc(dName(i.deptCode))}</td><td><span class="badge ${supStatus(i).c}">${supStatus(i).t}</span></td>
    <td><a class="btn sm wa" target="_blank" rel="noopener" href="https://wa.me/${waPhone(i.phone)}?text=${encodeURIComponent(`تذكير: ${i.name}، نأمل إكمال تعبئة بيانات موظفي ${dName(i.deptCode)} وإرسالها عبر الرابط:\n${inviteLink(i.token)}\nشاكرين تعاونكم.`)}">تذكير واتساب</a></td></tr>`).join("")}
    </tbody></table></div></div>` : ""}
  <div class="two-col">
    <div class="card"><h2>الحالة الوظيفية</h2>${hb(count("status"), rows.length)}</div>
    <div class="card"><h2>الجنسيات</h2>${hb(count("nationality").slice(0, 10), rows.length)}</div>
    <div class="card"><h2>أكثر الوظائف</h2>${hb(count("role").slice(0, 10), rows.length)}</div>
    <div class="card"><h2>الموظفون حسب الفرع</h2>${hb(CFG.branches.map(b => [b.name, rows.filter(r => r.branchId === b.id).length]), rows.length)}</div>
  </div>
  <div class="card"><h2>مقارنة الأقسام مع نظام الموارد البشرية</h2><p class="sub">العدد المسجل في النظام مقابل ما أدخله المشرفون في جميع الفروع.</p>
    <div class="tbl-wrap"><table class="tbl"><thead><tr><th>القسم</th><th class="num">الرمز</th><th class="num">في النظام</th><th class="num">المُدخل</th><th class="num">الفرق</th><th>المشرفون</th></tr></thead><tbody>
    ${CFG.departments.map(d => {
      const e = byDept[d.code] || 0, sys = +d.sys || 0, diff = e - sys, sups = INVITES.filter(i => String(i.deptCode) === String(d.code)).length;
      return `<tr><td>${esc(d.name)}</td><td class="num">${esc(d.code)}</td><td class="num">${sys}</td><td class="num">${e}</td>
        <td class="num">${diff === 0 ? '<span class="badge b-ok">مطابق</span>' : `<span class="badge ${diff > 0 ? "b-warn" : "b-err"}" dir="ltr">${diff > 0 ? "+" : ""}${diff}</span>`}</td>
        <td>${sups ? sups + " مشرف" : '<span class="badge b-muted">لا يوجد مشرف</span>'}</td></tr>`;
    }).join("")}</tbody></table></div></div>`;
  $("#x-all").onclick = () => exportAll();
  $$("[data-rep]").forEach(b => b.onclick = () => { reportBranch = b.dataset.rep; TAB = "rep"; render(); });
}

// ---------------- المشرفون ----------------
function tabSup() {
  const f = F.sup;
  T().innerHTML = `
  <div class="card"><h2>إضافة مشرف وإنشاء دعوة</h2>
    <div class="grid g4">
      <div class="field"><label>اسم المشرف <span class="req">*</span></label><input id="a-name" class="input"></div>
      <div class="field"><label>رقم الجوال <span class="req">*</span></label><input id="a-phone" class="input ltr" inputmode="tel" placeholder="05XXXXXXXX"></div>
      <div class="field"><label>الفرع <span class="req">*</span></label><select id="a-branch" class="input"><option value="">اختر…</option>${CFG.branches.map(b => `<option value="${b.id}">${esc(b.name)}</option>`).join("")}</select></div>
      <div class="field"><label>القسم <span class="req">*</span></label><select id="a-dept" class="input"><option value="">اختر…</option>${CFG.departments.map(d => `<option value="${esc(d.code)}">${esc(deptLabel(d))}</option>`).join("")}</select></div>
    </div>
    <div class="row end" style="margin-top:12px"><button id="a-bulk" class="btn">📋 استيراد قائمة مشرفين</button><button id="a-add" class="btn primary">+ إضافة وإنشاء الدعوة</button></div>
  </div>
  <div class="card">
    <div class="filters">
      <input id="f-q" class="input" placeholder="بحث بالاسم أو الجوال…" value="${esc(f.q)}">
      <select id="f-b" class="input"><option value="">كل الفروع</option>${CFG.branches.map(b => `<option value="${b.id}" ${f.branch === b.id ? "selected" : ""}>${esc(b.name)}</option>`).join("")}</select>
      <select id="f-s" class="input"><option value="">كل الحالات</option>${[["new", "لم يبدأ"], ["draft", "جاري التعبئة"], ["done", "تم الإرسال"], ["off", "موقوفة"], ["unsent", "لم تُرسل الدعوة"]].map(([k, t]) => `<option value="${k}" ${f.status === k ? "selected" : ""}>${t}</option>`).join("")}</select>
      <div style="flex:1"></div><button id="x-sup" class="btn sm">⬇ تصدير إكسل</button>
    </div>
    <div id="sup-list"></div></div>`;
  const list = () => {
    const q = normName(f.q), qn = cleanNum(f.q);
    let L = INVITES.filter(i => (!f.branch || i.branchId === f.branch) &&
      (!f.status || (f.status === "unsent" ? !i.sentAt && i.active !== false : supStatus(i).k === f.status)) &&
      (!q || normName(i.name).includes(q) || (qn && cleanNum(i.phone).includes(qn))));
    $("#sup-list").innerHTML = !L.length ? `<div class="empty"><b>لا يوجد مشرفون</b>أضف المشرفين من النموذج أعلاه أو استورد قائمتهم.</div>` :
      `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>المشرف</th><th>الجوال</th><th>الفرع</th><th>القسم</th><th>الرمز</th><th>الحالة</th><th class="num">الموظفون</th><th>آخر تحديث</th><th>الدعوة</th><th></th></tr></thead><tbody>
      ${L.map(i => { const s = supStatus(i), sub = SUBS[i.token]; return `<tr data-t="${i.token}">
        <td><b>${esc(i.name)}</b></td><td class="ltr">${esc(i.phone)}</td><td>${esc(bName(i.branchId))}</td><td>${esc(dName(i.deptCode))} <span class="hint">(${esc(i.deptCode)})</span></td>
        <td class="ltr nowrap" style="font-family:monospace">${fmtCode(i.token)}</td><td><span class="badge ${s.c}">${s.t}</span></td>
        <td class="num">${sub?.employees?.length ?? 0}</td><td>${sub?.updatedAt ? esc(fmtDate(sub.updatedAt)) : "—"}</td>
        <td><div class="row" style="flex-wrap:nowrap;gap:4px">
          <a class="btn sm wa" data-wa target="_blank" rel="noopener" href="https://wa.me/${waPhone(i.phone)}?text=${encodeURIComponent(inviteMessage(i))}" title="إرسال الدعوة عبر واتساب">واتساب</a>
          <button class="btn sm" data-msg title="نسخ نص الدعوة">نسخ الرسالة</button>${i.sentAt ? '<span class="badge b-ok" title="تم فتح الإرسال">✓</span>' : ""}</div></td>
        <td><button class="btn sm ghost" data-more>⋯</button></td></tr>`; }).join("")}</tbody></table></div>
      <p class="hint">${L.length} مشرف · زر «واتساب» يفتح المحادثة مع الرسالة جاهزة، وعلامة ✓ تعني أنك أرسلت الدعوة.</p>`;
    $$("#sup-list [data-wa]").forEach(a => a.onclick = () => { const inv = INVITES.find(x => x.token === a.closest("tr").dataset.t); markSent(inv).then(() => setTimeout(list, 500)); });
    $$("#sup-list [data-msg]").forEach(b => b.onclick = async () => { const inv = INVITES.find(x => x.token === b.closest("tr").dataset.t); await copyText(inviteMessage(inv)); await markSent(inv); list(); });
    $$("#sup-list [data-more]").forEach(b => b.onclick = () => supMenu(INVITES.find(x => x.token === b.closest("tr").dataset.t)));
  };
  list();
  $("#f-q").oninput = e => { f.q = e.target.value; list(); };
  $("#f-b").onchange = e => { f.branch = e.target.value; list(); };
  $("#f-s").onchange = e => { f.status = e.target.value; list(); };
  $("#x-sup").onclick = () => exportSupervisors();
  $("#a-add").onclick = async () => {
    const inv = { name: cleanText($("#a-name").value), phone: normPhone($("#a-phone").value), branchId: $("#a-branch").value, deptCode: $("#a-dept").value };
    if (!inv.name) return toast("اكتب اسم المشرف", "err");
    if (!/^05\d{8}$/.test(inv.phone)) return toast("رقم الجوال يجب أن يكون 10 أرقام ويبدأ بـ 05", "err");
    if (!inv.branchId || !inv.deptCode) return toast("اختر الفرع والقسم", "err");
    const ex = INVITES.find(i => i.phone === inv.phone && i.branchId === inv.branchId && String(i.deptCode) === inv.deptCode);
    if (ex) return toast("هذا المشرف مضاف مسبقًا لنفس الفرع والقسم", "err");
    Object.assign(inv, { token: token(), active: true, createdAt: new Date().toISOString() });
    await B.saveInvite(inv); INVITES.push(inv); toast("تمت إضافة المشرف وإنشاء الدعوة"); render();
  };
  $("#a-bulk").onclick = bulkImport;
}
async function supMenu(inv) {
  const sub = SUBS[inv.token], s = supStatus(inv);
  await modal({ title: inv.name, wide: true, html: `
    <div class="grid g2"><div><b>الفرع:</b> ${esc(bName(inv.branchId))}</div><div><b>القسم:</b> ${esc(deptLabel(dept(inv.deptCode)))}</div>
    <div><b>الجوال:</b> <span class="ltr">${esc(inv.phone)}</span></div><div><b>الحالة:</b> <span class="badge ${s.c}">${s.t}</span></div>
    <div class="span2"><b>رابط الدعوة:</b> <span class="ltr" style="word-break:break-all">${esc(inviteLink(inv.token))}</span></div></div>
    <h4 style="margin-top:14px">نص رسالة الدعوة</h4><div class="msg-preview">${esc(inviteMessage(inv))}</div>
    ${sub ? `<h4 style="margin-top:14px">بيانات المشرف المدخلة</h4><p>${esc(sub.supervisor?.name)} · رقم وظيفي: ${esc(sub.supervisor?.empNo || "—")} · ${esc(sub.supervisor?.title || "")} · العدد التقريبي: ${esc(sub.supervisor?.expected || "—")}</p>` : ""}`,
    actions: [
      { label: "نسخ الرابط", onClick: async () => { await copyText(inviteLink(inv.token)); return false; } },
      { label: "نسخ الرسالة", onClick: async () => { await copyText(inviteMessage(inv)); await markSent(inv); return false; } },
      ...(sub ? [{ label: "عرض الموظفين", onClick: () => { setTimeout(() => viewSub(inv.token)); } }] : []),
      ...(sub?.status === "submitted" ? [{ label: "إعادة فتح للتعديل", onClick: async () => {
        if (!(await confirmBox("إعادة فتح النموذج", "سيتمكن المشرف من تعديل البيانات وسيلزمه التوقيع على الإقرار مجددًا. متابعة؟"))) return false;
        sub.status = "draft"; sub.reopenedAt = new Date().toISOString(); delete sub.declaration; await B.saveSub(inv.token, sub); toast("تمت إعادة فتح النموذج"); render(); } }] : []),
      { label: "تعديل", onClick: () => { setTimeout(() => editInvite(inv)); } },
      { label: inv.active === false ? "تفعيل الدعوة" : "إيقاف الدعوة", onClick: async () => { inv.active = inv.active === false; await B.saveInvite(inv); toast(inv.active ? "تم التفعيل" : "تم إيقاف الدعوة"); render(); } },
      { label: "حذف", kind: "danger", onClick: async () => {
        if (!(await confirmBox("حذف المشرف", `سيتم حذف الدعوة${sub ? ` وبيانات ${sub.employees?.length || 0} موظف أدخلها المشرف` : ""} نهائيًا. لا يمكن التراجع.`, "حذف نهائي", "danger"))) return false;
        await B.deleteInvite(inv.token); if (sub) await B.deleteSub(inv.token);
        INVITES = INVITES.filter(i => i.token !== inv.token); delete SUBS[inv.token]; toast("تم الحذف"); render(); } }
    ] });
}
async function editInvite(inv) {
  const r = await modal({ title: "تعديل بيانات المشرف", html: `<div class="grid">
    <div class="field"><label>الاسم</label><input id="m-n" class="input" value="${esc(inv.name)}"></div>
    <div class="field"><label>الجوال</label><input id="m-p" class="input ltr" value="${esc(inv.phone)}"></div>
    <div class="field"><label>الفرع</label><select id="m-b" class="input">${CFG.branches.map(b => `<option value="${b.id}" ${b.id === inv.branchId ? "selected" : ""}>${esc(b.name)}</option>`).join("")}</select></div>
    <div class="field"><label>القسم</label><select id="m-d" class="input">${CFG.departments.map(d => `<option value="${esc(d.code)}" ${String(d.code) === String(inv.deptCode) ? "selected" : ""}>${esc(deptLabel(d))}</option>`).join("")}</select></div></div>`,
    actions: [{ label: "إلغاء", kind: "ghost" }, { label: "حفظ", kind: "primary", onClick: w => ({ name: cleanText($("#m-n", w).value), phone: normPhone($("#m-p", w).value), branchId: $("#m-b", w).value, deptCode: $("#m-d", w).value }) }] });
  if (!r || !r.name) return;
  Object.assign(inv, r); await B.saveInvite(inv);
  const sub = SUBS[inv.token]; if (sub && sub.status !== "submitted") { sub.branchId = inv.branchId; sub.deptCode = inv.deptCode; await B.saveSub(inv.token, sub); }
  toast("تم الحفظ"); render();
}
async function bulkImport() {
  const r = await modal({ title: "استيراد قائمة المشرفين", wide: true, html: `
    <p class="hint" style="margin-top:0">انسخ الأعمدة من إكسل والصقها هنا (كل مشرف في سطر) بالترتيب:<br><b>الاسم | رقم الجوال | الفرع | رمز القسم أو اسمه</b><br>
    أسماء الفروع المقبولة: ${CFG.branches.map(b => esc(b.name)).join("، ")}. يمكن تكرار المشرف لأكثر من قسم.</p>
    <textarea id="bi" class="input" style="min-height:240px" placeholder="أحمد محمد العتيبي&#9;0551234567&#9;سكاي مول&#9;27"></textarea><div id="bi-prev" class="hint"></div>`,
    onOpen: w => $("#bi", w).addEventListener("input", () => { const p = parseSup($("#bi", w).value); $("#bi-prev", w).innerHTML = `صالح: <b>${p.ok.length}</b>${p.bad.length ? ` · فيه أخطاء: <b style="color:var(--err)">${p.bad.length}</b><br>${p.bad.slice(0, 8).map(x => esc(x)).join("<br>")}` : ""}`; }),
    actions: [{ label: "إلغاء", kind: "ghost" }, { label: "استيراد", kind: "primary", onClick: w => parseSup($("#bi", w).value) }] });
  if (!r || !r.ok.length) return;
  const fresh = r.ok.filter(n => !INVITES.some(i => i.phone === n.phone && i.branchId === n.branchId && String(i.deptCode) === String(n.deptCode)));
  const now = new Date().toISOString();
  fresh.forEach(n => Object.assign(n, { token: token(), active: true, createdAt: now }));
  await B.saveInvites(fresh); INVITES.push(...fresh);
  toast(`تم استيراد ${fresh.length} مشرف${r.ok.length - fresh.length ? ` (تخطي ${r.ok.length - fresh.length} مكرر)` : ""}`, "ok", 4000); render();
}
function parseSup(text) {
  const ok = [], bad = [];
  text.split(/\r?\n/).forEach((line, n) => {
    if (!cleanText(line)) return;
    const c = line.split(/\t|;|\|/).map(cleanText);
    if (/^(الاسم|اسم المشرف)$/.test(c[0])) return;
    const name = c[0], phone = normPhone(c[1]);
    const bq = normName(c[2] || "");
    const b = CFG.branches.find(x => normName(x.name) === bq) || CFG.branches.find(x => bq && (normName(x.name).includes(bq) || bq.includes(normName(x.name))));
    const dq = cleanText(c[3] || "");
    const d = CFG.departments.find(x => String(x.code) === cleanNum(dq) && cleanNum(dq)) || CFG.departments.find(x => normName(x.name) === normName(dq)) ||
      CFG.departments.find(x => dq && normName(x.name).includes(normName(dq)));
    const err = !name ? "الاسم فارغ" : !/^05\d{8}$/.test(phone) ? "رقم الجوال غير صحيح" : !b ? "الفرع غير معروف" : !d ? "القسم غير معروف" : "";
    if (err) bad.push(`سطر ${n + 1}: ${err} — ${line.slice(0, 60)}`); else ok.push({ name, phone, branchId: b.id, deptCode: String(d.code) });
  });
  return { ok, bad };
}
function viewSub(t) {
  const s = SUBS[t]; if (!s) return;
  modal({ title: `${s.supervisor?.name || ""} – ${dName(s.deptCode)} – ${bName(s.branchId)}`, wide: true, html: `
    <p><span class="badge ${s.status === "submitted" ? "b-ok" : "b-info"}">${s.status === "submitted" ? "مُرسل " + esc(fmtDate(s.submittedAt)) : "مسودة"}</span> · ${s.employees?.length || 0} موظف</p>
    <div class="tbl-wrap"><table class="tbl"><thead><tr><th>#</th><th>الاسم</th><th>الرقم الوظيفي</th><th>الوظيفة</th><th>الجنسية</th><th>الهوية</th><th>الحالة</th><th>ملاحظات</th></tr></thead><tbody>
    ${(s.employees || []).map((e, i) => `<tr><td class="num">${i + 1}</td><td>${esc(e.name)}</td><td class="num">${esc(e.empNo)}</td><td>${esc(e.role)}</td><td>${esc(e.nationality)}</td><td class="num">${esc(e.nid)}</td><td>${esc(e.status)}</td><td>${esc(e.notes)}</td></tr>`).join("")}</tbody></table></div>
    ${s.declaration ? `<p style="margin-top:12px"><b>الإقرار:</b> ${esc(s.declaration.name)} · ${esc(fmtDate(s.declaration.agreedAt))}<br><img src="${s.declaration.signature}" alt="التوقيع" style="height:70px;border:1px solid var(--line);border-radius:8px;margin-top:6px"></p>` : ""}`,
    actions: [{ label: "تصدير إكسل", onClick: () => { exportRows(allRows().filter(r => r.token === t), `موظفو_${dName(s.deptCode)}_${bName(s.branchId)}`); return false; } }, { label: "إغلاق", kind: "primary" }] });
}

// ---------------- الموظفون ----------------
function tabEmp(rows, dups) {
  const f = F.emp, di = dupIndex(dups);
  T().innerHTML = `<div class="card">
    <div class="filters">
      <input id="e-q" class="input" placeholder="بحث بالاسم أو الرقم أو الهوية…" value="${esc(f.q)}" style="min-width:220px">
      <select id="e-b" class="input"><option value="">كل الفروع</option>${CFG.branches.map(b => `<option value="${b.id}" ${f.branch === b.id ? "selected" : ""}>${esc(b.name)}</option>`).join("")}</select>
      <select id="e-d" class="input"><option value="">كل الأقسام</option>${CFG.departments.map(d => `<option value="${esc(d.code)}" ${f.dept === String(d.code) ? "selected" : ""}>${esc(deptLabel(d))}</option>`).join("")}</select>
      <select id="e-s" class="input"><option value="">كل الحالات الوظيفية</option>${CFG.statuses.map(s => `<option ${f.status === s ? "selected" : ""}>${esc(s)}</option>`).join("")}</select>
      <select id="e-n" class="input"><option value="">كل الجنسيات</option>${CFG.nationalities.map(s => `<option ${f.nat === s ? "selected" : ""}>${esc(s)}</option>`).join("")}</select>
      <select id="e-sub" class="input"><option value="">مرسل ومسودة</option><option value="submitted" ${f.sub === "submitted" ? "selected" : ""}>المرسل فقط</option><option value="draft" ${f.sub === "draft" ? "selected" : ""}>المسودات فقط</option></select>
      <label class="check" style="font-weight:500;font-size:14px;align-self:center"><input type="checkbox" id="e-i" ${f.issues ? "checked" : ""}> فيه تنبيه فقط</label>
      <div style="flex:1"></div><button id="x-emp" class="btn sm">⬇ تصدير النتائج إلى إكسل</button></div>
    <div id="emp-tbl"></div></div>`;
  let filtered = [];
  const draw = () => {
    const q = normName(f.q), qn = cleanNum(f.q);
    filtered = rows.filter(r => (!f.branch || r.branchId === f.branch) && (!f.dept || String(r.deptCode) === f.dept) && (!f.status || r.status === f.status) &&
      (!f.nat || r.nationality === f.nat) && (!f.sub || r.subStatus === f.sub) &&
      (!q || normName(r.name).includes(q) || (qn && (cleanNum(r.empNo).includes(qn) || cleanNum(r.nid).includes(qn)))));
    filtered = filtered.map(r => ({ ...r, _iss: [...validateEmployee(r).map(x => x.msg), ...(di.get(r.token + r.id) || [])] }));
    if (f.issues) filtered = filtered.filter(r => r._iss.length);
    const shown = filtered.slice(0, 1500);
    $("#emp-tbl").innerHTML = !filtered.length ? `<div class="empty"><b>لا توجد نتائج</b></div>` : `
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>#</th><th>الاسم</th><th>الرقم الوظيفي</th><th>الوظيفة</th><th>الجنسية</th><th>رقم الهوية</th><th>الحالة</th><th>الفرع</th><th>القسم</th><th>المشرف</th><th>النموذج</th><th>تنبيهات</th></tr></thead><tbody>
      ${shown.map((r, i) => `<tr><td class="num">${i + 1}</td><td><b>${esc(r.name)}</b>${r.notes ? `<div class="hint">📝 ${esc(r.notes)}</div>` : ""}</td><td class="num">${esc(r.empNo || "—")}</td><td>${esc(r.role || "—")}</td><td>${esc(r.nationality || "—")}</td>
        <td class="num">${esc(r.nid || "—")}</td><td>${esc(r.status || "—")}</td><td>${esc(bName(r.branchId))}</td><td>${esc(dName(r.deptCode))}</td><td>${esc(r.supervisor)}</td>
        <td><span class="badge ${r.subStatus === "submitted" ? "b-ok" : "b-info"}">${r.subStatus === "submitted" ? "مرسل" : "مسودة"}</span></td>
        <td class="wrap">${r._iss.map(x => `<span class="badge b-warn" style="margin:1px">${esc(x)}</span>`).join("")}</td></tr>`).join("")}</tbody></table></div>
      <p class="hint">النتائج: ${filtered.length}${filtered.length > shown.length ? ` (يُعرض أول ${shown.length} – التصدير يشمل الكل)` : ""}</p>`;
  };
  draw();
  const on = (id, k, ev = "change", fn = e => e.target.value) => $(id).addEventListener(ev, e => { f[k] = fn(e); draw(); });
  on("#e-q", "q", "input"); on("#e-b", "branch"); on("#e-d", "dept"); on("#e-s", "status"); on("#e-n", "nat"); on("#e-sub", "sub"); on("#e-i", "issues", "change", e => e.target.checked);
  $("#x-emp").onclick = () => exportRows(filtered, "الموظفون");
}

// ---------------- المكرر ----------------
function tabDup(rows, dups) {
  const issues = rows.map(r => ({ r, iss: validateEmployee(r) })).filter(x => x.iss.length);
  T().innerHTML = `
  <div class="banner info">يعرض هذا القسم الموظفين المكررين على مستوى الشركة كلها (بين الأقسام والفروع والمشرفين)، وهو ما لا يراه المشرف داخل قسمه.</div>
  <div class="card"><div class="row between"><h2>المكرر على مستوى الشركة (${dups.length} مجموعة)</h2><button id="x-dup" class="btn sm">⬇ تصدير إكسل</button></div>
  ${!dups.length ? `<div class="empty"><b>لا يوجد تكرار</b></div>` : `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>نوع التكرار</th><th>القيمة</th><th>الاسم</th><th>الرقم الوظيفي</th><th>الفرع</th><th>القسم</th><th>المشرف</th></tr></thead><tbody>
  ${dups.map(g => g.list.map((r, k) => `<tr ${k === 0 ? 'style="border-top:2px solid var(--gold-m)"' : ""}>${k === 0 ? `<td rowspan="${g.list.length}"><span class="badge b-warn">${g.type}</span><div class="hint">${g.list.length} مرات</div></td><td rowspan="${g.list.length}">${esc(g.type === "الاسم" ? g.list[0].name : g.key)}</td>` : ""}
    <td>${esc(r.name)}</td><td class="num">${esc(r.empNo || "—")}</td><td>${esc(bName(r.branchId))}</td><td>${esc(dName(r.deptCode))}</td><td>${esc(r.supervisor)}</td></tr>`).join("")).join("")}</tbody></table></div>`}</div>
  <div class="card"><h2>بيانات تحتاج تدقيقًا (${issues.length})</h2>
  ${!issues.length ? `<div class="empty">لا توجد ملاحظات.</div>` : `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>الاسم</th><th>الفرع</th><th>القسم</th><th>الملاحظة</th></tr></thead><tbody>
  ${issues.map(({ r, iss }) => `<tr><td>${esc(r.name || "—")}</td><td>${esc(bName(r.branchId))}</td><td>${esc(dName(r.deptCode))}</td><td class="wrap">${iss.map(x => esc(x.msg)).join("<br>")}</td></tr>`).join("")}</tbody></table></div>`}</div>`;
  $("#x-dup").onclick = () => exportSheets([{ name: "المكرر", rows: dups.flatMap(g => g.list.map(r => ({ "نوع التكرار": g.type, "القيمة المكررة": g.type === "الاسم" ? g.list[0].name : g.key, "الاسم": r.name, "الرقم الوظيفي": r.empNo, "رقم الهوية": r.nid, "الفرع": bName(r.branchId), "القسم": dName(r.deptCode), "رمز القسم": r.deptCode, "المشرف": r.supervisor }))) }], "المكرر");
}

// ---------------- الإقرارات ----------------
function tabDec() {
  const f = F.dec;
  const L = Object.values(SUBS).filter(s => s.status === "submitted" && (!f.branch || s.branchId === f.branch)).sort((a, b) => (b.submittedAt || "").localeCompare(a.submittedAt || ""));
  T().innerHTML = `<div class="card"><div class="filters">
    <select id="d-b" class="input"><option value="">كل الفروع</option>${CFG.branches.map(b => `<option value="${b.id}" ${f.branch === b.id ? "selected" : ""}>${esc(b.name)}</option>`).join("")}</select>
    <div style="flex:1"></div><button id="x-dec" class="btn sm">⬇ تصدير سجل الإقرارات</button><button id="p-dec" class="btn sm">🖨 طباعة الإقرارات</button></div>
    ${!L.length ? `<div class="empty"><b>لا توجد إقرارات بعد</b></div>` : `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>المُقر</th><th>الفرع</th><th>القسم</th><th class="num">الموظفون</th><th>تاريخ الإرسال</th><th>الالتزام</th><th>تنبيهات مؤكدة</th><th>التوقيع</th><th></th></tr></thead><tbody>
    ${L.map(s => `<tr><td><b>${esc(s.declaration?.name || s.supervisor?.name)}</b><div class="hint ltr">${esc(s.supervisor?.phone || "")}</div></td><td>${esc(bName(s.branchId))}</td><td>${esc(dName(s.deptCode))}</td>
      <td class="num">${s.employees?.length || 0}</td><td>${esc(fmtDate(s.submittedAt))}</td><td>${s.late ? '<span class="badge b-warn">متأخر</span>' : '<span class="badge b-ok">في الموعد</span>'}</td>
      <td class="num">${s.declaration?.warningsAcknowledged || 0}</td><td>${s.declaration?.signature ? `<img src="${s.declaration.signature}" alt="" style="height:38px">` : "—"}</td>
      <td><button class="btn sm" data-v="${s.token}">عرض</button></td></tr>`).join("")}</tbody></table></div>`}</div>`;
  $("#d-b").onchange = e => { f.branch = e.target.value; tabDec(); };
  $$("[data-v]").forEach(b => b.onclick = () => viewSub(b.dataset.v));
  $("#x-dec").onclick = () => exportSheets([{ name: "الإقرارات", rows: L.map(s => ({ "المُقر": s.declaration?.name, "جوال المشرف": s.supervisor?.phone, "الرقم الوظيفي للمشرف": s.supervisor?.empNo, "الفرع": bName(s.branchId), "القسم": dName(s.deptCode), "رمز القسم": s.deptCode, "عدد الموظفين": s.employees?.length || 0, "تاريخ الإرسال": fmtDate(s.submittedAt), "الالتزام بالموعد": s.late ? "متأخر" : "في الموعد", "تنبيهات أكدها المشرف": s.declaration?.warningsAcknowledged || 0 })) }], "سجل_الإقرارات");
  $("#p-dec").onclick = () => printHTML(`<div class="rp"><img class="rp-banner" src="${IMG.banner}" alt=""><h1>سجل إقرارات صحة بيانات الموظفين</h1><div class="meta-line">${f.branch ? esc(bName(f.branch)) : "جميع الفروع"} · ${esc(fmtDate(new Date().toISOString()))}</div>
    <table><thead><tr><th>#</th><th>المُقر</th><th>الفرع</th><th>القسم</th><th>الموظفون</th><th>تاريخ الإرسال</th><th>التوقيع</th></tr></thead><tbody>
    ${L.map((s, i) => `<tr><td>${i + 1}</td><td>${esc(s.declaration?.name)}</td><td>${esc(bName(s.branchId))}</td><td>${esc(dName(s.deptCode))}</td><td>${s.employees?.length || 0}</td><td>${esc(fmtDate(s.submittedAt))}</td><td class="sig"><img src="${s.declaration?.signature || ""}" alt=""></td></tr>`).join("")}</tbody></table>${rpFoot()}</div>`);
}

// ---------------- المواعيد ----------------
function tabDl() {
  const toLocal = iso => { if (!iso) return ""; const d = new Date(iso); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
  T().innerHTML = `<div class="card"><h2>المهلة المحددة لكل فرع</h2><p class="sub">يظهر للمشرف عدّاد تنازلي بالوقت المتبقي، ويمكنك تعديله في أي وقت. المشرف الذي يرسل بعد الموعد يُعلَّم «متأخر».</p>
    <div class="tbl-wrap"><table class="tbl"><thead><tr><th>الفرع</th><th>آخر موعد</th><th>المتبقي</th><th>تمديد سريع</th><th></th></tr></thead><tbody>
    ${CFG.branches.map(b => { const dl = CFG.deadlines?.[b.id], c = countdown(dl); return `<tr data-b="${b.id}"><td><b>${esc(b.name)}</b></td>
      <td><input type="datetime-local" class="input" style="height:38px;width:auto" value="${toLocal(dl)}"></td>
      <td>${!dl ? '<span class="badge b-muted">غير محدد</span>' : c.over ? '<span class="badge b-err">انتهت</span>' : `<span class="badge ${c.urgent ? "b-warn" : "b-info"}">${c.d} يوم ${c.h} ساعة ${c.m} دقيقة</span>`}</td>
      <td><div class="row" style="gap:4px;flex-wrap:nowrap">${[1, 3, 7].map(n => `<button class="btn sm" data-add="${n}">+${n} ${n === 1 ? "يوم" : "أيام"}</button>`).join("")}</div></td>
      <td><button class="btn sm ghost" data-clear>إلغاء الموعد</button></td></tr>`; }).join("")}</tbody></table></div>
    <div class="row" style="margin-top:12px"><span class="hint" style="margin:0">تطبيق موعد واحد على كل الفروع:</span><input type="datetime-local" id="dl-all" class="input" style="height:38px;width:auto"><button id="dl-all-btn" class="btn sm">تطبيق على الكل</button></div>
    <div class="row end" style="margin-top:14px"><button id="dl-save" class="btn primary">حفظ المواعيد</button></div></div>`;
  $$("[data-add]").forEach(b => b.onclick = () => {
    const inp = $("input", b.closest("tr")); const base = inp.value ? new Date(inp.value) : new Date(); if (!inp.value) base.setHours(23, 59, 0, 0);
    base.setDate(base.getDate() + +b.dataset.add); inp.value = toLocal(base.toISOString());
  });
  $$("[data-clear]").forEach(b => b.onclick = () => $("input", b.closest("tr")).value = "");
  $("#dl-all-btn").onclick = () => { const v = $("#dl-all").value; if (!v) return toast("اختر التاريخ أولًا", "err"); $$("tr[data-b] input").forEach(i => i.value = v); };
  $("#dl-save").onclick = async () => {
    const d = {}; $$("tr[data-b]").forEach(tr => { const v = $("input", tr).value; if (v) d[tr.dataset.b] = new Date(v).toISOString(); });
    CFG.deadlines = d; await B.saveConfig(CFG); toast("تم حفظ المواعيد"); tabDl();
  };
}

// ---------------- تقارير الفروع ----------------
function tabRep(rows, dups) {
  if (!reportBranch) reportBranch = CFG.branches[0]?.id || "";
  T().innerHTML = `<div class="card no-print"><div class="filters">
    <select id="r-b" class="input">${CFG.branches.map(b => `<option value="${b.id}" ${reportBranch === b.id ? "selected" : ""}>${esc(b.name)}</option>`).join("")}</select>
    <label class="check" style="font-weight:500;font-size:14px;align-self:center"><input type="checkbox" id="r-emp" checked> تضمين قوائم الموظفين</label>
    <label class="check" style="font-weight:500;font-size:14px;align-self:center"><input type="checkbox" id="r-draft"> تضمين المسودات غير المرسلة</label>
    <div style="flex:1"></div><button id="r-x" class="btn sm">⬇ إكسل الفرع</button><button id="r-p" class="btn primary sm">🖨 طباعة / حفظ PDF</button></div></div>
    <div class="card" id="r-prev" style="overflow:auto"></div>`;
  const draw = () => { $("#r-prev").innerHTML = branchReport(reportBranch, $("#r-emp").checked, $("#r-draft").checked, rows, dups); };
  draw();
  $("#r-b").onchange = e => { reportBranch = e.target.value; draw(); };
  $("#r-emp").onchange = draw; $("#r-draft").onchange = draw;
  $("#r-p").onclick = () => printHTML($("#r-prev").innerHTML);
  $("#r-x").onclick = () => exportRows(rows.filter(r => r.branchId === reportBranch), `فرع_${bName(reportBranch)}`);
}
function rpFoot() { return `<div class="foot"><span>${esc(APP.companyName || "")} – ${esc(APP.projectName || "")}</span><span>إعداد: ${esc(APP.preparedBy || "")} – ${esc(APP.preparedByTitle || "")}</span></div>`; }
function branchReport(bid, withEmp, withDraft, allR, dups) {
  const b = branch(bid); if (!b) return "";
  const inv = INVITES.filter(i => i.branchId === bid && i.active !== false);
  const subs = inv.map(i => SUBS[i.token]).filter(Boolean);
  const done = inv.filter(i => supStatus(i).k === "done");
  const rows = allR.filter(r => r.branchId === bid && (withDraft || r.subStatus === "submitted"));
  const di = dupIndex(dups); const dupN = rows.filter(r => di.has(r.token + r.id)).length;
  const cnt = key => { const m = {}; rows.forEach(r => { const k = r[key] || "غير محدد"; m[k] = (m[k] || 0) + 1; }); return Object.entries(m).sort((a, b) => b[1] - a[1]); };
  const dl = CFG.deadlines?.[bid];
  const depts = [...new Set(inv.map(i => String(i.deptCode)))].map(c => dept(c) || { code: c, name: dName(c) });
  const notCovered = CFG.departments.filter(d => !depts.some(x => String(x.code) === String(d.code)));
  return `<div class="rp">
  <div class="rp-page"><img class="rp-banner" src="${IMG.banner}" alt="">
    <h1>تقرير حصر وتحديث بيانات الموظفين</h1>
    <div class="meta-line">فرع <b>${esc(b.name)}</b> – منطقة ${esc(b.region)} · تاريخ التقرير: ${esc(fmtDate(new Date().toISOString(), false))}${dl ? ` · المهلة: ${esc(fmtDate(dl))}` : ""}</div>
    <div class="kpis">
      <div class="kpi"><b>${rows.length}</b>إجمالي الموظفين</div><div class="kpi"><b>${depts.length}</b>قسم مشمول</div>
      <div class="kpi"><b>${done.length} / ${inv.length}</b>مشرف أرسل الإقرار</div><div class="kpi"><b>${pct(done.length, inv.length)}%</b>نسبة الإنجاز</div>
      <div class="kpi"><b>${rows.filter(r => !r.empNo).length}</b>بدون رقم وظيفي</div><div class="kpi"><b>${rows.filter(r => !r.nid).length}</b>بدون رقم هوية</div>
      <div class="kpi"><b>${dupN}</b>سجل مكرر</div><div class="kpi"><b>${subs.filter(s => s.late).length}</b>إقرار متأخر</div>
    </div>
    <h2>ملخص الأقسام والمشرفين</h2>
    <table><thead><tr><th>القسم</th><th>الرمز</th><th>المشرف</th><th>الجوال</th><th>الحالة</th><th>الموظفون</th><th>تاريخ الإقرار</th></tr></thead><tbody>
    ${inv.sort((a, b) => dName(a.deptCode).localeCompare(dName(b.deptCode), "ar")).map(i => { const s = SUBS[i.token], st = supStatus(i); return `<tr><td>${esc(dName(i.deptCode))}</td><td>${esc(i.deptCode)}</td><td>${esc(s?.supervisor?.name || i.name)}</td><td>${esc(i.phone)}</td><td>${st.t}</td><td>${s?.employees?.length || 0}</td><td>${s?.submittedAt ? esc(fmtDate(s.submittedAt, false)) : "—"}</td></tr>`; }).join("") || `<tr><td colspan="7">لا يوجد مشرفون مضافون لهذا الفرع.</td></tr>`}</tbody></table>
    <h3>التوزيع حسب الحالة الوظيفية</h3>
    <table><thead><tr>${cnt("status").map(([k]) => `<th>${esc(k)}</th>`).join("")}</tr></thead><tbody><tr>${cnt("status").map(([, v]) => `<td>${v}</td>`).join("")}</tr></tbody></table>
    <h3>التوزيع حسب الجنسية</h3>
    <table><thead><tr>${cnt("nationality").slice(0, 10).map(([k]) => `<th>${esc(k)}</th>`).join("")}</tr></thead><tbody><tr>${cnt("nationality").slice(0, 10).map(([, v]) => `<td>${v}</td>`).join("")}</tr></tbody></table>
    ${notCovered.length && notCovered.length < CFG.departments.length ? `<h3>أقسام لا يوجد لها مشرف في هذا الفرع (${notCovered.length})</h3><p>${notCovered.map(d => esc(deptLabel(d))).join("، ")}</p>` : ""}
    ${rpFoot()}
  </div>
  ${withEmp ? depts.map(d => {
    const L = rows.filter(r => String(r.deptCode) === String(d.code)); if (!L.length) return "";
    return `<div class="rp-page"><h2>${esc(d.name)} (${esc(d.code)}) – ${L.length} موظف</h2>
      <table><thead><tr><th>#</th><th>الاسم</th><th>الرقم الوظيفي</th><th>الوظيفة</th><th>الجنسية</th><th>رقم الهوية</th><th>الحالة</th><th>ملاحظات</th></tr></thead><tbody>
      ${L.map((r, i) => `<tr><td>${i + 1}</td><td>${esc(r.name)}${di.has(r.token + r.id) ? " ⚠" : ""}</td><td>${esc(r.empNo)}</td><td>${esc(r.role)}</td><td>${esc(r.nationality)}</td><td>${esc(r.nid)}</td><td>${esc(r.status)}</td><td>${esc(r.notes)}</td></tr>`).join("")}</tbody></table>
      ${subs.filter(s => String(s.deptCode) === String(d.code) && s.declaration).map(s => `<p class="sig">إقرار المشرف: <b>${esc(s.declaration.name)}</b> بتاريخ ${esc(fmtDate(s.declaration.agreedAt))} &nbsp; <img src="${s.declaration.signature}" alt=""></p>`).join("")}
      </div>`; }).join("") : ""}
  <div class="rp-page"><h2>الاعتماد</h2>
    <p style="line-height:2">تم إعداد هذا التقرير من بيانات منصة حصر الموظفين بعد تعبئتها من مشرفي الأقسام وتوقيعهم على الإقرار بصحة البيانات. ⚠ تعني سجلًا مكررًا على مستوى الشركة يحتاج تدقيقًا.</p>
    <table style="margin-top:30px"><tbody><tr><td style="height:70px;width:50%"><b>إعداد:</b> ${esc(APP.preparedBy || "")}<br>${esc(APP.preparedByTitle || "")}<br><br>التوقيع: ....................</td><td><b>اعتماد الإدارة العليا:</b><br><br><br>التوقيع: ....................</td></tr></tbody></table>
    ${rpFoot()}</div></div>`;
}
function printHTML(html) {
  $("#print-area").innerHTML = html; document.body.classList.add("printing");
  const imgs = $$("#print-area img"); let left = imgs.length;
  const go = () => { window.print(); document.body.classList.remove("printing"); };
  if (!left) return setTimeout(go, 100);
  imgs.forEach(i => { if (i.complete) { if (--left === 0) setTimeout(go, 100); } else i.onload = i.onerror = () => { if (--left === 0) setTimeout(go, 100); }; });
}

// ---------------- الإعدادات ----------------
function tabSet() {
  T().innerHTML = `
  <div class="card"><h2>الفروع</h2><p class="sub">يمكن إضافة فرع جديد أو تعديل اسم فرع. (المعرّف ثابت ولا يُعدّل بعد إنشاء الدعوات.)</p>
    <div class="tbl-wrap"><table class="tbl" id="t-br"><thead><tr><th>المعرف</th><th>اسم الفرع</th><th>المنطقة</th><th></th></tr></thead><tbody>
    ${CFG.branches.map(b => `<tr><td class="ltr">${esc(b.id)}</td><td><input class="input" style="height:38px" data-k="name" value="${esc(b.name)}"></td><td><input class="input" style="height:38px" data-k="region" value="${esc(b.region)}"></td><td><button class="btn sm danger" data-delb>حذف</button></td></tr>`).join("")}</tbody></table></div>
    <div class="row" style="margin-top:10px"><button id="add-br" class="btn sm">+ إضافة فرع</button></div></div>
  <div class="card"><h2>الأقسام</h2><p class="sub">الرمز وعدد الموظفين في النظام يُستخدمان في المقارنة بلوحة الرئيسية.</p>
    <div class="tbl-wrap" style="max-height:420px"><table class="tbl" id="t-dp"><thead><tr><th>الرمز</th><th>اسم القسم</th><th>العدد في النظام</th><th></th></tr></thead><tbody>
    ${CFG.departments.map(d => `<tr><td><input class="input ltr" style="height:38px;width:90px" data-k="code" value="${esc(d.code)}"></td><td><input class="input" style="height:38px" data-k="name" value="${esc(d.name)}"></td><td><input class="input ltr" style="height:38px;width:90px" data-k="sys" value="${esc(d.sys)}"></td><td><button class="btn sm danger" data-deld>حذف</button></td></tr>`).join("")}</tbody></table></div>
    <div class="row" style="margin-top:10px"><button id="add-dp" class="btn sm">+ إضافة قسم</button></div></div>
  <div class="two-col">
    <div class="card"><h2>الوظائف (القائمة المنسدلة)</h2><textarea id="l-roles" class="input" style="min-height:220px">${esc(CFG.roles.join("\n"))}</textarea><p class="hint">كل وظيفة في سطر. يستطيع المشرف كتابة وظيفة غير موجودة.</p></div>
    <div class="card"><h2>الحالات الوظيفية</h2><textarea id="l-st" class="input" style="min-height:120px">${esc(CFG.statuses.join("\n"))}</textarea>
      <h2 style="margin-top:12px">الجنسيات</h2><textarea id="l-nat" class="input" style="min-height:120px">${esc(CFG.nationalities.join("\n"))}</textarea></div>
  </div>
  <div class="card"><h2>نص رسالة الدعوة</h2><p class="sub">المتغيرات: {الاسم} {القسم} {الفرع} {الرابط} {الرمز} {الموعد}</p>
    <textarea id="l-tpl" class="input" style="min-height:260px">${esc(CFG.inviteTemplate)}</textarea>
    <div class="row" style="margin-top:8px"><button id="tpl-reset" class="btn sm ghost">استعادة النص الافتراضي</button></div></div>
  <div class="row between"><div class="row"><button id="bk" class="btn">⬇ نسخة احتياطية كاملة (JSON)</button></div><button id="set-save" class="btn primary">حفظ الإعدادات</button></div>`;
  $("#add-br").onclick = () => { $("#t-br tbody").insertAdjacentHTML("beforeend", `<tr><td class="ltr">جديد</td><td><input class="input" style="height:38px" data-k="name"></td><td><input class="input" style="height:38px" data-k="region"></td><td><button class="btn sm danger" data-delb>حذف</button></td></tr>`); bindDel(); };
  $("#add-dp").onclick = () => { $("#t-dp tbody").insertAdjacentHTML("beforeend", `<tr><td><input class="input ltr" style="height:38px;width:90px" data-k="code"></td><td><input class="input" style="height:38px" data-k="name"></td><td><input class="input ltr" style="height:38px;width:90px" data-k="sys" value="0"></td><td><button class="btn sm danger" data-deld>حذف</button></td></tr>`); bindDel(); };
  const bindDel = () => {
    $$("[data-delb]").forEach(b => b.onclick = () => { const id = $("td", b.closest("tr")).textContent; if (INVITES.some(i => i.branchId === id)) return toast("لا يمكن حذف فرع لديه مشرفون", "err"); b.closest("tr").remove(); });
    $$("[data-deld]").forEach(b => b.onclick = () => { const c = $("[data-k=code]", b.closest("tr")).value; if (INVITES.some(i => String(i.deptCode) === c)) return toast("لا يمكن حذف قسم لديه مشرفون", "err"); b.closest("tr").remove(); });
  };
  bindDel();
  $("#tpl-reset").onclick = () => $("#l-tpl").value = DEFAULT_TEMPLATE;
  $("#bk").onclick = () => { const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), config: CFG, invites: INVITES, subs: Object.values(SUBS) }, null, 1)], { type: "application/json" }); download(blob, `نسخة_احتياطية_${new Date().toISOString().slice(0, 10)}.json`); };
  $("#set-save").onclick = async () => {
    const lines = id => $(id).value.split(/\r?\n/).map(cleanText).filter(Boolean);
    const branches = $$("#t-br tbody tr").map(tr => { let id = $("td", tr).textContent.trim(); const name = cleanText($("[data-k=name]", tr).value);
      if (id === "جديد") id = "b" + Date.now().toString(36) + Math.random().toString(36).slice(2, 4); return { id, name, region: cleanText($("[data-k=region]", tr).value) }; }).filter(b => b.name);
    const departments = $$("#t-dp tbody tr").map(tr => ({ code: cleanText($("[data-k=code]", tr).value), name: cleanText($("[data-k=name]", tr).value), sys: +cleanNum($("[data-k=sys]", tr).value) || 0 })).filter(d => d.code && d.name);
    const codes = departments.map(d => d.code); if (new Set(codes).size !== codes.length) return toast("يوجد رمز قسم مكرر", "err");
    Object.assign(CFG, { branches, departments, roles: lines("#l-roles"), statuses: lines("#l-st"), nationalities: lines("#l-nat"), inviteTemplate: $("#l-tpl").value });
    await B.saveConfig(CFG); toast("تم حفظ الإعدادات"); render();
  };
}

// ================= تصدير إكسل =================
let XLSXlib = null;
async function loadXLSX() {
  if (XLSXlib) return XLSXlib;
  await new Promise((res, rej) => { const s = document.createElement("script"); s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
  return XLSXlib = window.XLSX;
}
function download(blob, name) { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); }
async function exportSheets(sheets, fname) {
  const stamp = new Date().toISOString().slice(0, 10);
  try {
    const X = await loadXLSX();
    const wb = X.utils.book_new(); wb.Workbook = { Views: [{ RTL: true }] };
    sheets.forEach(sh => {
      const ws = X.utils.json_to_sheet(sh.rows.length ? sh.rows : [{ "لا توجد بيانات": "" }]);
      const keys = Object.keys(sh.rows[0] || { x: 1 });
      ws["!cols"] = keys.map(k => ({ wch: Math.min(40, Math.max(k.length + 2, ...sh.rows.slice(0, 300).map(r => String(r[k] ?? "").length + 2))) }));
      ws["!autofilter"] = { ref: ws["!ref"] };
      X.utils.book_append_sheet(wb, ws, sh.name.slice(0, 31));
    });
    X.writeFile(wb, `${fname}_${stamp}.xlsx`);
  } catch (e) {
    console.warn("XLSX unavailable, CSV fallback", e);
    const sh = sheets[0], keys = Object.keys(sh.rows[0] || {});
    const csv = [keys, ...sh.rows.map(r => keys.map(k => r[k] ?? ""))].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\r\n");
    download(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }), `${fname}_${stamp}.csv`);
  }
  toast("تم تجهيز الملف");
}
const empRow = r => ({ "الاسم": r.name, "الرقم الوظيفي": r.empNo, "الوظيفة": r.role, "الجنسية": r.nationality, "رقم الهوية/الإقامة": r.nid, "الحالة الوظيفية": r.status,
  "الفرع": bName(r.branchId), "المنطقة": branch(r.branchId)?.region || "", "القسم": dName(r.deptCode), "رمز القسم": r.deptCode, "المشرف": r.supervisor,
  "حالة النموذج": r.subStatus === "submitted" ? "مرسل" : "مسودة", "ملاحظات": r.notes, "تنبيهات": (r._iss || validateEmployee(r).map(x => x.msg)).join(" | ") });
function exportRows(rows, fname) { exportSheets([{ name: "الموظفون", rows: rows.map(empRow) }], fname); }
function supRow(i) { const s = SUBS[i.token]; return { "المشرف": i.name, "الجوال": i.phone, "الفرع": bName(i.branchId), "القسم": dName(i.deptCode), "رمز القسم": i.deptCode,
  "رمز الدعوة": fmtCode(i.token), "رابط الدعوة": inviteLink(i.token), "الحالة": supStatus(i).t, "عدد الموظفين": s?.employees?.length || 0,
  "آخر تحديث": s?.updatedAt ? fmtDate(s.updatedAt) : "", "تاريخ الإرسال": s?.submittedAt ? fmtDate(s.submittedAt) : "", "أُرسلت الدعوة": i.sentAt ? "نعم" : "لا" }; }
function exportSupervisors() { exportSheets([{ name: "المشرفون", rows: INVITES.map(supRow) }], "المشرفون_والدعوات"); }
function exportAll() {
  const rows = allRows(), dups = companyDups(rows), di = dupIndex(dups);
  const summary = CFG.branches.map(b => { const inv = INVITES.filter(i => i.branchId === b.id && i.active !== false), d = inv.filter(i => supStatus(i).k === "done").length;
    return { "الفرع": b.name, "المنطقة": b.region, "المشرفون": inv.length, "أرسلوا": d, "نسبة الإنجاز %": pct(d, inv.length), "الموظفون": rows.filter(r => r.branchId === b.id).length, "المهلة": CFG.deadlines?.[b.id] ? fmtDate(CFG.deadlines[b.id]) : "" }; });
  const cmp = CFG.departments.map(d => { const e = rows.filter(r => String(r.deptCode) === String(d.code)).length; return { "القسم": d.name, "الرمز": d.code, "في النظام": +d.sys || 0, "المُدخل": e, "الفرق": e - (+d.sys || 0) }; });
  exportSheets([
    { name: "ملخص الفروع", rows: summary },
    { name: "الموظفون", rows: rows.map(r => ({ ...empRow(r), "مكرر على مستوى الشركة": (di.get(r.token + r.id) || []).join(" | ") })) },
    { name: "المشرفون", rows: INVITES.map(supRow) },
    { name: "مقارنة مع النظام", rows: cmp },
    { name: "المكرر", rows: dups.flatMap(g => g.list.map(r => ({ "نوع التكرار": g.type, "الاسم": r.name, "الرقم الوظيفي": r.empNo, "رقم الهوية": r.nid, "الفرع": bName(r.branchId), "القسم": dName(r.deptCode), "المشرف": r.supervisor }))) }
  ], "حصر_الموظفين_الشامل");
}
