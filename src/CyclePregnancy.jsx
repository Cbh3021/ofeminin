import { useMemo, useState } from "react";
import { Baby, Calendar, Heart, ChevronRight, Stethoscope, ClipboardCheck, Plus, X, Check } from "lucide-react";
import {
  useGrossesse,
  useGrossesseSuivi,
  addSuiviGrossesse,
  updateSuiviGrossesse,
} from "./useCycleData";
import { useLanguage } from "./i18n/LanguageContext";

function diffInDays(a, b) {
  const MS = 1000 * 60 * 60 * 24;
  return Math.round((new Date(b).setHours(0, 0, 0, 0) - new Date(a).setHours(0, 0, 0, 0)) / MS);
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDate(iso, locale) {
  return new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" });
}

// Semaines d'aménorrhée (SA) : convention obstétricale française, comptées
// depuis la date des dernières règles (DDG = DDR retenue à la confirmation).
function semainesAmenorrhee(ddg, today) {
  const jours = Math.max(diffInDays(ddg, today), 0);
  return { semaines: Math.floor(jours / 7), joursRestants: jours % 7, joursTotal: jours };
}

function trimestreLabel(sa, t) {
  if (sa < 14) return t("pregnancy.trimestre1");
  if (sa < 28) return t("pregnancy.trimestre2");
  return t("pregnancy.trimestre3");
}

export default function CyclePregnancy() {
  const { t } = useLanguage();
  const { grossesse, loading, marquerAccouchement } = useGrossesse();
  const { items: suivi, loading: suiviLoading } = useGrossesseSuivi();

  // Repères indicatifs (calendrier HAS du suivi de grossesse en France) : ne
  // remplacent pas les recommandations données en consultation, mais servent
  // de rappel des échéances usuelles.
  const BILANS_RECOMMANDES = [
    { code: "consult_precoce", label: t("pregnancy.bilanConsultPrecoce"), saDebut: 0, saFin: 10 },
    { code: "bilan_sanguin_t1", label: t("pregnancy.bilanSanguinT1"), saDebut: 0, saFin: 12 },
    { code: "depistage_t21", label: t("pregnancy.bilanDepistageT21"), saDebut: 11, saFin: 13 },
    { code: "echo_t1", label: t("pregnancy.bilanEchoT1"), saDebut: 11, saFin: 14 },
    { code: "echo_t2", label: t("pregnancy.bilanEchoT2"), saDebut: 20, saFin: 25 },
    { code: "hgpo", label: t("pregnancy.bilanHgpo"), saDebut: 24, saFin: 28 },
    { code: "echo_t3", label: t("pregnancy.bilanEchoT3"), saDebut: 30, saFin: 34 },
    { code: "prelevement_sgb", label: t("pregnancy.bilanPrelevementSgb"), saDebut: 34, saFin: 38 },
    { code: "consult_anesthesie", label: t("pregnancy.bilanConsultAnesthesie"), saDebut: 32, saFin: 38 },
  ];

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [dateAccouchement, setDateAccouchement] = useState(todayISO());

  const [consultModalOpen, setConsultModalOpen] = useState(false);
  const [consultForm, setConsultForm] = useState({ date: todayISO(), poids: "", ta: "", notes: "" });

  const [bilanModal, setBilanModal] = useState(null); // { code, label, saDebut, saFin } | null
  const [bilanDate, setBilanDate] = useState(todayISO());

  const today = todayISO();
  const { semaines, joursRestants, joursTotal } = useMemo(
    () =>
      grossesse.ddg
        ? semainesAmenorrhee(grossesse.ddg, today)
        : { semaines: 0, joursRestants: 0, joursTotal: 0 },
    [grossesse.ddg, today]
  );
  const joursRestantsDpa = grossesse.dpa ? Math.max(diffInDays(today, grossesse.dpa), 0) : null;
  const progressPct = Math.min((joursTotal / 280) * 100, 100);

  const consultations = useMemo(
    () => suivi.filter((i) => i.type === "consultation").sort((a, b) => (a.date < b.date ? 1 : -1)),
    [suivi]
  );

  const bilansFaits = useMemo(() => {
    const map = new Map();
    suivi.filter((i) => i.type === "bilan" && i.fait).forEach((i) => map.set(i.code, i));
    return map;
  }, [suivi]);

  async function confirmerAccouchement() {
    await marquerAccouchement(dateAccouchement);
    setConfirmOpen(false);
  }

  async function enregistrerConsultation() {
    await addSuiviGrossesse({
      type: "consultation",
      date: consultForm.date,
      poids: consultForm.poids ? Number(consultForm.poids) : null,
      ta: consultForm.ta || null,
      notes: consultForm.notes || "",
    });
    setConsultForm({ date: todayISO(), poids: "", ta: "", notes: "" });
    setConsultModalOpen(false);
  }

  function ouvrirBilan(b) {
    const existant = bilansFaits.get(b.code);
    setBilanDate(existant?.date || todayISO());
    setBilanModal(b);
  }

  async function enregistrerBilan() {
    const existant = bilansFaits.get(bilanModal.code);
    if (existant) {
      await updateSuiviGrossesse(existant.id, { date: bilanDate, fait: true });
    } else {
      await addSuiviGrossesse({
        type: "bilan",
        code: bilanModal.code,
        label: bilanModal.label,
        date: bilanDate,
        fait: true,
      });
    }
    setBilanModal(null);
  }

  async function annulerBilan() {
    const existant = bilansFaits.get(bilanModal.code);
    if (existant) await updateSuiviGrossesse(existant.id, { fait: false });
    setBilanModal(null);
  }

  const dateLocale = t("pregnancy.dateLocale");

  if (loading || suiviLoading) {
    return (
      <div className="w-full max-w-2xl mx-auto py-16 flex items-center justify-center">
        <span className="text-sm text-[#64748B]">{t("pregnancy.loading")}</span>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto bg-[#FBF5F7] text-[#1E293B] font-sans">
      {/* En-tête : lecture directe des SA et du trimestre */}
      <div className="px-4 sm:px-6 page-header pb-6 bg-gradient-to-b from-[#FCE7F3] to-[#FBF5F7]">
        <div className="flex items-center justify-between mb-6">
          <span className="text-xs font-medium tracking-wide uppercase text-[#64748B]">{t("pregnancy.kicker")}</span>
          <Baby size={16} className="text-[#BE185D]" />
        </div>
        <div className="flex items-baseline gap-3">
          <span className="text-5xl sm:text-6xl leading-none font-mono tabular-nums">
            {semaines} {t("pregnancy.saUnit")}
          </span>
          <div>
            <p className="text-sm text-[#64748B]">
              {t("pregnancy.daysPlus", { days: joursRestants, trimestre: trimestreLabel(semaines, t) })}
            </p>
            {grossesse.dpa && (
              <p className="text-base font-medium">{t("pregnancy.dueDate", { date: formatDate(grossesse.dpa, dateLocale) })}</p>
            )}
          </div>
        </div>
        {joursRestantsDpa !== null && (
          <p className="mt-4 text-sm text-[#64748B]">
            {t("pregnancy.daysRemainingBefore")}{" "}
            <span className="text-[#1E293B] font-medium font-mono tabular-nums">{joursRestantsDpa} j</span>{" "}
            {t("pregnancy.daysRemainingAfter")}
          </p>
        )}
      </div>

      <div className="px-4 sm:px-6 py-5 space-y-5">
        {/* Progression DDG → terme */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#F0DCE4]">
          <div className="flex items-center justify-between mb-2 text-[11px] text-[#94A3B8]">
            <span>{t("pregnancy.ddg")}</span>
            <span>{t("pregnancy.termLabel")}</span>
          </div>
          <div className="h-2 rounded-full bg-[#FBF5F7] overflow-hidden">
            <div className="h-full rounded-full bg-[#BE185D]" style={{ width: `${progressPct}%` }} />
          </div>
          <p className="text-[11px] text-[#94A3B8] mt-2">{t("pregnancy.progressNote")}</p>
        </div>

        {/* Consultations prénatales */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#F0DCE4]">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Stethoscope size={16} className="text-[#E1396C]" />
              <p className="text-sm font-medium">{t("pregnancy.consultationsTitle")}</p>
            </div>
            <button
              onClick={() => setConsultModalOpen(true)}
              className="p-1.5 rounded-full bg-[#FCE4ED] text-[#E1396C] active:bg-[#F9C8DA]"
              aria-label={t("pregnancy.addConsultationAria")}
            >
              <Plus size={14} />
            </button>
          </div>

          {consultations.length === 0 ? (
            <p className="text-[12px] text-[#94A3B8]">{t("pregnancy.noConsultations")}</p>
          ) : (
            <div className="space-y-2">
              {consultations.map((c) => (
                <div key={c.id} className="flex items-start justify-between border-t border-[#FBF5F7] pt-2 first:border-0 first:pt-0">
                  <div>
                    <p className="text-sm font-mono tabular-nums">{formatDate(c.date, dateLocale)}</p>
                    <p className="text-[11px] text-[#64748B]">
                      {c.poids ? `${c.poids} ${t("pregnancy.weightUnit")}` : null}
                      {c.poids && c.ta ? " · " : null}
                      {c.ta ? t("pregnancy.taLabel", { value: c.ta }) : null}
                    </p>
                    {c.notes && <p className="text-[11px] text-[#94A3B8] mt-0.5">{c.notes}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Bilans & examens recommandés */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#F0DCE4]">
          <div className="flex items-center gap-2 mb-1">
            <ClipboardCheck size={16} className="text-[#0F766E]" />
            <p className="text-sm font-medium">{t("pregnancy.bilansTitle")}</p>
          </div>
          <p className="text-[11px] text-[#94A3B8] mb-3">{t("pregnancy.bilansHint")}</p>
          <div className="space-y-1">
            {BILANS_RECOMMANDES.map((b) => {
              const fait = bilansFaits.get(b.code);
              return (
                <button
                  key={b.code}
                  onClick={() => ouvrirBilan(b)}
                  className="w-full flex items-center justify-between gap-3 py-2 border-t border-[#FBF5F7] first:border-0 text-left"
                >
                  <div className="min-w-0">
                    <p className={`text-sm truncate ${fait ? "text-[#1E293B]" : "text-[#64748B]"}`}>{b.label}</p>
                    <p className="text-[11px] text-[#94A3B8]">
                      {fait
                        ? t("pregnancy.bilanDoneOn", { date: formatDate(fait.date, dateLocale) })
                        : t("pregnancy.bilanReference", { start: b.saDebut, end: b.saFin })}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
                      fait ? "bg-[#0F766E] text-white" : "bg-[#FBF5F7] text-[#94A3B8]"
                    }`}
                  >
                    {fait ? <Check size={13} /> : null}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Rappel de la confirmation */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#F0DCE4] flex items-center gap-3">
          <Heart size={16} className="text-[#BE185D] shrink-0" />
          <p className="text-sm text-[#64748B]">
            {t("pregnancy.confirmationReminder", {
              date: grossesse.dateConfirmation ? formatDate(grossesse.dateConfirmation, dateLocale) : "—",
            })}
          </p>
        </div>

        {/* Clôture de la grossesse */}
        <button
          onClick={() => setConfirmOpen(true)}
          className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-white shadow-sm border border-[#F0DCE4] active:bg-[#FBE8F0]"
        >
          <span className="text-sm text-[#1E293B]">{t("pregnancy.markDelivery")}</span>
          <ChevronRight size={16} className="text-[#94A3B8]" />
        </button>
      </div>

      {/* Modale : ajout d'une consultation */}
      {consultModalOpen && (
        <div
          className="fixed inset-0 bg-black/30 flex items-end justify-center z-[70]"
          onClick={() => setConsultModalOpen(false)}
        >
          <div className="w-full max-w-2xl bg-white rounded-t-3xl p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))]" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-handle" />
            <div className="flex items-center justify-between mb-4">
              <p className="text-base font-medium">{t("pregnancy.newConsultation")}</p>
              <button onClick={() => setConsultModalOpen(false)} className="p-1 -m-1 text-[#94A3B8]">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[11px] text-[#94A3B8] mb-1 block">{t("pregnancy.date")}</label>
                <input
                  type="date"
                  value={consultForm.date}
                  onChange={(e) => setConsultForm((f) => ({ ...f, date: e.target.value }))}
                  className="w-full bg-[#FBF5F7] border border-[#F0DCE4] rounded-xl px-4 py-3 text-sm outline-none focus:border-[#E1396C]"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-[#94A3B8] mb-1 block">{t("pregnancy.weightLabel")}</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={consultForm.poids}
                    onChange={(e) => setConsultForm((f) => ({ ...f, poids: e.target.value }))}
                    className="w-full bg-[#FBF5F7] border border-[#F0DCE4] rounded-xl px-4 py-3 text-sm outline-none focus:border-[#E1396C]"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-[#94A3B8] mb-1 block">{t("pregnancy.taFieldLabel")}</label>
                  <input
                    type="text"
                    value={consultForm.ta}
                    onChange={(e) => setConsultForm((f) => ({ ...f, ta: e.target.value }))}
                    className="w-full bg-[#FBF5F7] border border-[#F0DCE4] rounded-xl px-4 py-3 text-sm outline-none focus:border-[#E1396C]"
                  />
                </div>
              </div>
              <div>
                <label className="text-[11px] text-[#94A3B8] mb-1 block">{t("pregnancy.notes")}</label>
                <textarea
                  value={consultForm.notes}
                  onChange={(e) => setConsultForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  className="w-full bg-[#FBF5F7] border border-[#F0DCE4] rounded-xl px-4 py-3 text-sm outline-none focus:border-[#E1396C] resize-none"
                />
              </div>
              <button
                onClick={enregistrerConsultation}
                className="w-full py-3 rounded-xl bg-[#E1396C] text-sm text-white active:bg-[#B91856]"
              >
                {t("pregnancy.save")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modale : bilan / examen */}
      {bilanModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-[70] px-6" onClick={() => setBilanModal(null)}>
          <div className="w-full max-w-sm bg-white rounded-2xl p-6" onClick={(e) => e.stopPropagation()}>
            <p className="text-base font-medium mb-1">{bilanModal.label}</p>
            <p className="text-[11px] text-[#94A3B8] mb-4">
              {t("pregnancy.bilanReferenceModal", { start: bilanModal.saDebut, end: bilanModal.saFin })}
            </p>
            <label className="text-[11px] text-[#94A3B8] mb-1 block">{t("pregnancy.completionDate")}</label>
            <input
              type="date"
              value={bilanDate}
              onChange={(e) => setBilanDate(e.target.value)}
              className="w-full bg-[#FBF5F7] border border-[#F0DCE4] rounded-xl px-4 py-3 text-sm outline-none focus:border-[#0F766E] mb-5"
            />
            <div className="flex gap-3">
              {bilansFaits.get(bilanModal.code) && (
                <button
                  onClick={annulerBilan}
                  className="flex-1 py-3 rounded-xl bg-[#FBF5F7] text-sm text-[#B91C1C] border border-[#F0DCE4]"
                >
                  {t("pregnancy.cancel")}
                </button>
              )}
              <button
                onClick={enregistrerBilan}
                className="flex-1 py-3 rounded-xl bg-[#0F766E] text-sm text-white active:bg-[#0B5D57]"
              >
                {t("pregnancy.markDone")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation d'accouchement */}
      {confirmOpen && (
        <div
          className="fixed inset-0 bg-black/30 flex items-center justify-center z-[70] px-6"
          onClick={() => setConfirmOpen(false)}
        >
          <div className="w-full max-w-sm bg-white rounded-2xl p-6" onClick={(e) => e.stopPropagation()}>
            <p className="text-base font-medium mb-2">{t("pregnancy.markDelivery")}</p>
            <p className="text-sm text-[#64748B] mb-4">{t("pregnancy.markDeliveryBody")}</p>
            <label className="flex items-center gap-2 text-sm text-[#64748B] mb-2">
              <Calendar size={14} className="text-[#BE185D]" />
              {t("pregnancy.deliveryDate")}
            </label>
            <input
              type="date"
              value={dateAccouchement}
              onChange={(e) => setDateAccouchement(e.target.value)}
              className="w-full bg-[#FBF5F7] border border-[#F0DCE4] rounded-xl px-4 py-3 text-sm text-[#1E293B] outline-none focus:border-[#BE185D] mb-5"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmOpen(false)}
                className="flex-1 py-3 rounded-xl bg-[#FBF5F7] text-sm text-[#64748B] border border-[#F0DCE4]"
              >
                {t("pregnancy.cancel")}
              </button>
              <button
                onClick={confirmerAccouchement}
                className="flex-1 py-3 rounded-xl bg-[#BE185D] text-sm text-white active:bg-[#9D174D]"
              >
                {t("pregnancy.confirm")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
