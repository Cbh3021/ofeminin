import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { translations } from "./translations";

const LanguageContext = createContext(null);
const STORAGE_KEY = "ofeminin_lang";
const RTL_LANGS = ["ar"];
const SUPPORTED = ["fr", "en", "ar"];

function detectInitialLang() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && SUPPORTED.includes(stored)) return stored;
  } catch {
    // localStorage indisponible (ex: rendu serveur) : on ignore
  }
  return "fr";
}

function resolve(dict, path) {
  return path.split(".").reduce((node, key) => (node == null ? undefined : node[key]), dict);
}

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(detectInitialLang);

  useEffect(() => {
    const isRtl = RTL_LANGS.includes(lang);
    document.documentElement.lang = lang;
    document.documentElement.dir = isRtl ? "rtl" : "ltr";
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // stockage indisponible : la préférence ne sera pas conservée, sans bloquer l'app
    }
  }, [lang]);

  const setLang = useCallback((next) => {
    if (SUPPORTED.includes(next)) setLangState(next);
  }, []);

  const t = useCallback(
    (path, vars) => {
      let value = resolve(translations[lang], path);
      if (value == null) value = resolve(translations.fr, path);
      if (value == null) return path;
      if (typeof value === "string" && vars) {
        return Object.keys(vars).reduce(
          (str, key) => str.replaceAll(`{${key}}`, String(vars[key])),
          value
        );
      }
      return value;
    },
    [lang]
  );

  const value = { lang, setLang, t, isRtl: RTL_LANGS.includes(lang), supported: SUPPORTED };

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage doit être utilisé dans un LanguageProvider");
  return ctx;
}
