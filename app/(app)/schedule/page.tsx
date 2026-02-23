"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Company = { id: string; company_name: string };
type Slot = {
  id: string;
  company_id: string;
  start_time: string;
  end_time: string;
  capacity: number;
  booked: number;
};

function getOrCreateStudentId(): string {
  const key = "careerkey_student_id";
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const newId = crypto.randomUUID();
  localStorage.setItem(key, newId);
  return newId;
}

function getDefaultTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

function getOrInitTimeZone(): string {
  const key = "careerkey_timezone";
  const saved = typeof window !== "undefined" ? localStorage.getItem(key) : null;
  return saved || getDefaultTimeZone();
}

export default function SchedulePage() {
  const router = useRouter();

  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Timezone selector (defaults to user's timezone, persisted in localStorage)
  const [timeZone, setTimeZone] = useState<string>(getOrInitTimeZone());

  useEffect(() => {
    localStorage.setItem("careerkey_timezone", timeZone);
  }, [timeZone]);

  const selectedCompany = useMemo(
    () => companies.find((c) => c.id === selectedCompanyId) ?? null,
    [companies, selectedCompanyId]
  );

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  async function loadCompanies() {
    const { data, error } = await supabase
      .from("companies")
      .select("id, company_name")
      .order("company_name");

    if (error) throw error;

    setCompanies(data ?? []);
    if (!selectedCompanyId && data?.length) setSelectedCompanyId(data[0].id);
  }

  async function loadSlots(companyId: string) {
    const { data: slotRows, error: slotErr } = await supabase
      .from("time_slots")
      .select("id, company_id, start_time, end_time, capacity")
      .eq("company_id", companyId)
      .order("start_time");

    if (slotErr) throw slotErr;

    const slotIds = (slotRows ?? []).map((s) => s.id);
    const bookedMap = new Map<string, number>();

    if (slotIds.length > 0) {
      const { data: apptRows, error: apptErr } = await supabase
        .from("appointments")
        .select("slot_id")
        .in("slot_id", slotIds)
        .eq("status", "booked");

      if (apptErr) throw apptErr;

      for (const r of apptRows ?? []) {
        bookedMap.set(r.slot_id, (bookedMap.get(r.slot_id) ?? 0) + 1);
      }
    }

    const merged: Slot[] = (slotRows ?? []).map((s: any) => ({
      ...s,
      booked: bookedMap.get(s.id) ?? 0,
    }));

    setSlots(merged);
  }

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);
        await loadCompanies();
      } catch (e: any) {
        setError(e?.message ?? "Failed to load companies");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedCompanyId) return;
    (async () => {
      try {
        setError(null);
        await loadSlots(selectedCompanyId);
      } catch (e: any) {
        setError(e?.message ?? "Failed to load slots");
      }
    })();
  }, [selectedCompanyId]);

  async function book(slotId: string) {
    try {
      setBookingId(slotId);
      setError(null);

      const studentId = getOrCreateStudentId();

      const { data, error } = await supabase.rpc("book_slot", {
        p_slot_id: slotId,
        p_student_id: studentId,
      });

      if (error) throw error;

      if (selectedCompanyId) await loadSlots(selectedCompanyId);

      router.push(
        `/schedule/confirmation?appointmentId=${encodeURIComponent(
          String(data)
        )}&slotId=${encodeURIComponent(slotId)}&tz=${encodeURIComponent(timeZone)}`
      );
    } catch (e: any) {
      setError(e?.message ?? "Booking failed");
    } finally {
      setBookingId(null);
    }
  }

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString([], {
      timeZone,
      dateStyle: "medium",
      timeStyle: "short",
    });

  return (
    <div className="container">
      <div className="shell">
        {/* Top nav */}
        <div className="nav">
          <div className="brand">
            CareerKey <span className="badge">Scheduling</span>
          </div>

          <div className="navlinks">
            <Link className="navlink" href="/home">
              Home
            </Link>
            <Link className="navlink navlinkActive" href="/schedule">
              Schedule
            </Link>
            <button className="navlink" type="button" onClick={handleLogout}>
              Log out
            </button>
          </div>
        </div>

        <div className="main">
          <div className="kicker">EXPO SCHEDULING</div>
          <h1 className="h1" style={{ fontSize: 32 }}>
            Expo Scheduling
          </h1>
          <p className="p" style={{ marginBottom: 12 }}>
            Select a company, then book an available time slot.
          </p>

          <div style={{ marginBottom: 12 }}>
            <label className="p" style={{ fontSize: 14, marginRight: 8 }}>
              Time zone:
            </label>
            <select
              value={timeZone}
              onChange={(e) => setTimeZone(e.target.value)}
              style={fieldStyle}
            >
              <option value={getDefaultTimeZone()}>My time zone (auto)</option>
              <option value="America/New_York">Expo time (America/New_York)</option>
              <option value="America/Chicago">America/Chicago</option>
              <option value="America/Denver">America/Denver</option>
              <option value="America/Los_Angeles">America/Los_Angeles</option>
              <option value="UTC">UTC</option>
            </select>
          </div>

          {loading && <p className="p">Loading…</p>}

          {error && (
            <div className="card" style={{ marginBottom: 16 }}>
              <b>Error:</b> {error}
            </div>
          )}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "280px 1fr",
              gap: 16,
            }}
          >
            <section className="card">
              <h2 style={{ fontSize: 16, marginTop: 0 }}>Companies</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {companies.map((c) => {
                  const active = c.id === selectedCompanyId;
                  return (
                    <button
                      key={c.id}
                      onClick={() => setSelectedCompanyId(c.id)}
                      className="btn"
                      style={{
                        justifyContent: "flex-start",
                        background: active
                          ? "rgba(87, 112, 255, 0.12)"
                          : "rgba(255,255,255,0.03)",
                        borderColor: active
                          ? "rgba(87, 112, 255, 0.45)"
                          : "var(--border)",
                      }}
                      type="button"
                    >
                      {c.company_name}
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="card">
              <h2 style={{ fontSize: 16, marginTop: 0 }}>
                Slots {selectedCompany ? `— ${selectedCompany.company_name}` : ""}
              </h2>

              {slots.length === 0 ? (
                <p className="p">No slots found for this company.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {slots.map((s) => {
                    const full = s.booked >= s.capacity;
                    return (
                      <div
                        key={s.id}
                        className="card"
                        style={{
                          padding: 14,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 12,
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 800 }}>
                            {fmt(s.start_time)} → {fmt(s.end_time)}
                          </div>
                          <div className="p" style={{ fontSize: 13 }}>
                            Capacity: {s.booked}/{s.capacity}{" "}
                            {full ? "(Full)" : ""}
                          </div>
                        </div>

                        <button
                          disabled={full || bookingId === s.id}
                          onClick={() => book(s.id)}
                          className={`btn ${!full ? "btnPrimary" : ""}`}
                          style={{
                            opacity: bookingId === s.id ? 0.7 : 1,
                            cursor: full ? "not-allowed" : "pointer",
                          }}
                          type="button"
                        >
                          {bookingId === s.id
                            ? "Booking…"
                            : full
                            ? "Unavailable"
                            : "Book"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

const fieldStyle: React.CSSProperties = {
  padding: 10,
  borderRadius: 12,
  border: "1px solid var(--border)",
  background: "transparent",
  color: "inherit",
};
