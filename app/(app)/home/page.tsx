"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";

type Role = "student" | "company";

export default function HomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<Role | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setMsg(null);

      const { data: sess } = await supabase.auth.getSession();
      const user = sess.session?.user;

      if (!user) {
        router.push("/");
        return;
      }

      const { data: prof, error: profErr } = await supabase
        .from("profiles")
        .select("role, display_name")
        .eq("user_id", user.id)
        .maybeSingle();

      if (profErr) setMsg(`Profile read failed: ${profErr.message}`);

      if (prof?.role) {
        setRole(prof.role as Role);
        setName(prof.display_name ?? null);
        setLoading(false);
        return;
      }

      const meta = (user.user_metadata || {}) as any;
      const metaRole = (meta.role as Role) || "student";
      const metaName = (meta.display_name as string | null) ?? null;

      const { error: insErr } = await supabase.from("profiles").insert({
        user_id: user.id,
        role: metaRole,
        display_name: metaName,
      });

      if (insErr) {
        setMsg(`Profile could not be created: ${insErr.message}`);
        setRole(null);
        setName(null);
        setLoading(false);
        return;
      }

      const { data: prof2, error: prof2Err } = await supabase
        .from("profiles")
        .select("role, display_name")
        .eq("user_id", user.id)
        .single();

      if (prof2Err) {
        setMsg(`Profile created but could not be read: ${prof2Err.message}`);
        setRole(null);
        setName(null);
        setLoading(false);
        return;
      }

      setRole(prof2.role as Role);
      setName(prof2.display_name ?? null);
      setLoading(false);
    })();
  }, [router]);

  if (loading) {
    return (
      <main style={pageStyle}>
        <div className="card" style={{ width: "min(820px, 100%)" }}>
          <div className="kicker">HOME</div>
          <h1 className="h1" style={{ fontSize: 34, marginTop: 8 }}>Loading…</h1>
          <p className="p">Fetching your profile.</p>
        </div>
      </main>
    );
  }

  const title =
    role === "company" ? "Company Dashboard" : "Student Dashboard";

  const subtitle =
    role === "company"
      ? "Manage scheduling and (soon) create time slots and view bookings."
      : "Book time slots, track appointments, and (soon) build your profile for matching.";

  return (
    <main style={pageStyle}>
      <div className="card" style={cardStyle}>
        <div style={headerRow}>
          <div>
            <div className="kicker">HOME</div>
            <h1 className="h1" style={{ fontSize: 36, marginTop: 8 }}>
              Welcome{name ? `, ${name}` : ""} 👋
            </h1>
            <p className="p" style={{ marginTop: 6, maxWidth: 720 }}>
              <b>{title}</b> — {subtitle}
            </p>
          </div>

          <div style={rolePill}>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Role</div>
            <div style={{ fontWeight: 800, marginTop: 2 }}>
              {role ?? "unknown"}
            </div>
          </div>
        </div>

        {msg && (
          <div style={noticeStyle}>
            <b>Note:</b> {msg}
          </div>
        )}

        <div style={gridStyle}>
          <section style={panelStyle}>
            <h2 style={panelTitle}>Quick Actions</h2>
            <p className="p" style={{ fontSize: 13, marginTop: 6 }}>
              Jump into the main workflow.
            </p>

            <div className="btnRow" style={{ marginTop: 12 }}>
              <Link className="btn btnPrimary" href="/schedule">
                Go to Schedule →
              </Link>
              <Link className="btn" href="/schedule">
                View Appointments (soon)
              </Link>
            </div>
          </section>

          <section style={panelStyle}>
            <h2 style={panelTitle}>What’s Next</h2>
            <ul style={listStyle}>
              <li>Resume upload + parsing (skills/keywords)</li>
              <li>Company criteria & match scoring</li>
              <li>Company admin: create slot blocks & capacity</li>
              <li>Student: “My Appointments” history</li>
            </ul>
          </section>
        </div>

        <div style={footerStyle}>
          <div className="p" style={{ fontSize: 12 }}>
            Prototype note: avoid sensitive personal data.
          </div>
        </div>
      </div>
    </main>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: "calc(100vh - 60px)",
  display: "grid",
  placeItems: "center",
  padding: "22px 18px",
};

const cardStyle: React.CSSProperties = {
  width: "min(980px, 100%)",
  padding: 22,
};

const headerRow: React.CSSProperties = {
  display: "flex",
  gap: 14,
  justifyContent: "space-between",
  alignItems: "flex-start",
  flexWrap: "wrap",
};

const rolePill: React.CSSProperties = {
  border: "1px solid rgba(233,236,241,0.14)",
  borderRadius: 16,
  padding: "10px 12px",
  background: "rgba(255,255,255,0.03)",
  minWidth: 140,
};

const noticeStyle: React.CSSProperties = {
  marginTop: 14,
  padding: 12,
  borderRadius: 14,
  border: "1px solid rgba(233,236,241,0.14)",
  background: "rgba(255,255,255,0.03)",
};

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: 14,
  marginTop: 16,
};

const panelStyle: React.CSSProperties = {
  border: "1px solid rgba(233,236,241,0.12)",
  borderRadius: 18,
  padding: 16,
  background: "rgba(0,0,0,0.10)",
};

const panelTitle: React.CSSProperties = {
  margin: 0,
  fontSize: 16,
  fontWeight: 900,
};

const listStyle: React.CSSProperties = {
  marginTop: 10,
  marginBottom: 0,
  paddingLeft: 18,
  lineHeight: 1.7,
  opacity: 0.9,
};

const footerStyle: React.CSSProperties = {
  marginTop: 16,
  paddingTop: 12,
  borderTop: "1px solid rgba(233,236,241,0.12)",
};