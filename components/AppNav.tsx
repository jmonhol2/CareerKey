"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuthorization } from "@/hooks/useAuthorization";
import { supabase } from "@/lib/supabaseClient";
import NavIcon from "@/components/NavIcon";

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
    return active ? "navlink iconNavLink navlinkActive" : "navlink iconNavLink";
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
        <Link
          aria-label="Home"
          className={navClass("/home")}
          data-tooltip="Home"
          href="/home"
        >
          <NavIcon name="home" />
        </Link>

        {authorization.can("student.portal") && (
          <>
            <Link
              aria-label="Profile"
              className={navClass("/profile")}
              data-tooltip="Profile"
              href="/profile"
            >
              <NavIcon name="profile" />
            </Link>
            <Link
              aria-label="Matches"
              className={navClass("/matches")}
              data-tooltip="Matches"
              href="/matches"
            >
              <NavIcon name="matches" />
            </Link>
            <Link
              aria-label="My schedule"
              className={navClass("/schedule")}
              data-tooltip="My schedule"
              href="/schedule"
            >
              <NavIcon name="schedule" />
            </Link>
          </>
        )}

        {authorization.can("company.portal") && (
          <Link
            aria-label="Company workspace"
            className={navClass("/company")}
            data-tooltip="Company workspace"
            href="/company"
          >
            <NavIcon name="company" />
          </Link>
        )}

        {authorization.can("admin.portal") && (
          <Link
            aria-label="Administration"
            className={navClass("/admin")}
            data-tooltip="Administration"
            href="/admin"
          >
            <NavIcon name="admin" />
          </Link>
        )}

        <button
          aria-label="Log out"
          className="navlink iconNavLink"
          data-tooltip="Log out"
          type="button"
          onClick={handleLogout}
        >
          <NavIcon name="logout" />
        </button>
      </div>
    </div>
  );
}
