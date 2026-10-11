import {
  Info,
  Eye,
  CircleDot,
  AlignJustify,
  PieChart,
  Droplet,
  Calendar,
  AlertTriangle,
  ScanLine,
  Waves,
  Microscope,
  CalendarClock,
  ClipboardList,
  Stethoscope,
  ArrowLeft,
} from "lucide-react";
import { useLanguage } from "./i18n/LanguageContext";

// ============================================================
// AUTOPALPATION MAMMAIRE — guide d'auto-examen des seins
// ============================================================
// Contenu à visée éducative uniquement : rappelle la technique
// (inspection + palpation selon 3 motifs usuels) et les signes
// d'alerte devant amener à consulter. Ne remplace pas le dépistage
// organisé (mammographie) ni un avis médical.

function SectionLabel({ icon, children, hint, badgeClass = "bg-[#FCE4ED]" }) {
  return (
    <div className="mb-2.5">
      <div className="flex items-center gap-2.5">
        <div className={`w-7 h-7 rounded-lg ${badgeClass} flex items-center justify-center shrink-0`}>
          {icon}
        </div>
        <h2 className="text-[15px] font-semibold text-[#5C1832] tracking-tight">{children}</h2>
      </div>
      {hint && <p className="text-[11px] text-[#94A3B8] mt-1 ml-[38px] leading-relaxed">{hint}</p>}
    </div>
  );
}

// ---------- Schémas de palpation (abstraits, non anatomiques) ----------
// Chaque schéma représente le sein par un simple cercle et illustre le
// trajet des doigts selon l'un des 3 motifs recommandés.

function DiagramSpirale() {
  return (
    <svg viewBox="0 0 120 120" className="w-24 h-24">
      <circle cx="60" cy="60" r="52" fill="#FBF5F7" stroke="#F0DCE4" strokeWidth="2" />
      {[46, 36, 26, 16].map((r, i) => (
        <circle
          key={i}
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke="#E1396C"
          strokeWidth="2.5"
          strokeDasharray="4 3"
          opacity={0.9 - i * 0.15}
        />
      ))}
      <circle cx="60" cy="60" r="4" fill="#E1396C" />
    </svg>
  );
}

function DiagramBandes() {
  return (
    <svg viewBox="0 0 120 120" className="w-24 h-24">
      <circle cx="60" cy="60" r="52" fill="#FBF5F7" stroke="#F0DCE4" strokeWidth="2" />
      {[24, 42, 60, 78, 96].map((x, i) => (
        <line
          key={i}
          x1={x}
          y1="18"
          x2={x}
          y2="102"
          stroke="#E1396C"
          strokeWidth="2.5"
          strokeDasharray="4 3"
          opacity={0.5 + (i % 2) * 0.3}
        />
      ))}
    </svg>
  );
}

function DiagramRayons() {
  return (
    <svg viewBox="0 0 120 120" className="w-24 h-24">
      <circle cx="60" cy="60" r="52" fill="#FBF5F7" stroke="#F0DCE4" strokeWidth="2" />
      {Array.from({ length: 8 }).map((_, i) => {
        const angle = (i * Math.PI) / 4;
        const x2 = 60 + 48 * Math.cos(angle);
        const y2 = 60 + 48 * Math.sin(angle);
        return (
          <line
            key={i}
            x1="60"
            y1="60"
            x2={x2}
            y2={y2}
            stroke="#E1396C"
            strokeWidth="2.5"
            strokeDasharray="4 3"
          />
        );
      })}
      <circle cx="60" cy="60" r="4" fill="#E1396C" />
    </svg>
  );
}

function ExamCard({ exam, labels }) {
  const rows = [
    { label: labels.rowAge, value: exam.age, icon: <CalendarClock size={13} className="text-[#94A3B8]" /> },
    {
      label: labels.rowIndications,
      value: exam.indications,
      icon: <ClipboardList size={13} className="text-[#94A3B8]" />,
    },
    {
      label: labels.rowPeriodicite,
      value: exam.periodicite,
      icon: <Calendar size={13} className="text-[#94A3B8]" />,
    },
    {
      label: labels.rowResultats,
      value: exam.resultats,
      icon: <Stethoscope size={13} className="text-[#94A3B8]" />,
    },
  ];
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#F0DCE4] space-y-3">
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg bg-[#FCE4ED] flex items-center justify-center shrink-0">
          {exam.icon}
        </div>
        <p className="text-[14px] font-semibold text-[#5C1832] tracking-tight">{exam.titre}</p>
      </div>
      <div className="space-y-2.5">
        {rows.map((r) => (
          <div key={r.label} className="flex gap-2">
            <div className="flex items-center gap-1.5 w-[110px] shrink-0 pt-0.5">
              {r.icon}
              <p className="text-[11px] font-medium text-[#64748B]">{r.label}</p>
            </div>
            <p className="text-[12px] text-[#1E293B] leading-relaxed">{r.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CycleSelfExam({ onBack }) {
  const { t } = useLanguage();

  const MOTIFS = [
    {
      key: "spirale",
      icon: <CircleDot size={14} className="text-[#E1396C]" />,
      titre: t("selfexam.motifSpiraleTitre"),
      diagram: <DiagramSpirale />,
      desc: t("selfexam.motifSpiraleDesc"),
    },
    {
      key: "bandes",
      icon: <AlignJustify size={14} className="text-[#E1396C]" />,
      titre: t("selfexam.motifBandesTitre"),
      diagram: <DiagramBandes />,
      desc: t("selfexam.motifBandesDesc"),
    },
    {
      key: "rayons",
      icon: <PieChart size={14} className="text-[#E1396C]" />,
      titre: t("selfexam.motifRayonsTitre"),
      diagram: <DiagramRayons />,
      desc: t("selfexam.motifRayonsDesc"),
    },
  ];

  const EXAMS = [
    {
      key: "mammographie",
      icon: <ScanLine size={16} className="text-[#E1396C]" />,
      titre: t("selfexam.mammoTitre"),
      age: t("selfexam.mammoAge"),
      indications: t("selfexam.mammoIndications"),
      periodicite: t("selfexam.mammoPeriodicite"),
      resultats: t("selfexam.mammoResultats"),
    },
    {
      key: "echographie",
      icon: <Waves size={16} className="text-[#E1396C]" />,
      titre: t("selfexam.echoTitre"),
      age: t("selfexam.echoAge"),
      indications: t("selfexam.echoIndications"),
      periodicite: t("selfexam.echoPeriodicite"),
      resultats: t("selfexam.echoResultats"),
    },
    {
      key: "frottis",
      icon: <Microscope size={16} className="text-[#E1396C]" />,
      titre: t("selfexam.frottisTitre"),
      age: t("selfexam.frottisAge"),
      indications: t("selfexam.frottisIndications"),
      periodicite: t("selfexam.frottisPeriodicite"),
      resultats: t("selfexam.frottisResultats"),
    },
  ];

  const rowLabels = {
    rowAge: t("selfexam.rowAge"),
    rowIndications: t("selfexam.rowIndications"),
    rowPeriodicite: t("selfexam.rowPeriodicite"),
    rowResultats: t("selfexam.rowResultats"),
  };

  const alerts = [
    t("selfexam.alert1"),
    t("selfexam.alert2"),
    t("selfexam.alert3"),
    t("selfexam.alert4"),
    t("selfexam.alert5"),
    t("selfexam.alert6"),
    t("selfexam.alert7"),
  ];

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
          <CircleDot size={14} className="text-[#E1396C]" />
          <p className="text-xs font-medium tracking-wide text-[#E1396C]">{t("selfexam.kicker")}</p>
        </div>
        <h1 className="text-2xl font-semibold">{t("selfexam.title")}</h1>
        <p className="text-sm text-[#64748B] mt-2 leading-relaxed max-w-md">{t("selfexam.intro")}</p>
      </div>

      <div className="px-4 sm:px-6 py-5 space-y-6">
        {/* Avertissement */}
        <div className="flex gap-3 bg-[#FEF3C7] text-[#92400E] rounded-2xl p-4">
          <Info size={16} className="shrink-0 mt-0.5" />
          <p className="text-[12px] leading-relaxed">{t("selfexam.disclaimer")}</p>
        </div>

        {/* Quand la faire */}
        <div>
          <SectionLabel icon={<Calendar size={14} className="text-[#E1396C]" />}>
            {t("selfexam.whenTitle")}
          </SectionLabel>
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#F0DCE4] space-y-2">
            <p className="text-[13px] leading-relaxed">
              {t("selfexam.whenP1Before")} <span className="font-medium">{t("selfexam.whenP1Bold")}</span>
              {t("selfexam.whenP1After")}
            </p>
            <p className="text-[13px] leading-relaxed text-[#64748B]">{t("selfexam.whenP2")}</p>
          </div>
        </div>

        {/* Étape 1 — Inspection visuelle */}
        <div>
          <SectionLabel icon={<Eye size={14} className="text-[#E1396C]" />} hint={t("selfexam.step1Hint")}>
            {t("selfexam.step1Title")}
          </SectionLabel>
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#F0DCE4] space-y-2">
            <p className="text-[13px] leading-relaxed">{t("selfexam.step1P1")}</p>
            <p className="text-[13px] leading-relaxed text-[#64748B]">{t("selfexam.step1P2")}</p>
          </div>
        </div>

        {/* Étape 2 — Palpation */}
        <div>
          <SectionLabel icon={<CircleDot size={14} className="text-[#E1396C]" />} hint={t("selfexam.step2Hint")}>
            {t("selfexam.step2Title")}
          </SectionLabel>
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#F0DCE4] space-y-4">
            <p className="text-[13px] leading-relaxed">{t("selfexam.step2Intro")}</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {MOTIFS.map((m) => (
                <div
                  key={m.key}
                  className="flex flex-col items-center text-center gap-2 bg-[#FBF5F7] rounded-xl p-3 border border-[#F0DCE4]"
                >
                  {m.diagram}
                  <div className="flex items-center gap-1.5">
                    {m.icon}
                    <p className="text-[12.5px] font-semibold text-[#5C1832]">{m.titre}</p>
                  </div>
                  <p className="text-[11px] text-[#64748B] leading-relaxed">{m.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Étape 3 — Mamelon et aisselles */}
        <div>
          <SectionLabel icon={<Droplet size={14} className="text-[#E1396C]" />}>
            {t("selfexam.step3Title")}
          </SectionLabel>
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#F0DCE4] space-y-2">
            <p className="text-[13px] leading-relaxed">{t("selfexam.step3P1")}</p>
            <p className="text-[13px] leading-relaxed">{t("selfexam.step3P2")}</p>
          </div>
        </div>

        {/* Examens de dépistage complémentaires */}
        <div>
          <SectionLabel icon={<Stethoscope size={14} className="text-[#E1396C]" />} hint={t("selfexam.examsHint")}>
            {t("selfexam.examsTitle")}
          </SectionLabel>
          <div className="space-y-3">
            {EXAMS.map((exam) => (
              <ExamCard key={exam.key} exam={exam} labels={rowLabels} />
            ))}
          </div>
        </div>

        {/* Signes d'alerte */}
        <div>
          <SectionLabel icon={<AlertTriangle size={14} className="text-[#B91C1C]" />} badgeClass="bg-[#FEE2E2]">
            {t("selfexam.alertTitle")}
          </SectionLabel>
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#F0DCE4] space-y-1">
            {alerts.map((s, i) => (
              <p key={i} className="text-[13px] text-[#1E293B]">• {s}</p>
            ))}
            <p className="text-[12px] text-[#64748B] pt-2">{t("selfexam.alertFooter")}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
