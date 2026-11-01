import { STAGES, STAGE_SHORT, MONTHS, ICONS } from './constants';
import type { ProgramReport, ProgramItem } from './types';

export const esc = (s: any) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c));

export const xesc = (s: any) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const clone = <T>(o: T): T => JSON.parse(JSON.stringify(o));

export const num = (v: any) => {
  const n = parseFloat(String(v ?? '').replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))));
  return isNaN(n) ? 0 : n;
};

export const has = (v: any) => String(v ?? '').trim() !== '';

export const nine = () => Array(9).fill('');

export function hijriParts(iso: string) {
  if (!iso) return null;
  const d = new Date(iso + 'T12:00:00');
  if (isNaN(d.getTime())) return null;
  try {
    const f = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', {
      day: 'numeric',
      month: 'numeric',
      year: 'numeric'
    }).formatToParts(d);
    const g = (t: string) => (f.find((x) => x.type === t) || {}).value;
    const y = parseInt(g('year') || '0', 10);
    return { d: +(g('day') || '0'), m: +(g('month') || '0'), y };
  } catch (e) {
    return null;
  }
}

export const hijri = (iso: string) => {
  const h = hijriParts(iso);
  return h ? `\u200F${h.d}\u200F/\u200F${h.m}\u200F/\u200F${h.y}` : '';
};

export const progFromOf = (p: ProgramReport) => p.progFrom || p.progDate || '';

export function progDays(p: ProgramReport) {
  const a = progFromOf(p);
  const b = p.progTo || a;
  if (!a) return 0;
  const n = Math.round((new Date(b + 'T12:00:00').getTime() - new Date(a + 'T12:00:00').getTime()) / 864e5) + 1;
  return n > 0 ? n : 0;
}

export const daysAr = (n: number) =>
  n === 1 ? 'يوم واحد' : n === 2 ? 'يومان' : n >= 3 && n <= 10 ? `${n} أيام` : `${n} يومًا`;

export const progDurOf = (p: ProgramReport) =>
  (p.progDur || '').trim() || (progDays(p) ? daysAr(progDays(p)) : '');

export function gregParts(iso: string) {
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map(Number);
  return y ? { d, m, y } : null;
}

export const calOf = (p: any) =>
  p && (p.progCal === 'g' || p.cal === 'g' || p.h_cal === 'g') ? 'g' : 'h';

export const partsOf = (p: any, iso: string) =>
  calOf(p) === 'g' ? gregParts(iso) : hijriParts(iso);

export const sufOf = (p: any) => (calOf(p) === 'g' ? 'م' : 'هـ');

export function ensureIso(val: string): string {
  if (!val) return '';
  const s = String(val).trim().replace(/[\u200E\u200F]/g, '');
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const parts = s.replace(/[^\d/]/g, '').split('/').map(Number);
  if (parts.length === 3) {
    let d = parts[0], m = parts[1], y = parts[2];
    if (d > 1000) { y = parts[0]; m = parts[1]; d = parts[2]; }
    if (y > 1400 && y < 1600) {
      const conv = hijriToIso(d, m, y);
      if (conv) return conv;
    } else if (y > 1900 && y < 2200) {
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }
  return '';
}

export function fmtReportDate(val: string, cal: 'h' | 'g' = 'h', withSuffix = true): string {
  if (!val) return '';
  const s = String(val).trim().replace(/[\u200E\u200F]/g, '');
  let iso = ensureIso(s);
  const suf = withSuffix ? (cal === 'g' ? 'م' : 'هـ') : '';
  if (iso && /^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    if (cal === 'g') {
      const g = gregParts(iso);
      return g ? `\u200F${g.d}\u200F/\u200F${g.m}\u200F/\u200F${g.y}${suf}` : s;
    } else {
      const h = hijriParts(iso);
      return h ? `\u200F${h.d}\u200F/\u200F${h.m}\u200F/\u200F${h.y}${suf}` : s;
    }
  }
  return s + (withSuffix && !s.endsWith('هـ') && !s.endsWith('م') ? (cal === 'g' ? 'م' : 'هـ') : '');
}

export function formatDateRange(fromVal: string, toVal: string, cal: 'h' | 'g' = 'h'): string {
  const f = fmtReportDate(fromVal, cal, false);
  const t = fmtReportDate(toVal, cal, false);
  const suf = cal === 'g' ? 'م' : 'هـ';
  if (!f && !t) return '';
  if (!t || t === f) return `\u200F${f}${suf}`;
  return `\u200Fمن ${f}${suf} إلى ${t}${suf}`;
}

export const fmtOne = (p: ProgramReport, iso: string) => {
  const h = partsOf(p, iso);
  return h ? `\u200F${h.d}\u200F/\u200F${h.m}\u200F/\u200F${h.y}` : '';
};

export function progRange(p: ProgramReport) {
  const a = progFromOf(p);
  const b = p.progTo;
  if (!a) return '';
  const ha = partsOf(p, a);
  const hb = partsOf(p, b || a);
  if (!ha) return '';
  if (!b || b === a) return `\u200F${ha.d}\u200F/\u200F${ha.m}\u200F/\u200F${ha.y}`;
  if (!hb) return `\u200F${ha.d}\u200F/\u200F${ha.m}\u200F/\u200F${ha.y}`;
  return ha.y === hb.y
    ? `\u200F${ha.d}\u200F/\u200F${ha.m} - \u200F${hb.d}\u200F/\u200F${hb.m}\u200F/\u200F${hb.y}`
    : `\u200F${ha.d}\u200F/\u200F${ha.m}\u200F/\u200F${ha.y} - \u200F${hb.d}\u200F/\u200F${hb.m}\u200F/\u200F${hb.y}`;
}

export const progDateText = (p: ProgramReport) => {
  const a = progFromOf(p);
  const b = p.progTo;
  const x = sufOf(p);
  if (!a) return '';
  return b && b !== a
    ? `\u200Fمن ${fmtOne(p, a)}${x} إلى ${fmtOne(p, b)}${x}`
    : `\u200F${fmtOne(p, a)}${x}`;
};

export const otherCalText = (p: ProgramReport) => {
  const q = Object.assign({}, p, { progCal: calOf(p) === 'g' ? 'h' : 'g' }) as ProgramReport;
  return progDateText(q);
};

export function hijriToIso(d: number, m: number, y: number) {
  const jd = Math.floor((11 * y + 3) / 30) + 354 * y + 30 * m - Math.floor((m - 1) / 2) + d + 1948440 - 385;
  const base = new Date(Date.UTC(1970, 0, 1) + (jd - 2440588) * 864e5);
  for (let off = 0; off <= 6; off++) {
    for (const sg of [1, -1]) {
      const t = new Date(base.getTime() + sg * off * 864e5);
      const iso = t.toISOString().slice(0, 10);
      const h = hijriParts(iso);
      if (h && h.d === d && h.m === m && h.y === y) return iso;
    }
  }
  return null;
}

export const evLabelOf = (p: ProgramReport, n: number) =>
  (n === 1 ? p.ev1Label : p.ev2Label) ||
  (p.evLayout === '2' ? 'الشاهد ' + (n === 1 ? 'الأول' : 'الثاني') : 'الشواهد');

export const firstNum = (v: any) => {
  const m = String(v || '').replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).match(/\d+/);
  return m ? m[0] : '';
};

export function stageSums(arr: string[]) {
  const s = [0, 1, 2].map((k) => num(arr[k * 3]) + num(arr[k * 3 + 1]) + num(arr[k * 3 + 2]));
  return { s, t: s[0] + s[1] + s[2], any: arr.some(has) };
}

export function totals(list: ProgramItem[]) {
  const ps = list.filter((p) => has(p.name));
  return {
    n: ps.length,
    ben: ps.reduce((a, p) => a + num(p.ben), 0),
    gifted: ps.reduce((a, p) => a + num(p.gifted), 0)
  };
}

export const lines = (t: string) =>
  String(t || '').split('\n').map((s) => s.trim()).filter(Boolean);

export function qr(url: string) {
  try {
    const qrcodeFn = (window as any).qrcode;
    if (!qrcodeFn) return '';
    const q = qrcodeFn(0, 'M');
    q.addData(url);
    q.make();
    return q.createDataURL(6, 2);
  } catch (e) {
    return '';
  }
}

export const fname = (s: string) =>
  String(s).replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, ' ').trim();

export const fmtD = (t: number) => {
  try {
    return new Date(t).toLocaleDateString('ar-u-ca-islamic-umalqura-nu-latn', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  } catch (e) {
    return new Date(t).toLocaleDateString();
  }
};

export function dataUrlBytes(u: string) {
  const s = atob(u.split(',')[1]);
  const a = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i);
  return a;
}
