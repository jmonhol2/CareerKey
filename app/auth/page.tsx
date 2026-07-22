"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import styles from "./auth.module.css";

type Role = "student" | "company";
type Mode = "login" | "signup";

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
  const [role, setRole] = useState<Role>("student");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

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

    router.push(profile?.role === "company" ? "/company" : "/home");
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
            data: { role, display_name: displayName || null },
          },
        });
        if (error) throw error;

        const userId = data.user?.id;
        if (!userId) throw new Error("No user returned from sign up.");

        const { error: profileError } = await supabase.from("profiles").upsert(
          { user_id: userId, role, display_name: displayName || null },
          { onConflict: "user_id" }
        );
        if (profileError) throw profileError;

        if (data.session?.user?.id) {
          await routeAfterLogin();
        } else {
          setMessage("Account created. Check your inbox to confirm your email, then log in.");
          setMode("login");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        await routeAfterLogin();
      }
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
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
