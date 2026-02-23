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

      // 1) Try read profile
      const { data: prof, error: profErr } = await supabase
        .from("profiles")
        .select("role, display_name")
        .eq("user_id", user.id)
        .maybeSingle(); // avoids throwing when row missing

      // 2) If missing, create a default profile (prototype behavior)
      if (!prof && profErr === null) {
        // not expected, but safe
      }

      if (!prof) {
        const { error: insErr } = await supabase.from("profiles").insert({
          user_id: user.id,
          role: "student", // default; later you can let user pick/update
          display_name: null,
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

        setRole((prof2.role as Role) ?? null);
        setName(prof2.display_name ?? null);
        setLoading(false);
        return;
      }

      // 3) Profile exists
      setRole((prof.role as Role) ?? null);
      setName(prof.display_name ?? null);
      setLoading(false);
    })();
  }, [router]);

  async function logout() {
    await supabase.auth.signOut();
    router.push("/");
  }

  if (loading) return <main><p className="p">Loading…</p></main>;

  return (
    <main>
      <div className="kicker">Home</div>
      <h1 className="h1" style={{ fontSize: 34 }}>
        Welcome{ name ? `, ${name}` : "" }
      </h1>

      <p className="p" style={{ maxWidth: 720 }}>
        Role: <b>{role ?? "unknown"}</b>. This is your post-login hub.
      </p>

      {msg && (
        <p className="p" style={{ fontSize: 13, opacity: 0.95 }}>
          {msg}
        </p>
      )}

      <div className="btnRow" style={{ marginTop: 14 }}>
        <Link className="btn btnPrimary" href="/schedule">
          Go to Schedule →
        </Link>
        <button className="btn" onClick={logout}>
          Log out
        </button>
      </div>
    </main>
  );
}
