import { useState } from "react";
import { Heart, Calendar } from "lucide-react";
import { useGrossesse, confirmerRetourDeCouches } from "./useCycleData";
import { useLanguage } from "./i18n/LanguageContext";

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function CyclePostPartum() {
  const { t } = useLanguage();
  const { grossesse } = useGrossesse();
  const [ddr, setDdr] = useState(todayISO());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function handleConfirm() {
    setSaving(true);
    setError(null);
    try {
      await confirmerRetourDeCouches(ddr);
      // Pas besoin de changer d'écran manuellement : App.jsx écoute
      // grossesse.postPartum en temps réel et bascule automatiquement
      // vers le suivi de cycle classique dès que ce champ passe à false.
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="w-full max-w-2xl mx-auto bg-[#FBF5F7] text-[#1E293B] font-sans">
      <div className="px-4 sm:px-6 page-header pb-6 bg-gradient-to-b from-[#FCE7F3] to-[#FBF5F7]">
        <div className="flex items-center justify-between mb-6">
          <span className="text-xs font-medium tracking-wide uppercase text-[#64748B]">{t("postpartum.kicker")}</span>
          <Heart size={16} className="text-[#BE185D]" />
        </div>
        <h1 className="text-2xl font-semibold">{t("postpartum.title")}</h1>
        <p className="text-sm text-[#64748B] mt-2">
          {grossesse.dateAccouchement
            ? t("postpartum.deliveryRegistered", {
                date: new Date(grossesse.dateAccouchement).toLocaleDateString(t("postpartum.dateLocale")),
              })
            : t("postpartum.deliveryRegisteredGeneric")}{" "}
          {t("postpartum.resumeNote")}
        </p>
      </div>

      <div className="px-4 sm:px-6 py-5">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-[#F0DCE4]">
          <label className="flex items-center gap-2 text-sm text-[#64748B] mb-2">
            <Calendar size={14} className="text-[#E1396C]" />
            {t("postpartum.returnDateLabel")}
          </label>
          <input
            type="date"
            value={ddr}
            onChange={(e) => setDdr(e.target.value)}
            className="w-full bg-[#FBF5F7] border border-[#F0DCE4] rounded-xl px-4 py-3 text-sm text-[#1E293B] outline-none focus:border-[#E1396C]"
          />
          {error && <p className="text-[12px] text-[#B91C1C] mt-3">{t("postpartum.saveFailed", { error })}</p>}
          <button
            onClick={handleConfirm}
            disabled={saving}
            className="mt-4 w-full py-3 rounded-xl bg-[#E1396C] text-sm text-white active:bg-[#B91856] disabled:opacity-60"
          >
            {saving ? t("postpartum.submitLoading") : t("postpartum.submit")}
          </button>
        </div>
      </div>
    </div>
  );
}
