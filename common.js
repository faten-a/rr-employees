// أدوات مشتركة
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩", FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
export function toLatinDigits(s) {
  return String(s ?? "").replace(/[٠-٩]/g, d => AR_DIGITS.indexOf(d)).replace(/[۰-۹]/g, d => FA_DIGITS.indexOf(d));
}
export function normName(s) {
  return String(s ?? "")
    .replace(/[ً-ٰٟـ]/g, "")
    .replace(/[أإآٱ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").replace(/ؤ/g, "و").replace(/ئ/g, "ي")
    .replace(/[^\p{L}\p{N} ]/gu, " ")
    .replace(/\s+/g, " ").replace(/\b(عبد|ابو|بن) (?=\S)/g, "$1").replace(/(^| )(عبد|ابو) /g, "$1$2").trim().toLowerCase();
}
export function cleanText(s) { return String(s ?? "").replace(/\s+/g, " ").trim(); }
export function cleanNum(s) { return toLatinDigits(s).replace(/[^0-9]/g, ""); }

export function lev(a, b) {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (Math.abs(m - n) > 2) return 99;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (cur[j] < rowMin) rowMin = cur[j];
    }
    if (rowMin > 2) return 99;
    prev = cur;
  }
  return prev[n];
}

// تحقق من موظف واحد: يرجع قائمة تنبيهات {level:'err'|'warn', msg}
export function validateEmployee(e) {
  const out = [];
  const name = cleanText(e.name);
  if (!name) out.push({ level: "err", msg: "اسم الموظف مطلوب" });
  else {
    if (name.split(" ").length < 3) out.push({ level: "warn", msg: "يُفضّل كتابة الاسم ثلاثيًا على الأقل" });
    if (/[0-9٠-٩]/.test(name)) out.push({ level: "warn", msg: "الاسم يحتوي على أرقام" });
  }
  const id = cleanNum(e.nid);
  if (e.nid && (id.length !== 10 || !/^[12]/.test(id))) out.push({ level: "warn", msg: "رقم الهوية/الإقامة يجب أن يكون 10 أرقام ويبدأ بـ 1 أو 2" });
  if (e.empNo && cleanNum(e.empNo) !== toLatinDigits(String(e.empNo)).trim()) out.push({ level: "warn", msg: "الرقم الوظيفي يجب أن يكون أرقامًا فقط" });
  if (id && e.nationality) {
    if (e.nationality === "سعودي" && id[0] === "2") out.push({ level: "warn", msg: "الهوية تبدأ بـ 2 (إقامة) والجنسية سعودي" });
    if (e.nationality !== "سعودي" && e.nationality !== "أخرى" && id[0] === "1") out.push({ level: "warn", msg: "الرقم يبدأ بـ 1 (هوية وطنية) والجنسية غير سعودي" });
  }
  return out;
}

// كشف المكرر داخل قائمة: يرجع Map(index -> [رسائل])
export function findDuplicates(list, { similar = true } = {}) {
  const res = new Map();
  const add = (i, m) => { if (!res.has(i)) res.set(i, []); if (!res.get(i).includes(m)) res.get(i).push(m); };
  const byKey = (keyFn, label) => {
    const m = new Map();
    list.forEach((e, i) => { const k = keyFn(e); if (!k) return; if (!m.has(k)) m.set(k, []); m.get(k).push(i); });
    for (const idx of m.values()) if (idx.length > 1) idx.forEach(i => add(i, `${label} مكرر (${idx.length} مرات)`));
  };
  byKey(e => normName(e.name), "الاسم");
  byKey(e => cleanNum(e.empNo), "الرقم الوظيفي");
  byKey(e => cleanNum(e.nid), "رقم الهوية");
  if (similar && list.length <= 800) {
    const names = list.map(e => normName(e.name));
    for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) {
      const a = names[i], b = names[j];
      if (!a || !b || a === b || a.length < 8) continue;
      if (lev(a, b) <= 2) { add(i, `اسم مشابه جدًا لـ «${list[j].name}»`); add(j, `اسم مشابه جدًا لـ «${list[i].name}»`); }
    }
  }
  return res;
}

export function token(len = 10) {
  const A = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const a = new Uint32Array(len); crypto.getRandomValues(a);
  return [...a].map(x => A[x % A.length]).join("");
}
export const fmtCode = t => t ? `${t.slice(0, 5)}-${t.slice(5)}` : "";
export const parseCode = s => {
  s = String(s || "").trim();
  const m = s.match(/[?&][ir]=([A-Za-z0-9-]+)/);
  if (m) s = m[1];
  return s.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
};
export function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

export function fmtDate(iso, withTime = true) {
  if (!iso) return "—";
  const d = new Date(iso);
  const o = { year: "numeric", month: "long", day: "numeric" };
  if (withTime) Object.assign(o, { hour: "numeric", minute: "2-digit" });
  return d.toLocaleString("ar-SA-u-ca-gregory-nu-latn", o);
}
export function countdown(iso) {
  if (!iso) return null;
  const ms = new Date(iso) - Date.now();
  if (ms <= 0) return { over: true, text: "انتهت المهلة" };
  const d = Math.floor(ms / 864e5), h = Math.floor(ms % 864e5 / 36e5), m = Math.floor(ms % 36e5 / 6e4);
  return { over: false, d, h, m, urgent: ms < 2 * 864e5 };
}
export const pct = (a, b) => b ? Math.round(a / b * 100) : 0;
export function normPhone(p) {
  let s = cleanNum(p);
  if (s.startsWith("00966")) s = s.slice(5);
  if (s.startsWith("966")) s = s.slice(3);
  if (s.startsWith("5") && s.length === 9) s = "0" + s;
  return s;
}
export const waPhone = p => { const s = normPhone(p); return s.startsWith("05") ? "966" + s.slice(1) : s; };

// ---------- واجهة: تنبيه و نافذة ----------
export function toast(msg, type = "ok", ms = 2600) {
  let box = $("#toasts");
  if (!box) { box = document.createElement("div"); box.id = "toasts"; document.body.appendChild(box); }
  const t = document.createElement("div");
  t.className = `toast ${type}`; t.textContent = msg; box.appendChild(t);
  setTimeout(() => { t.classList.add("out"); setTimeout(() => t.remove(), 300); }, ms);
}
export function modal({ title, html, actions = [], wide = false, onOpen }) {
  return new Promise(resolve => {
    const wrap = document.createElement("div");
    wrap.className = "modal-wrap";
    wrap.innerHTML = `<div class="modal ${wide ? "wide" : ""}" role="dialog" aria-modal="true">
      <div class="modal-head"><h3>${esc(title)}</h3><button class="icon-btn" data-x aria-label="إغلاق">✕</button></div>
      <div class="modal-body">${html}</div>
      <div class="modal-foot"></div></div>`;
    const foot = $(".modal-foot", wrap);
    const close = v => { wrap.remove(); document.removeEventListener("keydown", onKey); resolve(v); };
    actions.forEach(a => {
      const b = document.createElement("button");
      b.className = `btn ${a.kind || ""}`; b.textContent = a.label;
      b.onclick = async () => {
        if (a.onClick) { const r = await a.onClick(wrap); if (r === false) return; close(r === undefined ? a.value : r); }
        else close(a.value);
      };
      foot.appendChild(b);
    });
    if (!actions.length) foot.remove();
    $("[data-x]", wrap).onclick = () => close(null);
    wrap.addEventListener("mousedown", e => { if (e.target === wrap) close(null); });
    const onKey = e => { if (e.key === "Escape") close(null); };
    document.addEventListener("keydown", onKey);
    document.body.appendChild(wrap);
    onOpen && onOpen(wrap);
  });
}
export const confirmBox = (title, msg, okLabel = "تأكيد", kind = "primary") =>
  modal({ title, html: `<p>${msg}</p>`, actions: [{ label: "إلغاء", value: false, kind: "ghost" }, { label: okLabel, value: true, kind }] });

export async function copyText(t) {
  try { await navigator.clipboard.writeText(t); }
  catch {
    const ta = document.createElement("textarea"); ta.value = t; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove();
  }
  toast("تم النسخ");
}

export function footerHTML(cfg) {
  return `<footer class="site-foot"><span>${esc(cfg.companyName || "")}</span><span>إعداد: <b>${esc(cfg.preparedBy || "")}</b></span></footer>`;
}

// تسمية القسم مع رمزه
export const deptLabel = d => d ? `${d.name} (${d.code})` : "";

// رمز شخصي ثابت للمشرف يُشتق من رابط القسم + الجوال + الفرع + القسم (يسمح بالعودة بنفس رقم الجوال)
export async function personalToken(reg, phone, branchId, deptCode) {
  const A = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`rr|${reg}|${phone}|${branchId}|${deptCode}`));
  return [...new Uint8Array(buf)].slice(0, 10).map(x => A[x % A.length]).join("");
}
