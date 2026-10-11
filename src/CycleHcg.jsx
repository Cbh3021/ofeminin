import { useMemo, useState } from "react";
import { Activity, ArrowLeft, AlertTriangle, Info, Plus, Trash2 } from "lucide-react";
import { useLanguage } from "./i18n/LanguageContext";
import { translations } from "./i18n/translations";
import { addHcg, removeHcg, useHcgSettings, useHcgSuivi } from "./useCycleData";
import { MIN_FALL, interpret, minRise } from "./hcgLogic";

// ============================================================
// SUIVI β-hCG QUANTITATIVE
// ============================================================
// Saisie des dosages, profil en courbe par point de dosage,
// correspondance étiologique et recommandations (ACOG PB 193,
// NICE NG126, ESHRE 2022, RCOG/FIGO). Aide à la décision :
// ne remplace pas le jugement clinique.

const H = 3600000;
const TAG = {
  normal: "bg-[#2E8B57]",
  slow: "bg-[#D98324]",
  plateau: "bg-[#C0392B]",
  fall: "bg-[#3B6FB6]",
  neg: "bg-[#3B6FB6]",
  out: "bg-[#8A8A8A]",
  single: "bg-[#8A8A8A]",
};

function nowLocalInput() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

function fmtVal(v) {
  return v >= 100 ? Math.round(v).toLocaleString("fr-FR") : String(Math.round(v * 10) / 10);
}

function HcgChart({ P, fmtDate, L }) {
  const W = 640;
  const Ht = 290;
  const pl = 54;
  const pr = 14;
  const pt = 14;
  const pb = 40;
  const t0 = P[0].t;
  const tEnd = Math.max(P[P.length - 1].t + 48 * H, t0 + 96 * H);
  const span = tEnd - t0;
  const vals = P.map((p) => p.v);
  const lo = Math.pow(10, Math.floor(Math.log10(Math.max(0.1, Math.min(...vals) * 0.6))));
  let hi = Math.pow(10, Math.ceil(Math.log10(Math.max(...vals) * 1.6)));
  if (hi <= lo) hi = lo * 10;
  const X = (t) => pl + ((t - t0) / span) * (W - pl - pr);
  const Y = (v) => pt + (1 - (Math.log10(v) - Math.log10(lo)) / (Math.log10(hi) - Math.log10(lo))) * (Ht - pt - pb);

  const decades = [];
  for (let g = lo; g <= hi * 1.001; g *= 10) decades.push(g);

  const refPath = (v0, rate) => {
    let d = "";
    let started = false;
    for (let k = 0; k <= 40; k++) {
      const t = t0 + (span * k) / 40;
      const v = v0 * Math.pow(rate, (t - t0) / (48 * H));
      if (v < lo || v > hi) {
        started = false;
        continue;
      }
      d += `${started ? "L" : "M"}${X(t).toFixed(1)} ${Y(v).toFixed(1)} `;
      started = true;
    }
    return d;
  };
  const riseD = refPath(P[0].v, 1 + minRise(P[0].v));
  const fallD = refPath(P[0].v, 1 - MIN_FALL);
  const line = P.map((p, i) => `${i ? "L" : "M"}${X(p.t).toFixed(1)} ${Y(p.v).toFixed(1)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${W} ${Ht}`} className="w-full h-auto text-[#1E293B]" role="img" aria-label="β-hCG" dir="ltr">
      {decades.map((g) => (
        <g key={g}>
          <line x1={pl} x2={W - pr} y1={Y(g)} y2={Y(g)} stroke="currentColor" opacity=".12" />
          <text x={pl - 6} y={Y(g) + 4} fontSize="11" textAnchor="end" fill="currentColor" opacity=".7">
            {g >= 1000 ? `${g / 1000}k` : g}
          </text>
        </g>
      ))}
      {[
        [5, "5"],
        [3500, "3 500"],
      ]
        .filter(([v]) => v > lo && v < hi)
        .map(([v, label]) => (
          <g key={v}>
            <line x1={pl} x2={W - pr} y1={Y(v)} y2={Y(v)} stroke="#C0392B" strokeDasharray="3 4" opacity=".55" />
            <text x={W - pr - 2} y={Y(v) - 3} fontSize="10" textAnchor="end" fill="#C0392B">
              {label}
            </text>
          </g>
        ))}
      {riseD && <path d={riseD} fill="none" stroke="#2E8B57" strokeWidth="1.5" strokeDasharray="6 4" opacity=".75" />}
      {fallD && <path d={fallD} fill="none" stroke="#3B6FB6" strokeWidth="1.5" strokeDasharray="6 4" opacity=".75" />}
      <path d={line} fill="none" stroke="#E1396C" strokeWidth="2.2" />
      {P.map((p) => (
        <g key={p.id ?? p.t}>
          <circle cx={X(p.t)} cy={Y(p.v)} r="4.5" fill="#E1396C" />
          <text x={X(p.t)} y={Y(p.v) - 9} fontSize="11" textAnchor="middle" fill="currentColor">
            {fmtVal(p.v)}
          </text>
        </g>
      ))}
      {[0, 0.5, 1].map((f) => (
        <text
          key={f}
          x={X(t0 + span * f)}
          y={Ht - 20}
          fontSize="10"
          textAnchor={f === 0 ? "start" : f === 1 ? "end" : "middle"}
          fill="currentColor"
          opacity=".7"
        >
          {fmtDate(t0 + span * f)}
        </text>
      ))}
      <text x={pl} y={Ht - 4} fontSize="11" fill="currentColor">
        <tspan fill="#2E8B57">- - </tspan>
        {L.l_rise}
        <tspan fill="#3B6FB6" dx="14">- - </tspan>
        {L.l_fall}
      </text>
    </svg>
  );
}

function SectionLabel({ children }) {
  return <h2 className="text-[15px] font-semibold text-[#5C1832] tracking-tight mb-2.5">{children}</h2>;
}

const card = "bg-white rounded-2xl p-4 shadow-sm border border-[#F0DCE4]";
const field =
  "w-full rounded-xl border border-[#F0DCE4] bg-white px-3 py-2.5 text-sm text-[#1E293B] outline-none focus:border-[#E1396C]";
const labelCls = "block text-[12px] font-medium text-[#64748B] mb-1";

export default function CycleHcg({ onBack }) {
  const { t, lang } = useLanguage();
  const L = translations[lang]?.hcg ?? translations.fr.hcg;
  const { items, loading } = useHcgSuivi();
  const { settings, saveHcgSettings } = useHcgSettings();

  const [dateInput, setDateInput] = useState(nowLocalInput);
  const [valInput, setValInput] = useState("");
  const [red, setRed] = useState(false);
  const [error, setError] = useState("");

  const fmtDate = (ms) =>
    new Date(ms).toLocaleString(L.locale, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

  const points = useMemo(
    () =>
      items
        .map((i) => ({ id: i.id, t: Date.parse(i.d), v: Number(i.v) }))
        .filter((p) => !Number.isNaN(p.t) && p.v > 0),
    [items]
  );

  const result = useMemo(
    () =>
      points.length
        ? interpret({ points, ctx: settings.ctx, us: settings.us, mtx: settings.mtx, red }, L, fmtDate)
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [points, settings.ctx, settings.us, settings.mtx, red, lang]
  );

  async function handleAdd() {
    const v = parseFloat(valInput);
    if (!dateInput || !(v > 0)) return;
    setError("");
    try {
      await addHcg({ d: dateInput, v });
      setValInput("");
    } catch (e) {
      setError(t("hcg.saveFailed", { error: e.message }));
    }
  }

  async function handleDelete(id) {
    try {
      await removeHcg(id);
    } catch (e) {
      setError(t("hcg.saveFailed", { error: e.message }));
    }
  }

  const ctxOptions = ["early", "loss", "mtx", "mole"];
  const usOptions = ["none", "noiup", "iup", "mass"];

  return (
    <div className="w-full max-w-2xl mx-auto bg-[#FBF5F7] text-[#1E293B] font-sans">
      <div className="px-4 sm:px-6 page-header pb-6 bg-gradient-to-b from-[#FDE7F0] to-[#FBF5F7]">
        {onBack && (
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm text-[#64748B] active:text-[#E1396C] mb-3 -ml-1"
          >
            <ArrowLeft size={16} />
            {t("common.back")}
          </button>
        )}
        <div className="flex items-center gap-2 mb-1">
          <Activity size={14} className="text-[#E1396C]" />
          <p className="text-xs font-medium tracking-wide text-[#E1396C]">β-hCG</p>
        </div>
        <h1 className="text-2xl font-semibold">{L.title}</h1>
        <p className="text-sm text-[#64748B] mt-2 leading-relaxed max-w-md">{L.subtitle}</p>
      </div>

      <div className="px-4 sm:px-6 py-5 space-y-6">
        <div className="flex gap-3 bg-[#FEF3C7] text-[#92400E] rounded-2xl p-4">
          <Info size={16} className="shrink-0 mt-0.5" />
          <p className="text-[12px] leading-relaxed">{L.disc}</p>
        </div>

        {/* Saisie */}
        <div className={`${card} space-y-3`}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>{L.date}</label>
              <input type="datetime-local" className={field} value={dateInput} onChange={(e) => setDateInput(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>{L.value}</label>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                className={field}
                value={valInput}
                onChange={(e) => setValInput(e.target.value)}
              />
            </div>
          </div>
          <button
            onClick={handleAdd}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#E1396C] text-sm font-medium text-white active:bg-[#B91856]"
          >
            <Plus size={14} />
            {L.add}
          </button>
          {error && <p className="text-[11px] text-[#B91C1C]">{error}</p>}
        </div>

        {/* Contexte */}
        <div className={`${card} space-y-3`}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>{L.ctx}</label>
              <select className={field} value={settings.ctx} onChange={(e) => saveHcgSettings({ ctx: e.target.value })}>
                {ctxOptions.map((k) => (
                  <option key={k} value={k}>
                    {L[`ctx_${k}`]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>{L.us}</label>
              <select className={field} value={settings.us} onChange={(e) => saveHcgSettings({ us: e.target.value })}>
                {usOptions.map((k) => (
                  <option key={k} value={k}>
                    {L[`us_${k}`]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {settings.ctx === "mtx" && (
            <div>
              <label className={labelCls}>{L.mtxd}</label>
              <input
                type="datetime-local"
                className={field}
                value={settings.mtx || ""}
                onChange={(e) => saveHcgSettings({ mtx: e.target.value })}
              />
            </div>
          )}
          <label className="flex items-start gap-2 text-[12.5px] text-[#1E293B]">
            <input type="checkbox" className="mt-0.5" checked={red} onChange={(e) => setRed(e.target.checked)} />
            <span>{L.red}</span>
          </label>
        </div>

        {loading && <p className="text-sm text-[#64748B]">{L.loading}</p>}
        {!loading && points.length === 0 && <p className="text-[12px] text-[#94A3B8]">{L.needRows}</p>}
        {points.length === 1 && <p className="text-[12px] text-[#94A3B8]">{L.empty}</p>}

        {result && (
          <>
            {result.recs.filter((r) => r.urgent).map((r) => (
              <div key="urgent" className="flex gap-3 bg-[#FDECEA] border border-[#C0392B] text-[#8C1D14] rounded-2xl p-4">
                <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                <p className="text-[13px] leading-relaxed">
                  <b>{L.urgent}</b> — {r.text}
                </p>
              </div>
            ))}

            {result.A.P.length >= 2 && (
              <div>
                <SectionLabel>{L.chart}</SectionLabel>
                <div className={card}>
                  <HcgChart P={result.A.P} fmtDate={fmtDate} L={L} />
                </div>
              </div>
            )}

            <div>
              <SectionLabel>{L.l_pts}</SectionLabel>
              <div className={`${card} overflow-x-auto`}>
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="text-start text-[#64748B]">
                      {["c_date", "c_val", "c_dt", "c_pct", "c_dbl", "c_prof"].map((k) => (
                        <th key={k} className="px-1.5 py-1.5 text-start font-medium whitespace-nowrap">
                          {L[k]}
                        </th>
                      ))}
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {result.A.P.map((p, i) => {
                      const pr = i ? result.A.pairs[i - 1] : null;
                      return (
                        <tr key={p.id} className="border-t border-[#F0DCE4]">
                          <td className="px-1.5 py-1.5 whitespace-nowrap">{fmtDate(p.t)}</td>
                          <td className="px-1.5 py-1.5 font-semibold">{fmtVal(p.v)}</td>
                          <td className="px-1.5 py-1.5">{pr ? Math.round(pr.h) : "—"}</td>
                          <td className="px-1.5 py-1.5 whitespace-nowrap" dir="ltr">
                            {pr && pr.pct !== null ? `${pr.pct > 0 ? "+" : ""}${Math.round(pr.pct * 100)} %` : "—"}
                          </td>
                          <td className="px-1.5 py-1.5">{pr?.dbl ? Math.round(pr.dbl) : "—"}</td>
                          <td className="px-1.5 py-1.5">
                            <span
                              className={`inline-block rounded-full px-2 py-0.5 text-[10.5px] text-white whitespace-nowrap ${
                                TAG[pr ? pr.cls : "single"]
                              }`}
                            >
                              {L[`k_${pr ? pr.cls : "single"}`]}
                            </span>
                          </td>
                          <td className="px-1 py-1.5">
                            <button onClick={() => handleDelete(p.id)} aria-label={L.del} className="text-[#B91C1C] p-1">
                              <Trash2 size={13} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <SectionLabel>{L.etio}</SectionLabel>
              <div className={`${card} space-y-2`}>
                {result.etio.map((x) => (
                  <p key={x} className="text-[13px] leading-relaxed">
                    • {x}
                  </p>
                ))}
              </div>
            </div>

            <div>
              <SectionLabel>{L.rec}</SectionLabel>
              <div className={`${card} space-y-2`}>
                {result.recs
                  .filter((r) => !r.urgent)
                  .map((r) => (
                    <p key={r.text} className="text-[13px] leading-relaxed">
                      • {r.text}
                    </p>
                  ))}
              </div>
            </div>

            <div>
              <SectionLabel>{L.refs}</SectionLabel>
              <div className={`${card} space-y-1`}>
                {L.refs_list.map((x) => (
                  <p key={x} className="text-[11.5px] leading-relaxed text-[#64748B]">
                    {x}
                  </p>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
