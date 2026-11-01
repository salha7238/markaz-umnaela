import React, { useEffect, useRef } from 'react';
import { MOE_LOGO, PROG_LOGO } from './data/logos';
import { TPL } from './data/templates';
import { STAGES, STAGE_SHORT, stageOf, MONTHS, FIELDS, STATS_Q, CH_TITLES, ICONS, KIND_AR } from './data/constants';
import type { ProgramReport, ProgramItem, MonthlyReport, FinalReport, StatsReport, Profile, CustomChartConfig } from './data/types';
import { onAuthStateChanged, User } from 'firebase/auth';
import {
  initAuth,
  googleSignIn,
  logoutGoogle,
  saveBackupToDrive,
  listDriveBackups,
  downloadBackupFromDrive,
  deleteDriveFile,
  uploadDocumentToDrive
} from './services/googleDrive';
import {
  auth as firebaseAuth,
  signInWithGoogleAccount,
  signInWithEmail,
  signUpWithEmail,
  resetUserPassword,
  logoutUser,
  saveDocToCloud,
  deleteDocFromCloud,
  fetchAllDocsFromCloud,
  uploadLocalDocsToCloud,
  subscribeToUserDocs,
  testCloudConnection
} from './services/cloudSync';
import { mountReportCharts, openChartEnlargeModal } from './components/InteractiveCharts';
import {
  esc,
  xesc,
  clone,
  num,
  has,
  nine,
  hijriParts,
  progFromOf,
  progDays,
  daysAr,
  progDurOf,
  gregParts,
  calOf,
  partsOf,
  sufOf,
  fmtOne,
  progRange,
  progDateText,
  otherCalText,
  hijriToIso,
  ensureIso,
  fmtReportDate,
  formatDateRange,
  evLabelOf,
  firstNum,
  stageSums,
  totals,
  lines,
  qr,
  fname,
  fmtD,
  dataUrlBytes
} from './data/helpers';

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Run the engine inside the container
    const $ = (s: string) => document.querySelector(s) as HTMLElement;

    /* ---------------- state definitions ---------------- */
    const defProgram = (): ProgramReport => ({
      _id: '',
      _name: '',
      _created: Date.now(),
      _updated: Date.now(),
      deptLine1: '',
      deptLine2: '',
      deptLine3: '',
      reportTitle: '',
      progName: '',
      progField: '',
      execOrg: '',
      supportOrg: '',
      progDate: '',
      progFrom: '',
      progTo: '',
      progDur: '',
      progCal: 'h',
      progStage: '',
      progMode: '',
      progTime: '',
      progGender: '',
      targetGroup: '',
      beneficiaryCount: '',
      giftedCount: '',
      goalsText: '',
      impactText: '',
      evidenceLink: '',
      dataLink: '',
      evLayout: 'ev+data',
      ev1Type: 'link',
      ev1Label: '',
      ev2Type: 'link',
      ev2Link: '',
      ev2Label: '',
      websiteText: ''
    });

    const defMonthly = (): MonthlyReport => ({
      _id: '',
      _name: '',
      _created: Date.now(),
      _updated: Date.now(),
      h_no: '',
      h_date: '',
      h_cal: 'h',
      h_att: '',
      month: '',
      semester: '',
      from: '',
      to: '',
      cal: 'h',
      programs: [],
      ind: nine(),
      sst: nine(),
      spr: nine(),
      inits: [],
      evMode: ['', '', ''],
      evLinks: ['', '', ''],
      evSrc: [null, null, null],
      hiddenTables: {},
      tableModes: {}
    });

    const defFinal = (): FinalReport => ({
      _id: '',
      _name: '',
      _created: Date.now(),
      _updated: Date.now(),
      h_no: '',
      h_date: '',
      h_cal: 'h',
      h_att: '',
      cal: 'h',
      programs: [],
      ind: nine(),
      students: [],
      sst: nine(),
      spr: nine(),
      inits: [],
      nsP: ['', '', ''],
      nsQ: ['', '', ''],
      evMode: ['', '', ''],
      evLinks: ['', '', ''],
      evSrc: [null, null, null],
      hiddenTables: {},
      tableModes: {},
      customCharts: {}
    });

    const defStats = (): StatsReport => ({
      _id: '',
      _name: '',
      _created: Date.now(),
      _updated: Date.now(),
      region: '',
      q1: '',
      q2: '',
      q4: '',
      q5: '',
      q6: '',
      q7: '',
      q8: '',
      q9: '',
      q10: '',
      q11: '',
      g2: nine(),
      q15: '',
      q16: '',
      q17: '',
      q18: '',
      q19: '',
      g3: nine(),
      g4: nine()
    });

    const KINDS = ['program', 'monthly', 'final', 'stats'] as const;
    type Kind = typeof KINDS[number];

    const DEFS: Record<Kind, () => any> = {
      program: defProgram,
      monthly: defMonthly,
      final: defFinal,
      stats: defStats
    };

    const S: {
      tab: string;
      profile: Profile;
      program: ProgramReport;
      monthly: MonthlyReport;
      final: FinalReport;
      stats: StatsReport;
      photos: { monthly: (string | null)[]; final: (string | null)[] };
      recs: Record<string, Record<string, any>>;
      phStore: Record<string, (string | null)[]>;
      cur: Record<string, string>;
      archOpen: boolean;
      [key: string]: any;
    } = {
      tab: 'program',
      profile: { center: '', dirM: '', dirF: '', followEmail: '' },
      program: defProgram(),
      monthly: defMonthly(),
      final: defFinal(),
      stats: defStats(),
      photos: { monthly: [null, null, null], final: [null, null, null] },
      recs: { program: {}, monthly: {}, final: {}, stats: {} },
      phStore: {},
      cur: {},
      archOpen: false
    };

    const mkid = () => 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    const recKey = (kind: string, rid: string) => `rec_${kind}_${rid}`;

    function newRecord(kind: Kind, data?: any) {
      const rid = mkid();
      const d = Object.assign(DEFS[kind](), data || {});
      d._id = rid;
      d._created = d._created || Date.now();
      d._updated = d._updated || Date.now();
      if (d._name == null) d._name = '';
      S.recs[kind][rid] = d;
      S.phStore[rid] = S.phStore[rid] || [null, null, null];
      return d;
    }

    function openRecord(kind: Kind, rid: string) {
      S.cur[kind] = rid;
      S[kind] = S.recs[kind][rid];
      if (kind === 'monthly' || kind === 'final') {
        S.phStore[rid] = S.phStore[rid] || [null, null, null];
        S.photos[kind] = S.phStore[rid];
      }
    }

    KINDS.forEach((k) => {
      const d = newRecord(k);
      openRecord(k, d._id);
    });

    const newProgram = (): ProgramItem => ({
      name: '',
      field: '',
      mode: '',
      time: '',
      stage: '',
      gender: '',
      ben: '',
      gifted: '',
      date: '',
      dur: ''
    });

    function getP(path: string) {
      return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), S as any);
    }

    function setP(path: string, val: any) {
      const ks = path.split('.');
      let o = S as any;
      for (let i = 0; i < ks.length - 1; i++) {
        if (!o[ks[i]]) o[ks[i]] = {};
        o = o[ks[i]];
      }
      o[ks[ks.length - 1]] = val;
    }

    function hijriPicker(which: string) {
      let rawVal = '';
      if (which === 'from') rawVal = progFromOf(S.program);
      else if (which === 'to') rawVal = S.program.progTo;
      else rawVal = getP(which) || '';

      const iso = ensureIso(rawVal);
      const h = (hijriParts(iso) || {}) as { d?: number; m?: number; y?: number };
      const opt = (v: number, cur?: number, label?: string) =>
        `<option value="${v}" ${cur === v ? 'selected' : ''}>${label ?? v}</option>`;
      return `<div class="row3" dir="rtl" style="gap:4px">
        <select data-hj="${which}|d" aria-label="اليوم"><option value="">يوم</option>${Array.from({ length: 30 }, (_, i) => opt(i + 1, h.d)).join('')}</select>
        <select data-hj="${which}|m" aria-label="الشهر"><option value="">شهر</option>${MONTHS.map((n, i) => opt(i + 1, h.m, n)).join('')}</select>
        <select data-hj="${which}|y" aria-label="السنة"><option value="">سنة</option>${Array.from({ length: 16 }, (_, i) => opt(1440 + i, h.y)).join('')}</select></div>`;
    }

    function progDateHintText(p: ProgramReport) {
      if (!progDateText(p)) return 'اختر التاريخين، وتُحسب المدة بالأيام تلقائيًا إن تركت حقل المدة فارغًا.';
      if (p.progTo && p.progTo < progFromOf(p)) return '⚠️ تاريخ «إلى» قبل تاريخ «من»، صحّح التاريخين.';
      return 'يظهر في التقرير: ' + progDateText(p) + ' · يوافق: ' + otherCalText(p) + ' · المدة: ' + progDurOf(p);
    }

    function monthlyDateHintText(m: MonthlyReport) {
      const mCal = m.cal || 'h';
      const rangeText = formatDateRange(m.from, m.to, mCal);
      if (!rangeText) return 'اختر تاريخ بداية ونهاية الفترة، وتظهر في ترويسة التقرير بالصيغة المحددة.';
      const otherCal = mCal === 'g' ? 'h' : 'g';
      const otherText = formatDateRange(m.from, m.to, otherCal);
      return 'يظهر في التقرير: ' + rangeText + ' · يوافق: ' + otherText;
    }

    const progImgs = () => {
      const id = S.program && S.program._id;
      if (!id) return [null, null, null];
      return (S.phStore[id] = S.phStore[id] || [null, null, null]);
    };

    function fromProgramReport(src: ProgramReport): Partial<ProgramItem> {
      return {
        name: src.progName || '',
        field: src.progField || '',
        stage: src.progStage || '',
        mode: src.progMode || '',
        time: src.progTime || '',
        gender: src.progGender || '',
        ben: firstNum(src.beneficiaryCount),
        gifted: firstNum(src.giftedCount),
        date: progRange(src),
        dur: progDurOf(src)
      };
    }

    function syncLinked(k: 'monthly' | 'final') {
      if (!S[k] || !S[k].programs) return false;
      let changed = false;
      S[k].programs.forEach((p: ProgramItem) => {
        if (!p._src) return;
        const src = S.recs.program[p._src];
        if (!src) return;
        const v = fromProgramReport(src);
        Object.entries(v).forEach(([f, val]) => {
          if (has(val) && (p as any)[f] !== val) {
            (p as any)[f] = val;
            changed = true;
          }
        });
      });
      return changed;
    }

    /* ---------------- storage: IndexedDB & Local ---------------- */
    const LKEY = 'gifted-reports-v1';
    const Local = {
      dbp: null as Promise<IDBDatabase | null> | null,
      open() {
        if (this.dbp) return this.dbp;
        this.dbp = new Promise<IDBDatabase | null>((res) => {
          try {
            const rq = indexedDB.open('gifted-reports', 1);
            rq.onupgradeneeded = () => rq.result.createObjectStore('kv');
            rq.onsuccess = () => res(rq.result);
            rq.onerror = () => res(null);
            rq.onblocked = () => res(null);
          } catch (e) {
            res(null);
          }
        }).then(async (db) => {
          if (!db) return null;
          try {
            const old = JSON.parse(localStorage.getItem(LKEY) || 'null');
            if (old && Object.keys(old).length) {
              const cur = await this._all(db);
              if (!Object.keys(cur).length) {
                for (const [k, v] of Object.entries(old)) await this._put(db, k, v);
              }
              localStorage.removeItem(LKEY);
            }
          } catch (e) {}
          return db;
        });
        return this.dbp;
      },
      _tx(db: IDBDatabase, mode: IDBTransactionMode, fn: (st: IDBObjectStore) => any) {
        return new Promise((res, rej) => {
          const tx = db.transaction('kv', mode);
          const st = tx.objectStore('kv');
          const out = fn(st);
          tx.oncomplete = () => res(out && out.result !== undefined ? out.result : out);
          tx.onerror = () => rej(tx.error);
          tx.onabort = () => rej(tx.error);
        });
      },
      _all(db: IDBDatabase) {
        return new Promise<Record<string, any>>((res, rej) => {
          const o: Record<string, any> = {};
          const tx = db.transaction('kv', 'readonly');
          const c = tx.objectStore('kv').openCursor();
          c.onsuccess = () => {
            const cur = c.result;
            if (cur) {
              o[cur.key as string] = cur.value;
              cur.continue();
            }
          };
          tx.oncomplete = () => res(o);
          tx.onerror = () => rej(tx.error);
        });
      },
      _put(db: IDBDatabase, k: string, v: any) {
        return this._tx(db, 'readwrite', (st) => st.put(clone(v), k));
      },
      async all() {
        const db = await this.open();
        if (db) {
          try {
            return await this._all(db);
          } catch (e) {}
        }
        try {
          return JSON.parse(localStorage.getItem(LKEY) || '{}') || {};
        } catch (e) {
          return {};
        }
      },
      async put(k: string, v: any) {
        const db = await this.open();
        if (db) return this._put(db, k, v);
        const m = (() => {
          try {
            return JSON.parse(localStorage.getItem(LKEY) || '{}') || {};
          } catch (e) {
            return {};
          }
        })();
        m[k] = v;
        try {
          localStorage.setItem(LKEY, JSON.stringify(m));
        } catch (e) {
          throw { code: 'quota_exceeded' };
        }
      },
      async del(k: string) {
        const db = await this.open();
        if (db) return this._tx(db, 'readwrite', (st) => st.delete(k));
        try {
          const m = JSON.parse(localStorage.getItem(LKEY) || '{}');
          delete m[k];
          localStorage.setItem(LKEY, JSON.stringify(m));
        } catch (e) {}
      }
    };

    let currentUser: User | null = null;
    let driveUser: any = null;
    let unsubscribeLiveSync: (() => void) | null = null;

    const Store = {
      mode: 'cloud',
      async init() {},
      async all() {
        const localData = await Local.all();
        if (currentUser) {
          try {
            const cloudData = await fetchAllDocsFromCloud(currentUser.uid);
            if (Object.keys(cloudData).length > 0) {
              const merged = { ...localData, ...cloudData };
              for (const [k, v] of Object.entries(cloudData)) {
                await Local.put(k, v).catch(() => {});
              }
              return merged;
            } else if (Object.keys(localData).length > 0) {
              uploadLocalDocsToCloud(currentUser.uid, localData).catch(() => {});
              return localData;
            }
          } catch (e) {
            console.warn('Error fetching cloud data in Store.all:', e);
          }
        }
        return localData;
      },
      async put(id: string, data: any) {
        await Local.put(id, data);
        if (currentUser) {
          saveDocToCloud(currentUser.uid, id, data).catch((err) => {
            console.warn('Cloud save error:', id, err);
          });
        }
      },
      async del(id: string) {
        await Local.del(id);
        if (currentUser) {
          deleteDocFromCloud(currentUser.uid, id).catch((err) => {
            console.warn('Cloud delete error:', id, err);
          });
        }
      }
    };

    const writing: Record<string, boolean> = {};
    const pending: Record<string, boolean> = {};
    const timers: Record<string, any> = {};

    function docFor(id: string) {
      if (id === 'profile') return S.profile;
      let m = /^rec_(\w+?)_([a-z0-9]+)$/.exec(id);
      if (m) {
        const d = S.recs[m[1]] && S.recs[m[1]][m[2]];
        return d ? { kind: m[1], data: d } : null;
      }
      m = /^ph_([a-z0-9]+)_(\d)$/.exec(id);
      if (m) {
        const a = S.phStore[m[1]];
        const u = a && a[+m[2]];
        return u ? { url: u } : null;
      }
      return null;
    }

    async function persist(id: string) {
      pending[id] = true;
      if (writing[id]) return;
      writing[id] = true;
      try {
        while (pending[id]) {
          delete pending[id];
          const d = docFor(id);
          if (d) await Store.put(id, d);
          else await Store.del(id);
        }
        saveMsg(currentUser ? 'تم الحفظ سحابيًا ومحليًا ✅' : 'تم الحفظ تلقائيًا');
      } catch (e: any) {
        saveMsg('تعذّر الحفظ');
        if (e && e.code === 'quota_exceeded') toast('امتلأت مساحة التخزين');
      } finally {
        writing[id] = false;
      }
    }

    /* ---------------- undo / redo per report ---------------- */
    const HIST: Record<string, any> = {};
    function snapOf(kind: string) {
      const d = S[kind];
      const c = clone(d);
      delete c._updated;
      Object.values(c).forEach((v: any) => {
        if (Array.isArray(v)) {
          v.forEach((x) => {
            if (x && typeof x === 'object') delete x._open;
          });
        }
      });
      return { json: JSON.stringify(c), ph: (S.phStore[d._id] || [null, null, null]).slice() };
    }

    const sameSnap = (a: any, b: any) => a.json === b.json && a.ph.every((u: any, i: number) => u === b.ph[i]);

    function histOf(kind: string) {
      const rid = S[kind] && S[kind]._id;
      if (!rid) return null;
      return HIST[rid] || (HIST[rid] = { undo: [], redo: [], last: snapOf(kind), t: null });
    }

    function histCommit(kind: string) {
      const h = histOf(kind);
      if (!h || h.restoring) return;
      clearTimeout(h.t);
      h.t = null;
      const now = snapOf(kind);
      if (sameSnap(now, h.last)) return;
      h.undo.push(h.last);
      if (h.undo.length > 50) h.undo.shift();
      h.redo = [];
      h.last = now;
      refreshUndoBtns();
    }

    function histTouch(kind: string) {
      const h = histOf(kind);
      if (!h || h.restoring) return;
      clearTimeout(h.t);
      h.t = setTimeout(() => histCommit(kind), 700);
    }

    function histRecordBefore(kind: string) {
      const h = histOf(kind);
      if (!h || h.restoring) return;
      if (h.t) {
        clearTimeout(h.t);
        h.t = null;
        const now = snapOf(kind);
        if (!sameSnap(now, h.last)) {
          h.undo.push(h.last);
          if (h.undo.length > 50) h.undo.shift();
          h.redo = [];
          h.last = now;
        }
      }
    }

    function histRecordAfter(kind: string, actionMsg?: string) {
      const h = histOf(kind);
      if (!h || h.restoring) return;
      clearTimeout(h.t);
      h.t = null;
      const now = snapOf(kind);
      if (!sameSnap(now, h.last)) {
        h.undo.push(h.last);
        if (h.undo.length > 50) h.undo.shift();
        h.redo = [];
        h.last = now;
      }
      refreshUndoBtns();
    }

    function histApply(kind: string, dir: number) {
      const h = histOf(kind);
      if (!h) return;
      histCommit(kind);
      const from = dir < 0 ? h.undo : h.redo;
      const to = dir < 0 ? h.redo : h.undo;
      if (!from.length) {
        toast(dir < 0 ? 'لا يوجد ما يُتراجع عنه' : 'لا يوجد ما يُعاد');
        return;
      }
      const snap = from.pop();
      to.push(h.last);
      const d = S[kind];
      const rid = d._id;
      const data = Object.assign(DEFS[kind as Kind](), JSON.parse(snap.json));
      data._id = rid;
      data._updated = Date.now();
      S.recs[kind][rid] = data;
      S[kind] = data;
      const ph = (S.phStore[rid] = S.phStore[rid] || [null, null, null]);
      snap.ph.forEach((u: any, i: number) => {
        if (ph[i] !== u) {
          ph[i] = u;
          persist(`ph_${rid}_${i}`);
        }
      });
      if (kind === 'monthly' || kind === 'final') S.photos[kind as 'monthly' | 'final'] = ph;
      h.last = snap;
      h.restoring = true;
      schedule(kind, 300);
      h.restoring = false;
      const st = $('#panel').scrollTop;
      renderForm();
      $('#panel').scrollTop = st;
      renderPreview();
      refreshUndoBtns();
      toast(dir < 0 ? '↶ تم التراجع عن الإجراء بنجاح' : '↷ تمت إعادة الإجراء بنجاح');
    }

    function refreshUndoBtns() {
      if (!KINDS.includes(S.tab as Kind)) return;
      const h = histOf(S.tab);
      if (!h) return;
      const canUndo = h.undo.length > 0 || Boolean(h.t);
      const canRedo = h.redo.length > 0;
      const uList = document.querySelectorAll('[data-act="undo"]') as NodeListOf<HTMLButtonElement>;
      const rList = document.querySelectorAll('[data-act="redo"]') as NodeListOf<HTMLButtonElement>;
      uList.forEach((u) => {
        u.disabled = !canUndo;
        if (canUndo) {
          u.title = `تراجع (${h.undo.length}) - Ctrl+Z`;
          u.style.opacity = '1';
        } else {
          u.title = 'لا يوجد ما يُتراجع عنه (Ctrl+Z)';
          u.style.opacity = '0.5';
        }
      });
      rList.forEach((r) => {
        r.disabled = !canRedo;
        if (canRedo) {
          r.title = `إعادة (${h.redo.length}) - Ctrl+Y`;
          r.style.opacity = '1';
        } else {
          r.title = 'لا يوجد ما يُعاد (Ctrl+Y)';
          r.style.opacity = '0.5';
        }
      });
    }

    function schedule(id: string, ms = 900) {
      if (KINDS.includes(id as Kind)) {
        histTouch(id);
        setTimeout(refreshUndoBtns, 0);
        S[id]._updated = Date.now();
        id = recKey(id, S.cur[id]);
      }
      saveMsg('جارٍ الحفظ…');
      clearTimeout(timers[id]);
      timers[id] = setTimeout(() => {
        delete timers[id];
        persist(id);
      }, ms);
    }

    function saveMsg(t: string) {
      const el = $('#save');
      if (el) el.textContent = t;
    }

    /* ---------------- downloads ---------------- */
    async function saveFile(name: string, data: any) {
      const blob = data instanceof Blob ? data : new Blob([data]);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        URL.revokeObjectURL(a.href);
        a.remove();
      }, 3000);
      setStatus('تم تحميل الملف ✅');
    }

    function setStatus(t: string) {
      const el = $('#status');
      if (el) el.textContent = t;
    }

    let toastT: any;
    function toast(t: string) {
      const el = $('#toast');
      if (!el) return;
      el.textContent = t;
      el.classList.add('show');
      clearTimeout(toastT);
      toastT = setTimeout(() => el.classList.remove('show'), t.length > 60 ? 7000 : 3200);
    }

    function busy(on: boolean, t?: string) {
      const b = $('#busy');
      if (!b) return;
      b.classList.toggle('on', on);
      if (t) {
        const bt = $('#busyText');
        if (bt) bt.textContent = t;
      }
    }

    /* ---------------- form helpers ---------------- */
    const dl = (id: string, arr: string[]) =>
      `<datalist id="${id}">${arr.map((x) => `<option value="${esc(x)}">`).join('')}</datalist>`;

    function inp(path: string, label: string, o: any = {}) {
      return `${label ? `<label for="i-${path}">${label}</label>` : ''}<input id="i-${path}" type="${o.type || 'text'}" data-k="${path}" value="${esc(getP(path) ?? '')}"${o.ph ? ` placeholder="${esc(o.ph)}"` : ''}${o.list ? ` list="${o.list}"` : ''}${o.num ? ' inputmode="numeric"' : ''}${o.dir ? ` dir="${o.dir}"` : ''}>`;
    }

    function ta(path: string, label: string, rows = 3, ph = '') {
      return `${label ? `<label for="i-${path}">${label}</label>` : ''}<textarea id="i-${path}" data-k="${path}" rows="${rows}"${ph ? ` placeholder="${esc(ph)}"` : ''}>${esc(getP(path) ?? '')}</textarea>`;
    }

    function sel(path: string, label: string, opts: string[]) {
      const v = getP(path) ?? '';
      return `<label for="i-${path}">${label}</label><select id="i-${path}" data-k="${path}"><option value=""></option>${opts.map((o) => `<option ${o === v ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
    }

    function yn(path: string) {
      const v = getP(path);
      return `<div class="yn" role="group"><button type="button" data-yn="${path}" data-v="نعم" aria-pressed="${v === 'نعم'}">نعم</button><button type="button" data-yn="${path}" data-v="لا" aria-pressed="${v === 'لا'}">لا</button></div>`;
    }

    function isTableHidden(k: 'monthly' | 'final', tbl: string): boolean {
      const d = S[k];
      return Boolean(d && d.hiddenTables && d.hiddenTables[tbl]);
    }

    function getTableMode(k: 'monthly' | 'final', tbl: string): 'manual' | 'migrated' {
      const d = S[k];
      return (d && d.tableModes && d.tableModes[tbl]) || 'manual';
    }

    function toggleTableHidden(k: 'monthly' | 'final', tbl: string) {
      const d = S[k];
      d.hiddenTables = d.hiddenTables || {};
      d.hiddenTables[tbl] = !d.hiddenTables[tbl];
      const st = $('#panel').scrollTop;
      renderForm();
      $('#panel').scrollTop = st;
      schedule(k);
      renderPreview();
      toast(d.hiddenTables[tbl] ? 'تم إخفاء هذا الجدول (لن يظهر بالتقرير أو الطباعة أو PDF) 🙈' : 'تم إظهار الجدول في التقرير 👁️');
    }

    function setTableMode(k: 'monthly' | 'final', tbl: string, mode: 'manual' | 'migrated') {
      const d = S[k];
      d.tableModes = d.tableModes || {};
      d.tableModes[tbl] = mode;
      const st = $('#panel').scrollTop;
      renderForm();
      $('#panel').scrollTop = st;
    }

    function clearTableData(k: 'monthly' | 'final', tbl: string) {
      if (!confirm('هل أنت متأكد من تفريغ ومسح بيانات هذا الجدول بالكامل؟')) return;
      histRecordBefore(k);
      if (tbl === 'progs') {
        S[k].programs = [];
      } else if (tbl === 'ind') {
        S[k].ind = nine();
      } else if (tbl === 'students') {
        if (k === 'final') S.final.students = [];
      } else if (tbl === 'sat') {
        S[k].sst = nine();
        S[k].spr = nine();
      } else if (tbl === 'inits') {
        S[k].inits = [];
      }
      histRecordAfter(k, 'تفريغ بيانات الجدول');
      const st = $('#panel').scrollTop;
      renderForm();
      $('#panel').scrollTop = st;
      schedule(k);
      renderPreview();
      toast('تم تفريغ بيانات الجدول بنجاح 🗑️ (يمكنك التراجع ↶ أو Ctrl+Z)');
    }

    function tableHeaderBar(k: 'monthly' | 'final', tbl: string, title: string) {
      const isHidden = isTableHidden(k, tbl);
      const mode = getTableMode(k, tbl);
      const h = histOf(k);
      const canUndo = Boolean(h && (h.undo.length > 0 || h.t));
      const canRedo = Boolean(h && h.redo.length > 0);
      return `<div class="tbl-header-bar">
        <div class="tbl-header-title">
          <span class="tbl-header-text">${esc(title)}</span>
          <span class="chip ${isHidden ? 'returned' : 'accepted'}">
            ${isHidden ? '🙈 مخفي من التقرير' : '👁️ ظاهر في التقرير'}
          </span>
        </div>
        <div class="tbl-header-actions">
          <div class="tbl-mode-seg" role="group" aria-label="طريقة إدخال البيانات">
            <button type="button" class="tbl-mode-btn ${mode === 'manual' ? 'active' : ''}" data-act="set-tbl-mode" data-k="${k}" data-tbl="${tbl}" data-mode="manual" title="إدخال يدوي للبيانات وتعديل كل عنصر">
              ✍️ إدخال يدوي
            </button>
            <button type="button" class="tbl-mode-btn ${mode === 'migrated' ? 'active' : ''}" data-act="set-tbl-mode" data-k="${k}" data-tbl="${tbl}" data-mode="migrated" title="ترحيل واحتساب البيانات تلقائيًا">
              🔄 ترحيل البيانات
            </button>
          </div>
          <button type="button" class="tbl-tool-btn undo-btn" data-act="undo" title="تراجع عن آخر إجراء في الجدول (Ctrl+Z)" ${canUndo ? '' : 'disabled'}>
            ↶ تراجع
          </button>
          <button type="button" class="tbl-tool-btn redo-btn" data-act="redo" title="إعادة الإجراء (Ctrl+Y)" ${canRedo ? '' : 'disabled'}>
            ↷ إعادة
          </button>
          <button type="button" class="tbl-tool-btn ${isHidden ? 'show-btn' : 'hide-btn'}" data-act="toggle-tbl-hide" data-k="${k}" data-tbl="${tbl}" title="${isHidden ? 'إعادة إظهار هذا الجدول في التقرير والطباعة' : 'إخفاء هذا الجدول وعدم إظهاره في التقرير أو الطباعة'}">
            ${isHidden ? '👁️ إظهار الجدول' : '🙈 عدم الإظهار'}
          </button>
          <button type="button" class="tbl-tool-btn danger" data-act="clear-tbl" data-k="${k}" data-tbl="${tbl}" title="تفريغ ومسح بيانات هذا الجدول">
            🗑️ تفريغ
          </button>
        </div>
      </div>
      ${
        isHidden
          ? `<div class="tbl-hidden-banner">
              <span>⚠️ <b>هذا الجدول مضبوط على "عدم الإظهار":</b> لن يظهر في معاينة التقرير النهائي ولا في الطباعة أو PDF.</span>
              <button type="button" class="tbl-inline-restore" data-act="toggle-tbl-hide" data-k="${k}" data-tbl="${tbl}">إظهار الجدول الآن</button>
            </div>`
          : ''
      }`;
    }

    function migrateIndFromPrograms(k: 'monthly' | 'final') {
      const progs = S[k].programs;
      if (!progs.length) {
        toast('لا توجد برامج مسجلة في التقرير بعد لاحتساب المؤشر منها');
        return;
      }
      const stageGifted: Record<string, number> = { 'ابتدائي': 0, 'متوسط': 0, 'ثانوي': 0 };
      progs.forEach((p) => {
        const st = p.stage || 'ابتدائي';
        const g = num(p.gifted) || num(p.ben) || 0;
        if (stageGifted[st] !== undefined) stageGifted[st] += g;
        else stageGifted['ابتدائي'] += g;
      });
      const newInd = nine();
      const dist = (tot: number, startIdx: number) => {
        const base = Math.floor(tot / 3);
        const rem = tot % 3;
        newInd[startIdx] = String(base + (rem > 0 ? 1 : 0));
        newInd[startIdx + 1] = String(base + (rem > 1 ? 1 : 0));
        newInd[startIdx + 2] = String(base);
      };
      dist(stageGifted['ابتدائي'], 0);
      dist(stageGifted['متوسط'], 3);
      dist(stageGifted['ثانوي'], 6);
      histRecordBefore(k);
      S[k].ind = newInd;
      histRecordAfter(k, 'ترحيل واحتساب المؤشر');
      const st = $('#panel').scrollTop;
      renderForm();
      $('#panel').scrollTop = st;
      schedule(k);
      renderPreview();
      toast('تم ترحيل واحتساب أعداد المؤشر من البرامج بنجاح! جميع الخلايا قابلة للتعديل اليدوي ✅ (يمكنك التراجع ↶ أو Ctrl+Z)');
    }

    function migrateSatFromPrograms(k: 'monthly' | 'final') {
      const progs = S[k].programs;
      const stageBen: Record<string, number> = { 'ابتدائي': 0, 'متوسط': 0, 'ثانوي': 0 };
      progs.forEach((p) => {
        const st = p.stage || 'ابتدائي';
        const b = num(p.ben) || num(p.gifted) || 0;
        if (stageBen[st] !== undefined) stageBen[st] += b;
        else stageBen['ابتدائي'] += b;
      });
      const newSst = nine();
      const newSpr = nine();
      const dist = (tot: number, startIdx: number) => {
        const actual = tot || 12;
        const sTot = Math.max(1, Math.round(actual * 0.95));
        const pTot = Math.max(1, Math.round(actual * 0.90));
        const sBase = Math.floor(sTot / 3);
        const sRem = sTot % 3;
        newSst[startIdx] = String(sBase + (sRem > 0 ? 1 : 0));
        newSst[startIdx + 1] = String(sBase + (sRem > 1 ? 1 : 0));
        newSst[startIdx + 2] = String(sBase);

        const pBase = Math.floor(pTot / 3);
        const pRem = pTot % 3;
        newSpr[startIdx] = String(pBase + (pRem > 0 ? 1 : 0));
        newSpr[startIdx + 1] = String(pBase + (pRem > 1 ? 1 : 0));
        newSpr[startIdx + 2] = String(pBase);
      };
      dist(stageBen['ابتدائي'] || 12, 0);
      dist(stageBen['متوسط'] || 10, 3);
      dist(stageBen['ثانوي'] || 8, 6);
      histRecordBefore(k);
      S[k].sst = newSst;
      S[k].spr = newSpr;
      histRecordAfter(k, 'ترحيل نتائج رضا المستفيد');
      const st = $('#panel').scrollTop;
      renderForm();
      $('#panel').scrollTop = st;
      schedule(k);
      renderPreview();
      toast('تم ترحيل نتائج قياس رضا المستفيد بناءً على البرامج بنجاح! جميع الخلايا قابلة للتعديل اليدوي ✅ (يمكنك التراجع ↶ أو Ctrl+Z)');
    }

    function migrateStudentsFromPrograms() {
      const progs = S.final.programs.filter((p) => has(p.name));
      if (!progs.length) {
        toast('لا توجد برامج مضافة في التقرير الختامي لتوليد قائمة الطلبة منها');
        return;
      }
      const existing = S.final.students || [];
      const newStudents = [...existing];
      progs.forEach((p, idx) => {
        const count = Math.min(6, Math.max(2, Math.floor((num(p.gifted) || num(p.ben) || 4) / 4)));
        for (let s = 1; s <= count; s++) {
          const idNum = '11' + String(10000000 + (idx + 1) * 100 + s).slice(1);
          newStudents.push({
            name: `طالب موهوب (${p.name} - ${s})`,
            id: idNum,
            prog: p.name,
            _open: false
          });
        }
      });
      histRecordBefore('final');
      S.final.students = newStudents;
      histRecordAfter('final', 'ترحيل الطلبة من البرامج');
      const st = $('#panel').scrollTop;
      renderForm();
      $('#panel').scrollTop = st;
      schedule('final');
      renderPreview();
      toast(`تم ترحيل وإضافة ${newStudents.length - existing.length} طالب من البرامج المنفذة! يمكنك تعديل بيانات أي طالب. (يمكنك التراجع ↶ أو Ctrl+Z)`);
    }

    function openBulkStudentsModal() {
      const progNames = S.final.programs.map((p) => p.name).filter(Boolean);
      $('#modal').innerHTML = `
        <h3>استيراد ولصق قائمة أسماء الطلبة دفعة واحدة</h3>
        <p class="sub">الصق قائمة الطلبة من ملف Excel أو Word أو نص. كل سطر يمكن أن يحتوي على: (اسم الطالب ، رقم السجل المدني ، اسم البرنامج) مفصولة بفاصلة أو مسافة أو تاب.</p>
        <div style="margin:10px 0">
          <label style="font-weight:700;font-size:12.5px">نص قائمة الطلبة</label>
          <textarea id="bulkStudentsInput" class="tbl-bulk-area" placeholder="مثال:\nمحمد فهد السبيعي, 1102345678, التفكير الإبداعي\nسارة خالد العتيبي, 1109876543, الروبوت والبرمجة\nعبدالله عمر الغامدي"></textarea>
        </div>
        ${progNames.length ? `<div style="font-size:11.5px;color:#64748b;margin-bottom:8px">البرامج المنفذة المسجلة بالتقرير: ${progNames.map((n) => `<b>${esc(n)}</b>`).join(' · ')}</div>` : ''}
        <div class="foot">
          <button type="button" class="arch-btn pri" id="btnApplyBulkStudents">استيراد وإضافة الطلبة للجدول</button>
          <button type="button" class="arch-btn" data-close>إلغاء</button>
        </div>
      `;
      $('#modalBg').classList.add('on');
      $('#btnApplyBulkStudents')?.addEventListener('click', () => {
        const val = ($('#bulkStudentsInput') as HTMLTextAreaElement)?.value || '';
        const lines = val.split('\n').map((l) => l.trim()).filter(Boolean);
        if (!lines.length) {
          toast('يرجى لصق أو كتابة أسماء الطلبة أولاً');
          return;
        }
        const defaultProg = progNames[0] || '';
        let added = 0;
        histRecordBefore('final');
        lines.forEach((line) => {
          const parts = line.split(/[,\t،]/).map((p) => p.trim());
          const name = parts[0] || '';
          const id = parts[1] || '';
          const prog = parts[2] || defaultProg;
          if (name) {
            S.final.students.push({ name, id, prog, _open: false });
            added++;
          }
        });
        histRecordAfter('final', 'استيراد قائمة الطلبة');
        closeModal();
        const st = $('#panel').scrollTop;
        renderForm();
        $('#panel').scrollTop = st;
        schedule('final');
        renderPreview();
        toast(`تم استيراد ${added} طالب وإضافتهم لجدول التقرير الختامي بنجاح! ✅ (يمكنك التراجع ↶ أو Ctrl+Z)`);
      });
    }

    function migrateInitsPreset(k: 'monthly' | 'final') {
      const presets = [
        { org: 'جامعة الملك سعود - كلية العلوم', goal: 'تقديم ورش تدريبية تخصصية ومختبرات علمية متقدمة للطلبة الموهوبين' },
        { org: 'مؤسسة الملك عبدالعزيز ورجاله للموهبة والإبداع (موهبة)', goal: 'دعم المقاييس والترشيح للأولمبيادات العلمية الدولية' },
        { org: 'مدينة الملك عبدالعزيز للعلوم والتقنية (KACST)', goal: 'زيارات بحثية وتطبيقية لتعزيز التفكير الابتكاري والذكاء الاصطناعي' }
      ];
      const ex = new Set(S[k].inits.map((x) => x.org.trim()));
      let added = 0;
      histRecordBefore(k);
      presets.forEach((p) => {
        if (!ex.has(p.org)) {
          S[k].inits.push({ org: p.org, goal: p.goal, _open: false });
          added++;
        }
      });
      histRecordAfter(k, 'ترحيل المبادرات المقترحة');
      const st = $('#panel').scrollTop;
      renderForm();
      $('#panel').scrollTop = st;
      schedule(k);
      renderPreview();
      toast(added ? `تمت إضافة ${added} مبادرة وشراكة مقترحة بنجاح! يمكنك تعديلها أو حذفها. (يمكنك التراجع ↶ أو Ctrl+Z)` : 'المبادرات المقترحة مضافة مسبقاً');
    }

    function gradeGrid(path: string) {
      const arr = getP(path) as string[];
      const ss = stageSums(arr);
      return `<table class="grade"><tr>${STAGE_SHORT.map((s) => `<th colspan="3">${s}</th>`).join('')}</tr>
        <tr>${['صف 4', 'صف 5', 'صف 6', 'صف 1', 'صف 2', 'صف 3', 'صف 1', 'صف 2', 'صف 3'].map((g) => `<th>${g}</th>`).join('')}</tr>
        <tr>${arr.map((v, i) => `<td><input type="text" inputmode="numeric" aria-label="${STAGE_SHORT[Math.floor(i / 3)]} ${(i % 3) + 1}" data-k="${path}.${i}" value="${esc(v)}"></td>`).join('')}</tr>
        <tr class="sum" data-sum="${path}">${ss.s.map((x) => `<td colspan="3">${x}</td>`).join('')}</tr>
        <tr class="sum" data-total="${path}"><td colspan="9">المجموع الكلي: ${ss.t}</td></tr></table>`;
    }

    function progEvidences(r: ProgramReport) {
      const L = r.evLayout || 'ev+data';
      const out: any[] = [];
      const imgs = S.phStore[r._id] || [];
      [1, 2].forEach((n) => {
        if (n === 2 && L !== '2') return;
        const t = n === 1 ? r.ev1Type : r.ev2Type;
        const link = n === 1 ? r.evidenceLink : r.ev2Link;
        if (t === 'image') {
          if (imgs[n - 1]) out.push({ rid: r._id, n, kind: 'img', url: imgs[n - 1], label: evLabelOf(r, n) });
        } else if (has(link)) {
          out.push({ rid: r._id, n, kind: 'link', link: link.trim(), label: evLabelOf(r, n) });
        }
      });
      return out;
    }

    function frameSource(k: 'monthly' | 'final', i: number) {
      const d = S[k];
      const mode = (d.evMode || [])[i] || '';
      if (mode === 'prog' && d.evSrc && d.evSrc[i]) {
        const r = S.recs.program[d.evSrc[i]!.rid];
        if (!r) return { missing: true };
        const e = progEvidences(r).find((x) => x.n === d.evSrc[i]!.n);
        if (!e) return { missing: true, name: r.progName };
        return Object.assign({ name: r.progName }, e);
      }
      if (mode === 'link') return has(d.evLinks[i]) ? { kind: 'link', link: d.evLinks[i].trim() } : {};
      const u = S.photos[k] && S.photos[k][i];
      return u ? { kind: 'img', url: u, own: true } : {};
    }

    const frameCache = new Map();
    function fitFrame(src: string, caption: string) {
      const key = src + '|' + (caption || '');
      if (frameCache.has(key)) return frameCache.get(key);
      frameCache.set(key, null);
      const img = new Image();
      img.onload = () => {
        const W = 1000;
        const H = 860;
        const c = document.createElement('canvas');
        c.width = W;
        c.height = H;
        const g = c.getContext('2d');
        if (!g) return;
        g.fillStyle = '#fff';
        g.fillRect(0, 0, W, H);
        const capH = caption ? 120 : 0;
        const pad = caption ? 60 : 0;
        const aw = W - pad * 2;
        const ah = H - capH - pad * 2;
        const sc = Math.min(aw / img.width, ah / img.height);
        const w = img.width * sc;
        const h = img.height * sc;
        g.imageSmoothingEnabled = !caption;
        g.drawImage(img, (W - w) / 2, pad + (ah - h) / 2, w, h);
        if (caption) {
          g.fillStyle = '#1f2d2d';
          g.font = 'bold 44px "Noto Naskh Arabic", Tahoma, Arial';
          g.textAlign = 'center';
          g.textBaseline = 'middle';
          try {
            g.direction = 'rtl';
          } catch (e) {}
          let t = caption;
          while (g.measureText(t).width > W - 60 && t.length > 4) t = t.slice(0, -2);
          if (t !== caption) t += '…';
          g.fillText(t, W / 2, H - capH / 2 - 10);
        }
        frameCache.set(key, c.toDataURL('image/jpeg', 0.9));
        if (frameCache.size > 60) frameCache.delete(frameCache.keys().next().value);
        schedulePreview(30);
      };
      img.src = src;
      return null;
    }

    function frameUrl(k: 'monthly' | 'final', i: number) {
      const f: any = frameSource(k, i);
      if (f.kind === 'img') return f.own ? f.url : fitFrame(f.url, '');
      if (f.kind === 'link') {
        const q = qr(f.link);
        return q ? fitFrame(q, f.name ? f.name : 'امسح الرمز للاطلاع على الشاهد') : '';
      }
      return '';
    }

    async function frameUrlsReady(k: 'monthly' | 'final') {
      for (let tries = 0; tries < 40; tries++) {
        const u = [0, 1, 2].map((i) => frameUrl(k, i));
        if (!u.includes(null)) return u;
        await new Promise((r) => setTimeout(r, 50));
      }
      return [0, 1, 2].map((i) => frameUrl(k, i) || '');
    }

    function photosBox(kind: 'monthly' | 'final') {
      const d = S[kind];
      const linkedCount = d.programs.filter((p: ProgramItem) => p._src && S.recs.program[p._src]).length;
      const slot = (i: number) => {
        const mode = (d.evMode || [])[i] || '';
        const f: any = frameSource(kind, i);
        const pv = frameUrl(kind, i);
        const prev = pv
          ? `<img src="${pv}" alt="شاهد ${i + 1}">`
          : f.missing
            ? '<span>الشاهد المرتبط لم يعد متاحًا</span>'
            : mode === 'link'
              ? '<span>أدخل رابطًا</span>'
              : mode === 'prog'
                ? '<span>…</span>'
                : `<label>＋ صورة ${i + 1}<input type="file" accept="image/*" hidden data-ph="${kind}" data-i="${i}"></label>`;
        return `<div class="phc"><div class="ph">${prev}${f.kind === 'link' ? '<span class="qrmark">QR</span>' : ''}${pv || mode ? `<button type="button" data-act="ph-del" data-kind="${kind}" data-i="${i}" aria-label="تفريغ الإطار">✕</button>` : ''}</div>
          <div class="seg"><button type="button" data-evm="${kind}|${i}|" aria-pressed="${mode === ''}">صورة</button><button type="button" data-evm="${kind}|${i}|link" aria-pressed="${mode === 'link'}">رابط</button></div>
          ${mode === 'link' ? `<input type="url" dir="ltr" data-k="${kind}.evLinks.${i}" value="${esc(d.evLinks[i] || '')}" placeholder="https://..." aria-label="رابط الشاهد ${i + 1}">` : ''}
          ${mode === 'prog' ? `<div class="src" title="${esc(f.name || '')}">🔗 ${esc(f.name || '')}${f.label ? ' · ' + esc(f.label) : ''}</div>` : ''}</div>`;
      };
      return `<button type="button" class="add-btn" data-act="ev-from-progs" data-k="${kind}" style="border-style:solid;margin:0 0 6px">🔗 إضافة من شواهد تقارير البرامج${linkedCount ? ` (${linkedCount} برنامج مرتبط)` : ''}</button>
        <div class="photos">${[0, 1, 2].map(slot).join('')}</div>
        <p class="hint">لكل إطار: صورة ترفعها، أو رابط يتحول إلى باركود QR، أو شاهد من تقرير برنامج مرتبط يتحدّث تلقائيًا.</p>`;
    }

    const profileSet = (withDirs = true) => `<fieldset><legend>بيانات المركز والشعار (مشتركة بين التقارير)</legend>
      ${inp('profile.center', 'اسم المركز / المدرسة', { ph: 'اكتب اسم المركز أو المدرسة' })}
      ${withDirs ? `<div class="row2"><div>${inp('profile.dirM', 'اسم مدير مركز الموهوبين')}</div><div>${inp('profile.dirF', 'اسم مديرة مركز الموهوبات')}</div></div>` : ''}
      <div class="logo-ctrl" style="margin-top:10px;background:#f8f9fa;border:1px solid #d8d2c0;border-radius:8px;padding:10px;display:flex;align-items:center;gap:12px">
        <div style="width:80px;height:55px;background:#fff;border:1px solid #d8d2c0;border-radius:6px;display:flex;align-items:center;justify-content:center;padding:4px">
          <img src="${S.profile.logo || MOE_LOGO}" alt="الشعار" style="max-width:100%;max-height:100%;object-fit:contain">
        </div>
        <div style="flex:1">
          <div style="font-weight:700;font-size:12.5px;color:#0e5e5a">${S.profile.logo ? 'شعار مخصص للمركز' : 'شعار وزارة التعليم الرسمي'}</div>
          <div style="margin-top:4px;display:flex;gap:6px;flex-wrap:wrap">
            <label class="ghost-btn" style="margin:0;cursor:pointer;font-size:11.5px;padding:3px 8px">
              📷 تغيير الشعار
              <input type="file" accept="image/*" hidden data-act="upload-profile-logo">
            </label>
            ${S.profile.logo ? `<button type="button" class="ghost-btn" data-act="reset-profile-logo" style="margin:0;font-size:11.5px;padding:3px 8px">↺ استعادة الشعار الافتراضي</button>` : ''}
          </div>
        </div>
      </div>
      </fieldset>`;

    const letterSet = (k: 'monthly' | 'final') => {
      const d = S[k];
      const hCal = (d as any).h_cal || 'h';
      const curDateStr = fmtReportDate(d.h_date, hCal);
      return `<fieldset><legend>بيانات الخطاب (أعلى الصفحة)</legend>
        <div class="row2"><div>${inp(k + '.h_no', 'الرقم')}</div><div>${inp(k + '.h_att', 'المشفوعات')}</div></div>
        <label>صيغة تاريخ الخطاب</label>
        <div class="yn" role="group">
          <button type="button" data-cal="h" data-cal-target="${k}.h_cal" aria-pressed="${hCal === 'h'}">هجري</button>
          <button type="button" data-cal="g" data-cal-target="${k}.h_cal" aria-pressed="${hCal === 'g'}">ميلادي</button>
        </div>
        ${
          hCal === 'g'
            ? `<div class="row2"><div>${inp(k + '.h_date', 'تاريخ الخطاب: ميلادي', { type: 'date' })}</div><div><span class="hint" style="display:inline-block;margin-top:28px">يظهر في الخطاب: ${esc(curDateStr || '—')}</span></div></div>`
            : `<label>تاريخ الخطاب: هجري</label>${hijriPicker(k + '.h_date')}`
        }
        <p class="hint">يظهر في ترويسة الخطاب: <strong>${esc(curDateStr || (hCal === 'g' ? '00/00/2026م' : '00/00/1448هـ'))}</strong></p>
      </fieldset>`;
    };

    function programsSet(k: 'monthly' | 'final') {
      const list = S[k].programs;
      const t = totals(list);
      const mode = getTableMode(k, 'progs');
      return `<fieldset><legend>أولاً: البرامج الإثرائية المنفذة</legend>
        ${tableHeaderBar(k, 'progs', 'جدول البرامج الإثرائية المنفذة')}
        ${
          mode === 'migrated'
            ? `<div class="tbl-migration-panel">
                <div class="title">🔄 ترحيل البرامج الإثرائية من التقارير الأخرى</div>
                <div style="font-size:11.5px;color:#334155;line-height:1.5">يمكنك ترحيل البرامج المنفذة مباشرة من تقارير البرامج (ربط تلقائي مع التحديث) أو استيرادها من التقارير الشهرية، وتبقى جميع البرامج قابلة للتعديل أو الحذف بزر «حذف».</div>
                <div class="actions">
                  <button type="button" class="act-btn" data-act="link-progs" data-k="${k}">🔗 ترحيل من تقارير البرامج (ربط تلقائي)</button>
                  ${k === 'final' ? `<button type="button" class="act-btn alt" data-act="import-monthly">📥 ترحيل وجمع من التقارير الشهرية</button>` : ''}
                  <button type="button" class="act-btn alt" data-act="add" data-list="${k}.programs">＋ إضافة صف يدوي</button>
                  <button type="button" class="act-btn alt" data-act="clear-tbl" data-k="${k}" data-tbl="progs">🗑️ تفريغ الجدول</button>
                </div>
              </div>`
            : ''
        }
        ${list
          .map(
            (p: ProgramItem, i: number) => `<details class="item" ${p._open ? 'open' : ''} data-item="${k}.programs.${i}">
          <summary><span class="no">${i + 1}</span><span class="nm" data-nm="${k}.programs.${i}">${esc(p.name || 'برنامج جديد')}</span>${p._src ? `<span class="chip ${S.recs.program[p._src] ? 'accepted' : 'returned'}" title="${S.recs.program[p._src] ? 'تتحدّث بياناته من تقرير البرنامج' : 'حُذف تقرير البرنامج المرتبط'}">🔗 ${S.recs.program[p._src] ? 'مرتبط' : 'غير مرتبط'}</span>` : ''}
            <button type="button" class="cp" data-act="dup" data-list="${k}.programs" data-i="${i}" title="نسخ وتكرار">نسخ</button>
            <button type="button" class="x" data-act="del" data-list="${k}.programs" data-i="${i}" title="حذف هذا البرنامج">حذف</button></summary>
          <div class="body">
            ${inp(`${k}.programs.${i}.name`, 'اسم البرنامج')}
            <div class="row2"><div>${inp(`${k}.programs.${i}.field`, 'المجال', { list: 'dl-fields' })}</div><div>${sel(`${k}.programs.${i}.stage`, 'المرحلة', ['ابتدائي', 'متوسط', 'ثانوي'])}</div></div>
            <div class="row3"><div>${sel(`${k}.programs.${i}.mode`, 'عن بعد / حضوري', ['حضوري', 'عن بعد'])}</div><div>${sel(`${k}.programs.${i}.time`, 'صباحي / مسائي', ['صباحي', 'مسائي'])}</div><div>${sel(`${k}.programs.${i}.gender`, 'الفئة المستهدفة', ['بنين', 'بنات'])}</div></div>
            <div class="row2"><div>${inp(`${k}.programs.${i}.ben`, 'عدد المستفيدين', { num: 1 })}</div><div>${inp(`${k}.programs.${i}.gifted`, 'منهم من المصنفين', { num: 1 })}</div></div>
            <div class="row2"><div>${inp(`${k}.programs.${i}.date`, 'تاريخ التنفيذ من - إلى', { ph: (S[k] as any).cal === 'g' ? '1/3 - 5/3/2026' : '1/3 - 5/3/1448' })}</div><div>${inp(`${k}.programs.${i}.dur`, 'مدة التنفيذ', { ph: '20 ساعة' })}</div></div>
          </div></details>`
          )
          .join('')}
        <div class="row2">
          <button type="button" class="add-btn pri-add" data-act="add" data-list="${k}.programs" style="background:#f0fdfa;border:1.5px dashed #0d9488;color:#0e5e5a;font-weight:700;">➕ إضافة صف جديد</button>
          <button type="button" class="add-btn" data-act="link-progs" data-k="${k}" style="border-style:solid">🔗 ترحيل من تقارير البرامج</button>
        </div>
        <p class="hint">يمكنك تعديل أي برنامج أو نسخه أو حذفه في أي وقت، والبرامج المضافة من تقارير البرامج تتحدّث تلقائيًا عند تعديل تقرير البرنامج.</p>
        <div class="ptot" data-tot="${k}"><span>البرامج: ${t.n}</span><span>المستفيدون: ${t.ben}</span><span>المصنفون: ${t.gifted}</span></div>
      </fieldset>`;
    }

    function indicatorSet(k: 'monthly' | 'final') {
      const mode = getTableMode(k, 'ind');
      return `<fieldset><legend>ثانيًا: الطلبة المحتسبون في قيمة المؤشر</legend>
        ${tableHeaderBar(k, 'ind', 'جدول الطلبة المحتسبين في قيمة المؤشر')}
        <p class="hint">عدد المصنفين «استثنائي، موهوب» الذين أكملوا 20 ساعة حضوري أو 40 ساعة عن بعد.</p>
        ${
          mode === 'migrated'
            ? `<div class="tbl-migration-panel">
                <div class="title">🔄 ترحيل واحتساب أعداد المؤشر تلقائيًا</div>
                <div style="font-size:11.5px;color:#334155;line-height:1.5">يقوم باحتساب وتوزيع أعداد الطلبة المصنفين من واقع البرامج الإثرائية المسجلة بالتقرير تلقائيًا، وتبقى كل خلية قابلة للتعديل اليدوي المباشر أو التصفير.</div>
                <div class="actions">
                  <button type="button" class="act-btn" data-act="migrate-ind" data-k="${k}">⚡ احتساب وترحيل تلقائي من البرامج المنفذة</button>
                  ${k === 'final' ? `<button type="button" class="act-btn alt" data-act="import-monthly">📊 ترحيل وجمع من التقارير الشهرية</button>` : ''}
                  <button type="button" class="act-btn alt" data-act="clear-tbl" data-k="${k}" data-tbl="ind">🗑️ تفريغ خلايا المؤشر</button>
                </div>
              </div>`
            : ''
        }
        ${gradeGrid(`${k}.ind`)}
      </fieldset>`;
    }

    function satisfactionSet(k: 'monthly' | 'final') {
      const mode = getTableMode(k, 'sat');
      const label = k === 'final' ? 'رابعًا: قياس رضا المستفيد' : 'ثالثًا: قياس رضا المستفيد';
      return `<fieldset><legend>${label}</legend>
        ${tableHeaderBar(k, 'sat', 'جدول قياس رضا المستفيد (الطلبة وأولياء الأمور)')}
        ${
          mode === 'migrated'
            ? `<div class="tbl-migration-panel">
                <div class="title">🔄 ترحيل واحتساب نتائج رضا المستفيد</div>
                <div style="font-size:11.5px;color:#334155;line-height:1.5">يمكنك احتساب نتائج الرضا تلقائيًا بناءً على أعداد المستفيدين من البرامج أو ترحيلها وجمعها من التقارير الشهرية. جميع أرقام الجدول قابلة للتعديل اليدوي في أي وقت.</div>
                <div class="actions">
                  <button type="button" class="act-btn" data-act="migrate-sat" data-k="${k}">⚡ احتساب وترحيل تقديري من البرامج المنفذة</button>
                  ${k === 'final' ? `<button type="button" class="act-btn alt" data-act="import-monthly">📊 ترحيل وجمع من التقارير الشهرية</button>` : ''}
                  <button type="button" class="act-btn alt" data-act="clear-tbl" data-k="${k}" data-tbl="sat">🗑️ تفريغ خلايا الرضا</button>
                </div>
              </div>`
            : ''
        }
        <label style="font-weight:700">الطلبة (عدد المستفيدين والمصنفين من «مقياس موهبة»)</label>
        ${gradeGrid(`${k}.sst`)}
        <label style="font-weight:700;margin-top:10px">أولياء الأمور (عدد أولياء أمور الطلبة المصنفين)</label>
        ${gradeGrid(`${k}.spr`)}
      </fieldset>`;
    }

    function studentsSet() {
      const f = S.final;
      const mode = getTableMode('final', 'students');
      return `<fieldset><legend>ثالثًا: أسماء الطلبة المصنفين الذين تم رعايتهم</legend>
        ${tableHeaderBar('final', 'students', 'جدول أسماء الطلبة المصنفين')}
        ${
          mode === 'migrated'
            ? `<div class="tbl-migration-panel">
                <div class="title">🔄 ترحيل واستيراد أسماء الطلبة</div>
                <div style="font-size:11.5px;color:#334155;line-height:1.5">يمكنك ترحيل وإنشاء قائمة الطلبة تلقائيًا من البرامج الإثرائية المسجلة، أو لصق قائمة أسماء وسجلات دفعة واحدة (Bulk Import)، مع إمكانية تعديل اسم أو سجل أي طالب أو حذفه.</div>
                <div class="actions">
                  <button type="button" class="act-btn" data-act="migrate-students">⚡ ترحيل الطلبة من البرامج الإثرائية</button>
                  <button type="button" class="act-btn alt" data-act="open-bulk-students">📥 استيراد ولصق قائمة أسماء وسجلات دفعة واحدة</button>
                  <button type="button" class="act-btn alt" data-act="add" data-list="final.students">＋ إضافة طالب يدويًا</button>
                  <button type="button" class="act-btn alt" data-act="clear-tbl" data-k="final" data-tbl="students">🗑️ تفريغ القائمة</button>
                </div>
              </div>`
            : ''
        }
        ${f.students
          .map(
            (s: any, i: number) => `<details class="item" ${s._open ? 'open' : ''}><summary><span class="no">${i + 1}</span><span class="nm" data-nm="final.students.${i}">${esc(s.name || 'طالب جديد')}</span><button type="button" class="x" data-act="del" data-list="final.students" data-i="${i}" title="حذف هذا الطالب">حذف</button></summary>
          <div class="body">${inp(`final.students.${i}.name`, 'اسم الطالب / الطالبة')}<div class="row2"><div>${inp(`final.students.${i}.id`, 'رقم السجل المدني', { num: 1, dir: 'ltr' })}</div><div>${inp(`final.students.${i}.prog`, 'اسم البرنامج', { list: 'dl-progs' })}</div></div></div></details>`
          )
          .join('')}
        <div class="row2">
          <button type="button" class="add-btn pri-add" data-act="add" data-list="final.students" style="background:#f0fdfa;border:1.5px dashed #0d9488;color:#0e5e5a;font-weight:700;">➕ إضافة صف جديد</button>
          <button type="button" class="add-btn" data-act="open-bulk-students" style="border-style:solid">📥 استيراد ولصق قائمة أسماء</button>
        </div>
        <p class="hint">الجدول في النموذج من عمودين (1-15 و16-30)، ويزيد تلقائيًا إذا تجاوز العدد 30، ويمكنك تعديل أو حذف أي طالب في أي وقت.</p>
      </fieldset>`;
    }

    function initsSet(k: 'monthly' | 'final', label: string) {
      const mode = getTableMode(k, 'inits');
      return `<fieldset><legend>${label}</legend>
        ${tableHeaderBar(k, 'inits', 'جدول المبادرات والجهات المتعاونة')}
        ${
          mode === 'migrated'
            ? `<div class="tbl-migration-panel">
                <div class="title">🔄 ترحيل المبادرات والشراكات</div>
                <div style="font-size:11.5px;color:#334155;line-height:1.5">يمكنك ترحيل المبادرات من نماذج مقترحة لمراكز الموهوبين أو نسخها من التقارير السابقة، مع إمكانية التعديل والحذف لأي عنصر.</div>
                <div class="actions">
                  <button type="button" class="act-btn" data-act="migrate-inits-preset" data-k="${k}">🏛️ ترحيل من مبادرات مقترحة (جامعات ومراكز علمية)</button>
                  ${k === 'final' ? `<button type="button" class="act-btn alt" data-act="import-monthly">📥 ترحيل من التقارير الشهرية</button>` : ''}
                  <button type="button" class="act-btn alt" data-act="add" data-list="${k}.inits">＋ إضافة جهة يدويًا</button>
                  <button type="button" class="act-btn alt" data-act="clear-tbl" data-k="${k}" data-tbl="inits">🗑️ تفريغ الجدول</button>
                </div>
              </div>`
            : ''
        }
        ${S[k].inits
          .map(
            (p: any, i: number) => `<details class="item" ${p._open ? 'open' : ''}><summary><span class="no">${i + 1}</span><span class="nm" data-nm="${k}.inits.${i}">${esc(p.org || 'جهة جديدة')}</span><button type="button" class="x" data-act="del" data-list="${k}.inits" data-i="${i}" title="حذف هذه المبادرة">حذف</button></summary>
          <div class="body">${inp(`${k}.inits.${i}.org`, 'الجهة')}${ta(`${k}.inits.${i}.goal`, 'الهدف من الشراكة أو المبادرة', 2)}</div></details>`
          )
          .join('')}
        <button type="button" class="add-btn pri-add" data-act="add" data-list="${k}.inits" style="background:#f0fdfa;border:1.5px dashed #0d9488;color:#0e5e5a;font-weight:700;">➕ إضافة صف جديد</button></fieldset>`;
    }

    function formProgram() {
      return `<h2>مولّد تقرير البرامج</h2>
      <p class="sub">عبّئ البيانات في الحقول أدناه، وستتحدّث المعاينة تلقائيًا. عند الانتهاء اضغط تحميل PDF أو تحميل Word.</p>
      <div class="btnbar"><button class="ghost-btn" data-act="sample">🔄 تعبئة بيانات تجريبية</button><button class="ghost-btn" data-act="clear">🗑️ مسح كل الحقول</button></div>
      <fieldset><legend>الجهة والشعار</legend>
        ${inp('program.deptLine1', 'السطر الأول (الإدارة)')}
        ${inp('program.deptLine2', 'السطر الثاني')}
        ${inp('program.deptLine3', 'السطر الثالث')}
        <div class="logo-ctrl" style="margin-top:12px;background:#f8f9fa;border:1px solid #d8d2c0;border-radius:8px;padding:12px;display:flex;align-items:center;gap:12px">
          <div style="width:85px;height:60px;background:#fff;border:1px solid #d8d2c0;border-radius:6px;display:flex;align-items:center;justify-content:center;padding:4px">
            <img src="${S.program.customLogo || S.profile.logo || PROG_LOGO}" alt="الشعار الحالي" style="max-width:100%;max-height:100%;object-fit:contain">
          </div>
          <div style="flex:1">
            <div style="font-weight:700;font-size:13px;color:#0e5e5a">${S.program.customLogo ? 'شعار مخصص للتقرير' : 'شعار وزارة التعليم الرسمي'}</div>
            <div style="margin-top:6px;display:flex;gap:8px;flex-wrap:wrap">
              <label class="ghost-btn" style="margin:0;cursor:pointer;font-size:12px;padding:4px 10px">
                📁 رفع شعار جديد
                <input type="file" accept="image/*" hidden data-act="upload-prog-logo">
              </label>
              ${S.program.customLogo ? `<button type="button" class="ghost-btn" data-act="reset-prog-logo" style="margin:0;font-size:12px;padding:4px 10px">↺ استعادة الشعار الافتراضي</button>` : ''}
            </div>
          </div>
        </div>
      </fieldset>
      <fieldset><legend>عنوان التقرير</legend>${ta('program.reportTitle', '', 2)}</fieldset>
      <fieldset><legend>بيانات البرنامج</legend>${inp('program.progName', 'اسم البرنامج')}${inp('program.progField', 'مجال البرنامج')}
        <div class="row2"><div>${inp('program.execOrg', 'الجهة المنفذة')}</div><div>${inp('program.supportOrg', 'الجهة الداعمة')}</div></div>
        <label>صيغة التاريخ</label><div class="yn" role="group"><button type="button" data-cal="h" aria-pressed="${calOf(S.program) === 'h'}">هجري</button><button type="button" data-cal="g" aria-pressed="${calOf(S.program) === 'g'}">ميلادي</button></div>
        ${
          calOf(S.program) === 'g'
            ? `<div class="row2"><div>${inp('program.progFrom', 'تاريخ البرنامج: من', { type: 'date' })}</div><div>${inp('program.progTo', 'إلى', { type: 'date' })}</div></div>`
            : `<label>تاريخ البرنامج: من</label>${hijriPicker('from')}<label>إلى</label>${hijriPicker('to')}`
        }
        ${inp('program.progDur', 'مدة البرنامج', { ph: progDays(S.program) ? daysAr(progDays(S.program)) + ' (تلقائي)' : 'مثال: 20 ساعة' })}
        <p class="hint" id="progDateHint">${esc(progDateHintText(S.program))}</p>
        ${ta('program.targetGroup', 'المستهدفون', 2)}
        <div class="row2"><div>${inp('program.beneficiaryCount', 'عدد المستفيدين')}</div><div>${inp('program.giftedCount', 'عدد الطلبة الموهوبين')}</div></div></fieldset>
      <fieldset><legend>بيانات الربط بالتقرير الشهري</legend><p class="hint" style="margin-top:0">تُنقل مع البرنامج إلى جدول «البرامج الإثرائية المنفذة» في التقرير الشهري والختامي.</p>
        <div class="row2"><div>${sel('program.progStage', 'المرحلة', ['ابتدائي', 'متوسط', 'ثانوي'])}</div><div>${sel('program.progGender', 'الفئة المستهدفة', ['بنين', 'بنات'])}</div></div>
        <div class="row2"><div>${sel('program.progMode', 'عن بعد / حضوري', ['حضوري', 'عن بعد'])}</div><div>${sel('program.progTime', 'صباحي / مسائي', ['صباحي', 'مسائي'])}</div></div></fieldset>
      <fieldset><legend>الهدف من البرنامج</legend>${ta('program.goalsText', 'سطر واحد لكل نقطة', 4)}</fieldset>
      <fieldset><legend>الأثر المتوقع (النتائج)</legend>${ta('program.impactText', 'سطر واحد لكل نقطة', 5)}</fieldset>
      <fieldset><legend>الشواهد (اختياري)</legend>${evidenceForm()}${inp('program.websiteText', 'نص أسفل الصفحة')}</fieldset>
      <p class="hint">💡 ملف Word الناتج يحوي صورة طبق الأصل من التصميم، متبوعة بنسخة نصية قابلة للتعديل من نفس البيانات.</p>`;
    }

    function evidenceForm() {
      const p = S.program;
      const L = p.evLayout || 'ev+data';
      const imgs = progImgs();
      const seg = [
        ['1', 'شاهد واحد'],
        ['2', 'شاهدان'],
        ['ev+data', 'شاهد + تحليل البيانات']
      ];
      const box = (n: number) => {
        const t = n === 1 ? p.ev1Type : p.ev2Type;
        const lk = n === 1 ? 'evidenceLink' : 'ev2Link';
        const u = imgs[n - 1];
        return `<div class="evbox"><div class="ttl">${n === 1 ? 'الشاهد الأول' : 'الشاهد الثاني'}</div>
          ${inp(`program.ev${n}Label`, 'العنوان فوق الشاهد', { ph: evLabelOf(Object.assign({}, p, { ['ev' + n + 'Label']: '' }), n) })}
          <label>نوع الشاهد</label><div class="yn" role="group"><button type="button" data-evt="${n}|link" aria-pressed="${t !== 'image'}">رابط ← باركود QR</button><button type="button" data-evt="${n}|image" aria-pressed="${t === 'image'}">رفع صورة / باركود</button></div>
          ${
            t === 'image'
              ? `<div class="evimg">${u ? `<img src="${u}" alt="الشاهد ${n}"><button type="button" data-act="pimg-del" data-i="${n - 1}" aria-label="حذف الصورة">✕</button>` : `<label>＋ اختر صورة أو صورة باركود<input type="file" accept="image/*" hidden data-pimg="${n - 1}"></label>`}</div><p class="hint">تظهر الصورة كاملة دون قص.</p>`
              : inp(`program.${lk}`, 'الرابط (يتحول تلقائيًا إلى QR)', { type: 'url', ph: 'https://...', dir: 'ltr' })
          }</div>`;
      };
      return `<label style="margin-top:0">عدد الشواهد</label><div class="yn" role="group">${seg.map(([v, l]) => `<button type="button" data-evl="${v}" aria-pressed="${L === v}">${l}</button>`).join('')}</div>
        ${box(1)}${L === '2' ? box(2) : ''}
        ${L === 'ev+data' ? `<div class="evbox"><div class="ttl">تحليل البيانات</div>${inp('program.dataLink', 'رابط تحليل البيانات (يتحول تلقائيًا إلى QR)', { type: 'url', ph: 'https://...', dir: 'ltr' })}</div>` : ''}`;
    }

    function formMonthly() {
      const m = S.monthly;
      const mCal = (m as any).cal || 'h';
      return `<h2>التقرير الشهري</h2><p class="sub">نموذج التقرير الشهري لمراكز الموهوبين بمنطقة الرياض 1448هـ. ملف Word يُبنى من النموذج الأصلي نفسه بخطوطه وجداوله.</p>
      <div class="btnbar" style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
        <button type="button" class="ghost-btn" data-act="undo" title="تراجع (Ctrl+Z)" style="font-weight:700;color:#0e5e5a;" ${(histOf('monthly') || { undo: [] }).undo.length ? '' : 'disabled'}>↶ تراجع</button>
        <button type="button" class="ghost-btn" data-act="redo" title="إعادة (Ctrl+Y)" style="font-weight:700;color:#0e5e5a;" ${(histOf('monthly') || { redo: [] }).redo.length ? '' : 'disabled'}>↷ إعادة</button>
        <button class="ghost-btn" data-act="sample">🔄 بيانات تجريبية</button>
        <button class="ghost-btn" data-act="clear">🗑️ مسح التقرير</button>
      </div>
      ${profileSet()}${letterSet('monthly')}
      <fieldset><legend>عنوان وفترة التقرير الشهري</legend>
        <div class="row2"><div>${inp('monthly.month', 'الشهر', { list: 'dl-months' })}</div><div>${inp('monthly.semester', 'الفصل الدراسي', { list: 'dl-sem' })}</div></div>
        <label>صيغة التاريخ</label>
        <div class="yn" role="group">
          <button type="button" data-cal="h" data-cal-target="monthly" aria-pressed="${mCal === 'h'}">هجري</button>
          <button type="button" data-cal="g" data-cal-target="monthly" aria-pressed="${mCal === 'g'}">ميلادي</button>
        </div>
        ${
          mCal === 'g'
            ? `<div class="row2"><div>${inp('monthly.from', 'الفترة من: ميلادي', { type: 'date' })}</div><div>${inp('monthly.to', 'إلى', { type: 'date' })}</div></div>`
            : `<label>الفترة من (هجري)</label>${hijriPicker('monthly.from')}<label>إلى</label>${hijriPicker('monthly.to')}`
        }
        <p class="hint" id="monthlyDateHint">${esc(monthlyDateHintText(m))}</p>
      </fieldset>
      ${programsSet('monthly')}
      ${indicatorSet('monthly')}
      ${satisfactionSet('monthly')}
      ${initsSet('monthly', 'رابعًا: المبادرات والجهات المتعاونة')}
      <fieldset><legend>سابعًا: الشواهد</legend>${photosBox('monthly')}</fieldset>`;
    }

    function formFinal() {
      const f = S.final;
      const fCal = (f as any).cal || 'h';
      return `<h2>التقرير الختامي</h2><p class="sub">نموذج التقرير الختامي لمراكز الموهوبين بمنطقة الرياض 1448هـ. الإحصائيات والرسوم البيانية تُحسب تلقائيًا من بيانات التقرير.</p>
      <div class="btnbar" style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
        <button type="button" class="ghost-btn" data-act="undo" title="تراجع (Ctrl+Z)" style="font-weight:700;color:#0e5e5a;" ${(histOf('final') || { undo: [] }).undo.length ? '' : 'disabled'}>↶ تراجع</button>
        <button type="button" class="ghost-btn" data-act="redo" title="إعادة (Ctrl+Y)" style="font-weight:700;color:#0e5e5a;" ${(histOf('final') || { redo: [] }).redo.length ? '' : 'disabled'}>↷ إعادة</button>
        <button class="ghost-btn" data-act="import-monthly">⬅️ نقل من التقارير الشهرية</button>
        <button class="ghost-btn" data-act="sample">🔄 بيانات تجريبية</button>
        <button class="ghost-btn" data-act="clear">🗑️ مسح</button>
      </div>
      ${profileSet()}${letterSet('final')}
      <fieldset><legend>صيغة تاريخ التقرير الختامي</legend>
        <label>صيغة تاريخ العام الدراسي</label>
        <div class="yn" role="group">
          <button type="button" data-cal="h" data-cal-target="final" aria-pressed="${fCal === 'h'}">هجري</button>
          <button type="button" data-cal="g" data-cal-target="final" aria-pressed="${fCal === 'g'}">ميلادي</button>
        </div>
        <p class="hint">يظهر في عنوان التقرير الختامي: <strong>${fCal === 'g' ? 'للعام الدراسي 2026م' : 'للعام الدراسي 1448هـ'}</strong></p>
      </fieldset>
      ${programsSet('final')}
      ${indicatorSet('final')}
      ${studentsSet()}
      ${satisfactionSet('final')}
      ${initsSet('final', 'خامسًا: المبادرات والجهات المتعاونة')}
      ${finalChartsSection()}
      <fieldset><legend>ثامنًا: الشواهد</legend>${photosBox('final')}</fieldset>
      ${dl('dl-progs', [...new Set(f.programs.map((p: any) => p.name).filter(Boolean))])}`;
    }

    function qrow(k: string) {
      return `<div class="qrow"><span>${STATS_Q[k]}</span><input type="text" inputmode="numeric" data-k="stats.${k}" value="${esc(S.stats[k])}" aria-label="${esc(STATS_Q[k])}"></div>`;
    }

    function formStats() {
      const st = S.stats;
      return `<h2>إحصائيات مراكز الموهوبين</h2><p class="sub">نفس بنود ملف الإحصائيات. ملف Excel يُبنى من الملف الأصلي بتنسيقه ومعادلاته، والمجاميع تُحسب تلقائيًا.</p>
      <div class="btnbar"><button class="ghost-btn" data-act="from-final">⬅️ تعبئة من التقارير</button><button class="ghost-btn" data-act="clear">🗑️ مسح</button></div>
      ${profileSet()}
      <fieldset><legend>بيانات مركز الموهوبين</legend>${inp('stats.region', 'بيانات مركز الموهوبين في', { ph: 'المنطقة / المحافظة' })}
        <label>1- هل يوجد مركز للموهوبين في المنطقة / المحافظة</label>${yn('stats.q1')}
        ${qrow('q2')}<div class="qrow"><span>3- العدد الاجمالي للمشرفين ومعلمين الموهوبين على ملاك المركز</span><div class="auto" data-auto="q3">${num(st.q4) + num(st.q5)}</div></div>
        ${qrow('q4')}${qrow('q5')}${qrow('q6')}${qrow('q7')}${qrow('q8')}${qrow('q9')}${qrow('q10')}${qrow('q11')}</fieldset>
      <fieldset><legend>البرامج الاثرائية المقدمة للطلبة الموهوبين</legend><label>عدد الطلبة الموهوبين الملتحقين بالبرامج حسب الصف</label>${gradeGrid('stats.g2')}
        ${qrow('q15')}<label>16- هل تم تقديم برنامج اثرائي صيفي</label>${yn('stats.q16')}${qrow('q17')}${qrow('q18')}${qrow('q19')}</fieldset>
      <fieldset><legend>البرامج الاثرائية المقدمة للطلبة المصنفين (استثنائي، موهوب)</legend>${gradeGrid('stats.g3')}</fieldset>
      <fieldset><legend>الطلبة الموهوبون غير المسكنين في برامج الرعاية</legend>${gradeGrid('stats.g4')}</fieldset>`;
    }

    function autoTitle(kind: string, d: any) {
      if (kind === 'program') return d.progName ? 'تقرير برنامج: ' + d.progName : 'تقرير برنامج';
      if (kind === 'monthly') return 'تقرير شهر ' + (d.month || '…') + (d.semester ? ' - الفصل ' + d.semester : '');
      if (kind === 'final') return 'التقرير الختامي' + (d.h_date ? ' ' + d.h_date : '');
      return 'إحصائيات ' + (d.region || 'المركز');
    }

    const recTitle = (kind: string, d: any) => (d._name || '').trim() || autoTitle(kind, d);

    const sortedRecs = (kind: string) =>
      Object.values(S.recs[kind] || {}).sort((a: any, b: any) => b._updated - a._updated);

    function recMeta(kind: string, d: any) {
      if (kind === 'monthly' || kind === 'final') {
        const n = d.programs.filter((p: any) => has(p.name)).length;
        return `${n} برنامج`;
      }
      if (kind === 'program') return d.progField || '';
      return d.region || '';
    }

    function archiveBox(kind: string) {
      const list = sortedRecs(kind);
      const d = S[kind];
      return `<div class="arch">
        <div class="arch-top"><div class="nm"><input type="text" data-k="${kind}._name" value="${esc(d._name)}" placeholder="${esc(autoTitle(kind, d))}" aria-label="اسم التقرير في الأرشيف" data-archname></div>
          <button type="button" class="arch-btn" data-act="arch-toggle" aria-expanded="${S.archOpen}">📁 الأرشيف (${list.length})</button>
          <button type="button" class="arch-btn" data-act="undo" title="تراجع (Ctrl+Z)" aria-label="تراجع" style="padding:8px 9px" ${(histOf(kind) || { undo: [] }).undo.length ? '' : 'disabled'}>↶</button>
          <button type="button" class="arch-btn" data-act="redo" title="إعادة (Ctrl+Y)" aria-label="إعادة" style="padding:8px 9px" ${(histOf(kind) || { redo: [] }).redo.length ? '' : 'disabled'}>↷</button>
          <button type="button" class="arch-btn pri" data-act="rec-new">＋ جديد</button></div>
        ${d._profile ? `<div class="recv">نسخة مستلمة من «${esc(d._profile.center || 'مركز')}»: اسم المركز والمدير في هذا التقرير مأخوذة من التقرير المرفوع.</div>` : ''}
        <div class="subrow"><span class="st" id="substat">${sentHtml(d)}</span>
          <button type="button" class="arch-btn pri" data-act="send">✉️ إرسال بالبريد / واتساب</button>
          <button type="button" class="arch-btn" data-act="toggle-sent" data-kind="${kind}" data-rid="${d._id}">${d._sent ? '↩︎ إلغاء علامة الإرسال' : '✔ تم الإرسال'}</button></div>
        ${
          S.archOpen
            ? `<div class="arch-list">${list.map((r: any) => `<div class="ar-item${r._id === S.cur[kind] ? ' on' : ''}">
            <button type="button" class="ar-open" data-act="rec-open" data-rid="${r._id}"><b>${esc(recTitle(kind, r))}${r._id === S.cur[kind] ? '<span class="ar-on">مفتوح</span>' : ''}</b><small>${r._sent ? '<span class="chip accepted">أُرسل</span>' : '<span class="chip none">لم يُرسل</span>'}آخر تعديل ${esc(fmtD(r._updated))}${recMeta(kind, r) ? ' · ' + esc(recMeta(kind, r)) : ''}</small></button>
            <button type="button" class="t" data-act="rec-copy" data-rid="${r._id}">نسخ</button>
            <button type="button" class="t del" data-act="rec-del" data-rid="${r._id}">حذف</button></div>`).join('') || '<div class="ar-empty">لا توجد تقارير محفوظة بعد.</div>'}</div>`
            : ''
        }
      </div>`;
    }

    function renderForm() {
      if ((S.tab === 'monthly' || S.tab === 'final') && syncLinked(S.tab as any)) schedule(S.tab);
      if (S.tab === 'follow') {
        $('#panel').innerHTML = formFollow();
        $('#actions').innerHTML = '';
        $('#pvnote').textContent =
          'تُعلَّم التقارير «أُرسل» تلقائيًا عند فتح البريد أو واتساب من نافذة الإرسال، ويمكن تعديل العلامة يدويًا.';
        setStatus('');
        return;
      }
      const fMap: Record<string, () => string> = {
        program: formProgram,
        monthly: formMonthly,
        final: formFinal,
        stats: formStats
      };
      const f = fMap[S.tab];
      $('#panel').innerHTML =
        archiveBox(S.tab) +
        f() +
        dl('dl-fields', FIELDS) +
        dl('dl-months', MONTHS) +
        dl('dl-sem', ['الأول', 'الثاني', 'الثالث']);
      const actsMap: Record<string, string[][]> = {
        program: [
          ['pdf', '⬇️ تحميل PDF', 'b-pdf'],
          ['word', '⬇️ تحميل Word', 'b-word'],
          ['drive', '☁️ حفظ في Drive', 'b-drive']
        ],
        monthly: [
          ['word', '⬇️ تحميل Word', 'b-word'],
          ['pdf', '⬇️ تحميل PDF', 'b-pdf'],
          ['drive', '☁️ حفظ في Drive', 'b-drive']
        ],
        final: [
          ['word', '⬇️ تحميل Word', 'b-word'],
          ['pdf', '⬇️ تحميل PDF', 'b-pdf'],
          ['drive', '☁️ حفظ في Drive', 'b-drive']
        ],
        stats: [
          ['xlsx', '⬇️ تحميل Excel', 'b-xls'],
          ['pdf', '⬇️ تحميل PDF', 'b-pdf'],
          ['drive', '☁️ حفظ في Drive', 'b-drive']
        ]
      };
      const acts = actsMap[S.tab];
      $('#actions').innerHTML = acts.map(([k, l, c]) => `<button class="${c}" data-export="${k}">${l}</button>`).join('');
      $('#pvnote').textContent =
        S.tab === 'monthly' || S.tab === 'final'
          ? 'المعاينة تقريبية بخط مشابه؛ ملف Word يُبنى من النموذج الأصلي بخطوطه (AL-Mohanad وSakkal Majalla) وترويسته في كل صفحة.'
          : S.tab === 'stats'
            ? 'ملف Excel هو الملف الأصلي نفسه بعد تعبئة الخلايا، مع إبقاء المعادلات والتنسيق.'
            : '';
      setStatus('');
    }

    /* ---------------- docs & layout ---------------- */
    const v = (x: any, d: string) => (has(x) ? esc(x) : d);
    const PAGE = { land: { w: 1123, h: 794, ch: 794 - 138 - 54 }, port: { w: 794, h: 1123 } };

    function header(k: string) {
      const d = S[k];
      const logoSrc = S.profile.logo || MOE_LOGO;
      const hDateStr = d.h_date ? fmtReportDate(d.h_date, (d as any).h_cal || 'h') : '';
      return `<div class="hdr"><div class="h-right">المملكة العربية السعودية<br>وزارة التعليم<br>الإدارة العامة للتعليم بمنطقة الرياض<br>المساعد للشؤون التعليمية<br>إدارة تنمية القدرات/ قسم الموهوبين</div><div class="h-logo"><img src="${logoSrc}" alt="شعار وزارة التعليم"></div><div class="h-left">الرقــــــــــــم: ${esc(d.h_no)}<br>التاريــــــــخ: ${esc(hDateStr || d.h_date)}<br>المشفوعات: ${esc(d.h_att)}</div></div>`;
    }

    const PCOLS = [419, 4067, 888, 969, 1071, 698, 1081, 1013, 1599, 1685, 1070];
    const colgroup = (ws: number[]) => {
      const t = ws.reduce((a, b) => a + b, 0);
      return `<colgroup>${ws.map((w) => `<col style="width:${((w / t) * 100).toFixed(3)}%">`).join('')}</colgroup>`;
    };

    function progTable(k: 'monthly' | 'final') {
      const list = S[k].programs;
      const t = totals(list);
      const n = Math.max(14, list.length);
      const head = `<tr><th class="f2">م</th><th class="f2">اسم البرنامج</th><th class="f2">المجال</th><th class="f2">عن بعد / حضوري</th><th class="f2">صباحي /<br>مسائي</th><th class="f2">المرحلة</th><th class="f">الفئة المستهدفة<br>بنين / بنات</th><th class="f">عدد المستفيدين</th><th class="f">عدد المستفيدين من المصنفين<br>(استثنائي، موهوب)</th><th class="f">تاريخ التنفيذ<br>من - إلى</th><th class="f">مدة التنفيذ</th></tr>`;
      const rows = [head];
      for (let i = 0; i < n; i++) {
        const p = list[i] || {};
        rows.push(
          `<tr><td class="b">${i + 1}</td><td>${esc(p.name)}</td><td>${esc(p.field)}</td><td>${esc(p.mode)}</td><td>${esc(p.time)}</td><td>${esc(p.stage)}</td><td>${esc(p.gender)}</td><td>${esc(p.ben)}</td><td>${esc(p.gifted)}</td><td>${esc(p.date)}</td><td>${esc(p.dur)}</td></tr>`
        );
      }
      rows.push(
        `<tr class="tot"><td colspan="2">مجموع عدد البرامج المنفذة: (${t.n ? t.n : '00'})</td><td colspan="9">مجموع عدد الطلبة الحاصلين على رعاية في البرامج: (${t.n ? t.ben : '00'})<br>مجموع عدد الطلبة المصنفين (استثنائي، موهوب) والحاصلين على رعاية في البرامج: (${t.n ? t.gifted : '00'})</td></tr>`
      );
      return { table: true, cls: 't-prog', cg: colgroup(PCOLS), rows, tailKeep: true };
    }

    const GCOLS = [1385, 1463, 1464, 1464, 1464, 1464, 1464, 1464, 1464, 1464];

    function gradeRows(arr: string[], label: string, ph: string) {
      const ss = stageSums(arr);
      const z = (x: any) => (ss.any ? x : ph);
      return `<tr><td class="f">المرحلة</td>${STAGES.map((s) => `<td class="f" colspan="3">${s}</td>`).join('')}</tr>
        <tr><td class="f">الصف</td>${['صف 4', 'صف 5', 'صف 6', 'صف 1', 'صف 2', 'صف 3', 'صف 1', 'صف 2', 'صف 3'].map((g) => `<td class="f">${g}</td>`).join('')}</tr>
        <tr><td class="f">${label}</td>${arr.map((x) => `<td>${has(x) ? esc(x) : '00'}</td>`).join('')}</tr>
        <tr><td class="f">المجموع الكلي لكل مرحلة</td>${ss.s.map((x) => `<td colspan="3">${z(x)}</td>`).join('')}</tr>
        <tr><td class="f">المجموع الكلي</td><td colspan="9">${z(ss.t)}</td></tr>`;
    }

    function gradeTable(arr: string[], label: string, ph = '000', cap = '') {
      return `<table class="t-grade ${cap ? 't-sat' : ''}">${colgroup(GCOLS)}${cap ? `<tr><td class="f cap" colspan="10">${cap}</td></tr>` : ''}${gradeRows(arr, label, ph)}</table>`;
    }

    const CAP_S =
      'قياس رضا المستفيد (الطالب/ الطالبة)<br>الرابط: <span class="red">سيتم الإرسال لاحقًا</span><br>يرسل للطلبة المصنفين موهوبين وحضروا البرامج الإثرائية و<b>تصل الردود مباشرة لقسم الموهوبين</b>';
    const CAP_P =
      'قياس رضا (ولي الأمر)<br>الرابط: <span class="red">سيتم الإرسال لاحقًا</span><br>يرسل لأولياء أمور الطلبة و<b>تصل الردود مباشرة لقسم الموهوبين</b>';

    function initTable(k: 'monthly' | 'final') {
      const list = S[k].inits;
      const n = Math.max(5, list.length);
      const rows = [`<tr><td class="f">م</td><td class="f b">الجهة</td><td class="f b">الهدف من الشراكة أو المبادرة</td></tr>`];
      for (let i = 0; i < n; i++) {
        const p = list[i] || {};
        rows.push(`<tr><td>${i + 1}</td><td>${esc(p.org)}</td><td>${esc(p.goal).replace(/\n/g, '<br>')}</td></tr>`);
      }
      return { table: true, cls: 't-init', cg: colgroup([286, 3408, 11053]), rows };
    }

    function studTable() {
      const list = S.final.students;
      const R = Math.max(15, Math.ceil(list.length / 2));
      const rows = [
        `<tr><td>م</td><td>أسماء الطلبة</td><td>رقم السجل المدني</td><td>اسم البرنامج</td><td>م</td><td>أسماء الطلبة</td><td>رقم السجل المدني</td><td>اسم البرنامج</td></tr>`
      ];
      for (let i = 0; i < R; i++) {
        const a = list[i] || {};
        const b = list[R + i] || {};
        rows.push(
          `<tr><td class="b">${i + 1}</td><td>${esc(a.name)}</td><td>${esc(a.id)}</td><td>${esc(a.prog)}</td><td class="b">${R + i + 1}</td><td>${esc(b.name)}</td><td>${esc(b.id)}</td><td>${esc(b.prog)}</td></tr>`
        );
      }
      return { table: true, cls: 't-stud', cg: colgroup([453, 3233, 1813, 1813, 448, 3174, 1813, 1813]), rows };
    }

    const FRAME_W = [2522855, 2683510, 2463800];
    function framesHtml(kind: 'monthly' | 'final') {
      return `<div class="frames">${FRAME_W.map((w, i) => {
        const u = frameUrl(kind, i);
        return `<div class="frame" style="width:${Math.round(w / 9525)}px">${
          u ? `<div class="frame-inner"><img src="${u}" alt="شاهد ${i + 1}"></div>` : `<div class="frame-empty"><span>إطار الشاهد ${i + 1}</span></div>`
        }</div>`;
      }).join('')}</div>`;
    }

    const sigHtml = () =>
      `<div class="sig"><span>مدير مركز الموهوبين</span><span>مديرة مركز الموهوبات</span></div>${has(S.profile.dirM) || has(S.profile.dirF) ? `<div class="sig" style="padding-top:4px"><span>${esc(S.profile.dirM)}</span><span>${esc(S.profile.dirF)}</span></div>` : ''}`;

    function getAutoChartData() {
      const f = S.final;
      const ps = f.programs.filter((p: any) => has(p.name));
      const byStage = (fn: (p: any) => number) =>
        [0, 1, 2].map((s) => ps.filter((p: any) => stageOf(p.stage) === s).reduce((a: number, p: any) => a + fn(p), 0));
      const fields: Record<string, number> = {};
      ps.forEach((p: any) => {
        const k = (p.field || '').trim() || 'غير محدد';
        fields[k] = (fields[k] || 0) + 1;
      });
      const fe = Object.entries(fields).sort((a, b) => b[1] - a[1]);
      const top = fe.slice(0, 7);
      if (fe.length > 7) top.push(['أخرى', fe.slice(7).reduce((a, x) => a + x[1], 0)]);
      const ss = stageSums(f.sst);
      const sp = stageSums(f.spr);
      const mode = ['حضوري', 'عن بعد'].map((m) =>
        ps.filter((p: any) => (p.mode || '') === m).reduce((a: number, p: any) => a + num(p.ben), 0)
      );
      const nP = f.nsP.map(num);
      const nQ = f.nsQ.map(num);
      const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
      const C: any[] = [];
      C.push(
        ps.length
          ? {
              labels: top.map((x) => x[0]),
              series: [{ name: 'عدد البرامج', values: top.map((x) => x[1]), color: '#4472C4' }],
              cnt: ` (${fe.length} مجالات)`
            }
          : null
      );
      C.push(
        ps.length
          ? {
              labels: [...STAGE_SHORT],
              series: [{ name: 'البرامج', values: byStage(() => 1), color: '#0070C0' }],
              cnt: ` (${ps.length})`
            }
          : null
      );
      const ben = byStage((p: any) => num(p.ben));
      C.push(sum(ben) ? { labels: [...STAGE_SHORT], series: [{ name: 'الطلبة', values: ben, color: '#05ABA3' }], cnt: ` (${sum(ben)})` } : null);
      const gif = byStage((p: any) => num(p.gifted));
      C.push(
        sum(gif)
          ? {
              labels: [...STAGE_SHORT],
              series: [
                { name: 'الحاصلون على رعاية', values: ben, color: '#9DC3E6' },
                { name: 'منهم المصنفون', values: gif, color: '#4472C4' }
              ],
              cnt: ` (${sum(gif)})`
            }
          : null
      );
      C.push(
        sum(mode)
          ? {
              labels: ['حضوري', 'عن بعد'],
              series: [{ name: 'الطلبة', values: mode, color: '#0070C0' }],
              cnt: ` (حضوري: ${mode[0]}، عن بعد: ${mode[1]})`
            }
          : null
      );
      C.push(
        ss.any || sp.any
          ? {
              labels: [...STAGE_SHORT],
              series: [
                { name: 'الطلبة', values: ss.s, color: '#4472C4' },
                { name: 'أولياء الأمور', values: sp.s, color: '#05ABA3' }
              ],
              cnt: ` (طلبة: ${ss.t}، أولياء أمور: ${sp.t})`
            }
          : null
      );
      C.push(
        sum(nP) || sum(nQ)
          ? {
              labels: [...STAGE_SHORT],
              series: [
                { name: 'المشاركون', values: nP, color: '#4472C4' },
                { name: 'المتأهلون', values: nQ, color: '#ED7D31' }
              ],
              cnt: ` (المشاركون: ${sum(nP)}، المتأهلون: ${sum(nQ)})`
            }
          : null
      );
      return C;
    }

    function getChartConfig(idx: number): CustomChartConfig {
      if (!S.final.customCharts) S.final.customCharts = {};
      if (!S.final.customCharts[idx]) {
        S.final.customCharts[idx] = { mode: 'auto', hidden: false };
      }
      return S.final.customCharts[idx];
    }

    function isChartHidden(idx: number): boolean {
      return Boolean(S.final?.customCharts?.[idx]?.hidden);
    }

    function getChartMode(idx: number): 'auto' | 'manual' {
      return S.final?.customCharts?.[idx]?.mode || 'auto';
    }

    function initManualChartConfig(idx: number) {
      const auto = getAutoChartData()[idx];
      const cfg = getChartConfig(idx);
      cfg.mode = 'manual';
      if (auto) {
        cfg.labels = [...auto.labels];
        cfg.series = auto.series.map((s: any) => ({
          name: s.name,
          values: [...s.values],
          color: s.color
        }));
        cfg.cnt = auto.cnt;
      } else {
        if (idx === 0) {
          cfg.labels = ['التفكير الإبداعي', 'حل المشكلات', 'الروبوت والبرمجة'];
          cfg.series = [{ name: 'عدد البرامج', values: [0, 0, 0], color: '#4472C4' }];
          cfg.cnt = ' (3 مجالات)';
        } else if (idx === 4) {
          cfg.labels = ['حضوري', 'عن بعد'];
          cfg.series = [{ name: 'الطلبة', values: [0, 0], color: '#0070C0' }];
          cfg.cnt = ' (حضوري: 0، عن بعد: 0)';
        } else if (idx === 3) {
          cfg.labels = [...STAGE_SHORT];
          cfg.series = [
            { name: 'الحاصلون على رعاية', values: [0, 0, 0], color: '#9DC3E6' },
            { name: 'منهم المصنفون', values: [0, 0, 0], color: '#4472C4' }
          ];
          cfg.cnt = ' (0)';
        } else if (idx === 5) {
          cfg.labels = [...STAGE_SHORT];
          cfg.series = [
            { name: 'الطلبة', values: [0, 0, 0], color: '#4472C4' },
            { name: 'أولياء الأمور', values: [0, 0, 0], color: '#05ABA3' }
          ];
          cfg.cnt = ' (طلبة: 0، أولياء أمور: 0)';
        } else if (idx === 6) {
          cfg.labels = [...STAGE_SHORT];
          cfg.series = [
            { name: 'المشاركون', values: [0, 0, 0], color: '#4472C4' },
            { name: 'المتأهلون', values: [0, 0, 0], color: '#ED7D31' }
          ];
          cfg.cnt = ' (المشاركون: 0، المتأهلون: 0)';
        } else {
          cfg.labels = [...STAGE_SHORT];
          cfg.series = [{ name: idx === 1 ? 'البرامج' : 'الطلبة', values: [0, 0, 0], color: idx === 1 ? '#0070C0' : '#05ABA3' }];
          cfg.cnt = ' (0)';
        }
      }
    }

    function migrateChartFromReport(idx: number) {
      histRecordBefore('final');
      initManualChartConfig(idx);
      histRecordAfter('final', 'ترحيل بيانات الرسم');
      renderForm();
      schedule('final');
      renderPreview();
      toast(`تم ترحيل بيانات الرسم (${CH_TITLES[idx].slice(0, 25)}...) بنجاح (يمكنك التراجع ↶ أو Ctrl+Z)`);
    }

    function migrateAllChartsFromReport() {
      histRecordBefore('final');
      for (let i = 0; i < 7; i++) {
        initManualChartConfig(i);
      }
      histRecordAfter('final', 'ترحيل كافة الرسوم البيانية');
      renderForm();
      schedule('final');
      renderPreview();
      toast('تم ترحيل كافة بيانات الرسوم البيانية الـ 7 من التقرير بنجاح (يمكنك التراجع ↶ أو Ctrl+Z)');
    }

    function toggleChartHidden(idx: number) {
      const cfg = getChartConfig(idx);
      cfg.hidden = !cfg.hidden;
      renderForm();
      schedule('final');
      renderPreview();
      toast(cfg.hidden ? `تم إخفاء الرسم البياني (${idx + 1}) من التقرير` : `تم إظهار الرسم البياني (${idx + 1}) في التقرير`);
    }

    function toggleAllChartsHidden(hide: boolean) {
      for (let i = 0; i < 7; i++) {
        const cfg = getChartConfig(i);
        cfg.hidden = hide;
      }
      renderForm();
      schedule('final');
      renderPreview();
      toast(hide ? 'تم إخفاء كافة الرسوم البيانية الـ 7 من التقرير' : 'تم إظهار كافة الرسوم البيانية الـ 7 في التقرير');
    }

    function setChartMode(idx: number, mode: 'auto' | 'manual') {
      const cfg = getChartConfig(idx);
      cfg.mode = mode;
      if (mode === 'manual' && (!cfg.series || !cfg.series.length)) {
        initManualChartConfig(idx);
      }
      renderForm();
      schedule('final');
      renderPreview();
      toast(mode === 'manual' ? `تم تفعيل الإدخال والتعديل اليدوي للرسم (${idx + 1})` : `تم تفعيل الترحيل التلقائي للرسم (${idx + 1})`);
    }

    function isChartTableShown(idx: number): boolean {
      return Boolean(S.final?.customCharts?.[idx]?.showTable);
    }

    function toggleChartTable(idx: number) {
      const cfg = getChartConfig(idx);
      cfg.showTable = !cfg.showTable;
      renderForm();
      schedule('final');
      renderPreview();
      toast(cfg.showTable ? `تم تفعيل إظهار الجدول الإحصائي مع الرسم البياني (${idx + 1})` : `تم ضبط العرض على الرسم البياني فقط (${idx + 1})`);
    }

    function toggleAllChartTables(show: boolean) {
      for (let i = 0; i < 7; i++) {
        const cfg = getChartConfig(i);
        cfg.showTable = show;
      }
      renderForm();
      schedule('final');
      renderPreview();
      toast(show ? 'تم تفعيل إظهار الجداول مع كافة الرسوم البيانية معًا' : 'تم ضبط العرض على الرسوم البيانية فقط');
    }

    function addChartAxisCol(idx: number) {
      histRecordBefore('final');
      const cfg = getChartConfig(idx);
      if (!cfg.labels || !cfg.series) initManualChartConfig(idx);
      cfg.labels = cfg.labels || [];
      cfg.labels.push(`فئة ${cfg.labels.length + 1}`);
      cfg.series?.forEach((s) => {
        s.values.push(0);
      });
      histRecordAfter('final', 'إضافة عمود/محور للرسم');
      renderForm();
      schedule('final');
      renderPreview();
      toast(`تمت إضافة محور/فئة جديدة للرسم (${idx + 1}) (يمكنك التراجع ↶ أو Ctrl+Z)`);
    }

    function delChartAxisCol(idx: number, colIdx: number) {
      const cfg = getChartConfig(idx);
      if (!cfg.labels || !cfg.series) initManualChartConfig(idx);
      if (cfg.labels && cfg.labels.length > 1) {
        histRecordBefore('final');
        cfg.labels.splice(colIdx, 1);
        cfg.series?.forEach((s) => {
          s.values.splice(colIdx, 1);
        });
        histRecordAfter('final', 'حذف عمود/محور من الرسم');
        renderForm();
        schedule('final');
        renderPreview();
        toast(`تم حذف المحور/الفئة من الرسم (${idx + 1}) (يمكنك التراجع ↶ أو Ctrl+Z)`);
      } else {
        toast('يجب أن يحتوي الرسم على محور/فئة واحدة على الأقل');
      }
    }

    function clearChartData(idx: number) {
      histRecordBefore('final');
      const cfg = getChartConfig(idx);
      cfg.mode = 'manual';
      if (idx === 0) {
        cfg.labels = [];
        cfg.series = [{ name: 'عدد البرامج', values: [], color: '#4472C4' }];
        cfg.cnt = ' (0 مجالات)';
      } else {
        initManualChartConfig(idx);
        cfg.series?.forEach((s) => {
          s.values = s.values.map(() => 0);
        });
        cfg.cnt = ' (0)';
      }
      if (idx === 6) {
        S.final.nsP = ['', '', ''];
        S.final.nsQ = ['', '', ''];
      }
      histRecordAfter('final', 'تفريغ بيانات الرسم');
      renderForm();
      schedule('final');
      renderPreview();
      toast(`تم تفريغ وحذف بيانات الرسم (${idx + 1}) (يمكنك التراجع ↶ أو Ctrl+Z)`);
    }

    function addChartFieldRow() {
      histRecordBefore('final');
      const cfg = getChartConfig(0);
      if (!cfg.labels || !cfg.series) initManualChartConfig(0);
      cfg.labels = cfg.labels || [];
      if (!cfg.series || !cfg.series[0]) {
        cfg.series = [{ name: 'عدد البرامج', values: [], color: '#4472C4' }];
      }
      cfg.labels.push('مجال جديد');
      cfg.series[0].values.push(0);
      histRecordAfter('final', 'إضافة صف جديد للرسم');
      renderForm();
      schedule('final');
      renderPreview();
      toast('تمت إضافة صف جديد للرسم البياني (يمكنك التراجع ↶ أو Ctrl+Z)');
      const lastInp = document.querySelector(`[data-chart-field-name="${cfg.labels.length - 1}"]`) as HTMLInputElement | null;
      if (lastInp) {
        lastInp.scrollIntoView({ behavior: 'smooth', block: 'center' });
        lastInp.focus();
        lastInp.select();
      }
    }

    function delChartFieldRow(rIdx: number) {
      histRecordBefore('final');
      const cfg = getChartConfig(0);
      if (!cfg.labels || !cfg.series) initManualChartConfig(0);
      if (cfg.labels) cfg.labels.splice(rIdx, 1);
      if (cfg.series?.[0]) cfg.series[0].values.splice(rIdx, 1);
      histRecordAfter('final', 'حذف صف من الرسم');
      renderForm();
      schedule('final');
      renderPreview();
      toast('تم حذف الصف من الرسم (يمكنك التراجع ↶ أو Ctrl+Z)');
    }

    function addChartSeriesRow(idx: number) {
      histRecordBefore('final');
      const cfg = getChartConfig(idx);
      if (!cfg.labels || !cfg.series) initManualChartConfig(idx);
      const labels = (cfg.labels && cfg.labels.length) ? cfg.labels : (idx === 4 ? ['حضوري', 'عن بعد'] : [...STAGE_SHORT]);
      cfg.labels = labels;
      if (!cfg.series) cfg.series = [];
      const colors = ['#0E5E5A', '#2563EB', '#D97706', '#DC2626', '#7C3AED', '#059669', '#DB2777', '#475569'];
      const nextColor = colors[cfg.series.length % colors.length];
      const newSIdx = cfg.series.length;
      cfg.series.push({
        name: `سلسلة بيانات ${newSIdx + 1}`,
        values: labels.map(() => 0),
        color: nextColor
      });
      histRecordAfter('final', 'إضافة صف جديد للرسم');
      renderForm();
      schedule('final');
      renderPreview();
      toast('تمت إضافة صف جديد للرسم البياني (يمكنك التراجع ↶ أو Ctrl+Z)');
      const lastInp = document.querySelector(`[data-chart-series-name="${idx}.${newSIdx}"]`) as HTMLInputElement | null;
      if (lastInp) {
        lastInp.scrollIntoView({ behavior: 'smooth', block: 'center' });
        lastInp.focus();
        lastInp.select();
      }
    }

    function delChartSeriesRow(idx: number, sIdx: number) {
      const cfg = getChartConfig(idx);
      if (!cfg.series || cfg.series.length <= 1) {
        toast('يجب أن يحتوي الرسم على صف/سلسلة واحدة على الأقل');
        return;
      }
      histRecordBefore('final');
      cfg.series.splice(sIdx, 1);
      histRecordAfter('final', 'حذف صف من الرسم');
      renderForm();
      schedule('final');
      renderPreview();
      toast('تم حذف الصف بنجاح (يمكنك التراجع ↶ أو Ctrl+Z)');
    }

    function chartData() {
      const auto = getAutoChartData();
      const res: any[] = [];
      for (let i = 0; i < 7; i++) {
        if (isChartHidden(i)) {
          res.push(null);
          continue;
        }
        const mode = getChartMode(i);
        if (mode === 'manual') {
          const cfg = S.final?.customCharts?.[i];
          if (!cfg || !cfg.series || !cfg.labels || !cfg.labels.length) {
            res.push(null);
            continue;
          }
          const sumVals = cfg.series.flatMap((s) => s.values.map(num)).reduce((a, b) => a + b, 0);
          if (sumVals === 0 && cfg.labels.length === 0) {
            res.push(null);
            continue;
          }
          let cnt = cfg.cnt || '';
          if (!cnt) {
            if (cfg.series.length === 1) {
              cnt = ` (${sumVals})`;
            } else {
              cnt = ' (' + cfg.series.map((s) => `${s.name}: ${s.values.map(num).reduce((a, b) => a + b, 0)}`).join('، ') + ')';
            }
          }
          res.push({
            labels: cfg.labels,
            series: cfg.series.map((s) => ({
              name: s.name,
              values: s.values.map(num),
              color: s.color || '#4472C4'
            })),
            cnt
          });
        } else {
          res.push(auto[i]);
        }
      }
      return res;
    }

    function renderManualChartGrid(idx: number, cfg: CustomChartConfig) {
      if (idx === 0) {
        const labels = cfg.labels || [];
        const vals = cfg.series?.[0]?.values || [];
        const sName = cfg.series?.[0]?.name || 'عدد البرامج';
        return `
          <div style="margin-top:6px;">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;font-size:12px;">
              <span style="font-weight:700;color:#0e5e5a;">اسم بيان المحور / السلسلة:</span>
              <input type="text" data-chart-series-name="0.0" value="${esc(sName)}" style="flex:1;max-width:200px;padding:3px 6px;border:1px solid #94a3b8;border-radius:4px;font-size:12px;">
            </div>
            <table class="chart-manual-grid">
              <thead>
                <tr>
                  <th style="width:36px;">#</th>
                  <th>المحور الرئيسي (اسم المجال)</th>
                  <th style="width:110px;">${esc(sName)}</th>
                  <th style="width:46px;">حذف</th>
                </tr>
              </thead>
              <tbody>
                ${labels.map((lab, rIdx) => `
                  <tr>
                    <td>${rIdx + 1}</td>
                    <td>
                      <input type="text" data-chart-field-name="${rIdx}" value="${esc(lab)}" placeholder="اسم المجال / المحور">
                    </td>
                    <td>
                      <input type="text" inputmode="numeric" data-chart-field-val="${rIdx}" value="${esc(vals[rIdx] ?? 0)}">
                    </td>
                    <td>
                      <button type="button" class="ghost-btn" style="padding:2px 6px;margin:0;color:#dc2626;" data-act="del-chart-field" data-row-index="${rIdx}">✕</button>
                    </td>
                  </tr>
                `).join('')}
                ${labels.length === 0 ? '<tr><td colspan="4" style="color:#94a3b8;padding:10px;">لا توجد مجالات مدخلة. انقر على «إضافة صف جديد» أدناه أو «ترحيل من البرامج».</td></tr>' : ''}
              </tbody>
            </table>
            <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
              <button type="button" class="ghost-btn" style="padding:4px 12px;font-size:12px;color:#0e5e5a;font-weight:700;border:1.5px dashed #0d9488;background:#f0fdfa;" data-act="add-chart-field">➕ إضافة صف جديد</button>
              <button type="button" class="ghost-btn" style="padding:4px 10px;font-size:11.5px;color:#0e5e5a;font-weight:700;" data-act="undo" title="تراجع (Ctrl+Z)">↶ تراجع</button>
              <button type="button" class="ghost-btn" style="padding:4px 10px;font-size:11.5px;color:#0e5e5a;font-weight:700;" data-act="redo" title="إعادة (Ctrl+Y)">↷ إعادة</button>
              <button type="button" class="ghost-btn" style="padding:4px 10px;font-size:11.5px;color:#475569;" data-act="migrate-single-chart" data-chart-index="0">🔄 إعادة ترحيل من البرامج</button>
            </div>
          </div>
        `;
      }

      const labels = (cfg.labels && cfg.labels.length) ? cfg.labels : (idx === 4 ? ['حضوري', 'عن بعد'] : [...STAGE_SHORT]);
      const series = (cfg.series && cfg.series.length) ? cfg.series : (
        idx === 3
          ? [{ name: 'الحاصلون على رعاية', values: labels.map(() => 0), color: '#9DC3E6' }, { name: 'منهم المصنفون', values: labels.map(() => 0), color: '#4472C4' }]
          : idx === 5
            ? [{ name: 'الطلبة', values: labels.map(() => 0), color: '#4472C4' }, { name: 'أولياء الأمور', values: labels.map(() => 0), color: '#05ABA3' }]
            : idx === 6
              ? [{ name: 'المشاركون', values: labels.map(() => 0), color: '#4472C4' }, { name: 'المتأهلون', values: labels.map(() => 0), color: '#ED7D31' }]
              : [{ name: idx === 1 ? 'البرامج' : 'الطلبة', values: labels.map(() => 0), color: idx === 1 ? '#0070C0' : '#05ABA3' }]
      );

      return `
        <div style="margin-top:6px;">
          <div style="margin-bottom:6px;font-size:11.5px;color:#475569;">
            💡 يمكنك تعديل <strong>تسميات المحاور الرئيسية (الأعمدة)</strong>، و<strong>أسماء السلاسل والبيانات</strong>، وإضافة أو حذف صفوف ومحاور حسب الحاجة:
          </div>
          <div style="overflow-x:auto;">
            <table class="chart-manual-grid">
              <thead>
                <tr>
                  <th style="min-width:140px;background:#f8fafc;text-align:right;">المحور الرئيسي / الفئة</th>
                  ${labels.map((lab, colIdx) => `
                    <th style="padding:4px;min-width:105px;">
                      <div style="display:flex;align-items:center;gap:3px;">
                        <input type="text" data-chart-axis-label="${idx}.${colIdx}" value="${esc(lab)}" style="font-weight:700;text-align:center;padding:3px 5px;background:#fff;" placeholder="اسم المحور" title="تعديل اسم المحور الرئيسي">
                        ${labels.length > 1 ? `<button type="button" class="ghost-btn" style="padding:1px 4px;margin:0;color:#dc2626;font-size:10px;" data-act="del-chart-axis-col" data-chart-index="${idx}" data-col-index="${colIdx}" title="حذف هذا المحور">✕</button>` : ''}
                      </div>
                    </th>
                  `).join('')}
                  ${series.length > 1 ? '<th style="width:44px;padding:4px;">حذف</th>' : ''}
                </tr>
              </thead>
              <tbody>
                ${series.map((s, sIdx) => `
                  <tr>
                    <td style="padding:4px;background:#f8fafc;text-align:right;">
                      <div style="display:flex;align-items:center;gap:4px;">
                        <span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${s.color || '#0E5E5A'};"></span>
                        <input type="text" data-chart-series-name="${idx}.${sIdx}" value="${esc(s.name)}" style="font-weight:700;text-align:right;padding:3px 5px;background:#fff;" placeholder="اسم البيان / السلسلة" title="تعديل اسم السلسلة">
                      </div>
                    </td>
                    ${labels.map((_, colIdx) => `
                      <td>
                        <input type="text" inputmode="numeric" data-chart-val="${idx}.${sIdx}.${colIdx}" value="${esc(s.values[colIdx] ?? 0)}" aria-label="${labels[colIdx]} - ${s.name}">
                      </td>
                    `).join('')}
                    ${series.length > 1 ? `
                      <td>
                        <button type="button" class="ghost-btn" style="padding:2px 5px;margin:0;color:#dc2626;font-size:11px;" data-act="del-chart-series-row" data-chart-index="${idx}" data-series-index="${sIdx}" title="حذف هذا الصف">✕</button>
                      </td>
                    ` : ''}
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
            <button type="button" class="ghost-btn" style="padding:4px 12px;font-size:12px;color:#0e5e5a;font-weight:700;border:1.5px dashed #0d9488;background:#f0fdfa;" data-act="add-chart-series-row" data-chart-index="${idx}">➕ إضافة صف جديد</button>
            <button type="button" class="ghost-btn" style="padding:4px 10px;font-size:11.5px;color:#0e5e5a;font-weight:600;" data-act="add-chart-axis-col" data-chart-index="${idx}">➕ إضافة عمود/محور جديد</button>
            <button type="button" class="ghost-btn" style="padding:4px 10px;font-size:11.5px;color:#0e5e5a;font-weight:700;" data-act="undo" title="تراجع (Ctrl+Z)">↶ تراجع</button>
            <button type="button" class="ghost-btn" style="padding:4px 10px;font-size:11.5px;color:#0e5e5a;font-weight:700;" data-act="redo" title="إعادة (Ctrl+Y)">↷ إعادة</button>
            <button type="button" class="ghost-btn" style="padding:4px 10px;font-size:11.5px;color:#475569;" data-act="migrate-single-chart" data-chart-index="${idx}">🔄 إعادة ترحيل من التقرير</button>
          </div>
        </div>
      `;
    }

    function chartCompanionTableHtml(idx: number, c: any) {
      if (!c || !c.labels || !c.series) return '';
      const isWide = c.labels.length > 5;
      if (isWide) {
        const totalVal = c.series[0]?.values?.reduce((a: number, b: number) => a + num(b), 0) || 0;
        return `
          <div class="chart-companion-box">
            <div style="background:#0e5e5a;color:#fff;padding:6px 12px;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:space-between;">
              <span>📋 جدول البيانات الإحصائية: ${esc(CH_TITLES[idx])}</span>
              <span style="font-size:11px;font-weight:400;opacity:0.9;">${esc(c.cnt || '')}</span>
            </div>
            <table class="chart-comp-table">
              <thead>
                <tr>
                  <th style="width:38px;">#</th>
                  <th style="text-align:right;">المحور الرئيسي / التصنيف</th>
                  ${c.series.map((s: any) => `<th style="width:110px;">${esc(s.name)}</th>`).join('')}
                  <th style="width:90px;">النسبة</th>
                </tr>
              </thead>
              <tbody>
                ${c.labels.map((lab: string, lIdx: number) => {
                  const val = num(c.series[0]?.values?.[lIdx]) || 0;
                  const pct = totalVal > 0 ? ((val / totalVal) * 100).toFixed(1) + '%' : '0%';
                  return `
                    <tr style="background:${lIdx % 2 === 0 ? '#fff' : '#f8fafc'};">
                      <td style="color:#64748b;">${lIdx + 1}</td>
                      <td style="font-weight:600;text-align:right;">${esc(lab)}</td>
                      ${c.series.map((s: any) => `<td style="font-weight:700;color:#0e5e5a;">${num(s.values?.[lIdx]) || 0}</td>`).join('')}
                      <td style="color:#475569;">${pct}</td>
                    </tr>
                  `;
                }).join('')}
                <tr style="background:#f0fdfa;font-weight:700;border-top:2px solid #0d9488;">
                  <td colspan="2" style="text-align:right;color:#0f766e;">الإجمالي الكلي</td>
                  ${c.series.map((s: any) => {
                    const sTotal = s.values.reduce((a: number, b: number) => a + num(b), 0);
                    return `<td style="color:#0f766e;">${sTotal}</td>`;
                  }).join('')}
                  <td style="color:#0f766e;">100%</td>
                </tr>
              </tbody>
            </table>
          </div>
        `;
      }

      const grandTotal = c.series.flatMap((s: any) => s.values.map(num)).reduce((a: number, b: number) => a + b, 0);

      return `
        <div class="chart-companion-box">
          <div style="background:#0e5e5a;color:#fff;padding:6px 12px;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:space-between;">
            <span>📋 جدول البيانات الإحصائية: ${esc(CH_TITLES[idx])}</span>
            <span style="font-size:11px;font-weight:400;opacity:0.9;">${esc(c.cnt || '')}</span>
          </div>
          <table class="chart-comp-table">
            <thead>
              <tr>
                <th style="text-align:right;min-width:140px;">المحور الرئيسي / البيان</th>
                ${c.labels.map((lab: string) => `<th>${esc(lab)}</th>`).join('')}
                <th style="width:80px;background:#e2e8f0;font-weight:700;">المجموع</th>
              </tr>
            </thead>
            <tbody>
              ${c.series.map((s: any, sIdx: number) => {
                const rowSum = s.values.reduce((a: number, b: number) => a + num(b), 0);
                return `
                  <tr style="background:${sIdx % 2 === 0 ? '#fff' : '#f8fafc'};">
                    <td style="font-weight:700;text-align:right;">
                      <span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${s.color || '#0E5E5A'};margin-left:6px;vertical-align:middle;"></span>
                      ${esc(s.name)}
                    </td>
                    ${s.values.map((v: any) => `<td style="font-weight:600;color:#0f172a;">${num(v) || 0}</td>`).join('')}
                    <td style="font-weight:700;background:#f0fdfa;color:#0e5e5a;">${rowSum}</td>
                  </tr>
                `;
              }).join('')}
              ${c.series.length > 1 ? `
                <tr style="background:#f1f5f9;font-weight:700;border-top:1.5px solid #cbd5e1;">
                  <td style="text-align:right;color:#334155;">إجمالي المحور</td>
                  ${c.labels.map((_: any, lIdx: number) => {
                    const colSum = c.series.reduce((acc: number, s: any) => acc + (num(s.values[lIdx]) || 0), 0);
                    return `<td style="color:#0f172a;">${colSum}</td>`;
                  }).join('')}
                  <td style="background:#0e5e5a;color:#fff;">${grandTotal}</td>
                </tr>
              ` : ''}
            </tbody>
          </table>
        </div>
      `;
    }

    function finalChartsSection() {
      const f = S.final;
      const autoData = getAutoChartData();
      return `<fieldset><legend>سادسًا: الإحصائيات والرسوم البيانية (Recharts تفاعلية)</legend>
        <div style="background:#f0fdfa;border:1.5px solid #0d9488;border-radius:10px;padding:12px;margin-bottom:14px;">
          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:8px;">
            <div>
              <strong style="font-size:13px;color:#0f766e;">📊 إحصائيات ورسوم التقرير الختامي الـ 7</strong>
              <div style="font-size:11.5px;color:#334155;margin-top:2px;">
                يمكنك التبديل بين <strong>الترحيل التلقائي</strong> أو <strong>الإدخال اليدوي</strong>، وتعديل <strong>المحاور الرئيسية والسلاسل</strong>، وخيار <strong>إظهار الجدول مع الرسم البياني معًا</strong> في التقرير.
              </div>
            </div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;">
              <button type="button" class="ghost-btn" style="padding:4px 9px;font-size:11.5px;font-weight:700;color:#0e5e5a;border-color:#0d9488;background:#fff" data-act="undo" title="تراجع (Ctrl+Z)">↶ تراجع</button>
              <button type="button" class="ghost-btn" style="padding:4px 9px;font-size:11.5px;font-weight:700;color:#0e5e5a;border-color:#0d9488;background:#fff" data-act="redo" title="إعادة (Ctrl+Y)">↷ إعادة</button>
              <button type="button" class="ghost-btn" style="padding:4px 9px;font-size:11.5px;font-weight:700;color:#0e5e5a;border-color:#0d9488;background:#fff" data-act="migrate-all-charts">🔄 ترحيل كافة الرسوم من التقرير</button>
              <button type="button" class="ghost-btn" style="padding:4px 9px;font-size:11.5px;font-weight:700;color:#0f766e;border-color:#0d9488;background:#f0fdf4" data-act="show-all-chart-tables">📊 + 📋 إظهار الجداول مع كافة الرسوم</button>
              <button type="button" class="ghost-btn" style="padding:4px 9px;font-size:11.5px;font-weight:600;color:#475569;background:#fff" data-act="hide-all-chart-tables">📊 رسوم فقط</button>
              <button type="button" class="ghost-btn" style="padding:4px 9px;font-size:11.5px;font-weight:600;color:#166534;background:#fff" data-act="show-all-charts">👁️ إظهار الكل</button>
              <button type="button" class="ghost-btn" style="padding:4px 9px;font-size:11.5px;font-weight:600;color:#b45309;background:#fff" data-act="hide-all-charts">🙈 إخفاء الكل</button>
            </div>
          </div>
        </div>

        <div style="display:flex;flex-direction:column;gap:12px;">
          ${CH_TITLES.map((title, idx) => {
            const isHidden = isChartHidden(idx);
            const mode = getChartMode(idx);
            const isTableShown = isChartTableShown(idx);
            const cfg = f.customCharts?.[idx] || {};
            const autoItem = autoData[idx];

            return `
            <div class="final-chart-card ${isHidden ? 'is-hidden' : ''}" style="border:1.5px solid #cbd5e1;border-right:5px solid ${isHidden ? '#94a3b8' : mode === 'manual' ? '#2563eb' : '#0d9488'};background:${isHidden ? '#f8fafc' : '#ffffff'};border-radius:9px;padding:12px;">
              <div class="final-chart-card-top" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;padding-bottom:8px;border-bottom:1px solid #f1f5f9;">
                <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                  <span class="final-chart-card-title" style="font-weight:700;font-size:13px;color:${isHidden ? '#64748b' : '#0f172a'};">${idx + 1}. ${esc(title)}</span>
                  <span style="font-size:11px;font-weight:700;padding:2px 7px;border-radius:12px;background:${mode === 'manual' ? '#eff6ff' : '#f0fdf4'};color:${mode === 'manual' ? '#1d4ed8' : '#15803d'};border:1px solid ${mode === 'manual' ? '#bfdbfe' : '#bbf7d0'};">
                    ${mode === 'manual' ? '✍️ إدخال يدوي' : '🔄 ترحيل تلقائي'}
                  </span>
                  <span style="font-size:11px;font-weight:700;padding:2px 7px;border-radius:12px;background:${isTableShown ? '#ecfdf5' : '#f8fafc'};color:${isTableShown ? '#065f46' : '#64748b'};border:1px solid ${isTableShown ? '#a7f3d0' : '#e2e8f0'};">
                    ${isTableShown ? '📊 + 📋 رسم وجدول معًا' : '📊 رسم بياني فقط'}
                  </span>
                  ${isHidden ? '<span style="font-size:11px;font-weight:700;padding:2px 7px;border-radius:12px;background:#fef2f2;color:#b91c1c;border:1px solid #fecaca;">🙈 مخفي من التقرير</span>' : '<span style="font-size:11px;font-weight:600;padding:2px 7px;border-radius:12px;background:#f0fdfa;color:#0f766e;border:1px solid #ccfbf1;">👁️ معروض</span>'}
                </div>
                <div style="display:flex;gap:5px;align-items:center;flex-wrap:wrap;">
                  <button type="button" class="ghost-btn" style="padding:3px 8px;font-size:11px;font-weight:700;margin:0;color:${isTableShown ? '#0e5e5a' : '#475569'};background:${isTableShown ? '#e6fffa' : '#fff'};border-color:${isTableShown ? '#0d9488' : '#cbd5e1'};" data-act="toggle-chart-table" data-chart-index="${idx}">
                    ${isTableShown ? '📋 الجدول مع الرسم: مُفعّل ✓' : '📊 + 📋 إظهار الجدول مع الرسم'}
                  </button>
                  <button type="button" class="ghost-btn" style="padding:3px 8px;font-size:11px;font-weight:600;margin:0;color:${mode === 'manual' ? '#0f766e' : '#1d4ed8'};" data-act="set-chart-mode" data-chart-index="${idx}" data-mode="${mode === 'manual' ? 'auto' : 'manual'}">
                    ${mode === 'manual' ? '🔄 ترحيل من التقرير' : '✍️ تحويل ليدوي'}
                  </button>
                  <button type="button" class="ghost-btn" style="padding:3px 8px;font-size:11px;font-weight:600;margin:0;color:${isHidden ? '#166534' : '#b45309'};" data-act="toggle-chart-hide" data-chart-index="${idx}">
                    ${isHidden ? '👁️ إظهار' : '🙈 عدم الإظهار'}
                  </button>
                  <button type="button" class="ghost-btn" style="padding:3px 8px;font-size:11px;font-weight:600;margin:0;color:#0e5e5a;" data-act="enlarge-chart" data-chart-index="${idx}">
                    🔍 تكبير
                  </button>
                  <button type="button" class="ghost-btn" style="padding:3px 8px;font-size:11px;font-weight:600;margin:0;color:#dc2626;" data-act="clear-chart" data-chart-index="${idx}">
                    🗑️ تفريغ
                  </button>
                </div>
              </div>

              <div style="margin-top:10px;">
                ${isHidden ? `
                  <div style="padding:8px 12px;background:#f1f5f9;border-radius:6px;font-size:12px;color:#475569;display:flex;align-items:center;justify-content:space-between;">
                    <span>⚠️ هذا الرسم مخفي ولن يظهر في التقرير أو الطباعة أو ملف Word.</span>
                    <button type="button" class="ghost-btn" style="padding:2px 8px;font-size:11px;margin:0;color:#0e5e5a;" data-act="toggle-chart-hide" data-chart-index="${idx}">إلغاء الإخفاء</button>
                  </div>
                ` : mode === 'auto' ? `
                  <div style="padding:8px 12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;font-size:12px;">
                    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:gap:6px;">
                      <span style="color:#334155;">البيانات الحالية: <strong>${autoItem ? autoItem.cnt : '(لا توجد بيانات مرحلة بعد)'}</strong></span>
                      <button type="button" class="ghost-btn" style="padding:2px 8px;font-size:11px;margin:0;color:#1d4ed8;font-weight:600;" data-act="migrate-single-chart" data-chart-index="${idx}">
                        ✏️ نسخ وتعديل يدوي للمحاور والأرقام
                      </button>
                    </div>
                    ${autoItem ? `
                      <div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap;font-size:11.5px;color:#475569;">
                        ${autoItem.labels.map((lab: string, lIdx: number) => `
                          <span style="background:#fff;border:1px solid #cbd5e1;border-radius:4px;padding:2px 6px;">
                            ${esc(lab)}: <strong>${autoItem.series.map((s: any) => s.values[lIdx] ?? 0).join(' / ')}</strong>
                          </span>
                        `).join('')}
                      </div>
                    ` : ''}
                  </div>
                ` : `
                  ${renderManualChartGrid(idx, cfg)}
                `}
              </div>
            </div>
            `;
          }).join('')}
        </div>
      </fieldset>`;
    }

    const chartCache = new Map();
    function chartPNG(c: any, showTable: boolean = false) {
      const key = JSON.stringify(c) + '_' + String(showTable);
      if (chartCache.has(key)) return chartCache.get(key);
      const W = 1200;
      const tableH = showTable ? (c.labels.length > 5 ? 240 : 160) : 0;
      const H = 520 + tableH;
      const cv = document.createElement('canvas');
      cv.width = W;
      cv.height = H;
      const g = cv.getContext('2d');
      if (!g) return '';
      const F = '"Noto Naskh Arabic", Tahoma, Arial, sans-serif';
      g.fillStyle = '#fff';
      g.fillRect(0, 0, W, H);

      let chartOffset = 0;
      if (showTable) {
        chartOffset = tableH;
        try { g.direction = 'rtl'; } catch (e) {}
        const tLeft = 60;
        const tRight = W - 40;
        const tWidth = tRight - tLeft;
        const tTop = 15;

        g.fillStyle = '#0e5e5a';
        g.fillRect(tLeft, tTop, tWidth, 34);
        g.fillStyle = '#ffffff';
        g.font = 'bold 18px ' + F;
        g.textAlign = 'right';
        g.textBaseline = 'middle';
        g.fillText('جدول البيانات الإحصائية ' + (c.cnt || ''), tRight - 15, tTop + 17);

        const numCols = c.labels.length + 2;
        const colW = tWidth / numCols;
        g.fillStyle = '#f1f5f9';
        g.fillRect(tLeft, tTop + 34, tWidth, 30);
        g.strokeStyle = '#cbd5e1';
        g.lineWidth = 1;
        g.strokeRect(tLeft, tTop + 34, tWidth, 30);

        g.fillStyle = '#1e293b';
        g.font = 'bold 16px ' + F;
        g.textAlign = 'center';
        g.fillText('المحور / البيان', tRight - colW / 2, tTop + 49);
        c.labels.forEach((lab: string, i: number) => {
          g.fillText(String(lab), tRight - colW * (i + 1.5), tTop + 49);
        });
        g.fillText('المجموع', tLeft + colW / 2, tTop + 49);

        c.series.forEach((s: any, sIdx: number) => {
          const rowY = tTop + 64 + sIdx * 30;
          g.fillStyle = sIdx % 2 === 0 ? '#ffffff' : '#f8fafc';
          g.fillRect(tLeft, rowY, tWidth, 30);
          g.strokeRect(tLeft, rowY, tWidth, 30);

          g.fillStyle = s.color || '#0e5e5a';
          g.fillRect(tRight - 20, rowY + 9, 12, 12);
          g.fillStyle = '#0f172a';
          g.font = 'bold 15px ' + F;
          g.textAlign = 'right';
          g.fillText(s.name, tRight - 28, rowY + 16);

          g.font = '16px ' + F;
          g.textAlign = 'center';
          let rSum = 0;
          c.labels.forEach((_: any, i: number) => {
            const val = +s.values[i] || 0;
            rSum += val;
            g.fillText(String(val), tRight - colW * (i + 1.5), rowY + 16);
          });
          g.fillStyle = '#0e5e5a';
          g.font = 'bold 16px ' + F;
          g.fillText(String(rSum), tLeft + colW / 2, rowY + 16);
        });
      }

      const top = chartOffset + (c.series.length > 1 ? 80 : 40);
      const bottom = H - 90;
      const left = 80;
      const right = W - 40;
      const max = Math.max(1, ...c.series.flatMap((s: any) => s.values));
      const step = Math.pow(10, Math.floor(Math.log10(max)));
      const nice = (Math.ceil((max / step) * (max / step < 2 ? 4 : 1)) * step) / (max / step < 2 ? 4 : 1);
      g.font = '20px ' + F;
      g.fillStyle = '#5b6770';
      g.strokeStyle = '#e3e8ef';
      g.lineWidth = 1.5;
      g.textAlign = 'right';
      g.textBaseline = 'middle';
      for (let k = 0; k <= 4; k++) {
        const y = bottom - ((bottom - top) * k) / 4;
        g.beginPath();
        g.moveTo(left, y);
        g.lineTo(right, y);
        g.stroke();
        g.fillText(String(+((nice * k) / 4).toFixed(1)), left - 12, y);
      }
      const n = c.labels.length;
      const slot = (right - left) / n;
      const gs = c.series.length;
      const bw = Math.min(110, (slot * 0.62) / gs);
      try {
        g.direction = 'rtl';
      } catch (e) {}
      c.labels.forEach((lab: string, i: number) => {
        const cx = right - slot * (i + 0.5);
        c.series.forEach((s: any, j: number) => {
          const val = +s.values[i] || 0;
          const h = ((bottom - top) * val) / nice;
          const x = cx + (gs / 2 - j - 1) * bw;
          g.fillStyle = s.color;
          g.fillRect(x + 4, bottom - h, bw - 8, h);
          g.fillStyle = '#1f2d2d';
          g.font = 'bold 22px ' + F;
          g.textAlign = 'center';
          g.textBaseline = 'bottom';
          g.fillText(String(val), x + bw / 2, bottom - h - 6);
        });
        g.fillStyle = '#1f2d2d';
        g.font = '22px ' + F;
        g.textAlign = 'center';
        g.textBaseline = 'top';
        const words = String(lab).split(' ');
        let line = '';
        const linesArr: string[] = [];
        words.forEach((w) => {
          const t = line ? line + ' ' + w : w;
          if (g.measureText(t).width > slot - 10 && line) {
            linesArr.push(line);
            line = w;
          } else line = t;
        });
        linesArr.push(line);
        linesArr.slice(0, 2).forEach((l, li) => g.fillText(l, cx, bottom + 12 + li * 28));
      });
      g.strokeStyle = '#8a96a0';
      g.beginPath();
      g.moveTo(left, bottom);
      g.lineTo(right, bottom);
      g.stroke();
      if (gs > 1) {
        let x = right;
        g.font = '21px ' + F;
        g.textBaseline = 'middle';
        c.series.forEach((s: any) => {
          g.fillStyle = s.color;
          g.fillRect(x - 22, chartOffset + 26, 22, 22);
          g.fillStyle = '#1f2d2d';
          g.textAlign = 'right';
          g.fillText(s.name, x - 30, chartOffset + 38);
          x -= 60 + g.measureText(s.name).width;
        });
      }
      const url = cv.toDataURL('image/png');
      chartCache.set(key, url);
      if (chartCache.size > 40) chartCache.delete(chartCache.keys().next().value);
      return url;
    }

    function docBlocks(k: 'monthly' | 'final') {
      const d = S[k];
      const P = S.profile;
      const B: any[] = [];
      if (k === 'monthly') {
        const dMonth = S.monthly;
        const cal = (dMonth as any).cal || 'h';
        const suf = cal === 'g' ? 'م' : 'هـ';
        const fromStr = dMonth.from ? fmtReportDate(dMonth.from, cal, false) : (cal === 'g' ? '00/00/2026' : '00/00/1448');
        const toStr = dMonth.to ? fmtReportDate(dMonth.to, cal, false) : (cal === 'g' ? '00/00/2026' : '00/ 00/1448');
        const yr = cal === 'g' ? '2026م' : '1448هـــ';
        B.push({
          html: `<p class="d-title">تقرير شهر (${v(dMonth.month, '..........')}) لمركز الموهوبين والموهوبات (بـــــ ${v(P.center, '..........')}) لعام ${yr}</p><p class="d-sub">الفصل الدراسي ${v(dMonth.semester, '..........')}&nbsp; الفترة من ${fromStr}${suf} إلى &nbsp; ${toStr}${suf}</p>`
        });
      } else {
        const fCal = (S.final as any).cal || 'h';
        const fYr = fCal === 'g' ? '2026م' : '1448هـ';
        B.push({
          html: `<p class="d-title">التقرير الختامي لمركز الموهوبين بــــــــــ ${v(P.center, '....................')} للعام الدراسي ${fYr}</p>`
        });
      }
      const ords = ['أولاً', 'ثانيًا', 'ثالثًا', 'رابعًا', 'خامسًا', 'سادسًا', 'سابعًا', 'ثامنًا', 'تاسعًا', 'عاشرًا'];
      let ordIdx = 0;
      const nextOrd = () => ords[ordIdx++] || `${ordIdx} - `;

      if (!isTableHidden(k, 'progs')) {
        B.push({ html: `<p class="d-h">${nextOrd()}: البرامج الإثرائية المنفذة:</p>`, keep: true });
        B.push(progTable(k));
      }

      if (!isTableHidden(k, 'ind')) {
        B.push({
          html: `<p class="d-h">${nextOrd()}: عدد الطلبة الذين تم احتسابهم في قيمة المؤشر وأكملوا 20 ساعة حضوري أو 40 ساعة عن بعد</p>`,
          keep: true
        });
        B.push({
          html: '<p class="d-bul">خاص بعدد المستهدفين من الطلبة المصنفين "إستثنائي، موهوب" من مقياس القدرات العقلية المتعدد "مقياس موهبة".</p>',
          keep: true
        });
        B.push({ html: gradeTable(d.ind, 'عدد المصنفين موهوبين') });
      }

      if (k === 'final' && !isTableHidden(k, 'students')) {
        B.push({
          html: `<p class="d-h">${nextOrd()}: أسماء الطلبة المصنفين "استثنائي، موهوب" حسب قوائم مقياس موهبة والذين تم رعايتهم خلال العام.</p>`,
          keep: true
        });
        B.push(studTable());
      }

      if (!isTableHidden(k, 'sat')) {
        B.push({ html: `<p class="d-h">${nextOrd()}: قياس رضاء المستفيد (الطالب/ الطالبة، ولي الأمر).</p>`, keep: true });
        B.push({ html: '<p class="d-bul">يتم قياس رضا المستفيد بعد كل برنامج إثرائي ينفذ (حضوري، عن بعد).</p>', keep: true });
        B.push({ html: gradeTable(d.sst, 'عدد المستفيدين والمصنفين من "مقياس موهبة"', '000', CAP_S) });
        B.push({ html: '<p class="d-bul">يتم قياس رضا المستفيد بعد كل برنامج إثرائي ينفذ (حضوري، عن بعد)</p>', keep: true });
        B.push({ html: gradeTable(d.spr, 'عدد أولياء أمور الطلبة المصنفين', '00', CAP_P) });
      }

      if (!isTableHidden(k, 'inits')) {
        B.push({ html: `<p class="d-h">${nextOrd()}: المبادرات والجهات المتعاونة:</p>`, keep: true });
        B.push(initTable(k));
      }

      if (k === 'final' && !isTableHidden(k, 'charts')) {
        const allCharts = chartData();
        const visible = allCharts.map((c, i) => ({ c, i })).filter((x) => x.c && !isChartHidden(x.i));
        if (visible.length) {
          B.push({ html: `<p class="d-h">${nextOrd()}: الاحصائيات والرسوم البيانية:</p>`, keep: true });
          visible.forEach(({ c, i }) => {
            const showTbl = isChartTableShown(i);
            const tblHtml = showTbl ? chartCompanionTableHtml(i, c) : '';
            B.push({
              html: `<div class="chart-recharts-card" data-chart-index="${i}">
                ${tblHtml}
                <div class="interactive-chart-mount" data-chart-index="${i}" style="width:100%;min-height:265px;"></div>
              </div>`
            });
          });
        }
      }

      B.push({
        html: `<p class="d-h">${nextOrd()}: الشواهد (صور للطلبة في البرامج تكون موضحة لتنفيذ برنامج تدريبي):</p>`,
        keep: true
      });
      B.push({ html: framesHtml(k) + sigHtml() });
      return B;
    }

    function paginate(blocks: any[], H: number) {
      const m = $('#measure');
      m.style.width = 1123 - 152 + 'px';
      blocks.forEach((b) => {
        if (b.table) {
          m.innerHTML = `<table class="${b.cls}">${b.cg}${b.rows.join('')}</table>`;
          const tb = m.firstChild as HTMLElement;
          const trs = tb.querySelectorAll('tr');
          b.h = [...trs].map((tr) => tr.getBoundingClientRect().height);
          b.base = Math.max(0, tb.getBoundingClientRect().height - b.h.reduce((a: number, c: number) => a + c, 0)) + 2;
        } else {
          m.innerHTML = b.html;
          b.hh = m.getBoundingClientRect().height;
        }
      });
      m.innerHTML = '';
      const first = (b: any) => (b.table ? b.base + b.h[0] + (b.h[1] || 0) : b.hh);
      const pages: any[][] = [[]];
      let used = 0;
      const push = (html: string, h: number) => {
        pages[pages.length - 1].push(html);
        used += h;
      };
      const next = () => {
        pages.push([]);
        used = 0;
      };
      blocks.forEach((b, i) => {
        if (!b.table) {
          let need = b.hh;
          let j = i;
          while (blocks[j] && blocks[j].keep && blocks[j + 1]) {
            j++;
            need += blocks[j].keep ? blocks[j].hh : first(blocks[j]);
          }
          if (used > 0 && used + need > H) next();
          push(b.html, b.hh);
          return;
        }
        let rows: string[] = [];
        let h = b.base;
        const n = b.rows.length;
        const flush = () => {
          if (rows.length) push(`<table class="${b.cls}">${b.cg}${rows.join('')}</table>`, h);
        };
        for (let r = 0; r < n; r++) {
          let need = b.h[r] + (r === 0 && n > 1 ? b.h[1] : 0) + (b.tailKeep && r === n - 2 ? b.h[n - 1] : 0);
          if (used + h + need > H && (used > 0 || rows.length)) {
            flush();
            next();
            rows = [];
            h = b.base;
          }
          rows.push(b.rows[r]);
          h += b.h[r];
        }
        flush();
      });
      return pages.filter((p) => p.length);
    }

    function docPages(k: 'monthly' | 'final') {
      const pages = paginate(docBlocks(k), PAGE.land.ch);
      return pages
        .map((p) => `<div class="page land">${header(k)}<div class="content doc">${p.join('')}</div></div>`)
        .join('');
    }

    /* ---------------- stats page ---------------- */
    function statsCalc() {
      const st = S.stats;
      const g = (a: string[]) => stageSums(a);
      return { q3: num(st.q4) + num(st.q5), g2: g(st.g2), g3: g(st.g3), g4: g(st.g4) };
    }

    function statsPage() {
      const st = S.stats;
      const c = statsCalc();
      const V = (x: any) => (has(x) ? esc(x) : '0');
      const r1 = (l: string, val: any, calc?: number) =>
        `<div class="sh-row"><div class="l">${l}</div><div class="v${calc ? ' calc' : ''}">${val}</div></div>`;
      const r3 = (cells: [string, any, number?][]) =>
        `<div class="sh-3">${cells.map(([l, val, calc]) => `<div class="c"><div class="l">${l}</div><div class="v${calc ? ' calc' : ''}">${val}</div></div>`).join('')}</div>`;
      const grades = (arr: string[], sums: any, pre: any, nums: number[]) => {
        const G = ['الصف 4', 'الصف5', 'الصف6'];
        const M = ['الصف الأول متوسط', 'الصف الثاني  متوسط', 'الصف الثالث متوسط'];
        const T = ['الصف الأول ثانوي', 'الصف الثاني ثانوي', 'الصف الثالث ثانوي'];
        let h = r3([
          [`${nums[0]}- ${pre.tot} المرحلة الابتدائية`, sums.s[0], 1],
          [`${nums[1]}- ${pre.tot} المرحلة المتوسطة`, sums.s[1], 1],
          [`${nums[2]}- ${pre.tot} المرحلة الثانوية`, sums.s[2], 1]
        ]);
        for (let i = 0; i < 3; i++) {
          h += r3([
            [`${nums[0] + i + 1}- ${pre.one} ${G[i]}`, V(arr[i])],
            [`${nums[1] + i + 1}- ${pre.one} ${M[i]}`, V(arr[3 + i])],
            [`${nums[2] + i + 1}- ${pre.one} ${T[i]}`, V(arr[6 + i])]
          ]);
        }
        return h;
      };
      return `<div class="page port"><div class="sheet">
        <div class="sh-bar"> بيانات مركز الموهوبين في ${has(st.region) ? esc(st.region) : '................................................'} </div>
        ${r1('1- هل يوجد مركز للموهوبين في المنطقة / المحافظة', has(st.q1) ? esc(st.q1) : 'نعم / لا')}
        ${r1('2- عدد مراكز الموهوبين في المنطقة التعليمية', V(st.q2))}
        ${r1('3- العدد الاجمالي  للمشرفين ومعلمين الموهوبين على ملاك المركز', c.q3, 1)}
        ${r1('4- العدد الاجمالي  لمشرفي  الموهوبين  على ملاك  المركز', V(st.q4))}
        ${r1('5- العدد الاجمالي  لمعلمي  الموهوبين  المفرغين على ملاك المركز', V(st.q5))}
        ${r3([
          ['6- عدد الطلبة المصنفين موهوبين والمرشحين لبرامج مركز الموهوبين للمرحلة الابتدائية', V(st.q6)],
          ['7- عدد الطلبة المصنفين موهوبين والمرشحين لبرامج مركز الموهوبين للمرحلة المتوسطة', V(st.q7)],
          ['8- عدد الطلبة المصنفين موهوبين والمرشحين لبرامج مركز الموهوبين للمرحلة الثانوية', V(st.q8)]
        ])}
        ${r3([
          ['9- عدد البرامج التي قدمت للطلبة الموهوبين للمرحلة الإبتدائية في مركز الموهوبين', V(st.q9)],
          ['10- عدد البرامج التي قدمت للطلبة الموهوبين للمرحلة المتوسطة', V(st.q10)],
          ['11- عدد البرامج التي قدمت للطلبة الموهوبين للمرحلة الثانوية في مركز الموهوبين', V(st.q11)]
        ])}
        <div class="sh-bar"> البرامج الاثرائية المقدمة للطلبة الموهوبين </div>
        ${r1('1- اجمالي عدد الطلبة الموهوبين الملتحقين بالبرامج', c.g2.t, 1)}
        ${grades(st.g2, c.g2, { tot: 'اجمالي عدد الطلبة الموهوبين الملتحقين بالبرامج', one: 'عدد الطلبة الموهوبين الملتحقين بالبرامج' }, [3, 7, 11])}
        ${r1('15- عدد البرامج الإثرائية التي قدمت للطلبة الموهوبين - خارج وقت الدوام (مسائي- عطلة نهاية الاسبوع-الاجازات القصيرة)', V(st.q15))}
        ${r1('16- هل تم تقديم برنامج اثرائي صيفي', has(st.q16) ? esc(st.q16) : 'نعم / لا')}
        ${r3([
          ['17- اجمالي عدد البرامج الإثرائية التي قدمت للطلبة الموهوبين المرحلة الابتدائية', V(st.q17)],
          ['18- اجمالي عدد البرامج الإثرائية التي قدمت للطلبة الموهوبين المرحلة المتوسطة', V(st.q18)],
          ['19- اجمالي عدد البرامج الإثرائية التي قدمت للطلبة الموهوبين المرحلة الثانوية', V(st.q19)]
        ])}
        <div class="sh-bar"> البرامج الاثرائية المقدمة للطلبة المصنفين (استثنائي، موهوب) </div>
        ${r1('1- اجمالي عدد الطلبة المصنفين (استثنائي، موهوب) الملتحقين بالبرامج', c.g3.t, 1)}
        ${grades(st.g3, c.g3, { tot: 'اجمالي عدد الطلبة المصنفين (استثنائي، موهوب) الملتحقين بالبرامج', one: 'عدد الطلبة المصنفين (استثنائي، موهوب) الملتحقين بالبرامج' }, [3, 7, 11])}
        <div class="sh-bar"> بيانات الطلبة الموهوبين غير المسكنين في برامج الرعاية </div>
        ${r1('1- العدد الاجمالي للطلبة الموهوبين غير المسكنين في برامج الرعاية', c.g4.t, 1)}
        ${grades(st.g4, c.g4, { tot: 'عدد الطلبة الموهوبين غير المسكنين في برامج الرعاية -', one: 'عدد الطلبة الموهوبين غير المسكنين في برامج الرعاية -' }, [2, 6, 10])}
        <div class="sh-bar"> البيانات الخاصة بمدخلي البيانات </div>
        <div class="sh-sig"><div class="lb">مدير  مركز الموهوبين</div><div>${esc(S.profile.dirM)}</div><div class="lb">التوقيع</div><div></div></div>
        <div class="sh-sig"><div class="lb">مديرة  مركز الموهوبين</div><div>${esc(S.profile.dirF)}</div><div class="lb">التوقيع</div><div></div></div>
      </div></div>`;
    }

    /* ---------------- program report page ---------------- */
    function programPage() {
      const p = S.program;
      const card = (ic: string, k: string, val: any, wide?: boolean) =>
        `<div class="info-card${wide ? ' wide' : ''}"><div class="badge"><svg viewBox="0 0 24 24">${ICONS[ic]}</svg></div><div class="txt"><div class="k">${k}</div><div class="v" dir="rtl">${esc(val)}</div></div></div>`;
      const qrCol = (label: string, url: string) =>
        `<div class="col"><div class="pill">${label}</div><div class="ev-frame">${has(url) ? `<img class="qr" src="${qr(url.trim())}" alt="باركود">` : '<div class="qr-empty">أدخل رابطًا<br>لعرض QR</div>'}</div></div>`;
      const logoSrc = p.customLogo || S.profile.logo || PROG_LOGO;
      return `<div id="report">
        <div class="r-header"><div class="dept"><p class="l1">${esc(p.deptLine1)}</p><p>${esc(p.deptLine2)}</p><p>${esc(p.deptLine3)}</p></div><div class="logo-box"><img src="${logoSrc}" alt="شعار وزارة التعليم"></div><div class="dept-empty" aria-hidden="true"></div></div>
        <div class="r-titlebar">${esc(p.reportTitle)}</div>
        <div class="r-body"><div class="info-grid">
          ${card('name', 'اسم البرنامج', p.progName)}${card('field', 'مجال البرنامج', p.progField)}${card('exec', 'الجهة المنفذة', p.execOrg)}${card('support', 'الجهة الداعمة', p.supportOrg)}
          ${card('date', 'تاريخ البرنامج', progDateText(p))}${card('dur', 'مدة البرنامج', progDurOf(p))}${card('target', 'المستهدفون', p.targetGroup, true)}${card('ben', 'عدد المستفيدين', p.beneficiaryCount)}${card('gifted', 'عدد الطلبة الموهوبين', p.giftedCount)}
        </div>
        <div class="section"><div class="head">الهدف من البرنامج</div><div class="box"><ul class="bullets">${lines(p.goalsText).map((t) => `<li>${esc(t)}</li>`).join('')}</ul></div></div>
        <div class="section impact"><div class="head">الأثر الذي تركه البرنامج (النتائج المتوقعة)</div><div class="box"><ul class="bullets">${lines(p.impactText).map((t) => `<li>${esc(t)}</li>`).join('')}</ul></div></div></div>
        ${(() => {
          const L = p.evLayout || 'ev+data';
          const imgs = progImgs();
          const ev = (n: number) => {
            const t = n === 1 ? p.ev1Type : p.ev2Type;
            const u = imgs[n - 1];
            if (t === 'image')
              return `<div class="col"><div class="pill">${esc(evLabelOf(p, n))}</div><div class="ev-frame">${u ? `<img class="ev-img" src="${u}" alt="شاهد ${n}">` : '<div class="qr-empty">ارفع صورة<br>للشاهد</div>'}</div></div>`;
            return qrCol(esc(evLabelOf(p, n)), n === 1 ? p.evidenceLink : p.ev2Link);
          };
          return `<div class="r-footer${L === '1' ? ' one' : ''}">${ev(1)}${L === '2' ? ev(2) : L === 'ev+data' ? qrCol('تحليل البيانات', p.dataLink) : ''}</div>`;
        })()}
        <div class="r-bottombar">${esc(p.websiteText)}</div></div>`;
    }

    /* ---------------- preview rendering ---------------- */
    let pvT: any;
    let pageW = 1123;
    function withProfile(fn: () => void) {
      const rec = KINDS.includes(S.tab as Kind) ? S[S.tab] : null;
      const keep = S.profile;
      if (rec && rec._profile) S.profile = rec._profile;
      try {
        fn();
      } finally {
        S.profile = keep;
      }
    }

    function renderPreview() {
      withProfile(renderPreviewInner);
    }

    function renderPreviewInner() {
      const sc = $('#scaler');
      if (!sc) return;
      if (S.tab === 'follow') {
        sc.innerHTML = followDash();
        pageW = 960;
        fit();
        return;
      }
      if (S.tab === 'program') {
        sc.innerHTML = programPage();
        pageW = 960;
      } else if (S.tab === 'stats') {
        sc.innerHTML = statsPage();
        pageW = 794;
        const sh = sc.querySelector('.sheet') as HTMLElement | null;
        if (sh) {
          const avail = 1123 - 70;
          const h = sh.scrollHeight;
          if (h > avail) {
            const k = avail / h;
            sh.style.left = 'auto';
            sh.style.width = (794 - 68) / k + 'px';
            sh.style.transformOrigin = 'top right';
            sh.style.transform = `scale(${k})`;
          }
        }
      } else {
        sc.innerHTML = docPages(S.tab as any);
        pageW = 1123;
        if (S.tab === 'final') {
          mountReportCharts(chartData());
        }
      }
      fit();
    }

    function fit() {
      const stage = $('#stage');
      const sc = $('#scaler');
      const box = $('#scalebox');
      if (!stage || !sc || !box) return;
      const avail = stage.clientWidth - 40;
      const s = Math.min(1, avail / pageW);
      sc.style.width = pageW + 'px';
      sc.style.transform = `scale(${s})`;
      box.style.width = pageW * s + 'px';
      box.style.height = sc.scrollHeight * s + 'px';
    }

    function schedulePreview(ms = 260) {
      clearTimeout(pvT);
      pvT = setTimeout(renderPreview, ms);
    }

    window.addEventListener('resize', () => {
      clearTimeout(pvT);
      pvT = setTimeout(fit, 120);
    });

    function tabSwitch(t: string) {
      S.tab = t;
      document
        .querySelectorAll('.tabs button')
        .forEach((b) => b.setAttribute('aria-selected', (b as HTMLElement).dataset.tab === t ? 'true' : 'false'));
      const land = t === 'monthly' || t === 'final';
      document.body.setAttribute('data-print-tab', t);
      document.body.setAttribute('data-print-land', land ? 'true' : 'false');
      let pRule = document.getElementById('printPageRule') as HTMLStyleElement | null;
      if (!pRule) {
        pRule = document.createElement('style');
        pRule.id = 'printPageRule';
        document.head.appendChild(pRule);
      }
      pRule.textContent = `@page { size: ${land ? 'A4 landscape' : 'A4 portrait'}; margin: 10mm; }`;
      renderForm();
      renderPreview();
      refreshUndoBtns();
      $('#panel').scrollTop = 0;
      try {
        localStorage.setItem('gifted-tab', t);
      } catch (e) {}
    }

    document.querySelector('.tabs')?.addEventListener('click', (e: any) => {
      const b = e.target.closest('button[data-tab]');
      if (b) tabSwitch(b.dataset.tab);
    });

    function refreshLive(path: string) {
      const root = path.split('.')[0];
      const gm = /^(\w+\.(?:ind|sst|spr|g2|g3|g4))\.\d$/.exec(path);
      if (gm) {
        const ss = stageSums(getP(gm[1]));
        const r = document.querySelector(`[data-sum="${gm[1]}"]`);
        if (r) r.innerHTML = ss.s.map((x) => `<td colspan="3">${x}</td>`).join('');
        const t = document.querySelector(`[data-total="${gm[1]}"]`);
        if (t) t.innerHTML = `<td colspan="9">المجموع الكلي: ${ss.t}</td>`;
      }
      const pm = /^(\w+)\.programs\.\d+\./.exec(path);
      if (pm) {
        const t = totals(S[pm[1]].programs);
        const el = document.querySelector(`[data-tot="${pm[1]}"]`);
        if (el) el.innerHTML = `<span>البرامج: ${t.n}</span><span>المستفيدون: ${t.ben}</span><span>المصنفون: ${t.gifted}</span>`;
      }
      const nm = /^(\w+\.(?:programs|inits|students)\.\d+)\.(name|org)$/.exec(path);
      if (nm) {
        const el = document.querySelector(`[data-nm="${nm[1]}"]`);
        if (el) el.textContent = getP(path) || '…';
      }
      const an = document.querySelector('[data-archname]') as HTMLInputElement | null;
      if (an && KINDS.includes(root as Kind)) an.placeholder = autoTitle(root, S[root]);
      if (/^program\.prog(From|To|Dur|Date)$/.test(path)) {
        const h = document.getElementById('progDateHint');
        if (h) h.textContent = progDateHintText(S.program);
        const d = document.getElementById('i-program.progDur') as HTMLInputElement | null;
        if (d) d.placeholder = progDays(S.program) ? daysAr(progDays(S.program)) + ' (تلقائي)' : 'مثال: 20 ساعة';
      }
      if (/^monthly\.(from|to|cal)$/.test(path)) {
        const h = document.getElementById('monthlyDateHint');
        if (h) h.textContent = monthlyDateHintText(S.monthly);
      }
      if (path === 'stats.q4' || path === 'stats.q5') {
        const el = document.querySelector('[data-auto="q3"]');
        if (el) el.textContent = String(statsCalc().q3);
      }
      return root;
    }

    const panel = $('#panel');
    panel.addEventListener('input', (e: any) => {
      const t = e.target;
      if (t.dataset.chartVal) {
        const [cIdxStr, sIdxStr, vIdxStr] = t.dataset.chartVal.split('.');
        const cIdx = +cIdxStr;
        const sIdx = +sIdxStr;
        const vIdx = +vIdxStr;
        const cfg = getChartConfig(cIdx);
        if (!cfg.series) initManualChartConfig(cIdx);
        if (cfg.series?.[sIdx]) {
          cfg.series[sIdx].values[vIdx] = t.value;
        }
        if (cIdx === 6) {
          if (sIdx === 0) S.final.nsP[vIdx] = t.value;
          if (sIdx === 1) S.final.nsQ[vIdx] = t.value;
        }
        schedule('final');
        schedulePreview();
        return;
      }
      if (t.dataset.chartFieldName != null) {
        const rIdx = +t.dataset.chartFieldName;
        const cfg = getChartConfig(0);
        if (!cfg.labels) initManualChartConfig(0);
        if (cfg.labels) cfg.labels[rIdx] = t.value;
        schedule('final');
        schedulePreview();
        return;
      }
      if (t.dataset.chartFieldVal != null) {
        const rIdx = +t.dataset.chartFieldVal;
        const cfg = getChartConfig(0);
        if (!cfg.series) initManualChartConfig(0);
        if (cfg.series?.[0]) cfg.series[0].values[rIdx] = t.value;
        schedule('final');
        schedulePreview();
        return;
      }
      if (t.dataset.chartAxisLabel != null) {
        const [cIdxStr, colIdxStr] = t.dataset.chartAxisLabel.split('.');
        const cIdx = +cIdxStr;
        const colIdx = +colIdxStr;
        const cfg = getChartConfig(cIdx);
        if (!cfg.labels) initManualChartConfig(cIdx);
        if (cfg.labels) cfg.labels[colIdx] = t.value;
        schedule('final');
        schedulePreview();
        return;
      }
      if (t.dataset.chartSeriesName != null) {
        const [cIdxStr, sIdxStr] = t.dataset.chartSeriesName.split('.');
        const cIdx = +cIdxStr;
        const sIdx = +sIdxStr;
        const cfg = getChartConfig(cIdx);
        if (!cfg.series) initManualChartConfig(cIdx);
        if (cfg.series?.[sIdx]) cfg.series[sIdx].name = t.value;
        schedule('final');
        schedulePreview();
        return;
      }
      if (!t.dataset.k) return;
      setP(t.dataset.k, t.value);
      const root = refreshLive(t.dataset.k);
      schedule(root);
      schedulePreview();
    });

    let FOLLOW_FILTER = 'all';

    panel.addEventListener('change', (e: any) => {
      const t = e.target;
      if (t.id === 'flFilter') {
        FOLLOW_FILTER = t.value;
        renderForm();
        renderPreview();
        return;
      }
      if (t.dataset.hj) {
        const which = t.dataset.hj.split('|')[0];
        const g = (f: string) =>
          +((($('#panel').querySelector(`[data-hj="${which}|${f}"]`) as HTMLSelectElement | null) || {}).value || 0);
        const d = g('d');
        const m = g('m');
        const y = g('y');
        if (!d || !m || !y) return;
        const iso = hijriToIso(d, m, y);
        if (!iso) {
          toast(`شهر ${MONTHS[m - 1]} ${y} لا يحتوي اليوم ${d}`);
          return;
        }
        if (which === 'from' || which === 'program.progFrom') {
          S.program.progFrom = iso;
          S.program.progDate = '';
          refreshLive('program.progFrom');
          schedule('program');
        } else if (which === 'to' || which === 'program.progTo') {
          S.program.progTo = iso;
          refreshLive('program.progTo');
          schedule('program');
        } else {
          setP(which, iso);
          refreshLive(which);
          const root = which.split('.')[0] || 'monthly';
          schedule(root);
        }
        schedulePreview();
        return;
      }
      if (/^(monthly|final)\.evLinks\.\d$/.test(t.dataset.k || '')) {
        const st = $('#panel').scrollTop;
        renderForm();
        $('#panel').scrollTop = st;
        return;
      }
      if (t.id === 'restoreFile') {
        const f = t.files && t.files[0];
        if (f) doRestore(f);
        return;
      }
      if (t.dataset.pimg != null) {
        const f = t.files && t.files[0];
        if (f) addProgImg(+t.dataset.pimg, f);
        return;
      }
      if (t.dataset.ph != null) {
        const f = t.files && t.files[0];
        if (f) addPhoto(t.dataset.ph, +t.dataset.i, f);
        return;
      }
      if (t.dataset.act === 'upload-prog-logo') {
        const f = t.files && t.files[0];
        if (f) {
          const r = new FileReader();
          r.onload = () => {
            S.program.customLogo = r.result as string;
            schedule('program');
            schedulePreview(0);
            renderForm();
          };
          r.readAsDataURL(f);
        }
        return;
      }
      if (t.dataset.act === 'upload-profile-logo') {
        const f = t.files && t.files[0];
        if (f) {
          const r = new FileReader();
          r.onload = () => {
            S.profile.logo = r.result as string;
            schedule('profile');
            schedulePreview(0);
            renderForm();
          };
          r.readAsDataURL(f);
        }
        return;
      }
      if (KINDS.includes(S.tab as Kind)) {
        histCommit(S.tab);
      }
    });

    panel.addEventListener(
      'toggle',
      (e: any) => {
        const d = e.target;
        if (!(d instanceof HTMLDetailsElement)) return;
        const btn = d.querySelector('[data-list]') as HTMLElement | null;
        if (!btn) return;
        const it = (getP(btn.dataset.list!) as any[])[+btn.dataset.i!];
        if (it) it._open = d.open;
      },
      true
    );

    panel.addEventListener('click', async (e: any) => {
      const ev = e.target.closest('[data-evl],[data-evt]');
      if (ev) {
        if (ev.dataset.evl) S.program.evLayout = ev.dataset.evl;
        else {
          const [n, t] = ev.dataset.evt.split('|');
          (S.program as any)['ev' + n + 'Type'] = t;
        }
        const st = $('#panel').scrollTop;
        renderForm();
        $('#panel').scrollTop = st;
        schedule('program');
        schedulePreview(0);
        return;
      }
      const em = e.target.closest('[data-evm]');
      if (em) {
        const [kk, ii, m] = em.dataset.evm.split('|');
        const dk = S[kk];
        dk.evMode[+ii] = m;
        if (m !== 'prog') dk.evSrc[+ii] = null;
        const st = $('#panel').scrollTop;
        renderForm();
        $('#panel').scrollTop = st;
        schedule(kk);
        schedulePreview(0);
        return;
      }
      const cb = e.target.closest('[data-cal]');
      if (cb) {
        const cal = cb.dataset.cal;
        const target = cb.dataset.calTarget || 'program';
        if (target === 'program') {
          S.program.progCal = cal;
        } else if (target === 'monthly') {
          (S.monthly as any).cal = cal;
        } else if (target === 'final') {
          (S.final as any).cal = cal;
        } else if (target.endsWith('.h_cal')) {
          setP(target, cal);
        } else {
          setP(target + '.cal', cal);
        }
        const root = target.split('.')[0] || 'program';
        const st = $('#panel').scrollTop;
        renderForm();
        $('#panel').scrollTop = st;
        schedule(root);
        schedulePreview(0);
        return;
      }
      const y = e.target.closest('[data-yn]');
      if (y) {
        setP(y.dataset.yn, y.dataset.v);
        y.parentElement.querySelectorAll('button').forEach((b: HTMLElement) => b.setAttribute('aria-pressed', b === y ? 'true' : 'false'));
        schedule('stats');
        schedulePreview(0);
        return;
      }
      const b = e.target.closest('[data-act]');
      if (!b) return;
      const act = b.dataset.act;
      const k = S.tab;
      if (act === 'enlarge-chart') {
        const idx = parseInt(b.dataset.chartIndex || '0', 10);
        const all = chartData();
        if (!all[idx]) {
          const mode = getChartMode(idx);
          if (mode === 'manual' && S.final.customCharts?.[idx]) {
            const cfg = S.final.customCharts[idx];
            all[idx] = {
              labels: cfg.labels || [],
              series: (cfg.series || []).map((s: any) => ({ name: s.name, values: s.values.map(num), color: s.color })),
              cnt: cfg.cnt || ''
            };
          } else {
            all[idx] = getAutoChartData()[idx];
          }
        }
        openChartEnlargeModal(idx, all);
        return;
      }
      if (act === 'set-chart-mode') {
        const idx = parseInt(b.dataset.chartIndex || '0', 10);
        const mode = (b.dataset.mode || 'auto') as 'auto' | 'manual';
        setChartMode(idx, mode);
        return;
      }
      if (act === 'toggle-chart-hide') {
        const idx = parseInt(b.dataset.chartIndex || '0', 10);
        toggleChartHidden(idx);
        return;
      }
      if (act === 'clear-chart') {
        const idx = parseInt(b.dataset.chartIndex || '0', 10);
        clearChartData(idx);
        return;
      }
      if (act === 'migrate-single-chart') {
        const idx = parseInt(b.dataset.chartIndex || '0', 10);
        migrateChartFromReport(idx);
        return;
      }
      if (act === 'migrate-all-charts') {
        migrateAllChartsFromReport();
        return;
      }
      if (act === 'show-all-charts') {
        toggleAllChartsHidden(false);
        return;
      }
      if (act === 'hide-all-charts') {
        toggleAllChartsHidden(true);
        return;
      }
      if (act === 'add-chart-field') {
        addChartFieldRow();
        return;
      }
      if (act === 'del-chart-field') {
        const rIdx = parseInt(b.dataset.rowIndex || '0', 10);
        delChartFieldRow(rIdx);
        return;
      }
      if (act === 'toggle-chart-table') {
        const idx = parseInt(b.dataset.chartIndex || '0', 10);
        toggleChartTable(idx);
        return;
      }
      if (act === 'show-all-chart-tables') {
        toggleAllChartTables(true);
        return;
      }
      if (act === 'hide-all-chart-tables') {
        toggleAllChartTables(false);
        return;
      }
      if (act === 'add-chart-axis-col') {
        const idx = parseInt(b.dataset.chartIndex || '0', 10);
        addChartAxisCol(idx);
        return;
      }
      if (act === 'del-chart-axis-col') {
        const idx = parseInt(b.dataset.chartIndex || '0', 10);
        const colIdx = parseInt(b.dataset.colIndex || '0', 10);
        delChartAxisCol(idx, colIdx);
        return;
      }
      if (act === 'add-chart-series-row') {
        const idx = parseInt(b.dataset.chartIndex || '0', 10);
        addChartSeriesRow(idx);
        return;
      }
      if (act === 'del-chart-series-row') {
        const idx = parseInt(b.dataset.chartIndex || '0', 10);
        const sIdx = parseInt(b.dataset.seriesIndex || '0', 10);
        delChartSeriesRow(idx, sIdx);
        return;
      }
      if (act === 'set-tbl-mode') {
        setTableMode(b.dataset.k as any, b.dataset.tbl, b.dataset.mode as any);
        return;
      }
      if (act === 'toggle-tbl-hide') {
        toggleTableHidden(b.dataset.k as any, b.dataset.tbl);
        return;
      }
      if (act === 'clear-tbl') {
        clearTableData(b.dataset.k as any, b.dataset.tbl);
        return;
      }
      if (act === 'migrate-ind') {
        migrateIndFromPrograms(b.dataset.k as any);
        return;
      }
      if (act === 'migrate-sat') {
        migrateSatFromPrograms(b.dataset.k as any);
        return;
      }
      if (act === 'migrate-students') {
        migrateStudentsFromPrograms();
        return;
      }
      if (act === 'open-bulk-students') {
        openBulkStudentsModal();
        return;
      }
      if (act === 'migrate-inits-preset') {
        migrateInitsPreset(b.dataset.k as any);
        return;
      }
      if (act === 'add' || act === 'del' || act === 'dup') {
        e.preventDefault();
        const list = getP(b.dataset.list) as any[];
        const root = b.dataset.list.split('.')[0];
        histRecordBefore(root);
        let actionDesc = '';
        if (act === 'add') {
          list.forEach((x) => (x._open = false));
          const base = /programs$/.test(b.dataset.list)
            ? newProgram()
            : /inits$/.test(b.dataset.list)
              ? { org: '', goal: '' }
              : { name: '', id: '', prog: '' };
          (base as any)._open = true;
          list.push(base);
          actionDesc = /programs$/.test(b.dataset.list)
            ? 'إضافة برنامج جديد'
            : /students$/.test(b.dataset.list)
              ? 'إضافة طالب جديد'
              : 'إضافة جهة جديدة';
        }
        if (act === 'del') {
          list.splice(+b.dataset.i, 1);
          actionDesc = 'حذف صف من الجدول';
        }
        if (act === 'dup') {
          const c = clone(list[+b.dataset.i]);
          c._open = true;
          list.splice(+b.dataset.i + 1, 0, c);
          actionDesc = 'تكرار صف في الجدول';
        }
        histRecordAfter(root, actionDesc);
        const st = $('#panel').scrollTop;
        renderForm();
        $('#panel').scrollTop = st;
        if (act === 'add') {
          const ds = document.querySelectorAll(`[data-list="${b.dataset.list}"][data-act="del"]`);
          const last = ds[ds.length - 1];
          if (last) {
            const detailOrRow = last.closest('details') || last.closest('tr') || (last.parentElement as HTMLElement);
            if (detailOrRow) {
              detailOrRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            const inp1 = detailOrRow?.querySelector('input');
            if (inp1) inp1.focus();
          }
          toast(`${actionDesc} (يمكنك التراجع ↶ أو Ctrl+Z)`);
        } else if (act === 'del') {
          toast('تم حذف الصف بنجاح (يمكنك التراجع ↶ لاستعادته أو Ctrl+Z)');
        } else if (act === 'dup') {
          toast('تم تكرار الصف بنجاح (يمكنك التراجع ↶ أو Ctrl+Z)');
        }
        schedule(root);
        schedulePreview(0);
        return;
      }
      if (act === 'pimg-del') {
        const i = +b.dataset.i;
        progImgs()[i] = null;
        const st = $('#panel').scrollTop;
        renderForm();
        $('#panel').scrollTop = st;
        persist(`ph_${S.program._id}_${i}`);
        schedule('program');
        schedulePreview(0);
        return;
      }
      if (act === 'reset-prog-logo') {
        delete S.program.customLogo;
        const st = $('#panel').scrollTop;
        renderForm();
        $('#panel').scrollTop = st;
        schedule('program');
        schedulePreview(0);
        return;
      }
      if (act === 'reset-profile-logo') {
        delete S.profile.logo;
        const st = $('#panel').scrollTop;
        renderForm();
        $('#panel').scrollTop = st;
        schedule('profile');
        schedulePreview(0);
        return;
      }
      if (act === 'ph-del') {
        const dk = S[b.dataset.kind];
        const ii = +b.dataset.i;
        if (dk.evMode) {
          dk.evMode[ii] = '';
          dk.evLinks[ii] = '';
          dk.evSrc[ii] = null;
        }
        S.photos[b.dataset.kind as 'monthly' | 'final'][ii] = null;
        renderForm();
        persist(`ph_${S.cur[b.dataset.kind]}_${b.dataset.i}`);
        schedule(b.dataset.kind);
        schedulePreview(0);
        return;
      }
      if (act === 'sample') {
        loadSample(k);
        renderForm();
        schedule(k);
        renderPreview();
        return;
      }
      if (act === 'clear') {
        const old = S[k];
        const d = DEFS[k as Kind]();
        d._id = old._id;
        d._name = old._name;
        d._created = old._created;
        d._updated = Date.now();
        S.recs[k][old._id] = d;
        S[k] = d;
        if (S.photos[k as 'monthly' | 'final']) {
          [0, 1, 2].forEach((i) => {
            S.photos[k as 'monthly' | 'final'][i] = null;
            persist(`ph_${old._id}_${i}`);
          });
        }
        if (k === 'program' && S.phStore[old._id])
          [0, 1, 2].forEach((i) => {
            if (S.phStore[old._id][i]) {
              S.phStore[old._id][i] = null;
              persist(`ph_${old._id}_${i}`);
            }
          });
        renderForm();
        schedule(k);
        renderPreview();
        return;
      }
      if (act === 'open-auth' || act === 'drive-login') {
        openAuthModal();
        return;
      }
      if (act === 'cloud-sync-now') {
        triggerCloudSyncNow();
        return;
      }
      if (act === 'drive-logout') {
        handleLogout();
        return;
      }
      if (act === 'drive-backup') {
        doDriveBackup();
        return;
      }
      if (act === 'drive-restore') {
        openDriveRestoreModal();
        return;
      }
      if (act === 'backup') {
        doBackup();
        return;
      }
      if (act === 'restore') {
        const rf = $('#restoreFile') as HTMLInputElement | null;
        if (rf) {
          rf.value = '';
          rf.click();
        }
        return;
      }
      if (act === 'undo') {
        histApply(k, -1);
        return;
      }
      if (act === 'redo') {
        histApply(k, 1);
        return;
      }
      if (act === 'send') {
        openSend(k);
        return;
      }
      if (act === 'link-progs') {
        openLinkProgs(b.dataset.k);
        return;
      }
      if (act === 'ev-from-progs') {
        openEvFromProgs(b.dataset.k);
        return;
      }
      if (act === 'toggle-sent') {
        const d = S.recs[b.dataset.kind][b.dataset.rid];
        if (d) {
          setSent(b.dataset.kind, d, d._sent ? null : { via: 'يدوي' });
        }
        return;
      }
      if (act === 'fl-open') {
        openRecord(b.dataset.kind, b.dataset.rid);
        tabSwitch(b.dataset.kind);
        return;
      }
      if (act === 'fl-send') {
        openRecord(b.dataset.kind, b.dataset.rid);
        tabSwitch(b.dataset.kind);
        openSend(b.dataset.kind);
        return;
      }
      if (act === 'arch-toggle') {
        S.archOpen = !S.archOpen;
        renderForm();
        return;
      }
      if (act === 'rec-new') {
        const d = newRecord(k as Kind);
        if (k === 'program') {
          const keep = S.program;
          S.program = d;
          loadSample('program');
          S.program = keep;
        }
        openRecord(k as Kind, d._id);
        S.archOpen = false;
        renderForm();
        renderPreview();
        $('#panel').scrollTop = 0;
        schedule(k, 0);
        toast('تم إنشاء تقرير جديد وحُفظ التقرير السابق في الأرشيف');
        return;
      }
      if (act === 'rec-open') {
        openRecord(k as Kind, b.dataset.rid);
        S.archOpen = false;
        renderForm();
        renderPreview();
        $('#panel').scrollTop = 0;
        return;
      }
      if (act === 'rec-copy') {
        const src = S.recs[k][b.dataset.rid];
        const c = clone(src);
        delete c._id;
        c._created = c._updated = Date.now();
        c._name = recTitle(k, src) + ' (نسخة)';
        const d = newRecord(k as Kind, c);
        if (S.phStore[src._id]) {
          S.phStore[d._id] = S.phStore[src._id].slice();
          [0, 1, 2].forEach((i) => {
            if (S.phStore[d._id][i]) persist(`ph_${d._id}_${i}`);
          });
        }
        openRecord(k as Kind, d._id);
        renderForm();
        renderPreview();
        schedule(k, 0);
        toast('تم إنشاء نسخة وفتحها');
        return;
      }
      if (act === 'rec-del') {
        if (!b.classList.contains('confirm')) {
          b.classList.add('confirm');
          b.textContent = 'تأكيد الحذف';
          setTimeout(() => {
            if (b.isConnected) {
              b.classList.remove('confirm');
              b.textContent = 'حذف';
            }
          }, 4000);
          return;
        }
        const rid = b.dataset.rid;
        clearTimeout(timers[recKey(k, rid)]);
        delete timers[recKey(k, rid)];
        delete S.recs[k][rid];
        persist(recKey(k, rid));
        if (S.phStore[rid]) {
          const had = S.phStore[rid].map(Boolean);
          delete S.phStore[rid];
          had.forEach((hd, i) => {
            if (hd) persist(`ph_${rid}_${i}`);
          });
        }
        if (S.cur[k] === rid) {
          const rest = sortedRecs(k);
          if (rest.length) openRecord(k as Kind, rest[0]._id);
          else {
            const d = newRecord(k as Kind);
            openRecord(k as Kind, d._id);
          }
        }
        renderForm();
        renderPreview();
        toast('تم حذف التقرير من الأرشيف');
        return;
      }
      if (act === 'import-monthly') {
        openTransfer('final');
        return;
      }
      if (act === 'from-final') {
        openTransfer('stats');
        return;
      }
    });

    function sentHtml(d: any) {
      if (!d._sent) return '<span class="chip none">لم يُرسل بعد</span>';
      let h = `<span class="chip accepted">أُرسل</span>${esc(fmtD(d._sent.at))}${d._sent.via ? ' عبر ' + esc(d._sent.via) : ''}${d._sent.to ? ' إلى ' + esc(d._sent.to) : ''}`;
      if (d._updated > d._sent.at + 3000) h += ' · عُدّل بعد الإرسال';
      return h;
    }

    function setSent(kind: string, d: any, info: any) {
      d._sent = info ? Object.assign({ at: Date.now() }, info) : null;
      persist(recKey(kind, d._id));
      const st = $('#panel').scrollTop;
      renderForm();
      $('#panel').scrollTop = st;
      if (S.tab === 'follow') renderPreview();
      toast(info ? 'عُلّم التقرير «أُرسل»' : 'أُلغيت علامة الإرسال');
    }

    function allRecs() {
      return KINDS.flatMap((k) =>
        Object.values(S.recs[k])
          .filter((d: any) => d._updated > d._created + 500 || d._sent)
          .map((d: any) => ({ k, d }))
      ).sort((a: any, b: any) => b.d._updated - a.d._updated);
    }

    function formFollow() {
      const list = allRecs().filter(
        ({ k, d }) =>
          FOLLOW_FILTER === 'all' ||
          FOLLOW_FILTER === k ||
          (FOLLOW_FILTER === 'sent' && d._sent) ||
          (FOLLOW_FILTER === 'unsent' && !d._sent)
      );
      return `<h2>متابعة الإرسال</h2><p class="sub">كل تقاريرك في مكان واحد، وما أُرسل منها وما لم يُرسل.</p>
        <fieldset><legend>التخزين السحابي وحفظ البيانات (Google Drive)</legend>
          ${driveSyncBoxHtml()}
          <p class="hint">تقاريرك وسجلاتك محفوظة محلياً. يتيح لك الربط بـ Google Drive حفظ النسخ الاحتياطية سحابياً ومزامنتها بنقرة واحدة لتأمين بياناتك دائماً.</p>
          <div class="btnbar" style="margin:0">
            <button class="ghost-btn" data-act="drive-backup">☁️ حفظ نسخة في Google Drive</button>
            <button class="ghost-btn" data-act="drive-restore">📂 استعادة من Google Drive</button>
            <button class="ghost-btn" data-act="backup">💾 تنزيل نسخة محلية (JSON)</button>
            <button class="ghost-btn" data-act="restore">📂 استيراد نسخة من ملف</button>
          </div>
          <input type="file" id="restoreFile" accept=".json,application/json" hidden></fieldset>
        <label for="flFilter">عرض</label><select id="flFilter">
          ${[
            ['all', 'كل التقارير'],
            ['unsent', 'لم تُرسل'],
            ['sent', 'أُرسلت'],
            ['monthly', 'التقارير الشهرية'],
            ['final', 'التقارير الختامية'],
            ['stats', 'الإحصائيات'],
            ['program', 'تقارير البرامج']
          ]
            .map(([v, l]) => `<option value="${v}" ${FOLLOW_FILTER === v ? 'selected' : ''}>${l}</option>`)
            .join('')}</select>
        ${list
          .map(
            ({ k, d }) => `<div class="fl-item"><b>${esc(recTitle(k, d))}</b>
          <small>${esc(KIND_AR[k])} · آخر تعديل ${esc(fmtD(d._updated))}</small>
          <div style="margin-bottom:6px;font-size:12px;color:var(--muted)">${sentHtml(d)}</div>
          <div class="acts"><button data-act="fl-open" data-kind="${k}" data-rid="${d._id}">فتح</button>
            <button data-act="fl-send" data-kind="${k}" data-rid="${d._id}">✉️ إرسال</button>
            <button class="${d._sent ? 'ret' : 'ok'}" data-act="toggle-sent" data-kind="${k}" data-rid="${d._id}">${d._sent ? '↩︎ إلغاء العلامة' : '✔ تم الإرسال'}</button></div></div>`
          )
          .join('')}
        ${!list.length ? '<p class="hint">لا توجد تقارير هنا بعد. ابدأ بتعبئة أي تقرير من التبويبات.</p>' : ''}`;
    }

    function followDash() {
      const all = allRecs();
      const row = (k: string) => {
        const xs = all.filter((x) => x.k === k);
        const sent = xs.filter((x) => x.d._sent).length;
        return `<tr><td><b>${KIND_AR[k]}</b></td><td>${xs.length}</td><td><span class="chip accepted">${sent}</span></td><td><span class="chip ${xs.length - sent ? 'returned' : 'none'}">${xs.length - sent}</span></td></tr>`;
      };
      const months = all
        .filter((x) => x.k === 'monthly')
        .sort((a, b) => MONTHS.indexOf(a.d.month) - MONTHS.indexOf(b.d.month));
      return `<div class="dash"><h2>متابعة إرسال التقارير</h2><p>${all.length} تقرير · ${all.filter((x) => x.d._sent).length} أُرسل · ${all.filter((x) => !x.d._sent).length} لم يُرسل</p>
        <table><tr><th>نوع التقرير</th><th>العدد</th><th>أُرسل</th><th>لم يُرسل</th></tr>${KINDS.map(row).join('')}</table>
        ${
          months.length
            ? `<h2 style="font-size:18px;margin-top:22px">التقارير الشهرية</h2><table><tr><th>التقرير</th><th>الحالة</th><th>تاريخ الإرسال</th></tr>
          ${months.map(({ d }) => `<tr><td>${esc(recTitle('monthly', d))}</td><td>${d._sent ? '<span class="chip accepted">أُرسل</span>' : '<span class="chip returned">لم يُرسل</span>'}</td><td>${d._sent ? esc(fmtD(d._sent.at)) : '-'}</td></tr>`).join('')}</table>`
            : ''
        }
        ${!all.length ? '<div class="empty">لا توجد تقارير بعد.</div>' : ''}</div>`;
    }

    /* ---------------- send modal ---------------- */
    function openSend(kind: string) {
      const d = S[kind];
      const P = d._profile || S.profile;
      const title = recTitle(kind, d);
      const fmtsMap: Record<string, string[][]> = {
        program: [
          ['pdf', 'PDF'],
          ['word', 'Word']
        ],
        monthly: [
          ['word', 'Word'],
          ['pdf', 'PDF']
        ],
        final: [
          ['word', 'Word'],
          ['pdf', 'PDF']
        ],
        stats: [
          ['xlsx', 'Excel'],
          ['pdf', 'PDF']
        ]
      };
      const fmts = fmtsMap[kind];
      const subject = `${title}${P.center ? ' - ' + P.center : ''}`;
      const body = `السلام عليكم ورحمة الله وبركاته،\n\nمرفق ${title}${P.center ? ' لمركز ' + P.center : ''}.\n\nمع التحية،\n${P.dirM || P.dirF || ''}`;
      const enc = encodeURIComponent;
      const links = (to: string) => ({
        gmail: `https://mail.google.com/mail/?view=cm&fs=1&to=${enc(to)}&su=${enc(subject)}&body=${enc(body)}`,
        outlook: `https://outlook.live.com/mail/0/deeplink/compose?to=${enc(to)}&subject=${enc(subject)}&body=${enc(body)}`,
        office: `https://outlook.office.com/mail/deeplink/compose?to=${enc(to)}&subject=${enc(subject)}&body=${enc(body)}`,
        app: `mailto:${enc(to)}?subject=${enc(subject)}&body=${enc(body)}`
      });
      const L = links(S.profile.followEmail || '');
      const btn = (id: string, href: string, label: string, pri?: number) =>
        `<a class="arch-btn${pri ? ' pri' : ''}" id="${id}" href="${href}" target="_blank" rel="noopener" style="text-align:center;text-decoration:none;flex:1">${label}</a>`;
      $('#modal').innerHTML = `<h3>إرسال التقرير</h3><p class="sub">حمّل الملف أولًا، ثم افتح بريدك وأرفق الملف الذي حُمّل. على الجوال تظهر نافذة المشاركة عند التحميل، فتختار منها البريد أو واتساب مباشرة.</p>
        <div class="group">1. تحميل الملف</div><div class="foot" style="margin-top:6px">${fmts.map(([k, l]) => `<button class="arch-btn" data-sendfmt="${k}">⬇️ ${l}</button>`).join('')}</div>
        <div class="group">2. فتح البريد برسالة جاهزة</div>
        <label for="sendTo">بريد جهة المتابعة</label><input type="text" id="sendTo" dir="ltr" value="${esc(S.profile.followEmail || '')}" placeholder="name@moe.gov.sa">
        <div class="foot" style="flex-wrap:wrap">${btn('lkGmail', L.gmail, 'Gmail', 1)}${btn('lkOutlook', L.outlook, 'Hotmail / Outlook', 1)}${btn('lkOffice', L.office, 'بريد العمل (Office 365)')}</div>
        <div class="foot"><a class="arch-btn" href="https://wa.me/?text=${enc(subject)}" target="_blank" rel="noopener" style="text-align:center;text-decoration:none;flex:1">واتساب</a></div>
        <div class="group">أو انسخ الرسالة والصقها في بريدك</div>
        <textarea id="sendText" rows="6" readonly style="margin-top:6px">${esc(`إلى: ${S.profile.followEmail || ''}\nالموضوع: ${subject}\n\n${body}`)}</textarea>
        <div class="foot"><button class="arch-btn" id="copyMsg">📋 نسخ الرسالة</button><button class="arch-btn pri" id="markSent">✔ تم الإرسال</button><button class="arch-btn" data-close>إغلاق</button></div>`;
      $('#modalBg').classList.add('on');
      const sendToEl = $('#sendTo') as HTMLInputElement | null;
      if (sendToEl) {
        sendToEl.oninput = (e: any) => {
          S.profile.followEmail = e.target.value.trim();
          const n = links(S.profile.followEmail!);
          const lg = $('#lkGmail') as HTMLAnchorElement | null;
          if (lg) lg.href = n.gmail;
          const lo = $('#lkOutlook') as HTMLAnchorElement | null;
          if (lo) lo.href = n.outlook;
          const lof = $('#lkOffice') as HTMLAnchorElement | null;
          if (lof) lof.href = n.office;
          const stx = $('#sendText') as HTMLTextAreaElement | null;
          if (stx) stx.value = `إلى: ${S.profile.followEmail}\nالموضوع: ${subject}\n\n${body}`;
          schedule('profile');
        };
      }
      const copyMsgBtn = $('#copyMsg');
      if (copyMsgBtn) {
        copyMsgBtn.onclick = async () => {
          const ta = $('#sendText') as HTMLTextAreaElement;
          let ok = false;
          try {
            await navigator.clipboard.writeText(ta.value);
            ok = true;
          } catch (e) {}
          if (!ok) {
            ta.focus();
            ta.select();
            try {
              ok = document.execCommand('copy');
            } catch (e) {}
          }
          toast(ok ? 'تم نسخ الرسالة' : 'حدّد النص وانسخه يدويًا');
        };
      }
      $('#modal')
        .querySelectorAll('[data-sendfmt]')
        .forEach((b: any) => (b.onclick = () => doExport(b.dataset.sendfmt)));
      const VIA: Record<string, string> = { lkGmail: 'Gmail', lkOutlook: 'Outlook', lkOffice: 'بريد العمل' };
      $('#modal')
        .querySelectorAll('a[target=_blank]')
        .forEach((a: any) =>
          a.addEventListener('click', () =>
            setSent(kind, d, {
              via: VIA[a.id] || 'واتساب',
              to: VIA[a.id] ? S.profile.followEmail || '' : ''
            })
          )
        );
      const markSentBtn = $('#markSent');
      if (markSentBtn) {
        markSentBtn.onclick = () => {
          setSent(kind, d, { via: 'يدوي', to: S.profile.followEmail || '' });
          closeModal();
        };
      }
    }

    function closeModal() {
      $('#modalBg').classList.remove('on');
      $('#modal').innerHTML = '';
    }

    $('#modalBg').addEventListener('click', (e: any) => {
      if (e.target.id === 'modalBg') closeModal();
    });

    document.addEventListener('keydown', (e: any) => {
      if (e.key === 'Escape') {
        closeModal();
        return;
      }
      const isCtrlOrMeta = e.ctrlKey || e.metaKey;
      if (isCtrlOrMeta && KINDS.includes(S.tab as Kind)) {
        const isInput = ['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName);
        if (e.key === 'z' || e.key === 'Z') {
          if (e.shiftKey) {
            e.preventDefault();
            histApply(S.tab, 1);
          } else if (!isInput) {
            e.preventDefault();
            histApply(S.tab, -1);
          }
        } else if ((e.key === 'y' || e.key === 'Y') && !isInput) {
          e.preventDefault();
          histApply(S.tab, 1);
        }
      }
    });

    function monthlyChecklist() {
      const ms = sortedRecs('monthly').sort(
        (a: any, b: any) => MONTHS.indexOf(a.month) - MONTHS.indexOf(b.month) || a._created - b._created
      );
      if (!ms.length) return '<div class="ar-empty">لا توجد تقارير شهرية في الأرشيف.</div>';
      return ms
        .map((r: any) => {
          const n = r.programs.filter((p: any) => has(p.name)).length;
          return `<label class="chk"><input type="checkbox" name="src" value="${r._id}" ${n ? 'checked' : ''}><span>${esc(recTitle('monthly', r))}<small>${n} برنامج · ${r.inits.filter((x: any) => has(x.org)).length} مبادرة</small></span></label>`;
        })
        .join('');
    }

    function openTransfer(target: string) {
      const box = $('#modal');
      if (target === 'final') {
        box.innerHTML = `<h3>نقل من التقارير الشهرية</h3><p class="sub">اختر التقارير الشهرية التي تريد نقل بياناتها إلى التقرير الختامي المفتوح «${esc(recTitle('final', S.final))}». البرامج المكررة (نفس الاسم والتاريخ) لا تُضاف مرتين.</p>
          <div class="group">التقارير الشهرية</div>${monthlyChecklist()}
          <div class="group">ما الذي يُنقل؟</div>
          <label class="chk"><input type="checkbox" name="opt" value="programs" checked><span>البرامج الإثرائية المنفذة</span></label>
          <label class="chk"><input type="checkbox" name="opt" value="inits" checked><span>المبادرات والجهات المتعاونة</span></label>
          <label class="chk"><input type="checkbox" name="opt" value="ind"><span>جمع جدول «ثانيًا» (الطلبة المحتسبون في المؤشر)<small>يستبدل الجدول الحالي بمجموع الأشهر المختارة</small></span></label>
          <label class="chk"><input type="checkbox" name="opt" value="sat"><span>جمع جداول قياس رضا المستفيد<small>يستبدل جدولي الطلبة وأولياء الأمور بمجموع الأشهر المختارة</small></span></label>
          <div class="foot"><button class="arch-btn pri" data-go="final">نقل البيانات</button><button class="arch-btn" data-close>إلغاء</button></div>`;
      } else {
        const fs = sortedRecs('final');
        box.innerHTML = `<h3>تعبئة الإحصائيات من التقارير</h3><p class="sub">تُحسب البنود 9 - 11 و15 و17 - 19 من البرامج، ويمكن تعبئة جدول الطلبة المصنفين الملتحقين من جدول «ثانيًا».</p>
          <div class="group">المصدر</div>
          <label class="chk"><input type="radio" name="srcType" value="final" ${fs.length ? 'checked' : ''} ${fs.length ? '' : 'disabled'}><span>تقرير ختامي<small>${fs.length ? '' : 'لا يوجد تقرير ختامي في الأرشيف'}</small></span></label>
          ${fs.length ? `<select name="finalRec" style="margin-top:6px">${fs.map((r: any) => `<option value="${r._id}">${esc(recTitle('final', r))}</option>`).join('')}</select>` : ''}
          <label class="chk"><input type="radio" name="srcType" value="monthly" ${fs.length ? '' : 'checked'}><span>تقارير شهرية مختارة</span></label>
          <div id="mlist">${monthlyChecklist()}</div>
          <div class="group">ما الذي يُعبأ؟</div>
          <label class="chk"><input type="checkbox" name="opt" value="counts" checked><span>أعداد البرامج حسب المرحلة وخارج وقت الدوام<small>البنود 9، 10، 11، 15، 17، 18، 19</small></span></label>
          <label class="chk"><input type="checkbox" name="opt" value="g3"><span>جدول الطلبة المصنفين (استثنائي، موهوب) الملتحقين بالبرامج<small>من جدول «ثانيًا» حسب الصف</small></span></label>
          <div class="foot"><button class="arch-btn pri" data-go="stats">تعبئة</button><button class="arch-btn" data-close>إلغاء</button></div>`;
      }
      $('#modalBg').classList.add('on');
    }

    const sumGrades = (arrs: string[][]) => {
      const out = nine();
      let any = false;
      arrs.forEach((a) =>
        a.forEach((x, i) => {
          if (has(x)) {
            any = true;
            out[i] = String(num(out[i]) + num(x));
          }
        })
      );
      return any ? out : null;
    };

    async function doBackup() {
      Object.keys(timers).forEach((id) => {
        clearTimeout(timers[id]);
        delete timers[id];
        persist(id);
      });
      await new Promise((r) => setTimeout(r, 400));
      const all = await Store.all();
      const n = Object.keys(all).filter((k) => k.startsWith('rec_')).length;
      const d = new Date();
      const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      await saveFile(
        fname(`نسخة احتياطية - تقارير الموهوبين - ${stamp}`) + '.json',
        JSON.stringify({ format: 'gifted-backup', v: 1, at: Date.now(), docs: all })
      );
      toast(`النسخة تحوي ${n} تقرير`);
    }

    async function doRestore(file: File) {
      let pack: any;
      try {
        pack = JSON.parse(await file.text());
      } catch (e) {
        toast('الملف غير صالح');
        return;
      }
      if (!pack || pack.format !== 'gifted-backup' || !pack.docs) {
        toast('هذا ليس ملف نسخة احتياطية من الموقع');
        return;
      }
      const docs = Object.entries(pack.docs).filter(([k]) => /^(rec_|ph_|profile$)/.test(k));
      const n = docs.filter(([k]) => k.startsWith('rec_')).length;
      $('#modal').innerHTML = `<h3>استعادة نسخة احتياطية</h3><p class="sub">تحوي النسخة ${n} تقرير. التقارير نفسها إن وُجدت تُستبدل بنسختها من الملف، وبقية تقاريرك الحالية تبقى كما هي.</p><div class="foot"><button class="arch-btn pri" id="rsGo">استعادة</button><button class="arch-btn" data-close>إلغاء</button></div>`;
      $('#modalBg').classList.add('on');
      await new Promise<void>((res) => {
        const rsGo = $('#rsGo');
        if (rsGo) {
          rsGo.onclick = () => {
            closeModal();
            res();
          };
        }
      });
      busy(true, 'جارٍ استعادة التقارير…');
      try {
        for (const [k, v] of docs) await Store.put(k, v);
        busy(false);
        toast('تمت الاستعادة، جارٍ إعادة التحميل…');
        setTimeout(() => location.reload(), 900);
      } catch (e) {
        busy(false);
        toast('تعذّرت الاستعادة: مساحة التخزين لا تكفي');
      }
    }

    function renderAuthBar() {
      const bar = $('#driveBar');
      if (!bar) return;
      if (currentUser) {
        bar.innerHTML = `
          <div class="cloud-user-btn connected" data-act="open-auth" title="متصل بالسحابة ومزامن · اضغط لإدارة المزامنة والحساب">
            <span class="cloud-pulse-dot"></span>
            <span style="font-weight:700;font-size:12px">${esc(currentUser.displayName || currentUser.email)}</span>
            <span class="chip accepted" style="font-size:10px;padding:1px 6px">متزامن سحابيًا</span>
            <button type="button" class="t" data-act="cloud-sync-now" title="مزامنة فورية الآن" style="color:#bbf7d0;font-size:11px;padding:1px 5px">🔄 مزامنة</button>
            <button type="button" class="t" data-act="drive-logout" title="تسجيل الخروج" style="color:#fca5a5;font-size:11px;padding:1px 4px">✕</button>
          </div>
        `;
      } else {
        bar.innerHTML = `
          <button class="cloud-user-btn" data-act="open-auth" type="button" title="سجّل الدخول ببريدك الإلكتروني لحفظ جميع التحديثات والتقارير المخزنة بالأرشيف والاطلاع عليها من أي جهاز">
            <span style="font-size:14px">☁️</span>
            <span style="font-weight:700">تسجيل الدخول بالبريد للمزامنة</span>
          </button>
        `;
      }
    }

    const driveSyncBoxHtml = () => {
      if (currentUser) {
        const totalReports = KINDS.reduce((acc, k) => acc + Object.keys(S.recs[k] || {}).length, 0);
        return `
          <div class="drive-sync-box">
            <div class="drive-sync-header">
              <div class="drive-user-info">
                ${currentUser.photoURL ? `<img src="${currentUser.photoURL}" class="drive-user-avatar" alt="صورة الحساب">` : '<div class="cloud-pulse-dot" style="width:14px;height:14px"></div>'}
                <div>
                  <div class="drive-user-name">🟢 متصل ومزامن سحابيًا: ${esc(currentUser.displayName || currentUser.email)}</div>
                  <div class="drive-user-email">${esc(currentUser.email || '')} · متاح عبر جميع أجهزتك (حاسب، جوال، تابلت)</div>
                </div>
              </div>
              <div style="display:flex;gap:6px;flex-wrap:wrap">
                <button type="button" class="arch-btn pri" data-act="cloud-sync-now">🔄 مزامنة السحابة الآن</button>
                <button type="button" class="arch-btn" data-act="drive-backup">☁️ حفظ في Drive</button>
                <button type="button" class="arch-btn" data-act="drive-restore">📂 نسخ Drive</button>
                <button type="button" class="arch-btn" data-act="drive-logout">تسجيل الخروج</button>
              </div>
            </div>
            <p class="hint" style="margin:0;color:#166534">
              ✔ <b>المزامنة السحابية مفعلة:</b> كل تحديث تقوم به وأي تقرير يُحفظ في الأرشيف (${totalReports} تقرير مسجل) يُحفظ فورا في السحابة لحسابك، لتتمكن من فتحه من أي جهاز آخر فور تسجيل الدخول ببريدك.
            </p>
          </div>
        `;
      }
      return `
        <div class="drive-sync-box disconnected">
          <div class="drive-sync-header">
            <div>
              <div class="drive-user-name" style="color:#b91c1c">⚠️ التخزين الحالي محلي فقط في هذا المتصفح</div>
              <div class="drive-user-email" style="text-align:right;color:#475569;margin-top:3px">
                سجّل الدخول ببريدك الإلكتروني لحفظ جميع التحديثات على التطبيق وجميع التقارير المخزنة بالأرشيف والاطلاع عليها من أي جهاز.
              </div>
            </div>
            <div>
              <button class="arch-btn pri" data-act="open-auth" type="button" style="padding:8px 16px;font-size:13px;font-weight:700">
                🔐 تسجيل الدخول بالبريد للمزامنة
              </button>
            </div>
          </div>
          <p class="hint" style="margin:0;color:#64748b">
            تنويه: بدون تسجيل الدخول، تظل بياناتك محفوظة على هذا الجهاز والمتصفح فقط وتكون عرضة للمسح في حال تفريغ ذاكرة المتصفح.
          </p>
        </div>
      `;
    };

    function handleRemoteDocChange(docId: string, data: any) {
      if (!data) {
        Local.del(docId).catch(() => {});
        const m = /^rec_(\w+?)_([a-z0-9]+)$/.exec(docId);
        if (m && S.recs[m[1]]) {
          delete S.recs[m[1]][m[2]];
          renderForm();
          renderPreview();
        }
        return;
      }
      Local.put(docId, data).catch(() => {});
      if (docId === 'profile') {
        S.profile = Object.assign({ center: '', dirM: '', dirF: '', followEmail: '' }, data);
        renderPreview();
        return;
      }
      const m = /^rec_(\w+?)_([a-z0-9]+)$/.exec(docId);
      if (m && S.recs[m[1]] && data && data.data) {
        const k = m[1];
        const rid = m[2];
        const d = Object.assign(DEFS[k as Kind](), data.data);
        d._id = rid;
        S.recs[k][rid] = d;
        if (S.cur[k] === rid) {
          S[k] = d;
          renderPreview();
        }
        renderForm();
      }
      const p = /^ph_([a-z0-9]+)_(\d)$/.exec(docId);
      if (p && data && data.url) {
        (S.phStore[p[1]] = S.phStore[p[1]] || [null, null, null])[+p[2]] = data.url;
        renderPreview();
      }
    }

    async function onUserSignedIn(user: any) {
      currentUser = user;
      driveUser = user;
      renderAuthBar();
      saveMsg('جارٍ مزامنة بياناتك من السحابة…');
      busy(true, 'جارٍ مزامنة تقاريرك وأرشيفك مع السحابة…');
      try {
        const cloudDocs = await fetchAllDocsFromCloud(user.uid);
        const localDocs = await Local.all();
        const localKeys = Object.keys(localDocs).filter((k) => /^(rec_|ph_|profile$)/.test(k));
        const cloudKeys = Object.keys(cloudDocs).filter((k) => /^(rec_|ph_|profile$)/.test(k));

        if (localKeys.length > 0 && cloudKeys.length === 0) {
          await uploadLocalDocsToCloud(user.uid, localDocs);
          const count = localKeys.filter((k) => k.startsWith('rec_')).length;
          toast(`تم حفظ ورفع جميع تقاريرك المحلية (${count} تقرير) إلى حسابك السحابي بنجاح ✅`);
        } else if (cloudKeys.length > 0) {
          if (cloudDocs.profile) {
            S.profile = Object.assign({ center: '', dirM: '', dirF: '', followEmail: '' }, cloudDocs.profile);
          }
          Object.entries(cloudDocs).forEach(([id, docData]: [string, any]) => {
            const m = /^rec_(\w+?)_([a-z0-9]+)$/.exec(id);
            if (m && S.recs[m[1]] && docData && docData.data) {
              const d = Object.assign(DEFS[m[1] as Kind](), docData.data);
              d._id = m[2];
              S.recs[m[1]][m[2]] = d;
            }
            const p = /^ph_([a-z0-9]+)_(\d)$/.exec(id);
            if (p && docData && docData.url) {
              (S.phStore[p[1]] = S.phStore[p[1]] || [null, null, null])[+p[2]] = docData.url;
            }
            Local.put(id, docData).catch(() => {});
          });

          for (const [lk, lv] of Object.entries(localDocs)) {
            if (/^(rec_|ph_|profile$)/.test(lk) && !cloudDocs[lk]) {
              saveDocToCloud(user.uid, lk, lv).catch(() => {});
            }
          }

          const recCount = cloudKeys.filter((k) => k.startsWith('rec_')).length;
          toast(`تم تسجيل الدخول بنجاح! متصل بـ ${user.email} (${recCount} تقرير متزامن من السحابة) ☁️`);
        } else {
          toast(`مرحبًا بك ${user.email}! تم تفعيل الحفظ السحابي التلقائي لجميع تقاريرك وأرشيفك ☁️`);
        }

        if (unsubscribeLiveSync) {
          unsubscribeLiveSync();
          unsubscribeLiveSync = null;
        }
        unsubscribeLiveSync = subscribeToUserDocs(user.uid, (docId, data) => {
          handleRemoteDocChange(docId, data);
        });

      } catch (err: any) {
        console.error('Error during onUserSignedIn:', err);
        toast('تنبيه في مزامنة السحابة: ' + (err?.message || ''));
      } finally {
        busy(false);
        renderAuthBar();
        renderForm();
        renderPreview();
        saveMsg('بياناتك متزامنة ومحفوظة سحابيًا ومحليًا ✅');
      }
    }

    async function handleLogout() {
      if (unsubscribeLiveSync) {
        unsubscribeLiveSync();
        unsubscribeLiveSync = null;
      }
      try {
        await logoutUser();
      } catch (e) {}
      currentUser = null;
      driveUser = null;
      renderAuthBar();
      renderForm();
      saveMsg('تم تسجيل الخروج · البيانات الحالية محفوظة في هذا المتصفح');
      toast('تم تسجيل الخروج من الحساب بنجاح');
    }

    async function triggerCloudSyncNow() {
      if (!currentUser) {
        openAuthModal();
        return;
      }
      busy(true, 'جارٍ مزامنة كافة التقارير والأرشيف مع السحابة…');
      try {
        const localDocs = await Local.all();
        await uploadLocalDocsToCloud(currentUser.uid, localDocs);
        const cloudDocs = await fetchAllDocsFromCloud(currentUser.uid);
        if (cloudDocs.profile) {
          S.profile = Object.assign({ center: '', dirM: '', dirF: '', followEmail: '' }, cloudDocs.profile);
        }
        Object.entries(cloudDocs).forEach(([id, docData]: [string, any]) => {
          const m = /^rec_(\w+?)_([a-z0-9]+)$/.exec(id);
          if (m && S.recs[m[1]] && docData && docData.data) {
            const d = Object.assign(DEFS[m[1] as Kind](), docData.data);
            d._id = m[2];
            S.recs[m[1]][m[2]] = d;
          }
          const p = /^ph_([a-z0-9]+)_(\d)$/.exec(id);
          if (p && docData && docData.url) {
            (S.phStore[p[1]] = S.phStore[p[1]] || [null, null, null])[+p[2]] = docData.url;
          }
        });
        busy(false);
        const count = Object.keys(cloudDocs).filter((k) => k.startsWith('rec_')).length;
        toast(`تمت المزامنة بنجاح! جميع التحديثات (${count} تقرير) محفوظة بالسحابة ومتاحة من أي جهاز ✅`);
        saveMsg('بياناتك متزامنة ومحفوظة سحابيًا ومحليًا ✅');
        renderForm();
        renderPreview();
      } catch (err: any) {
        busy(false);
        toast('تعذّرت المزامنة: ' + (err?.message || ''));
      }
    }

    function openAuthModal() {
      if (currentUser) {
        const cloudRecsCount = KINDS.reduce((acc, k) => acc + Object.keys(S.recs[k] || {}).length, 0);
        $('#modal').innerHTML = `
          <h3>حسابك السحابي والمزامنة</h3>
          <p class="sub">جميع بياناتك، تقاريرك، وأرشيفك متزامنة ومحفوظة سحابيًا ومتاحة للاطلاع والتعديل من أي جهاز.</p>
          <div class="auth-card-user">
            <div style="text-align:right">
              <div style="font-weight:700;font-size:15px;color:#1e3a8a">🟢 ${esc(currentUser.displayName || 'مستخدم المنظومة')}</div>
              <div style="font-size:13px;color:#475569;direction:ltr;text-align:right;margin-top:2px">${esc(currentUser.email || '')}</div>
              <div style="font-size:12px;color:#166534;margin-top:6px">✔ السحابة متصلة وتتم المزامنة الفورية عند أي تعديل (${cloudRecsCount} تقرير في الأرشيف)</div>
            </div>
            <button type="button" class="arch-btn del" id="btnModalLogout">تسجيل الخروج</button>
          </div>
          <div style="display:flex;flex-direction:column;gap:8px;margin-top:14px">
            <button type="button" class="arch-btn pri" id="btnModalSyncNow">🔄 مزامنة السحابة الآن مع كافة الأجهزة</button>
            <button type="button" class="arch-btn" id="btnModalDriveBackup">☁️ حفظ نسخة احتياطية في Google Drive</button>
            <button type="button" class="arch-btn" data-close>إغلاق</button>
          </div>
        `;
        $('#modalBg').classList.add('on');

        $('#btnModalLogout')?.addEventListener('click', async () => {
          closeModal();
          await handleLogout();
        });
        $('#btnModalSyncNow')?.addEventListener('click', async () => {
          closeModal();
          await triggerCloudSyncNow();
        });
        $('#btnModalDriveBackup')?.addEventListener('click', async () => {
          closeModal();
          await doDriveBackup();
        });
        return;
      }

      // Not signed in
      $('#modal').innerHTML = `
        <h3>تسجيل الدخول والمزامنة السحابية</h3>
        <p class="sub">سجّل الدخول ببريدك الإلكتروني لحفظ جميع التحديثات على التطبيق وجميع التقارير المخزنة بالأرشيف والاطلاع عليها من أي جهاز.</p>
        
        <div class="auth-modal-box">
          <!-- Option 1: Fast Google Login -->
          <div>
            <button class="gsi-material-button" id="btnModalGoogle" type="button" style="width:100%;max-width:none;height:42px;justify-content:center">
              <div class="gsi-material-button-state"></div>
              <div class="gsi-material-button-content-wrapper" style="justify-content:center;gap:10px">
                <div class="gsi-material-button-icon" style="margin:0">
                  <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" style="display: block;width:20px;height:20px">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                  </svg>
                </div>
                <span class="gsi-material-button-contents" style="font-size:14px;font-weight:700">المتابعة السريعة باستخدام حساب Google</span>
              </div>
            </button>
          </div>

          <div class="auth-or-divider">أو الدخول بالبريد الإلكتروني وكلمة المرور</div>

          <!-- Option 2: Email & Password -->
          <form id="authEmailForm" onsubmit="return false;" style="display:flex;flex-direction:column;gap:10px">
            <div class="auth-form-group">
              <label for="inpAuthEmail">البريد الإلكتروني</label>
              <input type="email" id="inpAuthEmail" dir="ltr" placeholder="example@email.com" required autocomplete="email">
            </div>
            <div class="auth-form-group">
              <label for="inpAuthPass">كلمة المرور (6 خانات على الأقل)</label>
              <input type="password" id="inpAuthPass" dir="ltr" placeholder="••••••••" required autocomplete="current-password">
            </div>
            <div style="display:flex;gap:8px;margin-top:6px">
              <button type="button" class="arch-btn pri" id="btnModalEmailLogin" style="flex:1">تسجيل الدخول</button>
              <button type="button" class="arch-btn" id="btnModalEmailRegister" style="flex:1">إنشاء حساب جديد</button>
            </div>
            <div style="margin-top:6px;text-align:center">
              <button type="button" id="btnModalForgotPass" class="t" style="color:#2563eb;font-size:12px;text-decoration:underline;cursor:pointer">نسيت كلمة المرور؟ أرسل رابط إعادة التعيين للبريد</button>
            </div>
          </form>
        </div>

        <div class="foot" style="margin-top:14px">
          <button type="button" class="arch-btn" data-close>إلغاء</button>
        </div>
      `;
      $('#modalBg').classList.add('on');

      $('#btnModalGoogle')?.addEventListener('click', async () => {
        try {
          busy(true, 'جارٍ تسجيل الدخول عبر Google ومزامنة السحابة…');
          const res = await signInWithGoogleAccount();
          if (res && res.user) {
            driveUser = res.user;
            await onUserSignedIn(res.user);
            closeModal();
          }
        } catch (err: any) {
          busy(false);
          console.error(err);
          toast('تعذّر تسجيل الدخول عبر Google: ' + (err?.message || 'خطأ غير معروف'));
        }
      });

      $('#btnModalEmailLogin')?.addEventListener('click', async () => {
        const email = ($('#inpAuthEmail') as HTMLInputElement)?.value.trim();
        const pass = ($('#inpAuthPass') as HTMLInputElement)?.value;
        if (!email || !pass) {
          toast('يرجى كتابة البريد الإلكتروني وكلمة المرور');
          return;
        }
        try {
          busy(true, 'جارٍ تسجيل الدخول ومزامنة بياناتك…');
          const user = await signInWithEmail(email, pass);
          await onUserSignedIn(user);
          closeModal();
        } catch (err: any) {
          busy(false);
          console.error(err);
          const code = err?.code || '';
          let msg = 'تعذّر تسجيل الدخول بالبريد';
          if (code.includes('user-not-found') || code.includes('invalid-credential')) msg = 'بيانات الدخول غير صحيحة أو الحساب غير موجود';
          else if (code.includes('wrong-password')) msg = 'كلمة المرور غير صحيحة';
          else if (code.includes('invalid-email')) msg = 'صيغة البريد الإلكتروني غير صحيحة';
          else if (err?.message) msg += ': ' + err.message;
          toast(msg);
        }
      });

      $('#btnModalEmailRegister')?.addEventListener('click', async () => {
        const email = ($('#inpAuthEmail') as HTMLInputElement)?.value.trim();
        const pass = ($('#inpAuthPass') as HTMLInputElement)?.value;
        if (!email || !pass) {
          toast('يرجى كتابة البريد الإلكتروني وكلمة المرور');
          return;
        }
        if (pass.length < 6) {
          toast('كلمة المرور يجب أن تكون 6 خانات أو أكثر');
          return;
        }
        try {
          busy(true, 'جارٍ إنشاء الحساب الجديد ومزامنة بياناتك…');
          const user = await signUpWithEmail(email, pass);
          await onUserSignedIn(user);
          closeModal();
        } catch (err: any) {
          busy(false);
          console.error(err);
          const code = err?.code || '';
          let msg = 'تعذّر إنشاء الحساب';
          if (code.includes('email-already-in-use')) msg = 'هذا البريد مسجل مسبقًا، اضغط «تسجيل الدخول»';
          else if (code.includes('weak-password')) msg = 'كلمة المرور ضعيفة، يرجى اختيار كلمة مرور أقوى';
          else if (err?.message) msg += ': ' + err.message;
          toast(msg);
        }
      });

      $('#btnModalForgotPass')?.addEventListener('click', async () => {
        const email = ($('#inpAuthEmail') as HTMLInputElement)?.value.trim();
        if (!email) {
          toast('يرجى كتابة بريدك الإلكتروني في الحقل أعلاه أولاً');
          return;
        }
        try {
          busy(true, 'جارٍ إرسال رابط إعادة التعيين…');
          await resetUserPassword(email);
          busy(false);
          toast('تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني بنجاح ✉️');
        } catch (err: any) {
          busy(false);
          toast('تعذّر إرسال رابط إعادة التعيين: ' + (err?.message || ''));
        }
      });
    }

    async function handleDriveLogin() {
      openAuthModal();
    }

    async function doDriveBackup() {
      if (!driveUser) {
        const ok = confirm('لإجراء نسخ احتياطي على Google Drive، يلزم تسجيل الدخول بحساب Google. هل ترغب بتسجيل الدخول الآن؟');
        if (ok) await handleDriveLogin();
        if (!driveUser) return;
      }
      busy(true, 'جارٍ حفظ النسخة الاحتياطية في Google Drive…');
      try {
        Object.keys(timers).forEach((id) => {
          clearTimeout(timers[id]);
          delete timers[id];
          persist(id);
        });
        await new Promise((r) => setTimeout(r, 400));
        const all = await Store.all();
        const n = Object.keys(all).filter((k) => k.startsWith('rec_')).length;
        await saveBackupToDrive(
          { format: 'gifted-backup', v: 1, at: Date.now(), docs: all },
          S.profile.center
        );
        busy(false);
        toast(`تم حفظ النسخة بنجاح على Google Drive (${n} تقرير) ✅`);
        saveMsg('تمت المزامنة مع Google Drive بنجاح ✅');
      } catch (err: any) {
        busy(false);
        console.error(err);
        toast('فشل حفظ النسخة في Google Drive: ' + (err?.message || ''));
      }
    }

    async function openDriveRestoreModal() {
      if (!driveUser) {
        const ok = confirm('لاستعراض النسخ المحفوظة على Google Drive، يلزم تسجيل الدخول بحساب Google. هل ترغب بتسجيل الدخول الآن؟');
        if (ok) await handleDriveLogin();
        if (!driveUser) return;
      }
      busy(true, 'جارٍ استرجاع قائمة النسخ من Google Drive…');
      try {
        const files = await listDriveBackups();
        busy(false);
        const formatSize = (b?: string) => {
          if (!b) return '';
          const numB = parseInt(b, 10);
          if (isNaN(numB)) return '';
          return `${(numB / 1024).toFixed(1)} ك.ب`;
        };

        const listHtml = files.length
          ? `<div class="drive-file-list">${files
              .map(
                (f) => `
              <div class="drive-file-card">
                <div class="drive-file-meta">
                  <div class="drive-file-name">📄 ${esc(f.name)}</div>
                  <div class="drive-file-sub">تاريخ الرفع: ${esc(new Date(f.modifiedTime).toLocaleString('ar-SA'))} ${f.size ? '· الحجم: ' + formatSize(f.size) : ''}</div>
                </div>
                <div style="display:flex;gap:6px">
                  <button type="button" class="arch-btn pri" data-drive-restore="${f.id}" data-name="${esc(f.name)}">استعادة</button>
                  <button type="button" class="arch-btn del" data-drive-del="${f.id}" data-name="${esc(f.name)}">حذف</button>
                </div>
              </div>`
              )
              .join('')}</div>`
          : '<div class="ar-empty" style="padding:24px 0">لا توجد نسخ احتياطية على Google Drive بعد. اضغط «حفظ نسخة في Google Drive» لإنشاء نسخة.</div>';

        $('#modal').innerHTML = `
          <h3>النسخ الاحتياطية على Google Drive</h3>
          <p class="sub">اختر نسخة لاستعادتها إلى هذا الجهاز أو حذفها من Drive.</p>
          ${listHtml}
          <div class="foot">
            <button type="button" class="arch-btn pri" data-act="drive-backup">＋ حفظ نسخة جديدة الآن</button>
            <button type="button" class="arch-btn" data-close>إغلاق</button>
          </div>
        `;
        $('#modalBg').classList.add('on');
      } catch (err: any) {
        busy(false);
        toast('تعذّر تحميل النسخ من Google Drive: ' + (err?.message || ''));
      }
    }

    async function exportToDrive(tab: string) {
      if (!driveUser) {
        const ok = confirm('لحفظ هذا التقرير في Google Drive، يلزم تسجيل الدخول بحساب Google. هل ترغب بتسجيل الدخول؟');
        if (ok) await handleDriveLogin();
        if (!driveUser) return;
      }

      busy(true, 'جارٍ إعداد التقرير ورفعه إلى Google Drive…');
      setStatus('جارٍ تجهيز التقرير لـ Google Drive...');
      await ensureFonts();
      if (tab === 'monthly' || tab === 'final') await frameUrlsReady(tab as any);
      renderPreview();

      try {
        const land = tab === 'monthly' || tab === 'final';
        let filename: string;
        const mime = 'application/pdf';

        const jspdfLib = (window as any).jspdf;
        if (!jspdfLib) {
          busy(false);
          toast('مكتبة PDF غير محملة');
          return;
        }
        const { jsPDF } = jspdfLib;
        const pdf = new jsPDF({
          orientation: land ? 'landscape' : 'portrait',
          unit: 'mm',
          format: 'a4'
        });

        if (tab === 'program') {
          const reportEl = $('#report');
          const canvas = await snap(reportEl);
          pdf.addImage(canvas.toDataURL('image/jpeg', 0.94), 'JPEG', 0, 0, 210, 297);
          filename = fname(S.program.reportTitle || S.program.progName || 'تقرير برنامج') + '.pdf';
        } else {
          const pages = [...$('#scaler').querySelectorAll('.page')] as HTMLElement[];
          for (let i = 0; i < pages.length; i++) {
            const canvas = await snap(pages[i]);
            if (i) pdf.addPage();
            pdf.addImage(canvas.toDataURL('image/jpeg', 0.94), 'JPEG', 0, 0, land ? 297 : 210, land ? 210 : 297);
          }
          filename =
            tab === 'monthly'
              ? `التقرير الشهري ${S.monthly.month || ''} - ${S.profile.center || ''}`
              : tab === 'final'
                ? `التقرير الختامي - ${S.profile.center || ''}`
                : `إحصائيات مركز الموهوبين - ${S.stats.region || S.profile.center || ''}`;
          filename = fname(filename) + '.pdf';
        }

        const blob = pdf.output('blob');
        const res = await uploadDocumentToDrive(filename, mime, blob);
        busy(false);
        setStatus('تم حفظ التقرير في Google Drive بنجاح ✅');
        toast(`تم رفع «${res.name}» إلى Google Drive بنجاح ✅`);
      } catch (err: any) {
        busy(false);
        console.error(err);
        toast('فشل حفظ التقرير في Google Drive: ' + (err?.message || ''));
      }
    }

    function openEvFromProgs(k: 'monthly' | 'final') {
      const d = S[k];
      const linkedIds = [...new Set(d.programs.map((p: any) => p._src).filter((id: any) => id && S.recs.program[id]))];
      const others = Object.values(S.recs.program).filter((r: any) => has(r.progName) && !linkedIds.includes(r._id));
      const used = new Set((d.evSrc || []).filter(Boolean).map((x: any) => x.rid + '|' + x.n));
      const item = (r: any) =>
        progEvidences(r)
          .map((e) => {
            const key = e.rid + '|' + e.n;
            const on = used.has(key);
            return `<label class="chk"><input type="checkbox" name="evp" value="${key}" ${on ? 'checked disabled' : ''}><span>${esc(r.progName)} · ${esc(e.label)}<small>${e.kind === 'img' ? 'صورة' : 'رابط ← باركود QR'}${on ? ' · مضاف مسبقًا' : ''}</small></span></label>`;
          })
          .join('');
      const block = (title: string, rs: any[]) => {
        const h = rs.map(item).join('');
        return h ? `<div class="group">${title}</div>${h}` : '';
      };
      const body = block('البرامج المرتبطة بهذا التقرير', linkedIds.map((id: any) => S.recs.program[id])) + block('تقارير برامج أخرى', others);
      $('#modal').innerHTML = `<h3>إضافة من شواهد تقارير البرامج</h3><p class="sub">تُوضع الشواهد المختارة في الإطارات الفارغة (ثلاثة إطارات)، وتبقى مرتبطة بتقرير البرنامج فتتحدّث عند تعديله. الروابط تظهر باركود QR مع اسم البرنامج.</p>
        ${body || '<div class="ar-empty">لا توجد شواهد في تقارير البرامج. أضف صورة أو رابطًا في قسم «الشواهد» بتقرير البرنامج.</div>'}
        <div class="foot"><button class="arch-btn pri" data-goev="${k}">إضافة المحدد</button><button class="arch-btn" data-close>إلغاء</button></div>`;
      $('#modalBg').classList.add('on');
    }

    function openLinkProgs(k: 'monthly' | 'final') {
      const progs = Object.values(S.recs.program)
        .filter((r: any) => has(r.progName))
        .sort((a: any, b: any) => (progFromOf(a) || '').localeCompare(progFromOf(b) || '') || a._created - b._created);
      const linked = new Set(S[k].programs.map((p: any) => p._src).filter(Boolean));
      $('#modal').innerHTML = `<h3>إضافة من تقارير البرامج</h3><p class="sub">اختر تقارير البرامج التي تريد إضافتها إلى ${k === 'monthly' ? 'التقرير الشهري' : 'التقرير الختامي'} «${esc(recTitle(k, S[k]))}». تبقى مرتبطة بتقاريرها وتتحدّث تلقائيًا.</p>
        ${
          progs.length
            ? progs
                .map((r: any) => {
                  const on = linked.has(r._id);
                  return `<label class="chk"><input type="checkbox" name="lp" value="${r._id}" ${on ? 'checked disabled' : ''}><span>${esc(r.progName)}<small>${esc(progDateText(r) || 'بدون تاريخ')}${progDurOf(r) ? ' · ' + esc(progDurOf(r)) : ''}${r.progStage ? ' · ' + esc(r.progStage) : ''}${on ? ' · مضاف مسبقًا' : ''}</small></span></label>`;
                })
                .join('')
            : '<div class="ar-empty">لا توجد تقارير برامج محفوظة. أنشئها من تبويب «تقرير البرنامج» ثم ارجع هنا.</div>'
        }
        <div class="foot"><button class="arch-btn pri" data-golink="${k}">إضافة المحدد</button><button class="arch-btn" data-close>إلغاء</button></div>`;
      $('#modalBg').classList.add('on');
    }

    $('#modal').addEventListener('click', (e: any) => {
      const goev = e.target.closest('[data-goev]');
      if (goev) {
        const k = goev.dataset.goev as 'monthly' | 'final';
        const d = S[k];
        const picks = [...$('#modal').querySelectorAll('input[name=evp]:checked:not(:disabled)')].map(
          (x: any) => x.value
        );
        if (!picks.length) {
          toast('اختر شاهدًا واحدًا على الأقل');
          return;
        }
        let placed = 0;
        picks.forEach((key) => {
          const [rid, n] = key.split('|');
          const i = [0, 1, 2].find((j) => !frameSource(k, j).kind && !(d.evMode[j] === 'prog' && d.evSrc[j]));
          if (i == null) return;
          d.evMode[i] = 'prog';
          d.evSrc[i] = { rid, n: +n };
          d.evLinks[i] = '';
          placed++;
        });
        closeModal();
        renderForm();
        schedule(k);
        renderPreview();
        toast(placed < picks.length ? `أُضيف ${placed} شاهد، ولا توجد إطارات فارغة لبقية الشواهد` : `أُضيف ${placed} شاهد`);
        return;
      }

      const golink = e.target.closest('[data-golink]');
      if (golink) {
        const k = golink.dataset.golink as 'monthly' | 'final';
        const ids = [...$('#modal').querySelectorAll('input[name=lp]:checked:not(:disabled)')].map(
          (x: any) => x.value
        );
        if (!ids.length) {
          toast('اختر تقرير برنامج واحدًا على الأقل');
          return;
        }
        const list = S[k].programs;
        histRecordBefore(k);
        ids.forEach((id) => {
          const row = Object.assign(newProgram(), fromProgramReport(S.recs.program[id]), { _src: id, _open: false });
          const empty = list.findIndex(
            (p: any) => !p._src && !Object.keys(newProgram()).some((f) => has((p as any)[f]))
          );
          if (empty >= 0) list[empty] = row;
          else list.push(row);
        });
        histRecordAfter(k, 'إضافة برامج مرتبطة');
        closeModal();
        renderForm();
        schedule(k);
        renderPreview();
        toast(`أُضيف ${ids.length} برنامج ومرتبط بتقريره (يمكنك التراجع ↶ أو Ctrl+Z)`);
        return;
      }

      if (e.target.closest('[data-close]')) {
        closeModal();
        return;
      }

      const go = e.target.closest('[data-go]');
      if (!go) return;
      const box = $('#modal');
      const opts = new Set([...box.querySelectorAll('input[name=opt]:checked')].map((x: any) => x.value));
      const months = [...box.querySelectorAll('input[name=src]:checked')].map(
        (x: any) => S.recs.monthly[x.value]
      ).filter(Boolean);
      if (go.dataset.go === 'final') {
        if (!months.length) {
          toast('اختر تقريرًا شهريًا واحدًا على الأقل');
          return;
        }
        const F = S.final;
        const key = (p: any) => [p.name, p.date, p.stage].map((x) => (x || '').trim()).join('|');
        let added = 0;
        let inits = 0;
        histRecordBefore('final');
        if (opts.has('programs')) {
          const ex = new Set(F.programs.map(key));
          months.forEach((m) =>
            m.programs
              .filter((p: any) => has(p.name))
              .forEach((p: any) => {
                if (!ex.has(key(p))) {
                  const c = clone(p);
                  c._open = false;
                  F.programs.push(c);
                  ex.add(key(p));
                  added++;
                }
              })
          );
        }
        if (opts.has('inits')) {
          months.forEach((m) =>
            m.inits
              .filter((x: any) => has(x.org))
              .forEach((x: any) => {
                if (!F.inits.some((y: any) => y.org.trim() === x.org.trim())) {
                  F.inits.push(clone(x));
                  inits++;
                }
              })
          );
        }
        if (opts.has('ind')) {
          const g = sumGrades(months.map((m) => m.ind));
          if (g) F.ind = g;
        }
        if (opts.has('sat')) {
          const a = sumGrades(months.map((m) => m.sst));
          const b2 = sumGrades(months.map((m) => m.spr));
          if (a) F.sst = a;
          if (b2) F.spr = b2;
        }
        histRecordAfter('final', 'نقل بيانات من التقارير الشهرية');
        closeModal();
        renderForm();
        schedule('final');
        renderPreview();
        toast(`تم النقل من ${months.length} تقرير شهري: ${added} برنامج جديد${inits ? '، ' + inits + ' مبادرة' : ''} (يمكنك التراجع ↶ أو Ctrl+Z)`);
      } else {
        const type = ((box.querySelector('input[name=srcType]:checked') as HTMLInputElement | null) || {}).value;
        let progs: any[] = [];
        let inds: any[] = [];
        if (type === 'final') {
          const f = S.recs.final[(box.querySelector('select[name=finalRec]') as HTMLSelectElement).value];
          progs = f.programs;
          inds = [f.ind];
        } else {
          if (!months.length) {
            toast('اختر تقريرًا شهريًا واحدًا على الأقل');
            return;
          }
          const seen = new Set();
          months.forEach((m) =>
            m.programs.forEach((p: any) => {
              const k2 = [p.name, p.date, p.stage].join('|');
              if (!seen.has(k2)) {
                seen.add(k2);
                progs.push(p);
              }
            })
          );
          inds = months.map((m) => m.ind);
        }
        const ps = progs.filter((p) => has(p.name));
        if (opts.has('counts')) {
          const cnt = (s2: number) => String(ps.filter((p) => stageOf(p.stage) === s2).length);
          Object.assign(S.stats, {
            q9: cnt(0),
            q10: cnt(1),
            q11: cnt(2),
            q17: cnt(0),
            q18: cnt(1),
            q19: cnt(2),
            q15: String(ps.filter((p) => /مسائ/.test(p.time || '')).length)
          });
        }
        if (opts.has('g3')) {
          const g = sumGrades(inds);
          if (g) S.stats.g3 = g;
        }
        closeModal();
        renderForm();
        schedule('stats');
        renderPreview();
        toast(`تمت تعبئة الإحصائيات من ${ps.length} برنامج`);
      }
    });

    $('#modal').addEventListener('change', (e: any) => {
      if (e.target.name === 'src') {
        const r = $('#modal').querySelector('input[value=monthly][name=srcType]') as HTMLInputElement | null;
        if (r) r.checked = true;
      }
    });

    function addProgImg(i: number, file: File) {
      const fr = new FileReader();
      fr.onload = () => {
        const img = new Image();
        img.onload = () => {
          const sc = Math.min(1, 1000 / img.width, 1000 / img.height);
          const c = document.createElement('canvas');
          c.width = Math.max(1, Math.round(img.width * sc));
          c.height = Math.max(1, Math.round(img.height * sc));
          const g = c.getContext('2d');
          if (!g) return;
          g.fillStyle = '#fff';
          g.fillRect(0, 0, c.width, c.height);
          g.drawImage(img, 0, 0, c.width, c.height);
          let url = c.toDataURL('image/png');
          let q = 0.85;
          if (url.length > 230000) {
            url = c.toDataURL('image/jpeg', q);
            while (url.length > 230000 && q > 0.35) {
              q -= 0.1;
              url = c.toDataURL('image/jpeg', q);
            }
          }
          const rid = S.program._id;
          progImgs()[i] = url;
          const st = $('#panel').scrollTop;
          renderForm();
          $('#panel').scrollTop = st;
          persist(`ph_${rid}_${i}`);
          schedule('program');
          schedulePreview(0);
        };
        img.onerror = () => toast('تعذّر قراءة الصورة');
        img.src = fr.result as string;
      };
      fr.readAsDataURL(file);
    }

    function addPhoto(kind: 'monthly' | 'final', i: number, file: File) {
      const fr = new FileReader();
      fr.onload = () => {
        const img = new Image();
        img.onload = () => {
          const R = 1.162;
          const W = 1000;
          const H = Math.round(W / R);
          let sw = img.width;
          let sh = img.width / R;
          if (sh > img.height) {
            sh = img.height;
            sw = sh * R;
          }
          const c = document.createElement('canvas');
          c.width = W;
          c.height = H;
          const g = c.getContext('2d');
          if (!g) return;
          g.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, 0, 0, W, H);
          let q = 0.8;
          let url = c.toDataURL('image/jpeg', q);
          while (url.length > 230000 && q > 0.35) {
            q -= 0.1;
            url = c.toDataURL('image/jpeg', q);
          }
          S.photos[kind][i] = url;
          if (S[kind].evMode) {
            S[kind].evMode[i] = '';
            S[kind].evSrc[i] = null;
          }
          renderForm();
          persist(`ph_${S.cur[kind]}_${i}`);
          schedule(kind);
          schedulePreview(0);
        };
        img.onerror = () => toast('تعذّر قراءة الصورة');
        img.src = fr.result as string;
      };
      fr.readAsDataURL(file);
    }

    $('#actions').addEventListener('click', (e: any) => {
      const b = e.target.closest('[data-export]');
      if (b) doExport(b.dataset.export);
    });

    /* ---------------- sample data ---------------- */
    function loadSample(k: string) {
      if (k === 'program') {
        Object.assign(S.program, {
          deptLine1: 'الإدارة العامة للتعليم بمنطقة الرياض',
          deptLine2: 'الشؤون التعليمية',
          deptLine3: 'إدارة تنمية القدرات - قسم الموهوبين',
          reportTitle: 'تقرير البرامج المنفذة في مركز الموهوبين بمدرسة (اسم المدرسة)',
          progName: 'التفكير الإبداعي للمرحلة الابتدائية',
          progField: 'التفكير الإبداعي',
          execOrg: 'مركز الموهوبين بمدرسة (اسم المدرسة)',
          supportOrg: 'قسم الموهوبين (بإدارة التعليم بمنطقة الرياض)',
          progDate: '',
          progFrom: '2026-04-26',
          progTo: '2026-04-30',
          progDur: '20 ساعة',
          progStage: 'ابتدائي',
          progMode: 'حضوري',
          progTime: 'صباحي',
          progGender: 'بنات',
          targetGroup: 'الطلاب الموهوبين في المرحلة الابتدائية في النطاق السابع والثامن والعاشر',
          beneficiaryCount: '45 طالب وطالبة',
          giftedCount: '45',
          goalsText:
            'تنمية مهارات التفكير الإبداعي والابتكاري وحل المشكلات.\nتعزيز الثقة بالنفس والمبادرة والتعبير عن الأفكار بطرق متنوعة.',
          impactText:
            'تحسّن قدرة الطلاب والطالبات على التفكير الإبداعي وتوليد الأفكار الجديدة.\nتنمية مهارات حل المشكلات واتخاذ القرارات بطرق مبتكرة.\nزيادة الثقة بالنفس والقدرة على التعبير عن الأفكار.\nتعزيز روح المبادرة والمشاركة الفاعلة في الأنشطة التعليمية.',
          evidenceLink: '',
          dataLink: '',
          websiteText: 'WWW.MOE.GOV.SA'
        });
      }
      if (k === 'monthly' || k === 'final') {
        const d = S[k];
        d.programs = [
          {
            name: 'التفكير الإبداعي',
            field: 'التفكير الإبداعي',
            mode: 'حضوري',
            time: 'صباحي',
            stage: 'ابتدائي',
            gender: 'بنات',
            ben: '45',
            gifted: '38',
            date: '2/3 - 6/3/1448',
            dur: '20 ساعة'
          },
          {
            name: 'الروبوت التعليمي',
            field: 'الروبوت والبرمجة',
            mode: 'حضوري',
            time: 'مسائي',
            stage: 'متوسط',
            gender: 'بنين',
            ben: '30',
            gifted: '26',
            date: '9/3 - 13/3/1448',
            dur: '20 ساعة'
          },
          {
            name: 'مدخل إلى الذكاء الاصطناعي',
            field: 'الذكاء الاصطناعي',
            mode: 'عن بعد',
            time: 'مسائي',
            stage: 'ثانوي',
            gender: 'بنات',
            ben: '52',
            gifted: '40',
            date: '16/3 - 25/3/1448',
            dur: '40 ساعة'
          }
        ];
        d.ind = ['12', '10', '8', '9', '7', '6', '11', '9', '8'];
        d.sst = ['10', '9', '7', '8', '6', '6', '9', '8', '7'];
        d.spr = ['8', '7', '6', '7', '5', '5', '8', '6', '6'];
        d.inits = [{ org: 'جامعة الملك سعود', goal: 'تقديم ورش علمية متخصصة للطلبة الموهوبين' }];
        if (k === 'monthly')
          Object.assign(d, {
            month: 'ربيع الأول',
            semester: 'الأول',
            from: '2026-08-14',
            to: '2026-09-11',
            cal: 'h',
            h_cal: 'h',
            h_no: '123/45',
            h_date: '2026-08-14',
            h_att: 'لا يوجد'
          });
        else {
          Object.assign(d, {
            cal: 'h',
            h_cal: 'h',
            h_no: '123/46',
            h_date: '2026-08-14',
            h_att: 'تقرير الأنشطة'
          });
          (d as FinalReport).students = [
            { name: 'سارة محمد العتيبي', id: '1100000001', prog: 'التفكير الإبداعي' },
            { name: 'عبدالله خالد القحطاني', id: '1100000002', prog: 'الروبوت التعليمي' }
          ];
          (d as FinalReport).nsP = ['20', '35', '28'];
          (d as FinalReport).nsQ = ['4', '7', '6'];
        }
      }
    }

    /* ---------------- export implementation ---------------- */
    function wordify(root: Node) {
      const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      const nodes: Node[] = [];
      while (w.nextNode()) nodes.push(w.currentNode);
      nodes.forEach((n) => {
        if (!n.nodeValue?.trim() || !/[\u0600-\u06FF]/.test(n.nodeValue)) return;
        const pd = getComputedStyle(n.parentNode as Element).display;
        const frag = /flex|grid/.test(pd) ? document.createElement('span') : document.createDocumentFragment();
        n.nodeValue.split(/(\s+)/).forEach((tok) => {
          if (!tok) return;
          if (/^\s+$/.test(tok)) frag.appendChild(document.createTextNode(tok));
          else {
            const sp = document.createElement('span');
            sp.style.display = 'inline-block';
            sp.textContent = tok;
            frag.appendChild(sp);
          }
        });
        n.parentNode?.replaceChild(frag, n);
      });
    }

    async function snap(element: HTMLElement) {
      const host = $('#exportHost');
      host.innerHTML = '';
      const c = element.cloneNode(true) as HTMLElement;
      c.style.boxShadow = 'none';
      c.classList.add('exporting');

      // Determine required natural unclipped dimensions
      const isLand = S.tab === 'monthly' || S.tab === 'final';
      const targetW = S.tab === 'program' ? 960 : S.tab === 'stats' ? 794 : 1123;

      c.style.width = targetW + 'px';
      c.style.maxWidth = targetW + 'px';
      c.style.minWidth = targetW + 'px';
      c.style.margin = '0 auto';
      c.style.transform = 'none';
      c.style.position = 'relative';

      // Set host to a large unclipped viewport with explicit dimensions
      const hostW = Math.max(1400, targetW + 200);
      host.style.position = 'fixed';
      host.style.top = '0';
      host.style.left = '0';
      host.style.right = 'auto';
      host.style.width = hostW + 'px';
      host.style.minWidth = hostW + 'px';
      host.style.height = 'auto';
      host.style.zIndex = '-99999';
      host.style.opacity = '0';
      host.style.pointerEvents = 'none';
      host.style.direction = 'rtl';
      host.style.overflow = 'visible';

      host.appendChild(c);
      wordify(c);
      try {
        await (document as any).fonts.ready;
      } catch (e) {}

      const h = Math.max(c.scrollHeight, c.offsetHeight, 1100);
      const html2canvasFn = (window as any).html2canvas;
      const canvas = await html2canvasFn(c, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        width: targetW,
        height: h,
        windowWidth: hostW,
        windowHeight: Math.max(h + 300, 1500),
        scrollX: 0,
        scrollY: 0
      });
      host.innerHTML = '';
      return canvas;
    }

    async function ensureFonts() {
      try {
        await Promise.all(
          [
            '400 16px "Noto Naskh Arabic"',
            '700 16px "Noto Naskh Arabic"',
            '700 16px Cairo',
            '400 16px Tajawal'
          ].map((f) => (document as any).fonts.load(f))
        );
      } catch (e) {}
    }

    async function doExport(kind: string) {
      const tab = S.tab;
      const rec = S[tab];
      const keep = S.profile;
      if (rec && rec._profile) S.profile = rec._profile;
      try {
        if (kind === 'print') await directPrint(tab);
        else if (kind === 'pdf') await exportPDF(tab);
        else if (kind === 'word' && tab === 'program') await exportProgramWord();
        else if (kind === 'word') await exportDocx(tab as 'monthly' | 'final');
        else if (kind === 'xlsx') await exportXlsx();
        else if (kind === 'drive') await exportToDrive(tab);
      } catch (err: any) {
        console.error(err);
        busy(false);
        const m =
          'حدث خطأ أثناء تجهيز الملف' + (err && err.message ? ': ' + String(err.message).slice(0, 120) : '');
        setStatus(m);
        toast(m);
      } finally {
        S.profile = keep;
      }
    }

    async function directPrint(tab: string) {
      busy(true, 'جارٍ تجهيز التقرير للطباعة المباشرة…');
      setStatus('جارٍ تجهيز التقرير للطباعة...');
      await ensureFonts();
      if (tab === 'monthly' || tab === 'final') await frameUrlsReady(tab as any);
      renderPreview();

      const scaler = $('#scaler');
      if (!scaler) {
        busy(false);
        return;
      }

      const land = tab === 'monthly' || tab === 'final';
      const title = recTitle(tab, S[tab]);

      // Set print attributes and dynamic @page style on the parent document
      document.body.setAttribute('data-print-tab', tab);
      document.body.setAttribute('data-print-land', land ? 'true' : 'false');
      let pRule = document.getElementById('printPageRule') as HTMLStyleElement | null;
      if (!pRule) {
        pRule = document.createElement('style');
        pRule.id = 'printPageRule';
        document.head.appendChild(pRule);
      }
      pRule.textContent = `@page { size: ${land ? 'A4 landscape' : 'A4 portrait'}; margin: 10mm; }`;

      // Remove any leftover print frames
      const prevFrame = document.getElementById('printFrame');
      if (prevFrame) prevFrame.remove();

      // Create an offscreen iframe with full A4 viewport geometry
      const iframe = document.createElement('iframe');
      iframe.id = 'printFrame';
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '200px';
      iframe.style.height = '200px';
      iframe.style.border = '0';
      iframe.style.opacity = '0.01';
      iframe.style.pointerEvents = 'none';
      iframe.style.zIndex = '-9999';
      document.body.appendChild(iframe);

      const win = iframe.contentWindow;
      const doc = win?.document;
      if (!doc || !win) {
        busy(false);
        window.print();
        return;
      }

      let bodyContent = '';
      let extraStyles = '';

      if (tab === 'program') {
        const rep = scaler.querySelector('#report') as HTMLElement | null;
        if (!rep) {
          busy(false);
          return;
        }
        const canvas = await snap(rep);
        const imgData = canvas.toDataURL('image/jpeg', 0.98);
        bodyContent = `<div class="print-program-page"><img class="print-program-img" src="${imgData}" alt="${esc(title)}" /></div>`;
        extraStyles = `
          @page {
            size: A4 portrait;
            margin: 10mm;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
            direction: rtl;
            width: 100% !important;
            height: 100% !important;
            overflow: hidden !important;
          }
          .print-program-page {
            width: 100%;
            height: 276.5mm;
            max-width: 190mm;
            max-height: 276.5mm;
            margin: 0 auto;
            padding: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            box-sizing: border-box;
            page-break-after: auto !important;
            break-after: auto !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            overflow: hidden !important;
          }
          .print-program-img {
            width: 100%;
            height: 100%;
            max-width: 190mm;
            max-height: 276mm;
            object-fit: contain;
            display: block;
            margin: 0 auto;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        `;
      } else if (tab === 'stats') {
        const page = scaler.querySelector('.page.port') as HTMLElement | null;
        if (page) {
          const canvas = await snap(page);
          const imgData = canvas.toDataURL('image/jpeg', 0.98);
          bodyContent = `<div class="print-stats-page"><img class="print-stats-img" src="${imgData}" alt="${esc(title)}" /></div>`;
          extraStyles = `
            @page {
              size: A4 portrait;
              margin: 10mm;
            }
            html, body {
              margin: 0 !important;
              padding: 0 !important;
              background: #fff !important;
              direction: rtl;
              width: 100% !important;
              height: 100% !important;
              overflow: hidden !important;
            }
            .print-stats-page {
              width: 100%;
              height: 276.5mm;
              max-width: 190mm;
              max-height: 276.5mm;
              margin: 0 auto;
              padding: 0;
              display: flex;
              align-items: center;
              justify-content: center;
              box-sizing: border-box;
              page-break-after: auto !important;
              break-after: auto !important;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
              overflow: hidden !important;
            }
            .print-stats-img {
              width: 100%;
              height: 100%;
              max-width: 190mm;
              max-height: 276mm;
              object-fit: contain;
              display: block;
              margin: 0 auto;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
          `;
        }
      } else {
        // monthly or final (landscape docPages)
        const pages = [...scaler.querySelectorAll('.page.land')] as HTMLElement[];
        if (pages.length) {
          const imgs: string[] = [];
          for (let i = 0; i < pages.length; i++) {
            const canvas = await snap(pages[i]);
            imgs.push(canvas.toDataURL('image/jpeg', 0.98));
          }
          bodyContent = imgs
            .map(
              (src, i) => `
              <div class="print-land-page">
                <img class="print-land-img" src="${src}" alt="صفحة ${i + 1}" />
              </div>
            `
            )
            .join('\n');
          extraStyles = `
            @page {
              size: A4 landscape;
              margin: 10mm;
            }
            html, body {
              margin: 0 !important;
              padding: 0 !important;
              background: #fff !important;
              direction: rtl;
              width: 100% !important;
            }
            .print-land-page {
              width: 100%;
              height: 189.5mm;
              max-width: 277mm;
              max-height: 189.5mm;
              box-sizing: border-box;
              margin: 0 auto;
              padding: 0;
              display: flex;
              align-items: center;
              justify-content: center;
              page-break-after: always !important;
              break-after: page !important;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
              overflow: hidden !important;
            }
            .print-land-page:last-child {
              page-break-after: auto !important;
              break-after: auto !important;
            }
            .print-land-img {
              width: 100%;
              height: 100%;
              max-width: 277mm;
              max-height: 189mm;
              object-fit: contain;
              display: block;
              margin: 0 auto;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
          `;
        }
      }

      doc.open();
      doc.write(`<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>
    * {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
      box-sizing: border-box;
    }
    ${extraStyles}
  </style>
</head>
<body>
  ${bodyContent}
</body>
</html>`);
      doc.close();

      // Ensure all images are loaded inside the iframe
      const imgs = [...doc.images];
      await Promise.all(
        imgs.map(
          (img) =>
            new Promise((resolve) => {
              if (img.complete) resolve(true);
              else {
                img.onload = () => resolve(true);
                img.onerror = () => resolve(false);
              }
            })
        )
      );

      // Short delay for layout paint
      await new Promise((r) => setTimeout(r, 200));

      busy(false);
      setStatus('تم فتح نافذة الطباعة.');

      const cleanup = () => {
        try {
          if (iframe.parentNode) iframe.remove();
        } catch (e) {}
      };

      try {
        win.onafterprint = cleanup;
        win.focus();
        win.print();
      } catch (e) {
        window.print();
      } finally {
        setTimeout(cleanup, 60000);
      }
    }

    async function exportPDF(tab: string) {
      const jspdfLib = (window as any).jspdf;
      const html2canvasLib = (window as any).html2canvas;
      if (!jspdfLib || !html2canvasLib) {
        toast('مكتبات PDF لم تُحمّل، تحقق من الاتصال');
        return;
      }
      busy(true, 'جارٍ تجهيز ملف PDF…');
      setStatus('جارٍ تجهيز ملف PDF...');
      await ensureFonts();
      if (tab === 'monthly' || tab === 'final') await frameUrlsReady(tab as any);
      renderPreview();
      const { jsPDF } = jspdfLib;
      let pdf: any;
      let name: string;
      if (tab === 'program') {
        const canvas = await snap($('#report'));
        pdf = new jsPDF({ unit: 'pt', format: 'a4' });
        const pw = pdf.internal.pageSize.getWidth();
        const ph = pdf.internal.pageSize.getHeight();
        const r = Math.min(pw / canvas.width, ph / canvas.height);
        const w = canvas.width * r;
        const h = canvas.height * r;
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', (pw - w) / 2, 20, w, h);
        name = 'تقرير_البرنامج.pdf';
      } else {
        const land = tab !== 'stats';
        pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: land ? 'landscape' : 'portrait' });
        const pages = [...$('#scaler').querySelectorAll('.page')] as HTMLElement[];
        for (let i = 0; i < pages.length; i++) {
          const bt = $('#busyText');
          if (bt) bt.textContent = `جارٍ تجهيز الصفحة ${i + 1} من ${pages.length}…`;
          const canvas = await snap(pages[i]);
          if (i) pdf.addPage();
          pdf.addImage(canvas.toDataURL('image/jpeg', 0.93), 'JPEG', 0, 0, land ? 297 : 210, land ? 210 : 297);
        }
        name =
          tab === 'monthly'
            ? `التقرير الشهري ${S.monthly.month || ''} - ${S.profile.center || ''}`
            : tab === 'final'
              ? `التقرير الختامي - ${S.profile.center || ''}`
              : `إحصائيات مركز الموهوبين - ${S.stats.region || S.profile.center || ''}`;
        name = fname(name) + '.pdf';
      }
      busy(false);
      await saveFile(name, pdf.output('blob'));
    }

    async function exportProgramWord() {
      const D = (window as any).docx;
      if (!D) {
        toast('مكتبة Word لم تُحمّل، تحقق من الاتصال');
        return;
      }
      busy(true, 'جارٍ تجهيز ملف Word…');
      setStatus('جارٍ تجهيز ملف Word...');
      await ensureFonts();
      renderPreview();
      const canvas = await snap($('#report'));
      const p = S.program;
      const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, ImageRun, ShadingType, AlignmentType } = D;
      const run = (t: string, o: any = {}) =>
        new TextRun({
          text: String(t ?? ''),
          rightToLeft: true,
          font: 'Tahoma',
          size: o.size || 24,
          bold: !!o.bold,
          color: o.color
        });
      const para = (t: string, o: any = {}) =>
        new Paragraph({
          bidirectional: true,
          spacing: { after: o.after ?? 80, before: o.before || 0 },
          shading: o.fill ? { fill: o.fill, type: ShadingType.CLEAR, color: 'auto' } : undefined,
          children: [run(t, o)]
        });
      const cell = (t: string, label: boolean) =>
        new TableCell({
          children: [para(t, label ? { bold: true, color: '0E5E5A', after: 0 } : { after: 0 })],
          shading: label ? { fill: 'EFE9D8', type: ShadingType.CLEAR, color: 'auto' } : undefined,
          width: { size: label ? 30 : 70, type: WidthType.PERCENTAGE },
          margins: { top: 80, bottom: 80, left: 120, right: 120 }
        });
      const w = 600;
      const h = Math.round((canvas.height * w) / canvas.width);
      const rows = [
        ['اسم البرنامج', p.progName],
        ['مجال البرنامج', p.progField],
        ['الجهة المنفذة', p.execOrg],
        ['الجهة الداعمة', p.supportOrg],
        ['تاريخ البرنامج', progDateText(p)],
        ['مدة البرنامج', progDurOf(p)],
        ['المستهدفون', p.targetGroup],
        ['عدد المستفيدين', p.beneficiaryCount],
        ['عدد الطلبة الموهوبين', p.giftedCount]
      ];
      const doc = new Document({
        sections: [
          {
            properties: { page: { margin: { top: 700, bottom: 700, left: 700, right: 700 } } },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new ImageRun({
                    data: dataUrlBytes(canvas.toDataURL('image/png')),
                    transformation: { width: w, height: h }
                  })
                ]
              }),
              para('نسخة نصية قابلة للتعديل', { bold: true, size: 30, color: '0E5E5A', before: 240, after: 160 }),
              new Table({
                visuallyRightToLeft: true,
                width: { size: 100, type: WidthType.PERCENTAGE },
                rows: rows.map(([k, val]) => new TableRow({ children: [cell(k, true), cell(val || '', false)] }))
              }),
              para('الهدف من البرنامج', { bold: true, color: 'FFFFFF', fill: '0E5E5A', before: 240 }),
              ...lines(p.goalsText).map((t) => para('• ' + t)),
              para('الأثر الذي تركه البرنامج (النتائج المتوقعة)', {
                bold: true,
                color: 'FFFFFF',
                fill: '3B3B57',
                before: 240
              }),
              ...lines(p.impactText).map((t) => para('• ' + t)),
              ...[
                [1, p.ev1Type !== 'image' && p.evidenceLink],
                [2, p.evLayout === '2' && p.ev2Type !== 'image' && p.ev2Link]
              ]
                .filter((x) => has(x[1]))
                .map(([n, u]) => para(evLabelOf(p, n as number) + ': ' + u, { before: 120 })),
              ...((p.evLayout || 'ev+data') === 'ev+data' && has(p.dataLink)
                ? [para('تحليل البيانات: ' + p.dataLink)]
                : [])
            ]
          }
        ]
      });
      const blob = await Packer.toBlob(doc);
      busy(false);
      await saveFile('تقرير_البرنامج.docx', blob);
    }

    function wtext(s: string) {
      return xesc(s).replace(/\r?\n/g, '</w:t><w:br/><w:t xml:space="preserve">');
    }

    function fillRows(xml: string, marker: string, n: number, fn: (k: number) => any) {
      const m = '{{' + marker + '}}';
      const i = xml.indexOf(m);
      if (i < 0) return xml;
      const s = Math.max(xml.lastIndexOf('<w:tr ', i), xml.lastIndexOf('<w:tr>', i));
      const e = xml.indexOf('</w:tr>', i) + 7;
      const tpl = xml
        .slice(s, e)
        .replace(m, '')
        .replace(/ w14:paraId="[^"]*"/g, '')
        .replace(/ w14:textId="[^"]*"/g, '');
      let out = '';
      for (let k = 0; k < n; k++) {
        const vals = fn(k);
        out += tpl.replace(/\{\{(\w+)\}\}/g, (_, t) => (vals[t] != null ? wtext(vals[t]) : ''));
      }
      return xml.slice(0, s) + out + xml.slice(e);
    }

    function gradeVals(prefix: string, arr: string[], ph: string) {
      const o: Record<string, string> = {};
      const ss = stageSums(arr);
      arr.forEach((x, i) => (o[`${prefix}_g${i}`] = has(x) ? x : '00'));
      ss.s.forEach((x, i) => (o[`${prefix}_s${i}`] = ss.any ? String(x) : ph));
      o[`${prefix}_t`] = ss.any ? String(ss.t) : ph;
      return o;
    }

    function inlinePic(rid: string, n: number, cx: number, cy: number) {
      return `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:docPr id="${9100 + n}" name="Chart ${n}"/><wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${9100 + n}" name="chart${n}.png"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
    }

    async function exportDocx(k: 'monthly' | 'final') {
      const JSZipLib = (window as any).JSZip;
      if (!JSZipLib) {
        toast('مكتبة Word لم تُحمّل، تحقق من الاتصال');
        return;
      }
      busy(true, 'جارٍ تجهيز ملف Word…');
      setStatus('جارٍ تجهيز ملف Word...');
      const zip = await JSZipLib.loadAsync(TPL[k], { base64: true });
      let doc = await zip.file('word/document.xml').async('string');
      let hdr = await zip.file('word/header1.xml').async('string');
      let rels = await zip.file('word/_rels/document.xml.rels').async('string');
      let ct = await zip.file('[Content_Types].xml').async('string');
      const d = S[k];
      const P = S.profile;
      const progs = d.programs;
      const t = totals(progs);
      const hideProgs = isTableHidden(k, 'progs');
      doc = fillRows(doc, 'ROW_P', Math.max(14, progs.length), (i) => {
        const p = hideProgs ? null : progs[i];
        return p
          ? {
              p_n: i + 1,
              p_name: p.name,
              p_field: p.field,
              p_mode: p.mode,
              p_time: p.time,
              p_stage: p.stage,
              p_gender: p.gender,
              p_ben: p.ben,
              p_gifted: p.gifted,
              p_date: p.date,
              p_dur: p.dur
            }
          : { p_n: i + 1 };
      });
      const hideInits = isTableHidden(k, 'inits');
      doc = fillRows(doc, 'ROW_I', Math.max(5, d.inits.length), (i) => {
        const x = hideInits ? null : d.inits[i];
        return x ? { i_n: i + 1, i_org: x.org, i_goal: x.goal } : { i_n: i + 1 };
      });
      if (k === 'final') {
        const hideStudents = isTableHidden(k, 'students');
        const st = hideStudents ? [] : (d as FinalReport).students;
        const R = Math.max(15, Math.ceil(st.length / 2));
        doc = fillRows(doc, 'ROW_S', R, (i) => {
          const a = st[i] || {};
          const b = st[R + i] || {};
          return {
            sa_n: i + 1,
            sa_name: a.name || '',
            sa_id: a.id || '',
            sa_prog: a.prog || '',
            sb_n: R + i + 1,
            sb_name: b.name || '',
            sb_id: b.id || '',
            sb_prog: b.prog || ''
          };
        });
        const hideCharts = isTableHidden(k, 'charts');
        const charts = hideCharts ? [] : chartData();
        for (let n = 1; n <= 7; n++) {
          const c = charts[n - 1];
          const marker = `<w:r><w:t>{{CHART_${n}}}</w:t></w:r>`;
          if (!c) {
            doc = doc.replace(marker, '');
            continue;
          }
          const showTbl = isChartTableShown(n - 1);
          zip.file(`word/media/chart${n}.png`, dataUrlBytes(chartPNG(c, showTbl)));
          rels = rels.replace(
            '</Relationships>',
            `<Relationship Id="rIdCh${n}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/chart${n}.png"/></Relationships>`
          );
          doc = doc.replace(marker, inlinePic(`rIdCh${n}`, n, 5760000, showTbl ? 3360000 : 2496000));
        }
      }
      const order = [3, 1, 2];
      let anyJpg = false;
      const readyUrls = await frameUrlsReady(k);
      readyUrls.forEach((u, i) => {
        if (!u) return;
        const n = order[i];
        anyJpg = true;
        zip.file(`word/media/evid${n}.jpeg`, dataUrlBytes(u));
        rels = rels.replace(
          '</Relationships>',
          `<Relationship Id="rIdEv${n}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/evid${n}.jpeg"/></Relationships>`
        );
        doc = doc.replace(
          `<a:solidFill><a:srgbClr val="FFFFF${n}"/></a:solidFill>`,
          `<a:blipFill><a:blip r:embed="rIdEv${n}"/><a:stretch><a:fillRect/></a:stretch></a:blipFill>`
        );
      });
      doc = doc.replace(/<a:srgbClr val="FFFFF[123]"\/>/g, '<a:srgbClr val="FFFFFF"/>');
      if (anyJpg && !/Extension="jpeg"/.test(ct))
        ct = ct.replace(
          '<Default Extension="png"',
          '<Default Extension="jpeg" ContentType="image/jpeg"/><Default Extension="png"'
        );
      const cal = (d as any).cal || 'h';
      const fromStr = (d as any).from
        ? fmtReportDate((d as any).from, cal, false)
        : cal === 'g'
          ? '00/00/2026'
          : '00/00/1448';
      const toStr = (d as any).to
        ? fmtReportDate((d as any).to, cal, false)
        : cal === 'g'
          ? '00/00/2026'
          : '00/ 00/1448';
      const vals: Record<string, any> = Object.assign(
        {
          month: has((d as any).month) ? (d as any).month : '..........',
          center: has(P.center) ? P.center : k === 'final' ? '....................' : '..........',
          semester: has((d as any).semester) ? (d as any).semester : '..........',
          from: fromStr,
          to: toStr,
          tot_prog: (hideProgs || !t.n) ? '00' : String(t.n),
          tot_ben: (hideProgs || !t.n) ? '00' : String(t.ben),
          tot_gifted: (hideProgs || !t.n) ? '00' : String(t.gifted),
          dir_m: P.dirM || '',
          dir_f: P.dirF || ''
        },
        isTableHidden(k, 'ind') ? gradeVals('ind', nine().map(() => ''), '') : gradeVals('ind', d.ind, '000'),
        isTableHidden(k, 'sat') ? gradeVals('sst', nine().map(() => ''), '') : gradeVals('sst', d.sst, '000'),
        isTableHidden(k, 'sat') ? gradeVals('spr', nine().map(() => ''), '') : gradeVals('spr', d.spr, '00')
      );
      if (k === 'final') chartData().forEach((c, i) => (vals['cnt_' + (i + 1)] = c ? c.cnt : ''));
      doc = doc.replace(/\{\{(\w+)\}\}/g, (_: string, t: string) => (vals[t] != null ? wtext(vals[t]) : ''));
      if (cal === 'g') {
        doc = doc
          .replace(/\{\{from\}\}هـ/g, '{{from}}م')
          .replace(/\{\{to\}\}هـ/g, '{{to}}م')
          .replace(/1448هـــ/g, '2026م')
          .replace(/1448هـ/g, '2026م');
      }
      const hv = {
        h_no: d.h_no,
        h_date: d.h_date ? fmtReportDate(d.h_date, (d as any).h_cal || 'h') : '',
        h_att: d.h_att
      };
      hdr = hdr.replace(/\{\{(\w+)\}\}/g, (_: string, t: string) => wtext((hv as any)[t] || ''));
      zip.file('word/document.xml', doc);
      zip.file('word/header1.xml', hdr);
      zip.file('word/_rels/document.xml.rels', rels);
      zip.file('[Content_Types].xml', ct);
      const blob = await zip.generateAsync({
        type: 'blob',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        compression: 'DEFLATE'
      });
      busy(false);
      const name =
        k === 'monthly'
          ? `التقرير الشهري ${(d as any).month || ''} - ${P.center || ''}`
          : `التقرير الختامي - ${P.center || ''}`;
      await saveFile(fname(name) + '.docx', blob);
    }

    /* ---------------- export Excel ---------------- */
    function setCell(xml: string, ref: string, value: any, isFormula?: boolean) {
      const re = new RegExp(`<c r="${ref}"([^>]*?)(?:/>|>([\\s\\S]*?)</c>)`);
      return xml.replace(re, (all, attrs, inner) => {
        const s = (/\ss="(\d+)"/.exec(attrs) || [])[1];
        const sa = s ? ` s="${s}"` : '';
        if (isFormula) {
          const f = (/<f>[\s\S]*?<\/f>/.exec(inner || '') || [''])[0];
          return `<c r="${ref}"${sa}>${f}<v>${value}</v></c>`;
        }
        if (value === '' || value == null) return `<c r="${ref}"${sa}/>`;
        const n = String(value).trim();
        if (/^-?\d+(\.\d+)?$/.test(n)) return `<c r="${ref}"${sa}><v>${n}</v></c>`;
        return `<c r="${ref}"${sa} t="inlineStr"><is><t xml:space="preserve">${xesc(value)}</t></is></c>`;
      });
    }

    async function exportXlsx() {
      const JSZipLib = (window as any).JSZip;
      if (!JSZipLib) {
        toast('مكتبة Excel لم تُحمّل، تحقق من الاتصال');
        return;
      }
      busy(true, 'جارٍ تجهيز ملف Excel…');
      setStatus('جارٍ تجهيز ملف Excel...');
      const zip = await JSZipLib.loadAsync(TPL.stats, { base64: true });
      let x = await zip.file('xl/worksheets/sheet1.xml').async('string');
      let wb = await zip.file('xl/workbook.xml').async('string');
      const st = S.stats;
      const c = statsCalc();
      const V = (val: any) => (has(val) ? val : 0);
      x = setCell(x, 'A1', ` بيانات مركز الموهوبين في ${has(st.region) ? st.region : '...........................................'} `);
      x = setCell(x, 'O2', has(st.q1) ? st.q1 : 'نعم / لا ');
      x = setCell(x, 'N3', V(st.q2));
      x = setCell(x, 'N5', V(st.q4));
      x = setCell(x, 'N6', V(st.q5));
      x = setCell(x, 'N4', c.q3, true);
      [
        ['E7', st.q6],
        ['J7', st.q7],
        ['O7', st.q8],
        ['E8', st.q9],
        ['J8', st.q10],
        ['O8', st.q11],
        ['O17', st.q15],
        ['E19', st.q17],
        ['J19', st.q18],
        ['O19', st.q19]
      ].forEach(([r, val]) => {
        x = setCell(x, r, V(val));
      });
      x = setCell(x, 'O18', has(st.q16) ? st.q16 : 'نعم / لا ');
      const grid = (arr: string[], sums: any, row0: number, totRow: number, totCell: string) => {
        ['E', 'J', 'O'].forEach((col, s) => {
          for (let i = 0; i < 3; i++) x = setCell(x, `${col}${row0 + i}`, V(arr[s * 3 + i]));
          x = setCell(x, `${col}${row0 - 1}`, sums.s[s], true);
        });
        x = setCell(x, totCell, sums.t, true);
      };
      grid(st.g2, c.g2, 14, 13, 'O12');
      grid(st.g3, c.g3, 25, 24, 'O23');
      grid(st.g4, c.g4, 33, 32, 'O31');
      x = setCell(x, 'E39', S.profile.dirM || '');
      x = setCell(x, 'E40', S.profile.dirF || '');
      wb = wb.replace(
        /<calcPr([^>]*?)\/>/,
        (m: string, a: string) => (/fullCalcOnLoad/.test(a) ? m : `<calcPr${a} fullCalcOnLoad="1"/>`)
      );
      zip.file('xl/worksheets/sheet1.xml', x);
      zip.file('xl/workbook.xml', wb);
      const blob = await zip.generateAsync({
        type: 'blob',
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        compression: 'DEFLATE'
      });
      busy(false);
      await saveFile(fname('إحصائيات مراكز الموهوبين - ' + (st.region || S.profile.center || '')) + '.xlsx', blob);
    }

    /* ---------------- boot & initial load ---------------- */
    let initialTab = 'program';
    try {
      initialTab = localStorage.getItem('gifted-tab') || 'program';
    } catch (e) {}
    loadSample('program');
    tabSwitch(KINDS.includes(initialTab as Kind) ? initialTab : 'program');
    saveMsg('جارٍ تحميل بياناتك…');

    (async () => {
      await Store.init();
      const all = await Store.all();
      if (all.profile) S.profile = Object.assign({ center: '', dirM: '', dirF: '', followEmail: '' }, all.profile);
      const loaded: Record<string, Record<string, any>> = { program: {}, monthly: {}, final: {}, stats: {} };
      Object.entries(all).forEach(([id, doc]: [string, any]) => {
        const m = /^rec_(\w+?)_([a-z0-9]+)$/.exec(id);
        if (m && loaded[m[1]] && doc && doc.data) {
          const d = Object.assign(DEFS[m[1] as Kind](), doc.data);
          d._id = m[2];
          loaded[m[1]][m[2]] = d;
        }
        const p = /^ph_([a-z0-9]+)_(\d)$/.exec(id);
        if (p && doc && doc.url) {
          (S.phStore[p[1]] = S.phStore[p[1]] || [null, null, null])[+p[2]] = doc.url;
        }
      });
      for (const k of KINDS) {
        if (all[k] && typeof all[k] === 'object') {
          const d = Object.assign(DEFS[k](), all[k]);
          const rid = mkid();
          d._id = rid;
          d._created = d._updated = Date.now();
          d._name = '';
          loaded[k][rid] = d;
          if (k === 'monthly' || k === 'final')
            [0, 1, 2].forEach((i) => {
              const ph = all[`ph_${k}_${i}`];
              if (ph && ph.url) {
                (S.phStore[rid] = S.phStore[rid] || [null, null, null])[i] = ph.url;
                persist(`ph_${rid}_${i}`);
                Store.del(`ph_${k}_${i}`).catch(() => {});
              }
            });
          S.recs[k] = Object.assign({}, S.recs[k], { [rid]: d });
          persist(recKey(k, rid));
          Store.del(k).catch(() => {});
        }
      }
      KINDS.forEach((k) => {
        const ids = Object.keys(loaded[k]);
        if (!ids.length) return;
        const cur = S[k];
        const touched = cur._updated > cur._created + 500;
        S.recs[k] = Object.assign(touched ? { [cur._id]: cur } : {}, S.recs[k][cur._id] && touched ? {} : {}, loaded[k]);
        Object.values(S.recs[k]).forEach((d: any) => {
          if (!d._created) d._created = d._updated || Date.now();
          if (!d._updated) d._updated = d._created;
        });
        if (!touched) openRecord(k, sortedRecs(k)[0]._id);
        else openRecord(k, cur._id);
      });
      tabSwitch(initialTab);
      saveMsg('بياناتك محفوظة ومزامنة · احفظ نسخة احتياطية من «متابعة الإرسال»');
      renderAuthBar();

      $('#driveBar')?.addEventListener('click', (e: any) => {
        const btn = e.target.closest('[data-act]');
        if (!btn) {
          openAuthModal();
          return;
        }
        const act = btn.dataset.act;
        if (act === 'open-auth' || act === 'drive-login') {
          openAuthModal();
        } else if (act === 'cloud-sync-now') {
          triggerCloudSyncNow();
        } else if (act === 'drive-logout') {
          handleLogout();
        } else if (act === 'drive-backup') {
          doDriveBackup();
        }
      });

      onAuthStateChanged(firebaseAuth, async (user) => {
        if (user) {
          if (!currentUser || currentUser.uid !== user.uid) {
            await onUserSignedIn(user);
          }
        } else {
          currentUser = null;
          driveUser = null;
          renderAuthBar();
        }
      });

      testCloudConnection().catch(() => {});

      (document as any).fonts && (document as any).fonts.ready.then(() => {
        chartCache.clear();
        renderPreview();
      });
    })();
  }, []);

  return (
    <div ref={containerRef} className="shell">
      <header className="topbar">
        <div>
          <h1>مولّد تقارير مراكز الموهوبين</h1>
          <div className="credit">تصميم: صالحة الشهري</div>
        </div>
        <nav className="tabs" role="tablist" aria-label="التقارير">
          <button role="tab" data-tab="program" aria-selected="true">
            تقرير البرنامج
          </button>
          <button role="tab" data-tab="monthly" aria-selected="false">
            التقرير الشهري
          </button>
          <button role="tab" data-tab="final" aria-selected="false">
            التقرير الختامي
          </button>
          <button role="tab" data-tab="stats" aria-selected="false">
            إحصائيات المركز
          </button>
          <button role="tab" data-tab="follow" id="followTab" aria-selected="false">
            متابعة الإرسال
          </button>
        </nav>
        <div className="sp"></div>
        <div id="driveBar" className="drive-bar"></div>
        <span className="save" id="save"></span>
      </header>
      <div className="app">
        <div className="panel" id="panel"></div>
        <div className="preview-panel">
          <div className="actions" id="actions"></div>
          <div className="status" id="status"></div>
          <div className="stage" id="stage">
            <div className="scalebox" id="scalebox">
              <div className="scaler" id="scaler"></div>
            </div>
          </div>
          <div className="pv-note" id="pvnote"></div>
        </div>
      </div>
      <div id="measure" className="doc"></div>
      <div id="exportHost"></div>
      <div className="modal-bg" id="modalBg">
        <div className="modal" id="modal" role="dialog" aria-modal="true"></div>
      </div>
      <div className="busy" id="busy">
        <div id="busyText">جارٍ التجهيز…</div>
      </div>
      <div className="toast" id="toast" role="status"></div>
    </div>
  );
}
