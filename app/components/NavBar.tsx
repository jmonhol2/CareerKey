"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function NavBar() {
  const pathname = usePathname();
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      setEmail(data.session?.user?.email ?? null);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user?.email ?? null);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  async function logout() {
    await supabase.auth.signOut();
    router.push("/");
  }

  const tabs = [
    { href: "/home", label: "Home" },
    { href: "/schedule", label: "Schedule" },
  ];

  return (
    <div style={wrap}>
      <div style={brand}>
        <span style={{ fontWeight: 900 }}>CareerKey</span>
        <span style={pill}>Prototype</span>
      </div>

      <div style={links}>
        {tabs.map((t) => {
          const active = pathname === t.href || pathname.startsWith(t.href + "/");
          return (
            <Link
              key={t.href}
              href={t.href}
              style={{
                ...link,
                ...(active ? activeStyle : {}),
              }}
            >
              {t.label}
            </Link>
          );
        })}
      </div>

      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
        {email && <span style={{ fontSize: 12, opacity: 0.8 }}>{email}</span>}
        <button className="btn" onClick={logout}>
          Log out
        </button>
      </div>
    </div>
  );
}

const wrap: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "12px 14px",
  borderBottom: "1px solid rgba(233,236,241,0.15)",
  position: "sticky",
  top: 0,
  zIndex: 10,
  background: "rgba(6, 9, 18, 0.55)",
  backdropFilter: "blur(10px)",
};

const brand: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
};

const pill: React.CSSProperties = {
  fontSize: 12,
  padding: "2px 8px",
  borderRadius: 999,
  border: "1px solid rgba(233,236,241,0.18)",
  opacity: 0.9,
};

const links: React.CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
};

const link: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 999,
  border: "1px solid rgba(233,236,241,0.12)",
  textDecoration: "none",
};

const activeStyle: React.CSSProperties = {
  borderColor: "rgba(133,166,255,0.65)",
  background: "rgba(90,120,255,0.10)",
};