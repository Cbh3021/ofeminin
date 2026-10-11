import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { Home, Settings, User, Users, Baby, Heart } from "lucide-react";
import { auth } from "./firebase";
import CycleAuth from "./CycleAuth";
import CycleHome from "./CycleHome";
import CycleSettings from "./CycleSettings";
import CycleProfile from "./CycleProfile";
import CyclePartner from "./CyclePartner";
import CyclePregnancy from "./CyclePregnancy";
import CyclePostPartum from "./CyclePostPartum";
import CycleSelfExam from "./CycleSelfExam";
import { useCycleSettings, useGrossesse } from "./useCycleData";
import { scheduleCycleNotifications } from "./capacitorNotifications";
import CopyrightFooter from "./CopyrightFooter";
import { useLanguage } from "./i18n/LanguageContext";

const TAB_KEYS = ["home", "profile", "partner", "settings"];

export default function App() {
  const { t } = useLanguage();
  const TAB_ICONS = { home: Home, profile: User, partner: Users, settings: Settings };
  const TABS = TAB_KEYS.map((key) => ({ key, label: t(`common.nav.${key}`), icon: TAB_ICONS[key] }));
  const [user, setUser] = useState(undefined); // undefined = pas encore vérifié, null = déconnectée
  const [tab, setTab] = useState("home"); // "home" | "profile" | "partner" | "settings"
  const { settings, loading: settingsLoading } = useCycleSettings();
  const { grossesse, loading: grossesseLoading } = useGrossesse();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return unsub;
  }, []);

  // Replanifie les rappels dès que l'utilisatrice est connectée et que ses
  // paramètres de cycle sont chargés (une seule fois par ouverture d'app,
  // puis à nouveau à chaque sauvegarde dans CycleSettings).
  useEffect(() => {
    if (
      !user ||
      settingsLoading ||
      grossesseLoading ||
      !settings.ddr ||
      grossesse.enCours ||
      grossesse.postPartum
    )
      return;
    scheduleCycleNotifications({ ddr: settings.ddr, longueurCycle: settings.longueurCycle }).catch(
      () => {} // permission refusée ou plateforme non supportée (ex: navigateur web) : on ignore
    );
  }, [
    user,
    settingsLoading,
    grossesseLoading,
    settings.ddr,
    settings.longueurCycle,
    grossesse.enCours,
    grossesse.postPartum,
  ]);

  // Vérification de session en cours : on évite d'afficher l'écran de connexion
  // par erreur pendant une fraction de seconde à chaque ouverture de l'app.
  if (user === undefined) {
    return (
      <div className="min-h-screen w-full bg-[#FBF5F7] flex items-center justify-center">
        <span className="text-sm text-[#64748B]">{t("common.loading")}</span>
        <CopyrightFooter />
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <CycleAuth onAuthenticated={(u) => setUser(u)} />
        <CopyrightFooter />
      </>
    );
  }

  // On attend explicitement que settings ET grossesse soient chargés avant
  // de décider quel écran afficher : sans ce garde-fou, l'app affiche
  // brièvement CycleHome par défaut le temps que Firestore réponde, ce qui
  // donne l'impression (à tort) que l'état "grossesse en cours" ne persiste
  // pas au redémarrage.
  if (settingsLoading || grossesseLoading) {
    return (
      <div className="min-h-screen w-full bg-[#FBF5F7] flex items-center justify-center">
        <span className="text-sm text-[#64748B]">{t("common.loading")}</span>
        <CopyrightFooter />
      </div>
    );
  }

  function renderHomeTab() {
    if (grossesse.enCours) return <CyclePregnancy />;
    if (grossesse.postPartum) return <CyclePostPartum />;
    return <CycleHome />;
  }

  function renderTab() {
    switch (tab) {
      case "settings":
        return <CycleSettings />;
      case "profile":
        return (
          <CycleProfile
            onOpenPartner={() => setTab("partner")}
            onOpenSelfExam={() => setTab("selfexam")}
          />
        );
      case "partner":
        return <CyclePartner onBack={() => setTab("profile")} />;
      case "selfexam":
        return <CycleSelfExam onBack={() => setTab("profile")} />;
      default:
        return renderHomeTab();
    }
  }

  return (
    <div className="w-full min-h-screen bg-[#FBF5F7]">
      <div className="pb-28 max-w-2xl mx-auto">{renderTab()}</div>

      {/* Navigation basse, fixe — 4 destinations pour rester confortable au
          pouce sur les écrans Android les plus étroits ; la déconnexion vit
          désormais dans Paramètres (voir CycleSettings.jsx).
          La mention de copyright est intégrée ici (plutôt que via un
          <CopyrightFooter /> séparé) pour ne pas empiler deux éléments
          "fixed" au même endroit sur cet écran. */}
      <div className="fixed bottom-0 left-0 right-0 z-[60] bg-white px-2 pt-2 pb-[calc(0.25rem+env(safe-area-inset-bottom))] border-t border-[#F0DCE4] shadow-[0_-2px_8px_rgba(15,23,42,0.06)]">
        <div className="w-full max-w-2xl mx-auto flex items-center justify-between">
          {TABS.map(({ key, label, icon: Icon }) => {
            const active = tab === key;
            const HomeIcon =
              key === "home" ? (grossesse.enCours ? Baby : grossesse.postPartum ? Heart : Home) : Icon;
            return (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl transition-colors ${
                  active ? "bg-[#FCE4ED] text-[#E1396C]" : "text-[#94A3B8] active:bg-[#FBE8F0]"
                }`}
              >
                <HomeIcon size={18} />
                <span className="text-[10px] font-medium">{label}</span>
              </button>
            );
          })}
        </div>
        <CopyrightFooter fixed={false} />
      </div>
    </div>
  );
}
