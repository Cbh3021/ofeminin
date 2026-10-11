import { common } from "./locales/common";
import { auth } from "./locales/auth";
import { settings } from "./locales/settings";
import { home } from "./locales/home";
import { profile } from "./locales/profile";
import { partner } from "./locales/partner";
import { pregnancy } from "./locales/pregnancy";
import { postpartum } from "./locales/postpartum";
import { selfexam } from "./locales/selfexam";

const modules = { common, auth, settings, home, profile, partner, pregnancy, postpartum, selfexam };

function buildLang(lang) {
  const out = {};
  for (const [namespace, dict] of Object.entries(modules)) {
    out[namespace] = dict[lang];
  }
  return out;
}

export const translations = {
  fr: buildLang("fr"),
  en: buildLang("en"),
  ar: buildLang("ar"),
};
