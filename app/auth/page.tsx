"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Role = "student" | "company";

export default function AuthPage() {
  const router = useRouter();

  const [mode, setMode] = useState<"login" | "signup">("signup");
  const [role, setRole] = useState<Role>("student");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function routeToHome() {
    router.push("/home");
    router.refresh();
  }

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      if (session?.user?.id) router.push("/home");
    })();
  }, [router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);

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
        if (!userId) throw new Error("No user returned from signUp.");

        const { error: upsertErr } = await supabase
          .from("profiles")
          .upsert(
            { user_id: userId, role, display_name: displayName || null },
            { onConflict: "user_id" }
          );

        if (upsertErr) throw upsertErr;

        // If email confirmation is ON, there may be no session yet
        if (data.session?.user?.id) {
          await routeToHome();
        } else {
          setMsg(
            "Account created. If email confirmation is enabled, check your inbox, then log in."
          );
          setMode("login");
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;

        await routeToHome();
      }
    } catch (err: any) {
      setMsg(err?.message ?? "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={pageStyle}>
      <div style={shellStyle} className="authShell">
        {/* Left: About / marketing */}
        <section style={aboutCardStyle}>
          <div className="kicker">CareerKey • Prototype</div>
          <h1
            className="h1"
            style={{ fontSize: 40, lineHeight: 1.05, marginTop: 6 }}
          >
            Helping you get your foot in the door.
          </h1>

          <p className="p" style={{ marginTop: 10 }}>
            CareerKey is a simple prototype for the Engineering Professional
            Practice (EPP) Expo workflow. It’s designed to help students and
            companies connect faster and make scheduling conversations easier.
          </p>

          <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
            <div style={featureStyle}>
              <div style={dotStyle} />
              <div>
                <div style={featureTitleStyle}>Student profiles</div>
                <div className="p" style={featureTextStyle}>
                  Create a profile and (soon) upload a resume to highlight skills
                  and interests.
                </div>
              </div>
            </div>

            <div style={featureStyle}>
              <div style={dotStyle} />
              <div>
                <div style={featureTitleStyle}>Company registration</div>
                <div className="p" style={featureTextStyle}>
                  Companies define what they’re looking for and manage available
                  time slots.
                </div>
              </div>
            </div>

            <div style={featureStyle}>
              <div style={dotStyle} />
              <div>
                <div style={featureTitleStyle}>
                  Scheduling that reduces waiting
                </div>
                <div className="p" style={featureTextStyle}>
                  Students book open appointments, receive an appointment ID, and
                  add it to a calendar.
                </div>
              </div>
            </div>
          </div>

          <div style={{ marginTop: 14, opacity: 0.9 }}>
            <div className="p" style={{ fontSize: 13 }}>
              Note: This is a class prototype — minimum necessary data, opt-in
              use, and simple demo flows.
            </div>
          </div>
        </section>

        {/* Right: Auth card */}
        <section style={authCardStyle} className="card">
          <div className="kicker">Test Auth</div>

          <h2 className="h1" style={{ fontSize: 28, marginTop: 6 }}>
            {mode === "signup" ? "Create an account" : "Log in"}
          </h2>
          <p className="p" style={{ marginTop: 6 }}>
            Choose Student or Company at signup. After login, you’ll be sent to
            your Home page.
          </p>

          <div className="btnRow" style={{ marginTop: 12 }}>
            <button
              className={`btn ${mode === "signup" ? "btnPrimary" : ""}`}
              onClick={() => setMode("signup")}
              type="button"
            >
              Sign up
            </button>
            <button
              className={`btn ${mode === "login" ? "btnPrimary" : ""}`}
              onClick={() => setMode("login")}
              type="button"
            >
              Log in
            </button>
          </div>

          <form
            onSubmit={onSubmit}
            style={{ display: "grid", gap: 10, marginTop: 14 }}
          >
            {mode === "signup" && (
              <>
                <label className="p" style={{ fontSize: 14 }}>
                  Account type
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as Role)}
                  style={fieldStyle}
                >
                  <option value="student">Student</option>
                  <option value="company">Company</option>
                </select>

                <label className="p" style={{ fontSize: 14 }}>
                  Display name (optional)
                </label>
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Jordan / DENSO Recruiting"
                  style={fieldStyle}
                />
              </>
            )}

            <label className="p" style={{ fontSize: 14 }}>
              Email
            </label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@utk.edu"
              type="email"
              style={fieldStyle}
              required
            />

            <label className="p" style={{ fontSize: 14 }}>
              Password
            </label>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              type="password"
              style={fieldStyle}
              required
            />

            <button
              className="btn btnPrimary"
              disabled={loading}
              type="submit"
              style={{ marginTop: 6 }}
            >
              {loading ? "Working…" : mode === "signup" ? "Create account" : "Log in"}
            </button>

            {msg && (
              <div className="p" style={{ fontSize: 13, opacity: 0.95 }}>
                {msg}
              </div>
            )}
          </form>
        </section>
      </div>
    </main>
  );
}

/** Layout styles */
const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  display: "grid",
  placeItems: "center",
  padding: "32px 18px",
};

const shellStyle: React.CSSProperties = {
  width: "min(1100px, 100%)",
  display: "grid",
  gap: 18,
  gridTemplateColumns: "1fr",
};

const aboutCardStyle: React.CSSProperties = {
  border: "1px solid rgba(233,236,241,0.14)",
  borderRadius: 20,
  padding: 22,
  background: "rgba(0,0,0,0.10)",
  backdropFilter: "blur(10px)",
};

const authCardStyle: React.CSSProperties = {
  borderRadius: 20,
  padding: 22,
};

/** UI styles */
const fieldStyle: React.CSSProperties = {
  padding: 10,
  borderRadius: 12,
  border: "1px solid rgba(233,236,241,0.18)",
  background: "transparent",
  color: "inherit",
};

const featureStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "12px 1fr",
  gap: 10,
  alignItems: "start",
  padding: "10px 12px",
  borderRadius: 14,
  border: "1px solid rgba(233,236,241,0.12)",
  background: "rgba(0,0,0,0.10)",
};

const dotStyle: React.CSSProperties = {
  width: 10,
  height: 10,
  borderRadius: 999,
  marginTop: 5,
  background: "rgba(120,170,255,0.9)",
  boxShadow: "0 0 0 4px rgba(120,170,255,0.12)",
};

const featureTitleStyle: React.CSSProperties = {
  fontWeight: 700,
  marginBottom: 2,
};

const featureTextStyle: React.CSSProperties = {
  fontSize: 13,
  opacity: 0.95,
};
