"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Role = "student" | "company" | "admin";

export default function AppNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [role, setRole] = useState<Role | null>(null);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setRole(null);
        return;
      }

      const { data } = await supabase
        .from("profiles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();

      setRole((data?.role as Role | undefined) ?? null);
    })();
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  function navClass(href: string) {
    return pathname === href ? "navlink navlinkActive" : "navlink";
  }

  return (
    <div className="nav">
      <div className="brand">CareerKey</div>

      <div className="navlinks">
        <Link className={navClass("/home")} href="/home">
          Home
        </Link>

        <Link className={navClass("/profile")} href="/profile">
          Profile
        </Link>

        <Link className={navClass("/matches")} href="/matches">
          Matches
        </Link>

        <Link className={navClass("/schedule")} href="/schedule">
          Schedule
        </Link>

        {role === "company" && (
          <Link className={navClass("/company")} href="/company">
            Company
          </Link>
        )}

        {(role === "admin" || role === "company") && (
          <Link className={navClass("/admin/positions")} href="/admin/positions">
            Admin
          </Link>
        )}

        <button className="navlink" type="button" onClick={handleLogout}>
          Log out
        </button>
      </div>
    </div>
  );
}
