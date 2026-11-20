/* ===== Miracles — storefront ===== */
const SB_URL = 'https://sdxubtrdhbkyrfbwlydy.supabase.co';
const SB_KEY = 'sb_publishable_Hx35UbssFXNQ7M60kUWwSQ_AiHE4JP8';

/* v70: رسائل الفشل البسيطة (اتفاق معتز): النت، أو خطأ عام */
const NETMSG = 'تعذر الاتصال بالإنترنت. تأكدي من الاتصال وحاولي مرة أخرى.', ERRMSG = 'حدث خطأ بسيط، يُرجى المحاولة مرة أخرى.';
const NET_MS = 15000, PAY_MS = 25000;   // v70: أقصى انتظار لرد Supabase (15 ث)، والدفع (25 ث)
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function api(path, opts = {}) {
  // v70: مهلة: لو الطلب علّق (ما فيش رد) يفشل بعد 15 ث بخطأ نت عادي، بدل ما الزر يقعد «لحظة...» للأبد
  const { ms, ...o } = opts, ctl = o.signal ? null : new AbortController(), tm = ctl ? setTimeout(() => ctl.abort(), ms || NET_MS) : 0;
  let r, txt;
  try { r = await fetch(SB_URL + path, { ...o, ...(ctl ? { signal: ctl.signal } : {}), headers: { apikey: SB_KEY, ...(o.headers || {}) } }); txt = await r.text() }
  catch (e) { const x = new Error('Failed to fetch'); x.net = true; x.status = 0; throw x }
  finally { clearTimeout(tm) }
  let data = null;
  try { data = txt ? JSON.parse(txt) : null } catch { data = txt }
  if (!r.ok) {
    const d = data && typeof data === 'object' ? data : {}, c = d.error_code || '';   // رسائل Auth تجي في msg و error_code
    const e = new Error((d.message || d.msg || d.error_description || d.error || ('HTTP ' + r.status)) + (c ? ' [' + c + ']' : '')); e.status = r.status; throw e;
  }
  return data;
}
function resizeImage(file, max = 1280, q = .82, type = 'image/jpeg') {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file), im = new Image();
    im.onload = () => {
      const k = Math.min(1, max / Math.max(im.width, im.height));
      const c = document.createElement('canvas');
      c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
      c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      c.toBlob(b => b ? res(b) : rej(new Error('img')), type, q);
    };
    im.onerror = () => { URL.revokeObjectURL(url); rej(new Error('img')) };
    im.src = url;
  });
}
const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d } catch { return d } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch {} };

const ic = n => `<svg class="ic"><use href="#i-${n}"/></svg>`;
const art = n => `<svg viewBox="0 0 200 200" aria-hidden="true"><use href="#a-${esc(n)}"/></svg>`;

const SUBS = {all:'الكل',necklace:'عقود',bracelet:'أساور',ring:'خواتم',bag:'حقائب',watch:'ساعات',clip:'مشابك',tie:'ربطات',book:'دفاتر',pen:'أقلام',audio:'سماعات',control:'تحكم'};
const BGS = {women:'linear-gradient(160deg,#EBDDD0,#D6BFAA)',girls:'linear-gradient(160deg,#FADDE5,#F2BFD0)',study:'linear-gradient(160deg,#F5E4DA,#E0D5D2)',gaming:'linear-gradient(160deg,#1a1a30,#0a0a14)'};
const DEF_BG = 'linear-gradient(160deg,#F1E6DE,#E2D2C6)';
const COVERS = {
  women:[['bracelet',-14,-6,150],['ring',70,56,130],['necklace',-6,60,120]],
  girls:[['bow',-12,-8,140],['bear',78,18,120],['heart',46,86,120]],
  study:[['notebook',-6,-4,140],['pens',70,30,130],['sticky',20,90,110]],
  gaming:[['headphones',-10,-6,150],['mouse',78,70,110]]
};
(function () {
  const defs = document.querySelector('svg[width="0"] defs');
  const stops = {women:['#C9A98A','#8D6D52'],girls:['#F6C3D2','#EDA4BB'],study:['#F3E2D8','#DCCBC4'],gaming:['#1b1b38','#07070f']};
  Object.entries(stops).forEach(([k, s]) => defs.insertAdjacentHTML('beforeend', `<linearGradient id="g-${k}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${s[0]}"/><stop offset="1" stop-color="${s[1]}"/></linearGradient>`));
})();

const phone = document.getElementById('phone');
const state = { cats: [], prods: [], set: {}, ok: false, err: false, live: {}, rate: null };
let curCat = null, curChip = 'all', view = 'home';
let cart = lsGet('mir_cart', []);
const favs = new Set(lsGet('mir_favs', []));
/* v70: نسخة من سلة ومفضلة الجهاز لحظة الفتح، وهل فيه تعديل قديم ما وصلش للسيرفر.
   لما يوصل الحساب: اللي تغيّر في الجلسة هذي بس يتطبّق فوق نسخة السيرفر (loadProfile) */
const cart0 = JSON.parse(JSON.stringify(Array.isArray(cart) ? cart : [])), favs0 = new Set(favs);
const cartDirty0 = lsGet('mir_cart_dirty', false), favDirty0 = lsGet('mir_fav_dirty', false);
let pend = null;

const money = n => Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 }) + ' د.ل';
const byId = id => state.prods.find(p => p.id === id);
const MAXQ = 99; /* max quantity per product in one order */
const MAXLINES = 30; /* أقصى عدد منتجات في السلة (كل لون منتج) */
/* product attributes: one value = info, several = the customer picks one */
const arrOf = v => Array.isArray(v) ? v.map(x => String(x).trim()).filter(Boolean) : [];
function attrsOf(p) {
  const a = (Array.isArray(p.attrs) ? p.attrs : []).map(x => ({ label: String((x && x.label) || '').trim(), values: arrOf(x && x.values) })).filter(x => x.label && x.values.length);
  if (a.length) return a;
  return [{ label: 'المقاس', values: arrOf(p.sizes) }, { label: 'اللون', values: arrOf(p.colors) }].filter(x => x.values.length);
}
const choiceAttrs = p => attrsOf(p).filter(a => a.values.length > 1);
const optsText = l => l.opts && typeof l.opts === 'object' ? Object.entries(l.opts).map(([k, v]) => `${k}: ${v}`) : [l.size, l.color].filter(Boolean);
const mainImg = p => (p.images && p.images[0]) || p.image_url || '';
/* نسخة صغيرة للكروت (الصور الجديدة تنرفع بنسختين: .f.jpg كبيرة و .t.jpg صغيرة) */
/* v87 (معتز): صورة فشلت (النت ضعيف/مقطوع) كانت تطلع علامة الصورة المكسورة + النص البديل (تبان كأنها موقع).
   توا: تتبدل بصورة شفافة (يقعد مكانها لون الخلفية الهادي)، ورابطها ينحفظ، وتتعاود لما النت يرجع / الصفحة تبان / كل 20 ث،
   وتتبدل بس لما تتحمّل فعلاً (ما ترجعش العلامة). ما يمسّش الهياكل المغبّشة */
const IMG_BLANK = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
let imgRT = 0;
document.addEventListener('error', e => {
  const im = e.target; if (!im || im.tagName !== 'IMG' || !im.isConnected) return;
  const u = im.getAttribute('src'); if (!u || u === IMG_BLANK || /^(blob|data):/.test(u)) return;
  im.dataset.fsrc = u; if (!('falt' in im.dataset)) im.dataset.falt = im.alt || '';
  im.alt = ''; im.classList.remove('fi'); im.classList.add('ifail'); im.src = IMG_BLANK;
  if (!imgRT) imgRT = setInterval(imgRetry, 20000);
}, true);
function imgRetry() {
  if (document.hidden) return;
  const ims = document.querySelectorAll('img.ifail[data-fsrc]');
  if (!ims.length) { clearInterval(imgRT); imgRT = 0; return }
  ims.forEach(im => {
    const u = im.dataset.fsrc, t = new Image();
    t.onload = () => { if (!im.isConnected || im.dataset.fsrc !== u) return; im.src = u; im.alt = im.dataset.falt || ''; im.classList.remove('ifail'); delete im.dataset.fsrc; delete im.dataset.falt; IMGOK.add(u) };
    t.src = u;
  });
}
addEventListener('online', () => setTimeout(imgRetry, 800));
document.addEventListener('visibilitychange', () => { if (!document.hidden) setTimeout(imgRetry, 800) });
const thumb = u => u && /\.f\.(jpg|webp)(\?|$)/.test(u) ? u.replace(/\.f\.(jpg|webp)/, '.t.$1') : (u || '');
/* الصور تظهر بنعومة أول مرة بس (اللي تحملت قبل تظهر فوراً من غير وميض) */
const IMGOK = new Set();
function imgOk(el) { IMGOK.add(el.getAttribute('src')); el.classList.remove('fi') }
const fi = u => IMGOK.has(u) ? '' : ` class="fi" onload="imgOk(this)" onerror="this.classList.remove('fi')"`;
const media = p => { const u = thumb(mainImg(p)); if (u) return `<img${fi(u)} src="${esc(u)}" alt="${esc(p.name)}" ${lz()} decoding="async">`; if (p.art) return art(p.art); return `<div class="ph">✦</div>` };
const cartCount = () => cart.filter(l => !l.gone).reduce((a, l) => a + l.qty, 0);
const toEn = x => String(x == null ? '' : x).replace(/[\u0660-\u0669]/g, d => d.charCodeAt(0) - 0x660).replace(/[\u06F0-\u06F9]/g, d => d.charCodeAt(0) - 0x6F0);
const digits = s => toEn(s).replace(/\D/g, '');

/* device id: links this phone to its orders, tickets and notifications */
const newId = () => crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16) });
const HW = (() => { let d = lsGet('mir_hw', null); if (!d) { d = newId(); lsSet('mir_hw', d) } return d })();
let DEV = (() => { let d = lsGet('mir_dev', null); if (!d) { d = newId(); lsSet('mir_dev', d) } return d })();
/* v54: أوامر تغيّر الحجز/العقوبة (وقتها يتسجل في liveAt ← ردود «النبض» اللي بدت قبلها ما تتطبّقش) */
const LIVE_FN = /\/rpc\/(start_checkout|cancel_hold|hold_drop|hold_settle|place_test_order)$/;
let liveAt = 0;
const rpc = (fn, args) => api('/rest/v1/rpc/' + fn, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(args || {}) });
const engaged = () => !!lsGet('mir_engaged', false);
const avail = p => {
  if (p.preorder) return 'pre';
  const l = state.live[p.id]; if (l && l.st) return l.st;
  return ['in', 'low', 'out'].includes(p.availability) ? p.availability : p.stock === 0 ? 'out' : (p.stock != null && p.stock <= 5) ? 'low' : 'in';
};
const canBuy = p => !['out', 'held'].includes(avail(p));
/* الخصم: السعر في المتجر هو السعر بعد الخصم، والسعر العادي المشطوب يجي جاهز (price_was).
   الخصم بمؤقت (discount_until): أول ما يخلص وقته يرجع السعر العادي هنا طول، والسيرفر يتحقق عند الطلب */
let clockOff = 0;   // v56: فرق ساعة الموبايل عن الساعة الصحيحة (من رد app-version.json)
const srvNow = () => Date.now() + clockOff;
const dEnd = p => { const t = p && p.discount_until ? Date.parse(p.discount_until) : 0; return t > 0 ? t : 0 };
const disc = p => { const d = Math.round(Number(p && p.discount) || 0); return d >= 1 && d <= 90 && !(dEnd(p) && dEnd(p) <= srvNow()) ? d : 0 };
const oldPrice = p => { const d = disc(p); if (!d) return 0; const w = Number(p.price_was); return w > 0 ? w : Math.round(Number(p.price) / (1 - d / 100)) };
/* عرض انتهى وقته: السعر العادي يرجع (ترجع المنتجات اللي تغيّرت) */
function endDiscounts(list) {
  const now = srvNow(), done = [];
  (list || state.prods).forEach(p => {
    if (!p || !p.discount || !dEnd(p) || dEnd(p) > now) return;
    if (Number(p.price_was) > 0) p.price = Number(p.price_was);
    p.discount = null; p.price_was = null; p.discount_until = null; done.push(String(p.id));
  });
  return done;
}
/* العداد التنازلي: "2 يوم 05:12:30" */
const p2 = n => String(n).padStart(2, '0');
function cdText(ms, short) {
  const t = Math.max(0, Math.floor(ms / 1000)), d = Math.floor(t / 86400), h = Math.floor(t % 86400 / 3600), m = Math.floor(t % 3600 / 60), x = t % 60;
  const dw = d === 1 ? 'يوم' : d === 2 ? 'يومين' : `${d} ${d <= 10 ? 'أيام' : 'يوماً'}`;
  if (short) return d ? `${dw} ${p2(h)}:${p2(m)}` : `${p2(h)}:${p2(m)}:${p2(x)}`;
  return (d ? `${dw} ` : '') + `${p2(h)}:${p2(m)}:${p2(x)}`;
}
const cdHTML = (p, short) => disc(p) && dEnd(p) ? (queueMicrotask(cdStart), `<span class="${short ? 'cdc' : 'cdp'}" data-until="${dEnd(p)}" data-short="${short ? 1 : ''}">${ic('clock')}${short ? '' : 'ينتهي العرض خلال '}<b>${cdText(dEnd(p) - srvNow(), short)}</b></span>`) : '';
let cdTimer = 0;
function cdTick() {
  const els = document.querySelectorAll('[data-until]');
  if (!els.length) { clearInterval(cdTimer); cdTimer = 0; return }
  let over = false;
  els.forEach(e => { const left = Number(e.dataset.until) - srvNow(); if (left <= 0) over = true; else { const b = e.querySelector('b'); const t = cdText(left, !!e.dataset.short); if (b && b.textContent !== t) b.textContent = t } });
  if (over) discountsEnded(endDiscounts());
}
function cdStart() { if (!cdTimer && document.querySelector('[data-until]')) cdTimer = setInterval(cdTick, 1000) }
/* عرض خلص والصفحة مفتوحة: السعر يرجع والشارات تنشال */
function discountsEnded(ids) {
  document.querySelectorAll('[data-until]').forEach(e => { if (Number(e.dataset.until) <= srvNow()) e.remove() });
  if (!ids.length) return;
  const hadSale = state.cats.some(c => c.id === SALE); syncSale();
  const chg = new Map(ids.map(id => [id, { price: true, st: false, first: false }]));
  if (hadSale !== state.cats.some(c => c.id === SALE) || (view === 'cat' && curCat === SALE)) renderData(); else patchCards(chg);
  if (view === 'cart' && cart.some(l => chg.has(String(l.id)))) liveCart(chg, false);
  const p = pend && byId(pend.id), pp = p && ids.includes(String(p.id)) && document.getElementById('ppr');
  if (pp) { pp.textContent = money(p.price); const po = document.getElementById('ppo'); if (po) po.innerHTML = ppoHTML(p); const pc = document.getElementById('pcd'); if (pc) pc.innerHTML = '' }
}
const oldHTML = p => disc(p) && oldPrice(p) > Number(p.price) ? `<s class="oldp">${money(oldPrice(p))}</s>` : '';
/* منتج جديد: أُضيف خلال آخر 7 أيام */
const isNew = p => { const t = Date.parse(p && p.created_at); return t > 0 && Date.now() - t < 7 * 864e5 };
/* قسم التخفيضات: قسم تلقائي يعرض كل منتج عليه خصم (نفس المنتج، بدون نسخ) */
const SALE = '__sale';
function syncSale() {
  state.cats = state.cats.filter(c => c.id !== SALE);
  if (state.prods.some(p => disc(p) && oldPrice(p) > Number(p.price))) state.cats.unshift({ id: SALE, name: 'التخفيضات', parent_id: null, sort: -1, virtual: true });
}
const inCatOf = (p, id) => id === SALE ? disc(p) > 0 && oldPrice(p) > Number(p.price) : p.category_id === id;
/* كم قطعة متاحة للزبونة (null = بدون حد: منتج حجز أو بدون كمية) */
/* كمية لكل لون: الخاصية اللي عليها الكمية (vattr) وكمية كل قيمة (vstock) */
/* تتبع الكمية والحجز (لكل منتج): مطفي = الحالة بيد المتجر بدون أرقام */
const trackOf = p => !!(p && p.track);
const vattrOf = p => trackOf(p) && !p.preorder && p.vattr ? p.vattr : null;
/* خيار (مثل اللون) نافد يدوياً لما التتبع مطفي */
const voutOf = p => { const l = state.live[p.id]; return (l && l.vo) || p.vout || {} };
const optOut = (p, label, val) => !!p && !trackOf(p) && (voutOf(p)[label] || []).includes(val);
const optsOut = (p, opts) => Object.entries(opts || {}).some(([k, v]) => optOut(p, k, String(v)));
/* السطر في السلة فيه الخيار v (لون في وضع الكمية، أو أي خيار في الوضع اليدوي) */
const lineHasV = (l, v) => !v || varOf(byId(l.id), l.opts) === v || Object.values(l.opts || {}).map(String).includes(v);
const vstockOf = p => { const l = state.live[p.id]; return (l && l.v) || p.vstock || {} };
const varOf = (p, opts) => { const a = vattrOf(p); return a ? String((opts || {})[a] || '') : '' };
/* كم قطعة متوفرة (للمنتج أو للون). null = بدون حد: منتج حجز، أو منتج بالألوان قبل اختيار اللون */
const leftOf = (p, v) => {
  if (!p || p.preorder || !trackOf(p)) return null;
  if (vattrOf(p)) return v ? Math.max(0, Number(vstockOf(p)[v] ?? 0)) : null;
  const l = state.live[p.id]; return l && l.n != null ? l.n : p.stock != null ? Math.max(0, p.stock) : null;
};
/* كم من نفس المنتج (ونفس اللون) في سلة الزبونة */
const inCartV = (p, v, skipKey) => cart.filter(x => x.id === p.id && x.key !== skipKey && (!vattrOf(p) || varOf(p, x.opts) === v)).reduce((a, x) => a + x.qty, 0);
const lineKey = (id, opts) => { const ks = Object.keys(opts || {}).sort(); return id + (ks.length ? '|' + ks.map(k => k + '=' + opts[k]).join('|') : '') };
const NOMORE = 'لا يمكن إضافة المزيد من هذا المنتج';
/* v66: أقصى كمية للمنتج في الطلب الواحد (من اللوحة): qmax، و qmax_by = فاضي (الإجمالي) / اسم صفة (لكل قيمة) / '*' (لكل تركيبة) */
const qmaxOf = p => { const n = Number(p && p.qmax); return n >= 1 ? n : 0 };
const qmaxGrp = (p, opts) => { const by = (p && p.qmax_by) || ''; return !by ? '' : by === '*' ? lineKey('', opts || {}) : String((opts || {})[by] ?? '') };
function qmaxLeft(p, opts, skipKey) {
  const n = qmaxOf(p); if (!n) return Infinity;
  const g = qmaxGrp(p, opts);
  return Math.max(0, n - cart.filter(x => String(x.id) === String(p.id) && x.key !== skipKey && !x.gone && qmaxGrp(p, x.opts) === g).reduce((a, x) => a + x.qty, 0));
}
function qmaxMsg(p) {
  const n = qmaxOf(p), by = (p && p.qmax_by) || '', q = qtyTxt(n);
  return by === '*' ? `الحد الأقصى ${q} من كل اختيار في الطلب.` : by ? `الحد الأقصى ${q} من كل ${by.replace(/^ال(?=..)/, '')} في الطلب.` : `الحد الأقصى لهذا المنتج ${q} في الطلب.`;
}
/* رسالة لما ما فيش مكان: الحد الأقصى، ولا محجوز لزبونة ثانية، ولا خلص */
const roomMsg = (rf, have) => rf.qm ? rf.qm : (have < rf.base ? HELDMSG : NOMORE);
const HELDMSG = 'هذا المنتج في سلة أخرى في وقت الدفع الآن.';   // v65
/* القطع المحجوزة لزبائن آخرين (من فحص السلة والتحديث الخفيف) */
const hhOf = (p, v) => (state.hh || {})[String(p.id) + '|' + (v || '')] || 0;
/* v66: كل منتج يتتبع الكمية يتحجز حجز عادي (عداد + عقوبة) عند تأكيد الطلب. «حد الحجز» والحجز الصامت انشالوا */
function limLine(l) {
  const p = byId(l.id); if (!p || l.gone || l.badv || p.preorder || !trackOf(p)) return false;
  const v = varOf(p, l.opts); if (vattrOf(p) && !v) return false;
  return leftOf(p, v) != null;
}
const cartLim = () => cart.some(limLine);
/* السطور المحدودة حسب السيرفر (أدق: يعرف المحجوز لغيرها) */
/* v56: السطور المحجوزة فعلاً (من «تأكيد الطلب»). تقعد لين الحجز يخلص أو يتلغى: التحديث كل 20 ثانية ما يمسحهاش */
let heldS = (() => { const v = lsGet('mir_held', null); return v && Array.isArray(v.k) && v.end > Date.now() ? new Set(v.k) : null })();
const lineHK = l => { const p = byId(l.id); return String(l.id) + '|' + ((p && varOf(p, l.opts)) || '') };
function heldSet(list, secs) { heldS = list ? new Set(list.map(x => String(x.id) + '|' + (x.v || ''))) : null; lsSet('mir_held', heldS ? { k: [...heldS], end: Date.now() + (secs || 0) * 1000 } : null) }
const srvHold = () => (state.mineEnd || 0) > Date.now();   // السيرفر قال عندها حجز شغال
const isHeld = l => holding() && (heldS ? heldS.has(lineHK(l)) : limLine(l));
const anyHeld = () => cart.some(isHeld) || (!heldS && srvHold());   // السلة فيها حجز (السطر بالزبط، أو السيرفر قال فيه حجز)
function limFrom(list) {
  if (!Array.isArray(list)) return;
  state.limS = new Set(list.map(x => String(x.id) + '|' + (x.v || '')));
  if (view === 'cart') limPaint();
}
/* v66: شارة «محدود الكمية» والإطار الأزرق انشالوا (كل حجز عادي). يقعد تحديث زر الإيقاف بس */
function limPaint() { penPaint() }
/* هل عندها حجز شغال الآن؟ صاحبة الحجز ما تقدرش تضيف المحجوز لغيرها */
const holding = () => Math.max(state.mineEnd || 0, holdEnd || 0) > Date.now();
/* كم تقدر تضيف (بعد طرح اللي في سلتها، والمحجوز لغيرها). v65: المحجوز لغيرها (عادي أو صامت) دايماً، مش بس وقت حجزها */
function roomFor(p, v, skipKey, opts) {
  const ql = opts === undefined ? Infinity : qmaxLeft(p, opts, skipKey);   // v66: أقصى كمية
  const left = leftOf(p, v);
  if (left == null) { const r = Math.min(MAXQ, ql); return { room: r, base: MAXQ, qm: ql < MAXQ ? qmaxMsg(p) : '' } }
  const base = Math.max(0, left - inCartV(p, v, skipKey)), room = Math.min(MAXQ, base);   // v91 (معتز): بدون حجز الآخرين — يبان بس في «إتمام الطلب» (نافذة الانتظار). كان: base − hhOf
  return { room: Math.min(room, ql), base, qm: ql <= room && ql < MAXQ ? qmaxMsg(p) : '' };
}
const leadTxt = p => p && p.lead_time ? 'التسليم خلال ' + p.lead_time : 'طلب مسبق';
const qtyWord = n => n === 1 ? 'قطعة' : n === 2 ? 'قطعتين' : n <= 10 ? 'قطع' : 'قطعة';
const qtyTxt = n => n === 1 ? 'قطعة واحدة' : n === 2 ? 'قطعتان' : `${n} ${n <= 10 ? 'قطع' : 'قطعة'}`;
function stockInfo(p) {
  const a = avail(p);
  if (a === 'pre') return ['pre', p.lead_time ? 'طلب مسبق · ' + p.lead_time : 'طلب مسبق'];   // v62: «طلب مسبق» بدل «حجز» (الحجز = حجز الدفع للمحدود بس)
  if (a === 'out') return ['out', 'يتوفر قريباً'];   // v69: كان «غير متوفر»
  if (a === 'low') return ['low', 'قارب على الانتهاء'];
  return ['ok', 'متوفر'];
}
const outTxt = p => avail(p) === 'out' ? 'يتوفر قريباً' : 'نفدت الكمية';   // v69: زر الإضافة المقفول (المحجوز عند غيرها يقعد زي ما هو)
/* v95: صفحة المنتج: تحت الحالة «محدود الكمية» للمنتج المحدود */
const pstkHTML = p => stkHTML(p) + (isLimP(p) ? '<span class="plim">محدود الكمية</span>' : '');
const stkHTML = p => { const [k, l] = stockInfo(p); return `<span class="stk ${k}">${esc(l)}</span>` };   // v66: esc (مدة التسليم نص من اللوحة)
function ago(s) {
  const m = Math.round((Date.now() - new Date(s)) / 60000);
  if (m < 1) return 'الآن'; if (m < 60) return `قبل ${m} د`;
  const hh = Math.round(m / 60); if (hh < 24) return `قبل ${hh} س`;
  return new Date(s).toLocaleDateString('ar-EG-u-nu-latn', { day: 'numeric', month: 'short' });
}
const hm = s => new Date(s).toLocaleTimeString('ar-EG-u-nu-latn', { hour: 'numeric', minute: '2-digit' });
const dayKey = s => new Date(s).toDateString();
const dayLabel = s => { const d = new Date(s), t = new Date(); if (d.toDateString() === t.toDateString()) return 'اليوم'; t.setDate(t.getDate() - 1); if (d.toDateString() === t.toDateString()) return 'أمس'; return d.toLocaleDateString('ar-EG-u-nu-latn', { day: 'numeric', month: 'long' }) };


function updateBadge() { const n = cartCount(); document.querySelectorAll('.badge').forEach(b => { b.textContent = n; b.classList.toggle('on', n > 0) }) }
function saveCart() { if (user && lsGet('mir_cart_dirty', false) !== 'order') lsSet('mir_cart_dirty', true); lsSet('mir_cart', cart); updateBadge(); syncProfile() }   // v70: تعديل ما وصلش للسيرفر

/* data */
/* آخر نسخة من الأقسام والمنتجات محفوظة على الجهاز: تظهر فوراً، وتتحدث في الخلفية.
   المصدر: الكتالوج الجاهز (نسخة وحدة للكل، تتحدّث بزر "نشر التعديلات" وتلقائياً لما منتج ينفد).
   لو الكتالوج تعذّر: من قاعدة البيانات مباشرة زي قبل */
const CACHE_K = 'mir_cache';   // v87: CACHE_MS (7 أيام) انشال
/* الكتالوج من Cloudflare R2 أولاً (التحميل منه مجاني)، ولو تعذّر: نسخته الاحتياطية في Supabase */
const CAT_BASES = ['https://img.miracles.ly/catalog/', SB_URL + '/storage/v1/object/public/catalog/'];
let catBase = CAT_BASES[0];   // المصدر اللي جاب آخر رقم نسخة
let catVer = 0;   // رقم نسخة الكتالوج المعروضة (0 = من قاعدة البيانات مباشرة)
/* نفس الطلب في نفس اللحظة: يمشي مرة وحدة والكل يستنى نفس الرد */
const inflight = {};
function share(key, fn) {
  if (inflight[key]) return inflight[key];
  const p = Promise.resolve().then(fn).finally(() => { delete inflight[key] });
  return inflight[key] = p;
}
async function getJSON(url, ms, gz) {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), ms || 8000);
  try {
    const r = await fetch(url, { signal: ctl.signal });
    if (!r.ok) { const e = new Error('HTTP ' + r.status); e.status = r.status; throw e }
    if (gz) return JSON.parse(await new Response(r.body.pipeThrough(new DecompressionStream('gzip'))).text());
    return await r.json();
  } finally { clearTimeout(t) }
}
/* الكتالوج مضغوط (gzip)، والمتصفح القديم ياخذ النسخة العادية */
async function fetchCatalog(v, first) {
  let err = null;
  const b0 = first || catBase;   // v70: first = المصدر اللي نبدوا بيه (لو R2 علّق في أول الفتح: من Supabase)
  for (const b of [b0, ...CAT_BASES.filter(x => x !== b0)]) {
    if (typeof DecompressionStream === 'function') { try { const c = await getJSON(b + 'c-' + v + '.json.gz', 15000, true); if (c && Array.isArray(c.p)) return c } catch (e) { if (e && e.name === 'AbortError') { err = e; continue } } }   // v70: علّق ← المصدر الثاني على طول (ما نستنوش 15 ث ثانية من نفس المصدر)
    try { const c = await getJSON(b + 'c-' + v + '.json', 15000); if (c && Array.isArray(c.p)) return c } catch (e) { err = e }
  }
  throw err || new Error('no catalog');
}
/* v38: التحديث بالفروقات. لو عندها نسخة قريبة: تنزّل ملفات صغيرة فيها اللي تغيّر بس (c-d-<من>-<إلى>.json)
   وتطبقها على نسختها. لو ما فيش طريق متصل أو أي غلط: null، والمتجر ينزّل الكتالوج كامل زي قبل */
async function fetchDelta(vj) {
  const k = lsGet(CACHE_K, null);
  if (!catVer || !k || k.v !== catVer || !Array.isArray(k.p) || !Array.isArray(vj && vj.d)) return null;
  const path = []; let cur = catVer;
  for (const l of vj.d) { if (Array.isArray(l) && l[0] === cur) { path.push(l); cur = l[1] } }
  if (cur !== vj.v || !path.length) return null;
  let c = k.c || [], s = k.s || [], n = null;
  const pm = new Map(k.p.map(x => [String(x.id), x]));
  for (const [a, b] of path) {
    const d = await getJSON(catBase + 'c-d-' + a + '-' + b + '.json', 8000);
    if (!d || d.from !== a || d.to !== b || !Array.isArray(d.p)) return null;
    d.p.forEach(x => pm.set(String(x.id), x)); (d.x || []).forEach(id => pm.delete(String(id)));
    if (d.c) c = d.c; if (d.s) s = d.s; n = d.n;
  }
  const p = [...pm.values()].sort((x, y) => String(x.created_at || '').localeCompare(String(y.created_at || '')));
  if (n != null && p.length !== n) return null;
  return { v: vj.v, c, p, s };
}
/* رقم آخر نسخة (v39): من R2، ومن Supabase كمان (أول مرة وبعدها كل دقيقتين، أو لو R2 ما ردّش)،
   وناخذوا الأحدث. هكي لو R2 ما تحدّثش، الزباين يوصلهم الجديد من Supabase */
let sbVerAt = 0;
async function fetchVersion(skipR2) {
  const both = !sbVerAt || Date.now() - sbVerAt > 120000;
  const one = b => getJSON(b + 'version.json', 6000).then(vj => vj && vj.v ? { b, vj } : null);
  // v70: skipR2 = R2 ما ردّش في أول الفتح (6 ث): نسألوا Supabase بس (ما نستنوش R2 مرة ثانية)، ولو فشل: R2
  if (skipR2 && CAT_BASES.length > 1) { const r = await one(CAT_BASES[1]).catch(() => null); if (r) { sbVerAt = Date.now(); catBase = r.b; return r.vj } }
  let rs = await Promise.allSettled(both ? CAT_BASES.map(one) : [one(CAT_BASES[0])]);
  if (!both && !(rs[0].status === 'fulfilled' && rs[0].value)) rs = await Promise.allSettled([one(CAT_BASES[1])]);
  if (both) sbVerAt = Date.now();
  let best = null;
  rs.forEach(r => { if (r.status === 'fulfilled' && r.value && (!best || Number(r.value.vj.v) > Number(best.vj.v))) best = r.value });
  if (!best) throw new Error('no catalog');
  catBase = best.b; return best.vj;
}
/* لو المنتجات معروضة من الجهاز والكتالوج ما ردّش: نخلّوها زي ما هي ونعاودوا نحاولوا (5، 10، 20، 40 ثانية)
   بدل ما كل الزبائن يضربوا قاعدة البيانات في نفس اللحظة */
let catRetryT = null, catRetryN = 0;
function catRetry() {
  clearTimeout(catRetryT);
  catRetryT = setTimeout(() => share('cat', async () => { if (await checkCatalog(true)) catRetryN = 0; else catRetry() }), Math.min(40000, 5000 * 2 ** catRetryN++));
}
function applyData(c, p, s, v) {
  endDiscounts(p); state.cats = c; state.prods = p; state.set = Object.fromEntries((s || []).map(x => [x.key, x.value])); state.ok = true; syncSale();
  try { heroSync() } catch (e) {}   // v75
  if (v) Object.keys(state.live).forEach(id => { if ((state.live[id].t || 0) < v) delete state.live[id] });   // الأقدم من الكتالوج ينشال
}
function useCatalog(cat) {
  applyData(cat.c || [], cat.p, cat.s || [], cat.v); catVer = cat.v;
  lsSet(CACHE_K, { t: Date.now(), v: cat.v, c: cat.c || [], p: cat.p, s: cat.s || [] });
}
function renderData() {
  lgKeep = true;   // إعادة رسم بنفس المكان: نفس عدد المنتجات المرسومة (ما ترجعش لفوق)
  try {
    renderCats(); renderSocial(); renderHome(); if (view === 'cat') { if (catById(curCat)) renderCat(); else go('products') }
    if (document.getElementById('q').value) runSearch();
  } finally { lgKeep = false }
  tsEarly();
}
/* v70: مفتاح Turnstile يجي مع الكتالوج. لو شاشة التسجيل/الاسترجاع انفتحت قبله، الفحص يبدا توا (وهي مازالت تعبّي) */
function tsEarly() {
  try { if (state.ok && !document.getElementById('authv').hidden && ['signup', 'forgot', 'pick', 'scode', 'reset'].includes(authMode)) tsPrep() } catch (e) {}
}
/* ===== القوائم الطويلة: أول 24 منتج فوراً، والباقي يتضاف قبل ما توصله الزبونة بشاشتين =====
   المنتجات موجودة على الجهاز، فالإضافة لحظية: ما فيش "تحميل المزيد" ولا مكان فاضي */
const LG_PAGE = 24, LG = {}; let lgKeep = false;
function gridHTML(key, items, bg) {
  const prev = LG[key], n = Math.min(items.length, Math.max(LG_PAGE, lgKeep && prev ? prev.n : 0));
  LG[key] = { items, bg, n };
  return items.slice(0, n).map(p => prodCard(p, bg)).join('') + (n < items.length ? `<i class="more-s" data-lg="${key}" aria-hidden="true"></i>` : '');
}
function armGrids(root) {
  if (!root || typeof IntersectionObserver !== 'function') { if (root) root.querySelectorAll('.more-s').forEach(s => { while (s.isConnected) growGrid(s) }); return }
  root.querySelectorAll('.more-s').forEach(s => {
    const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { growGrid(s); if (s.isConnected) { io.unobserve(s); io.observe(s) } else io.disconnect() } },
      { root: s.closest('.view'), rootMargin: '0px 0px 1600px 0px' });
    io.observe(s);
  });
}
function growGrid(s) {
  const L = LG[s.dataset.lg]; if (!L) { s.remove(); return }
  const next = L.items.slice(L.n, L.n + LG_PAGE); L.n += next.length;
  s.insertAdjacentHTML('beforebegin', next.map(p => prodCard(p, L.bg)).join(''));
  if (L.n >= L.items.length) s.remove();
}
async function loadData() {
  state.err = false;
  if (!state.ok) {
    const k = lsGet(CACHE_K, null);
    // v87: نسخة التلفون دايماً (كان فيه حد 7 أيام يتحسب من آخر تغيير في المنتجات، فالنت الضعيف ← هياكل). السيرفر يأكد بعدها، والطلب يتأكد من السيرفر
    if (k && Array.isArray(k.c) && Array.isArray(k.p)) { try { applyData(k.c, k.p, k.s); catVer = k.v || 0; renderData() } catch (e) { state.ok = false; catVer = 0 } }
    if (!state.ok) { renderCats(); renderHome() }
    // v70: رابط منتج والمنتج موجود في النسخة اللي على الجهاز: يتفتح توا (ما يستناش التأكد من النسخة، وما ينطش بعدين فوق حاجة ثانية)
    if (state.ok && DEEP && byId(DEEP)) { deepSig = JSON.stringify(byId(DEEP)); deepEarly = String(DEEP); openDeep() }
  }
  let fresh = false;
  try {
    // v41: لو الكتالوج بدا يتحمّل من أول لحظة (أول زيارة) ناخذوه، وإلا الطريق العادي
    const bt = window.__boot; window.__boot = null;
    const bv = bt && await bt.v, vj = bv && bv.v ? bv : await fetchVersion(!!bt);   // v70: الطلب المبكر فشل/علّق ← Supabase أول
    if ('m' in vj) setMaint(!!vj.m);
    const bc = bv && bv.v === vj.v && await bt.c;
    if (bc && Array.isArray(bc.p)) { await Promise.race([splashP, pause(1500)]); useCatalog(bc) }
    else if (vj.v !== catVer || !state.ok) useCatalog((state.ok && await fetchDelta(vj).catch(() => null)) || await fetchCatalog(vj.v, bv && bv.v === vj.v && bt ? CAT_BASES.find(x => x !== CAT_BASES[0]) : null));   // v70: الكتالوج المبكر من R2 فشل ← Supabase أول
    fresh = true; catRetryN = 0;
  } catch (e) {
    // المنتجات معروضة من الجهاز: تبقى، ونعاودوا نحاولوا بعد شوية (بدون قاعدة البيانات)
    if (state.ok) { catRetry(); openDeep(); return }
    // أول زيارة وما فيش نسخة على الجهاز: من قاعدة البيانات مباشرة
    try {
      const [c, p, s] = await Promise.all([
        api('/rest/v1/categories?select=*&order=sort.asc,name.asc'),
        rpc('catalog_products', {}).then(x => Array.isArray(x) ? x : []),   // v66: الجدول للأدمن بس، الدالة ترجّع نفس حقول الكتالوج
        api('/rest/v1/settings?select=key,value').catch(() => [])
      ]);
      applyData(c, p, s); catVer = 0; fresh = true;
      lsSet(CACHE_K, { t: Date.now(), v: 0, c, p, s });
    } catch (e2) { if (!state.ok) { state.err = true; errRetryArm() } }
  }
  renderData();
  if (fresh) { openDeep(); deepCheck() }
}
/* v70: كل المصادر فشلت (ما فيش منتجات): نعاودوا لحالنا كل 15 ث، وفوراً لما النت يرجع. زر «إعادة المحاولة» يقعد */
let errT = 0;
function errRetryArm() { clearTimeout(errT); errT = setTimeout(errRetryGo, 15000) }
function errRetryGo() {
  clearTimeout(errT); errT = 0;
  if (!state.err || state.ok) return;
  if (document.hidden) return errRetryArm();
  share('load', loadData);
}
addEventListener('online', () => { if (state.err && !state.ok) errRetryGo() });
/* كل 20 ثانية (والصفحة ظاهرة)، ولما ترجع للموقع: ملف صغير فيه رقم النسخة والصيانة.
   لو فيه نسخة جديدة تنزل في الخلفية. لو فيه منتج أو نافذة مفتوحة: التحديث في الجولة الجاية.
   لو التغيير في الأسعار/التوفر بس: تتحدّث الكروت اللي تغيّرت فقط (بدون إعادة رسم الصفحة) */
const SIG_P = ['category_id', 'sub', 'name', 'images', 'image_url', 'art', 'created_at', 'attrs', 'sizes', 'colors', 'preorder', 'lead_time', 'track', 'vattr', 'description'];
const catSig = (c, p) => JSON.stringify([(c || []).map(x => [x.id, x.name, x.parent_id, x.sort, x.image_url]),
  (p || []).map(x => [x.id, ...SIG_P.map(k => x[k] ?? null), (Number(x.discount) || 0) > 0])]);
/* ترجع true لو وصل رقم النسخة (حتى لو ما تغيّرش)، و false لو ما ردّش */
async function checkCatalog() {
  if (document.hidden || !state.ok) return true;
  let vj;
  try { vj = await fetchVersion() } catch (e) { return false }
  try {
    if ('m' in vj) setMaint(!!vj.m);
    if (vj.v === catVer || sheet.classList.contains('on')) return true;
    const cat = (await fetchDelta(vj).catch(() => null)) || await fetchCatalog(vj.v);
    if (sheet.classList.contains('on') || !cat || !Array.isArray(cat.p)) return true;
    const sameShape = catSig(state.cats.filter(c => c.id !== SALE), state.prods) === catSig(cat.c, cat.p);
    const before = new Map(state.prods.map(x => [String(x.id), x])), oldSet = JSON.stringify(state.set);
    useCatalog(cat);
    if (!sameShape) { renderData(); if (view === 'cart') renderCartView(); else if (view === 'favs') renderFavs(); return true }
    // نفس المنتجات والأقسام: نحدّثوا الكروت اللي تغيّرت بس
    const chg = new Map();
    state.prods.forEach(x => {
      const o = before.get(String(x.id)); if (!o) return;
      const price = Number(o.price) !== Number(x.price) || (Number(o.discount) || 0) !== (Number(x.discount) || 0) || (o.discount_until || null) !== (x.discount_until || null);
      const st = ['availability', 'stock', 'vstock', 'vout'].some(k => JSON.stringify(o[k] ?? null) !== JSON.stringify(x[k] ?? null));
      if (price || st) chg.set(String(x.id), { price, st, first: false });
    });
    if (chg.size) patchCards(chg);
    if (JSON.stringify(state.set) !== oldSet) renderSocial();
    if (view === 'cart' && cart.some(l => chg.has(String(l.id)))) liveCart(chg, false);
    return true;
  } catch (e) { return false }
}
/* v66: عدّاد الزيارات انشال (store-v46) */
setInterval(() => { if (!document.hidden) share('cat', checkCatalog) }, 20000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) share('cat', checkCatalog) });
/* أول صورة كبيرة للمنتج تبدأ تتحمّل من لمسة الإصبع على الكرت (قبل ما تنفتح)، والباقي لما ينفتح */
const preImgs = new Set();
function prefetchProd(id) {
  const p = byId(id); if (!p) return;
  ((p.images && p.images.length) ? p.images : (p.image_url ? [p.image_url] : [])).slice(0, 1).forEach(u => {
    if (!u || preImgs.has(u)) return; preImgs.add(u); const im = new Image(); im.decoding = 'async'; im.src = u;
  });
}
document.addEventListener('pointerdown', e => { const t = e.target && e.target.closest && e.target.closest('[data-open]'); if (t) prefetchProd(t.dataset.open) }, { passive: true, capture: true });

/* social links on home (from admin → حسابات المتجر) */
const SOC_IC = {
  tiktok: '<img src="/soc-tiktok.webp" alt="" width="54" height="54" loading="lazy" decoding="async">',
  facebook: '<img src="/soc-facebook.webp" alt="" width="54" height="54" loading="lazy" decoding="async">',
  whatsapp: '<img src="/soc-whatsapp.svg" alt="" width="32" height="32" loading="lazy" decoding="async">',
  gmail: '<img src="/soc-gmail.webp?v=1" alt="" width="30" height="30" loading="lazy" decoding="async">'   // v54
};
/* شهادات المتجر (من الإدارة): زر يفتح الصور بالشاشة الكاملة */
function certList() {
  let v = (state.set || {}).certs;
  if (typeof v === 'string') { try { v = JSON.parse(v) } catch (e) { v = [] } }
  return Array.isArray(v) ? v.filter(u => /^https:\/\//i.test(String(u || ''))) : [];
}
function renderCerts() { const b = document.getElementById('certs'); if (b) b.hidden = !certList().length }
/* ===== رسالة اليوم (v54): صورة وحدة كل يوم بالترتيب من صور صاحب المتجر (settings.msg_images).
   اليوم يتبدل 12 بالليل بتوقيت ليبيا (UTC+2)، وكل الزبائن يشوفوا نفس الصورة. بعد آخر صورة ترجع للأولى.
   settings.msg_start = رقم اليوم اللي تطلع فيه الصورة الأولى (اللوحة تعدله وقت الحفظ عشان صورة اليوم ما تتغيرش) ===== */
function msgList() {
  let v = (state.set || {}).msg_images;
  if (typeof v === 'string') { try { v = JSON.parse(v) } catch (e) { v = [] } }
  return Array.isArray(v) ? v.filter(u => typeof u === 'string' && /^https:\/\//.test(u)) : [];
}
const lyDay = () => Math.floor((Date.now() + 7200000) / 86400000);   // رقم اليوم بتوقيت ليبيا
function msgToday() {
  const L = msgList(); if (!L.length) return null;
  const st = Math.floor(Number(String((state.set || {}).msg_start || '0').replace(/"/g, '')) || 0);
  return L[(((lyDay() - st) % L.length) + L.length) % L.length];
}
function msgPre() {   // صورة اليوم تتحمل في الخلفية
  const u = msgToday(); if (!u || IMGOK.has(u)) return;
  const i = new Image(); i.decoding = 'async'; i.src = u; (i.decode ? i.decode() : Promise.reject()).then(() => IMGOK.add(u), () => {});
}
function msgSync() { const on = msgList().length > 0; document.querySelectorAll('.msgbtn').forEach(b => b.hidden = !on) }
function openMsg() {
  const u = msgToday(); if (!u) return;
  openSheet('drop', `<h3 class="msgttl">رسالة اليوم</h3><div class="msgimg"><img src="${esc(u)}" alt="رسالة اليوم"${fi(u)}></div><button class="cta" data-close>أكملي التسوق ✨</button>`);
}
/* v55: «ما طرق الدفع المتاحة؟» في الأسئلة الشائعة: أسماء الطرق اللي اختارها صاحب المتجر من اللوحة */
function faqPay() {
  const el = document.getElementById('faq-pay'); if (!el) return;
  const ms = payMethods().filter(m => m.id > 0).map(m => m.name);
  el.textContent = (ms.length ? 'الدفع الإلكتروني عبر إيزون باي بالطرق التالية: ' + ms.join('، ') + '.' : 'الدفع الإلكتروني عبر إيزون باي.') + ' ورسوم التوصيل تُدفع نقداً عند الاستلام.';
}
function renderSocial() {
  faqPay();
  msgSync(); setTimeout(msgPre, 1500);
  renderCerts();
  const s = state.set || {}, safe = u => /^https?:\/\//i.test(String(u || '').trim()) ? String(u).trim() : '';
  const em = String(s.store_email || '').trim(), mail = /^[^\s@<>"'?&]+@[^\s@<>"'?&]+\.[a-z]{2,}$/i.test(em) ? 'mailto:' + em : '';   // v54: البريد (وسيلة احتياطية)
  const links = [['tiktok', 'تيك توك', safe(s.tiktok)], ['facebook', 'فيسبوك', safe(s.facebook)], ['whatsapp', 'واتساب', digits(s.whatsapp) ? 'https://wa.me/' + digits(s.whatsapp) : ''], ['gmail', 'البريد الإلكتروني', mail]].filter(x => x[2]);
  const box = document.getElementById('social');
  box.hidden = !links.length;
  document.getElementById('soc-row').innerHTML = links.map(([k, l, u]) => `<a class="soc ${k}" href="${esc(u)}"${/^mailto:/.test(u) ? '' : ' target="_blank" rel="noopener"'} aria-label="${l}" title="${l}">${SOC_IC[k]}</a>`).join('');
}

/* smooth, real vertical scrolling (used when jumping to a section) */
let ticketsP = null;
const sleep = ms => new Promise(r => setTimeout(r, ms));
function smoothTo(box, top, dur) {
  const from = box.scrollTop, to = Math.max(0, Math.min(top, box.scrollHeight - box.clientHeight)), d = to - from;
  if (!d) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { box.scrollTop = to; return }
  dur = dur || Math.min(1100, Math.max(520, Math.abs(d) * .9));
  const t0 = performance.now(), ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  let stop = false; const cancel = () => { stop = true };
  box.addEventListener('touchstart', cancel, { once: true, passive: true }); box.addEventListener('wheel', cancel, { once: true, passive: true });
  (function step(now) {
    if (stop) return;
    const k = Math.min(1, (now - t0) / dur); box.scrollTop = from + d * ease(k);
    if (k < 1) requestAnimationFrame(step);
  })(t0);
}
async function goSection(id) {
  await Promise.all([ticketsP || 0, sleep(380)]);
  const box = document.getElementById('v-support'), el = document.getElementById(id);
  if (!el || view !== 'support') return;
  smoothTo(box, el.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop - 74);
}

/* ===== سلاسة: لمعة على اللي تغيّر + تبديل ناعم في نفس الصفحة ===== */
const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const flashAt = {};
/* كل اللمعات في نفس اللحظة تتجمع وتتنفذ مرة وحدة في الإطار الجاي (بدون ما نثقلوا على التلفون) */
let flashQ = [];
function flash(el, key, txt) {
  if (!el || calm()) return;
  const now = Date.now(); if (key && now - (flashAt[key] || 0) < 3000) return; if (key) flashAt[key] = now;
  if (flashQ.push([el, txt ? 'flasht' : 'flash']) > 1) return;
  requestAnimationFrame(() => {
    const H = innerHeight, q = flashQ.filter(([e]) => { if (!e.isConnected) return false; const b = e.getBoundingClientRect(); return b.height > 0 && b.bottom > 0 && b.top < H }).slice(0, 24); flashQ = [];   // اللي ظاهر على الشاشة بس
    q.forEach(([e, c]) => e.classList.remove(c));
    requestAnimationFrame(() => q.forEach(([e, c]) => { e.classList.add(c); e.addEventListener('animationend', () => e.classList.remove(c), { once: true }) }));
  });
}
function softSwap(box) {
  if (!box || calm()) return;
  box.classList.remove('swap'); void box.offsetWidth; box.classList.add('swap');
  box.addEventListener('animationend', () => box.classList.remove('swap'), { once: true });
}
/* حذف سطر بحركة انكماش، وبعدها التعديل الفعلي */
function collapse(el, fn) {
  if (!el || calm()) return fn();
  el.style.height = el.offsetHeight + 'px'; el.style.overflow = 'hidden'; void el.offsetWidth;
  el.classList.add('collapsing');
  setTimeout(fn, 230);
}
/* بعد الرجوع للسلة: السطر المعني يلمع ويبان */
let cartQuiet = { until: 0, ids: new Set() };   // بعد نافذة فيها الشرح: ما نكرروش رسالة التحديث التلقائي
function flashCart(ids) {
  ids = [...new Set((ids || []).map(String))]; if (!ids.length) return;
  cartQuiet = { until: Date.now() + 5000, ids: new Set(ids) };
  setTimeout(() => {
    if (view !== 'cart') return;
    const els = ids.map(id => document.querySelector(`#cartv .ccard[data-cid="${CSS.escape(id)}"]`)).filter(Boolean);
    if (els[0]) els[0].scrollIntoView({ block: 'nearest', behavior: calm() ? 'auto' : 'smooth' });
    els.forEach(e => flash(e, 'cc' + e.dataset.cid));
  }, 260);
}

/* skeleton loaders */
const skelCats = n => Array.from({ length: n }, () => `<article class="card catcard sk" aria-hidden="true"><div class="cover skb"></div><h3><span class="sk-l skb" style="width:62%"></span></h3><span class="go"></span></article>`).join('');
const skelProds = n => Array.from({ length: n }, () => `<article class="card sk" aria-hidden="true"><div class="thumb skb"></div><div class="pinfo"><span class="sk-l skb" style="width:78%"></span><div class="prow"><span class="sk-l skb"></span><span class="add"></span></div></div></article>`).join('');

/* categories (tree: a category can hold sub-categories; products live in the last one) */
const catById = id => state.cats.find(c => c.id === id);
const catKids = id => state.cats.filter(c => (c.parent_id || null) === (id || null));
/* v58: سهم مرسوم يشاور لليسار (للأمام في العربي). علامة ‹ كان المتصفح يقلبها وحده في الكلام العربي فتطلع معكوسة */
const CHL = '<svg class="ic chl" viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 6l-6 6 6 6"/></svg>';
const catTrail = id => { const out = []; let c = catById(id), g = 0; while (c && g++ < 20) { out.unshift(c); c = catById(c.parent_id) } return out };
const catDesc = id => { const r = [id]; for (let i = 0; i < r.length; i++) catKids(r[i]).forEach(c => r.push(c.id)); return r };
const prodsUnder = id => { if (id === SALE) return state.prods.filter(p => inCatOf(p, SALE)); const s = new Set(catDesc(id)); return state.prods.filter(p => s.has(p.category_id)) };
function catCard(c) {
  return `<article class="card catcard">
    <button class="cover" data-cat="${esc(c.id)}" aria-label="${esc(c.name)}">${coverHTML(c)}</button>
    <h3>${esc(c.name)}</h3><button class="go" data-cat="${esc(c.id)}" aria-label="فتح ${esc(c.name)}">${ic('arrow')}</button></article>`;
}
/* تحميل مسبق: صور الأقسام وصورة خدمة العملاء تبدا تتحمل في الخلفية من أول ما الموقع يفتح */
function preCovers() {
  try {
    const urls = ['/sale.webp?v=23', '/sale-c.webp?v=23'];
    catKids(null).forEach(c => { if (c.image_url) urls.push(thumb(c.image_url)); else { const p = prodsUnder(c.id)[0]; if (p && mainImg(p)) urls.push(thumb(mainImg(p))) } });
    urls.forEach(u => { if (IMGOK.has(u) || !u) return; const i = new Image(); i.decoding = 'async'; i.src = u; (i.decode ? i.decode() : Promise.reject()).then(() => IMGOK.add(u), () => {}) });
  } catch (e) {}
}
function preSupport() {
  const el = document.querySelector('.support .art-ic'); if (!el || el.classList.contains('ld')) return;
  const i = new Image(); i.src = '/support.webp';
  const done = () => el.classList.add('ld');
  (i.decode ? i.decode() : Promise.reject()).then(done, () => { i.complete ? done() : (i.onload = i.onerror = done) });
}
/* v51: التحميل المسبق (صور الأقسام، خدمة العملاء) يستنى صور الرئيسية اللي على الشاشة تكمل أول (حد أقصى 3 ث)،
   عشان ما يزاحمهاش على النت الضعيف */
let homeDoneP = null;
function afterHome(fn) {
  if (!homeDoneP) homeDoneP = new Promise(res => {
    const t0 = Date.now();
    const tick = () => {
      const imgs = [...document.querySelectorAll('#v-home img')].filter(i => { const r = i.getBoundingClientRect(); return r.width > 0 && r.bottom > 0 && r.top < innerHeight });
      if ((state.ok && imgs.every(i => i.complete)) || Date.now() - t0 > 3000 || view !== 'home') return res();
      setTimeout(tick, 150);
    };
    tick();
  });
  homeDoneP.then(() => setTimeout(fn, 0));
}
/* أول 4 صور أقسام تتحمل فوراً، والباقي لما تقرب تبان */
let eagerN = 0;
const lz = () => eagerN-- > 0 ? 'fetchpriority="high"' : 'loading="lazy"';
function coverHTML(c) {
  const items = prodsUnder(c.id);
  if (c.id === SALE) return `<div class="cover-fb salecov" style="background:${DEF_BG}"><i class="bph ph-sale"></i><img${fi('/sale.webp?v=23')} src="/sale.webp?v=23" alt="${esc(c.name)}" ${lz()} decoding="async"></div>`;
  if (c.image_url) return `<div class="cover-fb" style="background:${DEF_BG}"><img${fi(thumb(c.image_url))} src="${esc(thumb(c.image_url))}" alt="${esc(c.name)}" ${lz()} decoding="async"></div>`;
  if (COVERS[c.id]) {
    const uses = COVERS[c.id].map(p => `<use href="#a-${p[0]}" x="${p[1]}" y="${p[2]}" width="${p[3]}" height="${p[3]}"/>`).join('');
    return `<svg viewBox="0 0 200 216" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><rect width="200" height="216" style="fill:url(#g-${c.id})"/>${uses}</svg>`;
  }
  return `<div class="cover-fb" style="background:${DEF_BG}">${items[0] ? media(items[0]) : '<div class="ph">✦</div>'}</div>`;
}
function renderCats() {
  const g = document.getElementById('catgrid');
  if (state.err) { g.innerHTML = `<div class="empty">تعذر تحميل المنتجات.<br><button class="cta" data-retry style="margin-top:16px;width:auto">إعادة المحاولة</button></div>`; return }
  if (!state.ok) { g.innerHTML = skelCats(4); return }
  const roots = catKids(null);
  if (!roots.length) { g.innerHTML = `<div class="empty">لا توجد أقسام بعد</div>`; return }
  eagerN = 4; g.innerHTML = roots.map(catCard).join(''); eagerN = 0;
}

/* ===== الرئيسية: اختصارات الأقسام + مختارات لكِ ===== */
let homePicks = null;   // تُختار مرة واحدة في كل زيارة (فتح الموقع أو الرجوع بعد غياب طويل)
function pickHome() {
  const pool = state.prods.filter(p => avail(p) !== 'out');
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]] }
  homePicks = pool.slice(0, 8).map(p => String(p.id));
}
/* v93: المختارات أقل من 8 (اتختارت والمنتجات قليلة، أو منتج انحذف) وفيه منتجات متوفرة جديدة ← تتكمّل لين 8.
   اللي ظاهرين ما يتبدلوش ولا يتحركوا؛ الجديد ينزاد في الآخر */
function topHome() {
  const keep = homePicks.filter(id => byId(id)); if (keep.length >= 8) { homePicks = keep; return }
  const have = new Set(keep), pool = state.prods.filter(p => avail(p) !== 'out' && !have.has(String(p.id)));
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]] }
  homePicks = keep.concat(pool.slice(0, 8 - keep.length).map(p => String(p.id)));
}
function hcatImg(c) {
  if (c.id === SALE) return `<i class="bph ph-salec"></i><img${fi('/sale-c.webp?v=23')} src="/sale-c.webp?v=23" alt="" ${lz()} decoding="async">`;
  if (c.id !== SALE && c.image_url) return `<img${fi(thumb(c.image_url))} src="${esc(thumb(c.image_url))}" alt="" ${lz()} decoding="async">`;
  const p = prodsUnder(c.id).find(x => mainImg(x)) || prodsUnder(c.id)[0];
  if (p && mainImg(p)) return `<img${fi(thumb(mainImg(p)))} src="${esc(thumb(mainImg(p)))}" alt="" ${lz()} decoding="async">`;
  if (COVERS[c.id]) return coverHTML(c);
  return p && p.art ? art(p.art) : '<span class="ph">✦</span>';
}
function renderHome() {
  const hc = document.getElementById('hcats'), pk = document.getElementById('hpk'), g = document.getElementById('hpicks');
  if (!hc) return;
  if (!state.ok) {   // هياكل تحميل بنفس الحجم: ما فيش اختفاء ولا قفزة
    hc.hidden = pk.hidden = !!state.err; if (state.err) return;
    hc.innerHTML = Array.from({ length: 5 }, () => '<span class="hcat sk" aria-hidden="true"><span class="hci skb"></span><span class="sk-l skb" style="width:52px;height:11px;border-radius:6px;display:block"></span></span>').join('');
    g.innerHTML = skelProds(3); return;
  }
  const roots = catKids(null);
  hc.hidden = !roots.length;
  eagerN = 6; hc.innerHTML = roots.map(c => `<button class="hcat${c.id === SALE ? ' sale' : ''}" data-cat="${esc(c.id)}"><span class="hci">${hcatImg(c)}</span><span class="hcn">${esc(c.name)}</span></button>`).join(''); eagerN = 0;
  if (!homePicks) pickHome(); else topHome();
  const list = homePicks.map(byId).filter(Boolean);   // المنتج المحذوف يختفي
  pk.hidden = !list.length;
  eagerN = 3; const pkHTML = list.map(p => prodCard(p)).join(''); eagerN = 0;   // v41: أول 3 من «مختارات لكِ» بأولوية
  g.innerHTML = pkHTML + (state.prods.length > list.length ? `<button class="card hmore" data-go="products"><span class="hm-ic">${ic('arrow')}</span><b>تصفحي المزيد</b></button>` : '');
}

/* navigation */
/* ===== v75: صورة الرئيسية من لوحة التحكم (settings.hero_img + hero_ph = نسخة مضببة صغيرة). فاضية = /hero.webp.
   الجهاز يتذكر الصورة (mir_hero) وسكربت في أول index.html يرسمها من أول فريم. صورة جديدة من الكتالوج: تتحفظ للفتحة الجاية،
   وتتبدل توا بس بعد ما تتحمل كاملة، وفي لحظة ما حد يشوفها (تحت شاشة الشعار قبل ما تبدا تختفي، أو الصفحة/الترحيب مخفيين)،
   باش الصورة ما تتبدلش قدام عين الزبونة أبداً ===== */
const HERO_DEF = '/hero.webp?v=28';
const HERO_OK = /^https:\/\/(img\.miracles\.ly|sdxubtrdhbkyrfbwlydy\.supabase\.co\/storage\/v1\/object\/public\/products)\/[\w\/.-]+$/;
const HERO_PH = /^data:image\/(webp|jpeg|png);base64,[A-Za-z0-9+\/=]+$/;
let heroWant = null, heroT = 0;
function heroSync() {
  const s = state.set || {}, clean = v => String(v == null ? '' : v).trim().replace(/^"|"$/g, '');
  let u = clean(s.hero_img), p = clean(s.hero_ph);
  if (!HERO_OK.test(u)) { u = ''; p = '' } else if (!HERO_PH.test(p)) p = '';
  const cur = lsGet('mir_hero', null);
  if (u) { if (!cur || cur.u !== u || cur.p !== p) lsSet('mir_hero', { u, p }) }
  else if (cur) { try { localStorage.removeItem('mir_hero') } catch (e) {} }
  const url = u || HERO_DEF;
  if (heroWant && heroWant.url === url) { heroWant.ph = u ? p : null; return }
  const els = [...document.querySelectorAll('.hero.has-img, .au-top')].filter(el => (el.dataset.hero || window.__hero || HERO_DEF) !== url);
  clearTimeout(heroT); heroWant = null;
  if (!els.length) return;   // الصورة هذي هي اللي ظاهرة أصلاً
  const w = heroWant = { url, ph: u ? p : null, els, ready: false };
  const im = new Image(); im.decoding = 'async';
  const ok = () => { if (heroWant !== w) return; w.ready = true; heroTry() };
  im.onload = () => (im.decode ? im.decode().catch(() => {}) : Promise.resolve()).then(ok);
  im.src = url;
}
function heroHidden(el) {
  if (document.hidden) return true;
  const sp = document.getElementById('splash'); if (sp && !sp.dataset.out) return true;   // شاشة الشعار مغطية كل شي
  const au = document.getElementById('authv');
  if (el.classList.contains('au-top')) return !au || au.hidden;                            // صورة الترحيب: شاشة الدخول مسكّرة
  return view !== 'home' || (au && !au.hidden && !au.classList.contains('leaving'));      // صورة الرئيسية: الصفحة مش ظاهرة أو تحت شاشة الدخول
}
function heroTry() {
  clearTimeout(heroT); const w = heroWant; if (!w || !w.ready) return;
  w.els = w.els.filter(el => {
    if (!el.isConnected) return false;
    if (!heroHidden(el)) return true;
    el.style.setProperty('--hero-img', `url("${w.url}")`);
    el.style.setProperty('--hero-ph', w.ph === null ? 'initial' : w.ph ? `url("${w.ph}")` : 'none');   // initial = النسخة المضببة الأصلية
    el.dataset.hero = w.url; el.classList.add('hb-now', 'hb-on');   // الصورة متحمّلة: تبان (حتى لو القديمة ما اتحملتش)
    return false;
  });
  if (!w.els.length) { heroWant = null; return }
  heroT = setTimeout(heroTry, 700);   // نستنوا لحظة ما حد يشوفها
}
/* v72: الحركات الكبيرة (انتقال الصفحات، النوافذ، شاشة الدخول، عارض الصور): طول ما هي شغالة <html> عليه fx-mv،
   فالصور اللي توصل وقتها تبان من غير تدرّج (CSS). بالوقت مش بـ animationend (ممكن ما يجيش لو العنصر تسكّر) */
const FX_BIG = { 'v-fade': 220, 'v-fwd': 220, 'v-back': 220, 'au-out': 220, up: 500, side: 500, down: 500, 'lb-in': 400 };
let fxUntil = 0, fxT = 0;
function fxOff() { fxT = 0; const w = fxUntil - performance.now(); if (w > 0) { fxT = setTimeout(fxOff, w + 20); return } document.documentElement.classList.remove('fx-mv') }
document.addEventListener('animationstart', e => {
  const ms = FX_BIG[e.animationName]; if (!ms) return;
  fxUntil = Math.max(fxUntil, performance.now() + ms);
  document.documentElement.classList.add('fx-mv');
  if (!fxT) fxT = setTimeout(fxOff, ms + 20);
}, true);
setTimeout(() => { const s = document.getElementById('splash'); if (!s || s.dataset.out) document.documentElement.classList.remove('fx-sp') }, 4000);   // احتياط
/* ===== الانتقال بين الصفحات: نفس حركة الربع ثانية.
   أول مرة تنفتح فيها صفحة (ما اتسخّنتش): تترسم أولاً بشكل غير مرئي، وبعدها تبدا الحركة — بدل ما الحركة تتقطّع ===== */
const seenV = new Set(['v-home']);   // v70: الرئيسية مفتوحة من البداية (أول ضغطة عليها ما ترمّشش الصفحة)
function animView(el, cls) {
  // v88 (معتز): بدون حركة انتقال ولا إعادة حساب الشكل (void el.offsetWidth) — الصفحة تبان فوراً. تقعد بس تعلّم إن الصفحة اتفتحت (seenV للتسخين)
  seenV.add(el.id);
}
/* ===== التسخين: الصفحات الرئيسية تتجهز في الخلفية من أول لحظة (الكود + الشكل + الصور) بدون ما تبان،
   فلما الزبونة تفتحها أول مرة تكون جاهزة. المنتجات أولاً لأنها الأكثر فتحاً ===== */
function warmView(id) {
  const el = document.getElementById(id);
  if (!el || el.classList.contains('on') || seenV.has(id)) return Promise.resolve();
  el.classList.add('warm'); el.setAttribute('aria-hidden', 'true');
  void el.offsetHeight;
  return new Promise(res => requestAnimationFrame(() => requestAnimationFrame(() => {
    el.classList.remove('warm'); el.removeAttribute('aria-hidden');
    if (state.ok) seenV.add(id);   // لو الكتالوج لسّاتو ما وصلش: نعاودوا نسخّنوها لما يوصل
    res();
  })));
}
const pause = ms => new Promise(r => setTimeout(r, ms));
async function warmAll() {
  try {
    await warmView('v-products');
    splashHide();
    await pause(120);
    if (view !== 'account') { try { renderAccount() } catch (e) {} await warmView('v-account') }
    await pause(120);
    // طلباتي: للزبونة اللي عندها طلبات بس (تتجاب القائمة مسبقاً)
    if (user && engaged() && view !== 'orders') {
      try {
        await ordFetch();
        if (view !== 'orders' && myOrders.length && JSON.stringify(myOrders) !== ordSig) { document.getElementById('ordv').innerHTML = ordersListHTML(); ordSig = JSON.stringify(myOrders); ordAt = Date.now() }
      } catch (e) {}
      await warmView('v-orders');
    }
  } catch (e) { splashHide() }
}
/* ===== شاشة البداية (v39): تختفي أول ما الموقع يجهز، نص ثانية على الأقل وثانية ونص كحد أقصى.
   الخروج على مرحلتين: الشعار يختفي أول، وبعدها الخلفية (ما يبانش الشعار فوق الصفحة) ===== */
// v79: في التطبيق (طلب معتز) الشاشة تقعد 2.5 ث بالضبط (أقل وأقصى)؛ المتصفح زي قبل: نص ثانية على الأقل وثانية ونص كحد أقصى
// v81: بعد تحديث تحت الشاشة (bootUpd) الصفحة الجديدة تكمل الوقت الباقي بس (__spRem من index.html)، أقل شي 0.4 ث
const SP_MIN = window.__spRem >= 0 ? Math.max(400, window.__spRem) : window.__app ? 2500 : 500, SP_MAX = window.__app ? SP_MIN : Math.max(SP_MIN, 1500);
let splashDone; const splashP = new Promise(r => splashDone = r);   // v41: الكتالوج المبكر يستنى شاشة البداية تختفي (ما يطوّلهاش)
// v74: الشاشة ما تنشالش في الآخر (تقعد شفافة وما تنضغطش)، باش آخر الاختفاء ما يصيرش فيه إعادة رسم للصفحة؛ fx-sp ينشال بعدها بـ 300ms
let spHideT = 0;   // v83: موعد الاختفاء المتجدول (bootUpd يلغيه لو بيحدّث تحت الشاشة)
function splashHide() {
  const sp = document.getElementById('splash'); if (!sp || sp.dataset.out) { splashDone(); return }   // v51: ممكن شاشة الترحيب سكّرتها قبل
  sp.dataset.out = '1'; splashDone();   // ملاحظة v83: dataset.out = «الاختفاء متجدول»، مش «اختفت»؛ اللي اختفت فعلاً عندها .out
  // v60: الشعار 0.3 ث (يذوب ويكبر شوية)، والخلفية تبدا بعد 0.15 ث وتختفي في 0.4 ث، والشاشة تنشال بعدها (نفس توقيت السكربت في index.html)
  // v76: زي Presto: الشعار والخلفية يختفوا مع بعض في 0.12 ث (كان: الشعار 0.3 ث وبعدها الخلفية 0.4 ث). fx-sp ينشال بعد 300ms من آخر الاختفاء
  spHideT = setTimeout(() => { sp.classList.add('out'); setTimeout(() => document.documentElement.classList.remove('fx-sp'), 420) }, Math.max(0, SP_MIN - performance.now()));
}
setTimeout(splashHide, Math.max(0, SP_MAX - performance.now()));
/* v40: رجوع المفضلة = الصفحة اللي جت منها */
function favBack(prev) {
  const b = document.getElementById('favback'); if (!b) return;
  delete b.dataset.go; delete b.dataset.cat;
  if (prev === 'cat' && curCat) b.dataset.cat = curCat; else b.dataset.go = prev && document.getElementById('v-' + prev) ? prev : 'home';
}
let goQuiet = false;   // v52: الصفحة مفتوحة أصلاً (من شريط التنقل قبل الكود): بدون انتقال ثاني
function go(v, cat) {
  if (v !== 'home' && typeof leaveSkip !== 'undefined') leaveSkip = false;   // v97: كمّلت تتصفح ← الرجوع الجاي من الرئيسية يسأل من جديد
  if (['cart', 'orders', 'addr', 'map'].includes(v) && !user) return needLogin(() => go(v, cat));
  if (updV && v !== view && updGo(v, cat)) return;   // v42: فيه إصدار أحدث: يتحدّث ويفتح الصفحة اللي ضغطت عليها
  qpClose();   // v65
  const prev = view; view = v;
  document.querySelectorAll('.view').forEach(x => x.classList.remove('on', 't-fade', 't-fwd', 't-back', 'prep', 'warm'));
  const el = document.getElementById(v === 'cat' ? 'v-cat' : 'v-' + v);
  // v75: الضغط على صفحة من الشريط وهي مفتوحة: ترجع لفوق بنعومة، بدون أي تأثير. باقي الحالات: لفوق على طول زي قبل
  const reTap = prev === v && ['home', 'products', 'cart', 'orders', 'account'].includes(v);
  el.classList.add('on'); if (reTap) el.scrollTo({ top: 0, behavior: calm() ? 'auto' : 'smooth' }); else el.scrollTop = 0;
  let cls = null;
  if (prev !== v) {
    const dep = x => ({ cat: 1, chat: 1, addr: 1, map: 2, favs: 2 }[x] || 0), a = dep(prev), b = dep(v);
    cls = b > a ? 't-fwd' : b < a ? 't-back' : 't-fade';
  } else if (v === 'cat' && cat !== curCat) cls = catTrail(curCat).some(c => c.id === cat) ? 't-back' : 't-fwd';
  else if (v !== 'cat' && !reTap) cls = 't-fade';   // v74/v75: صفحة الشريط وهي مفتوحة: بدون تأثير
  if (cls && !goQuiet) animView(el, cls);
  phone.dataset.nav = ['cat', 'chat', 'addr', 'map'].includes(v) ? 'off' : 'on';
  if (v !== 'products') clearSearch();
  if (v === 'cart') { renderCartView(); share('cart', cartCheck) }
  if (v === 'addr') renderAddrs();
  if (v === 'account') renderAccount();
  if (v !== 'chat') stopChat();
  if (v === 'support') ticketsP = renderMyTickets();
  if (v === 'orders') renderOrders();
  if (v === 'favs') { if (prev !== 'favs') favBack(prev); renderFavs() }
  const navV = { support: 'account', chat: 'account', favs: '' }[v] ?? v;   // v40: المفضلة من الهيدر، مش من حسابي
  document.querySelectorAll('.nav button').forEach(b => b.classList.toggle('on', b.dataset.nav === navV));
  if (v !== 'cat' || cat !== curCat) { const ci = document.getElementById('cq'); if (ci && ci.value) { ci.value = ''; runCatSearch() } }
  if (v === 'cat') { curCat = cat; curChip = 'all'; renderCat() } else setGoCart(false);
  closeSheet(); placeToast();
}
function setGoCart(on) { document.getElementById('gocart').hidden = !on; phone.classList.toggle('gc', !!on) }
function renderCat() { renderCat0(); if (document.getElementById('cq').value) runCatSearch() }
function renderCat0() {
  const c = catById(curCat); if (!c) return;
  document.getElementById('cat-title').textContent = c.name;
  const trail = catTrail(c.id).slice(0, -1), cr = document.getElementById('crumbs');
  cr.hidden = !trail.length;
  cr.innerHTML = trail.map(t => `<button data-cat="${esc(t.id)}">${esc(t.name)}</button><span>${CHL}</span>`).join('') + (trail.length ? `<b>${esc(c.name)}</b>` : '');
  const ks = catKids(c.id);
  setGoCart(!ks.length);
  if (ks.length) {
    document.getElementById('chips').innerHTML = '';
    document.getElementById('cbar').hidden = true;
    document.getElementById('prodgrid').innerHTML = ks.map(catCard).join('');
    return;
  }
  const items = state.prods.filter(p => inCatOf(p, c.id));
  const subs = [...new Set(items.map(p => p.sub).filter(s => s && s !== 'all').map(s => SUBS[s] || s))].filter(s => s !== 'الكل');
  const chips = [['all', 'الكل'], ...subs.map(s => [s, s])];
  document.getElementById('chips').innerHTML = subs.length ? chips.map(([k, l]) => `<button class="chip ${k === curChip ? 'on' : ''}" data-chip="${esc(k)}">${esc(l)}</button>`).join('') : '';
  const list = sortList(items.filter(p => curChip === 'all' || (SUBS[p.sub] || p.sub) === curChip));
  const bg = BGS[c.id] || DEF_BG;
  document.getElementById('cbar').hidden = list.length < 2;
  document.getElementById('ccount').textContent = countLabel(list.length);
  const pgr = document.getElementById('prodgrid');
  pgr.innerHTML = list.length ? gridHTML('cat', list, bg) : `<p class="empty">لا توجد منتجات في هذا القسم حالياً</p>`; armGrids(pgr);
}
/* شارات الكرت: طلب مسبق / محدود الكمية، خصم. v94 (معتز): شارة «جديد» انشالت من كل مكان (ترتيب «الأحدث» يقعد)
   v95 (معتز): «محدود الكمية» للمنتج اللي يتتبع الكمية (مش النافد: النافد حالته بس) */
const isLimP = p => !!p && !p.preorder && trackOf(p) && avail(p) !== 'out';
function tagsHTML(p) {
  const t = [];
  if (p.preorder) t.push('<span class="pretag">طلب مسبق</span>');
  else if (isLimP(p)) t.push('<span class="pretag limt">محدود الكمية</span>');
  if (disc(p) && oldPrice(p) > Number(p.price)) t.push(`<span class="dtag">خصم ${disc(p)}%</span>`);
  return t.length ? `<div class="ptags">${t.join('')}</div>` : '';
}
function prodCard(p, bg) {
    return `<article class="card${avail(p) === 'out' ? ' out' : ''}"><div class="thumb" style="background:${bg || BGS[p.category_id] || DEF_BG}" data-open="${p.id}">${media(p)}${tagsHTML(p)}${(p.images || []).length > 1 ? `<span class="imgn" aria-label="${p.images.length} صور"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M21 16l-5-5-8 8"/></svg>${p.images.length}</span>` : ''}<button class="fav ${favs.has(p.id) ? 'on' : ''}" data-fav="${p.id}" aria-label="المفضلة">${ic('heart')}</button></div>
    <div class="pinfo"><h4 data-open="${p.id}">${esc(p.name)}</h4>${stkHTML(p)}<div class="prow"><span class="pwrap">${oldHTML(p)}<span class="price">${money(p.price)}</span></span></div>${cdHTML(p, true)}</div></article>`;   // v95 (معتز): زر السلة على الكرت انشال، ومكانه فاضي
}

/* ===== sorting (category + search) ===== */
let sortBy = 'new';
const SORTS = [['new', 'الأحدث'], ['asc', 'الأقل سعراً'], ['desc', 'الأعلى سعراً']];
const countLabel = n => n === 1 ? 'منتج واحد' : n === 2 ? 'منتجان' : n <= 10 ? `${n} منتجات` : `${n} منتجاً`;
function sortList(list) {
  const l = [...list], t = p => Date.parse(p.created_at) || 0;
  if (sortBy === 'asc') l.sort((a, b) => Number(a.price) - Number(b.price) || t(b) - t(a));
  else if (sortBy === 'desc') l.sort((a, b) => Number(b.price) - Number(a.price) || t(b) - t(a));
  else l.sort((a, b) => t(b) - t(a));
  return l;
}
function renderSortbars() { document.querySelectorAll('[data-sortbar]').forEach(s => s.innerHTML = SORTS.map(([k, l]) => `<button class="${k === sortBy ? 'on' : ''}" data-sort="${k}" aria-pressed="${k === sortBy}">${l}</button>`).join('')) }
renderSortbars();

/* ===== search (whole store: categories + products, from any page) ===== */
const norm = s => toEn(String(s || '')).toLowerCase().replace(/[ً-ْـ]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي').replace(/\s+/g, ' ').trim();
const sStrip = w => w.length > 3 && w.startsWith('ال') ? w.slice(2) : w;
/* فهرس البحث: كلمات كل منتج وقسم تتجهز مرة وحدة لكل نسخة كتالوج، مش مع كل حرف */
let sIdx = null, sIdxP = null, sIdxC = null;
function searchIndex() {
  if (sIdx && sIdxP === state.prods && sIdxC === state.cats) return sIdx;
  const catW = new Map(), words = s => norm(s).split(' ').map(sStrip);
  const catN = id => { if (!catW.has(id)) catW.set(id, words(catTrail(id).map(c => c.name).join(' '))); return catW.get(id) };
  sIdx = {
    p: state.prods.map(p => ({ p, nameW: words(p.name), otherW: [...catN(p.category_id), ...words(SUBS[p.sub] || p.sub)] })),
    c: state.cats.map(c => ({ c, nw: words(c.name) }))
  };
  sIdxP = state.prods; sIdxC = state.cats;
  return sIdx;
}
function searchFind(raw) {
  const words = norm(raw).split(' ').map(sStrip).filter(Boolean);
  if (!words.length) return null;
  const I = searchIndex(), hit = (ws, w) => ws.some(x => x.startsWith(w) || (w.length >= 3 && x.includes(w)));
  const prods = I.p.filter(x => words.every(w => hit(x.nameW, w) || x.otherW.some(y => y.startsWith(w)))).map(x => x.p);
  const cats = I.c.filter(x => words.every(w => hit(x.nw, w))).map(x => x.c);
  return { prods, cats };
}
/* البحث يستنى الزبونة توقف عن الكتابة لحظة (بدل ما يعيد الحساب مع كل حرف) */
const later = (fn, ms) => { let t = null; return () => { clearTimeout(t); t = setTimeout(fn, ms) } };
function scatHTML(c) {
  const path = catTrail(c.id).slice(0, -1).map(x => esc(x.name)).join(` ${CHL} `), n = prodsUnder(c.id).length, img = c.image_url || (prodsUnder(c.id)[0] && thumb(mainImg(prodsUnder(c.id)[0])));
  return `<button class="scat" data-cat="${esc(c.id)}"><span class="si">${img ? `<img${fi(img)} src="${esc(img)}" alt="" loading="lazy" decoding="async">` : '✦'}</span><span class="st"><b>${esc(c.name)}</b><small>${path ? path + ' · ' : ''}${n ? countLabel(n) : 'قسم'}</small></span>${ic('back')}</button>`;
}
/* نتائج: الأقسام أولاً، وبعدها المنتجات (في هذا القسم أولاً، ثم من أقسام أخرى) */
function searchHTML(r, scope) {
  const cats = r.cats.filter(c => c.id !== scope).slice(0, 8);
  let html = cats.length ? `<div class="sgroup"><h4>الأقسام</h4><div class="scats">${cats.map(scatHTML).join('')}</div></div>` : '';
  const list = sortList(r.prods);
  if (scope) {
    const inside = new Set(catDesc(scope)), inS = p => scope === SALE ? inCatOf(p, SALE) : inside.has(p.category_id), a = list.filter(inS), b = list.filter(p => !inS(p));
    if (a.length) html += `<h4 class="shead">في هذا القسم</h4><div class="grid">${gridHTML('csa', a)}</div>`;
    if (b.length) html += `<h4 class="shead">${a.length ? 'من أقسام أخرى' : 'من أقسام أخرى في المتجر'}</h4><div class="grid">${gridHTML('csb', b)}</div>`;
  } else if (list.length) html += `${cats.length ? '<h4 class="shead">المنتجات</h4>' : ''}<div class="grid">${gridHTML('s', list)}</div>`;
  return html || `<div class="snone">${ic('search')}<b>لا توجد نتائج</b><span>جرّبي كلمة أخرى أو تصفحي الأقسام.</span></div>`;
}
function runSearch() {
  const raw = document.getElementById('q').value;
  document.querySelector('[data-qclear]').hidden = !raw;
  const sg = document.getElementById('searchgrid'), cg = document.getElementById('catgrid'), sr = document.getElementById('sres'), sb = document.getElementById('sbar');
  if (!norm(raw)) { sg.hidden = true; sb.hidden = true; cg.hidden = false; return }
  if (!state.ok) { cg.hidden = true; sg.hidden = false; sb.hidden = true; sg.innerHTML = state.err ? `<p class="empty">تعذر تحميل المنتجات</p>` : `<div class="grid">${skelProds(4)}</div>`; return }
  const r = searchFind(raw);
  cg.hidden = true; sg.hidden = false; sb.hidden = !r.prods.length;
  sr.textContent = countLabel(r.prods.length);
  sb.querySelector('.sortbar').hidden = r.prods.length < 2;
  sg.innerHTML = searchHTML(r, null); armGrids(sg);
}
function clearSearch() { const q = document.getElementById('q'); if (q && q.value) { q.value = ''; runSearch() } }
document.getElementById('q').addEventListener('input', later(runSearch, 150));
/* البحث من داخل أي قسم (يبحث في المتجر كله) */
function runCatSearch() {
  const inp = document.getElementById('cq'), raw = inp.value, on = !!norm(raw);
  document.querySelector('[data-cqclear]').hidden = !raw;
  const res = document.getElementById('csres');
  ['chips', 'cbar', 'prodgrid'].forEach(id => document.getElementById(id).classList.toggle('sq-hide', on));
  res.hidden = !on; if (!on) { res.innerHTML = ''; return false }
  const r = searchFind(raw);
  res.innerHTML = `${r.prods.length ? `<div class="listbar"><p class="sres">${countLabel(r.prods.length)}</p><div class="sortbar" data-sortbar ${r.prods.length < 2 ? 'hidden' : ''}></div></div>` : ''}${searchHTML(r, curCat)}`;
  renderSortbars(); armGrids(res);
  return true;
}
function clearCatSearch() { const i = document.getElementById('cq'); if (i && i.value) { i.value = ''; runCatSearch() } }
document.getElementById('cq').addEventListener('input', later(runCatSearch, 150));

/* cart */
function addToCart(p, o) {
  const opts = o.opts || {}, key = lineKey(p.id, opts), v = varOf(p, opts);
  if (vattrOf(p) && !v) { toast('يُرجى اختيار ' + vattrOf(p) + '.'); return false }
  if (optsOut(p, opts)) { toast('هذا الخيار غير متوفر حالياً'); return false }
  if (!canBuy(p) || leftOf(p, v) === 0) { toast('نفدت الكمية'); return false }
  let l = cart.find(x => x.key === key);
  const have = l ? l.qty : 0, rf = roomFor(p, v, key, opts), cap = rf.room;
  if (cap <= have) { toast(roomMsg(rf, have)); return false }
  if (!l && cart.filter(x => !x.gone).length >= MAXLINES) { toast('وصلتِ للحد الأقصى للسلة (30 منتج).'); return false }
  if (!l) { l = { key, id: p.id, name: p.name, price: Number(p.price), qty: 0, opts, img: mainImg(p) }; cart.push(l) }
  const want = have + (o.qty || 1);
  l.qty = Math.min(cap, want);
  saveCart(); toast(want > cap ? (rf.qm || 'أُضيفت الكمية المتوفرة فقط') : 'أُضيف إلى السلة');
  return true;
}
/* v65: اختيار الكمية من قائمة أرقام (صفحة المنتج والسلة): من 1 لين المتاح ليها بس
   (المتوفر − المحجوز لغيرها − اللي في سلتها من نفس المنتج/اللون، وأقصى شي 99). السطر يتعرف بمفتاحه مش برقمه */
let qpCtx = null;
function qpClose() { const el = document.getElementById('qpop'); if (el) el.remove(); qpCtx = null }
function qpMax(ctx) {
  if (ctx.k === 'p') {
    const p = pend && byId(pend.id); if (!p) return { max: 0 };
    const va = vattrOf(p), v = va ? pend.opts[va] : ''; if (va && !v) return { max: 0, need: va };
    const rf = roomFor(p, v, undefined, pend.opts); return { max: Math.min(MAXQ, rf.room), base: rf.base, cur: pend.qty, qm: rf.qm };
  }
  const l = cart.find(x => x.key === ctx.key); if (!l) return { max: 0, gone: true };
  const p = byId(l.id), rf = p ? roomFor(p, varOf(p, l.opts), l.key, l.opts) : { room: MAXQ, base: MAXQ };
  return { max: Math.min(MAXQ, rf.room), base: rf.base, cur: l.qty, qm: rf.qm };
}
function qpOpen(btn) {
  qpClose();
  const ctx = btn.dataset.qpick === 'p' ? { k: 'p' } : { k: 'c', key: btn.dataset.qk };
  const m = qpMax(ctx);
  if (m.gone) return;
  if (m.need) return toast('يُرجى اختيار ' + m.need + '.');
  if (m.max < 1) return toast(roomMsg(m, m.cur));
  qpCtx = ctx;
  const el = document.createElement('div'); el.id = 'qpop'; el.className = 'qpop'; el.setAttribute('role', 'listbox');
  el.innerHTML = Array.from({ length: m.max }, (_, i) => `<button data-qset="${i + 1}" role="option"${i + 1 === m.cur ? ' class="on" aria-selected="true"' : ''}>${i + 1}</button>`).join('');
  const ph = document.getElementById('phone') || document.body; ph.appendChild(el);   // داخل الإطار: ياخذ ألوان الوضع الليلي
  const pr = ph.getBoundingClientRect(), r = btn.getBoundingClientRect(), h = Math.min(el.scrollHeight, 232), w = el.offsetWidth;
  const top = r.bottom + 6 + h > pr.bottom - 8 ? Math.max(pr.top + 8, r.top - 6 - h) : r.bottom + 6;
  el.style.top = (top - pr.top) + 'px'; el.style.left = Math.max(8, Math.min(pr.width - w - 8, r.left - pr.left + r.width / 2 - w / 2)) + 'px';
  const on = el.querySelector('.on'); if (on) el.scrollTop = Math.max(0, on.offsetTop - h / 2 + on.offsetHeight / 2);
}
function qpSet(n) {
  const ctx = qpCtx; qpClose(); if (!ctx) return;
  const m = qpMax(ctx); if (m.gone) return;
  if (n > m.max) { if (m.max < 1) return toast(roomMsg(m, m.cur)); toast(m.qm || NOMORE); n = m.max }   // تغيّر المتوفر وهي تختار
  if (ctx.k === 'p') { pend.qty = Math.max(1, n); const e = document.getElementById('pq'); if (e) e.textContent = pend.qty; return }
  const l = cart.find(x => x.key === ctx.key); if (!l) return;
  l.qty = Math.max(1, Math.min(MAXQ, n)); saveCart(); renderCartView();
}
document.addEventListener('click', e => {
  const q = e.target.closest('[data-qpick],[data-qset]');
  if (q && q.dataset.qset) { e.stopPropagation(); return qpSet(Number(q.dataset.qset)) }
  if (q) { e.stopPropagation(); return document.getElementById('qpop') && qpCtx && (q.dataset.qpick === 'p' ? qpCtx.k === 'p' : qpCtx.key === q.dataset.qk) ? qpClose() : qpOpen(q) }
  if (!e.target.closest('#qpop')) qpClose();
}, true);
addEventListener('scroll', e => { if (qpCtx && !(e.target && e.target.closest && e.target.closest('#qpop'))) qpClose() }, true);
addEventListener('resize', () => qpClose());
/* تعديل كميات السلة حسب المتوفر: { id: n } */
/* تعديل كميات السلة حسب المتوفر: [{ id, v, n }] */
function capCart(list) {
  list.forEach(({ id, v, n }) => {
    let room = Math.max(0, Number(n) || 0);
    cart.filter(l => String(l.id) === String(id) && lineHasV(l, v)).forEach(l => { l.qty = Math.min(l.qty, room); room -= l.qty });
  });
  cart = cart.filter(l => l.qty > 0); saveCart();
}
function syncCart() {
  if (!state.ok) return;
  const out = [];
  cart.forEach(l => {
    const p = byId(l.id); l.key = lineKey(l.id, l.opts);
    l.gone = !p;                                   // المنتج انخفى أو انحذف
    if (p) {
      l.name = p.name; l.price = Number(p.price); l.img = mainImg(p);
      const va = vattrOf(p), ch = choiceAttrs(p);
      l.badv = !!(va && !(String((l.opts || {})[va] || '') in vstockOf(p)))   // اللون انحذف أو تغيّر اسمه
        || Object.entries(l.opts || {}).some(([k, x]) => { const a = ch.find(c => c.label === k); return a && !a.values.includes(String(x)) });
    } else l.badv = false;
    const same = out.find(x => x.key === l.key);   // نفس المنتج بنفس الاختيار = سطر واحد
    if (same) same.qty = Math.min(MAXQ, same.qty + l.qty); else out.push(l);
  });
  // v66: أقصى كمية (لو اتحطت أو نقصت من اللوحة والسلة فيها أكثر): تنزل للحد
  const used = {}; let cut = '';
  out.forEach(l => { const p = byId(l.id), n = qmaxOf(p); if (!n || l.gone) return; const k = String(l.id) + '#' + qmaxGrp(p, l.opts), left = n - (used[k] || 0); if (l.qty > left) { l.qty = Math.max(0, left); cut = qmaxMsg(p) } used[k] = (used[k] || 0) + l.qty });
  cart = cut ? out.filter(l => l.qty > 0) : out; saveCart();
  if (cut) toast('تم تعديل الكمية في السلة. ' + cut);
}
const okLines = () => cart.filter(l => !l.gone && !l.badv);
const CCLEAR = () => `<button class="cta pay cclear" data-cartclear>${ic('trash')} حذف السلة</button>`;
function renderCartView() {
  syncCart();
  const box = document.getElementById('cartv');
  if (!cart.length) {
    if (box.querySelector('.cempty')) return;
    box.innerHTML = `<div class="cempty ein"><div class="ce-ic">${ic('cart')}</div><h3>سلتك فارغة</h3><p>أضيفي منتجات من الأقسام وستظهر هنا.</p><button class="cta" data-go="products">تسوقي الآن ${ic('arrow')}</button></div>`;
    return;
  }
  const total = okLines().reduce((a, l) => a + l.price * l.qty, 0);
  const a = curAddr();
  const groups = []; cart.forEach((l, i) => { let g = groups.find(x => x.id === l.id); if (!g) groups.push(g = { id: l.id, rows: [] }); g.rows.push(i) });
  // v95 (معتز): الترتيب: محدود الكمية، ثم الطلب المسبق، ثم الباقي (وداخل كل مجموعة ترتيب الإضافة)
  const rank = g => { const p = byId(g.id); return !p ? 3 : p.preorder ? 1 : trackOf(p) ? 0 : 2 };
  groups.sort((a, b) => rank(a) - rank(b));
  box.innerHTML = groups.map(g => {
    const first = cart[g.rows[0]], p = byId(g.id);
    if (!p) return `<div class="ccard gone" data-cid="${esc(g.id)}"><div class="cimg">${first.img ? `<img src="${esc(thumb(first.img))}" alt="">` : '✦'}</div>
      <div class="cbody"><div class="ctop"><b>${esc(first.name)}</b></div>
      <div class="cwarn out"><span>هذا المنتج لم يعد متوفراً</span><button data-rmp="${esc(g.id)}">حذف</button></div></div></div>`;
    const rows = g.rows.map(i => {
      const l = cart[i], cap = Math.min(MAXQ, qmaxLeft(p, l.opts, l.key));   // v66: زر + باهت عند أقصى كمية
      const ot = optsText(l);
      if (l.badv) return `<div class="crow">${ot.length ? `<span class="cvar">${ot.map(esc).join(' · ')}</span>` : ''}</div>
        <div class="cwarn out"><span>هذا اللون لم يعد متوفراً.</span><button data-recolor="${i}">اختيار لون</button></div>`;
      // الكميات ما تنكشفش في السلة (الفحص عند "إتمام الطلب")، بس المنتج اللي المتجر خلاه "غير متوفر" بدون أرقام
      const warn = !trackOf(p) && !p.preorder && (!canBuy(p) || optsOut(p, l.opts))
        ? `<div class="cwarn out"><span>${!canBuy(p) ? 'يتوفر قريباً' : 'هذا الخيار غير متوفر حالياً'}</span><button data-rm="${i}">حذف</button></div>` : '';
      return `<div class="crow">${ot.length ? `<span class="cvar">${ot.map(esc).join(' · ')}</span>` : ''}
        <div class="stepper"><button data-ci="${i}" data-d="1" aria-label="زيادة" ${l.qty >= cap ? 'disabled' : ''}>${ic('plus')}</button><button class="qn" data-qpick="c" data-qk="${esc(l.key)}" aria-label="اختيار الكمية">${l.qty}</button><button data-ci="${i}" data-d="-1" aria-label="إنقاص" ${l.qty <= 1 ? 'disabled' : ''}><svg class="ic"><path d="M5 12h14"/></svg></button></div>
        <span class="cline">${money(l.price * l.qty)}</span>${g.rows.length > 1 ? `<button class="cx" data-rm="${i}" aria-label="حذف هذا الاختيار">×</button>` : ''}</div>${warn}`;
    }).join('');
    const limc = g.rows.some(i => limLine(cart[i]));   // v93: شارة «محدود الكمية» في السلة (بدون الإطار)
    const okc = !limc && !p.preorder && !trackOf(p) && canBuy(p) && !g.rows.some(i => optsOut(p, cart[i].opts));   // v95: «متوفر» بالأخضر
    return `<div class="ccard${limc || okc ? ' limc' : ''}" data-cid="${esc(g.id)}">${limc ? '<span class="limtag">محدود الكمية</span>' : okc ? '<span class="limtag oktag">متوفر</span>' : ''}<div class="cimg">${first.img ? `<img src="${esc(thumb(first.img))}" alt="">` : '✦'}</div>
      <div class="cbody"><div class="ctop"><b>${esc(first.name)}</b><button class="ctrash" data-rmp="${esc(g.id)}" aria-label="حذف ${esc(first.name)}">${ic('trash')}</button></div>
      ${p && p.preorder ? `<span class="cpre">طلب مسبق · ${esc(leadTxt(p))}</span>` : ''}
      <span class="cunit">${money(first.price)} للقطعة</span>${rows}</div></div>`;
  }).join('') + `
    <div class="cdlv">${ic('pin')}<div><small>التوصيل إلى</small><b>${a ? esc(addrLine(a)) + (a.v !== 2 && a.details ? ' · ' + esc(a.details) : '') : 'لم تحددي عنوان التوصيل'}</b></div><button data-addr>${a ? 'تغيير' : 'إضافة'}</button></div>
    <div class="csum"><div class="row"><span>عدد القطع</span><span>${cartCount()}</span></div>
      <div class="row"><span>مجموع المنتجات</span><span>${money(total)}</span></div>
      <div class="row"><span>التوصيل</span>${ckMixed() ? '<span class="soon">يُحدد في صفحة تأكيد الطلب</span>' : dlvCell(dlvFee(a))}</div>
      <div class="row big"><span>الإجمالي</span><span>${money(total)}</span></div><p class="cnote">الإجمالي لا يشمل التوصيل.</p></div>
    ${!ckOn() ? `<button class="cta pay" disabled>إتمام الطلب</button>${CCLEAR()}<p class="paynote">استقبال الطلبات متوقف حالياً</p>`
      : payMode() === 'test' ? `<button class="cta pay" data-checkout>إتمام الطلب (تجريبي)</button>${CCLEAR()}<p class="paynote">طلب تجريبي بدون دفع حقيقي</p>`
      : `${ckBtnHTML()}${CCLEAR()}<p class="paynote">${payMode() === 'sandbox' ? 'الدفع في وضع التجربة، لن يُخصم أي مبلغ حقيقي' : 'الدفع الإلكتروني عبر إيزون باي'}</p>`}`;
  limPaint();
}

/* product sheet */
const ppoHTML = p => disc(p) && oldPrice(p) > Number(p.price) ? `<s>${money(oldPrice(p))}</s><span class="pct">خصم ${disc(p)}%</span>` : '';
/* رابط المنتج ومشاركته */
const prodURL = id => location.origin + '/p/' + encodeURIComponent(id);   // v68: رابط خاص لكل منتج (قوقل). القديم ?p= يقعد يفتح
async function shareProduct(id) {
  const p = byId(id); if (!p) return;
  const url = prodURL(id);
  if (navigator.share) { try { await navigator.share({ title: p.name + ' — Miracles', text: p.name, url }); return } catch (e) { if (e && e.name === 'AbortError') return } }
  try { await navigator.clipboard.writeText(url); toast('تم نسخ رابط المنتج') }
  catch (e) { toast('تعذر نسخ الرابط') }
}
/* فتح منتج من رابط مشترك (?p=) بعد تحميل المنتجات */
let DEEP = (() => { try { const m = location.pathname.match(/^\/p\/([^/]+)\/?$/); return new URLSearchParams(location.search).get('p') || (m ? decodeURIComponent(m[1]) : null) } catch (e) { return null } })();   // v68: /p/<id> أو ?p=<id>
let deepEarly = null, deepSig = '';   // v70: منتج الرابط اللي انفتح من النسخة اللي على الجهاز (يتأكد بعد ما يوصل الكتالوج الجديد)
/* v70: لو الزبونة ضغطت أي حاجة قبل ما منتج الرابط يتفتح: اختيارها هي اللي يكسب (الفتح التلقائي يتلغى) */
document.addEventListener('click', e => { if (DEEP && e.isTrusted) { DEEP = null; try { history.replaceState(null, '', '/') } catch (x) {} } }, true);
/* v70: بعد الكتالوج الجديد: منتج الرابط المفتوح من الجهاز انحذف ← يتقفل برسالة. تغيّر (سعر/كمية/صور) ← يتحدّث */
function deepCheck() {
  const id = deepEarly; deepEarly = null; if (!id) return;
  if (!(pend && String(pend.id) === id && sheet.classList.contains('on') && sheet.querySelector('.det'))) return;   // قفلته أو فتحت حاجة ثانية
  const p = byId(id);
  if (!p) { closeSheet(); toast('هذا المنتج غير متاح حالياً.'); return }
  if (JSON.stringify(p) !== deepSig) openProduct(id);
}
function openDeep() {
  if (!DEEP || !state.ok) return;
  const id = DEEP; DEEP = null;
  try { history.replaceState(null, '', '/') } catch (e) {}   // v68: من /p/<id> يرجع للرئيسية (كان location.pathname = / دايماً)
  if (byId(id)) openProduct(id); else toast('هذا المنتج غير متاح حالياً.');
}
function openProduct(id) {
  const p = byId(id); if (!p) return;
  pend = { id, opts: {}, qty: 1, imgs: [] };
  const imgs = (p.images && p.images.length) ? p.images : (p.image_url ? [p.image_url] : []);
  const many = imgs.length > 1; pend.imgs = imgs;
  const gal = imgs.length
    ? `<div class="galw"><div class="gal" id="gal">${imgs.map((u, i) => `<div class="gi"${thumb(u) !== u ? ` style="background-image:url('${esc(thumb(u))}')"` : ''}><img class="ld" src="${esc(u)}" alt="${esc(p.name)} — صورة ${i + 1}" data-lbi="${i}" decoding="async"${i ? ' loading="lazy"' : ''}></div>`).join('')}</div>
       ${many ? `<span class="gcount" id="gcount">1 / ${imgs.length}</span>` : ''}</div>
       ${many ? `<div class="gdots" id="gdots">${imgs.map((_, i) => `<button data-gi="${i}" class="${i ? '' : 'on'}" aria-label="الصورة ${i + 1}"></button>`).join('')}</div>` : ''}`
    : `<div class="gal"><div class="art" style="background:${BGS[p.category_id] || DEF_BG}">${p.art ? art(p.art) : '<div class="ph">✦</div>'}</div></div>`;
  const out = !canBuy(p);
  const at = attrsOf(p), info = at.filter(a => a.values.length === 1), choice = at.filter(a => a.values.length > 1);
  const infoHTML = info.length ? `<div class="pattrs">${info.map(a => `<div><span>${esc(a.label)}:</span><b>${esc(a.values[0])}</b></div>`).join('')}</div>` : '';
  const va = vattrOf(p);
  const choiceHTML = choice.map(a => `<b class="lbl">${esc(a.label)}</b><div class="opts">${a.values.map(v => { const none = (a.label === va && !leftOf(p, v)) || optOut(p, a.label, v);
    return `<button class="opt" data-al="${esc(a.label)}" data-av="${esc(v)}" ${none ? 'disabled' : ''}>${esc(v)}${none ? '<small>قريباً</small>' : ''}</button>` }).join('')}</div>`).join('');
  openSheet('bottom now', `<div class="det">${gal}<div class="dhead"><h3>${esc(p.name)}</h3><button class="shr" data-share="${esc(p.id)}" aria-label="مشاركة المنتج">${ic('share')}</button></div>${infoHTML}<div class="pprice"><div><small>السعر</small><div class="pp" id="ppr">${money(p.price)}</div><div class="ppo" id="ppo">${ppoHTML(p)}</div><div id="pcd">${cdHTML(p)}</div></div><span id="pstk">${pstkHTML(p)}</span></div>${pdlvHTML()}
    ${p.preorder ? `<div class="prenote">${ic('clock')}<div><b>منتج طلب مسبق</b>نوفّره لك خصيصاً، و${esc(leadTxt(p))} من تأكيد الطلب.</div></div>` : ''}
    ${p.description ? `<p class="desc">${esc(p.description)}</p>` : ''}${choiceHTML}
    <div class="buyrow"><div class="qty ${va ? 'off' : ''}" id="pqty"><button data-qty="-1" aria-label="أنقصي">−</button><button class="qn" id="pq" data-qpick="p" aria-label="اختيار الكمية">1</button><button data-qty="1" aria-label="زيدي">+</button></div>
    <button class="cta" data-addp ${out ? 'disabled' : ''}>${out ? outTxt(p) : 'أضيفي إلى السلة'}</button></div>${va && !out ? `<p class="qhint" id="qhint">يُرجى اختيار ${esc(va)} أولاً.</p>` : ''}</div>`);   // v96 (معتز): صفحة المنتج تنفتح على طول (بدون حركة ولا تدرّج التعتيم)
  // v58: الصورة الكبيرة تبان بتدرّج قصير فوق الصغيرة لما توصل (كانت تطلع فجأة)، واللي في الكاش تبان طول
  document.querySelectorAll('#gal img.ld').forEach(im => { const ok = () => im.classList.remove('ld'); if (im.complete && im.naturalWidth) ok(); else { im.addEventListener('load', ok, { once: true }); im.addEventListener('error', ok, { once: true }) } });
  if (many) {
    const g = document.getElementById('gal');
    // v40: باقي الصور تتحمّل ورا الأولى مباشرة (بدل لما توصلها)، فالتبديل يكون ناعم
    const g0 = g.querySelector('img'), rest = () => g.querySelectorAll('img[loading="lazy"]').forEach(x => x.loading = 'eager');
    if (g0.complete) rest(); else { g0.addEventListener('load', rest, { once: true }); g0.addEventListener('error', rest, { once: true }) }
    // v59: كل صورة تتجهز (decode) أول ما توصل، فالسحب لها ما يتقطعش وهي تتفك في نفس اللحظة
    g.querySelectorAll('img').forEach(im => { const dec = () => { if (im.decode) im.decode().catch(() => {}) }; if (im.complete && im.naturalWidth) dec(); else im.addEventListener('load', dec, { once: true }) });
    // v59: العداد والنقاط يتحدثوا مرة في الفريم، وبس لما الصورة تتبدل (كانوا مع كل حركة سحب)
    const cur = () => Math.round(Math.abs(g.scrollLeft) / (g.clientWidth + 8));
    let gi = 0, gq = 0;
    g.addEventListener('scroll', () => {
      if (gq) return;
      gq = requestAnimationFrame(() => {
        gq = 0; const i = Math.min(imgs.length - 1, cur()); if (i === gi) return; gi = i;
        const c = document.getElementById('gcount'); if (c) c.textContent = `${i + 1} / ${imgs.length}`;
        document.querySelectorAll('#gdots button').forEach((b, k) => b.classList.toggle('on', k === i));
      });
    }, { passive: true });
  }
  prodLive(id);
}
/* ===== image lightbox: swipe, pinch zoom, double-tap zoom ===== */
const LB = { imgs: [], i: 0, s: 1, x: 0, y: 0, pts: new Map(), mode: '', g: null, lastTap: 0, lastXY: null };
const lbEl = document.getElementById('lb'), lbTrack = document.getElementById('lb-track');
function openLB(imgs, i) {
  if (!imgs || !imgs.length) return;
  Object.assign(LB, { imgs, i: Math.max(0, Math.min(imgs.length - 1, i || 0)), s: 1, x: 0, y: 0, mode: '' }); LB.pts.clear();
  lbTrack.innerHTML = imgs.map((u, k) => `<div class="lb-s"><img src="${esc(u)}" alt="صورة ${k + 1}" draggable="false"></div>`).join('');
  document.getElementById('lb-hint').style.opacity = '1';
  lbEl.hidden = false; lbPlace(false);
  clearTimeout(LB.ht); LB.ht = setTimeout(() => document.getElementById('lb-hint').style.opacity = '0', 2200);
}
function closeLB() { lbEl.hidden = true; lbTrack.innerHTML = ''; LB.pts.clear() }
const lbImg = () => lbTrack.children[LB.i] && lbTrack.children[LB.i].firstElementChild;
function lbPlace(anim, dx) {
  lbTrack.classList.toggle('drag', !anim);
  lbTrack.style.transform = `translateX(calc(${LB.i * 100}% + ${dx || 0}px))`;
  document.getElementById('lb-n').textContent = LB.imgs.length > 1 ? `${LB.i + 1} / ${LB.imgs.length}` : '';
}
function lbClamp() {
  const im = lbImg(); if (!im) return;
  const W = lbEl.clientWidth, H = lbEl.clientHeight, w = im.offsetWidth * LB.s, h = im.offsetHeight * LB.s;
  const mx = Math.max(0, (w - W) / 2), my = Math.max(0, (h - H) / 2);
  LB.x = Math.max(-mx, Math.min(mx, LB.x)); LB.y = Math.max(-my, Math.min(my, LB.y));
}
function lbZoom(anim) {
  const im = lbImg(); if (!im) return;
  im.classList.toggle('drag', !anim);
  im.style.transform = LB.s === 1 && !LB.x && !LB.y ? '' : `translate(${LB.x}px,${LB.y}px) scale(${LB.s})`;
}
function lbGo(k) {
  const n = Math.max(0, Math.min(LB.imgs.length - 1, k));
  if (n !== LB.i) { LB.s = 1; LB.x = LB.y = 0; lbZoom(true) }
  LB.i = n; lbPlace(true);
}
const lbRel = (cx, cy) => { const r = lbEl.getBoundingClientRect(); return [cx - r.left - r.width / 2, cy - r.top - r.height / 2] };
lbEl.addEventListener('pointerdown', e => {
  if (e.target.closest('.lb-x')) return;
  try { lbEl.setPointerCapture(e.pointerId) } catch (er) {}
  LB.pts.set(e.pointerId, [e.clientX, e.clientY]);
  if (LB.pts.size === 2) {
    const [a, b] = [...LB.pts.values()], mid = lbRel((a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
    LB.mode = 'pinch'; LB.g = { d: Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, s: LB.s, x: LB.x, y: LB.y, mid }; lbPlace(true);
  } else if (LB.pts.size === 1) {
    LB.mode = 'drag'; LB.g = { sx: e.clientX, sy: e.clientY, x: LB.x, y: LB.y, moved: false, t: Date.now() };
  }
});
lbEl.addEventListener('pointermove', e => {
  if (!LB.pts.has(e.pointerId)) return;
  LB.pts.set(e.pointerId, [e.clientX, e.clientY]);
  const g = LB.g; if (!g) return;
  if (LB.mode === 'pinch' && LB.pts.size >= 2) {
    const [a, b] = [...LB.pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]), mid = lbRel((a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
    const s = Math.max(1, Math.min(4, g.s * d / g.d));
    LB.x = mid[0] - (g.mid[0] - g.x) * (s / g.s); LB.y = mid[1] - (g.mid[1] - g.y) * (s / g.s); LB.s = s;
    lbClamp(); lbZoom(false);
  } else if (LB.mode === 'drag') {
    const dx = e.clientX - g.sx, dy = e.clientY - g.sy;
    if (Math.abs(dx) > 6 || Math.abs(dy) > 6) g.moved = true;
    if (LB.s > 1) { LB.x = g.x + dx; LB.y = g.y + dy; lbClamp(); lbZoom(false) }
    else if (Math.abs(dx) >= Math.abs(dy)) { const edge = (LB.i === 0 && dx < 0) || (LB.i === LB.imgs.length - 1 && dx > 0); lbPlace(false, edge ? dx / 3 : dx) }
    else if (dy > 0) { lbTrack.classList.add('drag'); lbTrack.style.transform = `translateX(${LB.i * 100}%) translateY(${dy}px)`; lbEl.style.background = `rgba(11,11,15,${Math.max(.35, 1 - dy / 400)})` }
  }
});
function lbUp(e) {
  if (!LB.pts.has(e.pointerId)) return;
  LB.pts.delete(e.pointerId);
  const g = LB.g;
  if (LB.mode === 'pinch') {
    if (LB.pts.size === 1) { const [p] = [...LB.pts.values()]; LB.mode = 'drag'; LB.g = { sx: p[0], sy: p[1], x: LB.x, y: LB.y, moved: true, t: 0 }; return }
    LB.mode = ''; if (LB.s < 1.05) { LB.s = 1; LB.x = LB.y = 0 } lbClamp(); lbZoom(true); return;
  }
  if (LB.mode !== 'drag' || !g) return;
  LB.mode = '';
  const dx = e.clientX - g.sx, dy = e.clientY - g.sy, W = lbEl.clientWidth;
  lbEl.style.background = '';
  if (!g.moved) {
    const now = Date.now(), xy = [e.clientX, e.clientY];
    if (now - LB.lastTap < 320 && LB.lastXY && Math.hypot(xy[0] - LB.lastXY[0], xy[1] - LB.lastXY[1]) < 40) {
      LB.lastTap = 0;
      if (LB.s > 1) { LB.s = 1; LB.x = LB.y = 0 }
      else { const [rx, ry] = lbRel(xy[0], xy[1]); LB.s = 2.5; LB.x = -1.5 * rx; LB.y = -1.5 * ry; lbClamp() }
      lbZoom(true); return;
    }
    LB.lastTap = now; LB.lastXY = xy; return;
  }
  if (LB.s > 1) return;
  if (Math.abs(dy) > Math.abs(dx) && dy > 110) return closeLB();
  if (Math.abs(dx) > Math.max(50, W * .16)) lbGo(LB.i + (dx > 0 ? 1 : -1)); else lbPlace(true);
}
lbEl.addEventListener('pointerup', lbUp);
lbEl.addEventListener('pointercancel', lbUp);
lbEl.addEventListener('wheel', e => { e.preventDefault(); const [rx, ry] = lbRel(e.clientX, e.clientY), s0 = LB.s, s = Math.max(1, Math.min(4, s0 * (e.deltaY < 0 ? 1.15 : 1 / 1.15))); LB.x = rx - (rx - LB.x) * (s / s0); LB.y = ry - (ry - LB.y) * (s / s0); LB.s = s; if (s === 1) LB.x = LB.y = 0; lbClamp(); lbZoom(false) }, { passive: false });
window.addEventListener('resize', () => { if (!lbEl.hidden) { lbClamp(); lbZoom(false); lbPlace(false) } });

function galGo(i) { const g = document.getElementById('gal'); if (g) g.children[i].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' }) }


/* ===== my orders: list, visual tracking, receipt ===== */
const OST = { new: 'تم استلام الطلب', preparing: 'يتم التجهيز', shipping: 'جاري شحن الطلبية', delivering: 'في مرحلة التوصيل', done: 'تم التسليم', cancelled: 'ملغي' };
const OFLOW = ['new', 'preparing', 'shipping', 'delivering', 'done'];
const OHINT = { new: 'وصلنا طلبك وسنراجعه قريباً.', preparing: 'نجهّز طلبك الآن بكل عناية.', shipping: 'طلبك خرج من المتجر وفي طريقه للشحن.', delivering: 'المندوب في الطريق إليك، أبقي هاتفك متاحاً.', done: 'وصل طلبك، نتمنى أن ينال إعجابك ✦' };
const PAYM = { onepay: 'بطاقة مصرفية (ون باي)', test: 'دفع تجريبي (بدون دفع حقيقي)', cash: 'الدفع عند الاستلام', transfer: 'تحويل مصرفي', edfali: 'ادفع لي', mobicash: 'موبي كاش', sadad: 'سداد', card: 'بطاقة مصرفية', balance: 'رصيد الهاتف' };
let myOrders = [], ordersLoaded = false, ordSig = '', ordAt = 0;
/* v44: آخر نسخة من طلبات الحساب محفوظة في الموبايل (للعرض الفوري بس، والمرجع دايماً السيرفر).
   مربوطة برقم الحساب والجهاز، وتنمسح عند الخروج */
const ORD_K = 'mir_orders';
function ordLoad() {
  try { const k = lsGet(ORD_K, null); if (user && k && k.u === user.id && k.d === DEV && Array.isArray(k.l)) { myOrders = k.l; ordersLoaded = true } } catch (e) {}
}
function ordSave() { if (user) lsSet(ORD_K, { u: user.id, d: DEV, l: myOrders.slice(0, 50) }) }
/* من السيرفر: تحديث القائمة والنسخة المحفوظة (ومسبقاً في الخلفية بعد الدخول) */
async function ordFetch() {
  // v67 (ب2): الطلبات بتسجيل الدخول (السيرفر ياخذ الحساب منه). لو طلعت أو بدّلت الحساب والطلب ماشي: الرد القديم ما يتطبّقش
  if (!user) return myOrders;
  const uid = user.id;
  const r = (await share('orders:' + uid, () => uapi('/rest/v1/rpc/my_orders', { method: 'POST', headers: JH, body: JSON.stringify({ p_device: DEV }) }))) || [];
  if (!user || user.id !== uid) return myOrders;
  myOrders = r; ordersLoaded = true; ordSave(); dotsPaint();   // v104
  if (myOrders.length && !engaged()) lsSet('mir_engaged', true);
  return myOrders;
}
async function ordPrefetch() {
  if (!user) return;
  try { await ordFetch(); const box = document.getElementById('ordv'); const sig = JSON.stringify(myOrders); if (view !== 'orders' && box && sig !== ordSig) { box.innerHTML = myOrders.length ? ordersListHTML() : ordersEmptyHTML(); ordSig = sig; ordAt = Date.now() } } catch (e) {}
}
const oSt = o => { const s = { confirmed: 'preparing', shipped: 'shipping' }[o.status] || o.status; return OST[s] ? s : 'new' };
const oNo = o => o.order_code || String(o.id).slice(0, 8).toUpperCase();
const oDate = (s, o) => new Date(s).toLocaleString('ar-EG-u-nu-latn', o || { day: 'numeric', month: 'long', year: 'numeric' });
const oTime = s => new Date(s).toLocaleTimeString('ar-EG-u-nu-latn', { hour: 'numeric', minute: '2-digit' });
const oItems = o => Array.isArray(o.items) ? o.items : [];
const oAddr = o => { const c = String(o.city || '').trim(), a = String(o.address || '').trim(); return !c ? a : !a ? c : a.includes(c) ? a : c + '، ' + a };
const oPrice = i => { const p = byId(i.id); return Number(i.price ?? (p ? p.price : 0)) || 0 };
const oSub = o => oItems(o).reduce((a, i) => a + oPrice(i) * (Number(i.qty) || 1), 0);
const oCount = o => oItems(o).reduce((a, i) => a + (Number(i.qty) || 1), 0);
const oImg = i => thumb(i.img || (byId(i.id) ? mainImg(byId(i.id)) : ''));
const oOpts = i => [...(i.pre ? [i.pre === 'حجز' ? 'طلب مسبق' : 'طلب مسبق · التسليم خلال ' + i.pre]   /* v62: «حجز» في الطلبات القديمة = علامة داخلية للطلب المسبق */ : []), ...optsText(i.opts || i.size || i.color ? i : {})];
function oWhen(o, s) {
  if (s === 'new') return o.created_at;
  const log = Array.isArray(o.status_log) ? o.status_log : [];
  for (let k = log.length - 1; k >= 0; k--) if (log[k] && (log[k].s === s || ({ confirmed: 'preparing', shipped: 'shipping' }[log[k].s] === s))) return log[k].at;
  return null;
}
/* ===== طلباتي: قائمة + تفاصيل ===== */
const OTITLE = { new: 'تم استلام طلبك', preparing: 'طلبك قيد التجهيز', shipping: 'جاري شحن طلبك', delivering: 'طلبك في الطريق إليك', done: 'تم تسليم طلبك', cancelled: 'تم إلغاء الطلب' };
const ONEXT = {
  new: 'سنراجع طلبك ونبدأ تجهيزه قريباً، وسيصلك إشعار مع كل تحديث.',
  preparing: 'نجهّز طلبك الآن بكل عناية، والخطوة التالية شحنه.',
  shipping: 'خرج طلبك من المتجر، وسيصلك إشعار عند خروجه للتوصيل.',
  delivering: 'المندوب في الطريق إليك، يرجى إبقاء هاتفك متاحاً.',
  done: 'وصل طلبك، نتمنى أن ينال إعجابك ✦',
  cancelled: 'للاستفسار عن سبب الإلغاء يُرجى التواصل مع خدمة العملاء.'
};
const OLINE = { new: 'استلمنا طلبك', preparing: 'بدأ تجهيز طلبك', shipping: 'خرج طلبك للشحن', delivering: 'خرج طلبك للتوصيل', done: 'تم تسليم طلبك', cancelled: 'أُلغي الطلب' };
const OICON = { new: 'receipt', preparing: 'clock', shipping: 'truck', delivering: 'pin', done: 'check', cancelled: 'close' };
const OGROUP = s => s === 'done' ? 'done' : s === 'cancelled' ? 'cancelled' : 'current';
let oFilter = 'all';
/* وقت نسبي بالعربية: منذ 5 دقائق، منذ ساعتين، أمس... */
function relTime(s) {
  const m = Math.max(0, Math.round((Date.now() - new Date(s)) / 60000));
  const pl = (n, one, two, few, many) => n === 1 ? one : n === 2 ? two : n <= 10 ? `${n} ${few}` : `${n} ${many}`;
  if (m < 1) return 'الآن';
  if (m < 60) return 'منذ ' + pl(m, 'دقيقة', 'دقيقتين', 'دقائق', 'دقيقة');
  const h = Math.floor(m / 60);
  if (h < 24) return 'منذ ' + pl(h, 'ساعة', 'ساعتين', 'ساعات', 'ساعة');
  const d0 = new Date(); d0.setHours(0, 0, 0, 0);
  const days = Math.round((d0 - new Date(new Date(s).setHours(0, 0, 0, 0))) / 864e5);
  if (days <= 1) return 'أمس';
  if (days < 7) return 'منذ ' + pl(days, 'يوم', 'يومين', 'أيام', 'يوماً');
  return 'في ' + oDate(s, { day: 'numeric', month: 'long' });
}
const oLast = o => oWhen(o, oSt(o)) || o.created_at;
const oNames = o => {
  const its = oItems(o), first = its[0] ? its[0].name || 'منتج' : 'منتج', n = its.length - 1;
  return n <= 0 ? first : `${first} ${n === 1 ? 'ومنتج آخر' : n === 2 ? 'ومنتجان آخران' : n <= 10 ? `و${n} منتجات أخرى` : `و${n} منتجاً آخر`}`;
};
const oPill = s => `<span class="ost s-${s}">${ic(OICON[s])}${OST[s]}</span>`;
function oCard(o) {
  const s = oSt(o);
  return `<button class="mo-card s-${s}" data-oc="${esc(o.id)}">${MO_DECO}<span class="mo-mark" aria-hidden="true">MIRACLES</span>
    <div class="mo-top"><div class="mo-id"><small class="mo-lbl">رقم الطلب</small><div class="mo-nrow"><b class="mo-no" dir="ltr">#${esc(oNo(o))}</b>${o.is_test ? '<span class="ttag">تجريبي</span>' : ''}<i class="udot mo-udot" ${user && String(o.id) in dotsGet().o ? '' : 'hidden'}></i></div></div>${oPill(s)}</div>
    <div class="mo-mid"><div><div class="mo-line s-${s}"><i></i>${OLINE[s]} ${relTime(oLast(o))}</div><div class="mo-date">${oDate(o.created_at, { day: 'numeric', month: 'long', year: 'numeric' })} · ${oTime(o.created_at)}</div></div>
      <div class="mo-cnt">المنتجات: <b dir="ltr">${oItems(o).length}</b> · القطع: <b dir="ltr">${oCount(o)}</b></div></div>
    <div class="mo-foot"><div><small>الإجمالي</small><b>${money(o.total ?? oSub(o))}</b></div><span>عرض التفاصيل ${CHL}</span></div></button>`;
}
/* زخرفة بطاقة الطلب: خطوط ذهبية رفيعة + لمسات وردية في الزوايا + نجمتين */
const MO_DECO = `<svg class="mo-deco" viewBox="0 0 360 230" preserveAspectRatio="none" aria-hidden="true">
  <path d="M0 230V178C26 182 52 196 70 230Z" fill="#F7DADA" opacity=".55"/><path d="M360 230V170C334 178 312 200 300 230Z" fill="#F7DADA" opacity=".5"/>
  <path d="M2 78C14 46 40 20 84 4" stroke="#D2AC7C" stroke-width=".9" fill="none"/><path d="M6 226C34 206 60 194 96 190" stroke="#D2AC7C" stroke-width=".9" fill="none"/>
  <path d="M150 206C196 202 238 190 268 174" stroke="#D2AC7C" stroke-width=".9" fill="none"/><path d="M356 150C354 184 338 208 304 228" stroke="#D2AC7C" stroke-width=".9" fill="none"/></svg>
  <span class="mo-spk a" aria-hidden="true">✦</span><span class="mo-spk b" aria-hidden="true">✦</span>`;
function ordersListHTML() {
  const cnt = k => k === 'all' ? myOrders.length : myOrders.filter(o => OGROUP(oSt(o)) === k).length;
  const chips = [['all', 'الكل'], ['current', 'الحالية'], ['done', 'المكتملة'], ['cancelled', 'الملغاة']];
  const cur = myOrders.filter(o => OGROUP(oSt(o)) === 'current'), past = myOrders.filter(o => OGROUP(oSt(o)) !== 'current');
  const shown = oFilter === 'all' ? null : myOrders.filter(o => OGROUP(oSt(o)) === oFilter);
  const EMPTY = { current: 'لا توجد طلبات جارية حالياً', done: 'لا توجد طلبات مكتملة بعد', cancelled: 'لا توجد طلبات ملغاة' };
  return `<div class="mo-chips" role="tablist">${chips.map(([k, l]) => `<button class="${oFilter === k ? 'on' : ''}" data-ofilt="${k}" role="tab" aria-selected="${oFilter === k}">${l}<span dir="ltr">${cnt(k)}</span></button>`).join('')}</div>
    ${shown ? (shown.length ? shown.map(oCard).join('') : `<p class="mo-empty">${EMPTY[oFilter]}</p>`)
      : `${cur.length ? `<h4 class="mo-sec">طلبات جارية</h4>${cur.map(oCard).join('')}` : ''}${past.length ? `<h4 class="mo-sec">طلبات سابقة</h4>${past.map(oCard).join('')}` : ''}`}`;
}
const ordersEmptyHTML = () => `<div class="oempty ein"><div class="ce-ic">${ic('receipt')}</div><h3>لا توجد طلبات بعد</h3><p>عندما تطلبين من المتجر سيظهر طلبك هنا، لتتابعي حالته خطوة بخطوة وتحصلي على إيصاله.</p><button class="cta" data-go="products">تسوقي الآن ${ic('arrow')}</button></div>`;
async function renderOrders(quiet) {
  const box = document.getElementById('ordv');
  // v40: ما عندهاش طلبات على الجهاز = «لا توجد طلبات» فوراً، والتأكد من السيرفر بصمت
  // v42: الأوقات («منذ 5 دقائق») تتحدّث لحظة الفتح قبل ما الصفحة تبان، مش بعد رد السيرفر
  if (!quiet && ordersLoaded && myOrders.length && box.querySelector('.mo-card') && Date.now() - ordAt >= 60000) { box.innerHTML = ordersListHTML(); ordAt = Date.now() }
  // v44: النسخة المحفوظة تبان فوراً (حتى أول فتحة بعد فتح الموقع)، وبعدها السيرفر يأكد
  if (!quiet && ordersLoaded && !box.querySelector('.mo-card, .oempty .ce-ic')) { box.innerHTML = myOrders.length ? ordersListHTML() : ordersEmptyHTML(); ordSig = JSON.stringify(myOrders); ordAt = Date.now() }
  if (!quiet && !ordersLoaded) { if (engaged()) box.innerHTML = '<div class="skc skb"></div><div class="skc skb"></div>'; else if (!box.querySelector('.oempty .ce-ic')) box.innerHTML = ordersEmptyHTML() }
  try { await ordFetch() }
  catch (e) { if (!ordersLoaded) { if (!engaged() && box.querySelector('.oempty .ce-ic')) return; box.innerHTML = `<div class="oempty"><p>تعذر تحميل الطلبات. تأكدي من الاتصال وحاولي مرة أخرى.</p><button class="cta" data-go="orders">إعادة المحاولة</button></div>`; return } }
  if (view !== 'orders') return;
  if (!myOrders.length) {
    if (box.querySelector('.oempty .ce-ic')) return;
    box.innerHTML = ordersEmptyHTML();
    return;
  }
  // v41/v42: نفس الطلبات = القائمة تقعد زي ما هي (تتعاد رسمها بس لو فيه تغيير فعلي من السيرفر)
  const sig = JSON.stringify(myOrders);
  if (sig === ordSig && box.querySelector('.mo-card')) return;
  box.innerHTML = ordersListHTML(); ordSig = sig; ordAt = Date.now();
}
function trackerHTML(o) {
  const s = oSt(o), dead = s === 'cancelled', k = OFLOW.indexOf(s);
  const lastDone = dead ? (() => { let m = 0; OFLOW.forEach((f, j) => { if (oWhen(o, f)) m = j }); return m })() : k;
  return `<ol class="trk ${dead ? 'dead' : ''}">${OFLOW.map((f, j) => {
      const done = dead ? j <= lastDone : j < k || (j === k && f === 'done'), cur = !dead && j === k && f !== 'done', at = oWhen(o, f);
      return `<li class="${done ? 'done' : ''} ${cur ? 'cur' : ''}"><span class="td">${done ? ic('check') : cur ? '•' : j + 1}</span>
        <div class="tt"><b>${OST[f]}</b>${at && (done || cur) ? `<small>${oDate(at, { day: 'numeric', month: 'short' })} · ${oTime(at)}</small>` : ''}</div></li>`;
    }).join('')}${dead ? `<li class="xdone"><span class="td">${ic('close')}</span><div class="tt"><b>تم إلغاء الطلب</b>${oWhen(o, 'cancelled') ? `<small>${oDate(oWhen(o, 'cancelled'), { day: 'numeric', month: 'short' })} · ${oTime(oWhen(o, 'cancelled'))}</small>` : ''}</div></li>` : ''}</ol>`;
}
function openOrderC(id) {
  const o = myOrders.find(x => x.id === id); if (!o) return;
  dotClear('o', id);   // v104
  const s = oSt(o), sub = oSub(o), fee = o.delivery_fee != null ? Number(o.delivery_fee) : null, total = Number(o.total ?? sub);
  const closed = s === 'done' || s === 'cancelled';
  openSheet('bottom now', `<div class="odet">
    <div class="mo-hero s-${s}"><span class="mo-big">${ic(OICON[s])}</span><h3>${OTITLE[s]}</h3><p>${ONEXT[s]}</p></div>
    <div class="obox mo-id"><div><small>رقم الطلب</small><b dir="ltr" class="cpy">#${esc(oNo(o))}</b>${o.is_test ? '<span class="ttag">تجريبي</span>' : ''}<small>${oDate(o.created_at, { day: 'numeric', month: 'long', year: 'numeric' })} · ${oTime(o.created_at)}</small></div>
      <button class="mo-copy" data-copy="#${esc(oNo(o))}">نسخ الرقم</button></div>
    <div class="obox"><h4>تتبع الطلب</h4>${trackerHTML(o)}</div>
    <div class="obox oprods"><div class="oph"><h4>المنتجات: <b dir="ltr">${oItems(o).length}</b> · عدد القطع: <b dir="ltr">${oCount(o)}</b></h4>
      <button class="oshow" data-oprod aria-expanded="false">عرض المنتجات ${ic('back')}</button></div>
      <div class="oplist" hidden>${oItems(o).map(i => {
      const p = byId(i.id), q = Number(i.qty) || 1, img = `<span class="oi">${oImg(i) ? `<img src="${esc(oImg(i))}" alt="">` : '✦'}</span>`;
      return `<div class="oit2 ${p ? 'link' : ''}" ${p ? `data-open="${esc(i.id)}" role="button" tabindex="0"` : ''}>${img}
        <div class="ot"><b class="cpy">${esc(i.name || 'منتج')}</b>${oOpts(i).length ? `<small class="cpy">${oOpts(i).map(esc).join(' · ')}</small>` : ''}${p ? '' : '<small class="gone">لم يعد متوفراً في المتجر</small>'}
          <div class="okv"><span>الكمية</span><b dir="ltr">${q}</b></div>
          <div class="okv"><span>سعر القطعة</span><b>${money(oPrice(i))}</b></div>
          <div class="okv tot"><span>المجموع</span><b>${money(oPrice(i) * q)}</b></div></div></div>`;
    }).join('')}</div></div>
    <div class="obox"><h4>ملخص الطلب</h4><div class="osum"><div class="row"><span>مجموع المنتجات</span><span>${money(sub)}</span></div>
      ${o.dlv_parts ? `<div class="row"><span>طريقة الاستلام</span><span>${DLV_S[o.dlv_parts] || ''}</span></div>` : ''}
      <div class="row"><span>التوصيل</span>${o.dlv_parts === 2 ? dlvCellN(fee != null ? fee / 2 : null, 2) : dlvCell(fee)}</div>
      <div class="row big"><span>الإجمالي</span><span>${money(total)}</span></div></div></div>
    ${o.city || o.address ? `<div class="obox"><h4>عنوان التوصيل</h4><div class="oaddr">${ic('pin')}<div class="cpy">${esc(oAddr(o))}${o.customer_name ? `<br><small style="color:var(--muted)">${esc(o.customer_name)}${o.phone ? ' · <span dir="ltr">' + esc(o.phone) + '</span>' : ''}</small>` : ''}</div></div></div>` : ''}
    <div class="obox"><h4>الدفع</h4><div class="oaddr">${ic('receipt')}<div>${esc(o.payment_method ? (PAYM[o.payment_method] || o.payment_method) : 'تُحدد عند تفعيل الدفع')}${o.pay_tx ? `<br><small style="color:var(--muted)">رقم العملية: <span dir="ltr" class="cpy">${esc(o.pay_tx)}</span></small>` : ''}</div></div></div>
    <button class="cta" data-rcpt="${esc(o.id)}">${ic('receipt')} عرض الإيصال</button>
    <button class="mo-help" data-ohelp="${esc(o.id)}">${ic('headset')} تحتاجين مساعدة بخصوص هذا الطلب؟</button></div>`);
}
/* اطلبي مرة أخرى: نفس المنتجات بنفس الخيارات (المتوفر منها) */
function orderAgain(id) {
  const o = myOrders.find(x => x.id === id); if (!o) return;
  const t0 = toast; let added = 0, miss = 0;
  toast = () => {};
  try {
    oItems(o).forEach(i => {
      const p = byId(i.id);
      if (!p || !canBuy(p)) { miss++; return }
      const opts = i.opts && typeof i.opts === 'object' ? { ...i.opts } : {};
      if (choiceAttrs(p).some(a => !opts[a.label] || !a.values.includes(String(opts[a.label])))) { miss++; return }
      if (addToCart(p, { qty: Number(i.qty) || 1, opts })) added++; else miss++;
    });
  } finally { toast = t0 }
  if (!added) return toast('منتجات هذا الطلب غير متوفرة حالياً');
  closeSheet(); go('cart');
  toast(miss ? 'أُضيفت المنتجات المتوفرة إلى السلة، وبعضها لم يعد متوفراً' : 'أُضيفت منتجات الطلب إلى السلة');
}
function orderHelp(id) {
  const o = myOrders.find(x => x.id === id); if (!o) return;
  openTicketForm('#' + oNo(o));
}
/* receipt (view + save as image) */
function rData(o) {
  const sub = oSub(o), fee = o.delivery_fee != null ? Number(o.delivery_fee) : null;
  return {
    order: '#' + oNo(o), date: oDate(o.created_at), time: oTime(o.created_at),
    name: o.customer_name || (profile && profile.full_name) || '', phone: o.phone || (profile && profile.phone) || '',
    addr: oAddr(o),
    items: oItems(o).map(i => ({ name: i.name || 'منتج', opts: oOpts(i).join(' · '), qty: Number(i.qty) || 1, price: oPrice(i) })),
    sub, fee, total: Number(o.total ?? sub), parts: Number(o.dlv_parts) || 0,
    pay: o.payment_method ? (PAYM[o.payment_method] || o.payment_method) : 'تُحدد عند تفعيل الدفع',
    tx: o.pay_tx ? String(o.pay_tx) : '',
    status: OST[oSt(o)], wa: digits(state.set.whatsapp)
  };
}
const R_NOTES = [
  'يرجى الاحتفاظ بهذا الإيصال لأي استبدال أو استفسار بخصوص طلبك.',
  'يمكن استرجاع المنتج أو استبداله خلال 48 ساعة من الاستلام، وفق سياسة الاسترجاع والاستبدال في المتجر.',
  'يُرجى التأكد من سلامة المنتجات ومطابقتها للطلب عند الاستلام.',
  'رسوم التوصيل تُدفع نقداً للمندوب عند الاستلام.',
  'الأسعار بالدينار الليبي.'
];
function openReceipt(id) {
  const o = myOrders.find(x => x.id === id); if (!o) return;
  const r = rData(o), canShare = !!(navigator.canShare && window.File);
  const row = (k, v, ltr) => `<div class="rr"><span>${k}</span><b${ltr ? ' dir="ltr"' : ''}>${esc(v)}</b></div>`;
  openSheet('bottom now', `<h3>إيصال الطلب</h3><div class="rcpt" id="rcpt">
    <div class="rh"><div class="rw">MIRACLES</div><small>إكسسوارات مختارة بعناية</small><span class="rt">إيصال طلب</span>${o.is_test ? '<br><span class="rtest">طلب تجريبي، بدون دفع حقيقي</span>' : ''}</div>
    <div class="rs">${row('رقم الطلب', r.order, 1)}${row('التاريخ', r.date)}${row('الوقت', r.time)}${row('حالة الطلب', r.status)}</div>
    <div class="rs">${r.name ? row('الاسم', r.name) : ''}${r.phone ? row('الهاتف', r.phone, 1) : ''}</div>
    <div class="rs">${r.items.map(i => `<div class="ri"><div>${esc(i.name)}${i.opts ? `<small>${esc(i.opts)}</small>` : ''}<small>الكمية: <span dir="ltr">${i.qty}</span> · سعر القطعة: ${money(i.price)}</small></div><b>${money(i.qty * i.price)}</b></div>`).join('')}</div>
    <div class="rs">${row('مجموع المنتجات', money(r.sub))}${r.parts ? row('طريقة الاستلام', DLV_S[r.parts] || '') : ''}${row('التوصيل', dlvTextN(r.fee, r.parts))}${row('طريقة الدفع', r.pay)}${r.tx ? row('رقم العملية', r.tx, 1) : ''}
      <div class="rtot"><span>الإجمالي</span><span>${money(r.total)}</span></div></div>
    <ul class="rn">${R_NOTES.map(n => `<li>${n}</li>`).join('')}</ul>
    <div class="rf">شكراً لتسوقك من Miracles ✦</div></div>
    <button class="rlink" data-policy="returns" data-back="rcpt:${esc(o.id)}">سياسة الاسترجاع والاستبدال</button>
    <div class="rbtns"><button class="cta" data-rsave="${esc(o.id)}">حفظ الإيصال</button>${canShare ? `<button class="cta ghost" data-rshare="${esc(o.id)}">مشاركة</button>` : ''}</div>
    <button class="lp-later" data-oc="${esc(o.id)}" style="width:100%;margin-top:6px">رجوع إلى الطلب</button>`);
}
async function receiptCanvas(o) {
  const r = rData(o), S = 3, W = 360, P = 22, ctx0 = document.createElement('canvas').getContext('2d');
  try { await Promise.all(['400 14px Almarai', '700 14px Almarai', '800 14px Almarai', '500 22px Cinzel'].map(f => document.fonts.load(f))) } catch (e) {}
  const F = (w, s) => `${w} ${s}px Almarai, Tahoma, Arial, sans-serif`;
  const wrap = (t, font, max) => { ctx0.font = font; const out = []; let line = ''; String(t).split(' ').forEach(w => { const tl = line ? line + ' ' + w : w; if (ctx0.measureText(tl).width > max && line) { out.push(line); line = w } else line = tl }); if (line) out.push(line); return out };
  const ops = []; let y = 26;
  const text = (t, x, font, color, align, dir) => { const yy = y; ops.push(c => { c.font = font; c.fillStyle = color; c.textAlign = align; c.direction = dir || 'rtl'; c.fillText(t, x, yy) }) };
  const dash = () => { const yy = y; ops.push(c => { c.strokeStyle = '#D9CFC7'; c.setLineDash([5, 4]); c.lineWidth = 1.2; c.beginPath(); c.moveTo(P, yy); c.lineTo(W - P, yy); c.stroke(); c.setLineDash([]) }) };
  const kv = (k, v, ltr) => { const lines = wrap(v, F(700, 13.5), W - 2 * P - 110); y += 22; text(k, W - P, F(400, 13), '#6B6460', 'right'); lines.forEach((l, i) => { if (i) y += 19; text(l, P, F(700, 13.5), '#0B0B0F', 'left', ltr ? 'ltr' : 'rtl') }) };
  y += 4; ops.push(c => { c.letterSpacing = '6px' }); text('MIRACLES', W / 2 + 3, '500 24px Cinzel, Georgia, serif', '#A9825F', 'center', 'ltr'); ops.push(c => { c.letterSpacing = '0px' });
  y += 20; text('إكسسوارات مختارة بعناية', W / 2, F(400, 12), '#6B6460', 'center');
  y += 26; text('إيصال طلب', W / 2, F(800, 16), '#0B0B0F', 'center');
  if (o.is_test) { y += 22; text('طلب تجريبي، بدون دفع حقيقي', W / 2, F(800, 11.5), '#B45309', 'center') }
  y += 16; dash(); y += 4;
  kv('رقم الطلب', r.order, 1); kv('التاريخ', r.date); kv('الوقت', r.time); kv('حالة الطلب', r.status);
  y += 14; dash(); y += 4;
  if (r.name) kv('الاسم', r.name); if (r.phone) kv('الهاتف', r.phone, 1);
  y += 14; dash(); y += 6;
  r.items.forEach(i => {
    y += 22; const nl = wrap(i.name, F(700, 13.5), W - 2 * P - 90);
    text(money(i.qty * i.price), P, F(700, 13.5), '#0B0B0F', 'left');
    nl.forEach((l, k) => { if (k) y += 19; text(l, W - P, F(700, 13.5), '#0B0B0F', 'right') });
    if (i.opts) wrap(i.opts, F(400, 12), W - 2 * P - 90).forEach(l => { y += 18; text(l, W - P, F(400, 12), '#6B6460', 'right') });
    y += 18; text(`الكمية: ${i.qty} · سعر القطعة: ${money(i.price)}`, W - P, F(400, 12), '#6B6460', 'right');
  });
  y += 14; dash(); y += 4;
  kv('مجموع المنتجات', money(r.sub)); if (r.parts) kv('طريقة الاستلام', DLV_S[r.parts] || ''); kv('التوصيل', dlvTextN(r.fee, r.parts)); kv('طريقة الدفع', r.pay); if (r.tx) kv('رقم العملية', r.tx, 1);
  y += 30; text('الإجمالي', W - P, F(800, 17), '#0B0B0F', 'right'); text(money(r.total), P, F(800, 17), '#0B0B0F', 'left');
  y += 12;
  R_NOTES.forEach(n => { wrap(n, F(400, 11.5), W - 2 * P - 14).forEach((l, k) => { y += 18; if (!k) text('✦', W - P, F(400, 9), '#C9A27E', 'right'); text(l, W - P - 14, F(400, 11.5), '#4F4944', 'right') }) });
  y += 30; text('شكراً لتسوقك من Miracles ✦', W / 2, F(800, 13.5), '#0B0B0F', 'center');
  const H = y + 30, cv = document.createElement('canvas'); cv.width = W * S; cv.height = H * S;
  const c = cv.getContext('2d'); c.scale(S, S); c.fillStyle = '#FFFFFF'; c.fillRect(0, 0, W, H);
  c.fillStyle = '#C9A27E'; c.fillRect(0, 0, W, 4);
  ops.forEach(f => f(c));
  return cv;
}
async function saveReceipt(id, share) {
  const o = myOrders.find(x => x.id === id); if (!o) return;
  toast('جاري تجهيز الإيصال...');
  try {
    const cv = await receiptCanvas(o), blob = await new Promise(r => cv.toBlob(r, 'image/png'));
    const name = `Miracles-receipt-${oNo(o)}.png`;
    if (share) {
      const file = new File([blob], name, { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: 'إيصال طلب Miracles' }); return }
    }
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000); toast('تم حفظ الإيصال');
  } catch (e) { if (e && e.name !== 'AbortError') toast('تعذر حفظ الإيصال') }
}


/* ===== وضع الصيانة =====
   الزبونة اللي في صفحة إتمام الطلب تكمل عادي. لو طلعت تشوف رسالة الصيانة،
   ولما تنتهي الصيانة ترجع لصفحة إتمام الطلب وحجزها ياخذ 10 دقائق جديدة. */
let maintOn = false, maintCk = false;
const CKSEL = '[data-placeorder],.okdone,.ckload,[data-waitretry],[data-fixshort],[data-gonego],[data-cancelyes],[data-cancelno],[data-paynow]';
const inCheckout = () => sheet.classList.contains('on') && !!sheet.querySelector(CKSEL);
function setMaint(on) {
  const el = document.getElementById('maint'), was = maintOn; maintOn = on;
  if (on) {
    if (!was && (holdEnd || state.mineEnd > Date.now())) maintCk = true;
    if (inCheckout()) { el.hidden = true; return }
    if (sheet.classList.contains('on')) { sheet.classList.remove('on'); scrim.classList.remove('on') }
    if (!document.getElementById('lb').hidden) closeLB();
    el.hidden = false; return;
  }
  el.hidden = true;
  if (was && maintCk) {
    maintCk = false;
    if (user && okLines().length) { go('cart'); setTimeout(openCheckout, 250) }
  }
}

/* ===== الدفع الإلكتروني عبر إيزون باي: رابط دفع لكل طلب (صفحة الدفع لدى إيزون، وبعدها ترجع للمتجر) ===== */
const payMode = () => String(state.mode || state.set.checkout_mode || 'test').replace(/"/g, '');
const ckOn = () => ['test', 'sandbox', 'live'].includes(payMode());
/* طرق الدفع اللي اختارها صاحب المتجر من اللوحة (من إيزون). لو ما اختارش: خيار واحد بكل الطرق المتاحة */
function payMethods() {
  let v = (state.set || {}).pay_methods;
  if (typeof v === 'string') { try { v = JSON.parse(v) } catch (e) { v = null } }
  v = Array.isArray(v) ? v.filter(m => m && Number(m.id) > 0 && m.name) : [];
  return v.length ? v.map(m => ({ id: Number(m.id), name: String(m.name), logo: m.logo ? String(m.logo) : '', min: Number(m.min) > 0 ? Number(m.min) : 0, max: Number(m.max) > 0 ? Number(m.max) : 0 })) : [{ id: 0, name: 'الدفع الإلكتروني', logo: '', min: 0 }];
}
let pay = null, rsT = null;   // pay: { method, notes, order_id }
/* نداء دالة الدفع في Supabase: ترجع الرد حتى لو فيه خطأ */
async function payFn(body) {
  const mut = body && (body.action === 'open' || body.action === 'cancel'); if (mut) liveAt = Date.now();   // v54
  try {
    await uEnsure();
    const ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), PAY_MS);   // v70: مهلة 25 ث (الرد اللي ضاع = خطأ نت، والمحاولة الجاية بنفس المفتاح)
    let r, t;
    try {
      r = await fetch(SB_URL + '/functions/v1/ezone-pay', { method: 'POST', signal: ctl.signal, headers: { apikey: SB_KEY, Authorization: 'Bearer ' + user.access_token, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      t = await r.text();
    } finally { clearTimeout(tm) }
    let d = null; try { d = t ? JSON.parse(t) : null } catch (x) {}
    if (!d) return { ok: false, error: r.status === 404 ? 'nofn' : 'server', message: r.status === 404 ? 'الدفع الإلكتروني غير مفعّل بعد.' : 'تعذر الاتصال بخدمة الدفع.' };
    return d;
  } catch (e) { return { ok: false, error: 'net', message: NETMSG } }
  finally { if (mut) liveAt = Date.now() }
}
/* v53: طرق الدفع المتوقفة توا (إيزون يقول مش شغالة، أو رفضها مؤخراً): تبان رمادية «غير متاحة حالياً» */
let payOff = { at: 0, ids: new Set() };
let payLow = { t: null, ids: new Set() };
let payLim = {};   // v58: {id: [min, max]} من إيزون (0 = ما فيش حد)   // v54: طرق رفضت مبلغ هذا الطلب بالذات (أقل من 10) ← تتعطل لهذا المبلغ بس
async function payAvail() {
  if (Date.now() - payOff.at < 60000) return false;
  payOff.at = Date.now();
  const r = await payFn({ action: 'avail' });
  if (!r || !r.ok || !Array.isArray(r.off)) return false;
  const n = new Set(r.off.map(Number)); let ch = n.size !== payOff.ids.size || [...n].some(x => !payOff.ids.has(x));
  payOff.ids = n;
  if (r.lim && typeof r.lim === 'object') {   // v58: الحد الأدنى/الأعلى لكل طريقة من إيزون نفسه
    const l = {}; for (const [k, v] of Object.entries(r.lim)) if (Array.isArray(v)) l[k] = [Number(v[0]) > 0 ? Number(v[0]) : 0, Number(v[1]) > 0 ? Number(v[1]) : 0];
    if (JSON.stringify(l) !== JSON.stringify(payLim)) { payLim = l; ch = true }
  }
  return ch;
}
/* v54: مبلغ الطلب (بدون التوصيل) وسبب تعطّل الطريقة: حد أدنى للطلب هذا / رفضت المبلغ هذا / متوقفة توا للكل */
const payTotal = () => ckLast && ckLast.total != null ? Number(ckLast.total) : okLines().reduce((s, l) => s + l.price * l.qty, 0);
function payWhy(x, total) {
  if (!(x.id > 0)) return '';
  const lm = payLim[x.id] || [0, 0], mn = Math.max(x.min || 0, lm[0]), mx = lm[1] || x.max || 0;   // v58: حد اللوحة أو حد إيزون (الأكبر)
  if (mn > 0 && total + 0.001 < mn) return `متاحة للطلبات من ${mn} د.ل فأكثر`;
  if (mx > 0 && total - 0.001 > mx) return `متاحة للطلبات حتى ${mx} د.ل`;
  if (payLow.t === total && payLow.ids.has(x.id)) return 'لا تقبل هذا المبلغ';
  return payOff.ids.has(x.id) ? 'غير متاحة حالياً' : '';
}
/* اختيار طريقة الدفع (نفس الشكل)، وبعدها صفحة الدفع لدى إيزون */
function payStep(err) {
  const notes = document.getElementById('ck-notes'); if (notes) pay = { ...(pay || {}), notes: notes.value.trim() };
  pay = pay || {}; const ms = payMethods(), total = payTotal();
  const why = x => payWhy(x, total), isOff = x => !!why(x);
  if (!ms.some(x => x.id === Number(pay.method) && !isOff(x))) pay.method = (ms.find(x => !isOff(x)) || ms[0]).id;
  const m = Number(pay.method);
  const keep = sheet.classList.contains('on') && sheet.querySelector('.pmeths') ? sheet.scrollTop : 0;   // v69
  openSheet('bottom now', `<h3>طريقة الدفع</h3>
    ${payMode() === 'sandbox' ? `<div class="testbar">${ic('info')}<div><b>دفع تجريبي</b>لن يُخصم أي مبلغ حقيقي.</div></div>` : ''}
    ${holdBar(ckLast || { hold: 'na' })}
    <div class="ckbox"><div class="row big"><span>المبلغ المطلوب</span><span>${money(total)}</span></div><p class="pm-cod">${ic('truck')}<span>رسوم التوصيل تُدفع عند الاستلام.</span></p></div>
    <div class="pmeths" role="radiogroup">${ms.map(x => `<button class="pmeth ${x.id === m ? 'on' : ''}${isOff(x) ? ' off' : ''}" data-pmeth="${x.id}" role="radio" aria-checked="${x.id === m}"${isOff(x) ? ' disabled aria-disabled="true"' : ''}>
      <span class="pm-ic">${x.logo ? `<img src="${esc(x.logo)}" alt="" loading="lazy" onerror="this.remove()">` : ic('receipt')}</span><span class="pm-t"><b>${esc(x.name)}</b>${isOff(x) ? `<small>${why(x)}</small>` : ''}</span><i class="pm-r"></i></button>`).join('')}</div>
    <p class="pm-go">${ic('info')}<span>يتم الدفع في صفحة الدفع الآمنة لدى إيزون باي، ثم العودة إلى المتجر تلقائياً.</span></p>
    <p class="pmsg" id="pmsg"></p>
    <button class="cta" data-paynow>ادفعي الآن</button>
    <button class="cta danger" data-cancelck>إلغاء الدفع</button>
    <button class="cta ghost" data-payback>رجوع إلى تأكيد الطلب</button>`);
  if (keep) sheet.scrollTop = keep;
  if (err) payMsg(document.getElementById('pmsg'), { message: err });
  holdShow();
  payAvail().then(ch => { if (ch && sheet.classList.contains('on') && sheet.querySelector('.pmeths') && !(pay && pay.busy) && !ckBusy) payStep(err) });   // v53 + v56: بس لو النافذة مازالت مفتوحة
}
/* "تأكيد الطلب": هنا يبدا الحجز (15 دقيقة) والأسعار تتثبّت، ثم صفحة طريقة الدفع */
async function confirmHold(btn) {
  if (ckBusy) return;
  const notes = document.getElementById('ck-notes'); if (notes) pay = { ...(pay || {}), notes: notes.value.trim() };
  // v56: آخر طلب دفع (لو رجوعها من إيزون فشل): نسألوا عليه أول. لو اندفع ← «تم استلام طلبك» بدل طلب ثاني
  const lp = lsGet('mir_paylast', null);
  if (lp && lp.id && Date.now() - lp.at < 6 * 3600000) {
    ckBusy = true; if (btn) { btn.disabled = true; btn.textContent = 'جاري تأكيد الطلب...' }
    const s = await payFn({ action: 'status', order_id: lp.id });
    ckBusy = false; if (btn) { btn.disabled = false; btn.textContent = 'تأكيد الطلب' }
    if (s.ok && s.status === 'paid') { const it = lp.items; if (it) ckItems = it; return orderDone(s.order_id || lp.id, s.code) }
    if (s.ok || s.error === 'notfound') lsSet('mir_paylast', null);   // مش مدفوع (أو مش موجود): نكملوا عادي
    else return toast(s.message || 'تعذر الاتصال بخدمة الدفع.');      // النت: ما نبدوش طلب جديد قبل ما نعرفوا
  } else if (lp) lsSet('mir_paylast', null);
  // v53: «تأكيد الطلب» من جديد: السيرفر يلغي الطلب المعلّق القديم، فالمتجر ينساه (وإلا «ادفعي الآن» يفتح الملغي ← «انتهت مهلة الدفع»)
  if (pay) { delete pay.order_id; pay.busy = false } state.payp = null; lsSet('mir_paygo', null); clearInterval(rsT); payBanner();
  ckBusy = true; if (btn) { btn.disabled = true; btn.textContent = 'جاري تأكيد الطلب...' }
  const items = cartPayload(); let r = null;
  try { r = await uapi('/rest/v1/rpc/start_checkout', { method: 'POST', headers: JH, body: JSON.stringify({ p_items: items, p_device: HW, p_hold: true }) }) }
  catch (e) {
    const m = String(e.message || ''); ckBusy = false;
    if (/maintenance/.test(m)) { maintCk = true; maintOn = true; return closeSheet() }
    if (btn) { btn.disabled = false; btn.textContent = 'تأكيد الطلب' }
    return toast(ckErr(m));
  }
  ckBusy = false;
  if (r && r.ok === false && r.pen) { limFrom(r.lim); closeSheet(); go('cart'); return setTimeout(() => penBlocked(r.pen), 60) }
  if (r && r.ok === false && r.devbusy) { if (btn) { btn.disabled = false; btn.textContent = 'تأكيد الطلب' } return toast(`لدى حساب آخر على هذا الجهاز طلب في وقت الدفع. يمكن تأكيد الطلب بعد ${mmss(r.devbusy)}.`) }
  if (r && r.ok === false && r.gone) return showGone(r.gone);
  if (r && r.ok === false && (r.short || []).some(s => s.badv)) return badvFromServer(r.short);
  if (r && r.ok === false) return showShort(r.short || []);
  ckItems = items; ckLast = r || { hold: 'na' }; if (r) limFrom(r.lim);
  heldSet(r && r.hold === 'all' ? (r.held || r.lim || []) : null, r && r.secs);   // v56: السطور المحجوزة فعلاً (held من السيرفر)
  if (r && r.secs) { startHold(r.secs); state.mineEnd = Date.now() + r.secs * 1000; pulse(true) }
  if (r && r.qs !== undefined) qSync(r.qs || 0);   // v65: نهاية الحجز (الصامت بدون عداد)
  payStep();
}
/* "ادفعي الآن": الطلب ينسجل بانتظار الدفع، والزبونة تنتقل لصفحة الدفع لدى إيزون. الوقت يكمل بنفس الحجز */
async function payNow(btn) {
  const a = curAddr(); if (!a || !cart.length || (pay && pay.busy)) return;
  const ms = payMethods(), m = ms.find(x => x.id === Number(pay.method)) || ms[0], msg = document.getElementById('pmsg');
  if (payWhy(m, payTotal())) { msg.textContent = 'يُرجى اختيار طريقة دفع متاحة.'; return }   // v54: كل الطرق متعطلة لهذا الطلب
  if (ckBusy) return busyNote();
  pay.busy = true; ckBusy = true; btn.disabled = true; btn.textContent = 'جاري الانتقال إلى صفحة الدفع...'; msg.textContent = '';   // v56: ckBusy = الإلغاء/الحذف/الرجوع يستنوا
  const city = a.city || String(a.area || '').split(/[،,]/)[0].trim();
  let r;
  try {
    const body = pay.order_id ? { action: 'open', method: m.id, order_id: pay.order_id }
      : { action: 'open', method: m.id, key: ckKey, notes: pay.notes || '', items: ckItems || cartPayload(),
          address: addrPay(a, city) };
    r = await payFn(body);
    // v70: الرد ضاع (النت قطع أو انتهت المهلة): نسألوا مرة ثانية بنفس الطلب. السيرفر يعرف المفتاح ويرجّع نفس الطلب ونفس الرابط
    //      (أو «مدفوع» لو اندفع)، فما فيش طلب مكرر ولا دفع مرتين
    if (r && !r.ok && r.error === 'net' && (body.key || body.order_id)) r = await payFn(body);
  } finally { ckBusy = false; if (pay) pay.busy = false }
  if (!pay) pay = {};
  const msgEl = () => document.getElementById('pmsg') || msg;
  if (r.ok && r.paid) return orderDone(r.order_id, r.code);
  if (!r.ok || !r.url) {
    if (r.error === 'begin' && orderErr(String(r.message || ''))) return;
    if (r.error === 'closed') return payClosed('انتهت مهلة الدفع.');
    if (r.error === 'method_off') { payOff.ids.add(m.id); payOff.at = Date.now(); if (r.order_id) pay.order_id = r.order_id; return payStep(r.message) }   // v53
    if (r.error === 'method_low' || r.error === 'method_min' || r.error === 'method_max') {   // v54: الطريقة ما تقبلش مبلغ هذا الطلب ← تتعطل للطلب هذا بس
      const lm = payLim[m.id] || [0, 0];   // v58: السيرفر قال الحد ← يبان في السطر الرمادي
      if (r.error === 'method_min' && Number(r.min) > 0) payLim[m.id] = [Number(r.min), lm[1]];
      if (r.error === 'method_max' && Number(r.max) > 0) payLim[m.id] = [lm[0], Number(r.max)];
      const t = payTotal(); if (payLow.t !== t) payLow = { t, ids: new Set() }; payLow.ids.add(m.id);
      if (r.order_id) pay.order_id = r.order_id; return payStep(r.message);
    }
    if (r.order_id) pay.order_id = r.order_id;   // الطلب انسجل لكن صفحة الدفع ما فتحتش: المحاولة الجاية على نفس الطلب
    if (r.error === 'begin' && /slow down/.test(String(r.message || ''))) r = { ...r, message: 'محاولات كثيرة، يُرجى المحاولة بعد قليل.' };   // v56
    else if (r.error === 'begin' && /^rpc |^db \d|function|relation|violates/i.test(String(r.message || ''))) r = { ...r, message: 'تعذر إتمام الطلب.' };
    btn.disabled = false; btn.textContent = 'ادفعي الآن'; payMsg(msgEl(), r);
    if (r.error === 'begin') { ckKey = newId(); pulse(true) }
    return;
  }
  pay.order_id = r.order_id; holdSync(r.hold);
  state.payp = paypSet({ id: r.order_id, m: m.name, to: 'ez:' + m.id, t: r.amount, s: r.hold });
  lsSet('mir_paygo', { id: r.order_id, at: Date.now(), m: m.id, items: ckItems || cartPayload(), notes: pay.notes || '' });
  lsSet('mir_paylast', { id: r.order_id, at: Date.now(), items: ckItems || cartPayload() });   // v56: يقعد لين نعرفوا حالته النهائية
  if (navTrap) location.replace(r.url); else location.assign(r.url);   // v71: خطوة الرجوع اللي سجّلها المتجر تتبدّل بصفحة الدفع (الرجوع من صفحة المصرف يرجّعها للمتجر مرة وحدة)
}
/* v56: أمر شغال (فتح صفحة الدفع / إلغاء): الأوامر الثانية تستنى */
function busyNote() { toast('لحظة من فضلكِ...') }
/* الحجز من السيرفر (ثواني) → العداد. null = ما فيش حجز */
function holdSync(secs) {
  if (secs == null) return;
  if (secs > 0) { if (Math.abs((holdEnd || 0) - (Date.now() + secs * 1000)) > 3000) startHold(secs); state.mineEnd = Date.now() + secs * 1000 }
}
/* رسالة الخطأ، وفي وضع التجربة نعرضوا رد إيزون الحقيقي تحتها (للتشخيص) */
function payMsg(el, r) {
  if (!el) return;
  el.innerHTML = esc(r.message || 'تعذر إتمام الدفع.') + (payMode() === 'sandbox' && r.detail ? `<small class="pdet" dir="ltr">${esc(r.detail)}</small>` : '');
  el.classList.remove('pm-on'); void el.offsetWidth; el.classList.add('pm-on');   // صندوق التنبيه يتحرك مع كل رسالة جديدة
  if (navigator.vibrate) try { navigator.vibrate(30) } catch (e) {}
}
function payClosed(msg) {
  // v65: رابط الدفع خلص (نفس نهاية الوقت) ← ترجع للسلة بنفس الرسالة
  clearInterval(rsT); pay = null; ckItems = null; state.payp = null; lsSet('mir_paygo', null); payBanner();
  upMsgAt = Date.now(); closeSheet(); go('cart'); toast('انتهى وقت الدفع، يُرجى إتمام الطلب من جديد.'); if (view === 'cart') renderCartView(); pulse(true);
}
/* الرجوع من صفحة الدفع لدى إيزون (بعد الدفع، أو بزر الرجوع): نسألوا السيرفر هل الدفع وصل */
let payRetBusy = false, payRetOnce = false;
async function payReturn(again, quiet) {
  if (payRetBusy || (payRetOnce && !again)) return;
  payRetOnce = true;
  const url = new URL(location.href), back = url.searchParams.get('pay'), g = lsGet('mir_paygo', null);
  if (back) { url.searchParams.delete('pay'); try { history.replaceState(history.state, '', url.pathname + url.search + url.hash) } catch (e) {} }
  const id = /^[0-9a-f-]{36}$/i.test(back || '') ? back : (g && g.id && Date.now() - g.at < 20 * 60000 ? g.id : null);
  if (!id) return;
  if (!user) { lsSet('mir_paygo', null); return }   // v70: الرسالة وتذكّر الطلب لبعد الدخول: payBack() في أول الفتح
  payRetBusy = true;
  const mine = g && g.id === id;
  if (mine && g.items && !ckItems) ckItems = g.items;
  pay = { ...(pay || {}), order_id: id, busy: false, method: mine ? g.m : pay && pay.method, notes: mine ? g.notes : pay && pay.notes };
  openSheet('bottom now', `<div class="ckload"><i></i>جاري التأكد من عملية الدفع...</div>`);
  const end = Date.now() + (back ? 30000 : 6000);   // رجعت بعد الدفع: نستنو التأكيد لين 30 ثانية. رجعت بزر الرجوع: سؤال واحد
  let s = null;
  for (;;) {
    s = await payFn({ action: 'status', order_id: id });
    if (s.ok && s.status === 'paid') { payRetBusy = false; return orderDone(s.order_id || id, s.code) }
    if ((s.ok && s.status === 'closed') || (s.ok && !back) || Date.now() > end || (!s.ok && s.error !== 'net' && s.error !== 'server')) break;
    await sleep(3000);
  }
  payRetBusy = false;
  if (s && s.ok && s.status === 'pending') {
    holdSync(s.hold); ckLast = { ...(ckLast || {}), total: s.amount != null ? s.amount : ckLast && ckLast.total, hold: (s.hold || 0) > 0 ? 'all' : 'na' };
    if (s.target && /^ez:\d+$/.test(s.target)) pay.method = +s.target.slice(3);
    return payStep(back ? 'لم يتأكد الدفع بعد. سيظهر الطلب في طلباتي فور تأكيده.' : '');
  }
  if (s && s.ok && s.status === 'closed') return payClosed('انتهت صلاحية رابط الدفع، يُرجى تأكيد الطلب من جديد.');
  if (!(s && !s.ok && (s.error === 'net' || s.error === 'server'))) lsSet('mir_paygo', null);   // v56: النت ضعيف: نخلوه لين نعرفوا
  closeSheet();
  if (s && !s.ok && !(quiet && s.error !== 'net' && s.error !== 'server')) toast(s.message || 'تعذر الاتصال بخدمة الدفع.');   // v70: بعد الدخول: طلب مش ليها ← بصمت
}
/* v70: رجعت من صفحة الدفع (?pay=): «جاري التأكد» تطلع من أول لحظة (ما تستناش الكتالوج).
   وفي متصفح مش مسجلة فيه: رسالة، ونتذكروا الطلب ← أول ما تسجّل دخول يتأكد لحاله */
const PAYAFTER_MSG = 'إذا أتممتِ الدفع، سجّلي دخولكِ لمتابعة طلبكِ في «طلباتي».';
function payBack() {
  let b = null; try { b = new URLSearchParams(location.search).get('pay') } catch (e) {}
  if (!b || !/^[0-9a-f-]{36}$/i.test(b)) return;
  if (user) { openSheet('bottom now', `<div class="ckload"><i></i>جاري التأكد من عملية الدفع...</div>`); return }
  lsSet('mir_payafter', { id: b, at: Date.now() });
  // شاشة الترحيب ظاهرة: الرسالة فوق الأزرار (ثابتة، ما تغطيش زر الدخول). زائرة (بدون الترحيب): رسالة عادية
  const card = document.getElementById('au-card');
  if (card && !document.getElementById('au-paynote')) card.insertAdjacentHTML('beforebegin', `<p class="au-paynote" id="au-paynote">${esc(PAYAFTER_MSG)}</p>`);
  splashP.then(() => setTimeout(() => { if (!user && document.getElementById('authv').hidden) toast(PAYAFTER_MSG) }, 500));
}
/* v97 (معتز): دفعت وما رجعتش للمتجر (سكّرت التطبيق وقت الرجوع، أو النت قطع): أول ما تفتح المتجر أو ترجعله، بعد أي وقت،
   نسألوا على آخر طلب دفع من الجهاز هذا. اندفع ← «تم استلام طلبك» والسلة تنقص منها اللي انطلب بس (السيرفر كمان ينقصها: store-v49).
   ما اندفعش ووقته خلص ← ننسوه. مازال وقته ← الشريط البرتقالي يقعد زي ما هو */
let plBusy = false, plAt = 0;
async function payLastCheck() {
  const lp = lsGet('mir_paylast', null), g = lsGet('mir_paygo', null);
  if (!lp || !lp.id || !user || plBusy || payRetBusy || ckBusy || (pay && pay.busy) || ckFlow() || Date.now() - plAt < 15000) return;
  if (g && g.id && Date.now() - g.at < 20 * 60000) return;   // payReturn هو اللي يتابعه
  if (state.payp && state.payp.id === lp.id && paypLeft(state.payp) > 0) return;
  try { if (new URL(location.href).searchParams.get('pay')) return } catch (e) { return }
  plBusy = true; plAt = Date.now();
  try {
    const s = await payFn({ action: 'status', order_id: lp.id });
    const cur = lsGet('mir_paylast', null); if (!cur || cur.id !== lp.id || !user) return;   // اتعامل معاه في الأثناء
    if (s.ok && s.status === 'paid') {
      if (ckFlow() || ckBusy || payRetBusy) return;
      if (sheet.classList.contains('on')) { plAt = 0; return setTimeout(payLastCheck, 5000) }   // نافذة ثانية مفتوحة: نستنوها تتسكّر
      ckItems = Array.isArray(lp.items) ? lp.items : [];   // اللي انطلب بالزبط (ما نشيلوش حاجة ما نعرفوهاش)
      return orderDone(s.order_id || lp.id, s.code);
    }
    if ((s.ok && s.status === 'closed') || s.error === 'notfound') lsSet('mir_paylast', null);
  } catch (e) {} finally { plBusy = false }
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) setTimeout(payLastCheck, 1500) });
function payAfterLogin() {
  const pa = lsGet('mir_payafter', null); lsSet('mir_payafter', null); document.getElementById('au-paynote')?.remove();
  if (!user || !pa || !pa.id || !/^[0-9a-f-]{36}$/i.test(pa.id) || Date.now() - pa.at > 6 * 3600000) return;
  lsSet('mir_paygo', { id: pa.id, at: Date.now(), items: [] });   // items فاضية: لو طلع مدفوع، ما نشيلوش حاجة من السلة (ما نعرفوش شن انطلب من المتصفح الثاني)
  setTimeout(() => payReturn(true, true), 400);   // بعد رسالة «أهلاً»
}
/* نجاح الطلب (دفع أو طلب تجريبي) */
function orderDone(id, code) {
  liveAt = Date.now(); payDrop = id;   // v56: رد «نبض» قديم ما يرجّعش شريط الدفع
  const pg = lsGet('mir_paygo', null);
  clearInterval(rsT); pay = null; state.payp = null; lsSet('mir_paygo', null); payBanner();
  const lp = lsGet('mir_paylast', null); if (lp && (lp.id === id || !lp.id)) lsSet('mir_paylast', null);
  // v56: يتشال من السلة اللي انطلب بس (بالكمية). المنتج اللي تزاد بعدين يقعد. محتوى الطلب: من «تأكيد الطلب» أو المحفوظ مع رابط الدفع
  const ordered = ckItems || (lp && lp.id === id && lp.items) || (pg && pg.id === id && pg.items) || cartPayload();
  const sent = new Map(); ordered.forEach(x => { const k = lineKey(x.id, x.opts); sent.set(k, (sent.get(k) || 0) + (Number(x.qty) || 1)) }); ckItems = null;
  cart = cart.map(l => { const k = lineKey(l.id, l.opts), q = sent.get(k); if (!q) return l; sent.set(k, 0); const left = l.qty - q; return left > 0 ? { ...l, qty: left } : null }).filter(Boolean);
  lsSet('mir_cart_dirty', 'order'); saveCart(); state.limS = null; heldSet(null); dlvSet(0); lsSet('mir_engaged', true); clearInterval(holdT); holdEnd = 0; holdOver = false; state.mineEnd = 0; ckKey = null; qClear();
  const num = code || String(id).slice(0, 8).toUpperCase(); maintCk = false;
  okLast = { id, num }; openSheet('bottom now', okDoneHTML(id, num));
  loadNotes(); renderCartView();
}
var okLast = null;   // v102: آخر «تم استلام طلبك» (ترجعلها بعد نافذة «تفعيل الإشعارات»)
function okDoneHTML(id, num) {
  return `<div class="okdone"><div class="okc">${ic('check')}</div><h3>تم استلام طلبك</h3><div class="onum" dir="ltr">#${esc(num)}</div>
    <button class="cta" data-trackorder="${esc(id)}">متابعة الطلب</button><button class="cta ghost" data-orcpt="${esc(id)}">عرض الإيصال</button>
    ${PUSH_OK && !pushOn() ? `<div class="okpush"><p>لتصلكِ حالة طلبكِ أولاً بأول، حتى والتطبيق مغلق.</p><button class="cta ghost" data-pushon="done">تفعيل الإشعارات</button></div>` : ''}</div>`;   // v98
}
/* أخطاء الطلب المشتركة (نقص، منتج انحذف، سعر تغيّر، صيانة) */
function orderErr(m) {
  if (/maintenance/.test(m)) { maintCk = true; maintOn = true; closeSheet(); return true }
  const pn = m.match(/penalty:(\d+)/);
  if (pn) { closeSheet(); go('cart'); setTimeout(() => penBlocked(+pn[1]), 60); return true }
  const sm = m.match(/short:(\[.*\])/);
  if (sm) { try { const l = JSON.parse(sm[1]); l.some(s => s.badv) ? badvFromServer(l) : showShort(l); return true } catch (x) {} }
  const pm = m.match(/price:(\[.*\])/);
  if (pm) { try { priceBack(JSON.parse(pm[1])); return true } catch (x) {} }
  const gm = m.match(/gone:(\[.*\])/);
  if (gm) { try { showGone(JSON.parse(gm[1])); return true } catch (x) {} }
  return false;
}
/* شريط "لديكِ طلب بانتظار الدفع" لو طلعت ورجعت
   v54: يطلع بس لو وقت الدفع شغال (s = الثواني الباقية وقت ما وصل الرد ← end = وقت النهاية عندنا) */
let payDrop = null, paypT = 0;   // payDrop: طلب ألغيناه للتو: ما نرجعوش نوروه لين السيرفر يأكد
function paypSet(p) { if (p && Number(p.s) > 0) p.end = Date.now() + Number(p.s) * 1000; return p || null }
const paypLeft = p => p && p.end ? Math.max(0, Math.floor((p.end - Date.now()) / 1000)) : 0;
function payBanner() {
  const b = document.getElementById('paywait'); if (!b) return;
  if (state.payp && state.payp.id === payDrop) state.payp = null;
  const p = state.payp, live = paypLeft(p) > 0;
  // v65: حجز عادي (منتج محدود) شغال وهي برا صفحة الطلب ← نفس الشريط بـ«وقت الدفع» والعداد
  const hl = holdEnd > Date.now() && !holdOver && cart.length > 0 && !!user;
  const inFlow = sheet.classList.contains('on') && !!sheet.querySelector(live ? '[data-paynow],.ckload,[data-lvout]' : '[data-paynow],[data-placeorder],[data-cancelyes],[data-cancelno],[data-waitretry],[data-fixshort],.ckload,.okdone,[data-lvout]');   // v97: + تنبيه الخروج (العداد فيه)
  b.hidden = !(live || hl) || inFlow || maintOn;
  b.dataset.hold = !live && hl ? '1' : '';
  const sp = b.querySelector('span'), bt = b.querySelector('b'), hs = hl ? Math.max(0, Math.round((holdEnd - Date.now()) / 1000)) : 0;
  const tm = hl ? ` <i class="pwt" dir="ltr">${Math.floor(hs / 60)}:${String(hs % 60).padStart(2, '0')}</i>` : '';
  if (live) { sp.innerHTML = 'لديكِ طلب بانتظار الدفع' + tm; bt.textContent = 'أكملي الدفع' }
  else if (hl) { sp.innerHTML = 'وقت الدفع ينفد، يُرجى إكمال الطلب' + tm; bt.textContent = 'أكملي الطلب' }   // v97 (معتز): أخضر (CSS: data-hold)
  clearTimeout(paypT); if (live) paypT = setTimeout(payBanner, p.end - Date.now() + 300);   // ينخفى وحده لما الوقت يخلص
}
const itemsSig = list => (list || []).map(x => lineKey(x.id, x.opts) + 'x' + (Number(x.qty) || 1)).sort().join(',');
function payResume() {
  const p = state.payp; if (!p || !paypLeft(p)) return payBanner();
  // v56: السلة تغيّرت بعد ما انعمل الطلب ← الطلب القديم يتلغى وتكمل بسلتها الجديدة (الحجز يكمل بنفس وقته)
  const g = lsGet('mir_paygo', null), old = (g && g.id === p.id && g.items) || ckItems;
  if (old && itemsSig(old) !== itemsSig(cartPayload())) {
    if (ckBusy) return busyNote();
    payDrop = p.id; state.payp = null; lsSet('mir_paygo', null); lsSet('mir_paylast', null); payBanner();
    ckBusy = true;
    return payFn({ action: 'cancel', order_id: p.id }).then(c => { ckBusy = false; if (c && c.ok && c.paid) { ckItems = old; return orderDone(c.order_id || p.id, c.code) } pay = pay ? { method: pay.method, notes: pay.notes } : null; ckItems = null; openCheckout() });
  }
  pay = { ...(pay || {}), method: /^ez:\d+$/.test(p.to || '') ? +p.to.slice(3) : pay && pay.method, order_id: p.id, busy: false };
  ckItems = ckItems || cartPayload();
  holdSync(paypLeft(p));
  if (p.t != null) ckLast = { ...(ckLast || {}), total: p.t };
  payStep(); payBanner();
}
/* حذف السلة كاملة. لو فيه دفع لم يكتمل: يتلغى وينحسب فشل */
async function cartClear() {
  if (!cart.length) return;
  if (ckBusy) return busyNote();   // v54: ckBusy = فيه أمر حجز/إلغاء شغال توا
  // v53: تنبيه الحجز والعقوبة بس لو السلة فيها منتج محدود محجوز ووقت الدفع شغال
  const pid = (pay && pay.order_id) || (state.payp && state.payp.id), held = anyHeld();   // v56: المحجوز فعلاً (من «تأكيد الطلب»، مش حسب آخر تحديث)
  if (held) await penAsk();
  const ok = await ask('حذف السلة',
    held ? ((state.st || 0) >= 1 ? 'هذا الإلغاء الثاني، وسيُوقف حجز المنتجات محدودة الكمية 30 دقيقة.' : 'سيُلغى الحجز. الإلغاء الأول خلال ساعة مجاني، والإلغاء الثاني يوقفكِ عن حجز المنتجات محدودة الكمية لمدة 30 دقيقة.')
      : pid ? 'لديكِ عملية دفع لم تكتمل، وحذف السلة سيلغيها.' : 'هل تريدين حذف جميع المنتجات من سلتك؟',
    'نعم، حذف السلة', 'danger');
  if (!ok || ckBusy) return;
  let cr = null; ckBusy = true;   // v54: ما يبداش «إتمام الطلب» جديد وسط الإلغاء (وإلا الإلغاء يمسح الحجز الجديد)
  try {
    if (pid) {
      const pp = state.payp, pg = lsGet('mir_paygo', null);
      payDrop = pid; state.payp = null; lsSet('mir_paygo', null); payBanner();
      const c = await payFn({ action: 'cancel', order_id: pid });
      if (c && c.ok && c.paid) return orderDone(c.order_id || pid, c.code);   // v54: طلع مدفوع فعلاً ← الطلب يتأكد، والسلة ما تنحذفش
      if (!c || !c.ok) { payDrop = null; state.payp = pp; lsSet('mir_paygo', pg); payBanner(); return toast(c && c.message || NETMSG) }   // v56: ما نعرفوش هل اتلغى: كل شي يرجع زي ما كان
      pay = null; clearInterval(rsT);
    }
    // الحجز يتلغى ويتحسب إلغاء (أي حجز حقيقي = منتج محدود انحجز)
    if (held) cr = await holdCancel();   // v56: لو السيرفر قال فيه حجز: يتلغى (السيرفر يقرر يتحسب ولا لا)
    else if (qActive()) cr = await holdCancel();   // v65: الحجز الصامت ينفك فوراً (بدون تنبيه ولا عدّ)
  } finally { ckBusy = false }
  heldSet(null); lsSet('mir_paylast', null); qClear();
  if (cr && cr.st != null) state.st = Number(cr.st);
  if (cr && cr.pen > 0) setPen(cr.pen, !!cr.counted);
  clearInterval(holdT); holdEnd = 0; holdOver = false; state.mineEnd = 0; ckItems = null; ckKey = null;
  const box = document.querySelector('#cartv');
  const done = () => { cart = []; saveCart(); state.limS = null; dlvSet(0); renderCartView(); toast(cr && cr.counted && cr.pen > 0 ? 'تم حذف السلة. تم إيقاف حجز المنتجات محدودة الكمية 30 دقيقة.' : 'تم حذف السلة.'); pulse(true) };
  if (box && !calm()) { box.classList.add('clearing'); setTimeout(() => { box.classList.remove('clearing'); done() }, 220) } else done();
}
/* إلغاء الحجز (يتحسب إلغاء) */
async function holdCancel() {
  try { return await uapi('/rest/v1/rpc/cancel_hold', { method: 'POST', headers: JH, body: '{}' }) } catch (e) { return null }
}
/* v53: حذف منتج من السلة. لو هو منتج محدود محجوز ووقت الدفع شغال:
   - آخر منتج محجوز ← إلغاء للحجز: نفس تنبيه «إلغاء الدفع» ويتحسب
   - فيه منتجات محجوزة ثانية ← يتفك هذا بس بدون عقوبة (الحجز مكمّل)
   ولو فيه دفع معلّق: يتلغى (الطلب ما عادش نفس السلة) */
async function rmLines(lines) {
  if (ckBusy) { busyNote(); return null }   // v54
  const held = holding() ? lines.filter(isHeld) : [];   // v56: المحجوز فعلاً (مش حسب آخر تحديث)
  const others = cart.filter(l => !lines.includes(l)).some(isHeld);
  if (held.length && !others) {
    await penAsk();
    const ok = await ask('حذف المنتج', (state.st || 0) >= 1 ? 'هذا الإلغاء الثاني، وسيُوقف حجز المنتجات محدودة الكمية 30 دقيقة.' : 'سيُلغى الحجز. الإلغاء الأول خلال ساعة مجاني، والإلغاء الثاني يوقفكِ عن حجز المنتجات محدودة الكمية لمدة 30 دقيقة.', 'نعم، حذف المنتج', 'danger');
    if (!ok || ckBusy) return null;
  }
  const pid = (pay && pay.order_id) || (state.payp && state.payp.id);
  let r = null; ckBusy = true;
  try {
    if (pid) {
      const pp = state.payp, pg = lsGet('mir_paygo', null);
      payDrop = pid; state.payp = null; lsSet('mir_paygo', null); payBanner();
      const c = await payFn({ action: 'cancel', order_id: pid });   // v54: نستنو الرد (لو طلع مدفوع: الطلب يتأكد وما نحذفوش)
      if (c && c.ok && c.paid) { orderDone(c.order_id || pid, c.code); return null }
      if (!c || !c.ok) { payDrop = null; state.payp = pp; lsSet('mir_paygo', pg); payBanner(); toast(c && c.message || NETMSG); return null }   // v56
      lsSet('mir_paylast', null);
      pay = pay ? { method: pay.method, notes: pay.notes } : null; clearInterval(rsT);
    }
    for (const l of held) {
      const p = byId(l.id);
      try { r = await uapi('/rest/v1/rpc/hold_drop', { method: 'POST', headers: JH, body: JSON.stringify({ p_product: String(l.id), p_variant: p ? (varOf(p, l.opts) || '') : '' }) }) } catch (e) {}
      if (r && r.ended) break;
    }
    // v65: الصامت (منتج يتتبع الكمية ومش محجوز حجز عادي) ينفك فوراً بدون عدّ. لو العادي خلص، السيرفر فك الكل
    if (!(r && r.ended) && qActive()) for (const l of lines) {
      const p = byId(l.id); if (held.includes(l) || !p || p.preorder || !trackOf(p) || (holding() && (isHeld(l) || limLine(l))) || cart.some(x => !lines.includes(x) && lineHK(x) === lineHK(l))) continue;   // المحدود ما نلمسوهش هني (بدون تنبيه)، ولا منتج قاعد في السلة بخيار ثاني
      let q = null;
      try { q = await uapi('/rest/v1/rpc/hold_drop', { method: 'POST', headers: JH, body: JSON.stringify({ p_product: String(l.id), p_variant: varOf(p, l.opts) || '' }) }) } catch (e) {}
      if (q && q.qended) qClear();
      if (q && q.ended) { r = q; break }
    }
  } finally { ckBusy = false }
  if (r && r.ended) { clearInterval(holdT); holdEnd = 0; holdOver = false; state.mineEnd = 0; ckItems = null; ckKey = null; heldSet(null); qClear() }
  else if (r && r.held && heldS) { lines.forEach(l => heldS.delete(lineHK(l))); heldSet(heldS.size ? [...heldS].map(k => ({ id: k.split('|')[0], v: k.split('|')[1] })) : null, Math.max(0, (holdEnd - Date.now()) / 1000)) }
  if (r && r.st != null) state.st = Number(r.st);
  if (r && r.pen > 0) setPen(r.pen, !!r.counted);
  if (held.length || qActive()) pulse(true);
  return { counted: !!(r && r.counted && r.pen > 0) };
}
/* غياب 15 دقيقة أو أكثر: الموقع يتحدّث ويرجع للرئيسية (السلة تبقى) */
const AWAY_MS = 15 * 60 * 1000;
let awayAt = 0, beat = Date.now(), awayGoing = false;
async function awayReset() {
  if (awayGoing) return; awayGoing = true;
  const id = (pay && pay.order_id) || (state.payp && state.payp.id);
  if (id) { try { await Promise.race([payFn({ action: 'cancel', order_id: id }), new Promise(r => setTimeout(r, 2500))]) } catch (e) {} }
  location.replace(location.pathname + location.search);
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { awayAt = Date.now(); return }
  const t = awayAt; awayAt = 0;
  if (t && Date.now() - t >= AWAY_MS) awayReset();
});
setInterval(() => { const n = Date.now(); if (n - beat >= AWAY_MS) awayReset(); beat = n }, 15000);   // لو الصفحة اتجمدت بدون ما تنبه
/* v82: اتصلّح: كان الاختفاء الأول يمسح العلامة، فبعد «اختفاء ← ظهور لحظة ← اختفاء» الشاشة تخلص قبل ما ترجع الزبونة.
   v80 (التطبيق بس، طلب معتز): الزبونة ضغطت فيسبوك/تيك توك (v81: + واتساب والإيميل) في المتجر وطلعت ← لحظة ما تطلع ترجع شاشة الشعار (.again)، فأول فريم وهي راجعة شعار،
   وتختفي بعد ثانية من الرجوع؛ الصفحة تترسم تحتها (CSS). لو غابت 15 دقيقة: awayReset يفتح المتجر من جديد زي قبل. باقي الروابط (الدفع وغيره) ما تتأثرش */
const SOC_BACK = /(^|\.)(facebook\.com|fb\.com|fb\.me|fb\.watch|tiktok\.com|wa\.me|whatsapp\.com)$/i;   // v81: + واتساب والإيميل (mailto)
let spBackAt = 0, spBackT = 0;
document.addEventListener('click', e => {
  if (!window.__app) return;
  const a = e.target.closest && e.target.closest('a[href]'); if (!a) return;
  let u = null; try { u = new URL(a.href, location.href) } catch (x) { return }
  if (u.protocol === 'mailto:' || u.protocol === 'whatsapp:' || SOC_BACK.test(u.hostname)) spBackAt = Date.now();
}, true);
document.addEventListener('visibilitychange', () => {
  const sp = document.getElementById('splash'); if (!window.__app || !sp) return;
  if (document.hidden) {
    clearTimeout(spBackT);
    if (spBackAt && Date.now() - spBackAt < 10000) { sp.classList.remove('out'); sp.classList.add('again') }
    return;   // v82: العلامة تقعد 10 ث من الضغطة (ما تنمسحش هني): التطبيق يختفي ويبان لحظة ويختفي قبل ما يفتح فيسبوك/واتساب، فكل اختفاء فيها يرجّع الشعار
  }
  if (sp.classList.contains('again')) spBackT = setTimeout(() => { sp.classList.add('out'); sp.classList.remove('again') }, 1000);
});

/* ===== التوصيل: سعره حسب مدينة العنوان (من اللوحة)، ويُدفع نقداً عند الاستلام ===== */
function dlvFee(a) {
  a = a || curAddr(); if (!a) return null;
  let v = (state.set || {}).delivery_cities;
  if (typeof v === 'string') { try { v = JSON.parse(v) } catch (e) { v = null } }
  if (!Array.isArray(v)) return null;
  const c = String(a.city || String(a.area || '').split(/[،,]/)[0] || '').trim(); if (c.length < 2) return null;
  const hit = v.find(x => x && x.active !== false && x.name && String(x.name).trim().length >= 2 && (x.name === c || c.includes(x.name) || x.name.includes(c)));
  return hit && Number.isFinite(Number(hit.fee)) ? Number(hit.fee) : null;
}
const dlvCell = (fee, cls = '') => fee != null ? `<span class="dlvc">${money(fee)}<small>يُدفع عند الاستلام</small></span>` : `<span class="soon"${cls}>يُدفع عند الاستلام</span>`;
/* سطر التوصيل في صفحة المنتج */
function pdlvHTML() {
  const a = curAddr(), fee = dlvFee(a), c = a && String(a.city || String(a.area || '').split(/[،,]/)[0] || '').trim();
  return `<p class="pdlv">${ic('truck')}<span>${fee != null ? `التوصيل${c ? ' إلى ' + esc(c) : ''}: <b>${money(fee)}</b> · يُدفع عند الاستلام` : 'رسوم التوصيل تُدفع عند الاستلام'}</span></p>`;
}
const dlvText = fee => fee != null ? money(fee) + ' (يُدفع عند الاستلام)' : 'يُدفع عند الاستلام';
/* ===== v61: طريقة الاستلام. السلة فيها طلب مسبق + تسليم فوري ← في «تأكيد الطلب» الزبونة تختار:
   دفعة واحدة (سعر التوصيل العادي) أو دفعتين (سعر التوصيل × 2). الاختيار إجباري ويتحفظ في الجهاز (mir_dlvp)
   عشان لو رجعت لـ«تأكيد الطلب» (من طرق الدفع أو من إيزون) تلقاه وتقدر تبدّله. يمشي للسيرفر مع العنوان (dlv) ===== */
function ckMixed() { let pre = false, now = false; okLines().forEach(l => { const p = byId(l.id); if (!p) return; if (p.preorder) pre = true; else now = true }); return pre && now }
function dlvGet() { const d = lsGet('mir_dlvp', null); return d && (d.p === 1 || d.p === 2) && Date.now() - (d.t || 0) < 6 * 3600000 ? d.p : 0 }
function dlvSet(n) { lsSet('mir_dlvp', n === 1 || n === 2 ? { p: n, t: Date.now() } : null) }
function dlvTextN(fee, n) { return n === 2 ? (fee != null ? money(fee) + ' (' + dlvNote(2) + ')' : dlvNote(2)) : dlvText(fee) }
function dlvNote(n) { return n === 2 ? 'يُدفع عند الاستلام على مرحلتين' : 'يُدفع عند الاستلام' }
function dlvCellN(fee, n, cls = '') { return fee != null ? `<span class="dlvc">${money(fee * n)}<small>${dlvNote(n)}</small></span>` : `<span class="soon"${cls}>${dlvNote(n)}</span>` }
const DLV_T = { 1: 'استلام الطلب على دفعة واحدة', 2: 'استلام الطلب على دفعتين' };
const DLV_S = { 1: 'دفعة واحدة', 2: 'على دفعتين' };
let dlvTmp = 0;   // الاختيار قبل «حفظ» (الدائرة)
function dlvBoxHTML(fee, n) {
  return `<div class="ckbox" id="ckdlv"><h4>طريقة الاستلام</h4>
    <button class="ckdlv-b${n ? '' : ' need'}" data-dlvopen aria-expanded="false"><span>${n ? DLV_T[n] : 'اختيار طريقة الاستلام'}</span>${ic('chev')}</button>
    <div class="ckdlv-o" hidden role="radiogroup">${[1, 2].map(k => `<button class="ckdlv-r${k === n ? ' on' : ''}" data-dlvpick="${k}" role="radio" aria-checked="${k === n}"><i class="pm-r"></i><span>${DLV_T[k]}</span>${fee != null ? `<b>${money(fee * k)}</b>` : ''}</button>`).join('')}
      <button class="cta" data-dlvsave${n ? '' : ' disabled'}>حفظ</button></div></div>`;
}
/* بعد «حفظ»: الزر يكتب الاختيار ويتسكّر، وسطر التوصيل يبان، و«تأكيد الطلب» يتفتح (بدون إعادة رسم الصفحة: ما يلمسش الوقت ولا رقم المحاولة) */
function dlvPaint() {
  const box = document.getElementById('ckdlv'); if (!box) return;
  const n = dlvGet(), a = curAddr(), fee = dlvFee(a);
  const b = box.querySelector('[data-dlvopen]'), o = box.querySelector('.ckdlv-o');
  b.classList.toggle('need', !n); b.querySelector('span').textContent = n ? DLV_T[n] : 'اختيار طريقة الاستلام';
  b.setAttribute('aria-expanded', 'false'); o.hidden = true;
  const row = document.getElementById('ck-dlvrow');
  if (row) { row.hidden = !n; row.innerHTML = n ? `<span>التوصيل</span>${dlvCellN(fee, n, ' style="font-size:12.5px"')}` : '' }
  const po = sheet.querySelector('[data-placeorder]'); if (po && !/جاري/.test(po.textContent)) po.disabled = !n;
}
function dlvRadios(k) {
  dlvTmp = k;
  document.querySelectorAll('#ckdlv .ckdlv-r').forEach(r => { const on = Number(r.dataset.dlvpick) === k; r.classList.toggle('on', on); r.setAttribute('aria-checked', on) });
  const sv = document.querySelector('#ckdlv [data-dlvsave]'); if (sv) sv.disabled = !k;
}

/* ===== test checkout (no real payment) ===== */
const testMode = () => payMode() === 'test';
const cartPayload = () => okLines().map(l => ({ id: l.id, qty: l.qty, opts: l.opts || Object.fromEntries([['المقاس', l.size], ['اللون', l.color]].filter(x => x[1])) }));
let ckShort = [], holdT = null, ckBusy = false, ckItems = null;   // ckItems: السلة كما كانت عند دخول صفحة إتمام الطلب
async function openCheckout(btn) {
  if (!cart.length || ckBusy) return;
  const a = curAddr();
  if (!a) { addrFrom = 'cart'; go('addr'); return toast('يُرجى تحديد عنوان التوصيل.') }
  if (a.v === 2 && !dCity(a.city)) { addrFrom = 'cart'; openMap(a.id); return toast('التوصيل غير متاح حالياً لهذه المدينة. يُرجى تعديل العنوان.') }   // v45
  syncCart();
  if (cart.some(l => l.badv)) { closeSheet(); toast('يُرجى اختيار لون آخر للمنتجات المعلّمة.'); go('cart'); return flashCart(cart.filter(l => l.badv).map(l => l.id)) }
  if (cart.some(l => l.gone)) return showGone(cart.filter(l => l.gone).map(l => l.id));
  if (!cart.length) return;
  if (offline()) return toast(NETMSG);   // v89: بدون نافذة (كانت رمشة سودا)
  ckBusy = true;
  const free = tapBusy(btn), L = lazySheet(`<div class="ckload"><i></i>جاري تجهيز طلبك...</div>`, 350, 'bottom now');   // v89: تبان بس لو طوّل 0.35 ث. v98: بدون حركة
  let r = null;
  const items = cartPayload();
  /* "إتمام الطلب": فحص السلة بس (بدون حجز). لو قاعدة البيانات ما تحدّثتش: الطريقة القديمة */
  const ckCall = fn => uapi('/rest/v1/rpc/' + fn, { method: 'POST', headers: JH, body: JSON.stringify(fn === 'checkout_check' ? { p_items: items } : { p_items: items, p_device: HW, p_hold: false }) });
  try {
    try { r = await ckCall('checkout_check') }
    catch (e) { if (e.status === 404 || /checkout_check|schema cache/.test(String(e.message || ''))) r = await ckCall('start_checkout'); else throw e }
  }
  catch (e) {
    const m = String(e.message || '');
    if (/maintenance/.test(m)) { ckBusy = false; maintCk = true; maintOn = true; L.stop(); return L.gone() ? setMaint(true) : closeSheet() }   // v89: closeSheet تسكّر «جاري التجهيز» لو ظاهرة وتفعّل الصيانة (maintOn) زي قبل
    if (!(e.status === 404 || /start_checkout|schema cache/.test(m))) { ckBusy = false; L.close(); return toast(ckErr(m)) }
  } finally { ckBusy = false; L.stop(); free() }
  if (L.gone()) return;   // v89: سكّرت «جاري التجهيز» أو فتحت حاجة ثانية وهو يستنى ← ما نفتحوش شي في وجهها
  if (r && r.ok === false && r.pen) { limFrom(r.lim); L.close(); go('cart'); return setTimeout(() => penBlocked(r.pen), 60) }
  if (r && r.ok === false && r.gone) return showGone(r.gone);
  if (r && r.ok === false && (r.short || []).some(s => s.badv)) return badvFromServer(r.short);
  if (r && r.ok === false) return showShort(r.short || []);
  ckItems = items; if (r) limFrom(r.lim);
  renderCheckout(r || { hold: 'na' });
  if (r && r.secs) { state.mineEnd = Date.now() + r.secs * 1000; pulse(true) }
  if (r && r.qs !== undefined) qSync(r.qs || 0);   // v65
}
/* منتج انخفى أو انحذف وهو في السلة: اسمه بالضبط + "أكملي بدونه" */
let goneIds = [];
function showGone(ids) {
  goneIds = ids.map(String); closeSheet(); clearInterval(waitT);
  const lines = cart.filter(l => goneIds.includes(String(l.id))), names = [...new Map(lines.map(l => [String(l.id), l])).values()];
  const many = names.length > 1;
  setTimeout(() => openSheet('bottom now', `<h3>${many ? 'منتجات لم تعد متوفرة' : 'منتج لم يعد متوفراً'}</h3>
    <div class="shlist">${names.map(l => `<div class="shrow"><span class="oi">${l.img ? `<img src="${esc(thumb(l.img))}" alt="">` : '✦'}</span><div><b>${esc(l.name)}</b><small class="out">لم يعد متوفراً</small></div></div>`).join('')}</div>
    <button class="cta" data-gonego>أكملي الطلب ${many ? 'بدونها' : 'بدونه'}</button><button class="cta ghost" data-goneback>العودة إلى السلة</button>`), 60);
  if (view === 'cart') renderCartView();
}
function goneGo() {
  cart = cart.filter(l => !goneIds.includes(String(l.id))); saveCart();
  if (view === 'cart') renderCartView();
  if (cart.length) return openCheckout();
  closeSheet(); go('cart');
}
/* السيرفر قال إن لون انحذف: نعلّم السطر في السلة */
function badvFromServer(list) {
  list.filter(s => s.badv).forEach(s => cart.forEach(l => { if (String(l.id) === String(s.id) && varOf(byId(l.id), l.opts) === (s.v || '')) l.badv = true }));
  closeSheet(); toast('يُرجى اختيار لون آخر للمنتجات المعلّمة.');
  go('cart'); flashCart(list.filter(s => s.badv).map(s => s.id));
}
function ckErr(m) {
  return /penalty/.test(m) ? 'تم إيقاف حجز المنتجات محدودة الكمية مؤقتاً.' : /max qty/.test(m) ? 'كمية أحد المنتجات أكثر من الحد الأقصى المسموح في الطلب. يُرجى تعديلها في السلة.' : /failed to fetch|networkerror|load failed|network/i.test(m) ? NETMSG : /variant required/.test(m) ? 'يُرجى اختيار اللون لكل منتج.' : /slow down/.test(m) ? 'يُرجى المحاولة بعد دقيقة.' : /disabled/.test(m) ? 'استقبال الطلبات متوقف حالياً' : /unavailable/.test(m) ? 'منتج في سلتك لم يعد متوفراً'
    : /cart too big/.test(m) ? 'السلة فيها أكثر من 30 منتج. احذفي بعضها وحاولي مرة أخرى.' : /cart empty/.test(m) ? 'السلة فارغة' : /place_test_order|schema cache/.test(m) ? 'الطلب غير مفعّل بعد' : 'تعذر إرسال الطلب: ' + m;
}
/* الكمية غير كافية في آخر خطوة. لو السبب حجز زبونة أخرى: نافذة الانتظار */
let waitT = null;
const needOf = s => { const p = byId(s.id); return p ? inCartV(p, s.v || '') : 0 };
const shName = s => esc(s.name) + (s.v ? ` (${esc(s.v)})` : '');
function showShort(list) {
  ckShort = list; closeSheet(); clearInterval(waitT);
  const waiting = list.filter(s => s.held && Number(s.base) >= needOf(s));
  const gone = !waiting.length && cart.every(l => list.some(s => String(s.id) === String(l.id) && !s.n && lineHasV(l, s.v)));
  const img = s => { const p = byId(s.id), u = p && thumb(mainImg(p)); return `<span class="oi">${u ? `<img src="${esc(u)}" alt="">` : '✦'}</span>` };
  const rows = list.map(s => waiting.includes(s)
    ? `<div class="shrow waitrow">${img(s)}<div><b>${shName(s)}</b><small class="low">${s.n ? `المتوفر الآن ${qtyTxt(s.n)} فقط، والباقي في سلة أخرى في وقت الدفع` : 'في سلة أخرى في وقت الدفع الآن'}</small></div></div>`
    : `<div class="shrow">${img(s)}<div><b>${shName(s)}</b><small class="${s.n ? 'low' : 'out'}">${s.n ? `المتوفر ${qtyTxt(s.n)} فقط` : !trackOf(byId(s.id)) ? 'غير متوفر حالياً' : 'نفدت الكمية'}</small></div></div>`).join('');
  let html;
  if (waiting.length) {
    const one = list.length === 1, part = list.some(s => s.n > 0);
    html = `<h3 id="wtitle">${one && waiting[0].n === 0 && Number(waiting[0].base) <= 1 ? 'آخر قطعة في سلة أخرى في وقت الدفع' : part && one ? 'جزء من الكمية في سلة أخرى في وقت الدفع' : 'منتج في سلة أخرى في وقت الدفع'}</h3>
      <p class="sub-note" id="wnote"><span class="wtag">قد يتوفر خلال <b class="wcd" dir="ltr"></b></span></p>
      <div class="shlist">${rows}</div>
      <button class="cta wait-off" id="waitbtn" disabled>جارٍ الانتظار...</button><p class="wbnote" id="wbnote">سيتحدّث الزر تلقائياً.</p>
      <button class="cta ghost" data-fixshort="skip">أكملي الطلب بدون ${list.length > 1 ? 'هذه المنتجات' : 'هذا المنتج'}</button>`;
  } else {
    html = list.every(s => !trackOf(byId(s.id))) ? `<h3>منتج غير متوفر حالياً</h3><p class="sub-note">${gone ? 'المنتجات غير متوفرة حالياً.' : 'بعض المنتجات غير متوفرة حالياً.'}</p>
      <div class="shlist">${rows}</div>
      ${gone ? `<button class="cta" data-fixshort="cart">العودة إلى السلة</button>` : `<button class="cta" data-fixshort="go">أكملي الطلب بدونها</button><button class="cta ghost" data-fixshort="cart">العودة إلى السلة</button>`}`
    : `<h3>الكمية غير كافية</h3><p class="sub-note">${gone ? 'المنتجات غير متوفرة حالياً.' : 'الكمية المتوفرة أقل من المطلوب.'}</p>
      <div class="shlist">${rows}</div>
      ${gone ? `<button class="cta" data-fixshort="cart">العودة إلى السلة</button>` : `<button class="cta" data-fixshort="go">تعديل الكميات والمتابعة</button><button class="cta ghost" data-fixshort="cart">العودة إلى السلة</button>`}`;
  }
  setTimeout(() => { openSheet('bottom now', html); if (waiting.length) startWait(waiting) }, 60);   // v98: صفحات الطلب بدون حركة
  if (view === 'cart') renderCartView();
}
function startWait(waiting) {
  const end = Date.now() + Math.max(...waiting.map(s => Number(s.wait) || 0)) * 1000;
  /* v91 (معتز): كانت تحسب من معلومات التلفون (حجز الآخرين يتحدّث كل 20 ث) ← في نفس الثانية «المنتج أصبح متوفراً» والسيرفر قال محجوز.
     توا: أرقام السيرفر (s.base المخزون، s.n المتوفر الآن) لين توصل معلومة أحدث من لحظة الفتح، ونطلبوها فوراً */
  const t0 = Date.now(), fresh = () => (state.hhAt || 0) > t0;
  /* v97 (معتز): نافذة الانتظار فورية: نسألوا السيرفر عن منتجاتها بس كل 3 ثواني وهي مفتوحة (كان: التحديث العام كل 20 ث) */
  let wpBusy = false, wpAt = 0;
  const wpoll = () => {
    if (wpBusy || !user) return; wpBusy = true; wpAt = Date.now();
    const q0 = Date.now(), body = JSON.stringify({ p_ids: [...new Set(waiting.map(s => String(s.id)))] });
    uapi('/rest/v1/rpc/cart_check', { method: 'POST', headers: JH, body }).then(r => { if (liveAt < q0) applyLive(r, true) }).catch(() => {}).finally(() => { wpBusy = false });
  };
  wpoll();
  let phase = 'wait', checked = false, lastFree = waiting.map(s => Number(s.n) || 0), lastKey = '', timeUp = false;
  const fmt = s => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  const price0 = waiting.map(s => { const p = byId(s.id); return p ? Number(p.price) : null });
  // المتوفر الآن لكل منتج: الكمية − المحجوز لغيرها (من التحديث التلقائي)
  const info = () => waiting.map((s, k) => {
    const p = byId(s.id), v = s.v || '', va = p && vattrOf(p), srv = !fresh();   // v91
    const stock = srv ? Number(s.base) || 0 : p ? (leftOf(p, v) ?? 0) : 0;
    return { s, p, need: needOf(s), stock, free: srv ? Math.max(0, Number(s.n) || 0) : p ? Math.max(0, stock - hhOf(p, v)) : 0,
             other: !p || (va && !(v in vstockOf(p))) || (price0[k] != null && Number(p.price) !== price0[k]) };
  });
  const ding = () => { chime(); if (navigator.vibrate) try { navigator.vibrate(40) } catch (e) {} };
  const one = waiting.length === 1;
  const rowsSmall = () => [...document.querySelectorAll('.waitrow small')];
  const setText = (id, t) => { const e = document.getElementById(id); if (e) e.textContent = t };
  /* الزر الرئيسي: نص + وظيفة حسب الحالة */
  const setBtn = (b, text, act) => {
    delete b.dataset.waitretry; delete b.dataset.fixshort;
    const wn = document.getElementById('wbnote'); if (wn) wn.hidden = !!act;   // v95: السطر الصغير تحت الزر وقت الانتظار بس
    if (!act) { b.className = 'cta wait-off'; b.disabled = true; b.textContent = text; return }   // v65: العداد واحد بس فوق
    b.className = 'cta'; b.disabled = false; b.textContent = text;
    if (act === 'retry') b.dataset.waitretry = 'now'; else b.dataset.fixshort = act;
    flash(b, null);
  };
  const settle = b => {
    const I = info();
    if (I.some(x => x.other)) {                                     // تغيّر السعر أو انحذف اللون/المنتج
      clearInterval(waitT); phase = 'review';
      setText('wtitle', 'تغيّرت بعض تفاصيل طلبك'); setText('wnote', '');
      document.querySelectorAll('.wtag').forEach(x => x.remove());
      setBtn(b, 'مراجعة السلة', 'cart'); ding(); return true;
    }
    if (I.every(x => x.free >= x.need)) {                           // الكمية كاملة توفرت
      clearInterval(waitT); phase = 'ready';
      setText('wtitle', one ? 'المنتج أصبح متوفراً' : 'المنتجات أصبحت متوفرة'); setText('wnote', '');
      rowsSmall().forEach(x => { x.className = 'ok'; x.textContent = 'متوفر الآن' });
      document.querySelectorAll('.wtag').forEach(x => x.remove());
      document.querySelectorAll('.waitrow').forEach(x => flash(x, null));
      setBtn(b, 'أكملي الطلب الآن', 'retry'); ding(); return true;
    }
    if (I.every(x => x.stock <= 0)) {                               // بيعت
      clearInterval(waitT); phase = 'sold';
      setText('wtitle', one ? 'للأسف، بيعت آخر قطعة' : 'للأسف، بيعت القطع المتبقية'); setText('wnote', '');
      rowsSmall().forEach(x => { x.className = 'out'; x.textContent = 'نفدت الكمية' });
      document.querySelectorAll('.wtag').forEach(x => x.remove());
      setBtn(b, 'مراجعة السلة', 'cart'); ding(); return true;
    }
    const free = I.map(x => Math.min(x.need, x.free));
    const heldN = I.map(x => Math.max(0, x.stock - x.free));      // v92: المحجوز لغيرها لكل منتج (المخزون − المتوفر)
    /* v92 (معتز): ما بقاش حد في وقت الدفع، والمتوفر أقل من طلبها (صاحبة الحجز دفعت، أو نقص من اللوحة):
       كانت تقعد «والباقي في سلة أخرى في وقت الدفع» والعداد شغال على حاجة ما رح تتوفرش ← حالة نهائية بدون عداد */
    if (heldN.every(h => h === 0)) {
      clearInterval(waitT); phase = 'short';
      I.forEach((x, k) => { x.s.n = free[k] });
      setText('wtitle', 'الكمية المتوفرة أقل من المطلوب'); setText('wnote', '');
      rowsSmall().forEach((x, k) => { const n = free[k]; if (n == null) return; x.className = n ? 'low' : 'out'; x.textContent = n ? `المتوفر ${qtyTxt(n)} فقط` : 'نفدت الكمية' });
      document.querySelectorAll('.wtag').forEach(x => x.remove());
      document.querySelectorAll('.waitrow').forEach(x => flash(x, null));
      setBtn(b, 'أكملي بالكمية المتوفرة', free.some(n => n > 0) ? 'go' : 'cart'); ding(); return true;
    }
    // v92: الكلام بالأرقام لو فك الحجز ما يكفيش طلبها («والباقي» بس لو المحجوز يغطي الباقي)
    const rowTxt = k => { const n = free[k], h = heldN[k];
      return n ? (n + h >= I[k].need ? `المتوفر الآن ${qtyTxt(n)}، والباقي في سلة أخرى في وقت الدفع` : h ? `المتوفر الآن ${qtyTxt(n)}، و${qtyTxt(h)} في سلة أخرى في وقت الدفع` : `المتوفر ${qtyTxt(n)} فقط`)
        : h ? 'في سلة أخرى في وقت الدفع الآن' : 'نفدت الكمية' };
    const key = free.join() + '|' + heldN.join();
    if (free.some(n => n > 0)) {                                    // جزء من الكمية متوفر (والانتظار مستمر للباقي)
      if (key !== lastKey || phase !== 'part') {
        const more = free.some((n, k) => n > lastFree[k]);
        I.forEach((x, k) => { x.s.n = free[k] });
        rowsSmall().forEach((x, k) => { if (free[k] == null) return; x.className = free[k] ? 'low' : (heldN[k] ? 'low' : 'out'); x.textContent = rowTxt(k) });
        setText('wtitle', one ? 'جزء من الكمية في سلة أخرى في وقت الدفع' : 'منتج في سلة أخرى في وقت الدفع');   // v92: العنوان يتبع الحالة
        setBtn(b, 'أكملي بالكمية المتوفرة الآن', 'go');
        if (phase === 'part' && more) { ding(); document.querySelectorAll('.waitrow').forEach(x => flash(x, null)) }
        phase = 'part'; lastFree = free; lastKey = key;
      }
      return false;
    }
    if (phase === 'part' || key !== lastKey) { if (phase === 'part') { setBtn(b, 'جارٍ الانتظار...', null); setText('wtitle', 'منتج في سلة أخرى في وقت الدفع') } phase = 'wait'; lastFree = free; lastKey = key; rowsSmall().forEach((x, k) => { x.className = heldN[k] ? 'low' : 'out'; x.textContent = rowTxt(k) }) }   // v92: + سطر نفد وسط الانتظار
    if (timeUp && phase === 'wait') { clearInterval(waitT); phase = 'retry'; setBtn(b, 'حاولي مجدداً', 'retry'); ding(); return true }
    return false;
  };
  const tick = () => {
    const btn = document.getElementById('waitbtn'); if (!btn) return clearInterval(waitT);
    if (!['wait', 'part'].includes(phase)) return;
    if (settle(btn)) return;
    if (Date.now() - wpAt >= 3000 && !document.hidden) wpoll();   // v97
    const s = Math.max(0, Math.round((end - Date.now()) / 1000));
    document.querySelectorAll('.wcd').forEach(x => x.textContent = fmt(s));   // v65: عداد واحد (الأطول) فوق
    if (!s && !checked) {
      checked = true; pulse(true);
      setTimeout(() => { timeUp = true; const b = document.getElementById('waitbtn'); if (b && ['wait', 'part'].includes(phase)) settle(b) }, 1500);
    }
  };
  tick(); waitT = setInterval(tick, 1000);
}
/* الزر يحاول فعلاً: لو توفر المنتج تكمل، ولو لا ترجع النافذة بالعداد المحدّث */
function waitRetry(btn) { clearInterval(waitT); return openCheckout() }
function fixShort(how) {
  clearInterval(waitT);
  if (how === 'skip') {
    // المنتجات المحجوزة أو النافدة تنتقل للمفضلة، والباقي يتعدل للكمية المتوفرة
    const moved = new Set();
    ckShort.forEach(s => {
      const waitingOrOut = (s.held && Number(s.base) >= needOf(s)) || !s.n;
      if (waitingOrOut) { cart = cart.filter(l => !(String(l.id) === String(s.id) && lineHasV(l, s.v))); favs.add(s.id); moved.add(s.id) }
    });
    lsSet('mir_favs', [...favs]); syncFavs();
    capCart(ckShort.filter(s => !moved.has(s.id)).map(s => ({ id: s.id, v: s.v, n: s.n })));
    if (moved.size) toast(moved.size > 1 ? 'وضعنا هذه المنتجات في المفضلة' : 'وضعنا المنتج في المفضلة');
    renderCartView();
    if (cart.length) return openCheckout();
    closeSheet(); go('cart'); return;
  }
  // العودة إلى السلة
  if (how === 'cart') { closeSheet(); go('cart'); return flashCart(ckShort.map(s => s.id)) }
  capCart(ckShort.map(s => ({ id: s.id, v: s.v, n: s.n })));
  if (how === 'go' && cart.length) { renderCartView(); return openCheckout() }
  closeSheet(); go('cart'); flashCart(ckShort.map(s => s.id));
}
/* شريط الحجز: 15 دقيقة واحدة تشمل إتمام الطلب والدفع. بدون حجز (فترة العقوبة) = ما يظهر شي */
let holdOver = false;
function holdBar(r) {
  if (r.hold !== 'all' && r.hold !== 'some') return '';
  if (holdOver || !(holdEnd > Date.now() || Number(r.secs) > 0)) return `<div class="holdbar warn" id="holdbar">${ic('info')}<span>انتهى وقت الدفع.</span></div>`;
  return `<div class="holdbar" id="holdbar">${ic('clock')}<span>وقت الدفع</span><b id="holdt" dir="ltr"></b></div><p class="holdnote" id="holdnote">المنتجات محجوزة لكِ مؤقتاً.</p>`;
}
/* ===== إيقاف حجز المحدود 30 دقيقة (v40) (إلغاء الحجز أو انتهاء وقته مرتين خلال ساعة) =====
   السيرفر هو المرجع (يرفض الطلب اللي فيه منتج محدود الكمية خلال الإيقاف)، وهنا: الزر باهت وعليه عداد
   لو السلة فيها منتج محدود الكمية بس، ويرجع طبيعي لحاله لما يخلص أو لما ينشال المنتج المحدود */
const PEN_SECS = 15 * 60;
let penEnd = 0, penT = null;
const mmss = s => { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0') };
const penLeft = () => penEnd ? Math.max(0, (penEnd - Date.now()) / 1000) : 0;
function setPen(secs, fresh) {
  secs = Math.max(0, Math.round(Number(secs) || 0));
  const was = penLeft() > 0, end = secs ? Date.now() + secs * 1000 : 0;
  if (!secs && !was) return;
  if (secs && was && Math.abs(end - penEnd) < 3000) return;   // نفس الإيقاف
  penEnd = end; penPaint(fresh ? 'start' : null);
  clearInterval(penT);
  if (penEnd) penT = setInterval(() => { if (penLeft() > 0) penPaint(); else { penEnd = 0; clearInterval(penT); penPaint('end') } }, 1000);
}
/* زر "إتمام الطلب" في السلة */
const penNote = () => `<p class="pennote" id="pennote">${ic('info')}<span>تم إيقاف حجز المنتجات محدودة الكمية مؤقتاً.</span></p>`;
const penOn = () => penLeft() > 0 && cartLim();
function ckBtnHTML() {
  const l = penOn() ? penLeft() : 0;
  return l > 0 ? `<button class="cta pay locked" data-checkout aria-disabled="true">إتمام الطلب <b class="pent" dir="ltr">${mmss(l)}</b></button>${penNote()}`
    : `<button class="cta pay" data-checkout>إتمام الطلب</button>`;
}
function penPaint(ev) {
  const l = penOn() ? penLeft() : 0;
  document.querySelectorAll('.cta.pay[data-checkout]').forEach(b => {
    if (b.textContent.includes('تجريبي')) return;
    if (l > 0) {
      if (!b.classList.contains('locked')) { b.classList.add('locked'); b.setAttribute('aria-disabled', 'true'); b.innerHTML = `إتمام الطلب <b class="pent" dir="ltr"></b>`; if (!document.getElementById('pennote')) b.insertAdjacentHTML('afterend', penNote()) }
      const t = b.querySelector('.pent'); if (t) t.textContent = mmss(l);
      if (ev === 'start') { b.classList.remove('pen-in'); void b.offsetWidth; b.classList.add('pen-in') }
    } else if (b.classList.contains('locked')) {
      b.classList.remove('locked'); b.removeAttribute('aria-disabled'); b.textContent = 'إتمام الطلب';
      document.getElementById('pennote')?.remove();
      if (ev === 'end' && !calm()) { b.classList.remove('unlock'); void b.offsetWidth; b.classList.add('unlock') }
    }
  });
  if (ev === 'end' && view === 'cart' && cartLim()) toast('يمكن إتمام الطلب الآن.');
}
/* ضغطت على الزر وهو موقوف: اهتزاز + الوقت الباقي */
function penBlocked(secs) {
  if (secs != null) setPen(secs);
  const b = document.querySelector('.cta.pay.locked[data-checkout]');
  if (b && !calm()) { b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake') }
  const n = document.getElementById('pennote'); if (n && !calm()) { n.classList.remove('flash'); void n.offsetWidth; n.classList.add('flash') }
  if (navigator.vibrate) try { navigator.vibrate(60) } catch (e) {}
  toast(`يمكن الطلب من جديد بعد ${mmss(penLeft())}`);
}
/* حالة الإيقاف وعدد المرات من السيرفر (ثواني الإيقاف) */
async function penAsk() {
  if (!user) return 0;
  try {
    const t0 = Date.now(), r = await uapi('/rest/v1/rpc/cart_check', { method: 'POST', headers: JH, body: JSON.stringify({ p_ids: [...new Set(cart.map(l => String(l.id)))] }) });
    if (liveAt < t0) applyLive(r, true); return r && typeof r.pen === 'number' ? r.pen : 0;
  } catch (e) { return 0 }
}
/* v54: الحجز خلص عندها ← السيرفر يحسب الإيقاف ويكتب الإشعار فوراً (بدل ما يستنى cron الدقيقة). يرجع ثواني الإيقاف */
async function holdSettle(again) {
  if (!user) return 0;
  try {
    const was = penLeft() > 0, r = await uapi('/rest/v1/rpc/hold_settle', { method: 'POST', headers: JH, body: '{}' });
    if (r && r.st != null) state.st = Number(r.st);
    const pn = r && typeof r.pen === 'number' ? r.pen : 0; setPen(pn);
    if (r && r.grace > 0 && !again) setTimeout(() => holdSettle(true), r.grace * 1000 + 2000);   // v56: فيه رابط دفع كان مفتوح: نعاودوا بعد الدقيقة ونص
    if (again === true && pn > 0 && !was && cart.some(limLine)) toast('تم إيقاف حجز المنتجات محدودة الكمية 30 دقيقة.');
    pulse(true); return pn;
  } catch (e) { return penAsk() }   // الدالة مش موجودة بعد (store-v40): الطريقة القديمة
}
/* عداد وقت الدفع (15 دقيقة). لما يخلص: تنبيه، والزبونة تبقى في مكانها */
let holdEnd = 0;
function holdShow() {
  const el = document.getElementById('holdt'); if (!el || !holdEnd) return;
  const s = Math.max(0, Math.round((holdEnd - Date.now()) / 1000));
  el.textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}
function startHold(secs) {
  clearInterval(holdT); holdEnd = 0; if (!secs) return;
  holdOver = false; holdEnd = Date.now() + secs * 1000; leaveSkip = false; navSoon();   // v97: الرجوع من الرئيسية يسأل (حجز جديد)
  const tick = () => {
    const s = Math.max(0, Math.round((holdEnd - Date.now()) / 1000)); holdShow(); payBanner();   // v65: شريط «وقت الدفع» برا يتحدّث كل ثانية
    if (s) return;
    clearInterval(holdT); holdEnd = 0; holdOver = true; state.mineEnd = 0; heldSet(null); qClear(); payBanner(); navSoon();   // v65: الحجز كله خلص (العادي والصامت مع بعض). v97: الرجوع يرجع عادي
    if (maintOn) return;
    const b = document.getElementById('holdbar');
    if (b) { b.className = 'holdbar warn'; b.innerHTML = `${ic('info')}<span>انتهى وقت الدفع.</span>` }
    document.getElementById('holdnote')?.remove();
    if (!cart.length) { setTimeout(holdSettle, 2500); return }
    chime(); if (navigator.vibrate) try { navigator.vibrate([40, 60, 40]) } catch (e) {}
    // الإيقاف من ثاني مرة خلال ساعة: السيرفر يقول هل صار إيقاف (v54: ويكتب الإشعار فوراً)
    setTimeout(async () => { const pn = await holdSettle(); timeUp(pn) }, 2500);   // v65: نفس النهاية للعادي والصامت
  };
  tick(); holdT = setInterval(tick, 1000);
}
/* v65: الحجز الصامت (فوق «حد الحجز»): بدون عداد ولا تنبيه. نهايته مخفية (qEnd)، ولما توصل وهي في «تأكيد الطلب» أو «طريقة الدفع»:
   ترجع للسلة. لو فيه حجز عادي معاه، العداد العادي هو اللي يقرر (نفس النهاية) */
let qEnd = 0, qT = null, upMsgAt = 0;
const qActive = () => qEnd > Date.now();
function qSync(secs, live) {   // secs من السيرفر: undefined/null = ما نعرفوش (ما يتغيرش شي)، 0 = ما فيش حجز
  if (secs == null) return;
  if (!secs && live && qEnd && !holdEnd) { qClear(); return timeUp(0, true) }   // التحديث قال الحجز خلص (أو انلغى) وهي في صفحة الطلب ← السلة
  const e = secs > 0 ? Date.now() + secs * 1000 : 0;
  if (e && qEnd && Math.abs(e - qEnd) < 3000) return;
  qEnd = e; clearTimeout(qT); qT = null;
  if (e) qT = setTimeout(qUp, e - Date.now() + 1000);
}
function qClear() { qEnd = 0; clearTimeout(qT); qT = null }
function qUp() {
  qT = null; if (!qEnd || qEnd > Date.now() + 1500) return;
  qEnd = 0;
  if (holdEnd) return;   // العداد العادي شغال: هو اللي يقرر
  timeUp(0, true);
}
/* «تأكيد الطلب» أو «طريقة الدفع» مفتوحة (مش نافذة الانتظار ولا «تم استلام طلبك») */
const ckFlow = () => sheet.classList.contains('on') && !!sheet.querySelector('[data-placeorder],[data-paynow],[data-cancelyes],[data-cancelno]');
/* v65: انتهى وقت الدفع (عادي أو صامت): في صفحة الطلب ← ترجع للسلة. برا: رسالة بس (الصامت: ولا شي) */
function timeUp(pn, quiet) {
  const msg = pn > 0 ? 'انتهى وقت الدفع. تم إيقاف حجز المنتجات محدودة الكمية 30 دقيقة.' : 'انتهى وقت الدفع، يُرجى إتمام الطلب من جديد.';
  if (maintOn) return;   // الصيانة ليها طريقتها (ترجّعها لصفحة الطلب بعدها)
  if (!ckFlow()) { if (!quiet && Date.now() - upMsgAt > 30000) { upMsgAt = Date.now(); toast(msg) } return }
  if (ckBusy || (pay && pay.busy) || payRetBusy) return setTimeout(() => { if (ckFlow()) timeUp(pn, quiet) }, 800);   // أمر شغال: نستنوه
  upMsgAt = Date.now();
  clearInterval(rsT); pay = pay ? { method: pay.method, notes: pay.notes } : null; ckItems = null; ckKey = null;
  state.payp = null; lsSet('mir_paygo', null); payBanner();   // mir_paylast يقعد: «تأكيد الطلب» الجاي يسأل عليه أول
  closeSheet(); go('cart'); toast(msg); pulse(true);
}
let ckKey = null, ckLast = null;
/* v93: تنبيه «في طلبك منتجات محدودة الكمية» (نفس شكل تنبيه الطلب المسبق)، بنفس شرط سطر قاعدة الإلغاء */
const ckLimOn = r => (payMode() === 'sandbox' || payMode() === 'live') && (r.hold === 'all' || (r.lim || []).length || cartLim());
function limNote(r) {
  if (!ckLimOn(r)) return '';
  const seen = new Set(), names = [];
  cart.forEach(l => { if (limLine(l) && !seen.has(String(l.id))) { seen.add(String(l.id)); names.push(esc(l.name)) } });
  return `<div class="prenote limnote">${ic('info')}<div><b>في طلبك منتجات محدودة الكمية</b>تُحجز لكِ لمدة 15 دقيقة من تأكيد الطلب لإتمام الدفع.${names.length ? `<ul class="pnames">${names.map(n => `<li>${n}</li>`).join('')}</ul>` : ''}</div></div>`;
}
function renderCheckout(r) {
  const a = curAddr(); if (!a) return;
  ckLast = r; ckKey = newId();   // رقم مميز لهذه المحاولة: يمنع الطلب المكرر لو النت قطع
  const pr = r.prices || {}, total = r.total != null ? Number(r.total) : cart.reduce((s, l) => s + (pr[l.id] != null ? Number(pr[l.id]) : l.price) * l.qty, 0);
  const pre = cart.filter(l => { const p = byId(l.id); return p && p.preorder });
  const mx = ckMixed(), dn = mx ? dlvGet() : 0; dlvTmp = dn;   // v61
  openSheet('bottom now', `<h3>تأكيد الطلب</h3>
    ${payMode() === 'test' ? `<div class="testbar">${ic('info')}<div><b>طلب تجريبي</b>لن يتم أي دفع حقيقي. الهدف تجربة شكل الطلبات وتتبعها والإيصال.</div></div>` : ''}
    ${holdBar(r)}
    ${limNote(r)}
    ${pre.length ? `<div class="prenote">${ic('clock')}<div><b>في طلبك منتجات طلب مسبق</b><ul class="pnames">${pre.map(l => `<li>${esc(l.name)}<small>${esc(leadTxt(byId(l.id)))}</small></li>`).join('')}</ul></div></div>` : ''}
    <div class="ckbox"><h4>التوصيل إلى</h4><div class="ckaddr">${ic('pin')}<div>${esc(addrLine(a))}${a.v !== 2 && a.details ? `<small>${esc(a.details)}</small>` : ''}</div><button data-addr>تغيير</button></div></div>
    ${mx ? dlvBoxHTML(dlvFee(a), dn) : ''}
    <div class="ckbox"><h4>ملخص الطلب</h4>
      <div class="row"><span>عدد القطع</span><span>${cartCount()}</span></div>
      <div class="row"><span>مجموع المنتجات</span><span>${money(total)}</span></div>
      ${!mx ? `<div class="row"><span>التوصيل</span>${dlvCell(dlvFee(a), ' style="font-size:12.5px"')}</div>`
        : `<div class="row" id="ck-dlvrow"${dn ? '' : ' hidden'}>${dn ? `<span>التوصيل</span>${dlvCellN(dlvFee(a), dn, ' style="font-size:12.5px"')}` : ''}</div>`}
      <div class="row"><span>طريقة الدفع</span><span>${payMode() === 'test' ? 'تجريبي' : 'في الخطوة التالية'}</span></div>
      <div class="row big"><span>الإجمالي</span><span>${money(total)}</span></div></div>
    <label class="field">ملاحظات للطلب (اختياري)<textarea id="ck-notes" maxlength="500"></textarea></label>
    ${ckLimOn(r) ? `<p class="ckrule">${ic('info')}<span>إلغاء الدفع مرتين خلال ساعة يوقف حجز المنتجات محدودة الكمية لمدة 30 دقيقة.</span></p>` : ''}
    <button class="cta" data-placeorder${mx && !dn ? ' disabled' : ''}>تأكيد الطلب</button>
    <p class="consent">بإتمام الطلب أنتِ توافقين على <button data-policy="returns" data-back="ck">سياسة الاسترجاع والاستبدال</button></p>`);
  startHold(r.secs);
}
/* زر "إلغاء الطلب": القطع ترجع للناس فوراً، والسلة تبقى */
const cancelTxt = () => (state.st || 0) >= 1
  ? `<div class="penwarn" id="cxtxt">${ic('info')}<div><b>هذا الإلغاء الثاني، وسيُوقف حجز المنتجات محدودة الكمية 30 دقيقة.</b></div></div>`
  : `<p class="sub-note" id="cxtxt">سيُلغى الحجز. الإلغاء الأول خلال ساعة مجاني، والإلغاء الثاني يوقفكِ عن حجز المنتجات محدودة الكمية لمدة 30 دقيقة.</p>`;
function cancelAsk(again) {
  // v39: طلب من غير حجز: الإلغاء طول من غير تنبيه
  if (ckBusy) return busyNote();
  if (!anyHeld()) return cancelDo({ disabled: false });   // v56: بدون منتج محجوز فعلاً: بدون تنبيه
  openSheet('bottom now', `<h3>إلغاء الدفع</h3>${cancelTxt()}
    <button class="cta danger" data-cancelyes>نعم، إلغاء الدفع</button><button class="cta ghost" data-cancelno>رجوع</button>`);
  // عدد المرات الحالي من السيرفر (لو تغيّر والنافذة لسه مفتوحة: يتحدث النص)
  if (!again) { const st0 = state.st || 0; penAsk().then(() => { if ((state.st || 0) !== st0 && sheet.classList.contains('on') && sheet.querySelector('#cxtxt')) cancelAsk(true) }) }   // v56: بس لو النافذة مازالت مفتوحة
}
function cancelBack() {
  if (ckBusy) return busyNote();   // v56
  const left = holdEnd ? Math.max(0, Math.round((holdEnd - Date.now()) / 1000)) : null;
  renderCheckout({ ...(ckLast || { hold: 'na' }), secs: left });
}
/* v97: قلب الإلغاء (من «إلغاء الدفع»، و«تسجيل الخروج وإلغاء الطلب»، و«الخروج وإلغاء الطلب»). بدون شاشة:
   يرجع { paid } لو طلع مدفوع، { err } لو ما اتلغاش، أو { r } (رد السيرفر على الحجز) */
async function cancelCore() {
  let r = null, pid = null; ckBusy = true;   // v54
  try {
    pid = (pay && pay.order_id) || (state.payp && state.payp.id);
    if (pid) {   // فيه رابط دفع مفتوح: يتقفل عند إيزون (ولو طلع مدفوع، الطلب يتأكد)
      const pp = state.payp, pg = lsGet('mir_paygo', null);
      payDrop = pid; state.payp = null; lsSet('mir_paygo', null); payBanner();
      const c = await payFn({ action: 'cancel', order_id: pid });
      if (c.ok && c.paid) return { paid: c, pid };
      if (!c.ok) { payDrop = null; state.payp = pp; lsSet('mir_paygo', pg); payBanner(); return { err: c.message || NETMSG } }   // v56: ما نقولوش «تم الإلغاء» وهو ما اتلغاش
      pay = pay ? { method: pay.method, notes: pay.notes } : null;
    }
    if (anyHeld() || qActive()) r = await holdCancel();   // v56: المحجوز فعلاً (أو السيرفر قال فيه حجز). v65: والصامت (بدون عدّ)
  } finally { ckBusy = false }
  heldSet(null); lsSet('mir_paylast', null); qClear();
  clearInterval(holdT); holdEnd = 0; holdOver = false; state.mineEnd = 0; ckKey = null; ckItems = null;
  if (r && r.st != null) state.st = Number(r.st);
  payBanner(); navSoon();
  return { r };
}
function cancelToast(r, txt) {
  if (r && r.pen > 0) setPen(r.pen, !!r.counted);
  if (r && r.counted && r.pen > 0) toast((txt || 'تم إلغاء الدفع.') + ' تم إيقاف حجز المنتجات محدودة الكمية 30 دقيقة.')
  else toast(txt || 'تم إلغاء الدفع.');
}
async function cancelDo(btn) {
  if (ckBusy) return busyNote();
  btn.disabled = true;
  const x = await cancelCore();
  if (x.paid) return orderDone(x.paid.order_id || x.pid, x.paid.code);
  if (x.err) { btn.disabled = false; return toast(x.err) }
  closeSheet(); cancelToast(x.r); pulse(true);
}
/* v97 (معتز): طلب لم يكتمل (حجز بعد «تأكيد الطلب»، أو طلب بانتظار الدفع) وهي تبي تطلع:
   - «تسجيل الخروج»: تنبيه بالعداد، و«تسجيل الخروج وإلغاء الطلب» يلغيه فوراً.
   - زر الرجوع لين تطلع من المتجر: نفس التنبيه بزرين «إكمال الدفع» و«الخروج وإلغاء الطلب».
     لو سكّرت التنبيه بالرجوع (بدون أي زر)، الرجوع الجاي يطلّعها عادي والعداد يكمل. وكذلك لو سكّرت التطبيق بأي طريقة ثانية */
const ckOpen = () => !!user && cart.length > 0 && !holdOver && (holdEnd > Date.now() || paypLeft(state.payp) > 0);
const ckOpenLeft = () => Math.max(holdEnd > Date.now() ? Math.round((holdEnd - Date.now()) / 1000) : 0, paypLeft(state.payp));
var lvT = 0, leaveSkip = false;   // var: go() يلمسها من أول التشغيل
function leaveAsk(kind) {
  if (ckBusy) return busyNote();
  if (kind === 'exit') leaveSkip = true;   // رجوع ثاني بدون ما تختار ← تطلع
  const out = kind === 'out';
  openSheet('bottom now', `<h3>${out ? 'تسجيل الخروج' : 'طلبكِ لم يكتمل'}</h3>
    <p class="sub-note">وقت الدفع ينفد خلال <b class="lvt" id="lvt" dir="ltr"></b>. ${out ? 'تسجيل الخروج يلغي الطلب.' : 'يمكنكِ إكمال الدفع، أو إلغاء الطلب والخروج.'}</p>
    ${anyHeld() ? cancelTxt() : ''}
    <button class="cta" data-lvgo>إكمال الدفع</button>
    <button class="cta danger" data-lvout="${out ? 'out' : 'exit'}">${out ? 'تسجيل الخروج وإلغاء الطلب' : 'الخروج وإلغاء الطلب'}</button>`);
  clearInterval(lvT); payBanner();
  if (anyHeld()) { const st0 = state.st || 0; penAsk().then(() => { const c = document.getElementById('cxtxt'); if (c && (state.st || 0) !== st0 && sheet.querySelector('[data-lvout]')) c.outerHTML = cancelTxt() }) }   // عدد الإلغاءات من السيرفر
  const f = () => {
    const el = document.getElementById('lvt'); if (!el) return clearInterval(lvT);
    const s = ckOpenLeft(); el.textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
    if (!s || !ckOpen()) { clearInterval(lvT); if (sheet.querySelector('[data-lvout]') && !ckBusy) closeSheet() }   // الوقت خلص: «انتهى وقت الدفع» تطلع من العداد نفسه
  };
  f(); lvT = setInterval(f, 1000);
}
function leaveGo() {
  leaveSkip = false; clearInterval(lvT); closeSheet();
  if (paypLeft(state.payp) > 0) return payResume();
  if (ckOpen()) return openCheckout();
}
async function leaveOut(btn) {
  if (ckBusy) return busyNote();
  const kind = btn.dataset.lvout; btn.disabled = true;
  const x = await cancelCore();
  if (x.paid) return orderDone(x.paid.order_id || x.pid, x.paid.code);   // طلع مدفوع: «تم استلام طلبك» (ما يطلعش من الحساب)
  if (x.err) { btn.disabled = false; return toast(x.err) }
  clearInterval(lvT); leaveSkip = false;
  if (kind === 'out') { closeSheet(); cancelToast(x.r, 'تم إلغاء الطلب.'); return signOutNow() }
  closeSheet(); cancelToast(x.r, 'تم إلغاء الطلب.'); pulse(true);
}
async function placeOrder(btn) {
  const a = curAddr(); if (!a || !cart.length) return;
  if (ckMixed() && !dlvGet()) return dlvPaint();   // v61: طريقة الاستلام إجبارية
  if (payMode() === 'sandbox' || payMode() === 'live') return confirmHold(btn);
  btn.disabled = true; btn.textContent = 'جاري إرسال الطلب...';
  const city = a.city || String(a.area || '').split(/[،,]/)[0].trim();
  try {
    const r = await uapi('/rest/v1/rpc/place_test_order', { method: 'POST', headers: JH, body: JSON.stringify({
      p_items: ckItems || cartPayload(),
      p_address: addrPay(a, city),
      p_notes: (document.getElementById('ck-notes')?.value || '').trim(), p_key: ckKey }) });
    const id = r && r.id; if (!id) throw new Error('no id');
    orderDone(id, r.code);
  } catch (e) {
    btn.disabled = false; btn.textContent = 'تأكيد الطلب';
    const m = String(e.message || '');
    if (orderErr(m)) return;
    toast(/out of stock: (.+)/.test(m) ? 'نفدت الكمية: ' + m.match(/out of stock: (.+)/)[1] : /unavailable/.test(m) ? 'منتج في سلتك لم يعد متوفراً'
      : /slow down/.test(m) ? 'يُرجى المحاولة بعد دقيقة.' : /cart too big/.test(m) ? ckErr(m) : /disabled/.test(m) ? 'الطلب التجريبي متوقف حالياً' : /address required/.test(m) ? 'يُرجى تحديد عنوان التوصيل.'
      : /could not find the function|place_test_order/i.test(m) ? 'الطلب غير مفعّل بعد (test-checkout.sql)' : /failed to fetch|networkerror|load failed/i.test(m) ? ckErr(m) : 'تعذر إرسال الطلب: ' + m.slice(0, 140));
    pulse(true);
    console.error('place_test_order:', m);
  }
}
/* انتهت مدة التثبيت وتغيّر السعر: ترجع للسلة بالأسعار الجديدة، والسعر اللي تغيّر يلمع */
function priceBack(list) {
  ckItems = null;
  list.forEach(x => { const p = byId(String(x.id)); if (p && x.new != null) p.price = Number(x.new) });
  closeSheet(); go('cart'); flashCart(list.map(x => x.id));
  setTimeout(() => list.forEach(x => { const c = document.querySelector(`#cartv .ccard[data-cid="${CSS.escape(String(x.id))}"]`); if (c) { flash(c.querySelector('.cunit'), null, true); c.querySelectorAll('.cline').forEach(e => flash(e, null, true)) } }), 280);
  toast('تغيّرت أسعار بعض المنتجات.');
  pulse(true);
}
/* v86 (معتز): «متابعة الطلب»/«عرض الإيصال» بعد الدفع كانت: النافذة تنزل ← «طلباتي» بالقائمة القديمة ← رد السيرفر ← القائمة تتعاد (رمشة) ← نافذة تطلع من جديد.
   توا: النافذة تقعد والزر «لحظة...»، الطلبات تتجاب، و«طلباتي» تترسم تحتها بالطلب الجديد، ومحتوى نفس النافذة يتبدّل للتفاصيل/الإيصال في خطوة وحدة.
   لو النت فشل أو الطلب مش موجود: زي قبل (النافذة تتسكّر و«طلباتي»). لو سكّرت النافذة وهي تستنى: ولا حاجة */
let trkBusy = false;
async function trackOrder(id, rcpt, btn) {
  if (trkBusy) return; trkBusy = true;
  const g = shGen, ok0 = sheet.classList.contains('on');
  // v98 (معتز): «لحظة...» بس لو الطلب طوّل أكثر من 0.35 ث (زي باقي الأزرار)، والطلب والإيصال يفتحوا بدون حركة
  const slow = btn ? setTimeout(() => { if (!btn.isConnected) return; btn.classList.add('busy'); btn.dataset.t0 = btn.textContent; btn.textContent = 'لحظة...' }, 350) : 0;
  sheet.querySelectorAll('[data-trackorder],[data-orcpt]').forEach(b => { b.disabled = true });
  let ok = true; try { await ordFetch() } catch (e) { ok = false }
  clearTimeout(slow); trkBusy = false;
  if (ok0 && shGone(g)) return;
  const box = document.getElementById('ordv');
  if (ok && myOrders.some(x => x.id === id)) {
    box.innerHTML = ordersListHTML(); ordSig = JSON.stringify(myOrders); ordAt = Date.now();   // القائمة جاهزة قبل ما الصفحة تبان (ما فيش رمشة)
    go('orders');
    if (rcpt) openReceipt(id); else openOrderC(id);
    return;
  }
  closeSheet(); go('orders'); if (!ok) toast(NETMSG);
}

/* ===== delivery addresses ===== */
let addrs = lsGet('mir_addrs', []), activeAddr = lsGet('mir_addr_active', null), addrFrom = 'home';
const addrs0 = JSON.parse(JSON.stringify(Array.isArray(addrs) ? addrs : []));   // v70: العناوين لحظة الفتح (نفس فكرة cart0)
const curAddr = () => addrs.find(a => a.id === activeAddr) || null;
function saveAddrs() { if (user && lsGet('mir_cart_dirty', false) !== 'order') lsSet('mir_cart_dirty', true); lsSet('mir_addrs', addrs); lsSet('mir_addr_active', activeAddr); updateDlv(); syncProfile() }   // v70: نفس العلامة (السلة والعناوين ينبعتوا مع بعض)
function updateDlv() {
  const a = curAddr();
  document.querySelectorAll('.dlvbtn').forEach(b => b.classList.toggle('none', !a));   // v39: نقطة ذهبية لو ما فيش عنوان
}
/* v78: في التطبيق نص العنوان div (Chrome ما يحددش نص داخل button)، والضغطة نفسها (data-pick). في المتصفح button زي قبل */
const AT = () => window.__app ? '<div role="button" tabindex="0"' : '<button';
function renderAddrs() {
  const box = document.getElementById('addrs');
  box.innerHTML = addrs.length ? addrs.map(a => `<div class="acard ${a.id === activeAddr ? 'on' : ''}">
      <button class="aradio" data-pick="${esc(a.id)}" aria-label="اختيار هذا العنوان"></button>
      ${AT()} class="atext cpy" data-pick="${esc(a.id)}">${a.v === 2 ? `<b>${esc(addrLine(a))}</b><span>${esc(a.desc || '')}</span><span class="aname">${esc(a.name || '')}${a.phone ? ' · <bdi>' + esc(a.phone) + '</bdi>' : ''}</span>` : `<b>${esc(a.area)}${a.label ? `<span class="atag">${esc(a.label)}</span>` : ''}</b><span>${esc(a.details || '')}</span>`}${window.__app ? '</div>' : '</button>'}
      <button class="aico" data-aedit="${esc(a.id)}" aria-label="تعديل">${ic('edit')}</button>
      <button class="aico del" data-adel="${esc(a.id)}" aria-label="حذف">${ic('trash')}</button></div>`).join('')
    : `<div class="aempty">${ic('pin')}<div>لا توجد عناوين محفوظة.</div></div>`;
}
function pickAddr(id) {
  activeAddr = id; saveAddrs(); renderAddrs(); toast('تم اختيار عنوان التوصيل');
  setTimeout(() => { if (view === 'addr') go(addrFrom || 'home') }, 350);
}
async function delAddr(id) {
  const a = addrs.find(x => x.id === id); if (!a) return;
  if (!(await ask('حذف العنوان', a.area || '', 'نعم، حذف العنوان', 'danger'))) return;
  addrs = addrs.filter(x => x.id !== id);
  if (activeAddr === id) activeAddr = addrs[0] ? addrs[0].id : null;
  saveAddrs(); renderAddrs(); toast('تم حذف العنوان');
}

/* ===== v45: عنوان التوصيل يدوي: الاسم، الموبايل، المدينة (بسعرها)، المنطقة (لو للمدينة مناطق)، وصف الموقع =====
   المدن والمناطق من «التوصيل» في اللوحة. العنوان الجديد v:2، و area = «المدينة، المنطقة» للعرض، و details = الوصف */
let editingId = null;
const af = { city: '', zone: '' };
function dCities() {
  let v = (state.set || {}).delivery_cities;
  if (typeof v === 'string') { try { v = JSON.parse(v) } catch (e) { v = null } }
  return (Array.isArray(v) ? v : []).filter(c => c && c.active !== false && String(c.name || '').trim().length >= 2);
}
const dCity = n => dCities().find(c => c.name === n) || null;
const dZones = c => (c && Array.isArray(c.zones) ? c.zones : []).filter(z => String(z || '').trim());
const addrLine = a => a ? (a.v === 2 ? [a.city, a.zone].filter(Boolean).join('، ') : a.area) : '';
/* اللي يمشي للسيرفر مع الطلب: الاسم والرقم والمدينة والمنطقة من العنوان، والوصف في address */
const addrPay = (a, city) => ({ ...(a.v === 2 ? { city: a.city, zone: a.zone || '', address: a.desc, name: a.name, phone: a.phone, lat: null, lng: null }
  : { city, address: [a.area, a.details].filter(Boolean).join('، '), lat: a.lat, lng: a.lng }), dlv: dlvGet() || null });   // v61: طريقة الاستلام (السيرفر يتجاهلها لو السلة نوع واحد)
function afPaint() {
  const c = dCity(af.city), zs = dZones(c), fee = c && Number.isFinite(Number(c.fee)) ? Number(c.fee) : null;
  const ce = document.getElementById('af-city'); ce.textContent = af.city || 'المدينة'; ce.classList.toggle('ph', !af.city);
  const fe = document.getElementById('af-fee'); fe.hidden = !c;
  if (c) fe.innerHTML = `${ic('truck')}<span>سعر التوصيل ${fee != null ? `<b>${money(fee)}</b>، ` : ''}يُدفع عند الاستلام</span>`;
  document.getElementById('afr-zone').hidden = !zs.length;
  const ze = document.getElementById('af-zone'); ze.textContent = af.zone || 'المنطقة'; ze.classList.toggle('ph', !af.zone);
}
function openMap(id) {
  editingId = id;
  const a = id ? addrs.find(x => x.id === id) : null, v2 = a && a.v === 2;
  go('map');
  document.getElementById('af-title').textContent = a ? 'تعديل العنوان' : 'عنوان جديد';
  document.getElementById('af-name').value = (v2 && a.name) || (profile && profile.full_name) || '';
  document.getElementById('af-phone').value = (v2 && a.phone) || (profile && profile.phone) || '';
  document.getElementById('af-desc').value = a ? (v2 ? a.desc || '' : a.details || '') : '';
  af.city = v2 && dCity(a.city) ? a.city : ''; af.zone = af.city && dZones(dCity(af.city)).includes(a.zone) ? a.zone : '';
  document.querySelectorAll('#v-map .afr.err').forEach(e => e.classList.remove('err'));
  afPaint();
  const dsc = document.getElementById('af-desc'); dsc.style.height = ''; dsc.style.overflowY = '';   // v57: الحجم يرجع، ويكبر لو الوصف القديم طويل
  requestAnimationFrame(() => growTa(dsc));
}
/* قائمة اختيار من تحت، فيها بحث لو الخيارات كثيرة */
const normAr = t => String(t || '').toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/\s+/g, ' ').trim();
function afPick(kind) {
  const c = dCity(af.city);
  const items = kind === 'city' ? dCities().map(x => ({ v: x.name, sub: Number.isFinite(Number(x.fee)) ? money(Number(x.fee)) : '' })) : dZones(c).map(z => ({ v: z, sub: '' }));
  const cur = kind === 'city' ? af.city : af.zone;
  const row = x => `<button data-afpick="${kind}" data-v="${esc(x.v)}" class="${x.v === cur ? 'on' : ''}"><span>${esc(x.v)}</span>${x.sub ? `<small>${x.sub}</small>` : ''}${x.v === cur ? ic('check') : ''}</button>`;
  openSheet('bottom', `<h3>${kind === 'city' ? 'اختاري المدينة' : 'اختاري المنطقة'}</h3>
    ${items.length > 7 ? `<input class="pk-s" id="pk-s" placeholder="بحث" autocomplete="off">` : ''}
    <div class="pkl" id="pkl">${items.length ? items.map(row).join('') : `<p class="pk-none">${kind === 'city' ? 'لا توجد مدن توصيل متاحة حالياً.' : 'لا توجد مناطق.'}</p>`}</div>`);
  const sI = document.getElementById('pk-s');
  if (sI) sI.addEventListener('input', () => { const q = normAr(sI.value); document.getElementById('pkl').innerHTML = items.filter(x => !q || normAr(x.v).includes(q)).map(row).join('') || '<p class="pk-none">لا توجد نتائج.</p>' });
}
function afChoose(kind, v) {
  if (kind === 'city') { if (af.city !== v) { af.city = v; if (!dZones(dCity(v)).includes(af.zone)) af.zone = '' } document.getElementById('afr-city').classList.remove('err') }
  else { af.zone = v; document.getElementById('afr-zone').classList.remove('err') }
  closeSheet(); afPaint();
}
function saveAddr() {
  const g = id => document.getElementById(id), name = g('af-name').value.trim().replace(/\s+/g, ' '), phone = digits(g('af-phone').value), desc = g('af-desc').value.trim();
  const c = dCity(af.city), zs = dZones(c);
  const bad = (row, msg) => { const r = g(row); r.classList.add('err'); const f = r.querySelector('input,textarea'); if (f) f.focus(); toast(msg) };
  document.querySelectorAll('#v-map .afr.err').forEach(e => e.classList.remove('err'));
  if (name.length < 2) return bad('afr-name', 'يُرجى إدخال الاسم.');
  if (!lyPhone(phone)) return bad('afr-phone', 'يُرجى إدخال رقم موبايل ليبي صحيح.');
  if (!c) return bad('afr-city', 'يُرجى اختيار المدينة.');
  if (zs.length && !zs.includes(af.zone)) return bad('afr-zone', 'يُرجى اختيار المنطقة.');
  if (desc.length < 3) return bad('afr-desc', 'يُرجى كتابة وصف الموقع.');
  const zone = zs.length ? af.zone : '';
  const first = !addrs.length;
  const data = { v: 2, name, phone, city: c.name, zone, desc, area: [c.name, zone].filter(Boolean).join('، '), details: desc, label: '', lat: null, lng: null, code: '' };
  if (editingId && addrs.find(x => x.id === editingId)) Object.assign(addrs.find(x => x.id === editingId), data);
  else { const id = newId(); addrs.unshift({ id, ...data }); activeAddr = id }
  saveAddrs(); toast(editingId ? 'تم تعديل العنوان' : 'تم حفظ العنوان');
  if (first) go(addrFrom || 'home'); else go('addr');
}
updateDlv();

/* ===== customer accounts (email + password, no email verification for now) ===== */
let user = lsGet('mir_user', null), profile = null, pendingAfter = null, authMode = 'welcome', syncT = null;
const JH = { 'Content-Type': 'application/json' };
let authId = '';
const realEmail = e => e && !/@phone\.miracles\.ly$/i.test(e) ? e : '';   // v46: الحساب بالرقم بس عنده إيميل داخلي ما يبانش
const authHelper = body => api('/functions/v1/auth-helper', { method: 'POST', headers: JH, body: JSON.stringify(body) });
function setUser(r) {
  user = { access_token: r.access_token, refresh_token: r.refresh_token, expires_at: Math.floor(Date.now() / 1000) + (r.expires_in || 3600),
    id: (r.user && r.user.id) || (user && user.id), email: (r.user && r.user.email) || (user && user.email) };
  lsSet('mir_user', user);
}
/* الجلسة ما تنتهيش لحالها: تتجدد في الخلفية. لو صفحة ثانية مفتوحة جددتها، ناخذوا نسختها بدل ما نطلعوا */
let uRef = null;
function uAdopt() { const s = lsGet('mir_user', null); if (s && user && s.id === user.id && s.expires_at > user.expires_at) { user = s; return true } return false }
async function uEnsure() {
  if (!user) throw new Error('auth');
  if (user.expires_at - Date.now() / 1000 > 60) return;
  if (uAdopt() && user.expires_at - Date.now() / 1000 > 60) return;
  if (uRef) return uRef;
  uRef = (async () => {
    try { setUser(await api('/auth/v1/token?grant_type=refresh_token', { method: 'POST', headers: JH, body: JSON.stringify({ refresh_token: user.refresh_token }) })) }
    catch (e) {
      if (uAdopt()) return;
      if (e.status === 400 || e.status === 401) sessExpired();   // v90 (كان: localSignOut + رسالة، وتقعد في نفس الصفحة)
      throw e;
    }
  })();
  try { await uRef } finally { uRef = null }
}
/* v54: أوامر تغيّر الحجز/العقوبة: أي رد «نبض» بدا قبلها أو وقتها قديم ← ما يتطبّقش (وإلا يمسح العقوبة أو الحجز لحظة) */
async function uapi(path, opts = {}) {
  await uEnsure(); const mut = LIVE_FN.test(path); if (mut) liveAt = Date.now();
  try { return await api(path, { ...opts, headers: { Authorization: 'Bearer ' + user.access_token, ...(opts.headers || {}) } }) }
  finally { if (mut) liveAt = Date.now() }
}
/* رقم جوال ليبي: 091 إلى 094 + 7 أرقام (أو بالمفتاح الدولي 218) */
/* v48: كلمة السر الجديدة: 8 أحرف أو أكثر + حرف إنجليزي + رقم (الدخول بالقديمة عادي) */
const NAME_MAX = 15, NAME_MSG = 'يجب ألا يزيد الاسم عن 15 حرفاً.';   // v54
const PW_MSG = 'يجب أن تتكون كلمة السر من 8 أحرف أو أكثر، وتتضمن حرفاً إنجليزياً ورقماً.';
const pwStrong = p => p.length >= 8 && p.length <= 72 && /[A-Za-z]/.test(p) && /\d/.test(p);
const lyPhone = p => /^(09[1-4]\d{7}|2189[1-4]\d{7}|002189[1-4]\d{7}|9[1-4]\d{7})$/.test(digits(p));   // v49: 091–094 بس
function authErr(e, byPhone) {
  const m = String(e && e.message || '');
  if (/invalid login|invalid_credentials/i.test(m)) return byPhone ? 'رقم الهاتف أو كلمة السر غير صحيحة' : 'البريد الإلكتروني أو كلمة السر غير صحيحة';
  if (/already (been )?registered|already exists/i.test(m)) return 'هذا البريد الإلكتروني مسجّل مسبقاً.';
  if (/database error saving|phone_norm|duplicate key/i.test(m)) return 'رقم الهاتف مسجّل مسبقاً.';
  if (/expired|invalid.*(token|otp)|otp/i.test(m)) return 'الكود غير صحيح أو انتهت صلاحيته.';
  if (/security purposes|after \d+ seconds/i.test(m)) return 'يُرجى الانتظار دقيقة ثم المحاولة مرة أخرى.';
  if (/should be different|same password/i.test(m)) return 'كلمة السر الجديدة مطابقة للقديمة.';
  if (/password should be|at least|weak/i.test(m)) return PW_MSG;
  if (/valid email|email address|invalid format|unable to validate/i.test(m)) return 'البريد الإلكتروني غير صحيح';
  if (/rate limit|too many|over_/i.test(m)) return 'محاولات كثيرة، يُرجى المحاولة لاحقاً.';
  if (/not confirmed/i.test(m)) return 'الحساب يحتاج إلى تفعيل.';
  return NETMSG;
}
function needLogin(after) { if (user) return true; pendingAfter = after || null; loginPrompt(); return false }
/* v66: الزائر ما يفتحش تذكرة: يسجّل دخول، ولا يتواصل بالواتساب */
function ticketGuest() {
  pendingAfter = () => openTicketForm();
  const wa = waLink('');
  openSheet('bottom', `<div class="lp"><div class="lp-ic">${ic('lock')}</div><h3>يلزم تسجيل الدخول</h3>
    <p>تسجيل الدخول مطلوب لفتح تذكرة دعم${wa ? '، ويمكن أيضاً التواصل معنا عبر واتساب' : ''}.</p>
    <button class="cta" data-auth="login">تسجيل الدخول</button><button class="cta ghost" data-auth="signup">إنشاء حساب</button>
    ${wa ? `<a class="cta ghost lp-wa" href="${esc(wa)}" target="_blank" rel="noopener"><img src="/soc-whatsapp.svg" alt="" width="22" height="22">التواصل عبر واتساب</a>` : ''}
    <button class="lp-later" data-later>لاحقاً</button></div>`);
}
function loginPrompt() {
  openSheet('bottom', `<div class="lp"><div class="lp-ic">${ic('lock')}</div><h3>يلزم تسجيل الدخول</h3>
    <p>تسجيل الدخول مطلوب لاستخدام السلة ومتابعة الطلبات.</p>
    <button class="cta" data-auth="login">تسجيل الدخول</button><button class="cta ghost" data-auth="signup">إنشاء حساب</button>
    <button class="lp-later" data-later>لاحقاً</button></div>`);
}
function showAuth(mode) { authMode = mode || 'welcome'; closeSheet(); document.getElementById('authv').classList.remove('leaving'); document.getElementById('authv').hidden = false; renderAuth(); document.getElementById('authv').scrollTop = 0 }
function hideAuth() {
  const a = document.getElementById('authv'); document.getElementById('au-sessnote')?.remove(); if (a.hidden) return;   // v90
  a.hidden = true; a.classList.remove('leaving');   // v88: فوراً (كان: تلاشي 0.22 ث بـ .leaving)
}
/* ===== v46: أكواد التحقق (دالة auth-code): SMS عن طريق «رسالة» أو الإيميل =====
   su: بيانات إنشاء الحساب (لين يتأكد الكود)، rs: «نسيت كلمة السر»، cv: الكود الحالي (kind, ch, to, at) */
const su = { name: '', phone: '', email: '', pass: '' }, rs = { id: '', ways: { sms: null, email: null } };
const cv = { kind: '', ch: '', to: '', at: 0 };
/* v87: آخر محاولة كود (الدخول/التسجيل/نسيت كلمة السر) تنحفظ في التلفون كمان (mir_cvtried: {k, at, to}، بدون الكود)،
   فلو التطبيق اتسكّر (تجيب الكود من الرسائل) ورجعت تطلبه خلال المهلة: شاشة الكود بالعداد بدل «انتظري 5 دقائق» */
const CVT_K = 'mir_cvtried';
const cvTried = () => { const t = cv.tried || lsGet(CVT_K, null); return t && t.k && Date.now() - t.at < 600000 ? t : null };
function cvTriedSet(t) { cv.tried = t; lsSet(CVT_K, t) }
/* v47: الدخول بكود: lg = بيانات الدخول لين يتأكد الكود، mir_td = الأجهزة المحفوظة («تذكّر هذا الجهاز» 30 يوم) */
const lg = { id: '', pass: '', lt: '', ways: { sms: null, email: null } };
const normPh = p => { let d = digits(p); if (d.startsWith('00218')) d = d.slice(5); else if (d.startsWith('218') && d.length === 12) d = d.slice(3); if (d.length === 9 && d[0] === '9') d = '0' + d; return d };
const smsOk = p => /^09[1-4]\d{7}$/.test(normPh(p));   // «رسالة» تبعث لـ 091–094 بس
const maskPhone = p => p.length >= 6 ? p.slice(0, 3) + '*'.repeat(p.length - 5) + p.slice(-2) : p;
const maskEmail = e => { const at = e.lastIndexOf('@'), u = e.slice(0, at), d = e.slice(at); return (u.length <= 4 ? u.slice(0, 1) + '*'.repeat(Math.max(1, u.length - 1)) : u.slice(0, 2) + '*'.repeat(u.length - 4) + u.slice(-2)) + d };
async function authCode(body, tok) {
  const ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), NET_MS);   // v70: مهلة 15 ث
  try {
    const h = { apikey: SB_KEY, 'Content-Type': 'application/json' }; if (tok) h.Authorization = 'Bearer ' + tok;
    const r = await fetch(SB_URL + '/functions/v1/auth-code', { method: 'POST', signal: ctl.signal, headers: h, body: JSON.stringify({ hw: HW, ...body }) });
    let d = null; try { d = await r.json() } catch (e) {}
    return r.ok ? { ok: true, ...(d || {}) } : { ok: false, ...(d || { error: 'server' }), status: r.status };
  } catch (e) { return { ok: false, error: 'network' } }
  finally { clearTimeout(tm) }
}
function codeErr(r) {
  const e = r && r.error;
  return e === 'phone_taken' ? 'رقم الهاتف مسجّل مسبقاً.'
    : e === 'email_taken' ? 'البريد الإلكتروني مسجّل مسبقاً.'
    : e === 'signup_limit' ? SIGNUP_MAX
    : e === 'sms_limit' ? 'وصلتِ إلى الحد اليومي لرسائل التحقق. يُرجى المحاولة غداً أو استخدام البريد الإلكتروني.'
    : e === 'cooldown' ? 'يُرجى الانتظار 5 دقائق قبل طلب كود جديد.'
    : e === 'sms_unavailable' || e === 'sms_failed' ? 'تعذر إرسال الرسالة حالياً.' + ((cv.kind === 'reset' ? rs.ways.email : cv.kind === 'login' ? lg.ways.email : cv.kind === 'signup' ? su.email : '') ? ' يُرجى استخدام البريد الإلكتروني.' : '')
    : e === 'invalid_credentials' ? (String(lg.id).includes('@') ? 'البريد الإلكتروني أو كلمة السر غير صحيحة' : 'رقم الهاتف أو كلمة السر غير صحيحة')
    : e === 'password' ? PW_MSG
    : e === 'signup_paused' ? 'التسجيل في الموقع متوقف مؤقتاً، يُرجى المحاولة لاحقاً.'
    : e === 'login_expired' ? 'انتهت المهلة. يُرجى تسجيل الدخول من جديد.'
    : e === 'email_unavailable' || e === 'email_failed' ? 'تعذر إرسال البريد الإلكتروني حالياً.'
    : e === 'sms_phone' ? 'رقم الهاتف غير صحيح'
    : e === 'code_bad' ? 'الكود غير صحيح.' + (r.left ? ` المحاولات المتبقية: ${r.left}` : '')
    : e === 'code_expired' ? 'انتهت صلاحية الكود. يُرجى طلب كود جديد.'
    : e === 'code_locked' ? 'تم تجاوز عدد المحاولات. يُرجى طلب كود جديد.'
    : e === 'not_found' ? 'لا يوجد حساب بهذا الرقم أو البريد الإلكتروني.'
    : e === 'no_channel' ? 'لا تتوفر طريقة لإرسال الكود لهذا الحساب. يُرجى التواصل معنا.'
    : e === 'too_many' ? 'محاولات كثيرة. يُرجى المحاولة بعد قليل.'
    : e === 'bot' ? ERRMSG   // v66: Turnstile (v70: رسالة بسيطة)
    : e === 'network' ? NETMSG
    : ERRMSG;
}
const codeInput = () => `<label class="field">الكود<input id="au-code" type="text" inputmode="numeric" autocomplete="one-time-code" dir="ltr" style="text-align:center;letter-spacing:6px;font-size:20px" maxlength="6" placeholder="••••••"></label>`;
const cvLinks = () => {
  const other = cv.kind === 'reset' ? (cv.ch === 'sms' ? rs.ways.email : rs.ways.sms) : cv.kind === 'login' ? (cv.ch === 'sms' ? lg.ways.email : lg.ways.sms) : (cv.ch === 'sms' ? su.email : smsOk(su.phone));
  queueMicrotask(rsdStart);   // v59: العد يبان على الزر من أول لحظة
  return `<div class="au-links col"><button type="button" class="au-forgot" data-aresend data-rs="cv">إعادة إرسال الكود</button>${other ? '<button type="button" class="au-forgot" data-cvchange>تغيير طريقة الإرسال</button>' : ''}</div>`;
};
/* v59: «إعادة إرسال الكود» يبين العد على الزر نفسه (باهت لين يخلص)، في كل شاشات الكود. مؤقت واحد، يوقف وحده لما ما فيش زر ظاهر */
let rsdT = 0;
function rsdPaint() {
  const bs = [...document.querySelectorAll('[data-rs]')].filter(b => b.offsetParent);
  if (!bs.length) { clearInterval(rsdT); rsdT = 0; return }
  bs.forEach(b => {
    if (b.classList.contains('busy')) return;   // الإرسال شغال: الزر تحت تحكم دالة الإرسال
    const at = b.dataset.rs === 'pf' ? pf.at : cv.at, left = Math.ceil(((at || 0) + CODE_GAP - Date.now()) / 1000);
    const t = left > 0 ? `إعادة إرسال الكود بعد ${mmss(left)}` : 'إعادة إرسال الكود';
    if (b.textContent !== t) b.textContent = t;
    b.disabled = left > 0; b.classList.toggle('wait', left > 0);
  });
}
function rsdStart() { rsdPaint(); if (!rsdT) rsdT = setInterval(rsdPaint, 1000) }
const rsdQ = () => (queueMicrotask(rsdStart), '');
/* إرسال الكود بالطريقة المختارة */
async function cvSend(ch, btn) {
  const err = document.getElementById('au-err');
  const tk = cv.kind + ':' + ch + ':' + (cv.kind === 'reset' ? rs.id : cv.kind === 'login' ? lg.id : su.phone), tried = cvTried();   // v87: من الذاكرة أو التلفون
  cvTriedSet({ k: tk, at: Date.now(), to: tried && tried.k === tk ? tried.to || '' : '' });   // v56: محاولة إرسال (لو النت قطع والكود وصل: نخلوها تكتبه)
  if (btn) { btn.disabled = true; btn.classList.add('busy') }
  const tst = cv.kind === 'reset' || cv.kind === 'signup' ? await tsToken() : undefined;   // v66: Turnstile
  const send = t => cv.kind === 'reset' ? authCode({ action: 'reset-send', id: rs.id, channel: ch, ts: t })
    : cv.kind === 'login' ? authCode({ action: 'login-send', id: lg.id, lt: lg.lt, channel: ch })
    : authCode({ action: 'signup-send', name: su.name, phone: su.phone, email: su.email, channel: ch, ts: t });
  let r = await send(tst);
  // v70: انرفض لأن الفحص ما لحقش (تذكرة فاضية): نستنو التذكرة ونعاودوا لحالنا مرة وحدة، من غير ما يطلعلها خطأ
  if (!r.ok && r.error === 'bot' && !tst && cv.kind !== 'login' && tsKey()) { const t2 = await tsToken(); if (t2) r = await send(t2) }
  // v67: ما فيش فحص جديد هني (كان يطلّع المربع على شاشة الكود). الفحص الجاي يبدا لما تضغط «إعادة إرسال الكود» (tsToken)
  if (btn) { btn.disabled = false; btn.classList.remove('busy') }
  if (!r.ok && r.error === 'cooldown' && tried && tried.k === tk && Date.now() - tried.at < 600000) {   // v56: الكود اتبعت قبل شوية لنفس الرقم ← شاشة الكود
    cvTriedSet(tried); Object.assign(cv, { ch, at: tried.at, to: tried.to || cv.to });   // v87: + الرقم المخفي (لو التطبيق اتسكّر)
    authMode = cv.kind === 'reset' ? 'reset' : cv.kind === 'login' ? 'lcode' : 'scode'; renderAuth();
    setTimeout(() => document.getElementById('au-code')?.focus(), 50); toast('تم إرسال الكود قبل قليل، يُرجى كتابته.'); return true;
  }
  if (!r.ok) {
    if (cv.kind === 'signup' && r.error === 'sms_unavailable') r = { error: 'signup_paused' };   // v49: رصيد «رسالة» خلص
    if (r.error === 'login_expired') { lg.pass = ''; authMode = 'login'; renderAuth(codeErr(r)); return false }
    if (err) err.textContent = codeErr(r); else toast(codeErr(r)); return false;
  }
  Object.assign(cv, { ch, to: r.to, at: Date.now() });
  cvTriedSet({ ...cv.tried, at: cv.at, to: r.to || '' });   // v87
  authMode = cv.kind === 'reset' ? 'reset' : cv.kind === 'login' ? 'lcode' : 'scode'; renderAuth();
  setTimeout(() => document.getElementById('au-code')?.focus(), 50);
  return true;
}
function renderAuth(err) {
  // v46
  const c = document.getElementById('au-card'), m = authMode;
  const back = `<button type="button" class="iconbtn" data-auth="welcome" aria-label="رجوع">${ic('back')}</button>`;
  const pw = (id, ac, label) => `<label class="field">${label || 'كلمة السر'}<span class="pw"><input id="${id}" type="password" autocomplete="${ac}" dir="ltr" style="text-align:right" maxlength="72"><button type="button" class="eye" data-eye="${id}" aria-label="إظهار كلمة السر">${ic('eyeoff')}</button></span></label>`;
  /* v49: رابط الواتساب انشال من شاشات الدخول (يقعد في الرئيسية بس) */
  if (m === 'login') c.innerHTML = `<form id="au-form" data-mode="login" novalidate><div class="au-head">${back}<h3>تسجيل الدخول</h3></div><p class="sub">أهلاً بعودتك!</p>
      <label class="field">رقم الهاتف أو البريد الإلكتروني<input id="au-id" type="text" autocomplete="username" dir="ltr" style="text-align:right" autocapitalize="off" spellcheck="false" maxlength="254" value="${esc(authId)}"></label>
      ${pw('au-pass', 'current-password')}
      <button type="button" class="au-forgot" data-forgot>نسيت كلمة السر؟</button>
      <p class="au-err" id="au-err">${esc(err || '')}</p>
      <button class="cta" type="submit">دخول</button>
      <p class="au-switch">ليس لديكِ حساب؟<button type="button" data-auth="signup">أنشئي حساباً</button></p>
      <button type="button" class="au-guest" data-guest>تصفح كزائر</button></form>`;
  else if (m === 'forgot') c.innerHTML = `<form id="au-form" data-mode="forgot" novalidate><div class="au-head"><button type="button" class="iconbtn" data-auth="${user ? 'x' : 'login'}" aria-label="رجوع">${ic('back')}</button><h3>نسيت كلمة السر</h3></div>
      <p class="sub">اكتبي رقم الهاتف أو البريد الإلكتروني المسجّل، وسنرسل لكِ كوداً من 6 أرقام.</p>
      <label class="field">رقم الهاتف أو البريد الإلكتروني<input id="au-id" type="text" autocomplete="username" dir="ltr" style="text-align:right" autocapitalize="off" spellcheck="false" maxlength="254" value="${esc(rs.id)}"></label>
      <p class="au-err" id="au-err">${esc(err || '')}</p>
      <button class="cta" type="submit">متابعة</button></form>`;
  else if (m === 'pick') {   // v46: طريقة استلام الكود (إنشاء حساب أو نسيت كلمة السر)
    const w = cv.kind === 'reset' ? rs.ways : cv.kind === 'login' ? lg.ways : null;
    const sms = w ? w.sms : (smsOk(su.phone) ? maskPhone(normPh(su.phone)) : null), em = w ? w.email : (su.email ? maskEmail(su.email) : null);
    c.innerHTML = `<div id="au-form" data-mode="pick"><div class="au-head"><button type="button" class="iconbtn" data-auth="${cv.kind === 'reset' ? 'forgot' : cv.kind === 'login' ? 'login' : 'signup'}" aria-label="رجوع">${ic('back')}</button><h3>${cv.kind === 'reset' ? 'استرجاع الحساب' : cv.kind === 'login' ? 'تسجيل الدخول' : 'تأكيد الحساب'}</h3></div>
      <p class="sub">اختاري طريقة استلام كود التحقق.</p>
      ${sms ? `<button type="button" class="au-way" data-cvway="sms">${ic('chat')}<span><b>إرسال الكود برسالة SMS</b><small dir="ltr">${esc(sms)}</small></span></button>` : ''}
      ${em ? `<button type="button" class="au-way" data-cvway="email">${ic('mail')}<span><b>إرسال الكود إلى البريد الإلكتروني</b><small dir="ltr">${esc(em)}</small></span></button>` : ''}
      <p class="au-err" id="au-err">${esc(err || '')}</p></div>`;
  }
  else if (m === 'reset') c.innerHTML = `<form id="au-form" data-mode="reset" novalidate><div class="au-head"><button type="button" class="iconbtn" data-auth="forgot" aria-label="رجوع">${ic('back')}</button><h3>كلمة سر جديدة</h3></div>
      <p class="sub">أرسلنا الكود إلى <b dir="ltr">${esc(cv.to)}</b>.${cv.ch === 'email' ? ' إذا لم تجديه، تفقّدي البريد المزعج (Spam).' : ''}</p>
      ${codeInput()}
      ${pw('au-pass', 'new-password', 'كلمة السر الجديدة')}
      ${pw('au-pass2', 'new-password', 'تأكيد كلمة السر')}
      <p class="au-err" id="au-err">${esc(err || '')}</p>
      <button class="cta" type="submit">حفظ والدخول</button>${cvLinks()}</form>`;
  else if (m === 'lcode') c.innerHTML = `<form id="au-form" data-mode="lcode" novalidate><div class="au-head"><button type="button" class="iconbtn" data-auth="login" aria-label="رجوع">${ic('back')}</button><h3>تسجيل الدخول</h3></div>
      <p class="sub">أرسلنا كود التحقق إلى <b dir="ltr">${esc(cv.to)}</b>.${cv.ch === 'email' ? ' إذا لم تجديه، تفقّدي البريد المزعج (Spam).' : ''}</p>
      ${codeInput()}
      <label class="au-rem"><input type="checkbox" id="au-rem"><span>تذكّر هذا الجهاز لمدة 30 يوماً</span></label>
      <p class="au-err" id="au-err">${esc(err || '')}</p>
      <button class="cta" type="submit">دخول</button>${cvLinks()}</form>`;
  else if (m === 'scode') c.innerHTML = `<form id="au-form" data-mode="scode" novalidate><div class="au-head"><button type="button" class="iconbtn" data-auth="signup" aria-label="رجوع">${ic('back')}</button><h3>تأكيد الحساب</h3></div>
      <p class="sub">أرسلنا كود التحقق إلى <b dir="ltr">${esc(cv.to)}</b>.${cv.ch === 'email' ? ' إذا لم تجديه، تفقّدي البريد المزعج (Spam).' : ''}</p>
      ${codeInput()}
      <p class="au-err" id="au-err">${esc(err || '')}</p>
      <button class="cta" type="submit">تأكيد وإنشاء الحساب</button>${cvLinks()}</form>`;
  else if (m === 'signup') c.innerHTML = `<form id="au-form" data-mode="signup" novalidate><div class="au-head">${back}<h3>إنشاء حساب</h3></div>
      <label class="field">الاسم<input id="au-name" type="text" autocomplete="name" maxlength="15" value="${esc(su.name)}"></label>
      <label class="field">رقم الهاتف<input id="au-phone" type="tel" inputmode="tel" autocomplete="tel" dir="ltr" style="text-align:right" maxlength="20" placeholder="09XXXXXXXX" value="${esc(su.phone)}"></label>
      ${pw('au-pass', 'new-password')}<span class="hint" style="margin:-8px 0 8px">8 أحرف على الأقل، تتضمن حرفاً إنجليزياً ورقماً</span>
      ${pw('au-pass2', 'new-password', 'تأكيد كلمة السر')}
      <p class="au-err" id="au-err">${esc(err || '')}</p>
      <button class="cta" type="submit">إنشاء الحساب</button>
      <p class="au-switch">لديكِ حساب؟<button type="button" data-auth="login">سجّلي الدخول</button></p>
      <button type="button" class="au-guest" data-guest>تصفح كزائر</button></form>`;
  else c.innerHTML = `<h3 style="margin:0 0 6px;font-size:21px;font-weight:800;text-align:center">أهلاً بك في Miracles</h3>
      <p class="sub" style="text-align:center">إكسسوارات مختارة بعناية، تصلك حتى باب بيتك.</p>
      <button class="cta" data-auth="login">تسجيل الدخول</button>
      <button class="cta ghost" data-auth="signup">إنشاء حساب</button>
      <button class="au-guest" data-guest>تصفح كزائر</button>`;
  if (m === 'signup' && su.pass) ['au-pass', 'au-pass2'].forEach(id => { const e = document.getElementById(id); if (e) e.value = su.pass });   // v46
  if (['signup', 'forgot', 'pick', 'scode', 'reset'].includes(m)) tsPrep();   // v66: الفحص يبدا من فتح الشاشة
}
/* ===== v66: Cloudflare Turnstile قبل «إنشاء حساب» و«نسيت كلمة السر» =====
   المفتاح العام من اللوحة (settings.ts_site، ينشر مع الكتالوج). لو فاضي: ما فيش فحص.
   الفحص يصير في الخلفية، والمربع يطلع بس لو Cloudflare احتاج ضغطة (appearance: interaction-only).
   التذكرة لمرة وحدة. لو Cloudflare ما تحمّلش: نبعتوا بدونها والسيرفر يقرر
   v67: الفحص الجديد يبدا لما تحتاجه (إعادة الإرسال)، مش طول بعد الإرسال. والمربع (#ts-box) ما يبانش إلا والإرسال يستنى الفحص (.need)،
        حتى لو Cloudflare طلب ضغطة وهي لسا تكتب: يبان لما تضغط الزر، مع «يُرجى إكمال التحقق في الأسفل.» */
const ts = { id: null, tok: '', st: '', wait: null, shown: false, used: false, need: 0 };   // st: '' | 'load' | 'ready' | 'fail'
const tsKey = () => String((state.set || {}).ts_site || '').replace(/"/g, '').trim();
function tsPrep() {
  if (!tsKey()) return;
  if (!ts.st) {
    ts.st = 'load';
    window.__mirTs = () => { ts.st = 'ready'; tsPrep() };
    const sc = document.createElement('script');
    sc.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=__mirTs'; sc.async = true;
    sc.onerror = () => { ts.st = 'fail'; tsWake() };
    document.head.appendChild(sc);
    return;
  }
  if (ts.st !== 'ready' || ts.id !== null || !window.turnstile) return;
  const box = document.getElementById('ts-box'); if (!box) return;
  try {
    ts.id = window.turnstile.render(box, {
      sitekey: tsKey(), appearance: 'interaction-only', language: 'ar', action: 'code',
      callback: t => { ts.tok = t; ts.shown = false; tsWake() },
      'expired-callback': () => { ts.tok = '' },
      'error-callback': () => { ts.tok = ''; tsWake(); return true },
      'before-interactive-callback': () => { ts.shown = true },
      'after-interactive-callback': () => { ts.shown = false }
    });
  } catch (e) { ts.st = 'fail'; tsWake() }
}
function tsWake() { const w = ts.wait; ts.wait = null; if (w) w() }
async function tsToken() {
  if (!tsKey()) return undefined;
  if (ts.used) { ts.used = false; tsReset() }   // v67: التذكرة اللي قبل انستعملت ← فحص جديد توا (مش بعد الإرسال طول)
  tsPrep();
  const box = document.getElementById('ts-box');
  ts.need++; if (box) box.classList.add('need');   // v67: المربع يبان بس والإرسال يستنى
  const t0 = Date.now(); let told = false;
  try {
    while (!ts.tok && ts.st !== 'fail') {
      if (ts.shown && !told) { told = true; toast('يُرجى إكمال التحقق في الأسفل.') }
      if (Date.now() - t0 > (ts.shown ? 60000 : 8000)) break;   // المربع ظاهر: نستنوها تضغط. v70: 8 ث (كانت 3) لو الفحص مازال يشتغل
      await new Promise(r => { ts.wait = r; setTimeout(r, ts.shown ? 3000 : 400) });
    }
  } finally { if (--ts.need <= 0) { ts.need = 0; if (box) box.classList.remove('need') } }
  const t = ts.tok; ts.tok = ''; if (t) ts.used = true;
  return t;
}
function tsReset() { ts.tok = ''; if (ts.id !== null && window.turnstile) { try { window.turnstile.reset(ts.id) } catch (e) {} } }
/* e-mail sanity check: typos, disposable inboxes, and a domain that can receive mail (DNS MX) */
const MAIL_OK = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com', 'live.com', 'ymail.com', 'msn.com', 'me.com', 'mac.com', 'aol.com', 'googlemail.com', 'protonmail.com', 'proton.me', 'yandex.com', 'gmx.com', 'mail.com', 'zoho.com', 'yahoo.fr', 'hotmail.fr', 'outlook.sa', 'windowslive.com', 'rocketmail.com'];
const MAIL_MAIN = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com', 'live.com', 'ymail.com', 'msn.com'];
const MAIL_TEMP = ['mailinator.com', 'mailinator.net', 'yopmail.com', 'yopmail.fr', 'yopmail.net', 'mohmal.com', 'mohmal.in', 'guerrillamail.com', 'guerrillamail.net', 'guerrillamail.org', 'guerrillamailblock.com', 'sharklasers.com', 'grr.la', 'pokemail.net', 'spam4.me', '10minutemail.com', '10minutemail.net', '20minutemail.com', 'temp-mail.org', 'temp-mail.io', 'tempmail.com', 'tempmail.net', 'tempmailo.com', 'tempail.com', 'tempinbox.com', 'tempr.email', 'tmpmail.org', 'tmpmail.net', 'tmail.ws', 'throwawaymail.com', 'getnada.com', 'nada.email', 'trashmail.com', 'trashmail.de', 'maildrop.cc', 'dispostable.com', 'discard.email', 'fakeinbox.com', 'emailondeck.com', 'mintemail.com', 'mytemp.email', 'burnermail.io', 'spamgourmet.com', 'mailnesia.com', 'mailcatch.com', 'inboxkitten.com', '1secmail.com', '1secmail.net', '1secmail.org', 'emailfake.com', 'generator.email', 'mailpoof.com', 'moakt.com', 'moakt.cc', 'minuteinbox.com', 'dropmail.me', 'mail.tm', 'mail.gw', 'emailtemporanea.com', 'trbvm.com', 'harakirimail.com', 'mailforspam.com', 'spambox.us', 'luxusmail.org', 'tempmailaddress.com', 'mail7.io', 'fakemail.net', 'byom.de', 'linshiyouxiang.net', 'mvrht.net', 'crazymailing.com', 'mailsac.com', 'anonaddy.me', 'disposablemail.com', 'emltmp.com', 'tmails.net', 'tempm.com'];
let emailAsked = '';
function lev(a, b) {
  const m = a.length, n = b.length, d = Array.from({ length: m + 1 }, (_, i) => [i]);
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) {
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
  }
  return d[m][n];
}
async function hasMX(domain) {
  const ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), 4000);
  try {
    const r = await fetch('https://cloudflare-dns.com/dns-query?name=' + encodeURIComponent(domain) + '&type=MX', { headers: { Accept: 'application/dns-json' }, signal: ctl.signal });
    if (!r.ok) return null;
    const j = await r.json();
    if (j.Status === 3) return false;
    if (j.Status !== 0) return null;
    return (j.Answer || []).some(a => a.type === 15 && String(a.data).trim().split(/\s+/).pop() !== '.');
  } catch (e) { return null } finally { clearTimeout(tm) }
}
async function checkEmail(email) {
  const at = email.lastIndexOf('@'), local = email.slice(0, at), dom = email.slice(at + 1);
  if (MAIL_TEMP.some(x => dom === x || dom.endsWith('.' + x))) return { bad: 'البريد الإلكتروني المؤقت غير مقبول.' };
  if (MAIL_OK.includes(dom)) return {};
  const near = MAIL_MAIN.map(x => [x, lev(dom, x)]).filter(([, k]) => k > 0 && k <= 2).sort((a, b) => a[1] - b[1])[0];
  const mx = await hasMX(dom);
  if (near) return mx === false ? { hard: true, fix: local + '@' + near[0], why: 'هذا البريد الإلكتروني غير موجود.' } : { fix: local + '@' + near[0], why: 'هل المقصود:' };
  if (mx === false) return { bad: 'هذا البريد الإلكتروني غير موجود.' };
  return {};
}

async function submitAuth(form) {
  const v = id => (document.getElementById(id)?.value || '').trim();
  const errEl = document.getElementById('au-err'), btn = form.querySelector('[type=submit]'), mode = form.dataset.mode;
  const label = btn.dataset.l || (btn.dataset.l = btn.textContent);
  const pass = id => (document.getElementById(id) || {}).value || '';
  const password = pass('au-pass');
  const fail = m => { errEl.textContent = m; btn.disabled = false; btn.textContent = label };
  const okEmail = s => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);
  errEl.textContent = '';
  if (btn.disabled) return;
  /* v46: نسيت كلمة السر (1): الرقم أو الإيميل ← الطرق المتاحة ← الكود */
  if (mode === 'forgot') {
    const id = toEn(v('au-id')), isMail = id.includes('@');
    if (isMail ? !okEmail(id.toLowerCase()) : !lyPhone(id)) return fail('يُرجى إدخال رقم هاتف أو بريد إلكتروني صحيح.');
    btn.disabled = true; btn.textContent = 'لحظة...';
    const r = await authCode({ action: 'reset-options', id: isMail ? id.toLowerCase() : id });
    if (!r.ok) return fail(codeErr(r));
    rs.id = isMail ? id.toLowerCase() : id; rs.ways = { sms: r.sms || null, email: r.email || null }; cv.kind = 'reset';
    if (!rs.ways.sms && !rs.ways.email) return fail(codeErr({ error: 'no_channel' }));
    if (rs.ways.sms && rs.ways.email) { authMode = 'pick'; return renderAuth() }
    if (!(await cvSend(rs.ways.sms ? 'sms' : 'email'))) { btn.disabled = false; btn.textContent = label }
    return;
  }
  /* نسيت كلمة السر (2): الكود + كلمة السر الجديدة */
  if (mode === 'reset') {
    const code = digits(v('au-code')), p2 = pass('au-pass2');
    if (!/^\d{6}$/.test(code)) return fail('يُرجى إدخال الكود المرسل إليكِ (6 أرقام).');
    if (!pwStrong(password)) return fail(PW_MSG);
    if (password !== p2) return fail('كلمتا السر غير متطابقتين');
    btn.disabled = true; btn.textContent = 'لحظة...';
    const r = await authCode({ action: 'reset-verify', id: rs.id, channel: cv.ch, code, password });
    if (!r.ok || !r.access_token) return fail(codeErr(r));
    setUser(r); rs.id = ''; cvTriedSet(null); hello();   // v87: الكود اتستعمل
    try { await loadProfile(null) } catch (e) {}
    ordPrefetch();
    return authDone();
  }
  /* v47: الدخول (2): الكود (+ «تذكّر هذا الجهاز») */
  if (mode === 'lcode') {
    const code = digits(v('au-code')), remember = !!document.getElementById('au-rem')?.checked;
    if (!/^\d{6}$/.test(code)) return fail('يُرجى إدخال الكود المرسل إليكِ (6 أرقام).');
    btn.disabled = true; btn.textContent = 'لحظة...';
    const r = await authCode({ action: 'login-verify', id: lg.id, lt: lg.lt, password: lg.pass, channel: cv.ch, code, remember });
    if (!r.ok || !r.access_token) {
      if (r.error === 'login_expired' || r.error === 'invalid_credentials') { lg.pass = ''; authMode = 'login'; return renderAuth(codeErr(r)) }
      return fail(codeErr(r));
    }
    if (r.td) lsSet('mir_td', [r.td, ...tdList()].slice(0, 5));
    cvTriedSet(null);   // v87: الكود اتستعمل
    return loginDone(r);
  }
  /* v46: إنشاء حساب (2): الكود ← يتسجّل الحساب ويدخل */
  if (mode === 'scode') {
    const code = digits(v('au-code'));
    if (!/^\d{6}$/.test(code)) return fail('يُرجى إدخال الكود المرسل إليكِ (6 أرقام).');
    btn.disabled = true; btn.textContent = 'لحظة...';
    const r = await authCode({ action: 'signup-verify', name: su.name, phone: su.phone, email: su.email, password: su.pass, channel: cv.ch, code });
    if (!r.ok || !r.access_token) return fail(codeErr(r));
    setUser(r); cvTriedSet(null); hello();   // v87: الكود اتستعمل
    try { await loadProfile({ full_name: su.name, phone: su.phone }) } catch (e) {}
    Object.assign(su, { name: '', phone: '', email: '', pass: '' });
    ordPrefetch();
    return authDone();
  }
  let name = '', phone = '', email = '', byPhone = false;
  if (mode === 'login') {
    const id = toEn(v('au-id'));
    if (id.includes('@')) { email = id.toLowerCase(); if (!okEmail(email)) return fail('البريد الإلكتروني غير صحيح') }
    else { byPhone = true; phone = id; if (digits(phone).length < 9) return fail('يُرجى إدخال رقم الهاتف أو البريد الإلكتروني.') }
    authId = v('au-id');
  } else {
    name = v('au-name').replace(/\s+/g, ' '); phone = v('au-phone');
    if (name.replace(/\s/g, '').length < 2) return fail('يُرجى إدخال الاسم (حرفان على الأقل).');
    if (name.length > NAME_MAX) return fail(NAME_MSG);
    if (!lyPhone(phone)) return fail('رقم الهاتف غير صحيح');
  }
  if (mode === 'login' ? !password : !pwStrong(password)) return fail(mode === 'login' ? 'يُرجى إدخال كلمة السر.' : PW_MSG);
  if (mode === 'signup' && password !== pass('au-pass2')) return fail('كلمتا السر غير متطابقتين');
  btn.disabled = true; btn.textContent = 'لحظة...';
  if (mode === 'signup') {
    try { const t = await authHelper({ action: 'check-phone', phone }); if (t && t.taken) return fail('رقم الهاتف مسجّل مسبقاً.') } catch (e) {}
    if (!(await signupOk())) return fail(SIGNUP_MAX);   // لو ما ردّش: قاعدة البيانات نفسها ما تقبلش رقم مكرر
    // v49: إنشاء الحساب بالـ SMS بس (الإيميل يتضاف بعدين من «بياناتي»)
    Object.assign(su, { name, phone, email: '', pass: password }); cv.kind = 'signup';
    btn.disabled = false; btn.textContent = label;
    return cvSend('sms', btn);
  }
  // v47: الدخول: كلمة السر ← كود التحقق (إلا لو الجهاز محفوظ)
  lg.id = byPhone ? phone : email; lg.pass = password;
  const r = await authCode({ action: 'login-start', id: lg.id, password, td: tdList() });
  if (!r.ok) { lg.pass = ''; return fail(codeErr(r)) }
  if (r.access_token) return loginDone(r);
  Object.assign(lg, { lt: r.lt, ways: { sms: r.sms || null, email: r.email || null } }); cv.kind = 'login';
  btn.disabled = false; btn.textContent = label;
  if (lg.ways.sms && lg.ways.email) { authMode = 'pick'; return renderAuth() }
  return cvSend(lg.ways.sms ? 'sms' : 'email', btn);
}
const tdList = () => { const a = lsGet('mir_td', []); return Array.isArray(a) ? a.filter(x => typeof x === 'string').slice(0, 5) : [] };
async function loginDone(r) {
  setUser(r); pf.me = null; pfLastSet(null); cvTriedSet(null); Object.assign(lg, { pass: '', lt: '' }); authId = '';
  hello();
  try { await loadProfile(null) } catch (e) {}
  ordPrefetch();   // v44: طلباتها تتجهز في الخلفية من لحظة الدخول
  authDone();
}
/* حد إنشاء الحسابات: حسابين في اليوم من نفس الجهاز */
const SIGNUP_MAX = 'تم الوصول إلى الحد الأقصى لإنشاء الحسابات من هذا الجهاز اليوم.';
async function signupOk() {
  try { return (await api('/rest/v1/rpc/mir_signup_ok', { method: 'POST', headers: JH, body: JSON.stringify({ p_hw: HW }) })) !== false } catch (e) { return true }
}
/* الحساب يتربط بالجهاز (الإيقاف والحجز بالجهاز) */
function hello() { if (user) uapi('/rest/v1/rpc/mir_hello', { method: 'POST', headers: JH, body: JSON.stringify({ p_hw: HW }) }).catch(() => {}) }
const CODE_GAP = 5 * 60000;   // v56: 5 دقائق بين كود وكود (نفس السيرفر)
async function resendCode(b) {   // v46: نفس الطريقة، بعد 5 دقائق على الأقل (v56)
  const left = Math.ceil((cv.at + CODE_GAP - Date.now()) / 1000);
  if (left > 0) return toast(`يمكنكِ إعادة الإرسال بعد ${mmss(left)}`);
  if (await cvSend(cv.ch, b)) toast('تم إرسال كود جديد');
}
/* v90 (معتز): الجلسة اتلغت — دخلت من جهاز ثاني (sessCheck v49: «تم تسجيل الدخول إلى حسابك من جهاز آخر.»)
   أو التذكرة ما تجدّدتش (الحساب انمسح...: uEnsure: «انتهت الجلسة...»):
   شاشة الشعار زي التسخينة (التطبيق والمتصفح) ← تحتها: بياناتها تنمسح من التلفون، الرئيسية، شاشة الدخول وفوقها «انتهت الجلسة...»
   ← الشعار يختفي بعد ثانية. رسائل الخطأ الثانية مكتومة 3 ث. بعد الدخول ترجع للصفحة اللي كانت فيها (pendingAfter) */
let toastMute = 0, sxBusy = false;
const SESS_MSG = 'انتهت الجلسة، يُرجى تسجيل الدخول من جديد.';
function sessExpired(msg) {
  if (sxBusy || !user) return; sxBusy = true; msg = msg || SESS_MSG;
  const back = [view, curCat], sp = document.getElementById('splash');
  const cover = sp && sp.classList.contains('out');   // الشاشة الأولى خلصت ← نطلّعوها زي التسخينة. لسا ظاهرة ← نخدموا تحتها بس
  if (cover) { clearTimeout(spBackT); sp.classList.remove('out'); sp.classList.add('again') }
  toastMute = Date.now() + 3000;
  localSignOut(); closeSheet(); goQuiet = true; try { go('home') } finally { goQuiet = false }
  pendingAfter = ['cart', 'orders', 'account', 'favs', 'products', 'cat', 'support'].includes(back[0]) ? () => go(back[0], back[1]) : null;
  showAuth('login');
  const card = document.getElementById('au-card');
  if (card && !document.getElementById('au-sessnote')) card.insertAdjacentHTML('beforebegin', `<p class="au-sessnote" id="au-sessnote">${esc(msg)}</p>`);
  setTimeout(() => { sxBusy = false; if (cover && sp.classList.contains('again')) { sp.classList.add('out'); sp.classList.remove('again') } }, 1000);
}
function authDone() {
  lsSet('mir_guest', false); hideAuth();
  toast('أهلاً ' + firstName() + ' 🌸');
  const f = pendingAfter; pendingAfter = null;
  if (f) f(); else if (view === 'account') renderAccount();
  payAfterLogin();   // v70
}
const firstName = () => ((profile && profile.full_name) || '').split(' ')[0] || 'بك';
async function loadProfile(seed) {
  let rows = await uapi(`/rest/v1/profiles?id=eq.${user.id}&select=*`);
  profile = rows && rows[0];
  if (!profile) {
    const r = await uapi('/rest/v1/profiles', { method: 'POST', headers: { ...JH, Prefer: 'return=representation' }, body: JSON.stringify({ id: user.id, email: realEmail(user.email) || null, full_name: seed && seed.full_name ? String(seed.full_name).trim().slice(0, NAME_MAX) : null, phone: seed && seed.phone || null }) });
    profile = r[0];
  }
  if (profile.client_token) { const d0 = DEV; DEV = profile.client_token; lsSet('mir_dev', DEV); if (d0 !== DEV) setTimeout(() => pushSync(true), 500) }   // v98: الإشعارات برا التطبيق تتبع الحساب
  else { await uapi(`/rest/v1/profiles?id=eq.${user.id}`, { method: 'PATCH', headers: JH, body: JSON.stringify({ client_token: DEV }) }); profile.client_token = DEV }
  /* v70: الجهاز نسخة من حساب هذي الزبونة (own)؟
     - لا (زائرة سجّلت دخول، أو أول مرة): دمج بالجمع زي قبل، مرة وحدة.
     - أيوه: حساب السيرفر هو الأصل + اللي عدّلته في الجلسة هذي فوقه. تعديل قديم ما وصلش للسيرفر (dirty0): الجهاز هو الصح.
     هكي المحذوف من جهاز ثاني ما يرجعش من نسخة الجهاز القديمة */
  // own: الجهاز علّم إنه نسخة من هذا الحساب، أو (أول مرة بعد v70) فتح المتجر وهي مسجلة أصلاً (seed undefined = من الإقلاع):
  //      نسخة الجهاز وقتها نسخة من حسابها، لأن الخروج يمسحها. بعد الدخول (seed null/object) وما فيش علامة = بيانات زائرة ← دمج بالجمع
  const ow = lsGet('mir_owner', null), own = ow === user.id || (!ow && seed === undefined), cd = lsGet('mir_cart_dirty', false);
  let acart = Array.isArray(profile.cart) ? profile.cart : [];
  if (cd === 'order') acart = cart;   // v56: بعد طلب ناجح ما وصلش للسيرفر: المحلي هو الصح
  else if (own && cartDirty0 === true) acart = cart;
  else if (own) acart = mergeEdits(acart, cart0, cart, l => lineKey(l.id, l.opts || {}), l => Number(l.qty) || 0, (sv, l) => ({ ...sv, qty: l.qty }));
  else cart.forEach(l => { const m = acart.find(x => x.key === l.key); if (m) m.qty = Math.max(m.qty, l.qty); else acart.push(l) });
  cart = acart;
  let aad = Array.isArray(profile.addresses) ? profile.addresses : [];
  if (own && cartDirty0 === true) aad = addrs;
  else if (own) aad = mergeEdits(aad, addrs0, addrs, a => a.id);
  else addrs.forEach(a => { if (!aad.some(x => x.id === a.id)) aad.push(a) });
  addrs = aad;
  const okId = id => id && addrs.some(a => a.id === id);
  activeAddr = okId(profile.active_addr) ? profile.active_addr : okId(activeAddr) ? activeAddr : (addrs[0] ? addrs[0].id : null);
  lsSet('mir_cart', cart); lsSet('mir_addrs', addrs); lsSet('mir_addr_active', activeAddr); lsSet('mir_engaged', true);
  const af = Array.isArray(profile.favorites) ? profile.favorites.map(String) : null, fl = favs.size;
  if (af) {
    if (own && favDirty0 === true) { /* تعديل قديم ما وصلش: الجهاز هو الصح */ }
    else if (own) { const nf = mergeEdits(af.map(id => ({ id })), [...favs0].map(id => ({ id: String(id) })), [...favs].map(id => ({ id: String(id) })), x => x.id); favs.clear(); nf.forEach(x => favs.add(x.id)) }
    else af.forEach(id => favs.add(id));
    lsSet('mir_favs', [...favs]);
    if (favs.size !== af.length || [...favs].some(id => !af.includes(String(id))) || (fl && !own)) syncFavs(); else lsSet('mir_fav_dirty', false);
  }
  lsSet('mir_owner', user.id);   // v70: نسخة الجهاز توا نسخة من هذا الحساب
  document.querySelectorAll('[data-fav]').forEach(b => b.classList.toggle('on', favs.has(b.dataset.fav)));
  updateBadge(); updateDlv(); syncProfile(true); loadNotes();
  // v70 (رقم 5): الصفحة اللي قدامها انرسمت قبل ما يوصل الحساب ← تنعاد بالبيانات الصحيحة
  try { if (view === 'cart') renderCartView(); else if (view === 'account') renderAccount(); else if (view === 'favs') renderFavs() } catch (e) {}
}
/* المفضلة: في حساب الزبونة (تتجمع مع اللي في التلفون أول ما تسجّل دخول) */
const favList = () => [...favs].map(id => byId(id)).filter(p => p && p.active !== false);
function syncFavs() {
  if (!user) return;
  lsSet('mir_fav_dirty', true);   // v70: تعديل ما وصلش للسيرفر (ينشال لما يوصل)
  if (!profile) return;
  const g = ++favGen;
  uapi(`/rest/v1/profiles?id=eq.${user.id}`, { method: 'PATCH', headers: JH, body: JSON.stringify({ favorites: [...favs].slice(0, 200) }) }).then(() => { if (g === favGen) lsSet('mir_fav_dirty', false) }).catch(() => {});
}
function renderFavs() {
  const g = document.getElementById('favgrid'); if (!g) return;
  const list = favList();
  g.innerHTML = list.length ? gridHTML('fav', list) : `<p class="empty">لا توجد منتجات في المفضلة.</p>`; armGrids(g);
}
let syncGen = 0, favGen = 0;   // v70: العلامة تنشال بس لو آخر تعديل هو اللي وصل (تعديل جديد وقت الإرسال يقعد معلّم)
function syncProfile(now) {
  if (!user) return;
  if (!profile) return;
  clearTimeout(syncT);
  syncT = setTimeout(() => { const g = ++syncGen; uapi(`/rest/v1/profiles?id=eq.${user.id}`, { method: 'PATCH', headers: JH,
    body: JSON.stringify({ cart: cart.slice(0, 60), addresses: addrs.slice(0, 20), active_addr: activeAddr }) })
    .then(() => { if (g === syncGen) lsSet('mir_cart_dirty', false) }).catch(() => {}) }, now ? 0 : 700);
}
/* v70: الدمج: «اللي تغيّر في الجلسة هذي» (بين نسخة الفتح والنسخة توا) يتطبّق فوق نسخة السيرفر.
   المحذوف يقعد محذوف، والكمية اللي تبدلت تقعد، والجديد يتضاف. by = مفتاح السطر، sig = اللي يعتبر «تعديل» (الكمية في السلة بس:
   الاسم والسعر تتحدّث لحالها من الكتالوج، فما تتحسبش تعديل)، take = كيف يتطبّق التعديل على سطر السيرفر */
function mergeEdits(server, base, now, by, sig = x => JSON.stringify(x), take = (sv, x) => x) {
  const out = server.map(x => ({ ...x })), b = new Map(base.map(x => [by(x), x])), n = new Map(now.map(x => [by(x), x]));
  const at = k => out.findIndex(x => by(x) === k);
  for (const [k, x] of b) {
    if (!n.has(k)) { const i = at(k); if (i >= 0) out.splice(i, 1) }                                   // انحذف في الجلسة
    else if (sig(n.get(k)) !== sig(x)) { const i = at(k); if (i >= 0) out[i] = take(out[i], n.get(k)); else out.push(n.get(k)) }   // تبدّل
  }
  for (const [k, x] of n) if (!b.has(k)) { const i = at(k); if (i < 0) out.push(x); else if (x.qty != null && out[i].qty != null) out[i].qty = Math.max(out[i].qty, x.qty) }   // انضاف
  return out;
}
function localSignOut() {
  try { pf.me = null; pfLastSet(null); lsSet(CVT_K, null) } catch (e) {}   // v47 (v86: + آخر كود؛ v87: + التلفون)
  user = null; profile = null; lsSet('mir_user', null); favs.clear(); lsSet('mir_favs', []); lsSet('mir_owner', null); lsSet('mir_fav_dirty', false); lsSet('mir_payafter', null);   // v70
  cart = []; addrs = []; activeAddr = null; notes = [];
  lsSet('mir_cart', []); lsSet('mir_addrs', []); lsSet('mir_addr_active', null); lsSet('mir_engaged', false);
  DEV = newId(); lsSet('mir_dev', DEV); setTimeout(() => pushSync(true), 500);   // v98: بعد الخروج: إشعارات الحساب ما توصلش للجهاز
  // v41: طلبات وتذاكر الحساب القديم ما تبانش لحساب ثاني على نفس الجهاز
  myOrders = []; ordersLoaded = false; oFilter = 'all'; ordSig = ''; lsSet(ORD_K, null); lsSet('mir_tk', null); lsSet('mir_tkth', null);   // v91: التذاكر المحفوظة
  ['ordv', 'mytk'].forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = '' });
  dotsPaint();   // v104: نقاط الحساب القديم تنطفي
  // v56: حجز ودفع وعقوبة الحساب القديم ما يقعدوش على الشاشة (كلها محفوظة في السيرفر وترجع لما يدخل)
  clearInterval(holdT); holdEnd = 0; holdOver = false; state.mineEnd = 0; heldSet(null); qClear();
  pay = null; state.payp = null; payDrop = null; ckItems = null; ckLast = null; ckKey = null; state.st = 0; state.limS = null;
  lsSet('mir_paygo', null); lsSet('mir_paylast', null); lsSet('mir_cart_dirty', false); dlvSet(0);   // v61: طريقة الاستلام متاعه ما تقعدش لحساب ثاني
  penEnd = 0; clearInterval(penT); payLow = { t: null, ids: new Set() };
  try { payBanner() } catch (e) {}
  updateBadge(); updateDlv(); updateBell();
}
async function signOut() {
  if (ckOpen()) return leaveAsk('out');   // v97: طلب لم يكتمل ← التنبيه بالعداد
  if (!(await ask('تسجيل الخروج', 'هل تريدين تسجيل الخروج من حسابك؟', 'تسجيل الخروج'))) return;
  signOutNow();
}
function signOutNow() {
  const tok = user && user.access_token;
  if (tok) api('/auth/v1/logout?scope=local', { method: 'POST', headers: { Authorization: 'Bearer ' + tok } }).catch(() => {});   // v50: هذا الجهاز بس (اللوحة ما تطلعش)
  localSignOut(); go('home'); showAuth('welcome');
}

/* ===== account page ===== */
function setTheme(t) {
  phone.dataset.theme = t; lsSet('mir_theme', t);
  document.documentElement.classList.toggle('sp-dark', t === 'dark');   // v83: شاشة الشعار (والتسخينة) تتبع الوضع بعد التبديل، مش بس وقت الفتح
  if (t === 'dark' && window.__app) { try { new Image().src = '/logo-hd-dark.webp?v=1' } catch (e) {} }   // v83: الشعار الليلي جاهز قبل أول تسخينة
  document.querySelector('meta[name=theme-color]').content = t === 'dark' ? '#141110' : '#FBF9F7';
  const cs = document.querySelector('meta[name=color-scheme]'); if (cs) cs.content = t === 'dark' ? 'dark' : 'only light';   // v103: Chrome ما يغمّقش المتجر بروحه
}
setTheme(lsGet('mir_theme', 'light'));
const arow = (act, icon, label, extra, cls) => `<button class="arow ${cls || ''}" ${act}><span class="ai">${ic(icon)}</span><span class="at">${label}</span>${extra === undefined ? `<span class="ach">${ic('back')}</span>` : extra}</button>`;
function renderAccount() {
  const box = document.getElementById('accv'), dark = phone.dataset.theme === 'dark';
  const settings = `<p class="agrp-t">الإعدادات</p><div class="agrp">
      ${arow('data-themetog', 'moon', 'الوضع الليلي', `<span class="sw ${dark ? 'on' : ''}" role="switch" aria-checked="${dark}"><i></i></span>`)}
      ${arow('data-soundtog', 'bell', 'صوت الإشعارات', `<span class="sw ${soundOn() ? 'on' : ''}" role="switch" aria-checked="${soundOn()}"><i></i></span>`)}
      ${PUSH_OK ? arow('data-pushtog', 'bell', 'إشعارات خارج التطبيق', `<span class="sw ${pushOn() ? 'on' : ''}" role="switch" aria-checked="${pushOn()}"><i></i></span>`) : ''}
      ${user ? arow('data-acc="password"', 'lock', 'تغيير كلمة السر') : ''}</div>`;
  const about = `<p class="agrp-t">عن المتجر</p><div class="agrp">
      ${arow('data-acc="faq"', 'chat', 'الأسئلة الشائعة')}
      ${arow('data-acc="privacy"', 'shield', 'سياسة الخصوصية')}
      ${arow('data-acc="returns"', 'swap', 'سياسة الاسترجاع والاستبدال')}</div>`;
  if (!user) {
    box.innerHTML = `<div class="acc-guest"><span class="logo-img" role="img" aria-label="Miracles"></span><h3>أهلاً بك في Miracles</h3>
      <p>تسجيل الدخول يحفظ السلة والعناوين والطلبات.</p>
      <button class="cta" data-auth="login">تسجيل الدخول</button><button class="cta ghost" data-auth="signup">إنشاء حساب</button></div>` + settings + about;
    return;
  }
  const unread = notes.filter(n => !n.read_at).length;
  // v70: بانر «أهلاً بك» انشال (طلب معتز): الصفحة تبدا من «بياناتي» تحت العنوان مباشرة
  box.innerHTML = `<div class="agrp">
      ${arow('data-acc="profile"', 'user', 'بياناتي')}
      ${arow('data-addr', 'pin', 'عناويني')}
      ${arow('data-acc="tickets"', 'ticket', 'تذاكر الدعم وخدمة العملاء')}
      ${arow('data-notes', 'bell', 'الإشعارات', unread ? `<span class="bell-badge on" style="position:static;box-shadow:none">${unread}</span>` : undefined)}</div>`
    + settings + about +
    `<div class="agrp">${arow('data-acc="logout"', 'logout', 'تسجيل الخروج', '')}${arow('data-acc="delete"', 'trash', 'حذف الحساب', '', 'red')}</div>`;
}
/* صفحات السياسات (نفس التصميم) */
const POLICIES = {
  privacy: ['سياسة الخصوصية', '', [
    ['user', 'البيانات التي نجمعها', '<p>الاسم ورقم الهاتف والبريد الإلكتروني، وعناوين التوصيل وموقعها إن حددتِه، ومحتوى السلة، ورسائل الدعم.</p>'],
    ['info', 'لماذا نستخدمها', '<p>لتجهيز طلباتكِ وتوصيلها، والتواصل معكِ بخصوصها، والرد على استفساراتكِ، وإرسال إشعارات طلباتكِ.</p>'],
    ['shield', 'حماية بياناتكِ', '<p>كلمة السر محفوظة بشكل مشفّر ولا يطّلع عليها أحد، ولا نبيع بياناتكِ أو نشاركها مع أي جهة إلا لغرض التوصيل، أو مع إيزون باي (الاسم ورقم الهاتف) لإتمام الدفع.</p>'],
    ['lock', 'الدفع', '<p>لا نحتفظ ببيانات بطاقتكِ أو حسابكِ المصرفي، وتتم عمليات الدفع عبر صفحة الدفع الآمنة لدى إيزون باي.</p>'],
    ['trash', 'حذف بياناتكِ', '<p>يمكنكِ حذف حسابكِ وجميع بياناتكِ في أي وقت من «حسابي» ← «حذف الحساب».</p><p>ويُحتفظ بسجلات الطلبات (الاسم ورقم الهاتف والعنوان) لأغراض محاسبية ولحل أي خلاف يتعلق بالطلب أو الدفع.</p>']]],   // v67 (ب6)
  returns: ['سياسة الاسترجاع والاستبدال', 'رضاكِ يهمنا، وهذه شروط الاسترجاع والاستبدال في متجرنا.', [
    ['clock', 'المدة', '<p>يمكنكِ طلب الاسترجاع أو الاستبدال خلال <b>48 ساعة</b> من تاريخ استلام الطلب.</p>'],
    ['check', 'متى يحق لكِ ذلك؟', '<ul><li>إذا لم يكن المنتج كما توقعتِ.</li><li>إذا وصلكِ المنتج تالفاً أو به خلل.</li></ul><p>بشرط أن يُعاد المنتج بنفس الحالة التي استلمتِه بها.</p>'],
    ['swap', 'الخيارات المتاحة', '<p>استرجاع المبلغ كاملاً، أو استبدال المنتج بآخر.</p>'],
    ['info', 'تعذّر توفير المنتج', '<p>إذا تعذّر توفير منتج بعد طلبكِ، نتواصل معكِ فوراً لاستبداله أو استرجاع المبلغ كاملاً.</p>'],
    ['chat', 'طريقة الطلب', '<p>تواصلي معنا من «حسابي ← تذاكر الدعم وخدمة العملاء» أو عبر واتساب، مع ذكر رقم الطلب.</p>']]]
};
function openPolicy(kind, back) {
  const [title, intro, secs] = POLICIES[kind];
  const backBtn = back === 'ck' ? '<button class="cta ghost" data-polback="ck">العودة إلى تأكيد الطلب</button>'
    : back && back.startsWith('rcpt:') ? `<button class="cta ghost" data-polback="${esc(back)}">العودة إلى الإيصال</button>` : '';
  openSheet('bottom', `<h3>${title}</h3><div class="policy">${intro ? `<p class="pintro">${intro}</p>` : ''}
    ${secs.map(([icn, h, body]) => `<div class="ps"><span>${ic(icn)}</span><div><h4>${h}</h4>${body}</div></div>`).join('')}</div>${backBtn}`);
}
function policyBack(b) {
  if (b === 'ck') return cancelBack();
  if (b.startsWith('rcpt:')) return openReceipt(b.slice(5));
}
function accAction(a, btn) {
  if (a === 'faq') { go('support'); document.getElementById('faq').hidden = false; goSection('faq'); return }
  if (a === 'wa') { const u = waLink('مرحباً، لدي استفسار'); return u ? window.open(u, '_blank') : toast('سيتم تفعيل التواصل قريباً') }
  if (a === 'privacy' || a === 'returns') return openPolicy(a);
  if (!user) return needLogin(() => accAction(a));
  if (a === 'tickets') { go('support'); return }   // v58: تفتح من فوق (ما تنزلش لـ«تذاكري»)
  if (a === 'profile') return pfOpen(undefined, btn);   // v89: الزر يبهت
  if (a === 'pwforgot') return pwForgot(btn);
  if (a === 'saveprofile') return saveProfileForm(btn);
  if (a.startsWith('pf:')) { const [, op, mode] = a.split(':'); return pfStart(op, mode, btn) }   // v47
  if (a.startsWith('pfway:')) return pfSendId(a.slice(6), btn);
  if (a === 'pfidok') return pfIdVerify(btn);
  if (a === 'pfnew') return pfNewSubmit(btn);
  if (a === 'pfnewok') return pfNewVerify(btn);
  if (a.startsWith('pfresend:')) return pfResend(a.slice(9), btn);
  if (a === 'pwok') return pwVerify(btn);
  if (a === 'password') return pwOpen(btn);   // v89
  if (a === 'password-old') return openSheet('bottom', `<h3>تغيير كلمة السر</h3>
    <label class="field">كلمة السر الحالية<input id="np0" type="password" autocomplete="current-password" dir="ltr" style="text-align:right" maxlength="72"></label>
    <button type="button" class="au-forgot" style="margin:-4px 0 16px" data-acc="pwforgot">نسيت كلمة السر؟</button>
    <label class="field">كلمة السر الجديدة<input id="np1" type="password" autocomplete="new-password" dir="ltr" style="text-align:right" maxlength="72"></label>
    <label class="field">تأكيد كلمة السر<input id="np2" type="password" autocomplete="new-password" dir="ltr" style="text-align:right" maxlength="72"></label>
    <button class="cta" data-acc="savepass">حفظ كلمة السر</button>`);
  if (a === 'savepass') return savePassword(btn);
  if (a === 'logout') return signOut();
  if (a === 'delete') return openSheet('bottom', `<div class="lp"><div class="lp-ic" style="background:var(--danger-bg)">${ic('trash')}</div><h3>حذف الحساب نهائياً؟</h3>
    <p>سيتم حذف حسابك وبياناتك وعناوينك وتذاكر الدعم. لا يمكن التراجع عن هذه الخطوة.</p>
    <button class="cta" style="background:#B42318;color:#fff" data-acc="confirmdelete">نعم، احذفي حسابي</button><button class="lp-later" data-close>إلغاء</button></div>`);
  if (a === 'confirmdelete') return deleteAccount(btn);
}
async function saveProfileForm(btn) {   // v47: الاسم بس (الرقم والإيميل بكود)
  const name = document.getElementById('pf-name').value.trim().replace(/\s+/g, ' ');
  if (name.replace(/\s/g, '').length < 2) return toast('يُرجى إدخال الاسم (حرفان على الأقل).');
  if (name.length > NAME_MAX) return toast(NAME_MSG);
  if (name === (profile && profile.full_name || '')) return toast('لا توجد تغييرات.');
  btn.disabled = true;
  try { await uapi(`/rest/v1/profiles?id=eq.${user.id}`, { method: 'PATCH', headers: JH, body: JSON.stringify({ full_name: name }) }); profile.full_name = name; btn.disabled = false; renderAccount(); toast('تم حفظ الاسم') }
  catch (e) { btn.disabled = false; toast(/name_too_long/.test(String(e && e.message)) ? NAME_MSG : 'تعذر الحفظ.') }
}
async function savePassword(btn) {
  const c = document.getElementById('np0').value, a = document.getElementById('np1').value, b = document.getElementById('np2').value;
  if (!c) return toast('يُرجى إدخال كلمة السر الحالية.');
  if (!pwStrong(a)) return toast(PW_MSG);
  if (a !== b) return toast('كلمتا السر غير متطابقتين');
  btn.disabled = true; const g = shGen;
  await uEnsure();   // v56: من auth-code (كلمة السر في Supabase بصمة)
  const r = await authCode({ action: 'pass-old', current: c, password: a }, user && user.access_token);
  if (shGone(g)) { if (r.ok) toast('تم تغيير كلمة السر'); return }   // v85
  if (r.ok) { closeSheet(); return toast('تم تغيير كلمة السر') }
  btn.disabled = false;
  toast(r.error === 'current_password' ? 'كلمة السر الحالية غير صحيحة' : r.error === 'same_password' ? 'كلمة السر الجديدة مطابقة للقديمة.' : r.error === 'password' ? PW_MSG : r.error === 'too_many' ? 'محاولات كثيرة، يُرجى المحاولة بعد قليل.' : 'تعذر تغيير كلمة السر.');
}
/* نسيت كلمة السر من داخل الحساب: كود على البريد ← نفس شاشة كلمة السر الجديدة */
async function pwForgot(btn) {   // v46: نفس «نسيت كلمة السر» (SMS أو الإيميل)، بالرقم أو الإيميل المسجّل
  if (!user) return;
  rs.id = (profile && profile.phone) || realEmail(user.email); if (!rs.id) return;
  closeSheet(); showAuth('forgot');
  setTimeout(() => document.getElementById('au-form')?.requestSubmit(), 30);
}
/* ===== v47: «بياناتي»: الرقم والإيميل مخفيين بنجوم، والتأكيد والتغيير وكلمة السر بكود (دالة auth-code) =====
   pf.me: {phone, ph_ok, sms_ok, email, em_ok}
   pf.op: 'phone' | 'email' | 'pass'، pf.mode: 'add' | 'confirm' | 'change'
   التغيير: كود على طريقة متأكَّدة (ticket) ← الرقم/الإيميل الجديد ← كود عليه */
const pf = { me: null, op: '', mode: '', ticket: '', ch: '', val: '', to: '', at: 0, busy: false, last: null };
/* v87: pf.last ينحفظ في التلفون كمان (mir_pflast + رقم الحساب، بدون الكود): يقعد بعد ما التطبيق يتسكّر */
/* v96 (معتز): آخر كود **لكل نوع وطريقة لحالها** (كان آخر كود بس: SMS ثم الإيميل ثم الرجوع لـ SMS ← طلب جديد ← «يُرجى الانتظار 5 دقائق»).
   pf.last = { 'acct|sms': {op, ch, to, at}, 'acct|email': … }؛ pfLastSet(null) = مسح الكل (الدخول/الخروج) */
const pfLK = (op, ch) => op + '|' + ch;
function pfLastSave() { const m = pf.last || {}; lsSet('mir_pflast', user && Object.keys(m).length ? { uid: user.id, m } : null) }
function pfLastSet(x) { if (!x) { pf.last = null; return pfLastSave() } pf.last = { ...pfLastAll(), [pfLK(x.op, x.ch)]: { op: x.op, ch: x.ch, to: x.to, at: x.at } }; pfLastSave() }
function pfLastDel(op, ch) { const m = { ...pfLastAll() }; delete m[pfLK(op, ch)]; pf.last = m; pfLastSave() }
function pfLastAll() {
  if (pf.last) return pf.last;
  const x = lsGet('mir_pflast', null);
  if (x && user && x.uid === user.id && x.m && typeof x.m === 'object') return (pf.last = x.m);
  return {};   // ما ينحفظش في الذاكرة (الحساب ممكن ما تحمّلش بعد)
}
function pfLastGet(op, ch) { const L = pfLastAll()[pfLK(op, ch)]; return L && Date.now() - L.at < CODE_GAP ? L : null }   // v86: last = آخر كود هوية/كلمة سر {op, ch, to, at} لين يُستعمل
const codeField = (id, label) => `<label class="field">${label}<input id="${id}" type="text" inputmode="numeric" autocomplete="one-time-code" dir="ltr" style="text-align:center;letter-spacing:6px;font-size:20px" maxlength="6" placeholder="••••••"></label>`;
const pfWays = () => { const m = pf.me || {}; return { sms: m.ph_ok && m.sms_ok ? maskPhone(m.phone) : null, email: m.em_ok && m.email ? maskEmail(m.email) : null } };
const acCall = async body => { try { await uEnsure() } catch (e) { return { ok: false, error: 'auth' } } return authCode(body, user.access_token) };
const pfErr = r => r && r.error === 'ticket' ? 'انتهت المهلة. يُرجى البدء من جديد.' : r && r.error === 'auth' ? 'انتهت الجلسة، يُرجى تسجيل الدخول من جديد.' : codeErr(r);
async function pfLoad() {
  const r = await acCall({ action: 'me' });
  if (r.ok) pf.me = r;
  return r.ok;
}
async function pfOpen(msg, btn) {
  if (!pf.me) {
    if (offline()) return toast(NETMSG);   // v89
    const free = tapBusy(btn), L = lazySheet(`<h3>بياناتي</h3><p class="sub-note">لحظة...</p>`);   // v89: «لحظة» بس لو طوّل
    const ok = await pfLoad(); L.stop(); free();
    if (L.gone()) return;   // v85: سكّرت النافذة (أو فتحت حاجة ثانية) وهي تستنى ← ما تنفتحش في وجهها
    if (!ok) { L.close(); return toast(NETMSG) }
  }
  const m = pf.me;   // v49: بدون «مؤكد/غير مؤكد» (الرقم يتأكد في التسجيل، والإيميل يتضاف بكود)
  const ph = m.phone ? `<div class="pf-it"><div class="pf-k">رقم الهاتف</div><div class="pf-v"><b dir="ltr">${esc(maskPhone(m.phone))}</b></div>
      <div class="pf-acts"><button type="button" class="pf-b" data-acc="pf:phone:change">تغيير رقم الهاتف</button></div></div>` : '';
  const em = m.email ? `<div class="pf-it"><div class="pf-k">البريد الإلكتروني</div><div class="pf-v"><b dir="ltr">${esc(maskEmail(m.email))}</b></div>
      <div class="pf-acts"><button type="button" class="pf-b" data-acc="pf:email:change">تغيير البريد الإلكتروني</button></div></div>`
    : `<div class="pf-it"><div class="pf-k">البريد الإلكتروني</div><div class="pf-acts"><button type="button" class="pf-b" data-acc="pf:email:add">إضافة بريد إلكتروني</button></div></div>`;
  openSheet('bottom', `<h3>بياناتي</h3>
    <label class="field">الاسم<input id="pf-name" maxlength="15" value="${esc(profile && profile.full_name || '')}"></label>
    <button class="cta ghost pf-save" data-acc="saveprofile">حفظ الاسم</button>
    ${ph}${em}${msg ? `<p class="pf-ok">${esc(msg)}</p>` : ''}`);
}
/* بداية: تأكيد / إضافة / تغيير */
async function pfStart(op, mode, btn) {
  Object.assign(pf, { op, mode, ticket: '', ch: '', val: '', to: '' });
  if (mode === 'add') return pfNewStep();
  // v49: الرقم يتغير بكود على الرقم الحالي، والإيميل بكود على الإيميل الحالي (لو مش موجود: الطريقة الثانية)
  const w = pfWays(), ch = op === 'phone' ? (w.sms ? 'sms' : w.email ? 'email' : '') : (w.email ? 'email' : w.sms ? 'sms' : '');
  if (!ch) return pfNewStep();   // ما عندهاش طريقة متأكَّدة: مباشرة
  return pfSendId(ch, btn);
}
const pfTitle = () => pf.op === 'pass' ? 'تغيير كلمة السر' : pf.op === 'phone' ? (pf.mode === 'confirm' ? 'تأكيد رقم الهاتف' : 'تغيير رقم الهاتف') : pf.mode === 'add' ? 'إضافة بريد إلكتروني' : pf.mode === 'confirm' ? 'تأكيد البريد الإلكتروني' : 'تغيير البريد الإلكتروني';
function pfPick(err) {
  const w = pfWays();
  openSheet('bottom', `<h3>${pfTitle()}</h3><p class="sub-note">${pf.op === 'pass' ? 'اختاري طريقة استلام كود التحقق.' : 'للتحقق من هويتك، اختاري طريقة استلام الكود.'}</p>
    <button type="button" class="au-way" data-acc="pfway:sms">${ic('chat')}<span><b>إرسال الكود برسالة SMS</b><small dir="ltr">${esc(w.sms)}</small></span></button>
    <button type="button" class="au-way" data-acc="pfway:email">${ic('mail')}<span><b>إرسال الكود إلى البريد الإلكتروني</b><small dir="ltr">${esc(w.email)}</small></span></button>
    <p class="au-err" id="pf-err">${esc(err || '')}</p>`);
}
/* v89: خانة الخطأ بس لو النافذة مفتوحة (كانت تكتب في نافذة مسكّرة ← ولا رسالة) */
const pfFail = (btn, m) => { const e = sheet.classList.contains('on') && sheet.querySelector('#pf-err'); if (e) e.textContent = m; else toast(m); if (btn) { btn.disabled = false; btn.classList.remove('busy') } return false };
const pfBusy = btn => { if (btn) { btn.disabled = true; btn.classList.add('busy') } };
/* كود الهوية (أو كود كلمة السر) على طريقة متأكَّدة */
async function pfSendId(ch, btn, force) {
  /* v86: نفس الطلب (نفس النوع والطريقة) خلال 5 دقائق من آخر كود ما استُعملش: شاشة الكود مباشرة (الكود اللي وصل صالح 10 دقائق)
     بدل ما نطلبوا كود جديد ويرفض السيرفر («انتظر 5 دقائق») وتتسكّر النافذة. زر «إعادة الإرسال» عليه العداد الباقي (pf.at) */
  const L = pfLastGet(pf.op, ch);   // v87: من الذاكرة أو التلفون (v96: لكل طريقة لحالها)
  if (!force && L) {
    Object.assign(pf, { ch, to: L.to, at: L.at });
    pf.op === 'pass' ? pwCodeStep() : pfIdStep();
    return true;
  }
  pfBusy(btn); const g = shGen, on0 = sheet.classList.contains('on');   // v89: ممكن يبدا والشاشة ما فيهاش نافذة («لحظة» المتأخرة)
  const r = await acCall({ action: pf.op === 'pass' ? 'pass-send' : 'acct-send', channel: ch, for: pf.op });
  if (r.ok) pfLastSet({ op: pf.op, ch, to: r.to, at: Date.now() });   // v86 (v87: + التلفون)
  if (g !== shGen || (on0 && !sheet.classList.contains('on'))) { if (r.ok) Object.assign(pf, { ch, to: r.to, at: Date.now() }); return 'gone' }   // v85: سكّرت وهي تستنى: الكود وصل (لو نجح) بس النافذة ما تنفتحش
  if (!r.ok) return pfFail(btn, pfErr(r));
  Object.assign(pf, { ch, to: r.to, at: Date.now() });
  pf.op === 'pass' ? pwCodeStep() : pfIdStep();
  return true;
}
function pfIdStep(err) {
  openSheet('bottom', `<h3>${pfTitle()}</h3>
    <p class="sub-note">للتحقق من هويتك، أرسلنا كوداً إلى <b dir="ltr">${esc(pf.to)}</b>.${pf.ch === 'email' ? ' إذا لم تجديه، تفقّدي البريد المزعج (Spam).' : ''}</p>
    ${codeField('pf-code', 'الكود')}
    <p class="au-err" id="pf-err">${esc(err || '')}</p>
    <button class="cta" data-acc="pfidok">متابعة</button>
    <div class="au-links col"><button type="button" class="au-forgot" data-acc="pfresend:id" data-rs="pf">إعادة إرسال الكود</button></div>${rsdQ()}`);
  setTimeout(() => document.getElementById('pf-code')?.focus(), 60);
}
async function pfIdVerify(btn) {
  const code = digits((document.getElementById('pf-code') || {}).value || '');
  if (!/^\d{6}$/.test(code)) return pfFail(null, 'يُرجى إدخال الكود المرسل إليكِ (6 أرقام).');
  pfBusy(btn); const g = shGen;
  const r = await acCall({ action: 'acct-verify', channel: pf.ch, code, for: pf.op });
  if (shGone(g)) return;   // v85
  if (r.ok && r.ticket) pfLastDel(pf.op, pf.ch);   // v86: الكود اتستعمل (v96: هذي الطريقة بس)
  if (!r.ok || !r.ticket) return pfFail(btn, pfErr(r));
  pf.ticket = r.ticket; pfNewStep();
}
/* الرقم/الإيميل الجديد */
function pfNewStep(err) {
  const isPh = pf.op === 'phone';
  openSheet('bottom', `<h3>${pfTitle()}</h3>
    <p class="sub-note">${isPh ? 'سيصل كود تحقق إلى الرقم الجديد.' : 'سيصل كود تحقق إلى البريد الإلكتروني.'}</p>
    ${isPh ? `<label class="field">رقم الهاتف الجديد<input id="pf-new" type="tel" inputmode="tel" autocomplete="tel" dir="ltr" style="text-align:right" maxlength="20" placeholder="09XXXXXXXX" value="${esc(pf.val)}"></label>`
      : `<label class="field">${pf.mode === 'add' ? 'البريد الإلكتروني' : 'البريد الإلكتروني الجديد'}<input id="pf-new" type="email" inputmode="email" autocomplete="email" dir="ltr" style="text-align:right" autocapitalize="off" spellcheck="false" maxlength="254" value="${esc(pf.val)}"></label>`}
    <p class="au-err" id="pf-err">${esc(err || '')}</p>
    <button class="cta" data-acc="pfnew">إرسال كود التحقق</button>`);
  setTimeout(() => document.getElementById('pf-new')?.focus(), 60);
}
async function pfNewSubmit(btn) {
  const raw = toEn(((document.getElementById('pf-new') || {}).value || '').trim());
  if (pf.op === 'phone') {
    if (!lyPhone(raw)) return pfFail(null, 'رقم الهاتف غير صحيح');
    if (normPh(raw) === pf.me.phone) return pfFail(null, 'هذا هو رقمك الحالي.');
    pf.val = normPh(raw);
  } else {
    const v = raw.toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return pfFail(null, 'البريد الإلكتروني غير صحيح');
    if (v === String(pf.me.email || '').toLowerCase()) return pfFail(null, 'هذا هو بريدك الحالي.');
    pfBusy(btn); const g = shGen;
    const chk = await checkEmail(v);
    if (shGone(g)) return;   // v85
    if (chk.bad) return pfFail(btn, chk.bad);
    if (chk.fix && pf.val !== v) { pf.val = v; return pfFail(btn, `${chk.why} ${chk.fix}`) }
    pf.val = v;
  }
  return pfSendNew(btn);
}
async function pfSendNew(btn) {
  pfBusy(btn); const g = shGen;
  const isPh = pf.op === 'phone';
  const r = await acCall({ action: isPh ? 'phone-send' : 'email-send', [isPh ? 'phone' : 'email']: pf.val, ticket: pf.ticket || undefined });
  if (shGone(g)) { if (r.ok) Object.assign(pf, { to: r.to, at: Date.now() }); return 'gone' }   // v85
  if (!r.ok) {
    if (r.error === 'ticket') { pf.ticket = ''; return pfFail(btn, pfErr(r)) }
    return pfFail(btn, r.error === 'phone_taken' ? 'رقم الهاتف مسجّل لحساب آخر.' : r.error === 'email_taken' ? 'البريد الإلكتروني مسجّل لحساب آخر.' : pfErr(r));
  }
  Object.assign(pf, { to: r.to, at: Date.now() }); pfNewCodeStep();
  return true;
}
function pfNewCodeStep(err) {
  openSheet('bottom', `<h3>${pfTitle()}</h3>
    <p class="sub-note">أرسلنا الكود إلى <b dir="ltr">${esc(pf.to)}</b>.${pf.op === 'email' ? ' إذا لم تجديه، تفقّدي البريد المزعج (Spam).' : ''}</p>
    ${codeField('pf-code', 'الكود')}
    <p class="au-err" id="pf-err">${esc(err || '')}</p>
    <button class="cta" data-acc="pfnewok">تأكيد</button>
    <div class="au-links col"><button type="button" class="au-forgot" data-acc="pfresend:new" data-rs="pf">إعادة إرسال الكود</button></div>${rsdQ()}`);
  setTimeout(() => document.getElementById('pf-code')?.focus(), 60);
}
async function pfNewVerify(btn) {
  const code = digits((document.getElementById('pf-code') || {}).value || '');
  if (!/^\d{6}$/.test(code)) return pfFail(null, 'يُرجى إدخال الكود المرسل إليكِ (6 أرقام).');
  pfBusy(btn);
  const isPh = pf.op === 'phone';
  const g = shGen;
  const r = await acCall({ action: isPh ? 'phone-verify' : 'email-verify', [isPh ? 'phone' : 'email']: pf.val, ticket: pf.ticket || undefined, code });
  if (shGone(g) && !r.ok) return;   // v85: سكّرت وفشل ← ولا حاجة. (نجح ← pfDone يحدّث البيانات ويطلع رسالة بدل النافذة)
  if (!r.ok) return pfFail(btn, r.error === 'phone_taken' ? 'رقم الهاتف مسجّل لحساب آخر.' : r.error === 'email_taken' ? 'البريد الإلكتروني مسجّل لحساب آخر.' : pfErr(r));
  if (isPh) return pfDone({ phone: r.phone, ph_ok: true, sms_ok: true }, pf.mode === 'confirm' ? 'تم تأكيد رقم الهاتف.' : 'تم تغيير رقم الهاتف.', shGone(g));
  return pfDone({ email: r.email, em_ok: true }, pf.mode === 'confirm' ? 'تم تأكيد البريد الإلكتروني.' : pf.mode === 'add' ? 'تمت إضافة البريد الإلكتروني.' : 'تم تغيير البريد الإلكتروني.', shGone(g));
}
function pfDone(x, msg, quiet) {   // v85: quiet = النافذة تسكّرت وهي تستنى ← رسالة بس (ما تنفتحش «بياناتي» في وجهها)
  Object.assign(pf.me, x); pf.ticket = '';
  if (x.phone && profile) profile.phone = x.phone;
  if (x.email) { user.email = x.email; lsSet('mir_user', user); if (profile) profile.email = x.email }
  if (quiet) toast(msg); else pfOpen(msg);
  if (view === 'account') renderAccount();
}
async function pfResend(which, btn) {
  const left = Math.ceil((pf.at + CODE_GAP - Date.now()) / 1000);
  if (left > 0) return toast(`يمكنكِ إعادة الإرسال بعد ${mmss(left)}`);
  if (which === 'id') { if ((await pfSendId(pf.ch, btn, true)) === true) toast('تم إرسال كود جديد'); return }   // v85: === true (مش 'gone')
  if ((await pfSendNew(btn)) === true) toast('تم إرسال كود جديد');
}
/* كلمة السر بكود (SMS أو الإيميل، اللي متأكَّد منه) */
async function pwOpen(btn) {
  const free = tapBusy(btn);
  try {
  if (!pf.me) {
    if (offline()) return toast(NETMSG);   // v89
    const L = lazySheet(`<h3>تغيير كلمة السر</h3><p class="sub-note">لحظة...</p>`);
    const ok = await pfLoad(); L.stop();
    if (L.gone()) return;   // v85: سكّرت ← ما تنفتحش، وما يتبعثش كود
    if (!ok) { L.close(); return toast(NETMSG) }
  }
  Object.assign(pf, { op: 'pass', mode: 'change', ticket: '', val: '' });
  const w = pfWays();
  if (!w.sms && !w.email) return accAction('password-old');   // ما عندهاش طريقة متأكَّدة: بكلمة السر الحالية زي قبل
  if (w.sms && w.email) return pfPick();
  const L = lazySheet(`<h3>تغيير كلمة السر</h3><p class="sub-note">لحظة...</p>`);   // v89 (كان: تنفتح فوراً)
  const r = await pfSendId(w.sms ? 'sms' : 'email'); L.stop();   // آخر كود خلال 5 د (v86/v87) ← شاشة الكود فوراً بدون نت
  if (!r) L.close();
  } finally { free() }
}
function pwCodeStep(err) {
  const pw = (id, label) => `<label class="field">${label}<span class="pw"><input id="${id}" type="password" autocomplete="new-password" dir="ltr" style="text-align:right" maxlength="72"><button type="button" class="eye" data-eye="${id}" aria-label="إظهار كلمة السر">${ic('eyeoff')}</button></span></label>`;
  openSheet('bottom', `<h3>تغيير كلمة السر</h3>
    <p class="sub-note">أرسلنا الكود إلى <b dir="ltr">${esc(pf.to)}</b>.${pf.ch === 'email' ? ' إذا لم تجديه، تفقّدي البريد المزعج (Spam).' : ''}</p>
    ${codeField('pf-code', 'الكود')}
    ${pw('np1', 'كلمة السر الجديدة')}
    ${pw('np2', 'تأكيد كلمة السر')}
    <p class="au-err" id="pf-err">${esc(err || '')}</p>
    <button class="cta" data-acc="pwok">حفظ كلمة السر</button>
    <div class="au-links col"><button type="button" class="au-forgot" data-acc="pfresend:id" data-rs="pf">إعادة إرسال الكود</button></div>${rsdQ()}`);
  setTimeout(() => document.getElementById('pf-code')?.focus(), 60);
}
async function pwVerify(btn) {
  const code = digits((document.getElementById('pf-code') || {}).value || ''), a = document.getElementById('np1').value, b = document.getElementById('np2').value;
  if (!/^\d{6}$/.test(code)) return pfFail(null, 'يُرجى إدخال الكود المرسل إليكِ (6 أرقام).');
  if (!pwStrong(a)) return pfFail(null, PW_MSG);
  if (a !== b) return pfFail(null, 'كلمتا السر غير متطابقتين');
  pfBusy(btn); const g = shGen;
  const r = await acCall({ action: 'pass-verify', channel: pf.ch, code, password: a });
  if (r.ok) pfLastDel('pass', pf.ch);   // v86: الكود اتستعمل (v96: هذي الطريقة بس)
  if (shGone(g)) { if (r.ok) toast('تم تغيير كلمة السر'); return }   // v85: سكّرت وهي تستنى ← ما نسكّروش نافذة ثانية فتحتها
  if (!r.ok) return pfFail(btn, r.error === 'same_password' ? 'كلمة السر الجديدة مطابقة للقديمة.' : r.error === 'password' ? PW_MSG : pfErr(r));
  closeSheet(); toast('تم تغيير كلمة السر');
}
async function deleteAccount(btn) {
  btn.disabled = true; btn.textContent = 'جاري الحذف...';
  try { await uapi('/rest/v1/rpc/delete_my_account', { method: 'POST', headers: JH, body: '{}' }); localSignOut(); closeSheet(); go('home'); showAuth('welcome'); toast('تم حذف حسابك') }
  catch (e) { btn.disabled = false; btn.textContent = 'نعم، احذفي حسابي'; toast('تعذر حذف الحساب.') }
}
document.getElementById('authv').addEventListener('submit', e => { if (e.target.id === 'au-form') { e.preventDefault(); submitAuth(e.target) } });

/* ===== v49: جلسة وحدة لكل حساب: الدخول من جهاز ثاني يطلّع هذا الجهاز (كل دقيقة ولما ترجع للصفحة) ===== */
let sessOff = 0, sessBusy = false;
async function sessCheck() {
  if (!user || sessBusy || document.hidden || Date.now() < sessOff) return;
  sessBusy = true;
  try {
    const alive = await uapi('/rest/v1/rpc/mir_session_alive', { method: 'POST', headers: JH, body: '{}' });
    if (alive === false && user) sessExpired('تم تسجيل الدخول إلى حسابك من جهاز آخر.');   // v90: بالشعار + الرسالة فوق شاشة الدخول (كان: رسالة تحت + شاشة الدخول فجأة)
  } catch (e) { if (e.status === 404 || /mir_session_alive|schema cache/i.test(String(e.message))) sessOff = Date.now() + 10 * 60000 }
  finally { sessBusy = false }
}
setInterval(sessCheck, 60000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) sessCheck() });
setTimeout(() => { if (!/[?&]pay=/.test(location.search)) sessCheck() }, 1200);   // v90: مع فتح التطبيق/الموقع كمان (كان: أول فحص بعد دقيقة). بعد الرجوع من الدفع: لا (payReturn يكمل بالجلسة)

/* ===== notifications (bell) ===== */
let notes = [];
let notesPrimed = false, lastNote = 0;
/* كل 20 ثانية (للمسجّلات، والأجهزة اللي عندها طلبات أو تذاكر): طلب خفيف يجيب الإشعارات وحجزها والصيانة.
   الأسعار والكميات ما عادتش هنا: تجي من الكتالوج، ومن فحص السلة لما تنفتح */
function sessId() {
  let s = null; try { s = JSON.parse(sessionStorage.getItem('mir_sid')) } catch (e) {}
  const now = Date.now(); if (!s || !s.id || now - s.t > 30 * 60000) s = { id: newId(), t: now }; else s.t = now;
  try { sessionStorage.setItem('mir_sid', JSON.stringify(s)) } catch (e) {}
  return s.id;
}
let pulseBusy = false, pulseAgain = false, lastPulse = 0, lastReload = 0, p3Off = 0, notesDev = null;   // p3Off: لو store_pulse3 مش موجودة بعد، نرجعوا نجربوها بعد 5 دقائق
async function pulse(force) {
  if (!user && !engaged()) return;   // زائر بدون حساب ولا طلبات: ما عنده شي يتحدّث
  if (pulseBusy) { if (force) pulseAgain = true; return }   // v54: طلب تحديث وقت ما فيه واحد شغال ← يتعاود بعده (كان يضيع)
  if (!force && Date.now() - lastPulse < 3000) return;
  pulseBusy = true; lastPulse = Date.now();
  const t0 = Date.now(), fresh = () => liveAt < t0 && !pulseAgain;   // v54: الرد القديم (بدا قبل أمر حجز/إلغاء) ما يتطبّقش
  try {
    const call = (fn, args) => user ? uapi('/rest/v1/rpc/' + fn, { method: 'POST', headers: JH, body: JSON.stringify(args) })
                                    : api('/rest/v1/rpc/' + fn, { method: 'POST', headers: JH, body: JSON.stringify(args) });
    const miss = (e, fn) => e.status === 404 || new RegExp(fn + '|schema cache').test(String(e.message));
    const dev = engaged() ? DEV : null, full = view === 'cart';
    // منتجات سلتها: الكمية والسعر والتوفر والمحجوز لغيرها كل 20 ثانية (في أي صفحة، وفي شاشة انتظار الحجز)
    const ids = user ? [...new Set(cart.filter(l => !l.gone).map(l => String(l.id)))].slice(0, 59) : [];
    const po = prodOpen(); if (user && po && !ids.includes(po)) ids.push(po);   // المنتج المفتوح قدامها
    // الإشعارات: الجديدة بس (الأحدث من آخر إشعار عندنا)، وأول مرة آخر 50
    if (Date.now() > p3Off) {
      const after = notesPrimed && dev && notesDev === dev ? lastNote : 0;
      try {
        const r = await call('store_pulse3', { p_device: dev, p_full: full, p_after: after, p_ids: ids.length ? ids : null });
        if (fresh()) applyLive(r, true); if (r && r.notes) { handleNotes(r.notes, after > 0); notesDev = dev }
        return;
      } catch (e) { if (!miss(e, 'store_pulse3')) return; p3Off = Date.now() + 300000 }
    }
    try {
      const r = await call('store_pulse2', { p_device: dev, p_full: full });
      if (fresh()) applyLive(r); if (r && r.notes) { handleNotes(r.notes); notesDev = dev }
      return;
    } catch (e) { if (!miss(e, 'store_pulse2')) return }
    if (engaged()) { handleNotes((await rpc('my_notifications', { p_device: DEV })) || []); notesDev = DEV }
  } catch (e) {} finally { pulseBusy = false; if (pulseAgain) { pulseAgain = false; setTimeout(() => pulse(true), 0) } }
}
/* فتح السلة: السعر والتوفر والكمية لمنتجات السلة بس (من قاعدة البيانات مباشرة) */
async function cartCheck() {
  if (!user || !cart.length) return;
  const ids = [...new Set(cart.map(l => String(l.id)))];
  const t0 = Date.now();
  try { const r = await uapi('/rest/v1/rpc/cart_check', { method: 'POST', headers: JH, body: JSON.stringify({ p_ids: ids }) }); if (liveAt < t0) applyLive(r, true) }   // v54: الرد القديم ما يتطبّقش
  catch (e) { if (e.status === 404 || /cart_check|schema cache/.test(String(e.message))) pulse(true) }
}
/* partial = منتجات السلة بس (ما نحسبوش الباقي محذوف) */
function applyLive(r, partial) {
  if (r && 'maint' in r) setMaint(!!r.maint);
  if (r && typeof r.pen === 'number' && user) setPen(r.pen);
  if (r && r.mode) { const was = state.mode; state.mode = r.mode; if (was && was !== r.mode && view === 'cart') renderCartView() }
  if (r && 'payp' in r) { state.payp = paypSet(r.payp); payBanner(); navSoon() }   // v97: الرجوع من الرئيسية يعرف بالطلب اللي بانتظار الدفع
  if (!r) return;
  if (r.rate !== undefined) state.rate = r.rate;
  if (Array.isArray(r.hh)) { const m = {}; r.hh.forEach(([id, v, q]) => { m[String(id) + '|' + (v || '')] = q }); state.hh = m; state.hhAt = Date.now();   /* v91: وقت آخر معلومة عن حجز الآخرين (نافذة الانتظار) */ state.limS = null; if (view === 'cart') limPaint() }   // البيانات المباشرة أحدث من رد السيرفر القديم
  if (r.hl !== undefined && r.hl !== null) { const was = state.hl; state.hl = Number(r.hl); if (was !== state.hl && view === 'cart') limPaint() }
  if (r.st !== undefined && r.st !== null) state.st = Number(r.st);
  if (r.mine !== undefined) state.mineEnd = r.mine ? Date.now() + r.mine * 1000 : 0;
  /* v97 (معتز): حجز شغال في السيرفر والصفحة ما تعرفش بيه (سكّرت التطبيق بعد «تأكيد الطلب» ورجعت): نفس العداد والشريط الأخضر.
     بس لو ما فيش عداد شغال، وما فيش أمر حجز/دفع شغال، وهي مش في صفحات الطلب نفسها */
  if (r.mine > 5 && user && cart.length && !holdEnd && !ckBusy && !payRetBusy && !ckFlow() && !maintOn) startHold(r.mine);
  if (r.mq !== undefined) qSync(r.mq || 0, true);   // v65: نهاية الحجز كله (العادي أو الصامت)
  if (!Array.isArray(r.p)) return;
  const chg = new Map(), seen = new Set(), now = Date.now();   // المنتجات اللي تغيّرت فعلاً: { price, st }
  r.p.forEach(([id, price, st, n, v, vo, dc, was, until]) => {
    id = String(id); seen.add(id);
    const p = byId(id), tr = p && p.track && !p.preorder;
    // المقارنة مع آخر حالة معروفة (من التحديث أو من الكتالوج)
    const old = state.live[id] || (p && { st: avail(p), n: tr ? (p.stock ?? null) : null, v: tr ? (p.vstock || null) : null, vo: p.track ? {} : (p.vout || {}) });
    const vj = JSON.stringify(v || null), oj = JSON.stringify(vo || {});
    const c = { price: false, first: !old, st: !old || (old.st !== st || (old.n ?? null) !== (n ?? null) || JSON.stringify(old.v || null) !== vj || JSON.stringify(old.vo || {}) !== oj) };
    state.live[id] = { st, n, v: v || null, vo: vo || {}, t: now };
    if (p && price != null && Number(p.price) !== Number(price)) { p.price = Number(price); c.price = true }
    if (p && dc !== undefined && Number(p.discount || 0) !== Number(dc || 0)) { p.discount = dc; c.price = true }
    if (p && was !== undefined) { p.price_was = was; if ((p.discount_until || null) !== (until || null)) { p.discount_until = until || null; c.price = true } }
    if (p && endDiscounts([p]).length) c.price = true;
    if (c.price || c.st) chg.set(id, c);
  });
  const changed = chg.size > 0;
  if (!state.ok) return;
  if (!partial && (state.prods.some(p => !seen.has(String(p.id))) || [...seen].some(id => !byId(id))) && Date.now() - lastReload > 60000) { lastReload = Date.now(); loadData() }
  if (!changed) return;
  if (['cat', 'products', 'home', 'favs'].includes(view)) patchCards(chg);
  if (view === 'cart' && cart.some(l => chg.has(String(l.id)))) liveCart(chg, [...chg.values()].every(c => c.first));
  const pp = pend && document.getElementById('ppr'), p = pp && byId(pend.id);
  if (p) {
    pp.textContent = money(p.price); document.getElementById('pstk').innerHTML = pstkHTML(p); const po = document.getElementById('ppo'); if (po) po.innerHTML = ppoHTML(p);
    const pc = document.getElementById('pcd'); if (pc) pc.innerHTML = cdHTML(p);
    const b = document.querySelector('[data-addp]'); if (b) { const ok = canBuy(p); b.disabled = !ok; b.textContent = ok ? 'أضيفي إلى السلة' : outTxt(p) }
    const va = vattrOf(p);
    document.querySelectorAll('.sheet .opt').forEach(o => {
      const al = o.dataset.al, none = (va && al === va && !leftOf(p, o.dataset.av)) || optOut(p, al, o.dataset.av);
      o.disabled = none; o.innerHTML = esc(o.dataset.av) + (none ? '<small>قريباً</small>' : '');
      if (none && pend.opts[al] === o.dataset.av) { delete pend.opts[al]; o.classList.remove('on'); if (al === va) document.getElementById('pqty').classList.add('off') }
    });
    // الكمية المختارة أكثر من المتوفر الآن: تنزل للمتوفر
    const v = va ? pend.opts[va] : '';
    if (pend.qty > 1 && (!va || v)) {
      const room = Math.max(1, roomFor(p, v, undefined, pend.opts).room);
      if (pend.qty > room) { pend.qty = room; const q = document.getElementById('pq'); if (q) { q.textContent = room; flash(q, null, true) } }
    }
  }
}
/* صفحة المنتج: الكمية الحقيقية من قاعدة البيانات لما تنفتح (المنتج اللي اتفحص في آخر 20 ثانية ما يتفحصش ثاني).
   الصفحة ما تستناش: تنفتح بأرقام الكتالوج، ولو فيه فرق يتصحّح بعد لحظة */
const prodChecked = new Map();
function prodLive(id) {
  id = String(id); const now = Date.now();
  if (now - (prodChecked.get(id) || 0) < 20000) return;
  prodChecked.set(id, now);
  const body = JSON.stringify({ p_ids: [id] });
  (user ? uapi('/rest/v1/rpc/cart_check', { method: 'POST', headers: JH, body }) : api('/rest/v1/rpc/cart_check', { method: 'POST', headers: JH, body }))
    .then(r => { if (liveAt < now) applyLive(r, true) }).catch(() => prodChecked.delete(id));
}
const prodOpen = () => sheet.classList.contains('on') && !!document.getElementById('ppr') && pend ? String(pend.id) : null;
/* تحديث كروت المنتجات اللي تغيّرت بس (بدون إعادة رسم الصفحة كاملة) */
function patchCards(chg) {
  const roots = ['prodgrid', 'searchgrid', 'csres', 'hpicks', 'favgrid'].map(id => document.getElementById(id)).filter(r => r && !r.hidden && !r.classList.contains('sq-hide'));
  let resort = false;
  const idx = new Map();   // فهرس الكروت مرة وحدة: id -> [[root, card]]
  roots.forEach(r => r.querySelectorAll('.card .thumb[data-open]').forEach(th => { const id = th.dataset.open; if (!chg.has(id)) return; if (!idx.has(id)) idx.set(id, []); idx.get(id).push([r, th.closest('.card')]) }));
  chg.forEach((c, id) => {
    const p = byId(id); if (!p) return;
    (idx.get(id) || []).forEach(([r, card]) => {
      if (!card) return;
      const pr = card.querySelector('.price');
      if (pr && pr.textContent !== money(p.price)) { pr.textContent = money(p.price); if (!c.first) flash(pr, 'p' + r.id + id, true); if (sortBy !== 'new') resort = true }
      const sk = card.querySelector('.stk'), nh = stkHTML(p);
      if (sk && sk.outerHTML !== nh) { sk.outerHTML = nh; if (!c.first) flash(card.querySelector('.stk'), 's' + r.id + id, true) }
      const b = card.querySelector('[data-add]'); if (b) b.disabled = !canBuy(p);
      card.classList.toggle('out', avail(p) === 'out');
      const pw = card.querySelector('.pwrap'); if (pw) { const o = pw.querySelector('.oldp'), nh = oldHTML(p); if (o && !nh) o.remove(); else if (nh && (!o || o.outerHTML !== nh)) { if (o) o.outerHTML = nh; else pw.insertAdjacentHTML('afterbegin', nh) } }
      const tg = card.querySelector('.ptags'), th = tagsHTML(p), tb = card.querySelector('.thumb');
      if (tg && tg.outerHTML !== th) { if (th) tg.outerHTML = th; else tg.remove() } else if (!tg && th && tb) tb.querySelector('.fav')?.insertAdjacentHTML('beforebegin', th);
      const cd = card.querySelector('.cdc'), ch = cdHTML(p, true), pi = card.querySelector('.pinfo');
      if (cd && !ch) cd.remove(); else if (ch && !cd && pi) pi.insertAdjacentHTML('beforeend', ch); else if (ch && cd && cd.dataset.until !== String(dEnd(p))) cd.outerHTML = ch;
    });
  });
  if (resort) { if (view === 'cat') renderCat(); else if (document.getElementById('q').value) runSearch() }   // الترتيب بالسعر تغيّر
}
/* السلة مفتوحة وتغيّر سعر أو كمية: رسالة وحدة تجمع التغييرات + لمعة على المنتج المعني */
function liveCart(chg, quiet) {
  const box = document.getElementById('cartv');
  const snap = el => { const m = {}; el.querySelectorAll('.ccard[data-cid]').forEach(c => { m[c.dataset.cid] = { pr: (c.querySelector('.cunit') || {}).textContent || '', w: [...c.querySelectorAll('.cwarn span')].map(x => x.textContent).join('|') } }); return m };
  const before = snap(box), y = document.getElementById('v-cart').scrollTop;
  renderCartView(); document.getElementById('v-cart').scrollTop = y;
  const after = snap(box), hit = []; let pc = false, qc = false;
  Object.keys(after).forEach(id => {
    const a = after[id], b = before[id]; if (!b) return;
    const card = box.querySelector(`.ccard[data-cid="${CSS.escape(id)}"]`);
    if (quiet) return;
    if (a.pr !== b.pr || a.w !== b.w) hit.push(id);
    if (a.pr !== b.pr) { pc = true; flash(card.querySelector('.cunit'), 'cu' + id, true); card.querySelectorAll('.cline').forEach(x => flash(x, null, true)) }
    if (a.w !== b.w) { qc = true; flash(card, 'cc' + id) }
  });
  if (quiet || sheet.classList.contains('on') || (Date.now() < cartQuiet.until && hit.every(id => cartQuiet.ids.has(id)))) return;   // نفس المنتجات اللي شرحتها النافذة قبل لحظة
  if (pc || qc) toast(pc ? 'تم تحديث الأسعار.' : 'تم تحديث السلة.');
  if (pc || qc) document.getElementById('toast').dataset.live = '1';   // رسالة تلقائية: تختفي لو انفتحت نافذة
}
function loadNotes() { return pulse(true) }
/* merge: الجاية إشعارات جديدة بس، تنضاف فوق اللي عندنا (آخر 50) */
function handleNotes(list, merge) {
  if (merge) {
    const have = new Set(notes.map(n => String(n.id)));
    notes = [...(list || []).filter(n => !have.has(String(n.id))), ...notes].sort((a, b) => Number(b.id) - Number(a.id)).slice(0, 50);
  } else notes = list || [];
  const top = notes.reduce((m, n) => Math.max(m, Number(n.id) || 0), 0);
  const fresh = notesPrimed ? notes.filter(n => Number(n.id) > lastNote && !n.read_at) : [];
  notesPrimed = true; lastNote = Math.max(lastNote, top);
  updateBell(); dotsNote(list);
  if (fresh.length) {
    noteAlert(fresh[0], fresh.length);
    if (fresh.some(n => n.kind === 'order') && view === 'orders') {
      const old = new Map(myOrders.map(o => [o.id, oSt(o)]));
      renderOrders(true).then(() => myOrders.forEach(o => { if (old.has(o.id) && old.get(o.id) !== oSt(o)) flash(document.querySelector(`.mo-card[data-oc="${CSS.escape(o.id)}"] .ost`), 'os' + o.id) }));
    }
  }
}
/* sound: a soft two-note chime made with WebAudio (browsers allow it after the first tap) */
const soundOn = () => lsGet('mir_sound', true) !== false;
let actx = null;
let audT = 0;
/* v99 (معتز): الصوت كان يوقف بعد نافذة إذن الإشعارات (أو أي خروج من التطبيق ورجوع): أندرويد يوقّف محرّك الصوت
   (suspended أو interrupted)، والقديم كان يرجّعه من «suspended» بس. توا: أي حالة غير «شغّال» ← يرجّعه، ولو مات (closed) ← محرّك جديد.
   ويرجّعه كمان أول ما الصفحة ترجع تبان، وقبل كل صوت */
function audFix() {
  if (!actx) return;
  if (actx.state === 'closed') { actx = null; return }
  if (actx.state !== 'running') { try { actx.resume().catch(() => {}) } catch (e) {} }
}
function unlockAudio() {
  if (actx) {
    if (actx.state === 'closed') actx = null;
    else {
      audFix();
      // ما رجعش بعد اللمسة (محرّك عالق): نبدلوه بواحد جديد من نفس اللمسة الجاية
      if (actx.state !== 'running' && !audT) { const a0 = actx; audT = setTimeout(() => { audT = 0; if (actx === a0 && a0.state !== 'running') { try { a0.close() } catch (e) {} actx = null } }, 600) }
      return;
    }
  }
  // v69: تجهيز محرّك الصوت ياخذ وقت، فكان يأخّر أول ضغطة بعد فتح المتجر. توا يتجهز بعدها بشوية (الصفحة تكون تحركت).
  // أندرويد: يشتغل طول (الزبونة لمست الصفحة). آيفون: يبدا موقوف ويتفعّل مع اللمسة الجاية
  if (audT) return;
  audT = setTimeout(() => {
    audT = 0; if (actx) return;
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    try { actx = new AC() } catch (e) {}
  }, 350);
}
document.addEventListener('pointerdown', unlockAudio, { passive: true });
document.addEventListener('visibilitychange', () => { if (!document.hidden) audFix() });
window.addEventListener('focus', audFix);
function chimeNow() {
  const t = actx.currentTime, out = actx.createGain(); out.gain.value = .22; out.connect(actx.destination);
  [[1318.5, 0], [1760, .13]].forEach(([f, d]) => {
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = 'sine'; o.frequency.value = f; o.connect(g); g.connect(out);
    g.gain.setValueAtTime(0, t + d); g.gain.linearRampToValueAtTime(1, t + d + .015); g.gain.exponentialRampToValueAtTime(.001, t + d + .55);
    o.start(t + d); o.stop(t + d + .6);
  });
}
function chime() {
  if (!soundOn() || !actx || actx.state === 'closed') return;
  if (actx.state === 'running') return chimeNow();
  try { actx.resume().then(() => { if (actx && actx.state === 'running') chimeNow() }).catch(() => {}) } catch (e) {}   // v99: يرجّعه ويرن
}
let bannerNote = null, bannerT = null;
function noteAlert(n, count) {
  chime();
  if (navigator.vibrate) try { navigator.vibrate(40) } catch (e) {}
  document.querySelectorAll('.iconbtn[data-notes]').forEach(b => { b.classList.remove('ring'); void b.offsetWidth; b.classList.add('ring') });
  document.querySelectorAll('.bell-badge.on').forEach(b => { b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop') });
  bannerNote = n;
  document.getElementById('nb-t').textContent = n.title + (count > 1 ? ` (+${count - 1})` : '');
  document.getElementById('nb-b').textContent = n.body || '';
  document.querySelector('#nbanner .ni').innerHTML = ic(n.kind === 'ticket' ? 'chat' : n.kind === 'order' ? 'receipt' : 'bell');
  const b = document.getElementById('nbanner'); b.classList.add('on');
  b.style.transform = ''; clearTimeout(bannerT); bannerT = setTimeout(hideBanner, 5000);
}
function hideBanner() { const b = document.getElementById('nbanner'); clearTimeout(bannerT); b.style.transform = ''; b.style.transition = ''; b.classList.remove('on') }
/* سحب الإشعار لفوق يقفله (يبقى غير مقروء في قائمة الإشعارات) */
let nbSwiped = false;
(() => {
  const b = document.getElementById('nbanner'); let y0 = null, dy = 0, pid = null;
  b.addEventListener('pointerdown', e => { if (e.target.closest('[data-nbx]')) return; y0 = e.clientY; dy = 0; pid = e.pointerId; nbSwiped = false; clearTimeout(bannerT) });
  b.addEventListener('pointermove', e => {
    if (y0 == null || e.pointerId !== pid) return;
    dy = Math.min(0, e.clientY - y0);
    if (dy < -6) { if (!nbSwiped) { nbSwiped = true; try { b.setPointerCapture(pid) } catch (x) {} } b.style.transition = 'none'; b.style.transform = `translateY(${dy}px)` }
  });
  const end = () => {
    if (y0 == null) return; y0 = null; b.style.transition = '';
    if (dy < -36) { b.style.transform = ''; hideBanner() }
    else { b.style.transform = ''; if (b.classList.contains('on')) bannerT = setTimeout(hideBanner, 5000) }
    setTimeout(() => { nbSwiped = false }, 0);
  };
  b.addEventListener('pointerup', end); b.addEventListener('pointercancel', end);
})();
/* ===== v98 (معتز): الإشعارات خارج التطبيق (Web Push) =====
   - توصل لـ: رد جديد من الدعم، وتغيّر حالة الطلب، ورسائل الجذب (يوم/يومين بدون فتح). الفلترة والإرسال في السيرفر (store-v50 + push-send).
   - الإذن: بعد شاشة البداية والتسخينة، في الرئيسية: نافذة منّا أول («تفعيل» / «لاحقاً») وبعدها نافذة النظام.
     «لاحقاً» ← ترجع بعد 7 أيام، ومرتين بس في الكل. ومن «حسابي» (مفتاح) وتحت «تم استلام طلبك» في أي وقت.
   - الاشتراك مربوط بتوكن الإشعارات (DEV): يتحدّث مع كل فتحة (= «فتحت المتجر» لرسائل الجذب)، ومع الدخول والخروج من الحساب */
/* v101 (معتز): الإشعارات خارج التطبيق في تطبيق Google Play بس (window.__app). المتصفح: الإشعارات داخل المتجر بس،
   وأي اشتراك قديم اتعمل من المتصفح (V98–V100) ينلغى وينمسح من السيرفر بهدوء (pushBrowserDrop).
   ملاحظة: التطبيق والمتصفح في نفس التلفون يتشاركوا نفس الـ service worker والتخزين، فاشتراك التطبيق متعلّم بـ app:true وما يتمسّش */
var PUSH_HW = (() => {   // var: renderAccount ممكن يرسم قبل السطر هذا
 try { return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && location.protocol === 'https:' } catch (e) { return false } })();
var PUSH_OK = !!PUSH_HW && !!window.__app && !window.__ios;   // المتجر داخل التطبيق + الجهاز يدعمها (v105: تطبيق الآيفون لا، لين APNs)
function pushOn() { return !!PUSH_OK && Notification.permission === 'granted' && !!lsGet('mir_push', null) && !lsGet('mir_push_off', false) }
async function pushBrowserDrop() {
  if (!PUSH_HW || window.__app) return;
  const m = lsGet('mir_push', null); if (!m || m.app) return;   // اشتراك التطبيق (نفس التلفون) ما نلمسوهش
  lsSet('mir_push', null);
  try {
    const reg = await navigator.serviceWorker.getRegistration('/'); const sub = reg && await reg.pushManager.getSubscription();
    if (sub) { api('/rest/v1/rpc/push_sub_del', { method: 'POST', headers: JH, body: JSON.stringify({ p_endpoint: sub.endpoint }) }).catch(() => {}); await sub.unsubscribe().catch(() => {}) }
  } catch (e) {}
}
let pushKey = null, pushBusy = false;
async function pushPub() {
  if (pushKey) return pushKey;
  try { const k = await api('/rest/v1/rpc/push_pubkey', { method: 'POST', headers: JH, body: '{}' }); if (typeof k === 'string' && k.length > 60) return (pushKey = k) } catch (e) {}
  try { const r = await api('/functions/v1/push-send', { method: 'POST', headers: JH, body: JSON.stringify({ action: 'pub' }) }); if (r && r.key) return (pushKey = r.key) } catch (e) {}
  return null;
}
async function pushReg() {
  let reg = await navigator.serviceWorker.getRegistration('/');
  if (!reg) reg = await navigator.serviceWorker.register('/sw.js');
  return navigator.serviceWorker.ready.then(r => r || reg);
}
async function pushSave(sub) {
  const j = sub && sub.toJSON ? sub.toJSON() : sub;
  if (!j || !j.endpoint) return false;
  return !!(await api('/rest/v1/rpc/push_sub_save', { method: 'POST', headers: JH, body: JSON.stringify({ p_sub: j, p_device: String(DEV) }) }));
}
// تشغيل (من ضغطة الزبونة): إذن النظام ← اشتراك ← السيرفر
async function pushEnable(quiet) {
  if (!PUSH_OK) { if (!quiet) toast('هذا الجهاز لا يدعم الإشعارات.'); return false }
  if (pushBusy) return false; pushBusy = true;
  try {
    let perm = Notification.permission;
    if (perm === 'default') perm = await Notification.requestPermission();
    if (perm !== 'granted') { if (!quiet) { lsSet('mir_push_want', true); pushDeniedHelp() } return false }   // v98b: شرح السماح بدل الشريط، ويتفعّل وحده لما ترجع
    const key = await pushPub(); if (!key) { if (!quiet) toast(NETMSG); return false }
    const reg = await pushReg();
    let sub = await reg.pushManager.getSubscription();
    if (sub) { const old = sub.options && sub.options.applicationServerKey; if (old && b64uOf(old) !== key) { try { await sub.unsubscribe() } catch (e) {} sub = null } }
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: ub64(key) });
    if (!(await pushSave(sub))) { if (!quiet) toast(NETMSG); return false }
    lsSet('mir_push', { at: Date.now(), app: true }); lsSet('mir_push_off', false); lsSet('mir_push_want', false);
    if (!quiet) toast('تم تفعيل الإشعارات.');
    return true;
  } catch (e) { if (!quiet) toast(NETMSG); return false }
  finally { pushBusy = false; if (view === 'account') renderAccount(); const b = document.querySelector('.okpush'); if (b && pushOn()) b.remove() }
}
/* v98b (معتز): الزبونة رفضت الإذن مرة ← المتصفح/أندرويد ما يسمحش للصفحة تطلبه من جديد. نشرحولها كيف تسمح بيه،
   ولما ترجع للمتجر وهو مسموح، الإشعارات تتفعّل وحدها (mir_push_want) */
function pushDeniedHelp() {   // v101: التطبيق بس (الإشعارات خارج التطبيق ما عادتش في المتصفح)
  openSheet('bottom', `<div class="lp"><div class="lp-ic">${ic('bell')}</div><h3>الإشعارات متوقفة</h3>
    <p class="sub-note">تم إيقاف الإشعارات لهذا التطبيق من إعدادات الجهاز، ولا يمكن تفعيلها من هنا مباشرة.</p>
    <ol class="pdh"><li>اضغطي مطولاً على أيقونة Miracles، ثم «معلومات التطبيق».</li><li>اختاري «الإشعارات»، وفعّلي «السماح بالإشعارات».</li><li>يُرجى إغلاق جميع التطبيقات المفتوحة، والانتظار من 2 إلى 3 دقائق خارج التطبيق، ثم الدخول إلى المتجر من جديد.</li><li>إذا لم تنجح الخطوة 3، يُرجى إعادة تشغيل الهاتف.</li></ol>
    <button class="cta" data-close>حسناً</button></div>`);
}
async function pushDisable() {   // v101: المفتاح يطفى والرسالة على طول، والإلغاء عند Google والمسح من السيرفر ورا
  lsSet('mir_push_off', true); lsSet('mir_push', null); lsSet('mir_push_want', false);
  pushSwitch(false); toast('تم إيقاف الإشعارات خارج التطبيق.');
  pushBusy = true;
  try {
    const reg = PUSH_HW && await navigator.serviceWorker.getRegistration('/');
    const sub = reg && await reg.pushManager.getSubscription();
    if (sub) { api('/rest/v1/rpc/push_sub_del', { method: 'POST', headers: JH, body: JSON.stringify({ p_endpoint: sub.endpoint }) }).catch(() => {}); await sub.unsubscribe().catch(() => {}) }
  } catch (e) {}
  pushBusy = false;
}
// v101: المفتاح في «حسابي» يتحرّك مع الضغطة (قبل ما الخطوات تكمل)؛ لو فشلت، يرجع لمكانه
function pushSwitch(on) {
  const w = document.querySelector('[data-pushtog] .sw'); if (!w) return;
  w.classList.toggle('on', !!on); w.setAttribute('aria-checked', String(!!on));
}
function pushToggle() {
  if (pushBusy) return;
  if (pushOn()) return pushDisable();
  if (Notification.permission === 'default') return pushAskSheet('acc');   // v102: نافذتنا قبل نافذة أندرويد (المفتاح يقعد مكانه لين «تفعيل»)
  pushSwitch(true); pushEnable();   // finally ← renderAccount يرسمه على الحقيقة (مفعّل، أو رجع لو فشل/رفضت)
}
// كل فتحة/رجوع للمتجر، وبعد الدخول والخروج: نفس الاشتراك بالتوكن الحالي («شافت المتجر» ← رسائل الجذب من الصفر)
let pushSyncAt = 0, pushSyncDev = '';
async function pushSync(force) {
  if (!PUSH_OK) return pushBrowserDrop();
  if (!pushBusy && !pushOn() && !lsGet('mir_push_off', false) && Notification.permission === 'granted' && !lsGet('mir_push_want', false)) return pushEnable(true).then(() => { if (view === 'account') renderAccount() });   // v101: الإذن موجود في التطبيق (أندرويد قبل 13 يسمح من الأول، أو انمسح السجل) وهي ما طفّتهاش ← تتفعّل بهدوء
  if (!pushBusy && !pushOn() && lsGet('mir_push_want', false) && Notification.permission === 'granted') return pushEnable(true).then(ok => { if (!ok) return; if (sheet.querySelector('.pdh')) closeSheet(); toast('تم تفعيل الإشعارات.') });   // v98b: سمحت بيها من الإعدادات ورجعت
  if (!pushOn() || pushBusy) return;
  if (!force && Date.now() - pushSyncAt < 10 * 60000 && pushSyncDev === String(DEV)) return;
  pushSyncAt = Date.now(); pushSyncDev = String(DEV);
  try {
    const reg = await navigator.serviceWorker.getRegistration('/'); if (!reg) return;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) { lsSet('mir_push', null); return pushEnable(true) }   // المتصفح مسح الاشتراك: نعاودوه بهدوء (الإذن موجود)
    await pushSave(sub);
  } catch (e) { pushSyncAt = 0 }
}
function b64uOf(buf) { const u = new Uint8Array(buf); let x = ''; for (let i = 0; i < u.length; i++) x += String.fromCharCode(u[i]); return btoa(x).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') }
function ub64(str) { let x = String(str).replace(/-/g, '+').replace(/_/g, '/'); while (x.length % 4) x += '='; const b = atob(x), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u }
// نافذة الإذن في الرئيسية (بعد شاشة البداية والتسخينة)
function pushAskDue() {
  if (!PUSH_OK || Notification.permission !== 'default' || lsGet('mir_push_off', false)) return false;
  const a = lsGet('mir_push_ask', { n: 0, at: 0 });
  return a.n < 2 && Date.now() - (a.at || 0) > 7 * 86400000;
}
function pushAskTry(tries) {
  if (!pushAskDue()) return;
  const auth = document.getElementById('authv'), sp = document.getElementById('splash');
  const busy = view !== 'home' || sheet.classList.contains('on') || (auth && !auth.hidden) || (sp && !sp.classList.contains('out')) || document.hidden;
  if (busy) { if ((tries || 0) < 40) setTimeout(() => pushAskTry((tries || 0) + 1), 3000); return }
  const a = lsGet('mir_push_ask', { n: 0, at: 0 }); lsSet('mir_push_ask', { n: (a.n || 0) + 1, at: Date.now() });
  pushAskSheet('ask');
}
/* v102 (معتز): نفس نافذة الرئيسية قبل نافذة أندرويد، من مفتاح «حسابي» (acc) وزر «تم استلام طلبك» (okask)، لما أندرويد ما سألهاش قبل.
   ما تتحسبش من «المرتين» حقات الرئيسية (هي اللي طلبتها). من «تم استلام طلبك»: «تفعيل» و«لاحقاً» يرجّعوها لنافذة الطلب */
function pushAskSheet(src) {
  openSheet('bottom', `<div class="lp"><div class="lp-ic">${ic('bell')}</div><h3>تفعيل الإشعارات</h3>
    <p class="sub-note">لتصلكِ حالة طلبكِ وردود الدعم أولاً بأول، حتى والتطبيق مغلق.</p>
    <button class="cta" data-pushon="${src}">تفعيل</button><button class="cta ghost" ${src === 'okask' ? 'data-pushback' : 'data-close'}>لاحقاً</button></div>`);
}
function okBack() { if (okLast) openSheet('bottom now', okDoneHTML(okLast.id, okLast.num)); else closeSheet() }
// رابط من الإشعار (?nt=order|ticket|promo&nr=...) أو رسالة من sw.js والمتجر مفتوح
/* v104 (معتز): أي إشعار (رد الدعم، حالة الطلب، الجذب، الفوري) يفتح الرئيسية بس؛ الجديد تبيّنه النقاط الحمراء
   (رقم الجرس، «طلباتي» والطلب نفسه، السماعة). ما نقطعوهاش لو هي وسط حاجة: نافذة مفتوحة، الطلب، أو تعبئة عنوان */
function pushDeep(nt) {
  if (!nt) return;
  if (sheet.classList.contains('on') || ckFlow() || ckBusy || view === 'addr' || view === 'map') return;
  if (view !== 'home') go('home');
}
function pushDeepURL() {
  try {
    const u = new URL(location.href), nt = u.searchParams.get('nt'), nr = u.searchParams.get('nr');
    if (!nt) return;
    u.searchParams.delete('nt'); u.searchParams.delete('nr'); history.replaceState(history.state, '', u.pathname + u.search + u.hash);
    setTimeout(() => pushDeep(nt), 400);
  } catch (e) {}
}
if (PUSH_HW) navigator.serviceWorker.addEventListener('message', e => { const d = e.data || {}; if (d.mir === 'push') pushDeep(d.nt) });
document.addEventListener('visibilitychange', () => { if (!document.hidden) setTimeout(() => pushSync(), 2000) });
function openNote(n) {
  document.getElementById('nbanner').classList.remove('on');
  if (!n) return;
  if (n.kind === 'ticket' && n.ref) return openChat(n.ref);
  if (n.kind === 'order' && n.ref) { go('orders'); return renderOrders().then(() => openOrderC(n.ref)) }
  return openNotes();
}
function updateBell() {
  const n = notes.filter(x => !x.read_at).length;
  document.querySelectorAll('.bell-badge').forEach(b => { b.textContent = n > 9 ? '9+' : n; b.classList.toggle('on', n > 0) });
}
/* v104 (معتز): النقاط الحمراء. نفس الإشعارات اللي توصل برا التطبيق: تغيّر حالة طلب (مش «تم استلام طلبك») ← «طلباتي» والطلب،
   ورد جديد من الدعم ← السماعة. تنطفي لما تفتح الطلب/التذكرة نفسها (مش لما تقرا قائمة الجرس). محفوظة في الجهاز لكل حساب.
   أول مرة (أو التوكن تبدّل، مثلاً أول رد قبل ما الحساب يتحمّل): الغير مقروءة بس؛ بعدها: أي إشعار أحدث من آخر واحد شفناه (top) */
let dots = null, dotsK = '';
function dotsGet() {
  const k = user ? 'mir_dots_' + user.id : '';
  if (k !== dotsK) { dotsK = k; dots = k ? (lsGet(k, null) || {}) : {}; dots.o = dots.o || {}; dots.t = dots.t || {} }
  return dots;
}
function dotsNote(list) {
  if (!user || !Array.isArray(list)) return;
  const d = dotsGet(), first = d.top == null || d.dev !== String(DEV), top0 = first ? 0 : Number(d.top) || 0;
  if (first && !list.length) return dotsPaint();   // رد فاضي (مثلاً قبل ما الحساب يتحمّل): ما نحطوش أساس منه
  let top = top0;
  list.forEach(n => {
    const id = Number(n.id) || 0; top = Math.max(top, id);
    if (!n.ref) return;
    const m = n.kind === 'order' && n.title !== 'تم استلام طلبك' ? d.o : n.kind === 'ticket' && n.title === 'رد جديد من الدعم' ? d.t : null;
    if (m && (first ? !n.read_at : id > top0)) m[String(n.ref)] = Math.max(Number(m[String(n.ref)]) || 0, id);
  });
  d.top = top; d.dev = String(DEV); lsSet(dotsK, d); dotsPaint();
}
function dotClear(kind, ref) {
  if (!user || ref == null) return;
  const d = dotsGet(), m = d[kind]; if (!m || !(String(ref) in m)) return;
  delete m[String(ref)]; lsSet(dotsK, d); dotsPaint();
}
function dotsPaint() {
  const d = dotsGet();
  const mine = new Set(myOrders.map(o => String(o.id)));
  const oIds = Object.keys(d.o).filter(id => !ordersLoaded || mine.has(id));   // طلب مش في قائمتها (انمسح): ما يشعلش النقطة
  document.querySelectorAll('.ndot').forEach(x => { x.hidden = !(user && oIds.length) });
  document.querySelectorAll('.hdot').forEach(x => { x.hidden = !(user && Object.keys(d.t).length) });
  document.querySelectorAll('.mo-card[data-oc] .mo-udot').forEach(x => { x.hidden = !(user && (String(x.closest('.mo-card').dataset.oc) in d.o)) });
}
try { dotsPaint() } catch (e) {}   // أول فتحة: النقاط المحفوظة على طول
function openNotes() {
  const list = notes.length ? `<div class="nlist">${notes.map((n, i) => `<button class="nitem ${n.read_at ? '' : 'unread'}" data-note="${i}">
      <span class="ni">${ic(n.kind === 'ticket' ? 'chat' : 'cart')}</span>
      <span class="nt"><b>${esc(n.title)}</b>${n.body ? `<span>${esc(n.body)}</span>` : ''}<small>${ago(n.created_at)}</small></span></button>`).join('')}</div>`
    : `<p class="nempty">لا توجد إشعارات بعد.<br>ستصلك هنا تحديثات طلباتك وردود فريق الدعم.</p>`;
  openSheet('bottom now', `<h3>الإشعارات</h3>${list}`);   // v94 (معتز): تنفتح على طول بدون حركة
  if (notes.some(n => !n.read_at)) {
    rpc('read_notifications', { p_device: DEV }).catch(() => {});
    const now = new Date().toISOString(); notes.forEach(n => { if (!n.read_at) n.read_at = now }); updateBell();
  }
}
setInterval(() => { if (document.visibilityState === 'visible') loadNotes() }, 20000);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { loadNotes(); if (view === 'chat') pollChat() } });

/* ===== support tickets ===== */
const KINDS = { inquiry: 'استفسار', order: 'مشكلة في طلب', complaint: 'شكوى', other: 'أخرى' };
const TST = { open: 'بانتظار الرد', answered: 'تم الرد', closed: 'مغلقة' };
let tkKind = 'inquiry';
function openTicketForm(ord) {
  const me = profile ? { name: profile.full_name, phone: profile.phone } : lsGet('mir_me', {});
  tkKind = ord ? 'order' : 'inquiry';
  openSheet('bottom now', `<h3>طلب تذكرة دعم</h3><p class="sub-note">${ord ? `بخصوص الطلب <b dir="ltr">${esc(ord)}</b>.` : ''}</p>
    <b class="lbl">نوع التذكرة</b><div class="opts">${Object.entries(KINDS).map(([k, l]) => `<button class="opt ${k === tkKind ? 'on' : ''}" data-kind="${k}">${l}</button>`).join('')}</div>
    <label class="field" id="tk-ordwrap" ${ord ? '' : 'hidden'}>رقم الطلب (اختياري)<input id="tk-order" dir="ltr" style="text-align:right" maxlength="40" placeholder="#Mir0001" value="${esc(ord || lsGet('mir_last_order', ''))}"></label>
    <label class="field">الاسم<input id="tk-name" type="text" autocomplete="name" maxlength="80" value="${esc(me.name || '')}"></label>
    <label class="field">رقم الهاتف<input id="tk-phone" type="tel" inputmode="tel" dir="ltr" style="text-align:right" autocomplete="tel" maxlength="30" value="${esc(me.phone || '')}"></label>
    <label class="field">التفاصيل<textarea id="tk-body" maxlength="2000" placeholder="المشكلة أو الاستفسار..."></textarea></label>
    <button class="cta" data-tksend>إرسال التذكرة</button>`);
}
async function submitTicket(btn) {
  const v = id => (document.getElementById(id)?.value || '').trim();
  const name = v('tk-name'), phone = v('tk-phone'), body = v('tk-body');
  if (name.length < 2) return toast('يُرجى إدخال الاسم.');
  if (digits(phone).length < 8) return toast('رقم الهاتف غير صحيح');
  if (body.length < 3) return toast('يُرجى إدخال تفاصيل التذكرة.');
  btn.disabled = true; btn.textContent = 'جاري الإرسال...';
  try {
    // v80: بتوكن الحساب (uapi): من v66 (store-v46) create_ticket للحسابات بس (anon ما عندهاش صلاحية)، وكانت تنبعت بالمفتاح العام ← «تعذر إرسال التذكرة» للكل
    if (!user) throw new Error('login required');
    const id = await uapi('/rest/v1/rpc/create_ticket', { method: 'POST', headers: JH, body: JSON.stringify({ p_device: DEV, p_name: name, p_phone: phone, p_kind: tkKind,
      p_order_ref: ['order', 'complaint'].includes(tkKind) ? v('tk-order') : '', p_body: body }) });
    lsSet('mir_engaged', true);
    lsSet('mir_me', { ...lsGet('mir_me', {}), name, phone });
    openChat(id);
  } catch (e) {
    btn.disabled = false; btn.textContent = 'إرسال التذكرة';
    if (/login required/.test(e.message)) { closeSheet(); return ticketGuest() }   // v66
    toast(/open ticket exists/.test(e.message) ? 'لديكِ تذكرة مفتوحة. يُرجى إغلاقها أولاً لفتح تذكرة جديدة.' : /ticket limit/.test(e.message) ? 'وصلتِ إلى الحد اليومي للتذاكر (3 تذاكر في اليوم). يمكن التواصل معنا عبر واتساب.' : /too many/.test(e.message) ? 'لديك تذاكر مفتوحة كثيرة.' : 'تعذر إرسال التذكرة.');
  }
}
/* v56: الزبونة تقفل تذكرتها (تذكرة وحدة مفتوحة في نفس الوقت) */
async function closeMyTicket(btn) {
  const id = chat.id; if (!id) return;
  if (!(await ask('إغلاق التذكرة', 'لن تتمكني من الرد على هذه التذكرة بعد إغلاقها.', 'نعم، إغلاق التذكرة', 'danger'))) return;
  if (btn) btn.disabled = true;
  try { await rpc('close_my_ticket', { p_ticket: id, p_device: DEV }); if (chat.id === id) await pollChat(); renderMyTickets(); toast('تم إغلاق التذكرة') }
  catch (e) { toast('تعذر إغلاق التذكرة.') }
  finally { if (btn) btn.disabled = false }
}
/* v91 (معتز): التذاكر تقعد ظاهرة من غير نت: القائمة وآخر رسائل آخر 5 تذاكر محفوظين في التلفون (لصاحبتها بس: tkOwner).
   الإرسال يتقفل لما النت مطفي (chatNet). الخروج يمسحهم */
const tkOwner = () => user ? 'u:' + user.id : 'd:' + DEV;
const tkCacheGet = () => { const c = lsGet('mir_tk', null); return c && c.o === tkOwner() && Array.isArray(c.list) ? c.list : null };
function tkThreadGet(id) { const c = lsGet('mir_tkth', null); return c && c.o === tkOwner() && c.t && c.t[id] || null }
function tkThreadPut() {
  if (!chat.id || !chat.msgs.length) return;
  let c = lsGet('mir_tkth', null); if (!c || c.o !== tkOwner() || !c.t) c = { o: tkOwner(), t: {} };
  c.t[chat.id] = { msgs: chat.msgs.slice(-100), status: chat.status, kind: chat.kind, at: Date.now() };
  const keep = Object.entries(c.t).sort((a, b) => b[1].at - a[1].at).slice(0, 5); c.t = Object.fromEntries(keep);
  lsSet('mir_tkth', c);
}
function chatNet() {
  const off = offline(), f = document.getElementById('composer'), n = document.getElementById('chat-off');
  if (f) f.classList.toggle('off', off);
  const inp = document.getElementById('chat-in'); if (inp) inp.disabled = off;
  if (n) n.hidden = !off || chat.status === 'closed' || !chat.id;
}
addEventListener('online', chatNet); addEventListener('offline', chatNet);
async function renderMyTickets() {
  const box = document.getElementById('mytk');
  if (!engaged() && !user) { box.innerHTML = ''; return }   // v41: الحساب المسجّل يشوف تذاكره حتى من جهاز جديد
  let list;
  if (!box.children.length) { const c = tkCacheGet(); if (c) tkPaint(box, c) }   // v91: المحفوظة في التلفون على طول
  try { list = (await share('tickets', () => rpc('my_tickets', { p_device: DEV }))) || [] } catch { return }   // النت مقطوع: تقعد المعروضة
  lsSet('mir_tk', { o: tkOwner(), list });   // v91
  if (list.length && !engaged()) lsSet('mir_engaged', true);
  tkPaint(box, list);
}
function tkPaint(box, list) {
  box.innerHTML = list.length ? `<h4>تذاكري</h4>` + list.map(t => `<button class="tkcard" data-tk="${esc(t.id)}">
      <div class="tkrow"><b>${t.customer_unread ? '<i class="udot"></i>' : ''}${esc(KINDS[t.kind] || 'تذكرة')} <small dir="ltr">#${esc(String(t.id).slice(0, 6).toUpperCase())}</small></b><span class="pill ${esc(t.status)}">${TST[t.status] || ''}</span></div>
      ${t.last_message ? `<p>${t.last_sender === 'admin' ? 'الدعم: ' : 'أنتِ: '}${esc(t.last_message)}</p>` : ''}<small>${ago(t.updated_at)}</small></button>`).join('') : '';
}

/* ===== chat ===== */
const chat = { id: null, msgs: [], pending: [], status: '', kind: '', timer: null, busy: false };
function stopChat() { clearInterval(chat.timer); chat.timer = null; chat.id = null }
async function openChat(id) {
  dotClear('t', id);   // v104
  stopChat();
  go('chat');
  Object.assign(chat, { id, msgs: [], pending: [], status: '', kind: '' });
  document.getElementById('chat-title').textContent = 'تذكرة الدعم';
  document.getElementById('chat-status').textContent = '';
  const th = tkThreadGet(id);   // v91: الرسائل المحفوظة على طول (وتتحدّث من السيرفر بعدها)
  if (th && th.msgs.length) { Object.assign(chat, { msgs: th.msgs.slice(), status: th.status, kind: th.kind }); renderChat(true) }
  else document.getElementById('msgs').innerHTML = '<div class="bub them skb"></div><div class="bub me skb"></div><div class="bub them skb"></div>';
  chatNet();
  await pollChat();
  if (chat.id !== id) return;   // v56: بدّلت لتذكرة ثانية وسط التحميل ← ما نشغلوش سؤال ثاني
  clearInterval(chat.timer); chat.timer = setInterval(() => { if (document.visibilityState === 'visible') pollChat() }, 4000);
  loadNotes();
}
async function pollChat() {
  if (!chat.id || chat.busy) return;
  chat.busy = true;
  const id = chat.id, after = chat.msgs.length ? chat.msgs[chat.msgs.length - 1].id : 0;
  try {
    const r = await rpc('ticket_thread', { p_ticket: id, p_device: DEV, p_after: after });
    if (chat.id !== id) return;
    const known = new Set(chat.msgs.map(m => m.id));
    const fresh = (r.messages || []).filter(m => !known.has(m.id));
    const changed = fresh.length || r.status !== chat.status;
    chat.msgs.push(...fresh); chat.status = r.status; chat.kind = r.kind;
    if (changed || !after) { renderChat(fresh.length > 0); tkThreadPut() }   // v91
  } catch (e) {
    if (!after && chat.id === id) document.getElementById('msgs').innerHTML = '<p class="sysmsg">تعذر تحميل المحادثة.</p>';
  } finally { chat.busy = false }
}
function renderChat(scroll) {
  const box = document.getElementById('msgs');
  const nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 120;
  document.getElementById('chat-title').textContent = (KINDS[chat.kind] || 'تذكرة') + ' · #' + String(chat.id).slice(0, 6).toUpperCase();
  const st = document.getElementById('chat-status'); st.className = 'pill ' + chat.status; st.textContent = TST[chat.status] || '';
  const closed = chat.status === 'closed';
  document.querySelectorAll('[data-tkclose]').forEach(b => b.hidden = closed || !chat.status);   // v56
  document.getElementById('composer').hidden = closed;
  document.getElementById('chat-closed').hidden = !closed; chatNet();   // v91
  let html = '', last = '';
  const what = chat.kind === 'complaint' ? 'الشكوى' : chat.kind === 'inquiry' ? 'استفسارك' : 'طلبك';
  chat.msgs.forEach((m, i) => {
    const k = dayKey(m.created_at);
    if (k !== last) { html += `<div class="daysep">${dayLabel(m.created_at)}</div>`; last = k }
    const me = m.sender === 'customer';
    html += `<div class="bub cpy ${me ? 'me' : 'them'}">${me ? '' : '<span class="who">فريق الدعم</span>'}${esc(m.body)}<time>${hm(m.created_at)}</time></div>`;
    if (i === 0) html += `<div class="sysmsg">تم تقديم ${what} بنجاح ✓<br>${chat.msgs.some(x => x.sender === 'admin') ? 'فريق الدعم يتابع معك هنا.' : 'بانتظار رد فريق الدعم، سيصلك إشعار عند الرد.'}</div>`;
  });
  chat.pending.forEach(p => { html += `<div class="bub cpy me ${p.failed ? 'failed' : 'pending'}">${esc(p.body)}<time>${p.failed ? 'لم تُرسل' : 'جاري الإرسال'}</time></div>` });
  if (closed) html += `<div class="sysmsg">تم إغلاق التذكرة</div>`;
  box.innerHTML = html;
  if (scroll || nearBottom) box.scrollTop = box.scrollHeight;
}
async function sendChat() {
  const inp = document.getElementById('chat-in'), body = inp.value.trim();
  if (!body || !chat.id || chat.status === 'closed') return;
  if (offline()) return chatNet();   // v91: النت مطفي ← ما يتبعثش (الكلام يقعد في الخانة)
  inp.value = ''; inp.style.height = ''; inp.style.overflowY = '';
  const pend = { body, failed: false }; chat.pending.push(pend); renderChat(true);
  const id = chat.id;
  try {
    const mid = await rpc('send_ticket_message', { p_ticket: id, p_device: DEV, p_body: body });
    if (chat.id !== id) return;
    chat.pending.splice(chat.pending.indexOf(pend), 1);
    if (!chat.msgs.some(m => m.id === mid)) { chat.msgs.push({ id: mid, sender: 'customer', body, created_at: new Date().toISOString() }); chat.msgs.sort((a, b) => a.id - b.id) }
    if (chat.status === 'answered') chat.status = 'open';
    renderChat(true); tkThreadPut();   // v91
  } catch (e) {
    pend.failed = true; renderChat(true);
    toast(/closed/.test(e.message) ? 'التذكرة مغلقة' : /slow/.test(e.message) ? 'يُرجى الانتظار قليلاً قبل الإرسال.' : 'تعذر الإرسال.');
  }
}
document.getElementById('composer').addEventListener('submit', e => { e.preventDefault(); sendChat() });
document.getElementById('chat-in').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); sendChat() } });
/* v57: خانات الكتابة تكبر مع الكلام لين 6 أسطر، وبعدها تسحب داخلها (التذكرة، ملاحظات الطلب، وصف الموقع، المحادثة) */
const GROW = /^(chat-in|tk-body|ck-notes|af-desc)$/, GROW_LN = 6, lhMemo = {};
function lineH(cs) {
  const v = parseFloat(cs.lineHeight); if (v) return v;
  const k = cs.fontSize + '|' + cs.fontFamily; if (lhMemo[k]) return lhMemo[k];
  const s = document.createElement('div'); s.style.cssText = 'position:absolute;visibility:hidden;left:-9999px;top:0;padding:0;border:0;line-height:normal';
  s.style.fontSize = cs.fontSize; s.style.fontFamily = cs.fontFamily; s.innerHTML = 'ا<br>ا<br>ا';
  document.body.appendChild(s); const h = s.offsetHeight / 3; s.remove();
  return h ? (lhMemo[k] = h) : parseFloat(cs.fontSize) * 1.4;
}
function growTa(t) {
  if (!t || t.tagName !== 'TEXTAREA' || !t.isConnected || !t.offsetParent) return;
  const cs = getComputedStyle(t), bd = parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth);
  const max = Math.ceil(lineH(cs) * GROW_LN + parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom) + bd);
  t.style.height = 'auto';
  const h = Math.ceil(t.scrollHeight + bd);
  t.style.height = Math.min(max, h) + 'px';
  t.style.overflowY = h > max ? 'auto' : 'hidden';
}
document.addEventListener('input', e => { if (e.target && GROW.test(e.target.id)) growTa(e.target) });

/* sheets / toast / menu */
const sheet = document.getElementById('sheet'), scrim = document.getElementById('scrim');
/* v85: رقم النافذة: يزيد مع كل فتح وقفل. اللي يستنى رد (لحظة...) ياخذه قبل، ولو تبدّل أو النافذة تسكّرت ← ما يفتحش حاجة في وجه الزبونة */
var shGen = 0;
const shGone = g => g !== shGen || !sheet.classList.contains('on');
/* v89 (معتز: رمشة سودا لما النت مقطوع): نافذة «لحظة...» كانت تنفتح فوراً (مع التعتيم) وتتسكّر بعد أجزاء من الثانية لما الطلب يفشل.
   lazySheet: تنفتح بس لو الانتظار طوّل أكثر من 0.35 ث. فتحها ما يبدّلش shGen (هي جزء من نفس العملية)،
   فسكّرت/فتحت حاجة ثانية = shGen تبدّل ← gone(). close(): تسكّرها بس لو هي اللي ظاهرة */
function lazySheet(html, ms = 350, kind = 'bottom') {   // v98: kind ('bottom now' لصفحات الطلب)
  const g0 = shGen; let shown = false, t = setTimeout(() => { t = 0; if (shGen !== g0) return; openSheet(kind, html); shGen = g0; shown = true }, ms);
  const L = {
    stop() { if (t) { clearTimeout(t); t = 0 } },
    gone: () => shGen !== g0 || (shown && !sheet.classList.contains('on')),
    close() { L.stop(); if (shown && !L.gone()) closeSheet() },
  };
  return L;
}
/* v89: الزر يبهت ويتقفل أول ما تضغطه (باش تعرف إن الضغطة وصلت، والنافذة ممكن تتأخر 0.35 ث). يرجع بالدالة اللي ترجع */
function tapBusy(b) {
  if (!b || !b.classList) return () => {};
  b.classList.add('tapbusy'); b.setAttribute('aria-busy', 'true');
  return () => { b.classList.remove('tapbusy'); b.removeAttribute('aria-busy') };
}
const offline = () => navigator.onLine === false;   // v89: وضع الطيران / النت مطفي: الرسالة على طول بدون نافذة
function openSheet(kind, html, soft) {
  shGen = (shGen | 0) + 1;
  qpClose();   // v65
  const tst = document.getElementById('toast'); if (tst.dataset.live) tst.classList.remove('on');
  const was = scrim.classList.contains('on');
  sheet.className = 'sheet on ' + kind;
  sheet.innerHTML = `<button class="x" data-close aria-label="إغلاق">${ic('close')}</button>${html}`;
  scrim.classList.toggle('fade', !!soft && !was);   // v58: صفحة المنتج: التعتيم يجي بالتدريج مع النافذة (كان يطلع فجأة قبلها)
  sheet.scrollTop = 0; scrim.classList.add('on'); placeToast();
}
/* v53: نوافذ التأكيد من داخل الموقع (بدل نافذة المتصفح «يعرض موقع miracles.ly») */
let askRes = null;
function ask(title, text, ok, kind) {
  if (askRes) { const r = askRes; askRes = null; r(false) }
  return new Promise(res => {
    openSheet('bottom', `<h3>${esc(title)}</h3>${text ? `<p class="sub-note">${esc(text)}</p>` : ''}
      <button class="cta${kind === 'danger' ? ' danger' : ''}" data-askok>${esc(ok)}</button><button class="cta ghost" data-askno>رجوع</button>`);
    askRes = res;
  });
}
/* v69: رسالة اليوم تختفي بنعومة. النافذة نفسها تتسكّر فوراً زي قبل (ما يتغيرش أي شي في المتجر)،
   ونسخة منها للشكل بس (ما تنضغطش) تبهت تحت أي نافذة جديدة وتنشال بعد ربع ثانية */
function msgGhost() {
  if (calm() || !sheet.classList.contains('on') || !sheet.classList.contains('drop') || !sheet.querySelector('.msgttl')) return;
  const g = sheet.cloneNode(true), sc = scrim.cloneNode(false);
  [g, sc].forEach(x => { x.removeAttribute('id'); x.removeAttribute('role'); x.setAttribute('aria-hidden', 'true'); x.classList.add('ghost') });
  sheet.parentNode.insertBefore(sc, scrim); sheet.parentNode.insertBefore(g, scrim);
  g.scrollTop = sheet.scrollTop;
  setTimeout(() => { g.remove(); sc.remove() }, 300);
}
function closeSheet() { shGen = (shGen | 0) + 1; msgGhost(); qpClose(); if (askRes) { const r = askRes; askRes = null; r(false) } const ck = inCheckout(); sheet.classList.remove('on'); scrim.classList.remove('on'); placeToast(); if (maintOn) { if (ck) maintCk = true; setMaint(true) } if (typeof payBanner === 'function') payBanner() }
scrim.onclick = closeSheet;
function openMenu() {
  openSheet('side', `<h3 style="margin-top:30px">القائمة</h3><div class="menu">
    <a role="button" tabindex="0" data-go="home">الرئيسية</a>
    <a role="button" tabindex="0" data-go="products">المنتجات</a>
    ${catKids(null).map(c => `<a class="sub" role="button" tabindex="0" data-cat="${esc(c.id)}">${esc(c.name)}</a>`).join('')}
    <a role="button" tabindex="0" data-go="cart">السلة</a>
    <a role="button" tabindex="0" data-go="orders">طلباتي</a>
    <a role="button" tabindex="0" data-addr>عناويني</a>
    <a role="button" tabindex="0" data-go="support">خدمة العملاء</a>
    <a role="button" tabindex="0" data-go="account">حسابي</a></div>`);
}
let tt;
/* مكان الرسالة يتحدد حسب الصفحة الظاهرة الآن، ويتعدّل لو الصفحة تغيّرت والرسالة ظاهرة */
function placeToast() { const t = document.getElementById('toast'); if (t) t.classList.toggle('ttop', view === 'cart' && !sheet.classList.contains('on')) }
function toast(msg) {
  if (Date.now() < toastMute) return;   // v90: لحظة «انتهت الجلسة»: رسائل خطأ العملية اللي فشلت ما تطلعش فوق شاشة الدخول
  const t = document.getElementById('toast');
  if (t.classList.contains('on') && t.dataset.tmsg !== msg && !calm()) t.animate([{ opacity: .3, transform: 'translate(-50%,6px)' }, { opacity: 1, transform: 'translate(-50%,0)' }], { duration: 200, easing: 'ease-out' });   // رسالة تاخذ بلاصة رسالة: تبديل ناعم
  t.dataset.live = ''; t.dataset.tmsg = msg; t.innerHTML = `<span class="tm">${esc(msg)}</span><button class="tx" aria-label="إغلاق">${ic('close')}</button>`; placeToast(); t.classList.add('on'); t.classList.toggle('long', msg.length > 40);
  clearTimeout(tt); tt = setTimeout(() => t.classList.remove('on'), msg.length > 40 ? 6000 : 2000);
}
document.getElementById('v-map').addEventListener('input', e => { const r = e.target.closest('.afr'); if (r) r.classList.remove('err') });   // v45
document.getElementById('toast').addEventListener('click', e => { if (e.target.closest('.tx')) { clearTimeout(tt); e.currentTarget.classList.remove('on') } });
function waLink(text) { const n = digits(state.set.whatsapp); return n ? `https://wa.me/${n}?text=${encodeURIComponent(text || '')}` : '' }

/* events */
document.addEventListener('click', e => {
  const t = e.target.closest('[data-askok],[data-askno],[data-lvgo],[data-lvout],[data-pushon],[data-pushback],[data-pushtog],[data-msg],[data-cvway],[data-cvchange],[data-certs],[data-nbx],[data-share],[data-hsearch],[data-go],[data-cat],[data-chip],[data-add],[data-open],[data-fav],[data-menu],[data-close],[data-size],[data-color],[data-qty],[data-addp],[data-ci],[data-rm],[data-retry],[data-wa],[data-gi],[data-notes],[data-note],[data-kind],[data-tksend],[data-tkclose],[data-tk],[data-addr],[data-addrback],[data-addnew],[data-pick],[data-aedit],[data-adel],[data-mapback],[data-afcity],[data-afzone],[data-afpick],[data-asave],[data-auth],[data-guest],[data-later],[data-forgot],[data-aresend],[data-eye],[data-acc],[data-themetog],[data-qclear],[data-efix],[data-checkout],[data-dlvopen],[data-dlvpick],[data-dlvsave],[data-placeorder],[data-fixq],[data-rmp],[data-waitretry],[data-gonego],[data-policy],[data-polback],[data-cancelck],[data-cancelno],[data-cancelyes],[data-recolor],[data-fixshort],[data-catup],[data-trackorder],[data-orcpt],[data-nbanner],[data-soundtog],[data-oc],[data-rcpt],[data-rsave],[data-rshare],[data-sort],[data-av],[data-lbi],[data-lbx],[data-ofilt],[data-copy],[data-again],[data-ohelp],[data-cqclear],[data-goneback],[data-pmeth],[data-paynow],[data-payback],[data-payotp],[data-paycancel],[data-resend],[data-resendok],[data-resendno],[data-payresume],[data-cartclear],[data-oprod],#btn-ticket,#btn-faq');
  if (!t) return;
  const d = t.dataset;
  if (d.efix) { const i = document.getElementById('au-email'); i.value = d.efix; emailAsked = ''; document.getElementById('au-err').textContent = ''; return i.form.requestSubmit() }
  if (d.nbx !== undefined) { e.stopPropagation(); return hideBanner() }
  if (d.share) return shareProduct(d.share);
  if (d.hsearch !== undefined) { go('products'); const q = document.getElementById('q'); q.focus({ preventScroll: true }); return }
  if (d.auth === 'x') return hideAuth();
  if (d.auth) return showAuth(d.auth);
  if (d.guest !== undefined) { lsSet('mir_guest', true); pendingAfter = null; hideAuth(); return }
  if (d.later !== undefined) { pendingAfter = null; return closeSheet() }
  if (d.forgot !== undefined) { const i = document.getElementById('au-id'); if (i) { authId = i.value.trim(); rs.id = authId } return showAuth('forgot') }
  if (d.cvway) return cvSend(d.cvway, t);   // v46
  if (d.cvchange !== undefined) { authMode = 'pick'; return renderAuth() }
  if (d.aresend !== undefined) return resendCode(t);
  if (d.eye) {   // v49: مخفية = عين عليها خط، ظاهرة = عين مفتوحة
    const i = document.getElementById(d.eye), show = i.type === 'password'; i.type = show ? 'text' : 'password';
    t.innerHTML = ic(show ? 'eye' : 'eyeoff'); t.setAttribute('aria-label', show ? 'إخفاء كلمة السر' : 'إظهار كلمة السر');
    t.classList.remove('flip'); void t.offsetWidth; t.classList.add('flip'); return;
  }
  if (d.acc) return accAction(d.acc, t);
  if (d.themetog !== undefined) { setTheme(phone.dataset.theme === 'dark' ? 'light' : 'dark'); renderAccount(); return softSwap(document.getElementById('accv')) }
  if (d.qclear !== undefined) { clearSearch(); return document.getElementById('q').focus() }
  if (d.cat) return go('cat', d.cat);
  if (d.go) return go(d.go);
  if (d.chip) { curChip = d.chip; return renderCat() }
  if (d.notes !== undefined) return needLogin(openNotes) && openNotes();
  if (d.note !== undefined) { const n = notes[+d.note]; if (n && n.ref && (n.kind === 'ticket' || n.kind === 'order')) return openNote(n); return closeSheet() }
  if (d.nbanner !== undefined) { if (nbSwiped) return; const n = bannerNote; if (n && !n.read_at) rpc('read_notifications', { p_device: DEV }).then(loadNotes).catch(() => {}); return openNote(n) }
  if (d.soundtog !== undefined) { lsSet('mir_sound', !soundOn()); unlockAudio(); if (soundOn()) setTimeout(chime, 60); return renderAccount() }
  if (d.oc) return openOrderC(d.oc);
  if (d.ofilt) { oFilter = d.ofilt; const b = document.getElementById('ordv'); if (b && myOrders.length) { b.innerHTML = ordersListHTML(); softSwap(b) } return }
  if (d.copy) { const v = d.copy, done = () => { t.textContent = 'تم النسخ'; toast('تم نسخ رقم الطلب'); setTimeout(() => { t.textContent = 'نسخ الرقم' }, 1800) };
    try { navigator.clipboard.writeText(v).then(done, () => toast(v)) } catch (x) { toast(v) } return }
  if (d.again) return orderAgain(d.again);
  if (d.ohelp) return orderHelp(d.ohelp);
  if (d.cqclear !== undefined) { clearCatSearch(); return document.getElementById('cq').focus() }
  if (d.checkout !== undefined) return t.classList.contains('locked') ? penBlocked() : openCheckout(t);   // v89: الزر يبهت
  if (d.dlvopen !== undefined) { const o = document.querySelector('#ckdlv .ckdlv-o'); if (!o) return; const op = o.hidden; o.hidden = !op; t.setAttribute('aria-expanded', String(op)); if (op) dlvRadios(dlvGet()); return }   // v61
  if (d.dlvpick) return dlvRadios(Number(d.dlvpick));
  if (d.dlvsave !== undefined) { if (ckBusy) return busyNote(); if (!dlvTmp) return; dlvSet(dlvTmp); return dlvPaint() }
  if (d.placeorder !== undefined) return placeOrder(t);
  if (d.trackorder) return trackOrder(d.trackorder, false, t);
  if (d.orcpt) return trackOrder(d.orcpt, true, t);
  if (d.rcpt) return openReceipt(d.rcpt);
  if (d.rsave) return saveReceipt(d.rsave, false);
  if (d.rshare) return saveReceipt(d.rshare, true);
  if (d.kind) { tkKind = d.kind; t.parentElement.querySelectorAll('.opt').forEach(o => o.classList.toggle('on', o === t)); document.getElementById('tk-ordwrap').hidden = !['order', 'complaint'].includes(tkKind); return }
  if (d.tksend !== undefined) return submitTicket(t);
  if (d.tkclose !== undefined) return closeMyTicket(t);   // v56
  if (d.tk) return openChat(d.tk);
  if (d.addr !== undefined) { addrFrom = ['addr', 'map'].includes(view) ? addrFrom : view; return go('addr') }
  if (d.addrback !== undefined) return go(addrFrom || 'home');
  if (d.addnew !== undefined) return openMap(null);
  if (d.pick) return pickAddr(d.pick);
  if (d.aedit) return openMap(d.aedit);
  if (d.adel) return delAddr(d.adel);
  if (d.mapback !== undefined) return go('addr');
  if (d.afcity !== undefined) return afPick('city');
  if (d.afzone !== undefined) return afPick('zone');
  if (d.afpick) return afChoose(d.afpick, d.v);
  if (d.asave !== undefined) return saveAddr();
  if (d.gi !== undefined) return galGo(+d.gi);
  if (d.open) return openProduct(d.open);
  if (d.fav) { favs.has(d.fav) ? favs.delete(d.fav) : favs.add(d.fav); lsSet('mir_favs', [...favs]); t.classList.toggle('on'); syncFavs(); if (view === 'favs') renderFavs(); return }
  if (d.lbx !== undefined) return closeLB();
  if (d.lbi !== undefined) return openLB(pend ? pend.imgs : [], +d.lbi);
  if (d.certs !== undefined) return openLB(certList(), 0);
  if (d.sort) { sortBy = d.sort; renderSortbars(); if (view === 'cat') renderCat(); if (document.getElementById('q').value) runSearch(); return }
  if (d.add) { const p = byId(d.add); if (!p) return; if (choiceAttrs(p).length) return openProduct(p.id); if (!needLogin(() => addToCart(p, { qty: 1 }))) return; return addToCart(p, { qty: 1 }) }
  if (d.av !== undefined) {
    pend.opts[d.al] = d.av;
    t.parentElement.querySelectorAll('.opt').forEach(o => o.classList.toggle('on', o === t));
    const p = byId(pend.id), va = vattrOf(p);
    if (va && d.al === va) {
      document.getElementById('pqty').classList.remove('off'); const qh = document.getElementById('qhint'); if (qh) qh.remove();
      const rf = roomFor(p, d.av, undefined, pend.opts), room = rf.room;
      pend.qty = Math.max(1, Math.min(pend.qty, room || 1)); document.getElementById('pq').textContent = pend.qty;
      if (!room) toast(rf.qm || (rf.base > 0 ? HELDMSG : NOMORE));
    }
    return;
  }
  if (d.qty) {
    const p = byId(pend.id), va = vattrOf(p), v = va ? pend.opts[va] : '';
    if (va && !v) return toast('يُرجى اختيار ' + va + '.');
    const rf = roomFor(p, v, undefined, pend.opts), room = rf.room;
    const want = pend.qty + Number(d.qty);
    if (Number(d.qty) > 0 && want > room) { toast(rf.qm || (want <= rf.base ? HELDMSG : NOMORE)); return }
    pend.qty = Math.max(1, Math.min(MAXQ, want)); document.getElementById('pq').textContent = pend.qty; return;
  }
  if (d.addp !== undefined) {
    const p = byId(pend.id);
    const miss = choiceAttrs(p).find(a => !pend.opts[a.label]);
    if (miss) return toast('يُرجى اختيار ' + miss.label + '.');
    const o = { opts: { ...pend.opts }, qty: pend.qty }, rk = pend.replace;
    if (!needLogin(() => addToCart(p, o))) return;
    if (addToCart(p, o) && rk) { cart = cart.filter(x => x.key !== rk); saveCart(); if (view === 'cart') renderCartView() }
    return closeSheet();
  }
  if (d.ci !== undefined) {
    const l = cart[+d.ci]; if (!l) return;
    if (Number(d.d) > 0) {   // v65: السلة تلتزم بالمتوفر (ناقص المحجوز لغيرها)
      const p = byId(l.id), rf = p ? roomFor(p, varOf(p, l.opts), l.key, l.opts) : { room: MAXQ, base: MAXQ };
      if (l.qty + 1 > rf.room) return toast(roomMsg(rf, l.qty));
    }
    l.qty = Math.max(1, Math.min(MAXQ, l.qty + Number(d.d))); saveCart(); return renderCartView();
  }
  if (d.fixq) { const p = byId(d.fixq); capCart([{ id: d.fixq, v: d.fv || '', n: leftOf(p, d.fv || '') || 0 }]); toast('تم تعديل الكمية'); return renderCartView() }
  if (d.rmp) { const card = t.closest('.ccard'), ls = cart.filter(l => String(l.id) === String(d.rmp)); return rmLines(ls).then(res => { if (res) collapse(card, () => { cart = cart.filter(l => !ls.includes(l)); saveCart(); toast(res.counted ? 'تم حذف المنتج. تم إيقاف حجز المنتجات محدودة الكمية 30 دقيقة.' : 'تم حذف المنتج'); renderCartView() }) }) }
  if (d.waitretry !== undefined) return waitRetry(t);
  if (d.gonego !== undefined) return goneGo();
  if (d.pmeth !== undefined) {   // v69: تتعلّم في مكانها بدون إعادة رسم النافذة (كانت ترجع لفوق)
    if (t.disabled) return; pay = pay || {}; pay.method = Number(d.pmeth);
    sheet.querySelectorAll('.pmeth').forEach(b => { const on = b === t; b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on)) });
    const pm = document.getElementById('pmsg'); if (pm) { pm.innerHTML = ''; pm.classList.remove('pm-on') }   // نفس اللي كانت تديره إعادة الرسم
    return;
  }
  if (d.paynow !== undefined) return payNow(t);
  if (d.payback !== undefined) return cancelBack();
  if (d.payresume !== undefined) { if (t.dataset.hold === '1' && !paypLeft(state.payp)) return needLogin(openCheckout) && openCheckout(); return needLogin(payResume) && payResume() }   // v65: شريط «وقت الدفع» ← «تأكيد الطلب» بنفس الحجز
  if (d.askok !== undefined) { const r = askRes; askRes = null; closeSheet(); if (r) r(true); return }
  if (d.askno !== undefined) return closeSheet();
  if (d.cartclear !== undefined) return cartClear();
  if (d.oprod !== undefined) { const l = t.closest('.oprods').querySelector('.oplist'), open = l.hidden; l.hidden = !open; t.setAttribute('aria-expanded', open); t.firstChild.textContent = open ? 'إخفاء المنتجات ' : 'عرض المنتجات '; t.classList.toggle('on', open); return }
  if (d.goneback !== undefined) { closeSheet(); go('cart'); return flashCart(goneIds) }
  if (d.policy) return openPolicy(d.policy, d.back);
  if (d.polback) return policyBack(d.polback);
  if (d.cancelck !== undefined) return cancelAsk();
  if (d.msg !== undefined) return openMsg();
  if (d.cancelno !== undefined) return payStep();
  if (d.cancelyes !== undefined) return cancelDo(t);
  if (d.lvgo !== undefined) return leaveGo();     // v97
  if (d.pushon !== undefined) {
    if (d.pushon === 'done' && PUSH_OK && Notification.permission === 'default') return pushAskSheet('okask');   // v102: نافذتنا أول
    if (d.pushon === 'acc') { closeSheet(); if (view === 'account') pushSwitch(true); return pushEnable() }      // v102: من نافذة «حسابي»
    let b = t;
    if (d.pushon === 'okask') { okBack(); b = sheet.querySelector('[data-pushon="done"]'); if (!b) return pushEnable() }   // v102: ترجع لـ«تم استلام طلبك» والزر يشتغل
    if (d.pushon === 'ask') closeSheet(); else { b.disabled = true; b.textContent = 'جارٍ التفعيل...' }
    return pushEnable().then(ok => { if (!ok && b.isConnected) { b.disabled = false; b.textContent = 'تفعيل الإشعارات' } }) }
  if (d.pushback !== undefined) return okBack();                                               // v102: «لاحقاً» من «تم استلام طلبك»
  if (d.pushtog !== undefined) return pushToggle();                                          // v98. v101: المفتاح يتحرّك على طول
  if (d.lvout !== undefined) return leaveOut(t);  // v97
  if (d.recolor !== undefined) { const l = cart[+d.recolor]; if (!l) return; openProduct(l.id); if (pend) { pend.replace = l.key; pend.qty = l.qty; const q = document.getElementById('pq'); if (q) q.textContent = l.qty } return }
  if (d.fixshort) return fixShort(d.fixshort);
  if (d.catup !== undefined) { const c = catById(curCat); return c && c.parent_id && catById(c.parent_id) ? go('cat', c.parent_id) : go('products') }
  if (d.rm !== undefined) {
    const card = t.closest('.ccard'), one = card && card.querySelectorAll('.crow').length <= 1, row = !one && (t.closest('.crow') || t.closest('.cwarn')?.previousElementSibling);
    const line = cart[+d.rm];   // v53
    return rmLines([line]).then(res => { if (res) collapse(one ? card : row, () => { const k = cart.indexOf(line); if (k >= 0) cart.splice(k, 1); saveCart(); toast(res.counted ? 'تم حذف المنتج. تم إيقاف حجز المنتجات محدودة الكمية 30 دقيقة.' : 'تم حذف المنتج'); renderCartView() }) });
  }
  if (d.menu !== undefined) return openMenu();
  if (d.close !== undefined) return closeSheet();
  if (d.retry !== undefined) return loadData();
  if (d.wa !== undefined) { const u = waLink(d.wa); if (u) window.open(u, '_blank'); return }
  if (t.id === 'btn-ticket') return user ? openTicketForm() : ticketGuest();   // v66: الزائر ما يفتحش تذكرة
  if (t.id === 'btn-faq') { const f = document.getElementById('faq'); f.hidden = !f.hidden; return }   // v91 (معتز): بدون نزول تلقائي (كان smoothTo لعند الأسئلة)
});
document.addEventListener('input', e => {
  const t = e.target;
  if (!t || !/^(INPUT|TEXTAREA)$/.test(t.tagName) || /^(file|checkbox|radio|password)$/.test(t.type)) return;
  const v = t.value, n = toEn(v);
  if (n !== v) { const p = t.selectionStart; t.value = n; try { t.setSelectionRange(p, p) } catch (x) {} }
}, true);
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { if (!document.getElementById('lb').hidden) return closeLB(); closeSheet() }
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.menu a, .mo-it.link, #nbanner')) { e.preventDefault(); e.target.click() }
});

/* ===== v42: رقم إصدار الموقع. بعد أي رفع، اللي فاتحين الموقع يوصلهم الجديد وحده في لحظة آمنة =====
   app-version.json (في GitHub، يتسلّم مع كل نسخة) لازم يساوي APP_V هنا. يسأل لما ترجع للصفحة وكل 3 دقائق.
   لو فيه أحدث: يتحدّث لما ترجع للموقع، أو مع أول تنقّل (ويفتح نفس الصفحة اللي ضغطت عليها).
   ما يتحدّثش في إتمام الطلب أو الدفع أو نافذة مفتوحة أو وهي تكتب. ومحاولة وحدة بس لكل رقم (ما يدخلش في دوامة). */
const APP_V = 106;   // v51: لازم يساوي ?v= متاع app.js في index.html و app-version.json
let updV = 0, updAt = 0;
function updSafe() {
  if (sheet.classList.contains('on') || !document.getElementById('authv').hidden) return false;
  if (pay || state.payp || holdEnd > Date.now() || qActive() || ckBusy || lsGet('mir_paygo', null)) return false;
  if (['chat', 'addr', 'map'].includes(view)) return false;
  const a = document.activeElement; if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) return false;
  return true;
}
async function updCheck(now, boot) {
  if ((document.hidden && !boot) || (!now && Date.now() - updAt < 170000)) return;   // v83: boot = فحص الفتحة الأولى، يسأل حتى لو الصفحة مخفية
  updAt = Date.now();
  try {
    const t0 = Date.now(), r = await fetch('/app-version.json?t=' + t0, { cache: 'no-store' });
    { const d = Date.parse(r.headers.get('date') || ''), mid = (t0 + Date.now()) / 2; if (d > 0) { const off = d - mid; clockOff = Math.abs(off) > 30000 ? off : 0 } }   // v56
    const v = r.ok ? Number((await r.json()).v) || 0 : 0;
    if (v > APP_V && Number(sessionStorage.getItem('mir_updv')) !== v) updV = v;
  } catch (e) {}
}
/* v87: النت ضعيف ← كانت الضغطة تستنى swFresh حتى 5 ث (ما يصير شي) وبعدها تعاود الفتح بالقديمة.
   توا: لو الجديدة ما تخزّنتش خلال 1.5 ث (أو فشلت): نتنقّلوا عادي، وما نعاودوش نحاولوا مع الضغطات دقيقة (updPause) */
let updBusy = false, updPause = 0;
function updGo(to, cat) {
  if (!updV || !updSafe() || updBusy || Date.now() < updPause) return false;
  try { sessionStorage.setItem('mir_updv', String(updV)); if (to) sessionStorage.setItem('mir_updto', JSON.stringify([to, cat || null])) } catch (e) { return false }
  updBusy = true;
  Promise.race([swFresh(), pause(1500).then(() => null)]).then(ok => {
    if (ok) return location.replace(location.pathname + location.search);   // v51: الصفحة المخزنة تتبدل بالجديدة قبل إعادة الفتح
    updBusy = false; updPause = Date.now() + 60000;
    try { sessionStorage.removeItem('mir_updv'); sessionStorage.removeItem('mir_updto') } catch (e) {}
    if (to && (to !== view || (to === 'cat' && cat !== curCat))) go(to, cat);
  });
  return true;
}
/* ===== v51: Service Worker (sw.js): الموقع يتخزن في الموبايل ويفتح منه (زي التطبيق)، والبيانات دايماً من السيرفر ===== */
const SW_SHELL = 'mir-shell';
/* v87: ترجع true لو الصفحة الجديدة تخزّنت **ومعاها app.js متاعها** (قبل: الصفحة تتخزّن والكود لا ← النت يطيح ← صفحة بدون كود).
   false = النت ما لحقش / فشل (ولا حاجة اتبدلت في المخزن) */
async function swFresh() {
  try {
    if (!('caches' in window)) return true;
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 5000);
    try {
      const r = await fetch('/', { cache: 'no-store', signal: ctl.signal });
      if (!r.ok) return false;
      const m = (await r.clone().text()).match(/\/app\.js\?v=\d+/);
      if (m) {
        const st = await caches.open('mir-static');   // نفس اسم المخزن في sw.js (STATIC)
        if (!(await st.match(m[0]))) { const j = await fetch(m[0], { cache: 'no-store', signal: ctl.signal }); if (!j.ok) return false; await st.put(m[0], j) }
      }
      await (await caches.open(SW_SHELL)).put('/', r);
      return true;
    } finally { clearTimeout(t) }
  } catch (e) { return false }
}
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  const swReg = () => setTimeout(() => navigator.serviceWorker.register('/sw.js').catch(() => {}), 2500);
  if (document.readyState === 'complete') swReg(); else window.addEventListener('load', swReg);   // v70: app.js ممكن يوصل بعد load (إعادة التحميل)
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) updCheck(true).then(() => updGo()) });
window.addEventListener('pageshow', e => { if (e.persisted) updCheck(true).then(() => updGo()) });
setInterval(() => updCheck(), 30000);
setTimeout(() => updCheck(true), 8000);
/* v81: أول ما المتجر يفتح يسأل على طول. لو فيه نسخة أحدث والشاشة لسا ظاهرة: يجيب الجديدة ويعاود يفتح تحتها
   (الزبونة تشوف الشعار بس)، والصفحة الجديدة تكمل الوقت الباقي (mir_spend). لو الشاشة اختفت قبل الرد: زي قبل (أول تنقّل).
   مرة وحدة لكل رقم (mir_updv)، وما يعاودش الفتح وقت الرجوع من الدفع */
(async function bootUpd() {
  const sp = document.getElementById('splash'); if (!sp || sp.classList.contains('out')) return;   // v83: .out = اختفت فعلاً (dataset.out ممكن يكون بس متجدول)
  try { if (new URL(location.href).searchParams.get('pay') || lsGet('mir_paygo', null) || lsGet('mir_payafter', null)) return } catch (e) { return }
  await updCheck(true, true);   // v83: التطبيق يبدا والصفحة مخفية (تحت شاشة أندرويد): نسألوا ونبدّلوا وهي مخفية، فلما تبان تكون الجديدة جاهزة
  if (!updV || sp.classList.contains('out')) return;   // v83: كان dataset.out ← المتجر يجهز من المخزن قبل الرد فيحسبها خلصت وهي لسا ظاهرة 2 ث
  clearTimeout(spHideT);   // v83: نلغوا الاختفاء المتجدول (سكربت الترحيب في index.html ما يشيلهاش: يشوف dataset.out)
  try { sessionStorage.setItem('mir_updv', String(updV)); sessionStorage.setItem('mir_spend', String(Date.now() + Math.max(0, SP_MIN - performance.now()))) } catch (e) { return }
  sp.dataset.out = '1';   // ما تختفيش (ما فيه .out)؛ بس باش splashHide وسكربت الترحيب ما يشيلوهاش قبل إعادة الفتح
  const v = updV; updV = 0; updBusy = true;   // v83: التحديث بدا هني؛ فحص «الصفحة بانت» (visibilitychange) ما يعاودوش
  // v87: نستنوا الصفحة الجديدة + app.js متاعها بس للوقت الباقي من الشاشة (0.8 ث على الأقل). النت ضعيف ← نكمّلوا بالحالية والتحديث بعدين
  const ok = await Promise.race([swFresh(), pause(Math.max(800, SP_MIN - performance.now())).then(() => null)]);
  if (ok) return location.replace(location.pathname + location.search);
  updV = v; updBusy = false; updPause = Date.now() + 60000;
  try { sessionStorage.removeItem('mir_updv'); sessionStorage.removeItem('mir_spend') } catch (e) {}
  delete sp.dataset.out;
  if (performance.now() >= SP_MAX - 30) splashHide();   // موعد splashHide (SP_MAX) فات وهي متعلّمة ← نشيلوها توا (وإلا الموعد يشيلها)
})();
function updRestore() {
  let t = null; try { t = JSON.parse(sessionStorage.getItem('mir_updto') || 'null'); sessionStorage.removeItem('mir_updto') } catch (e) {}
  if (Array.isArray(t) && ['products', 'cat', 'cart', 'orders', 'account', 'favs', 'support', 'home'].includes(t[0]) && (t[0] !== 'cat' || catById(t[1]))) { if (t[0] === 'cat') go('cat', t[1]); else go(t[0]) }
}

ordLoad();   // v44
updateBadge();
payBack();   // v70 (رقم 9)
if (window.__nav && DEEP) { DEEP = null; try { history.replaceState(null, '', '/') } catch (e) {} }   // v70: ضغطت الشريط قبل الكود: اختيارها يكسب على رابط المنتج (ما يتفتحش ويتقفل)
loadData().then(() => { afterHome(preCovers); payReturn(); setTimeout(payLastCheck, 2500); pushDeepURL(); setTimeout(() => pushSync(true), 4000); setTimeout(() => pushAskTry(0), 3500); if (PUSH_OK && !pushOn()) setTimeout(() => pushPub().catch(() => {}), 2000); /* v101: مفتاح المتجر جاهز قبل الضغطة */ updRestore(); if (!seenV.has('v-products')) warmView('v-products') });
setTimeout(payReturn, 5000);   // لو الكتالوج تأخر: التأكد من الدفع ما يستناش
hello();   // الحساب يتربط بالجهاز
window.addEventListener('pageshow', e => { if (e.persisted) { if (pay) pay.busy = false; payReturn(true) } });   // رجعت من صفحة الدفع بزر الرجوع   // أول زيارة: نعاودوا لما يوصل الكتالوج
requestAnimationFrame(() => setTimeout(warmAll, 0));
afterHome(preSupport);
afterHome(() => { const q = document.querySelector('.quote-img[data-src]'); if (q) { q.src = q.dataset.src; q.removeAttribute('data-src') } });   // v51: صورة الاقتباس بعد صور الشاشة
/* صورة الرئيسية: لو اتحملت قبل في هذا الجهاز تبان فوراً، وإلا تبان بنعومة فوق النسخة المضببة لما توصل */
(function heroIn() {
  const h = [...document.querySelectorAll('.hero.has-img, .au-top')]; if (!h.length) return;
  const KEY = 'mir_hero28', show = now => { h.forEach(x => { if (now) x.classList.add('hb-now'); x.classList.add('hb-on') }); lsSet(KEY, 1) };
  const im = new Image(); im.src = window.__hero || HERO_DEF;   // v75: الصورة اللي اختارها من اللوحة
  if (im.complete || lsGet(KEY, 0)) return show(true);
  (im.decode ? im.decode() : Promise.reject()).then(() => show(false), () => { im.onload = () => show(false); if (im.complete) show(false) });
})();
try { localStorage.removeItem('mir_vday') } catch (e) {}   // v66
if (user) loadProfile().catch(() => {});
else if (!lsGet('mir_guest', false) && !DEEP) showAuth('welcome');
if (window.__authQ && !user) { const q = window.__authQ; window.__authQ = null; showAuth(q) }   // v51: ضغطت «تسجيل الدخول»/«إنشاء حساب» قبل ما الكود يوصل
loadNotes();
/* v50: لو ضغطت على شريط التنقل قبل ما الكود يوصل: نكمّلوا من الصفحة اللي اختارتها */
window.__ready = 1;
if (window.__nav) { const nv = window.__nav, el = document.getElementById('v-' + nv); window.__nav = null;
  // v70: الكود الصغير (قبل ما يوصل هذا الكود) يبدّل الرئيسية/المنتجات بنفسه. نبدوا من الصفحة الظاهرة فعلاً،
  //      فلو الصفحة المطلوبة ما تفتحتش (زائرة ← نافذة الدخول)، تقعد هي والتلوين يرجعلها (مش للرئيسية)
  const shownV = ((document.querySelector('.view.on') || {}).id || '').slice(2);
  if (shownV !== view && ['home', 'products'].includes(shownV)) { goQuiet = true; try { go(shownV) } finally { goQuiet = false } }
  if (el) { goQuiet = el.classList.contains('on'); try { go(nv) } finally { goQuiet = false } }
  const navV = { support: 'account', chat: 'account', favs: '' }[view] ?? view;
  document.querySelectorAll('.nav button').forEach(b => b.classList.toggle('on', b.dataset.nav === navV)) }

/* ===== v71: زر الرجوع (أندرويد/المتصفح/السحب في الآيفون) — قرار معتز:
   داخل الصفحة يرجع خطوة بخطوة (الصور ← النافذة ← القسم ← المنتجات)، وصفحات الشريط: نازلة لتحت ← لفوق الأول، ومن فوق ← الرئيسية،
   ومن الرئيسية يطلع من المتجر. النوافذ (والدفع) تتقفل بالزبط زي القفل العادي (الضغط برا النافذة).
   الطريقة: خطوة وحدة بس عند المتصفح («فخ») طول ما فيه حاجة نرجعولها. الرجوع ياخذها، ونديروا الخطوة الصح من حالة المتجر نفسها،
   ونرجعوا نحطوها لو مازال فيه رجوع. لو الزبونة رجعت للرئيسية بيدها (زر الإغلاق، الشريط)، الخطوة تنشال باش ما يقعدش رجوع «ميت» */
const TABS = ['products', 'cart', 'orders', 'account'];
let navTrap = false, navIgnore = 0, navT = 0, navTopAt = 0;
function navBackAction() {
  if (!lbEl.hidden) return closeLB;                                                           // الصور
  if (document.getElementById('qpop')) return qpClose;                                        // الاختيار السريع
  if (sheet.classList.contains('on')) {                                                       // نافذة
    const pb = sheet.querySelector('[data-polback]');                                         // السياسة المفتوحة من الطلب/الإيصال ← ترجع لهم
    return pb ? () => pb.click() : closeSheet;
  }
  const a = document.getElementById('authv');
  if (!a.hidden && !a.classList.contains('leaving')) {                                        // شاشة الدخول
    const b = a.querySelector('.au-head [aria-label="رجوع"]');
    if (b) return () => b.click();                                                            // خطوة لورا (للترحيب، أو للخطوة اللي قبلها)
    const g = a.querySelector('[data-guest]');
    return lsGet('mir_guest', false) && g ? () => g.click() : null;                           // الترحيب: زائرة كانت تتصفح ← ترجع للمتجر. جديدة ← تطلع
  }
  const q = document.getElementById('q'), cq = document.getElementById('cq');
  if (view === 'products' && q && q.value) return clearSearch;                                // البحث
  if (view === 'cat' && cq && cq.value) return () => { cq.value = ''; runCatSearch() };
  const el = document.getElementById(view === 'cat' ? 'v-cat' : 'v-' + view);
  if (TABS.includes(view)) {                                                                  // صفحات الشريط: لفوق الأول، وبعدها الرئيسية
    if (el && el.scrollTop > 40 && Date.now() - navTopAt > 700) return () => { navTopAt = Date.now(); el.scrollTo({ top: 0, behavior: calm() ? 'auto' : 'smooth' }) };
    return () => go('home');
  }
  if (view === 'home') return ckOpen() && !leaveSkip ? () => leaveAsk('exit') : null;      // الرئيسية ← يطلع. v97: طلب لم يكتمل ← التنبيه أول (مرة)
  const hb = el && el.querySelector('header [aria-label="رجوع"]');                            // باقي الصفحات: نفس زر الرجوع اللي فوق
  return hb ? () => hb.click() : () => go('home');
}
/* v85: معتز: الرجوع الأخير (المنتجات/حسابي ← الرئيسية) يطلّع من التطبيق. السبب الأرجح: حماية Chrome — الخطوة اللي نعاودوا نحطوها
   بعد زر الرجوع (بدون لمسة على الشاشة) تخلي Chrome يعلّم اللي تحتها «تتنط»، فالرجوع الجاي يطلع برا.
   الحل في أندرويد: CloseWatcher (زر الرجوع في Chrome يسكّره بدل ما يرجع في السجل). وحدة بس في كل وقت، ونعاودوا نعملوها بعد كل رجوع
   (Chrome يسمح بوحدة بدون لمسة). الفخ القديم في السجل يقعد زي ما هو (احتياط لو الجهاز ما يدعمهاش، والمتصفح في الكمبيوتر ما يتغيرش). */
const NAV_CW = typeof window.CloseWatcher === 'function' && /Android/i.test(navigator.userAgent);
let navCW = null;
function navCWSync(want) {
  if (!NAV_CW) return;
  if (want && !navCW) {
    try {
      const w = new CloseWatcher(); navCW = w;
      w.onclose = () => {
        if (navCW !== w) return;
        navCW = null;
        const act = navBackAction();
        if (act) { try { act() } catch (e) {} }
        navSoon();                                                                             // يعاود يعملها لو مازال فيه رجوع
      };
    } catch (e) { navCW = null }
  } else if (!want && navCW) { const w = navCW; navCW = null; try { w.destroy() } catch (e) {} }
}
function navSync() {
  clearTimeout(navT); navT = 0;
  navCWSync(!!navBackAction());                                                               // v85
  if (navIgnore) return;                                                                      // ننتظروا رجوع الكود يكمّل
  const want = !!navBackAction();
  if (want && !navTrap) { try { history.pushState({ mirBack: 1 }, ''); navTrap = true } catch (e) {} }
  else if (!want && navTrap) { navTrap = false; navIgnore++; history.back() }
}
function navSoon() { clearTimeout(navT); navT = setTimeout(navSync, 60) }
addEventListener('popstate', () => {
  if (navIgnore) { navIgnore--; navSoon(); return }                                           // هذا رجوع الكود نفسه (شال الخطوة)
  navTrap = false;
  const act = navBackAction();
  if (act) { try { act() } catch (e) {} }
  navSoon();
});
addEventListener('pageshow', e => { if (e.persisted) { navIgnore = 0; navTrap = !!(history.state && history.state.mirBack); navSoon() } });
document.addEventListener('click', navSoon, true);                                            // أي ضغطة (تتشاف بعد ما تخلص)
document.addEventListener('input', navSoon, true);                                            // الكتابة في البحث
{ const w = f => function () { const r = f.apply(this, arguments); navSoon(); return r };   // اللي يتفتح أو يتقفل لحاله (بعد الدخول، رابط منتج، الدفع)
  go = w(go); openSheet = w(openSheet); closeSheet = w(closeSheet); showAuth = w(showAuth); hideAuth = w(hideAuth); renderAuth = w(renderAuth); openLB = w(openLB); closeLB = w(closeLB) }
navSoon();

