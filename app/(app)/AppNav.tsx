"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function AppNav() {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <div className="nav">
      <div className="brand">
        CareerKey <span className="badge">App</span>
      </div>

      <div className="navlinks">
        <Link className={`navlink ${pathname === "/home" ? "navlinkActive" : ""}`} href="/home">
          Home
        </Link>

        <Link
          className={`navlink ${pathname.startsWith("/schedule") ? "navlinkActive" : ""}`}
          href="/schedule"
        >
          Schedule
        </Link>

        <Link className="navlink" href="/admin/positions">
          Admin
        </Link>
        <Link className={`navlink ${pathname === "/profile" ? "navlinkActive" : ""}`} href="/profile">
          Profile
        </Link>

        <button className="navlink" onClick={logout} type="button">
          Log out
        </button>
      </div>
    </div>
  );
}
