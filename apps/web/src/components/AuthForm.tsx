import type { FormEventHandler } from "react";
import type { AuthMode } from "../types";

interface AuthFormProps {
  authMode: AuthMode;
  isSubmitting: boolean;
  errorMessage: string;
  notice: string;
  onAuthModeChange: (mode: AuthMode) => void;
  onSubmit: FormEventHandler<HTMLFormElement>;
}

export default function AuthForm({
  authMode,
  isSubmitting,
  errorMessage,
  notice,
  onAuthModeChange,
  onSubmit
}: AuthFormProps) {
  return (
    <>
      <div className="auth-card__heading">
        <p className="eyebrow">{authMode === "login" ? "WELCOME BACK" : "GET STARTED"}</p>
        <h2 id="auth-heading">{authMode === "login" ? "Sign in to WorkSphere" : "Create your account"}</h2>
        <p>{authMode === "login" ? "Your team is just a moment away." : "Start making good work happen."}</p>
      </div>

      <div className="auth-tabs" role="tablist" aria-label="Account action">
        <button
          type="button"
          role="tab"
          aria-selected={authMode === "login"}
          className={authMode === "login" ? "auth-tabs__tab is-active" : "auth-tabs__tab"}
          onClick={() => onAuthModeChange("login")}
        >
          Sign in
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={authMode === "register"}
          className={authMode === "register" ? "auth-tabs__tab is-active" : "auth-tabs__tab"}
          onClick={() => onAuthModeChange("register")}
        >
          Create account
        </button>
      </div>

      <form className="auth-form" onSubmit={onSubmit}>
        {authMode === "register" && (
          <label>
            <span>Your name</span>
            <input
              name="displayName"
              type="text"
              autoComplete="name"
              minLength={2}
              maxLength={80}
              placeholder="Alex Morgan"
              required
            />
          </label>
        )}
        <label>
          <span>Email address</span>
          <input
            name="email"
            type="email"
            autoComplete="email"
            maxLength={254}
            placeholder="you@company.com"
            required
          />
        </label>
        <label>
          <span>Password</span>
          <input
            name="password"
            type="password"
            autoComplete={authMode === "login" ? "current-password" : "new-password"}
            minLength={authMode === "register" ? 12 : 1}
            maxLength={128}
            placeholder={authMode === "register" ? "At least 12 characters" : "Enter your password"}
            required
          />
        </label>

        {errorMessage && <p className="form-message form-message--error" role="alert">{errorMessage}</p>}
        {notice && <p className="form-message form-message--success" role="status">{notice}</p>}

        <button className="button" type="submit" disabled={isSubmitting}>
          {isSubmitting
            ? (authMode === "login" ? "Signing in…" : "Creating account…")
            : (authMode === "login" ? "Sign in" : "Create account")}
          {!isSubmitting && <span aria-hidden="true">→</span>}
        </button>
      </form>

      <p className="auth-card__footnote">
        {authMode === "login"
          ? "Your session is protected with secure, httpOnly cookies."
          : "By creating an account, you agree to work better together."}
      </p>
    </>
  );
}
