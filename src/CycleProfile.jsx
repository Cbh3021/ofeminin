import { useState, useEffect } from "react";
import { User, FileText, Stethoscope, Activity, Heart, Cake, Users, ChevronRight, Info } from "lucide-react";
import { useHealthProfile, useCycleSettings, computeAge } from "./useCycleData";
import { useLanguage } from "./i18n/LanguageContext";

// ============================================================
// BILAN FÉMININ — trouble du cycle / anovulation / SOPK
// ============================================================
// Références utilisées :
// - FIGO (classification AUB / PALM-COEIN) pour les anomalies de durée et
//   de régularité du cycle et des règles.
// - ESHRE/ASRM 2018 (critères de Rotterdam révisés) pour le SOPK : au
//   moins 2 des 3 critères — anovulation/oligo-anovulation, hyperandrogénie
//   clinique ou biologique, morphologie ovarienne échographique — après
//   exclusion des diagnostics différentiels.
// - ESHRE (Guideline on POI, 2016) pour le seuil de FSH évocateur
//   d'insuffisance ovarienne prématurée avant 40 ans.
// Les seuils biologiques (testostérone, prolactine, TSH) sont indicatifs et
// doivent être interprétés selon les normes du laboratoire utilisé.
//
// NOTE I18N : les termes diagnostiques générés ci-dessous (classifyCycle,
// buildExplorationsCycle, buildOrientationCycle) restent volontairement en
// français quelle que soit la langue de l'interface — ce sont des sorties
// cliniques structurées comparées par égalité de chaîne ; les traduire sans
// casser cette logique demande un refactor dédié, à faire dans un second
// temps si besoin. Tout le reste de l'écran (libellés, champs, boutons) est
// trilingue.

function joursDepuisDDR(ddr) {
  if (!ddr) return null;
  const MS = 1000 * 60 * 60 * 24;
  const d = new Date(ddr);
  d.setHours(0, 0, 0, 0);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((now - d) / MS);
}

function classifyCycle(c) {
  const dx = [];
  const jours = joursDepuisDDR(c.ddr);
  const h = c.hormones || {};
  const clinique = c.clinique || {};
  const echo = c.echo || {};

  // Aménorrhée secondaire : absence de règles ≥ 90 jours chez une femme
  // préalablement réglée.
  const amenorrhee = jours != null && jours >= 90;

  // Calculés ici (plutôt qu'à leur premier usage plus bas) car réutilisés
  // par la détection de la périménopause, avant même l'installation d'une
  // aménorrhée.
  // - explicationHormonale : dysthyroïdie/hyperprolactinémie pouvant à
  //   elles seules expliquer le trouble du cycle (ces diagnostics ne sont
  //   formellement posés que plus loin dans la fonction, d'où la
  //   vérification directe sur les valeurs brutes ici).
  // - ecartCycles : variation entre le cycle le plus court et le plus long
  //   récemment observés, en mode "cycles irréguliers".
  const explicationHormonale =
    (h.prolactine != null && h.prolactine > 25) || (h.tsh != null && (h.tsh < 0.4 || h.tsh > 4.0));
  const ecartCycles = c.cycleIrregulier ? c.cycleLong - c.cycleCourt : 0;
  const contexteMenopausique = c.age != null && c.age >= 45 && !explicationHormonale;

  // Retard de règles avec activité sexuelle en cours : pour un cycle
  // régulier, un retard > 7 jours par rapport à la longueur habituelle du
  // cycle justifie un test de grossesse avant toute autre exploration —
  // signal plus précoce et plus spécifique que le seuil d'aménorrhée
  // (90 jours) ci-dessous, qui reste la référence en l'absence de rapports.
  const retard = jours != null ? jours - c.longueurCycle : null;
  const retardEvocateur =
    clinique.activiteSexuelle === true && !c.cycleIrregulier && !amenorrhee && retard != null && retard > 7;
  if (retardEvocateur) {
    dx.push({
      term: "Retard de règles évocateur",
      severity: null,
      detail: `retard de ${retard} jours par rapport à un cycle de ${c.longueurCycle} jours, avec activité sexuelle en cours`,
    });
  }

  // Périménopause précoce (critère STRAW+10) : après 45 ans, une variation
  // persistante ≥ 7 jours entre cycles consécutifs évoque déjà la
  // transition ménopausique, avant même l'apparition d'une aménorrhée
  // franche — c'est le critère le plus précoce des stades STRAW+10, à
  // distinguer du seuil de 8 jours utilisé plus bas pour signaler une
  // anovulation isolée à tout âge.
  const perimenopauseParVariation =
    contexteMenopausique && !amenorrhee && c.cycleIrregulier && ecartCycles >= 7;
  if (perimenopauseParVariation) {
    dx.push({
      term: "Préménopause probable",
      severity: null,
      detail: `variation de cycle de ${ecartCycles} jours (cycles de ${c.cycleCourt} à ${c.cycleLong} jours) après 45 ans, en l'absence d'antécédent pathologique retrouvé pouvant l'expliquer`,
    });
  }

  if (amenorrhee) {
    // Après 45 ans, une aménorrhée avec irrégularités du cycle évoque
    // d'abord la transition ménopausique plutôt qu'une aménorrhée
    // "pathologique" au sens large — à condition qu'aucun autre
    // antécédent/dosage ne l'explique déjà. Distinction usuelle :
    // préménopause tant que l'aménorrhée n'atteint pas 12 mois consécutifs,
    // ménopause probable au-delà (seuil rétrospectif classique en
    // l'absence de cause retrouvée).
    if (contexteMenopausique && jours >= 365) {
      dx.push({
        term: "Ménopause probable",
        severity: null,
        detail: `aménorrhée de ${jours} jours (~${Math.floor(jours / 30)} mois) après 45 ans, en l'absence d'antécédent pathologique retrouvé pouvant l'expliquer`,
      });
    } else if (contexteMenopausique) {
      dx.push({
        term: "Préménopause probable",
        severity: null,
        detail: `${
          c.cycleIrregulier ? "irrégularités des cycles avec " : ""
        }aménorrhée de ${jours} jours (~${Math.floor(jours / 30)} mois) après 45 ans, en l'absence d'antécédent pathologique retrouvé pouvant l'expliquer`,
      });
    } else {
      dx.push({
        term: "Aménorrhée secondaire",
        severity: jours >= 180 ? "prolongée" : null,
        detail: `${jours} jours sans règles`,
      });
    }
  }

  // Oligoménorrhée : cycles > 35 jours (on ne le retient pas en plus d'une
  // aménorrhée déjà installée, qui est le stade suivant).
  const longueurRef = c.cycleIrregulier ? c.cycleLong : c.longueurCycle;
  if (!amenorrhee && longueurRef > 35) {
    dx.push({ term: "Oligoménorrhée", severity: null, detail: `cycles jusqu'à ${longueurRef} jours` });
  }

  // Polyménorrhée : cycles < 21 jours.
  const longueurMin = c.cycleIrregulier ? c.cycleCourt : c.longueurCycle;
  if (longueurMin < 21) {
    dx.push({ term: "Polyménorrhée", severity: null, detail: `cycles aussi courts que ${longueurMin} jours` });
  }

  // Irrégularité significative : écart inter-cycle > 8 jours, évocateur
  // d'anovulation (au-delà, l'estimation calendaire de l'ovulation n'est
  // plus fiable). Non retenue en plus d'une périménopause déjà signalée
  // par le critère de variation ci-dessus, pour ne pas doubler le même
  // constat sous deux étiquettes différentes.
  if (c.cycleIrregulier && ecartCycles > 8 && !perimenopauseParVariation) {
    dx.push({
      term: "Cycles irréguliers (variation significative)",
      severity: null,
      detail: `écart de ${ecartCycles} jours entre cycle le plus court et le plus long`,
    });
  }

  // Ménorragie / hypoménorrhée.
  if (c.dureeRegles > 7) {
    dx.push({ term: "Ménorragie probable", severity: null, detail: `règles de ${c.dureeRegles} jours` });
  }
  if (c.dureeRegles < 3) {
    dx.push({ term: "Hypoménorrhée", severity: null, detail: `règles de ${c.dureeRegles} jour(s)` });
  }

  // Insuffisance lutéale : si une durée de phase post-ovulatoire a été
  // mesurée directement (courbe de température, test LH) et qu'elle est
  // courte.
  if (clinique.dureeLuteale != null && clinique.dureeLuteale < 10) {
    dx.push({
      term: "Insuffisance lutéale suspectée",
      severity: null,
      detail: `phase lutéale mesurée à ${clinique.dureeLuteale} jours (seuil habituel : 10 jours)`,
    });
  }

  // Insuffisance ovarienne prématurée (suspicion) : FSH élevée avant 40 ans
  // dans un contexte d'aménorrhée/oligoménorrhée.
  if (
    h.fsh != null &&
    h.fsh > 25 &&
    c.age != null &&
    c.age < 40 &&
    (amenorrhee || dx.some((d) => d.term === "Oligoménorrhée"))
  ) {
    dx.push({
      term: "Insuffisance ovarienne prématurée (suspicion)",
      severity: null,
      detail: `FSH ${h.fsh} UI/L avant 40 ans — à confirmer sur un second dosage à 4 semaines`,
    });
  }

  // Hyperprolactinémie.
  if (h.prolactine != null && h.prolactine > 25) {
    dx.push({
      term: "Hyperprolactinémie",
      severity: h.prolactine > 100 ? "marquée" : null,
      detail: `prolactine ${h.prolactine} ng/mL${clinique.galactorrhee ? ", galactorrhée associée" : ""}`,
    });
  }

  // Dysthyroïdie.
  if (h.tsh != null && (h.tsh < 0.4 || h.tsh > 4.0)) {
    dx.push({
      term: h.tsh > 4.0 ? "Hypothyroïdie (à confirmer)" : "Hyperthyroïdie (à confirmer)",
      severity: null,
      detail: `TSH ${h.tsh} mUI/L`,
    });
  }

  // SOPK — critères de Rotterdam révisés (ESHRE/ASRM 2018), 2 critères sur 3.
  const anovulation =
    amenorrhee ||
    dx.some((d) => d.term === "Oligoménorrhée" || d.term === "Cycles irréguliers (variation significative)");
  const hyperandrogenieClinique = !!(clinique.hirsutisme || clinique.acne);
  const hyperandrogenieBio = h.testosteroneTotale != null && h.testosteroneTotale > 0.6; // ng/mL, seuil indicatif
  const cfaMax = Math.max(echo.cfaDroit || 0, echo.cfaGauche || 0);
  const volMax = Math.max(echo.volumeOvarienDroit || 0, echo.volumeOvarienGauche || 0);
  const morphoEcho = cfaMax >= 20 || volMax >= 10;
  const criteresRotterdam = [anovulation, hyperandrogenieClinique || hyperandrogenieBio, morphoEcho].filter(
    Boolean
  ).length;
  if (criteresRotterdam >= 2) {
    dx.push({
      term: "Syndrome des ovaires polykystiques (SOPK) probable",
      severity: null,
      detail: `${criteresRotterdam}/3 critères de Rotterdam présents — diagnostic d'élimination, à confirmer après exclusion des diagnostics différentiels (dysthyroïdie, hyperprolactinémie, hyperplasie surrénale congénitale non classique)`,
    });
  }

  if (dx.length === 0) {
    dx.push({
      term: "Cycle sans anomalie identifiée",
      severity: null,
      detail: "durée, régularité et durée des règles dans les limites habituelles",
    });
  }

  return dx;
}

function buildExplorationsCycle(dx) {
  const ex = new Set();
  const has = (t) => dx.some((d) => d.term === t);

  if (has("Retard de règles évocateur")) {
    ex.add("Test de grossesse (urinaire ou β-hCG plasmatique)");
  }
  if (has("Préménopause probable")) {
    ex.add("FSH + estradiol si doute diagnostique (variables et peu fiables en périménopause)");
    ex.add("β-hCG (éliminer une grossesse tant que l'aménorrhée n'est pas confirmée)");
    ex.add("Bilan métabolique et osseux de base selon le contexte (facteurs de risque, âge)");
  }
  if (has("Ménopause probable")) {
    ex.add("FSH élevée + estradiol bas pour confirmer si besoin (non systématique après 12 mois d'aménorrhée typique)");
    ex.add("Ostéodensitométrie (DMO) et bilan cardiovasculaire selon les facteurs de risque");
  }
  if (has("Aménorrhée secondaire")) {
    ex.add("β-hCG (éliminer une grossesse)");
    ex.add("Bilan hormonal : FSH, LH, prolactine, TSH, estradiol");
    ex.add("Échographie pelvienne");
  }
  if (has("Oligoménorrhée") || has("Cycles irréguliers (variation significative)")) {
    ex.add("Bilan thyroïdien (TSH) et prolactine");
    ex.add("Testostérone totale ± SDHEA (recherche d'hyperandrogénie biologique)");
    ex.add("Échographie pelvienne avec compte des follicules antraux");
  }
  if (has("Syndrome des ovaires polykystiques (SOPK) probable")) {
    ex.add("Glycémie à jeun ± HGPO, insulinémie (recherche d'insulino-résistance)");
    ex.add("Bilan lipidique");
    ex.add("Avis gynécologique/endocrinologique pour confirmation diagnostique");
  }
  if (has("Insuffisance ovarienne prématurée (suspicion)")) {
    ex.add("Second dosage de FSH à 4 semaines d'intervalle");
    ex.add("AMH, caryotype, recherche de prémutation FMR1 (X fragile)");
    ex.add("Orientation rapide en PMA compte tenu du pronostic de réserve ovarienne");
  }
  if (has("Hyperprolactinémie")) {
    ex.add("IRM hypophysaire (recherche d'un adénome)");
    ex.add("Revue des traitements en cours à risque d'hyperprolactinémie iatrogène");
  }
  if (has("Hypothyroïdie (à confirmer)") || has("Hyperthyroïdie (à confirmer)")) {
    ex.add("TSH + T4 libre, anticorps anti-TPO, avis endocrinologique");
  }
  if (has("Ménorragie probable")) {
    ex.add("NFS (recherche d'anémie)");
    ex.add("Échographie pelvienne (recherche de fibrome, polype, adénomyose)");
    ex.add("Bilan d'hémostase si contexte évocateur");
  }
  if (has("Insuffisance lutéale suspectée")) {
    ex.add("Progestéronémie en phase lutéale (J21 ou 7 jours avant les règles attendues)");
    ex.add("Courbe de température basale ou test LH pour dater précisément l'ovulation");
  }

  return Array.from(ex);
}

function buildOrientationCycle(dx) {
  const has = (t) => dx.some((d) => d.term === t);

  if (has("Retard de règles évocateur")) {
    return {
      type: "Retard de règles — grossesse à éliminer en premier",
      detail:
        "Test de grossesse à réaliser avant toute autre exploration. Si négatif et retard persistant, reprendre le bilan du cycle (dosages hormonaux, échographie).",
    };
  }
  if (has("Ménopause probable")) {
    return {
      type: "Ménopause",
      detail:
        "Évaluer les symptômes climatériques (bouffées de chaleur, sécheresse vaginale, troubles du sommeil) et le risque osseux/cardiovasculaire. Discuter un traitement hormonal de la ménopause selon la balance bénéfice-risque individuelle, en l'absence de contre-indication.",
    };
  }
  if (has("Préménopause probable")) {
    return {
      type: "Préménopause (transition ménopausique)",
      detail:
        "Pas de traitement hormonal systématique à ce stade sauf gêne fonctionnelle importante. Maintenir une contraception si une grossesse n'est pas souhaitée, l'ovulation restant possible tant que l'aménorrhée n'est pas confirmée sur 12 mois.",
    };
  }
  if (has("Insuffisance ovarienne prématurée (suspicion)")) {
    return {
      type: "Insuffisance ovarienne prématurée",
      detail:
        "Pronostic de réserve ovarienne défavorable : orientation rapide vers une consultation de PMA, discuter la préservation de la fertilité restante ou le don d'ovocytes selon le bilan.",
    };
  }
  if (has("Syndrome des ovaires polykystiques (SOPK) probable")) {
    return {
      type: "SOPK — prise en charge de l'infertilité",
      detail:
        "Mesures hygiéno-diététiques en 1re intention si surpoids ; induction de l'ovulation par citrate de clomifène ou létrozole en 1re ligne si désir de grossesse et absence d'autre cause associée.",
    };
  }
  if (has("Hyperprolactinémie")) {
    return {
      type: "Hyperprolactinémie",
      detail:
        "Traitement par agoniste dopaminergique après élimination d'une cause médicamenteuse ou tumorale ; restauration attendue de l'ovulation sous traitement.",
    };
  }
  if (has("Hypothyroïdie (à confirmer)") || has("Hyperthyroïdie (à confirmer)")) {
    return {
      type: "Dysthyroïdie",
      detail: "Normalisation de la fonction thyroïdienne avant et pendant la prise en charge de l'infertilité.",
    };
  }
  if (has("Insuffisance lutéale suspectée")) {
    return {
      type: "Insuffisance lutéale",
      detail:
        "Discuter une supplémentation en progestérone en phase lutéale selon le contexte clinique et l'historique de fausses couches.",
    };
  }
  if (has("Cycle sans anomalie identifiée")) {
    return {
      type: "Cycle sans anomalie",
      detail:
        "N'exclut pas un trouble de l'ovulation non capturé par ces seuls paramètres. Le bilan du partenaire et l'historique du couple orientent la suite de la prise en charge.",
    };
  }
  return null;
}

// ============================================================
// COMPOSANTS D'INTERFACE PARTAGÉS
// ============================================================

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

function DxBlock({ title, icon, dxList, explorationsList, orientation, labels }) {
  if (!dxList || dxList.length === 0) return null;
  return (
    <div>
      <SectionLabel icon={icon}>{title}</SectionLabel>
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#F0DCE4] space-y-4">
        <div>
          <p className="text-[11px] text-[#94A3B8] mb-2">{labels.dxRetenu}</p>
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
            <p className="text-[11px] text-[#94A3B8] mb-2">{labels.explorationsLabel}</p>
            <div className="space-y-1">
              {explorationsList.map((e, i) => (
                <p key={i} className="text-[12px] text-[#1E293B]">• {e}</p>
              ))}
            </div>
          </div>
        )}

        {orientation && (
          <div className="pt-3 border-t border-[#F0DCE4]">
            <p className="text-[11px] text-[#94A3B8] mb-1">{labels.orientationLabel}</p>
            <p className="text-[13px] text-[#1E293B] font-medium">{orientation.type}</p>
            <p className="text-[12px] text-[#1E293B] mt-0.5">{orientation.detail}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// COMPOSANT
// ============================================================

export default function CycleProfile({ onOpenPartner, onOpenSelfExam, onOpenHcg }) {
  const { t } = useLanguage();
  const { profile, loading, saveProfile } = useHealthProfile();
  const { settings: cycleSettings, loading: cycleLoading } = useCycleSettings();

  const [nom, setNom] = useState("");
  const [dateNaissance, setDateNaissance] = useState("");
  const [gestite, setGestite] = useState("");
  const [parite, setParite] = useState("");
  const [atcdNotes, setAtcdNotes] = useState("");
  const [clinique, setClinique] = useState({});
  const [hormones, setHormones] = useState({});
  const [echo, setEcho] = useState({});
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(null);

  useEffect(() => {
    if (loading) return;
    setNom(profile.nom ?? "");
    setDateNaissance(profile.dateNaissance ?? "");
    setGestite(profile.gestite ?? "");
    setParite(profile.parite ?? "");
    setAtcdNotes(profile.atcdNotes ?? "");
    setClinique(profile.cliniqueFemme ?? {});
    setHormones(profile.hormonesFemme ?? {});
    setEcho(profile.echographieOvarienne ?? {});
  }, [loading, profile]);

  function updateNumField(setter, key, value) {
    setter((prev) => ({ ...prev, [key]: value === "" ? null : parseFloat(value) }));
  }
  function toggleBoolField(setter, key) {
    setter((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  const age = computeAge(dateNaissance);

  async function handleSave() {
    setSaveError(null);
    try {
      // On ne réécrit que les champs du dossier féminin : le spermogramme
      // (dossier du conjoint) vit dans le même document Firestore mais est
      // géré et enregistré séparément depuis CyclePartner.jsx (setDoc en
      // merge:true côté useHealthProfile, donc aucune perte croisée).
      await saveProfile({
        nom,
        dateNaissance: dateNaissance === "" ? null : dateNaissance,
        gestite: gestite === "" ? null : parseInt(gestite, 10),
        parite: parite === "" ? null : parseInt(parite, 10),
        atcdNotes,
        cliniqueFemme: clinique,
        hormonesFemme: hormones,
        echographieOvarienne: echo,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    } catch (err) {
      setSaveError(err.message);
    }
  }

  const cycleInput = {
    ddr: cycleSettings.ddr,
    dureeRegles: cycleSettings.dureeRegles,
    longueurCycle: cycleSettings.longueurCycle,
    cycleIrregulier: cycleSettings.cycleIrregulier,
    cycleCourt: cycleSettings.cycleCourt,
    cycleLong: cycleSettings.cycleLong,
    age,
    clinique,
    hormones,
    echo,
  };
  const dxCycle = cycleLoading || loading ? [] : classifyCycle(cycleInput);
  const explorationsCycle = buildExplorationsCycle(dxCycle);
  const orientationCycle = buildOrientationCycle(dxCycle);

  const dxLabels = {
    dxRetenu: t("profile.dxRetenu"),
    explorationsLabel: t("profile.explorationsLabel"),
    orientationLabel: t("profile.orientationLabel"),
  };

  const toggles = [
    ["hirsutisme", t("profile.toggleHirsutisme")],
    ["acne", t("profile.toggleAcne")],
    ["galactorrhee", t("profile.toggleGalactorrhee")],
    ["antecedentsFamiliauxSOPK", t("profile.toggleAtcdFamSopk")],
    ["antecedentsFamiliauxDiabete", t("profile.toggleAtcdFamDiabete")],
  ];

  const hormoneFields = [
    ["fsh", t("profile.fieldFsh")],
    ["lh", t("profile.fieldLh")],
    ["amh", t("profile.fieldAmh")],
    ["testosteroneTotale", t("profile.fieldTestosterone")],
    ["prolactine", t("profile.fieldProlactine")],
    ["tsh", t("profile.fieldTsh")],
    ["estradiol", t("profile.fieldEstradiol")],
  ];

  const echoFields = [
    ["cfaDroit", t("profile.fieldCfaDroit")],
    ["cfaGauche", t("profile.fieldCfaGauche")],
    ["volumeOvarienDroit", t("profile.fieldVolDroit")],
    ["volumeOvarienGauche", t("profile.fieldVolGauche")],
  ];

  return (
    <div className="w-full max-w-2xl mx-auto bg-[#FBF5F7] text-[#1E293B] font-sans">
      <div className="px-4 sm:px-6 page-header pb-6 bg-gradient-to-b from-[#FCE7F3] via-[#FDE7F0] to-[#FBF5F7]">
        <div className="flex items-center gap-2 mb-1">
          <Heart size={14} className="text-[#BE185D]" />
          <p className="text-xs font-medium tracking-wide text-[#BE185D]">{t("profile.kicker")}</p>
        </div>
        <h1 className="text-2xl font-semibold">
          {nom ? t("profile.greeting", { name: nom.split(" ")[0] }) : t("profile.welcomeDefault")}
        </h1>
        <p className="text-sm text-[#64748B] mt-2 leading-relaxed max-w-md">{t("profile.intro")}</p>
      </div>

      <div className="px-4 sm:px-6 py-5 space-y-6">
        {/* Mention de non-substitution à un avis médical : ce dossier pose
            de vrais termes diagnostiques (SOPK, aménorrhée, etc.), il est
            important de rappeler son statut d'outil d'aide au suivi. */}
        <div className="flex gap-3 bg-[#FEF3C7] text-[#92400E] rounded-2xl p-4">
          <Info size={16} className="shrink-0 mt-0.5" />
          <p className="text-[12px] leading-relaxed">{t("profile.disclaimer")}</p>
        </div>

        {/* Identité */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#F0DCE4] space-y-4">
          <div>
            <label className="flex items-center gap-2 text-sm text-[#64748B] mb-2">
              <User size={14} className="text-[#E1396C]" />
              {t("profile.nameLabel")}
            </label>
            <input
              type="text"
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              placeholder={t("profile.namePlaceholder")}
              className="w-full bg-[#FBF5F7] border border-[#F0DCE4] rounded-xl px-4 py-3 text-[#1E293B] outline-none focus:border-[#E1396C]"
            />
          </div>

          <div className="pt-1 border-t border-[#F0DCE4]">
            <label className="flex items-center gap-2 text-sm text-[#64748B] mb-2 mt-3">
              <Cake size={14} className="text-[#E1396C]" />
              {t("profile.birthDateLabel")}
            </label>
            <input
              type="date"
              value={dateNaissance}
              onChange={(e) => setDateNaissance(e.target.value)}
              className="w-full bg-[#FBF5F7] border border-[#F0DCE4] rounded-xl px-4 py-3 text-[#1E293B] outline-none focus:border-[#E1396C]"
            />
            {age != null && (
              <div className="flex items-center gap-2 mt-3 bg-[#FCE7F3] rounded-xl px-3 py-2">
                <Heart size={12} className="text-[#BE185D]" />
                <p className="text-[12px] text-[#BE185D]">{t("profile.ageComputed", { age })}</p>
              </div>
            )}
            <p className="text-[11px] text-[#94A3B8] mt-2 leading-relaxed">{t("profile.ageNote")}</p>
          </div>
        </div>

        {/* ATCD gynéco-obstétricaux */}
        <div>
          <SectionLabel icon={<FileText size={14} className="text-[#E1396C]" />}>{t("profile.atcdTitle")}</SectionLabel>
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#F0DCE4] space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-[#94A3B8]">{t("profile.gestiteLabel")}</label>
                <input
                  type="number"
                  min="0"
                  value={gestite}
                  onChange={(e) => setGestite(e.target.value)}
                  className="w-full mt-1 bg-[#FBF5F7] border border-[#F0DCE4] rounded-xl px-3 py-2 text-[#1E293B] outline-none focus:border-[#E1396C]"
                />
              </div>
              <div>
                <label className="text-[11px] text-[#94A3B8]">{t("profile.pariteLabel")}</label>
                <input
                  type="number"
                  min="0"
                  value={parite}
                  onChange={(e) => setParite(e.target.value)}
                  className="w-full mt-1 bg-[#FBF5F7] border border-[#F0DCE4] rounded-xl px-3 py-2 text-[#1E293B] outline-none focus:border-[#E1396C]"
                />
              </div>
            </div>
            <textarea
              value={atcdNotes}
              onChange={(e) => setAtcdNotes(e.target.value)}
              rows={3}
              placeholder={t("profile.atcdPlaceholder")}
              className="w-full bg-[#FBF5F7] border border-[#F0DCE4] rounded-xl px-4 py-3 text-[#1E293B] outline-none focus:border-[#E1396C] resize-none"
            />
          </div>
        </div>

        {/* Activité sexuelle — conditionne la recommandation de test de
            grossesse en cas de retard de règles sur cycle régulier */}
        <div>
          <SectionLabel icon={<Heart size={14} className="text-[#E1396C]" />} hint={t("profile.sexActivityHint")}>
            {t("profile.sexActivityTitle")}
          </SectionLabel>
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#F0DCE4] flex gap-2">
            {[
              [true, t("profile.yes")],
              [false, t("profile.no")],
            ].map(([val, label]) => (
              <button
                key={String(val)}
                type="button"
                onClick={() => setClinique((prev) => ({ ...prev, activiteSexuelle: val }))}
                className={`flex-1 py-2.5 rounded-xl text-[13px] font-medium border ${
                  clinique.activiteSexuelle === val
                    ? "bg-[#FCE4ED] border-[#E1396C] text-[#E1396C]"
                    : "bg-white border-[#F0DCE4] text-[#64748B]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Signes cliniques d'hyperandrogénie / IMC */}
        <div>
          <SectionLabel icon={<Activity size={14} className="text-[#E1396C]" />} hint={t("profile.clinicalExamHint")}>
            {t("profile.clinicalExamTitle")}
          </SectionLabel>
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#F0DCE4] space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[12px] text-[#1E293B]">{t("profile.imcLabel")}</label>
              <input
                type="number"
                step="0.1"
                value={clinique.imc ?? ""}
                onChange={(e) => updateNumField(setClinique, "imc", e.target.value)}
                className="w-20 bg-[#FBF5F7] border border-[#F0DCE4] rounded-lg px-2 py-2 text-[#1E293B] text-center outline-none focus:border-[#E1396C]"
              />
            </div>
            <div className="flex items-center justify-between">
              <label className="text-[12px] text-[#1E293B]">{t("profile.lutealLabel")}</label>
              <input
                type="number"
                step="1"
                value={clinique.dureeLuteale ?? ""}
                onChange={(e) => updateNumField(setClinique, "dureeLuteale", e.target.value)}
                className="w-20 bg-[#FBF5F7] border border-[#F0DCE4] rounded-lg px-2 py-2 text-[#1E293B] text-center outline-none focus:border-[#E1396C]"
              />
            </div>
            <div className="pt-2 border-t border-[#F0DCE4] flex flex-wrap gap-2">
              {toggles.map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggleBoolField(setClinique, key)}
                  className={`px-3 py-2 rounded-full text-[12px] border ${
                    clinique[key]
                      ? "bg-[#FCE4ED] border-[#E1396C] text-[#E1396C]"
                      : "bg-white border-[#F0DCE4] text-[#64748B]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Bilan hormonal féminin */}
        <div>
          <SectionLabel icon={<Stethoscope size={14} className="text-[#E1396C]" />} hint={t("profile.hormonalHint")}>
            {t("profile.hormonalTitle")}
          </SectionLabel>
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#F0DCE4] grid grid-cols-2 gap-3">
            {hormoneFields.map(([key, label]) => (
              <div key={key}>
                <label className="text-[11px] text-[#94A3B8]">{label}</label>
                <input
                  type="number"
                  step="0.01"
                  value={hormones[key] ?? ""}
                  onChange={(e) => updateNumField(setHormones, key, e.target.value)}
                  className="w-full mt-1 bg-[#FBF5F7] border border-[#F0DCE4] rounded-lg px-3 py-2 text-[#1E293B] outline-none focus:border-[#E1396C]"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Échographie ovarienne */}
        <div>
          <SectionLabel icon={<Activity size={14} className="text-[#E1396C]" />} hint={t("profile.echoHint")}>
            {t("profile.echoTitle")}
          </SectionLabel>
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#F0DCE4] grid grid-cols-2 gap-3">
            {echoFields.map(([key, label]) => (
              <div key={key}>
                <label className="text-[11px] text-[#94A3B8]">{label}</label>
                <input
                  type="number"
                  step="0.1"
                  value={echo[key] ?? ""}
                  onChange={(e) => updateNumField(setEcho, key, e.target.value)}
                  className="w-full mt-1 bg-[#FBF5F7] border border-[#F0DCE4] rounded-lg px-3 py-2 text-[#1E293B] outline-none focus:border-[#E1396C]"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Diagnostic et orientation — cycle féminin */}
        <DxBlock
          title={t("profile.dxTitle")}
          icon={<Stethoscope size={14} className="text-[#0F766E]" />}
          dxList={dxCycle}
          explorationsList={explorationsCycle}
          orientation={orientationCycle}
          labels={dxLabels}
        />

        {/* Passerelle vers le dossier du conjoint, désormais sur sa propre page */}
        <button
          onClick={onOpenPartner}
          className="w-full flex items-center gap-3 bg-white rounded-2xl p-4 shadow-sm border border-[#F0DCE4] active:bg-[#FBE8F0] text-left"
        >
          <div className="w-10 h-10 rounded-full bg-[#FCE4ED] flex items-center justify-center shrink-0">
            <Users size={18} className="text-[#E1396C]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-[#1E293B]">{t("profile.partnerCardTitle")}</p>
            <p className="text-[12px] text-[#64748B]">{t("profile.partnerCardDesc")}</p>
          </div>
          <ChevronRight size={18} className="text-[#94A3B8] shrink-0" />
        </button>

        {/* Passerelle vers le guide d'autopalpation mammaire */}
        <button
          onClick={onOpenSelfExam}
          className="w-full flex items-center gap-3 bg-white rounded-2xl p-4 shadow-sm border border-[#F0DCE4] active:bg-[#FBE8F0] text-left"
        >
          <div className="w-10 h-10 rounded-full bg-[#FCE4ED] flex items-center justify-center shrink-0">
            <Heart size={18} className="text-[#E1396C]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-[#1E293B]">{t("profile.selfExamCardTitle")}</p>
            <p className="text-[12px] text-[#64748B]">{t("profile.selfExamCardDesc")}</p>
          </div>
          <ChevronRight size={18} className="text-[#94A3B8] shrink-0" />
        </button>

        {/* Passerelle vers le suivi β-hCG quantitative */}
        <button
          onClick={onOpenHcg}
          className="w-full flex items-center gap-3 bg-white rounded-2xl p-4 shadow-sm border border-[#F0DCE4] active:bg-[#FBE8F0] text-left"
        >
          <div className="w-10 h-10 rounded-full bg-[#FCE4ED] flex items-center justify-center shrink-0">
            <Activity size={18} className="text-[#E1396C]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-[#1E293B]">{t("hcg.cardTitle")}</p>
            <p className="text-[12px] text-[#64748B]">{t("hcg.cardDesc")}</p>
          </div>
          <ChevronRight size={18} className="text-[#94A3B8] shrink-0" />
        </button>

        {/* Actions */}
        {saveError && <p className="text-[11px] text-[#B91C1C]">{t("profile.saveFailed", { error: saveError })}</p>}
        <button
          onClick={handleSave}
          className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl bg-[#E1396C] text-sm font-medium text-white active:bg-[#B91856]"
        >
          {saved ? <Heart size={14} /> : null}
          {saved ? t("profile.savedButton") : t("profile.saveButton")}
        </button>
      </div>
    </div>
  );
}
