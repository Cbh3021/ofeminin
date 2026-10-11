import { useState, useEffect } from "react";
import { TestTube2, Check, AlertTriangle, Stethoscope, Users, FlaskConical, Info, ArrowLeft } from "lucide-react";
import { useHealthProfile } from "./useCycleData";
import { useLanguage } from "./i18n/LanguageContext";

// ============================================================
// BILAN MASCULIN — spermogramme (nomenclature OMS 2021)
// ============================================================
// NOTE I18N : comme pour CycleProfile.jsx, les termes diagnostiques générés
// (classify, buildExplorations, buildTreatmentOrientation) restent en
// français quelle que soit la langue de l'interface — logique clinique
// comparée par égalité de chaîne, non refactorée pour l'instant. Le reste de
// l'écran (libellés, champs, boutons) est trilingue.

// Seuils de référence OMS (manuel de laboratoire pour l'examen du sperme
// humain, 6e édition, 2021) pour le spermogramme de base, complétés par des
// tests spécialisés (immunologiques, biochimiques) de seconde intention.
//
// type "min"   → normal si valeur >= min
// type "max"   → normal si valeur < max
// type "range" → normal si min <= valeur <= max
function isNormal(value, c) {
  if (c.type === "min") return value >= c.min;
  if (c.type === "max") return value < c.max;
  if (c.type === "range") return value >= c.min && value <= c.max;
  return null;
}

function seuilLabel(c) {
  if (c.type === "min") return `≥ ${c.min} ${c.unit}`;
  if (c.type === "max") return `< ${c.max} ${c.unit}`;
  if (c.type === "range") return `${c.min}–${c.max} ${c.unit}`;
  return "";
}

// ---------- Classification diagnostique (nomenclature standard d'andrologie) ----------
// Grades de sévérité indicatifs (bandes usuelles en pratique, à ajuster selon
// le laboratoire et le contexte clinique).
function classify(s) {
  const dx = []; // { term, severity, detail }

  // Volume
  if (s.volume != null) {
    if (s.volume === 0) dx.push({ term: "Aspermie", severity: null, detail: "absence d'éjaculat" });
    else if (s.volume < 1.4) dx.push({ term: "Hypospermie", severity: null, detail: `volume ${s.volume} mL` });
    else if (s.volume > 6) dx.push({ term: "Hyperspermie", severity: null, detail: `volume ${s.volume} mL` });
  }

  // Numération
  if (s.concentration != null) {
    const c = s.concentration;
    if (c === 0) {
      dx.push({ term: "Azoospermie", severity: null, detail: "aucun spermatozoïde retrouvé" });
    } else if (c < 0.1) {
      dx.push({ term: "Cryptozoospermie", severity: null, detail: "spermatozoïdes rares, visibles seulement après centrifugation" });
    } else if (c < 16) {
      let sev = c < 5 ? "sévère" : c < 10 ? "modérée" : "légère";
      dx.push({ term: "Oligozoospermie", severity: sev, detail: `${c} M/mL` });
    }
  }

  // Mobilité
  if (s.progressiveMotility != null && s.progressiveMotility < 30) {
    const pm = s.progressiveMotility;
    let sev = pm < 10 ? "sévère" : pm < 20 ? "modérée" : "légère";
    dx.push({ term: "Asthénozoospermie", severity: sev, detail: `mobilité progressive ${pm}%` });
  }

  // Morphologie
  if (s.morphology != null && s.morphology < 4) {
    const m = s.morphology;
    let sev = m < 1 ? "sévère" : m < 2 ? "modérée" : "légère";
    dx.push({ term: "Tératozoospermie", severity: sev, detail: `formes normales ${m}%` });
  }

  // Vitalité
  if (s.vitality != null && s.vitality < 54) {
    dx.push({ term: "Nécrozoospermie (à confirmer)", severity: s.vitality < 40 ? "sévère" : "modérée", detail: `vitalité ${s.vitality}%` });
  }

  // OAT combiné
  const hasOligo = dx.some((d) => d.term === "Oligozoospermie");
  const hasAstheno = dx.some((d) => d.term === "Asthénozoospermie");
  const hasTerato = dx.some((d) => d.term === "Tératozoospermie");
  if (hasOligo && hasAstheno && hasTerato) {
    dx.push({ term: "Syndrome OAT (oligo-asthéno-tératozoospermie)", severity: null, detail: "association des 3 anomalies" });
  }

  // Leucospermie
  if (s.peroxidaseLeukocytes != null && s.peroxidaseLeukocytes >= 1.0) {
    dx.push({ term: "Leucospermie", severity: null, detail: `${s.peroxidaseLeukocytes} M/mL` });
  }

  // Anticorps anti-spermatozoïdes
  if ((s.marTest != null && s.marTest >= 50) || (s.immunobead != null && s.immunobead >= 50)) {
    dx.push({ term: "Auto-immunisation anti-spermatozoïdes", severity: null, detail: "MAR test / Immunobead positif" });
  }

  // Marqueurs sécrétoires
  if (
    (s.phosphataseAcide != null && s.phosphataseAcide < 200) ||
    (s.acideCitrique != null && s.acideCitrique < 52) ||
    (s.zinc != null && s.zinc < 2.4)
  ) {
    dx.push({ term: "Hypofonction sécrétoire prostatique", severity: null, detail: "phosphatase acide / acide citrique / zinc bas" });
  }
  if (s.fructose != null && s.fructose < 13) {
    dx.push({ term: "Hypofonction des vésicules séminales", severity: null, detail: "fructose séminal bas" });
  }
  if (
    (s.glucosidase != null && s.glucosidase < 20) ||
    (s.carnitine != null && (s.carnitine < 0.8 || s.carnitine > 2.9))
  ) {
    dx.push({ term: "Dysfonction épididymaire", severity: null, detail: "glucosidase neutre / L-carnitine anormales" });
  }

  if (dx.length === 0 && s.concentration != null) {
    dx.push({ term: "Normozoospermie", severity: null, detail: "tous les paramètres de base dans les normes OMS" });
  }

  return dx;
}

// ---------- Explorations complémentaires suggérées ----------
function buildExplorations(s, dx) {
  const ex = new Set();
  const has = (term) => dx.some((d) => d.term === term);

  if (has("Azoospermie") || has("Cryptozoospermie") || (has("Oligozoospermie") && dx.find((d) => d.term === "Oligozoospermie")?.severity === "sévère")) {
    ex.add("Bilan hormonal : FSH, LH, testostérone, prolactine");
    ex.add("Échographie scrotale ± endorectale");
    ex.add("Caryotype ± recherche de microdélétions du chromosome Y");
  }
  if (has("Leucospermie")) {
    ex.add("Spermoculture + ECBU, bilan infectieux/IST");
  }
  if (has("Auto-immunisation anti-spermatozoïdes")) {
    ex.add("Bilan immunologique complémentaire, discuter technique de préparation spermatique adaptée");
  }
  if (has("Nécrozoospermie (à confirmer)")) {
    ex.add("Spermoculture, éliminer une cause épididymaire ou infectieuse");
  }
  if (has("Tératozoospermie")) {
    ex.add("Rechercher varicocèle, cause toxique/environnementale (tabac, chaleur, exposition professionnelle)");
  }
  if (has("Hypofonction des vésicules séminales") || (s.volume != null && s.volume < 1.4 && s.ph != null && s.ph < 7.2)) {
    ex.add("Échographie endorectale (recherche d'agénésie/obstruction des vésicules séminales), envisager étude du gène CFTR");
  }
  if (has("Hypofonction sécrétoire prostatique") || has("Dysfonction épididymaire")) {
    ex.add("Échographie endorectale, avis andrologique pour bilan sécrétoire complet");
  }

  return Array.from(ex);
}

// ---------- Orientation thérapeutique (AMP) ----------
function buildTreatmentOrientation(s, dx) {
  const has = (term) => dx.some((d) => d.term === term);
  const severityOf = (term) => dx.find((d) => d.term === term)?.severity;

  if (has("Azoospermie")) {
    if (s.fsh != null && s.volumeTesticulaire != null) {
      if (s.fsh > 10 || s.volumeTesticulaire < 12) {
        return {
          type: "Azoospermie non obstructive probable",
          detail: "FSH élevée et/ou volume testiculaire réduit : orientation vers prélèvement chirurgical (TESE/micro-TESE) + ICSI ; discuter don de sperme selon le résultat.",
        };
      }
      return {
        type: "Azoospermie obstructive probable",
        detail: "FSH et volume testiculaire normaux : orientation vers prélèvement épididymaire/testiculaire (PESA/TESE) + ICSI, ou chirurgie de désobstruction selon la cause retrouvée.",
      };
    }
    return {
      type: "Azoospermie — orientation à préciser",
      detail: "Bilan hormonal (FSH) et volume testiculaire nécessaires pour distinguer une origine obstructive (chirurgie/PESA-TESE + ICSI) d'une origine non obstructive (TESE/micro-TESE + ICSI, ± don de sperme).",
    };
  }

  if (severityOf("Oligozoospermie") === "sévère" || severityOf("Asthénozoospermie") === "sévère" || has("Syndrome OAT")) {
    return {
      type: "Anomalie sévère du spermogramme",
      detail: "Orientation habituelle vers ICSI (injection intracytoplasmique de spermatozoïde).",
    };
  }

  if (dx.some((d) => d.severity === "modérée") || dx.some((d) => d.severity === "légère")) {
    return {
      type: "Anomalie(s) légère(s) à modérée(s)",
      detail: "Selon le bilan féminin associé : rapports ciblés, insémination intra-utérine (IIU), ou FIV conventionnelle si l'IIU a échoué ou n'est pas indiquée.",
    };
  }

  if (has("Normozoospermie")) {
    return {
      type: "Spermogramme normal",
      detail: "Ne contre-indique pas une exploration par rapports ciblés ; le bilan féminin guide la suite de la prise en charge.",
    };
  }

  return null;
}

function SectionLabel({ icon, children, hint }) {
  return (
    <div className="mb-3">
      <p className="flex items-center gap-2 text-sm font-medium text-[#334155]">
        {icon}
        {children}
      </p>
      {hint && <p className="text-[11px] text-[#94A3B8] mt-1 leading-relaxed">{hint}</p>}
    </div>
  );
}

// ============================================================
// COMPOSANT
// ============================================================

export default function CyclePartner({ onBack }) {
  const { t } = useLanguage();
  const { profile, loading, saveProfile } = useHealthProfile();

  const [sperm, setSperm] = useState({});
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(null);

  useEffect(() => {
    if (loading) return;
    setSperm(profile.spermogramme ?? {});
  }, [loading, profile]);

  function updateSpermField(key, value) {
    setSperm((prev) => ({ ...prev, [key]: value === "" ? null : parseFloat(value) }));
  }

  async function handleSave() {
    setSaveError(null);
    try {
      // On ne réécrit que le champ spermogramme : le reste du dossier
      // (identité, bilan féminin…) est géré séparément depuis
      // CycleProfile.jsx, sur le même document Firestore (merge:true).
      await saveProfile({ spermogramme: sperm });
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    } catch (err) {
      setSaveError(err.message);
    }
  }

  const dx = classify(sperm);
  const explorations = buildExplorations(sperm, dx);
  const treatment = buildTreatmentOrientation(sperm, dx);

  const SPERM_BASIC = [
    { key: "volume", label: t("partner.fieldVolume"), unit: "mL", type: "min", min: 1.4 },
    { key: "concentration", label: t("partner.fieldConcentration"), unit: "M/mL", type: "min", min: 16 },
    { key: "totalCount", label: t("partner.fieldTotalCount"), unit: "M/éjaculat", type: "min", min: 39 },
    { key: "totalMotility", label: t("partner.fieldTotalMotility"), unit: "%", type: "min", min: 42 },
    { key: "progressiveMotility", label: t("partner.fieldProgressiveMotility"), unit: "%", type: "min", min: 30 },
    { key: "vitality", label: t("partner.fieldVitality"), unit: "%", type: "min", min: 54 },
    { key: "morphology", label: t("partner.fieldMorphology"), unit: "%", type: "min", min: 4 },
    { key: "ph", label: t("partner.fieldPh"), unit: "", type: "min", min: 7.2 },
  ];

  const SPERM_COMPLEMENTAIRE = [
    { key: "marTest", label: t("partner.fieldMarTest"), unit: "%", type: "max", max: 50 },
    { key: "immunobead", label: t("partner.fieldImmunobead"), unit: "%", type: "max", max: 50 },
    { key: "peroxidaseLeukocytes", label: t("partner.fieldPeroxidaseLeukocytes"), unit: "M/mL", type: "max", max: 1.0 },
    { key: "fructose", label: t("partner.fieldFructose"), unit: "µmol/éjac.", type: "min", min: 13 },
    { key: "phosphataseAcide", label: t("partner.fieldPhosphataseAcide"), unit: "U/éjac.", type: "min", min: 200 },
    { key: "acideCitrique", label: t("partner.fieldAcideCitrique"), unit: "µmol/éjac.", type: "min", min: 52 },
    { key: "zinc", label: t("partner.fieldZinc"), unit: "µmol/éjac.", type: "min", min: 2.4 },
    { key: "glucosidase", label: t("partner.fieldGlucosidase"), unit: "mU/éjac.", type: "min", min: 20 },
    { key: "carnitine", label: t("partner.fieldCarnitine"), unit: "µmol/éjac.", type: "range", min: 0.8, max: 2.9 },
  ];

  function renderCriteriaGroup(criteria) {
    return criteria.map((c) => {
      const raw = sperm[c.key];
      const hasValue = raw !== null && raw !== undefined && raw !== "";
      const normal = hasValue && isNormal(raw, c);
      return (
        <div key={c.key} className="flex items-center gap-3">
          <div className="flex-1">
            <label className="text-[12px] text-[#1E293B]">{c.label}</label>
            <p className="text-[10px] text-[#94A3B8]">{t("partner.thresholdLabel", { threshold: seuilLabel(c) })}</p>
          </div>
          <input
            type="number"
            step="0.1"
            value={raw ?? ""}
            onChange={(e) => updateSpermField(c.key, e.target.value)}
            className="w-20 bg-[#FBF5F7] border border-[#F0DCE4] rounded-lg px-2 py-2 text-[#1E293B] text-center outline-none focus:border-[#E1396C]"
          />
          <div className="w-6 flex justify-center">
            {hasValue ? (
              normal ? (
                <Check size={16} className="text-[#15803D]" />
              ) : (
                <AlertTriangle size={16} className="text-[#B91C1C]" />
              )
            ) : null}
          </div>
        </div>
      );
    });
  }

  function renderDxBlock(title, icon, dxList, explorationsList, orientation) {
    if (!dxList || dxList.length === 0) return null;
    return (
      <div>
        <SectionLabel icon={icon}>{title}</SectionLabel>
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#F0DCE4] space-y-4">
          <div>
            <p className="text-[11px] text-[#94A3B8] mb-2">{t("partner.dxRetenu")}</p>
            <div className="space-y-1.5">
              {dxList.map((d, i) => (
                <p key={i} className="text-[13px] text-[#1E293B]">
                  <span className="font-medium">{d.term}</span>
                  {d.severity ? <span className="text-[#B91C1C]"> — {d.severity}</span> : null}
                  <span className="text-[#94A3B8]"> ({d.detail})</span>
                </p>
              ))}
            </div>
          </div>

          {explorationsList.length > 0 && (
            <div className="pt-3 border-t border-[#F0DCE4]">
              <p className="text-[11px] text-[#94A3B8] mb-2">{t("partner.explorationsLabel")}</p>
              <div className="space-y-1">
                {explorationsList.map((e, i) => (
                  <p key={i} className="text-[12px] text-[#1E293B]">• {e}</p>
                ))}
              </div>
            </div>
          )}

          {orientation && (
            <div className="pt-3 border-t border-[#F0DCE4]">
              <p className="text-[11px] text-[#94A3B8] mb-1">{t("partner.orientationLabel")}</p>
              <p className="text-[13px] text-[#1E293B] font-medium">{orientation.type}</p>
              <p className="text-[12px] text-[#1E293B] mt-0.5">{orientation.detail}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

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
          <Users size={14} className="text-[#E1396C]" />
          <p className="text-xs font-medium tracking-wide text-[#E1396C]">{t("partner.kicker")}</p>
        </div>
        <h1 className="text-2xl font-semibold">{t("partner.title")}</h1>
        <p className="text-sm text-[#64748B] mt-2 leading-relaxed max-w-md">{t("partner.intro")}</p>
      </div>

      <div className="px-4 sm:px-6 py-5 space-y-6">
        {/* Mention de non-substitution à un avis médical : ce bilan pose de
            vrais termes diagnostiques (azoospermie, OAT, etc.). */}
        <div className="flex gap-3 bg-[#FEF3C7] text-[#92400E] rounded-2xl p-4">
          <Info size={16} className="shrink-0 mt-0.5" />
          <p className="text-[12px] leading-relaxed">{t("partner.disclaimer")}</p>
        </div>

        {/* Spermogramme de base */}
        <div>
          <SectionLabel icon={<TestTube2 size={14} className="text-[#E1396C]" />} hint={t("partner.spermogramHint")}>
            {t("partner.spermogramTitle")}
          </SectionLabel>
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#F0DCE4] space-y-3">
            {renderCriteriaGroup(SPERM_BASIC)}
          </div>
        </div>

        {/* Tests complémentaires */}
        <div>
          <SectionLabel icon={<FlaskConical size={14} className="text-[#E1396C]" />} hint={t("partner.complementaryHint")}>
            {t("partner.complementaryTitle")}
          </SectionLabel>
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#F0DCE4] space-y-3">
            {renderCriteriaGroup(SPERM_COMPLEMENTAIRE)}
          </div>
        </div>

        {/* Bilan complémentaire optionnel — affine l'orientation en cas d'azoospermie */}
        <div>
          <SectionLabel icon={<Stethoscope size={14} className="text-[#E1396C]" />} hint={t("partner.optionalHint")}>
            {t("partner.optionalTitle")}
          </SectionLabel>
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#F0DCE4] grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-[#94A3B8]">{t("partner.fieldFsh")}</label>
              <input
                type="number"
                step="0.1"
                value={sperm.fsh ?? ""}
                onChange={(e) => updateSpermField("fsh", e.target.value)}
                className="w-full mt-1 bg-[#FBF5F7] border border-[#F0DCE4] rounded-lg px-3 py-2 text-[#1E293B] outline-none focus:border-[#E1396C]"
              />
            </div>
            <div>
              <label className="text-[11px] text-[#94A3B8]">{t("partner.fieldVolumeTesticulaire")}</label>
              <input
                type="number"
                step="0.1"
                value={sperm.volumeTesticulaire ?? ""}
                onChange={(e) => updateSpermField("volumeTesticulaire", e.target.value)}
                className="w-full mt-1 bg-[#FBF5F7] border border-[#F0DCE4] rounded-lg px-3 py-2 text-[#1E293B] outline-none focus:border-[#E1396C]"
              />
            </div>
          </div>
        </div>

        {/* Diagnostic et orientation — spermogramme */}
        {renderDxBlock(
          t("partner.dxTitle"),
          <Stethoscope size={14} className="text-[#0F766E]" />,
          dx,
          explorations,
          treatment
        )}

        {/* Actions */}
        {saveError && <p className="text-[11px] text-[#B91C1C]">{t("partner.saveFailed", { error: saveError })}</p>}
        <button
          onClick={handleSave}
          className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl bg-[#E1396C] text-sm font-medium text-white active:bg-[#B91856]"
        >
          {saved ? <Check size={14} /> : null}
          {saved ? t("partner.savedButton") : t("partner.saveButton")}
        </button>
      </div>
    </div>
  );
}
