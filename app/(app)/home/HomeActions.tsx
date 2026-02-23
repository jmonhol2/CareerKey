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
      <Link href="/schedule" className="btn btnPrimary">
        Go to Schedule <span aria-hidden>→</span>
      </Link>

      <button type="button" className="btn" onClick={handleLogout}>
        Log out
      </button>
    </div>
  );
}
