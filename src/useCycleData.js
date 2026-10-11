import { useCallback, useEffect, useState } from "react";
import {
  doc,
  getDoc,
  setDoc,
  collection,
  addDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { db, auth } from "./firebase";

const DEFAULT_SETTINGS = {
  ddr: null,
  dureeRegles: 5,
  longueurCycle: 28,
  cycleIrregulier: false,
  cycleCourt: 26,
  cycleLong: 31,
};

function requireUid() {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Utilisatrice non connectée");
  return uid;
}

// ---------- Paramètres du cycle (users/{uid}/settings/cycle) ----------

export function useCycleSettings() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Même correctif que pour useGrossesse : on réagit à onAuthStateChanged
    // plutôt qu'à une lecture ponctuelle de auth.currentUser, pour ne pas
    // rater la restauration de session (voir commentaire dans useGrossesse).
    const unsubAuth = onAuthStateChanged(auth, (u) => {
      if (!u) {
        setLoading(false);
        return;
      }
      const ref = doc(db, "users", u.uid, "settings", "cycle");
      getDoc(ref)
        .then((snap) => {
          if (snap.exists()) setSettings({ ...DEFAULT_SETTINGS, ...snap.data() });
        })
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false));
    });
    return unsubAuth;
  }, []);

  const saveSettings = useCallback(async (next) => {
    const uid = requireUid();
    const ref = doc(db, "users", uid, "settings", "cycle");
    await setDoc(ref, { ...next, updatedAt: serverTimestamp() }, { merge: true });
    setSettings((prev) => ({ ...prev, ...next }));
  }, []);

  return { settings, loading, error, saveSettings };
}

// ---------- Événements : rapports, symptômes, notes (users/{uid}/events) ----------

// S'abonne en temps réel aux événements d'un mois donné (year, month 0-indexé).
export function useMonthEvents(year, month) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      setLoading(false);
      return;
    }
    const start = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const lastDay = new Date(year, month + 1, 0).getDate();
    const end = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

    const q = query(
      collection(db, "users", uid, "events"),
      where("date", ">=", start),
      where("date", "<=", end)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        setEvents(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsub;
  }, [year, month]);

  return { events, loading };
}

// Ajoute un événement (ex: { type: "rapport", date: "2026-09-15" })
export async function addEvent(event) {
  const uid = requireUid();
  return addDoc(collection(db, "users", uid, "events"), {
    ...event,
    createdAt: serverTimestamp(),
  });
}

export async function removeEvent(eventId) {
  const uid = requireUid();
  return deleteDoc(doc(db, "users", uid, "events", eventId));
}

// ---------- Grossesse (users/{uid}/settings/grossesse) ----------
//
// Une grossesse confirmée interrompt le suivi de cycle « classique » (règles,
// fenêtre fertile) au profit d'un suivi en semaines d'aménorrhée (SA), jusqu'à
// l'accouchement, qui referme la grossesse et laisse la main au suivi de cycle
// (retour de couches) pour la suite.

const DEFAULT_GROSSESSE = {
  enCours: false,
  dateConfirmation: null, // date à laquelle la grossesse a été confirmée dans l'app
  ddg: null, // date de début de grossesse retenue = DDR au moment de la confirmation
  dpa: null, // date prévue d'accouchement (règle de Naegele : DDG + 280 j), à ajuster selon l'échographie de datation
  dateAccouchement: null, // renseignée une fois l'accouchement survenu
  postPartum: false, // true entre l'accouchement et la confirmation du retour de couches
};

function todayISOString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDaysISO(iso, n) {
  const d = new Date(iso);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function useGrossesse() {
  const [grossesse, setGrossesse] = useState(DEFAULT_GROSSESSE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // On s'abonne à onAuthStateChanged plutôt que de lire auth.currentUser
    // une seule fois : au tout premier rendu (écran "Chargement…" dans
    // App.jsx), Firebase n'a pas encore fini de restaurer la session, donc
    // auth.currentUser peut valoir null de façon transitoire. Avec un effet
    // à dépendances vides lisant auth.currentUser directement, l'écoute
    // Firestore ne se met alors jamais en place pour cette instance du hook.
    let unsubSnap = () => {};
    const unsubAuth = onAuthStateChanged(auth, (u) => {
      unsubSnap();
      if (!u) {
        setGrossesse(DEFAULT_GROSSESSE);
        setLoading(false);
        return;
      }
      const ref = doc(db, "users", u.uid, "settings", "grossesse");
      unsubSnap = onSnapshot(
        ref,
        (snap) => {
          setGrossesse(snap.exists() ? { ...DEFAULT_GROSSESSE, ...snap.data() } : DEFAULT_GROSSESSE);
          setLoading(false);
        },
        (err) => {
          setError(err.message);
          setLoading(false);
        }
      );
    });
    return () => {
      unsubSnap();
      unsubAuth();
    };
  }, []);

  const saveGrossesse = useCallback(async (next) => {
    const uid = requireUid();
    const ref = doc(db, "users", uid, "settings", "grossesse");
    await setDoc(ref, { ...next, updatedAt: serverTimestamp() }, { merge: true });
    // Pas besoin de setGrossesse ici : le onSnapshot ci-dessus reçoit
    // automatiquement l'écriture et met à jour l'état.
  }, []);

  // Confirme une grossesse à partir de la DDR du cycle en cours (ddg).
  const confirmerGrossesse = useCallback(
    async (ddg) => {
      const dpa = addDaysISO(ddg, 280); // règle de Naegele
      await saveGrossesse({
        enCours: true,
        dateConfirmation: todayISOString(),
        ddg,
        dpa,
        dateAccouchement: null,
      });
    },
    [saveGrossesse]
  );

  // Marque l'accouchement : clôture la grossesse en cours et bascule en
  // post-partum. Le suivi de cycle « classique » ne reprend qu'une fois le
  // retour de couches confirmé (voir confirmerRetourDeCouches ci-dessous),
  // pas automatiquement à l'accouchement.
  const marquerAccouchement = useCallback(
    async (dateAccouchement) => {
      await saveGrossesse({ enCours: false, postPartum: true, dateAccouchement });
    },
    [saveGrossesse]
  );

  return { grossesse, loading, error, saveGrossesse, confirmerGrossesse, marquerAccouchement };
}

// Confirme le retour de couches : ressaisit la DDR du nouveau cycle et
// referme l'état post-partum en une seule opération (deux documents
// distincts : settings/cycle et settings/grossesse).
export async function confirmerRetourDeCouches(nouvelleDdr) {
  const uid = requireUid();
  const settingsRef = doc(db, "users", uid, "settings", "cycle");
  const grossesseRef = doc(db, "users", uid, "settings", "grossesse");
  await setDoc(settingsRef, { ddr: nouvelleDdr, updatedAt: serverTimestamp() }, { merge: true });
  await setDoc(grossesseRef, { postPartum: false, updatedAt: serverTimestamp() }, { merge: true });
}

// ---------- Suivi de grossesse : consultations & bilans (users/{uid}/grossesseSuivi) ----------
//
// Chaque document représente soit une consultation prénatale renseignée
// manuellement (type: "consultation"), soit un bilan/examen coché dans la
// checklist de repères (type: "bilan", identifié par un code stable pour
// pouvoir le retrouver et le mettre à jour).

export function useGrossesseSuivi() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubSnap = () => {};
    const unsubAuth = onAuthStateChanged(auth, (u) => {
      unsubSnap();
      if (!u) {
        setItems([]);
        setLoading(false);
        return;
      }
      const ref = collection(db, "users", u.uid, "grossesseSuivi");
      unsubSnap = onSnapshot(
        ref,
        (snap) => {
          setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
          setLoading(false);
        },
        () => setLoading(false)
      );
    });
    return () => {
      unsubSnap();
      unsubAuth();
    };
  }, []);

  return { items, loading };
}

// Ajoute une consultation ou un bilan.
export async function addSuiviGrossesse(item) {
  const uid = requireUid();
  return addDoc(collection(db, "users", uid, "grossesseSuivi"), {
    ...item,
    createdAt: serverTimestamp(),
  });
}

// Met à jour un bilan existant (ex: le repasser à "non fait", corriger sa date).
export async function updateSuiviGrossesse(id, patch) {
  const uid = requireUid();
  await setDoc(doc(db, "users", uid, "grossesseSuivi", id), patch, { merge: true });
}

export async function removeSuiviGrossesse(id) {
  const uid = requireUid();
  return deleteDoc(doc(db, "users", uid, "grossesseSuivi", id));
}

// ---------- Dossier clinique : antécédents, bilan gynécologique, spermogramme ----------
// (users/{uid}/settings/profil)
//
// Structure pensée pour appuyer une véritable démarche diagnostique (cycle
// féminin ET spermogramme), pas seulement un suivi de bien-être :
// - cliniqueFemme  : signes cliniques d'hyperandrogénie, IMC, ATCD familiaux
// - hormonesFemme  : bilan hormonal de 1re/2e intention
// - echographieOvarienne : morphologie ovarienne (critères de Rotterdam)
// - spermogramme   : paramètres OMS 2021 + tests complémentaires

const DEFAULT_PROFILE = {
  nom: "", // prénom (et nom) de la patiente, pour personnaliser le dossier
  dateNaissance: null, // l'âge est calculé automatiquement à partir de cette date
  gestite: null, // nombre total de grossesses (G)
  parite: null, // nombre d'accouchements (P)
  atcdNotes: "", // antécédents gynéco-obstétricaux en texte libre

  cliniqueFemme: {
    imc: null,
    hirsutisme: false,
    acne: false,
    galactorrhee: false,
    antecedentsFamiliauxSOPK: false,
    antecedentsFamiliauxDiabete: false,
    dureeLuteale: null, // durée de la phase post-ovulatoire mesurée (courbe de température / test LH), en jours
  },

  hormonesFemme: {
    fsh: null,
    lh: null,
    amh: null,
    testosteroneTotale: null,
    prolactine: null,
    tsh: null,
    estradiol: null,
  },

  echographieOvarienne: {
    cfaDroit: null, // compte de follicules antraux, ovaire droit
    cfaGauche: null,
    volumeOvarienDroit: null, // mL
    volumeOvarienGauche: null,
  },

  spermogramme: {
    volume: null,
    concentration: null,
    totalCount: null,
    totalMotility: null,
    progressiveMotility: null,
    vitality: null,
    morphology: null,
    ph: null,
  },
};

// Calcule l'âge exact (en années révolues) à partir d'une date de naissance
// au format ISO ("AAAA-MM-JJ"). Retourne null si la date est absente ou
// invalide, pour ne jamais casser les calculs qui dépendent de l'âge
// (ex. seuil d'insuffisance ovarienne prématurée avant 40 ans).
export function computeAge(dateNaissance) {
  if (!dateNaissance) return null;
  const naissance = new Date(dateNaissance);
  if (Number.isNaN(naissance.getTime())) return null;
  const aujourdHui = new Date();
  let age = aujourdHui.getFullYear() - naissance.getFullYear();
  const moisDiff = aujourdHui.getMonth() - naissance.getMonth();
  if (moisDiff < 0 || (moisDiff === 0 && aujourdHui.getDate() < naissance.getDate())) {
    age -= 1;
  }
  return age;
}

export function useHealthProfile() {
  const [profile, setProfile] = useState(DEFAULT_PROFILE);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      setLoading(false);
      return;
    }
    const ref = doc(db, "users", uid, "settings", "profil");
    getDoc(ref)
      .then((snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setProfile({
            ...DEFAULT_PROFILE,
            ...data,
            cliniqueFemme: { ...DEFAULT_PROFILE.cliniqueFemme, ...(data.cliniqueFemme || {}) },
            hormonesFemme: { ...DEFAULT_PROFILE.hormonesFemme, ...(data.hormonesFemme || {}) },
            echographieOvarienne: {
              ...DEFAULT_PROFILE.echographieOvarienne,
              ...(data.echographieOvarienne || {}),
            },
            spermogramme: { ...DEFAULT_PROFILE.spermogramme, ...(data.spermogramme || {}) },
          });
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const saveProfile = useCallback(async (next) => {
    const uid = requireUid();
    const ref = doc(db, "users", uid, "settings", "profil");
    await setDoc(ref, { ...next, updatedAt: serverTimestamp() }, { merge: true });
    setProfile((prev) => ({ ...prev, ...next }));
  }, []);

  return { profile, loading, saveProfile };
}

// ---------- Suivi β-hCG quantitative (users/{uid}/hcgSuivi) ----------
// Un document par dosage : { d: "YYYY-MM-DDTHH:mm" (heure locale du prélèvement), v: UI/L }.
// Le contexte clinique (grossesse débutante, post-fausse couche, méthotrexate, môle),
// l'échographie et la date d'injection du méthotrexate sont conservés dans
// users/{uid}/settings/hcg.

export function useHcgSuivi() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubSnap = () => {};
    const unsubAuth = onAuthStateChanged(auth, (u) => {
      unsubSnap();
      if (!u) {
        setItems([]);
        setLoading(false);
        return;
      }
      unsubSnap = onSnapshot(
        collection(db, "users", u.uid, "hcgSuivi"),
        (snap) => {
          setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
          setLoading(false);
        },
        () => setLoading(false)
      );
    });
    return () => {
      unsubSnap();
      unsubAuth();
    };
  }, []);

  return { items, loading };
}

export async function addHcg({ d, v }) {
  const uid = requireUid();
  return addDoc(collection(db, "users", uid, "hcgSuivi"), { d, v, createdAt: serverTimestamp() });
}

export async function removeHcg(id) {
  const uid = requireUid();
  return deleteDoc(doc(db, "users", uid, "hcgSuivi", id));
}

const DEFAULT_HCG_SETTINGS = { ctx: "early", us: "none", mtx: "" };

export function useHcgSettings() {
  const [settings, setSettings] = useState(DEFAULT_HCG_SETTINGS);

  useEffect(() => {
    let unsubSnap = () => {};
    const unsubAuth = onAuthStateChanged(auth, (u) => {
      unsubSnap();
      if (!u) return;
      unsubSnap = onSnapshot(
        doc(db, "users", u.uid, "settings", "hcg"),
        (snap) => setSettings({ ...DEFAULT_HCG_SETTINGS, ...(snap.exists() ? snap.data() : {}) }),
        () => {}
      );
    });
    return () => {
      unsubSnap();
      unsubAuth();
    };
  }, []);

  const saveHcgSettings = useCallback(async (patch) => {
    const uid = requireUid();
    setSettings((prev) => ({ ...prev, ...patch })); // mise à jour optimiste
    await setDoc(doc(db, "users", uid, "settings", "hcg"), patch, { merge: true });
  }, []);

  return { settings, saveHcgSettings };
}
