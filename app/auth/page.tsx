"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import {
  defaultRouteForRole,
  isAppRole,
  type AppRole,
} from "@/lib/permissions";
import styles from "./auth.module.css";

type PublicSignupRole = Extract<AppRole, "student" | "company">;
type Mode = "login" | "signup";

function getFriendlyAuthError(error: unknown) {
  const fallback =
    error instanceof Error ? error.message : "Something went wrong.";
  const normalized = fallback.toLocaleLowerCase();

  if (
    normalized.includes("email rate limit") ||
    normalized.includes("rate limit exceeded")
  ) {
    return "CareerKey cannot send another confirmation email right now. Supabase’s test email service allows only two emails per hour for the entire project. Please wait for the hourly limit to reset, then try again.";
  }

  return fallback;
}

export default function AuthPage() {
  return (
    <Suspense fallback={<main className={styles.page}>Loading...</main>}>
      <AuthForm />
    </Suspense>
  );
}

function AuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<Mode>(() =>
    searchParams.get("mode") === "login" ? "login" : "signup"
  );
  const [role, setRole] = useState<PublicSignupRole>("student");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pendingConfirmationEmail, setPendingConfirmationEmail] = useState<
    string | null
  >(null);
  const [resendingConfirmation, setResendingConfirmation] = useState(false);
  const [confirmationMessage, setConfirmationMessage] = useState<string | null>(
    null
  );

  const routeAfterLogin = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/");
      router.refresh();
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    const appRole = isAppRole(profile?.role) ? profile.role : null;
    const shouldPromptForStudentProfile =
      appRole === "student" &&
      user.user_metadata?.profile_onboarding_pending === true;

    router.push(
      shouldPromptForStudentProfile
        ? "/profile?welcome=1"
        : defaultRouteForRole(appRole)
    );
    router.refresh();
  }, [router]);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session?.user?.id) await routeAfterLogin();
    })();
  }, [routeAfterLogin]);

  function changeMode(nextMode: Mode) {
    setMode(nextMode);
    setMessage(null);
    setPendingConfirmationEmail(null);
    setConfirmationMessage(null);
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth?mode=login`,
            data: {
              role,
              display_name: displayName || null,
              profile_onboarding_pending: role === "student",
            },
          },
        });
        if (error) throw error;

        const userId = data.user?.id;
        if (!userId) throw new Error("No user returned from sign up.");

        if (data.session?.user?.id) {
          await routeAfterLogin();
        } else {
          setPendingConfirmationEmail(data.user?.email ?? email);
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        await routeAfterLogin();
      }
    } catch (error: unknown) {
      setMessage(getFriendlyAuthError(error));
    } finally {
      setLoading(false);
    }
  }

  async function resendConfirmationEmail() {
    if (!pendingConfirmationEmail) return;

    setResendingConfirmation(true);
    setConfirmationMessage(null);

    const { error } = await supabase.auth.resend({
      type: "signup",
      email: pendingConfirmationEmail,
    });

    setConfirmationMessage(
      error
        ? getFriendlyAuthError(error)
        : "A new confirmation email is on its way. It may take a minute to arrive."
    );
    setResendingConfirmation(false);
  }

  if (pendingConfirmationEmail) {
    return (
      <main className={styles.page}>
        <Link href="/" className={styles.brand} aria-label="CareerKey home">
          <span className={styles.brandMark} aria-hidden="true">CK</span>
          CareerKey
        </Link>

        <section
          className={`${styles.card} ${styles.confirmationCard}`}
          aria-labelledby="confirm-email-heading"
        >
          <div className={styles.confirmationIcon} aria-hidden="true">
            <span>✓</span>
          </div>
          <span className={styles.eyebrow}>ONE QUICK STEP</span>
          <h1 id="confirm-email-heading">Confirm your email</h1>
          <p className={styles.confirmationLead}>
            Your CareerKey account has been created. We sent a confirmation link
            to:
          </p>
          <strong className={styles.confirmationEmail}>
            {pendingConfirmationEmail}
          </strong>

          <div className={styles.confirmationSteps}>
            <div>
              <span>1</span>
              <p>Open the email from CareerKey.</p>
            </div>
            <div>
              <span>2</span>
              <p>Select the confirmation link.</p>
            </div>
            <div>
              <span>3</span>
              <p>Return here and log in to build your profile.</p>
            </div>
          </div>

          <button
            type="button"
            className={styles.submit}
            onClick={() => changeMode("login")}
          >
            Continue to login
            <span aria-hidden="true">→</span>
          </button>

          <button
            type="button"
            className={styles.resendButton}
            onClick={() => void resendConfirmationEmail()}
            disabled={resendingConfirmation}
          >
            {resendingConfirmation
              ? "Sending another email..."
              : "Resend confirmation email"}
          </button>

          {confirmationMessage && (
            <p className={styles.message} role="status">
              {confirmationMessage}
            </p>
          )}

          <p className={styles.confirmationHelp}>
            Didn’t receive it? Check your spam folder or confirm that the email
            address above is correct.
          </p>
        </section>

        <p className={styles.footerNote}>
          Your profile will be ready when you return.
        </p>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <Link href="/" className={styles.brand} aria-label="CareerKey home">
        <span className={styles.brandMark} aria-hidden="true">CK</span>
        CareerKey
      </Link>

      <section className={styles.card}>
        <div className={styles.intro}>
          <span className={styles.eyebrow}>
            {mode === "signup" ? "JOIN CAREERKEY" : "WELCOME BACK"}
          </span>
          <h1>{mode === "signup" ? "Create your account" : "Log in to CareerKey"}</h1>
          <p>
            {mode === "signup"
              ? "Start building better career connections today."
              : "Continue to your matches, profile, and schedule."}
          </p>
        </div>

        <div className={styles.tabs} aria-label="Authentication options">
          <button
            type="button"
            className={mode === "signup" ? styles.activeTab : styles.tab}
            onClick={() => changeMode("signup")}
          >
            Sign up
          </button>
          <button
            type="button"
            className={mode === "login" ? styles.activeTab : styles.tab}
            onClick={() => changeMode("login")}
          >
            Log in
          </button>
        </div>

        <form className={styles.form} onSubmit={onSubmit}>
          {mode === "signup" && (
            <>
              <fieldset className={styles.roleFieldset}>
                <legend>I am joining as a</legend>
                <div className={styles.roleOptions}>
                  <button
                    type="button"
                    className={role === "student" ? styles.activeRole : styles.roleOption}
                    aria-pressed={role === "student"}
                    onClick={() => setRole("student")}
                  >
                    <span className={styles.roleIcon}>S</span>
                    <span>
                      <strong>Student</strong>
                      <small>Find opportunities</small>
                    </span>
                  </button>
                  <button
                    type="button"
                    className={role === "company" ? styles.activeRole : styles.roleOption}
                    aria-pressed={role === "company"}
                    onClick={() => setRole("company")}
                  >
                    <span className={`${styles.roleIcon} ${styles.companyRole}`}>C</span>
                    <span>
                      <strong>Company</strong>
                      <small>Meet candidates</small>
                    </span>
                  </button>
                </div>
              </fieldset>

              <label className={styles.field} htmlFor="display-name">
                <span>Display name <small>Optional</small></span>
                <input
                  id="display-name"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder={role === "student" ? "Jordan Lee" : "Recruiting team name"}
                  autoComplete="name"
                />
              </label>
            </>
          )}

          <label className={styles.field} htmlFor="email">
            <span>Email address</span>
            <input
              id="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              type="email"
              autoComplete="email"
              required
            />
          </label>

          <label className={styles.field} htmlFor="password">
            <span>Password</span>
            <input
              id="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="At least 6 characters"
              type="password"
              minLength={6}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              required
            />
          </label>

          <button className={styles.submit} disabled={loading} type="submit">
            {loading ? "Please wait..." : mode === "signup" ? "Create account" : "Log in"}
            {!loading && <span aria-hidden="true">→</span>}
          </button>

          {mode === "signup" && role === "student" && (
            <p className={styles.nextStep}>
              Next, we’ll invite you to complete your profile. You can use your
              resume, enter details manually, or come back later.
            </p>
          )}

          {message && (
            <p className={styles.message} role="status">
              {message}
            </p>
          )}
        </form>

        <p className={styles.switchPrompt}>
          {mode === "signup" ? "Already have an account?" : "New to CareerKey?"}{" "}
          <button type="button" onClick={() => changeMode(mode === "signup" ? "login" : "signup")}>
            {mode === "signup" ? "Log in" : "Create an account"}
          </button>
        </p>
      </section>

      <p className={styles.footerNote}>A simple path to better career conversations.</p>
    </main>
  );
}
