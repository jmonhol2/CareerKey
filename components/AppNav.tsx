"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuthorization } from "@/hooks/useAuthorization";
import { supabase } from "@/lib/supabaseClient";

export default function AppNav() {
  const pathname = usePathname();
  const router = useRouter();
  const authorization = useAuthorization();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  function navClass(href: string) {
    const active = href === "/home" ? pathname === href : pathname.startsWith(href);
    return active ? "navlink navlinkActive" : "navlink";
  }

  return (
    <div className="nav">
      <div className="brand">
        <span className="appBrandMark" aria-hidden="true">
          <span className="appKeyRing" />
          <span className="appKeyStem" />
        </span>
        <span>CareerKey</span>
      </div>

      <div className="navlinks">
        <Link className={navClass("/home")} href="/home">
          Home
        </Link>

        {authorization.can("student.portal") && (
          <>
            <Link className={navClass("/profile")} href="/profile">Profile</Link>
            <Link className={navClass("/matches")} href="/matches">Matches</Link>
            <Link className={navClass("/schedule")} href="/schedule">Schedule</Link>
          </>
        )}

        {authorization.can("company.portal") && (
          <Link className={navClass("/company")} href="/company">
            Company
          </Link>
        )}

        {authorization.can("admin.portal") && (
          <Link className={navClass("/admin")} href="/admin">
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
