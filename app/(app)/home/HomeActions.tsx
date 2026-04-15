"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function HomeActions() {
  const router = useRouter();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <div className="btnRow">
      <Link href="/profile" className="btn">
        Profile
      </Link>

      <Link href="/matches" className="btn btnPrimary">
        Matches <span aria-hidden>→</span>
      </Link>

      <Link href="/schedule" className="btn">
        Schedule
      </Link>

      <button type="button" className="btn" onClick={handleLogout}>
        Log out
      </button>
    </div>
  );
}
