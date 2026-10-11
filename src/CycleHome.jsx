import { useState, useMemo } from "react";
import { Droplet, Calendar, ChevronLeft, ChevronRight, ClipboardList, X, Heart, Baby } from "lucide-react";
import { useCycleSettings, useMonthEvents, addEvent, removeEvent, useGrossesse } from "./useCycleData";
import { useLanguage } from "./i18n/LanguageContext";

// ---------- Logique du cycle ----------
function diffInDays(a, b) {
  const MS = 1000 * 60 * 60 * 24;
  return Math.round((b.setHours(0, 0, 0, 0) - a.setHours(0, 0, 0, 0)) / MS);
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Les phases sont représentées par une clé interne stable (indépendante de
// la langue d'affichage) ; la traduction n'intervient qu'au rendu.
function buildCycleInfo({ ddr, dureeRegles, longueurCycle, today }) {
  const cycleDay = (diffInDays(new Date(ddr), new Date(today)) % longueurCycle + longueurCycle) % longueurCycle + 1;
  const ovulationDay = longueurCycle - 14;
  const fertileStart = ovulationDay - 5;
  const fertileEnd = ovulationDay + 1;

  let phaseKey = "folliculaire";
  if (cycleDay <= dureeRegles) phaseKey = "regles";
  else if (cycleDay === ovulationDay) phaseKey = "ovulation";
  else if (cycleDay >= fertileStart && cycleDay <= fertileEnd) phaseKey = "fertile";
  else if (cycleDay > ovulationDay) phaseKey = "luteale";

  const daysUntilNextPeriod = ((longueurCycle - cycleDay) % longueurCycle) + 1;

  return { cycleDay, ovulationDay, fertileStart, fertileEnd, phaseKey, daysUntilNextPeriod };
}

const PEAK_PCT = 33;
const SIGMA_BEFORE = 2.0;
const SIGMA_AFTER = 0.6;
const BASELINE_PCT = 0.5;

function fertilityForCycleDay(cycleDay, ovulationDay) {
  const offset = cycleDay - ovulationDay;
  const sigma = offset <= 0 ? SIGMA_BEFORE : SIGMA_AFTER;
  const gaussian = Math.exp(-0.5 * (offset / sigma) ** 2);
  return Math.min(BASELINE_PCT + PEAK_PCT * gaussian, 99);
}

// Palette clinique neutre : bleu-gris pour l'interface, rouge pour les
// règles (code couleur usuel des courbes de température/cycle), bleu-vert
// (teal) pour tout ce qui touche à la fenêtre fertile et à l'ovulation.
const STATUS_STYLES = {
  ovulation: "bg-[#0F766E] text-white",
  fertile: "bg-[#CCFBF1] text-[#0F766E] ring-1 ring-[#0D9488]",
  normal: "bg-transparent text-[#64748B]",
};

// Dégradé des règles : plus saturé le jour 1 (flux le plus abondant),
// de plus en plus clair jusqu'au dernier jour.
function periodColor(dayInPeriod, dureeRegles) {
  const start = [127, 29, 29]; // #7F1D1D — jour 1
  const end = [252, 165, 165]; // #FCA5A5 — dernier jour
  const ratio = dureeRegles > 1 ? (dayInPeriod - 1) / (dureeRegles - 1) : 0;
  const rgb = start.map((s, i) => Math.round(s + (end[i] - s) * ratio));
  return {
    bg: `rgb(${rgb.join(",")})`,
    text: ratio < 0.55 ? "#FFFFFF" : "#1E293B",
  };
}

function dayStatus(dayNum, info, dureeRegles) {
  if (dayNum <= dureeRegles) return "regles";
  if (dayNum === info.ovulationDay) return "ovulation";
  if (dayNum >= info.fertileStart && dayNum <= info.fertileEnd) return "fertile";
  return "normal";
}

// Style du badge de phase dans l'en-tête, en cohérence avec les couleurs
// déjà utilisées pour les jours du calendrier (STATUS_STYLES / periodColor).
function phaseBadgeStyle(phaseKey) {
  switch (phaseKey) {
    case "regles":
      return "bg-[#FEE2E2] text-[#B91C1C]";
    case "ovulation":
      return "bg-[#0F766E] text-white";
    case "fertile":
      return "bg-[#CCFBF1] text-[#0F766E] ring-1 ring-[#0D9488]";
    default: // folliculaire / luteale
      return "bg-[#FCE4ED] text-[#E1396C]";
  }
}

export default function CycleHome() {
  const { t } = useLanguage();
  const { settings, loading: settingsLoading, saveSettings } = useCycleSettings();
  const { confirmerGrossesse } = useGrossesse();
  const ddr = settings.ddr || "2026-09-01";
  const dureeRegles = settings.dureeRegles;
  const longueurCycle = settings.longueurCycle;

  const SYMPTOMES = [
    t("home.symptomDouleurs"),
    t("home.symptomFatigue"),
    t("home.symptomCephalees"),
    t("home.symptomBallonnements"),
    t("home.symptomHumeur"),
    t("home.symptomMastodynie"),
  ];

  const PHASE_LABELS = {
    regles: t("home.phaseRegles"),
    ovulation: t("home.phaseOvulation"),
    fertile: t("home.phaseFertile"),
    folliculaire: t("home.phaseFolliculaire"),
    luteale: t("home.phaseLuteale"),
  };

  const [monthOffset, setMonthOffset] = useState(0);
  const [selectedDay, setSelectedDay] = useState(null);
  const [symptomPickerOpen, setSymptomPickerOpen] = useState(false);
  const [confirmPeriodOpen, setConfirmPeriodOpen] = useState(false);
  const [confirmGrossesseOpen, setConfirmGrossesseOpen] = useState(false);
  const [grossesseError, setGrossesseError] = useState(null);

  const today = new Date();
  const viewDate = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);

  const { events } = useMonthEvents(viewDate.getFullYear(), viewDate.getMonth());
  const rapportsByDate = useMemo(() => {
    const map = new Map();
    events.filter((e) => e.type === "rapport").forEach((e) => map.set(e.date, e.id));
    return map;
  }, [events]);

  const info = useMemo(
    () => buildCycleInfo({ ddr, dureeRegles, longueurCycle, today: new Date() }),
    [ddr, dureeRegles, longueurCycle]
  );
  const monthLabel = viewDate.toLocaleDateString(t("home.monthLocale"), { month: "long", year: "numeric" });
  const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
  const firstWeekday = (new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).getDay() + 6) % 7;

  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  async function toggleRapport(dateKey) {
    const existingId = rapportsByDate.get(dateKey);
    if (existingId) {
      await removeEvent(existingId);
    } else {
      await addEvent({ type: "rapport", date: dateKey });
    }
  }

  async function logSymptom(label) {
    await addEvent({ type: "symptome", date: todayISO(), label });
    setSymptomPickerOpen(false);
  }

  async function confirmPeriodStartToday() {
    await saveSettings({ ddr: todayISO() });
    setConfirmPeriodOpen(false);
  }

  async function confirmGrossesseStart() {
    setGrossesseError(null);
    try {
      // La DDG retenue est la DDR du cycle en cours.
      await confirmerGrossesse(ddr);
      setConfirmGrossesseOpen(false);
    } catch (err) {
      // On garde la modale ouverte et on affiche l'erreur au lieu de la
      // laisser échouer silencieusement (ex: règles Firestore, hors-ligne).
      setGrossesseError(err.message);
    }
  }

  function cycleDayForDate(d) {
    const dt = new Date(viewDate.getFullYear(), viewDate.getMonth(), d);
    const raw = (diffInDays(new Date(ddr), dt) % longueurCycle + longueurCycle) % longueurCycle + 1;
    return raw;
  }

  return (
    <div className="w-full max-w-2xl mx-auto bg-[#FBF5F7] text-[#1E293B] font-sans">
      {/* En-tête : lecture directe du jour de cycle et de la phase */}
      <div className="px-4 sm:px-6 page-header pb-6 bg-gradient-to-b from-[#FDE7F0] to-[#FBF5F7]">
        <div className="flex items-center justify-between mb-6">
          <span className="text-xs font-medium tracking-wide uppercase text-[#64748B]">{t("home.kicker")}</span>
          <Calendar size={16} className="text-[#E1396C]" />
        </div>
        <div className="flex items-baseline gap-3">
          <span className="text-5xl sm:text-6xl leading-none font-mono tabular-nums">J{info.cycleDay}</span>
          <div>
            <p className="text-sm text-[#64748B]">{t("home.cycleDayUnit", { n: longueurCycle })}</p>
            <span
              className={`inline-block mt-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${phaseBadgeStyle(
                info.phaseKey
              )}`}
            >
              {PHASE_LABELS[info.phaseKey]}
            </span>
          </div>
        </div>
        <p className="mt-4 text-sm text-[#64748B]">
          {t("home.nextPeriodBefore")}{" "}
          <span className="text-[#1E293B] font-medium font-mono tabular-nums">
            {info.daysUntilNextPeriod} {t("home.daysUnit")}
          </span>
        </p>
      </div>

      {/* Calendrier */}
      <div className="px-4 sm:px-6 py-5">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => setMonthOffset((m) => m - 1)} className="p-2.5 -m-1.5 text-[#64748B] active:text-[#1E293B] active:bg-[#FBE8F0] rounded-full">
            <ChevronLeft size={18} />
          </button>
          <span className="text-sm font-medium capitalize">{monthLabel}</span>
          <button onClick={() => setMonthOffset((m) => m + 1)} className="p-2.5 -m-1.5 text-[#64748B] active:text-[#1E293B] active:bg-[#FBE8F0] rounded-full">
            <ChevronRight size={18} />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 mb-2">
          {t("home.weekdays").map((d, i) => (
            <span key={i} className="text-[11px] text-center text-[#94A3B8]">{d}</span>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {cells.map((d, idx) => {
            if (!d) return <div key={idx} />;
            const cycleDay = cycleDayForDate(d);
            const status = dayStatus(cycleDay, info, dureeRegles);
            const dateKey = `${viewDate.getFullYear()}-${String(viewDate.getMonth() + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
            const hasRapport = rapportsByDate.has(dateKey);
            const isToday =
              d === today.getDate() &&
              viewDate.getMonth() === today.getMonth() &&
              viewDate.getFullYear() === today.getFullYear();
            const fertPct = fertilityForCycleDay(cycleDay, info.ovulationDay);
            const isRegles = status === "regles";
            const periodStyle = isRegles ? periodColor(cycleDay, dureeRegles) : null;

            return (
              <div key={idx} className="flex flex-col items-center gap-1">
                <button
                  onClick={() => setSelectedDay({ d, cycleDay, dateKey })}
                  className={`relative aspect-square w-full rounded-full text-xs flex items-center justify-center font-mono tabular-nums ${
                    isRegles ? "" : STATUS_STYLES[status]
                  } ${isToday ? "outline outline-1 outline-[#1E293B]" : ""} ${
                    selectedDay?.dateKey === dateKey ? "ring-2 ring-[#E1396C]" : ""
                  }`}
                  style={isRegles ? { backgroundColor: periodStyle.bg, color: periodStyle.text } : undefined}
                >
                  {d}
                  {hasRapport && (
                    <Heart size={8} className="absolute -bottom-0.5 -right-0.5 text-[#BE185D] fill-[#BE185D]" />
                  )}
                </button>
                {/* Indicateur de probabilité de conception du jour */}
                <div className="w-3/5 h-[3px] rounded-full bg-[#FCE4ED]">
                  <div
                    className="h-full rounded-full bg-[#0D9488]"
                    style={{ width: `${Math.min((fertPct / 33) * 100, 100)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-4 mt-4 text-[11px] text-[#64748B]">
          <span className="flex items-center gap-1">
            <span
              className="w-2 h-2 rounded-full inline-block"
              style={{ background: "linear-gradient(135deg, #7F1D1D, #FCA5A5)" }}
            />
            {t("home.legendRegles")}
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#CCFBF1] ring-1 ring-[#0D9488] inline-block" /> {t("home.legendFertile")}
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#0F766E] inline-block" /> {t("home.legendOvulation")}
          </span>
        </div>

        {selectedDay && (
          <div className="mt-4 bg-white rounded-2xl p-4 flex items-center justify-between shadow-sm border border-[#F0DCE4]">
            <div>
              <p className="text-[11px] text-[#94A3B8]">{t("home.selectedDayCycleDay", { day: selectedDay.cycleDay })}</p>
              <p className="text-lg font-mono tabular-nums">
                {t("home.conceptionProbability", {
                  pct: fertilityForCycleDay(selectedDay.cycleDay, info.ovulationDay).toFixed(1),
                })}
              </p>
            </div>
            <button
              onClick={() => toggleRapport(selectedDay.dateKey)}
              className="p-2 rounded-full bg-[#FCE4ED] active:bg-[#F9C8DA]"
              aria-label={t("home.logRapportAria")}
            >
              <Heart
                size={16}
                className={
                  rapportsByDate.has(selectedDay.dateKey)
                    ? "text-[#BE185D] fill-[#BE185D]"
                    : "text-[#94A3B8]"
                }
              />
            </button>
          </div>
        )}
      </div>

      {/* Saisie rapide */}
      <div className="px-4 sm:px-6 pt-2">
        <div className="grid grid-cols-3 gap-3">
          <button
            onClick={() => setConfirmPeriodOpen(true)}
            className="flex flex-col items-center gap-2 py-4 rounded-2xl bg-white active:bg-[#FBE8F0] transition-colors shadow-sm border border-[#F0DCE4]"
          >
            <Droplet size={18} className="text-[#B91C1C]" />
            <span className="text-[11px] text-[#64748B]">{t("home.quickPeriod")}</span>
          </button>
          <button
            onClick={() => toggleRapport(todayISO())}
            className="flex flex-col items-center gap-2 py-4 rounded-2xl bg-white active:bg-[#FBE8F0] transition-colors shadow-sm border border-[#F0DCE4]"
          >
            <Heart
              size={18}
              className={
                rapportsByDate.has(todayISO())
                  ? "text-[#BE185D] fill-[#BE185D]"
                  : "text-[#64748B]"
              }
            />
            <span className="text-[11px] text-[#64748B]">{t("home.quickRapport")}</span>
          </button>
          <button
            onClick={() => setSymptomPickerOpen(true)}
            className="flex flex-col items-center gap-2 py-4 rounded-2xl bg-white active:bg-[#FBE8F0] transition-colors shadow-sm border border-[#F0DCE4]"
          >
            <ClipboardList size={18} className="text-[#B45309]" />
            <span className="text-[11px] text-[#64748B]">{t("home.quickSymptom")}</span>
          </button>
        </div>
        <button
          onClick={() => setConfirmGrossesseOpen(true)}
          className="mt-3 w-full flex items-center justify-center gap-2 py-3 text-[12px] text-[#BE185D] active:text-[#9D174D]"
        >
          <Baby size={14} />
          {t("home.confirmGrossesseLink")}
        </button>
      </div>

      {/* Sélection de symptôme */}
      {symptomPickerOpen && (
        <div className="fixed inset-0 bg-black/30 flex items-end justify-center z-[70]" onClick={() => setSymptomPickerOpen(false)}>
          <div
            className="w-full max-w-2xl bg-white rounded-t-3xl p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sheet-handle" />
            <div className="flex items-center justify-between mb-4">
              <p className="text-base font-medium">{t("home.symptomPickerTitle")}</p>
              <button onClick={() => setSymptomPickerOpen(false)} className="p-1 -m-1 text-[#94A3B8]">
                <X size={18} />
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {SYMPTOMES.map((s) => (
                <button
                  key={s}
                  onClick={() => logSymptom(s)}
                  className="px-4 py-2 rounded-full bg-[#FBF5F7] text-sm text-[#1E293B] active:bg-[#FCE4ED] border border-[#F0DCE4]"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Confirmation de début de règles */}
      {confirmPeriodOpen && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-[70] px-6" onClick={() => setConfirmPeriodOpen(false)}>
          <div className="w-full max-w-sm bg-white rounded-2xl p-6" onClick={(e) => e.stopPropagation()}>
            <p className="text-base font-medium mb-2">{t("home.confirmPeriodTitle")}</p>
            <p className="text-sm text-[#64748B] mb-5">{t("home.confirmPeriodBody")}</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmPeriodOpen(false)}
                className="flex-1 py-3 rounded-xl bg-[#FBF5F7] text-sm text-[#64748B] border border-[#F0DCE4]"
              >
                {t("home.cancel")}
              </button>
              <button
                onClick={confirmPeriodStartToday}
                className="flex-1 py-3 rounded-xl bg-[#E1396C] text-sm text-white active:bg-[#B91856]"
              >
                {t("home.confirm")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation de grossesse */}
      {confirmGrossesseOpen && (
        <div
          className="fixed inset-0 bg-black/30 flex items-center justify-center z-[70] px-6"
          onClick={() => setConfirmGrossesseOpen(false)}
        >
          <div className="w-full max-w-sm bg-white rounded-2xl p-6" onClick={(e) => e.stopPropagation()}>
            <p className="text-base font-medium mb-2">{t("home.confirmGrossesseTitle")}</p>
            <p className="text-sm text-[#64748B] mb-5">{t("home.confirmGrossesseBody", { ddr })}</p>
            {grossesseError && (
              <p className="text-[12px] text-[#B91C1C] mb-3">{t("home.grossesseFailed", { error: grossesseError })}</p>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmGrossesseOpen(false)}
                className="flex-1 py-3 rounded-xl bg-[#FBF5F7] text-sm text-[#64748B] border border-[#F0DCE4]"
              >
                {t("home.cancel")}
              </button>
              <button
                onClick={confirmGrossesseStart}
                className="flex-1 py-3 rounded-xl bg-[#BE185D] text-sm text-white active:bg-[#9D174D]"
              >
                {t("home.confirm")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
