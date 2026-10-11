import { useLanguage } from "./LanguageContext";

const LABELS = { fr: "FR", en: "EN", ar: "عربي" };

export default function LanguageSwitcher({ compact = false }) {
  const { lang, setLang, supported } = useLanguage();

  return (
    <div
      className={`inline-flex items-center gap-1 bg-white rounded-full p-1 border border-[#F0DCE4] shadow-sm ${
        compact ? "" : "w-full justify-center"
      }`}
    >
      {supported.map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => setLang(code)}
          className={`px-3 py-1.5 rounded-full text-[12px] font-medium transition-colors ${
            lang === code ? "bg-[#E1396C] text-white" : "text-[#64748B] active:bg-[#FBE8F0]"
          }`}
        >
          {LABELS[code]}
        </button>
      ))}
    </div>
  );
}
