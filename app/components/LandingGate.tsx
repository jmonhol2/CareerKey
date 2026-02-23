"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabaseClient";
import AuthPage from "../auth/page"; // reuse your existing Auth UI

type Role = "student" | "company";

export default function LandingGate() {
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<Role | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);

    try {
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;

      if (!user) {
        setRole(null);
        setDisplayName(null);
        return;
      }

      const { data: prof, error: profErr } = await supabase
        .from("profiles")
        .select("role, display_name")
        .eq("user_id", user.id)
        .single();

      if (profErr) throw profErr;

      setRole(prof.role as Role);
      setDisplayName(prof.display_name ?? null);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load profile");
      setRole(null);
      setDisplayName(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();

    // Update the UI when auth state changes (login/logout)
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      load();
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  async function logout() {
    await supabase.auth.signOut();
    // onAuthStateChange will re-render to Auth UI
  }

  if (loading) {
    return <p className="p">Loading…</p>;
  }

  // Not logged in: show Auth UI as the landing page
  if (!role) {
    return <AuthPage />;
  }

  // Logged in: show role-based landing content
  if (role === "student") {
    return (
      <main>
        <div className="kicker">Student</div>
        <h1 className="h1" style={{ fontSize: 34 }}>
          Welcome{displayName ? `, ${displayName}` : ""} 👋
        </h1>
        <p className="p" style={{ maxWidth: 820 }}>
          This is your student landing view. Next we’ll add profile fields + resume upload + match results.
        </p>

        <div className="grid">
          <section className="card" style={{ gridColumn: "span 6" }}>
            <h3 className="cardTitle">Book a time slot</h3>
            <p className="p">Choose a company and book an open slot. You’ll get a confirmation + calendar file.</p>
            <div className="btnRow">
              <Link className="btn btnPrimary" href="/schedule">Go to Scheduling →</Link>
            </div>
          </section>

          <section className="card" style={{ gridColumn: "span 6" }}>
            <h3 className="cardTitle">Profile (soon)</h3>
            <p className="p">Resume upload + keyword extraction + match scoring will show up here next.</p>
            <div className="btnRow">
              <span className="btn" style={{ opacity: 0.6, pointerEvents: "none" }}>Upload Resume (soon)</span>
            </div>
          </section>
        </div>

        <div className="btnRow" style={{ marginTop: 16 }}>
          <button className="btn" onClick={logout}>Log out</button>
        </div>
      </main>
    );
  }

  // Company landing
  return (
    <main>
      <div className="kicker">Company</div>
      <h1 className="h1" style={{ fontSize: 34 }}>
        Welcome{displayName ? `, ${displayName}` : ""} 👋
      </h1>
      <p className="p" style={{ maxWidth: 820 }}>
        This is your company landing view. Next we’ll add admin tools to create slots and view bookings.
      </p>

      <div className="grid">
        <section className="card" style={{ gridColumn: "span 6" }}>
          <h3 className="cardTitle">View scheduling</h3>
          <p className="p">See the student booking flow and the available slots.</p>
          <div className="btnRow">
            <Link className="btn btnPrimary" href="/schedule">Open Scheduling →</Link>
          </div>
        </section>

        <section className="card" style={{ gridColumn: "span 6" }}>
          <h3 className="cardTitle">Admin (soon)</h3>
          <p className="p">Create time slots, set capacity, and view appointment IDs.</p>
          <div className="btnRow">
            <span className="btn" style={{ opacity: 0.6, pointerEvents: "none" }}>Create Slots (soon)</span>
          </div>
        </section>
      </div>

      <div className="btnRow" style={{ marginTop: 16 }}>
        <button className="btn" onClick={logout}>Log out</button>
      </div>
    </main>
  );
}
