// Logique pure du suivi β-hCG quantitative (aucune dépendance React / Firebase).
// Références : ACOG PB 193 (2018, màj 2026), NICE NG126 (màj juin 2026),
// ESHRE EPL 2022, Barnhart 2016 (cinétique), RCOG GTG 38 / FIGO (môle).

const H = 3600000;
const DAY = 24 * H;
export const MIN_FALL = 0.21; // décroissance minimale attendue à 48 h (fausse couche)

// Ascension minimale à 48 h d'une GIU évolutive selon le taux initial (Barnhart 2016)
export function minRise(v) {
  return v < 1500 ? 0.49 : v <= 3000 ? 0.4 : 0.33;
}

// pts : [{ t (ms), v (UI/L) }]
export function analyze(pts) {
  const P = [...pts].sort((a, b) => a.t - b.t);
  const pairs = [];
  for (let i = 1; i < P.length; i++) {
    const a = P[i - 1];
    const b = P[i];
    const h = (b.t - a.t) / H;
    const ratio = b.v / a.v;
    const pct = h > 0 && a.v > 0 && b.v > 0 ? Math.pow(ratio, 48 / h) - 1 : null;
    let cls;
    if (b.v < 5) cls = "neg";
    else if (pct === null || h < 24 || h > 96) cls = "out";
    else if (pct >= minRise(a.v)) cls = "normal";
    else if (pct > 0) cls = "slow";
    else if (pct > -MIN_FALL) cls = "plateau";
    else cls = "fall";
    pairs.push({ h, pct, cls, dbl: ratio > 1 ? (h * Math.LN2) / Math.log(ratio) : null });
  }
  return { P, pairs, profile: P.length < 2 ? "single" : pairs[pairs.length - 1].cls };
}

// Critères FIGO de néoplasie trophoblastique gestationnelle après môle
export function gtnFlags(P) {
  const f = { plateau: false, rise: false };
  if (P.length >= 4) {
    const w = P.slice(-4);
    const base = w[0].v;
    if (w[3].t - w[0].t >= 20 * DAY && w.every((p) => Math.abs(p.v - base) / base <= 0.1)) f.plateau = true;
  }
  if (P.length >= 3) {
    const r = P.slice(-3);
    if (r[2].t - r[0].t >= 13 * DAY && r[1].v > r[0].v * 1.1 && r[2].v > r[1].v * 1.1) f.rise = true;
  }
  return f;
}

// Méthotrexate dose unique : J1 = injection, J4 = +3 j, J7 = +6 j (±24 h)
export function mtxEval(P, d1) {
  if (!d1) return null;
  const t0 = Date.parse(d1);
  if (Number.isNaN(t0)) return null;
  const near = (day) => {
    const tt = t0 + day * DAY;
    let best = null;
    let bd = Infinity;
    for (const p of P) {
      const dd = Math.abs(p.t - tt);
      if (dd <= DAY && dd < bd) {
        best = p;
        bd = dd;
      }
    }
    return best;
  };
  const p4 = near(3);
  const p7 = near(6);
  const r = { t4: t0 + 3 * DAY, t7: t0 + 6 * DAY, ok: null };
  if (p4 && p7) r.ok = (p7.v - p4.v) / p4.v <= -0.15;
  return r;
}

// Construit la correspondance étiologique + les recommandations.
// L = dictionnaire de la langue courante (namespace "hcg"), fmtDate(ms) -> string
export function interpret({ points, ctx, us, mtx, red }, L, fmtDate) {
  const A = analyze(points);
  const { P, profile } = A;
  const lastV = P[P.length - 1].v;
  const maxV = Math.max(...P.map((p) => p.v));
  const span = (P[P.length - 1].t - P[0].t) / DAY;

  const etio = [...(L[`e_${profile}`] || [])];
  if (maxV > 100000) etio.push(L.e_high);
  if (profile === "plateau" && lastV <= 200 && P.length >= 3 && span >= 7 && ctx !== "mole") etio.push(L.e_interf);

  const abnormal = profile === "slow" || profile === "plateau";
  const R = [];
  if (red) R.push({ urgent: true, text: L.r_red });
  const add = (text) => R.push({ text });

  if (ctx === "early") {
    add(L.r_alone);
    if (lastV >= 3500 && (us === "none" || us === "noiup")) add(L.r_zone);
    if (profile === "single" || profile === "out") add(L.r_repeat);
    else if (profile === "normal") {
      add(L.r_normal);
      if (us !== "iup") add(L.r_repeat);
    } else if (abnormal || profile === "fall") {
      add(L.r_abn);
      if (us === "none" || us === "noiup") add(L.r_pul);
      add(L.r_opts);
    }
    if (us === "mass") add(L.r_opts);
    add(L.r_rh);
  } else if (ctx === "loss") {
    add(profile === "neg" ? L.rl_neg : abnormal ? L.rl_slow : L.rl_follow);
    add(L.r_rh);
  } else if (ctx === "mtx") {
    add(L.rm_info);
    const m = mtxEval(P, mtx);
    if (!m) add(`${L.rm_wait}—`);
    else if (m.ok === null) add(`${L.rm_wait}${fmtDate(m.t4)} / ${fmtDate(m.t7)}`);
    else add(m.ok ? L.rm_ok : L.rm_fail);
    add(L.rm_safe);
    add(L.r_rh);
  } else if (ctx === "mole") {
    add(L.rmo_follow);
    const f = gtnFlags(P);
    if (f.plateau) add(L.rmo_plateau);
    if (f.rise) add(L.rmo_rise);
  }
  // dédoublonnage (r_opts peut être ajouté deux fois)
  const seen = new Set();
  const recs = R.filter((r) => (seen.has(r.text) ? false : seen.add(r.text)));
  return { A, etio, recs };
}
