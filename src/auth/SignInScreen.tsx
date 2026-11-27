import { useState, type FormEvent } from "react";
import type { Language, TranslationKey } from "../i18n";
import { AuthConnectionError, InvalidCredentialsError } from "./supabase-auth";

interface SignInScreenProps {
  language: Language;
  t: (key: TranslationKey) => string;
  onSignIn: (email: string, password: string) => Promise<void>;
  onLanguage: (language: Language) => void;
  /** A notice shown before the form, such as "Your session ended". */
  notice?: string;
}

function failureKey(error: unknown): TranslationKey {
  if (error instanceof InvalidCredentialsError) return "auth.invalid";
  if (error instanceof AuthConnectionError) return "auth.connection";
  return "auth.failed";
}

export function SignInScreen({
  language,
  t,
  onSignIn,
  onLanguage,
  notice,
}: SignInScreenProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [failure, setFailure] = useState<TranslationKey | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setFailure(null);
    try {
      await onSignIn(email.trim(), password);
    } catch (error) {
      setFailure(failureKey(error));
      setBusy(false);
    }
  }

  return (
    <main className="signin-screen">
      <form className="signin-card auth-card" onSubmit={(e) => void submit(e)}>
        <div className="brand-mark">b.</div>
        <p className="eyebrow">{t("app.name")}</p>
        <h1>{t("auth.title")}</h1>
        {notice && (
          <p role="status" className="auth-notice">
            {notice}
          </p>
        )}
        <label>
          {t("auth.email")}
          <input
            type="email"
            name="email"
            autoComplete="username"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label>
          {t("auth.password")}
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        {failure && (
          <p role="alert" className="field-error">
            {t(failure)}
          </p>
        )}
        <button type="submit" className="button primary" disabled={busy}>
          {t(busy ? "auth.signingIn" : "auth.submit")}
        </button>
        <label className="language-signin">
          {t("language.english")} / {t("language.spanish")}
          <select
            value={language}
            onChange={(event) => onLanguage(event.target.value as Language)}
          >
            <option value="en">English</option>
            <option value="es">Español</option>
          </select>
        </label>
      </form>
    </main>
  );
}
