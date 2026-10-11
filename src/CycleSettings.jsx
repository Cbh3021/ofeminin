import { useState, useEffect } from "react";
import { Calendar, Droplet, RotateCcw, Check, LogOut, X } from "lucide-react";
import { signOut } from "firebase/auth";
import { auth } from "./firebase";
import { useCycleSettings } from "./useCycleData";
import { scheduleCycleNotifications } from "./capacitorNotifications";
import { useLanguage } from "./i18n/LanguageContext";

// ---------- Estimation de l'ovulation ----------
// Si les cycles sont irréguliers, l'ovulation ne tombe pas toujours au
// même jour d'un cycle à l'autre : on élargit alors la fenêtre fertile
// avec la règle calendaire (méthode Ogino) : début = cycle le plus
// court - 18, fin = cycle le plus long - 11.
function computeOvulationDay(longueurCycle) {
  return longueurCycle - 14;
}

// Fenêtre fertile élargie par la méthode calendaire, à partir du cycle le
// plus court et du plus long observés récemment.
function calendarFertileWindow(shortestCycle, longestCycle) {
  return {
    start: shortestCycle - 18,
    end: longestCycle - 11,
  };
}

// Fiabilité de l'estimation calendaire, selon l'écart entre cycle le plus
// court et le plus long (FIGO : une variation ≤ 8-9 jours reste compatible
// avec des cycles ovulatoires réguliers ; au-delà, l'estimation calendaire
// devient peu fiable et évoque une anovulation à explorer — voir le
// dossier clinique).
function fiabiliteEstimation(cycleIrregulier, cycleCourt, cycleLong, t) {
  if (!cycleIrregulier) return t("settings.reliabilityReliable");
  const ecart = cycleLong - cycleCourt;
  if (ecart <= 8) return t("settings.reliabilityFair");
  return t("settings.reliabilityPoor");
}

// Diagnostic de longueur de cycle — mêmes seuils que la classification
// clinique du Dossier (polyménorrhée < 21 j, oligoménorrhée > 35 j),
// pour rester cohérent avec le reste de l'app.
function classifyCycleLength(jours, t) {
  if (jours < 21) return { label: t("settings.cycleLenShort"), badgeClass: "bg-[#FEE2E2] text-[#B91C1C]" };
  if (jours > 35) return { label: t("settings.cycleLenLong"), badgeClass: "bg-[#FEF3C7] text-[#92400E]" };
  return { label: t("settings.cycleLenNormal"), badgeClass: "bg-[#DCFCE7] text-[#166534]" };
}

export default function CycleSettings() {
  const { t } = useLanguage();
  const { settings, loading, saveSettings } = useCycleSettings();

  const [ddr, setDdr] = useState("2026-09-01");
  const [dureeRegles, setDureeRegles] = useState(5);
  const [longueurCycle, setLongueurCycle] = useState(28);
  const [cycleIrregulier, setCycleIrregulier] = useState(false);
  const [cycleCourt, setCycleCourt] = useState(26);
  const [cycleLong, setCycleLong] = useState(31);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [logoutOpen, setLogoutOpen] = useState(false);

  // Une fois les paramètres chargés depuis Firestore, on les reflète dans le formulaire.
  useEffect(() => {
    if (loading) return;
    if (settings.ddr) setDdr(settings.ddr);
    setDureeRegles(settings.dureeRegles);
    setLongueurCycle(settings.longueurCycle);
    setCycleIrregulier(settings.cycleIrregulier);
    setCycleCourt(settings.cycleCourt);
    setCycleLong(settings.cycleLong);
  }, [loading, settings]);

  const ovulationDay = computeOvulationDay(longueurCycle);
  const calendarWindow = cycleIrregulier
    ? calendarFertileWindow(cycleCourt, cycleLong)
    : { start: ovulationDay - 5, end: ovulationDay + 1 };

  const fiabilite = fiabiliteEstimation(cycleIrregulier, cycleCourt, cycleLong, t);
  const ecartCycles = cycleLong - cycleCourt;

  async function handleSave() {
    setSaveError(null);
    try {
      await saveSettings({
        ddr,
        dureeRegles,
        longueurCycle,
        cycleIrregulier,
        cycleCourt,
        cycleLong,
      });
      await scheduleCycleNotifications({ ddr, longueurCycle });
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    } catch (err) {
      setSaveError(err.message);
    }
  }

  function resetDefaults() {
    setDureeRegles(5);
    setLongueurCycle(28);
  }

  return (
    <div className="w-full max-w-2xl mx-auto bg-[#FBF5F7] text-[#1E293B] font-sans">
      <div className="px-4 sm:px-6 page-header pb-5 bg-gradient-to-b from-[#FDE7F0] to-[#FBF5F7]">
        <p className="text-xs font-medium tracking-wide uppercase text-[#64748B]">{t("settings.header")}</p>
        <h1 className="text-2xl mt-1 font-semibold">{t("settings.title")}</h1>
      </div>

      <div className="px-4 sm:px-6 py-5 space-y-6">
        {/* DDR */}
        <div>
          <label className="flex items-center gap-2 text-sm text-[#64748B] mb-2">
            <Calendar size={14} className="text-[#E1396C]" />
            {t("settings.lastPeriodDate")}
          </label>
          <input
            type="date"
            value={ddr}
            onChange={(e) => setDdr(e.target.value)}
            className="w-full bg-white border border-[#F0DCE4] rounded-xl px-4 py-3 text-sm text-[#1E293B] outline-none focus:border-[#E1396C] shadow-sm"
          />
        </div>

        {/* Durée des règles */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="flex items-center gap-2 text-sm text-[#64748B]">
              <Droplet size={14} className="text-[#B91C1C]" />
              {t("settings.periodDuration")}
            </label>
            <span className="text-sm font-mono tabular-nums">
              {dureeRegles} {t("settings.days")}
            </span>
          </div>
          <input
            type="range"
            min="2"
            max="10"
            step="1"
            value={dureeRegles}
            onChange={(e) => setDureeRegles(parseInt(e.target.value, 10))}
            className="w-full accent-[#B91C1C]"
          />
          {dureeRegles > 7 && (
            <p className="text-[11px] text-[#B91C1C] mt-1">{t("settings.menorrhagiaWarning")}</p>
          )}
        </div>

        {/* Longueur du cycle */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm text-[#64748B]">{t("settings.cycleLength")}</label>
            <div className="flex items-center gap-2">
              <span
                className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                  classifyCycleLength(longueurCycle, t).badgeClass
                }`}
              >
                {classifyCycleLength(longueurCycle, t).label}
              </span>
              <span className="text-sm font-mono tabular-nums">
                {longueurCycle} {t("settings.days")}
              </span>
            </div>
          </div>
          <input
            type="range"
            min="21"
            max="40"
            step="1"
            value={longueurCycle}
            onChange={(e) => setLongueurCycle(parseInt(e.target.value, 10))}
            className="w-full accent-[#E1396C]"
          />
          <p className="text-[11px] text-[#94A3B8] mt-1">
            {t("settings.ovulationEstimate", { day: ovulationDay })}
          </p>
        </div>

        {/* Cycle irrégulier */}
        <div>
          <button
            onClick={() => setCycleIrregulier((v) => !v)}
            className="w-full flex items-center justify-between bg-white rounded-xl px-4 py-3 shadow-sm border border-[#F0DCE4]"
          >
            <span className="text-sm text-[#64748B]">{t("settings.irregularCycles")}</span>
            <span
              className={`w-9 h-5 rounded-full relative transition-colors ${
                cycleIrregulier ? "bg-[#E1396C]" : "bg-[#F0DCE4]"
              }`}
            >
              <span
                className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                  cycleIrregulier ? "translate-x-4" : "translate-x-0.5"
                }`}
              />
            </span>
          </button>

          {cycleIrregulier && (
            <div className="mt-3 bg-white rounded-xl p-4 space-y-4 shadow-sm border border-[#F0DCE4]">
              <div className="flex items-center justify-between">
                <span className="text-sm text-[#64748B]">{t("settings.shortestCycle")}</span>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                      classifyCycleLength(cycleCourt, t).badgeClass
                    }`}
                  >
                    {classifyCycleLength(cycleCourt, t).label}
                  </span>
                  <span className="text-sm font-mono tabular-nums">
                    {cycleCourt} {t("settings.daysShort")}
                  </span>
                </div>
              </div>
              <input
                type="range"
                min="21"
                max={cycleLong}
                step="1"
                value={cycleCourt}
                onChange={(e) => setCycleCourt(parseInt(e.target.value, 10))}
                className="w-full accent-[#E1396C]"
              />
              <div className="flex items-center justify-between">
                <span className="text-sm text-[#64748B]">{t("settings.longestCycle")}</span>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                      classifyCycleLength(cycleLong, t).badgeClass
                    }`}
                  >
                    {classifyCycleLength(cycleLong, t).label}
                  </span>
                  <span className="text-sm font-mono tabular-nums">
                    {cycleLong} {t("settings.daysShort")}
                  </span>
                </div>
              </div>
              <input
                type="range"
                min={cycleCourt}
                max="45"
                step="1"
                value={cycleLong}
                onChange={(e) => setCycleLong(parseInt(e.target.value, 10))}
                className="w-full accent-[#E1396C]"
              />
              <div className="flex items-center justify-between pt-1 border-t border-[#F0DCE4]">
                <span className="text-[11px] text-[#94A3B8]">
                  {t("settings.calendarWindow", {
                    start: calendarWindow.start,
                    end: calendarWindow.end,
                    gap: ecartCycles,
                  })}
                </span>
                <span
                  className={`text-[11px] px-2 py-0.5 rounded-full ${
                    fiabilite === t("settings.reliabilityPoor")
                      ? "bg-[#FEE2E2] text-[#B91C1C]"
                      : fiabilite === t("settings.reliabilityFair")
                      ? "bg-[#FEF3C7] text-[#92400E]"
                      : "bg-[#DCFCE7] text-[#166534]"
                  }`}
                >
                  {fiabilite}
                </span>
              </div>
              {fiabilite === t("settings.reliabilityPoor") && (
                <p className="text-[11px] text-[#B91C1C]">{t("settings.anovulationWarning")}</p>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        {saveError && (
          <p className="text-[11px] text-[#B91C1C]">{t("settings.saveFailed", { error: saveError })}</p>
        )}
        <div className="flex gap-3 pt-2">
          <button
            onClick={resetDefaults}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white text-sm text-[#64748B] active:bg-[#FBE8F0] shadow-sm border border-[#F0DCE4]"
          >
            <RotateCcw size={14} />
            {t("settings.reset")}
          </button>
          <button
            onClick={handleSave}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#E1396C] text-sm text-white active:bg-[#B91856]"
          >
            {saved ? <Check size={14} /> : null}
            {saved ? t("settings.saved") : t("settings.save")}
          </button>
        </div>

        {/* Compte */}
        <div>
          <p className="text-sm font-medium text-[#334155] mb-3">{t("settings.account")}</p>
          <button
            onClick={() => setLogoutOpen(true)}
            className="w-full flex items-center gap-3 bg-white rounded-2xl px-4 py-3.5 shadow-sm border border-[#F0DCE4] active:bg-[#FEF2F2] text-left"
          >
            <div className="w-9 h-9 rounded-full bg-[#FEE2E2] flex items-center justify-center shrink-0">
              <LogOut size={16} className="text-[#B91C1C]" />
            </div>
            <span className="text-sm text-[#B91C1C]">{t("settings.logout")}</span>
          </button>
        </div>
      </div>

      {/* Confirmation de déconnexion */}
      {logoutOpen && (
        <div
          className="fixed inset-0 bg-black/30 flex items-end sm:items-center justify-center z-[70]"
          onClick={() => setLogoutOpen(false)}
        >
          <div
            className="w-full max-w-sm bg-white rounded-t-3xl sm:rounded-2xl p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:pb-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sheet-handle sm:hidden" />
            <div className="flex items-center justify-between mb-2 sm:mb-2">
              <p className="text-base font-medium">{t("settings.logoutConfirmTitle")}</p>
              <button onClick={() => setLogoutOpen(false)} className="text-[#94A3B8] sm:hidden">
                <X size={18} />
              </button>
            </div>
            <p className="text-sm text-[#64748B] mb-5">{t("settings.logoutConfirmBody")}</p>
            <div className="flex gap-3">
              <button
                onClick={() => setLogoutOpen(false)}
                className="flex-1 py-3 rounded-xl bg-[#FBF5F7] text-sm text-[#64748B] border border-[#F0DCE4]"
              >
                {t("settings.cancel")}
              </button>
              <button
                onClick={() => signOut(auth)}
                className="flex-1 py-3 rounded-xl bg-[#B91C1C] text-sm text-white active:bg-[#991B1B]"
              >
                {t("settings.logout")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
