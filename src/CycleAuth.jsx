import { useState } from "react";
import { Mail, Lock, Stethoscope, Eye, EyeOff } from "lucide-react";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
} from "firebase/auth";
import { auth } from "./firebase";
import { useLanguage } from "./i18n/LanguageContext";
import LanguageSwitcher from "./i18n/LanguageSwitcher";

function mapAuthError(code, t) {
  switch (code) {
    case "auth/invalid-email":
      return t("auth.errorInvalidEmail");
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return t("auth.errorWrongCredentials");
    case "auth/email-already-in-use":
      return t("auth.errorEmailInUse");
    case "auth/weak-password":
      return t("auth.errorWeakPassword");
    default:
      return t("auth.errorGeneric");
  }
}

export default function CycleAuth({ onAuthenticated }) {
  const { t } = useLanguage();
  const [mode, setMode] = useState("login"); // "login" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [resetSent, setResetSent] = useState(false);

  function validate() {
    if (!email.includes("@")) return t("auth.errorEnterValidEmail");
    if (password.length < 6) return t("auth.errorWeakPassword");
    return null;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setResetSent(false);

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    try {
      const credential =
        mode === "login"
          ? await signInWithEmailAndPassword(auth, email, password)
          : await createUserWithEmailAndPassword(auth, email, password);
      onAuthenticated?.(credential.user);
    } catch (err) {
      setError(mapAuthError(err.code, t));
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword() {
    setError(null);
    if (!email.includes("@")) {
      setError(t("auth.errorEnterEmailForReset"));
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      setResetSent(true);
    } catch (err) {
      setError(mapAuthError(err.code, t));
    }
  }

  return (
    <div className="min-h-screen w-full bg-[#FBF5F7] text-[#1E293B] font-sans flex flex-col relative overflow-hidden">
      <div className="auth-bg-blob auth-bg-blob-1" />
      <div className="auth-bg-blob auth-bg-blob-2" />
      <div className="auth-bg-blob auth-bg-blob-3" />

      <div className="w-full max-w-md mx-auto px-6 pt-4 flex justify-center auth-fade-in auth-fade-in-1 relative z-10">
        <LanguageSwitcher compact />
      </div>

      <div className="w-full max-w-md mx-auto px-6 pb-10 pt-6 bg-gradient-to-b from-[#FDE7F0] to-[#FBF5F7] flex flex-col items-center auth-fade-in auth-fade-in-2 relative z-10">
        <div className="w-14 h-14 rounded-full bg-white shadow-sm border border-[#F0DCE4] flex items-center justify-center mb-4 auth-icon-breathe">
          <Stethoscope size={22} className="text-[#E1396C]" />
        </div>
        <h1 className="text-2xl font-semibold">{t("auth.title")}</h1>
        <p className="text-sm text-[#64748B] mt-1">
          {mode === "login" ? t("auth.subtitleLogin") : t("auth.subtitleSignup")}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="w-full max-w-md mx-auto px-6 pt-6 pb-8 flex-1 flex flex-col gap-4 auth-fade-in auth-fade-in-3 relative z-10">
        <div>
          <label className="flex items-center gap-2 text-sm text-[#64748B] mb-2">
            <Mail size={14} className="text-[#E1396C]" />
            {t("auth.email")}
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("auth.emailPlaceholder")}
            autoComplete="email"
            className="w-full bg-white border border-[#F0DCE4] rounded-xl px-4 py-3 text-sm text-[#1E293B] outline-none focus:border-[#E1396C] shadow-sm"
          />
        </div>

        <div>
          <label className="flex items-center gap-2 text-sm text-[#64748B] mb-2">
            <Lock size={14} className="text-[#E1396C]" />
            {t("auth.password")}
          </label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t("auth.passwordPlaceholder")}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              className="w-full bg-white border border-[#F0DCE4] rounded-xl px-4 py-3 pr-11 text-sm text-[#1E293B] outline-none focus:border-[#E1396C] shadow-sm"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8]"
              aria-label={showPassword ? t("auth.hidePassword") : t("auth.showPassword")}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {mode === "login" && (
          <button
            type="button"
            onClick={handleForgotPassword}
            className="self-end text-[11px] text-[#64748B] active:text-[#E1396C]"
          >
            {t("auth.forgotPassword")}
          </button>
        )}

        {error && <p className="text-[12px] text-[#B91C1C]">{error}</p>}
        {resetSent && <p className="text-[12px] text-[#92400E]">{t("auth.resetSent")}</p>}

        <button
          type="submit"
          disabled={loading}
          className="mt-2 w-full py-3 rounded-xl bg-[#E1396C] text-sm text-white active:bg-[#B91856] disabled:opacity-60"
        >
          {loading ? t("auth.submitLoading") : mode === "login" ? t("auth.submitLogin") : t("auth.submitSignup")}
        </button>

        <p className="text-center text-[12px] text-[#64748B] mt-2">
          {mode === "login" ? t("auth.noAccount") : t("auth.hasAccount")}{" "}
          <button
            type="button"
            onClick={() => {
              setMode((m) => (m === "login" ? "signup" : "login"));
              setError(null);
            }}
            className="text-[#E1396C] underline"
          >
            {mode === "login" ? t("auth.switchToSignup") : t("auth.switchToLogin")}
          </button>
        </p>
      </form>
    </div>
  );
}
