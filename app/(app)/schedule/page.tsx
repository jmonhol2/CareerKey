"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Company = {
  id: string;
  company_name: string;
};

type Slot = {
  id: string;
  company_id: string;
  start_time: string;
  end_time: string;
  capacity: number;
  booked: number;
};

type CompanyProfile = {
  company_id: string;
  short_description: string | null;
  long_description: string | null;
  industry: string | null;
  location: string | null;
  website: string | null;
  logo_url: string | null;
  rating: number | null;
  review_count: number | null;
  headquarters: string | null;
  company_size: string | null;
  hiring_types: string[] | null;
  majors: string[] | null;
  skills: string[] | null;
  last_refreshed_at: string | null;
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
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null);
  const [showMore, setShowMore] = useState(false);

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

  async function loadCompanyProfile(companyId: string) {
    const { data, error } = await supabase
      .from("company_profiles")
      .select("*")
      .eq("company_id", companyId)
      .maybeSingle();

    if (error) throw error;

    setCompanyProfile(data ?? null);
    setShowMore(false);
  }
  async function refreshCompanyProfile(companyId: string) {
  const res = await fetch("/api/company-insights", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ companyId }),
  });

  const json = await res.json();

  if (!res.ok) {
    throw new Error(json.error || "Failed to refresh company profile");
  }

  setCompanyProfile(json.profile ?? null);
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
      setShowMore(false);

      await Promise.all([
        loadSlots(selectedCompanyId),
        loadCompanyProfile(selectedCompanyId),
      ]);

      await refreshCompanyProfile(selectedCompanyId);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load company data");
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

              {companyProfile && (
                <div
                  style={{
                    marginBottom: 16,
                    padding: 14,
                    borderRadius: 16,
                    border: "1px solid var(--border)",
                    background: "rgba(255,255,255,0.03)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: 12,
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      {companyProfile.logo_url && (
                        <img
                          src={companyProfile.logo_url}
                          alt={`${selectedCompany?.company_name} logo`}
                          style={{
                            width: 56,
                            height: 56,
                            objectFit: "contain",
                            borderRadius: 12,
                            marginBottom: 10,
                            background: "white",
                            padding: 6,
                          }}
                        />
                      )}

                      <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 6 }}>
                        {selectedCompany?.company_name}
                      </div>

                      <div className="p" style={{ marginBottom: 10 }}>
                        {companyProfile.short_description ||
                          "No company summary available yet."}
                      </div>
                    </div>

                    <button
                      type="button"
                      className="btn"
                      onClick={() => setShowMore(true)}
                    >
                      Show more
                    </button>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                      gap: 10,
                    }}
                  >
                    <div
                      style={{
                        padding: 10,
                        borderRadius: 12,
                        border: "1px solid var(--border)",
                        background: "rgba(255,255,255,0.02)",
                      }}
                    >
                      <div className="p" style={{ fontSize: 12, opacity: 0.8 }}>
                        Industry
                      </div>
                      <div style={{ fontWeight: 700 }}>
                        {companyProfile.industry || "N/A"}
                      </div>
                    </div>

                    <div
                      style={{
                        padding: 10,
                        borderRadius: 12,
                        border: "1px solid var(--border)",
                        background: "rgba(255,255,255,0.02)",
                      }}
                    >
                      <div className="p" style={{ fontSize: 12, opacity: 0.8 }}>
                        Location
                      </div>
                      <div style={{ fontWeight: 700 }}>
                        {companyProfile.location || "N/A"}
                      </div>
                    </div>

                    <div
                      style={{
                        padding: 10,
                        borderRadius: 12,
                        border: "1px solid var(--border)",
                        background: "rgba(255,255,255,0.02)",
                      }}
                    >
                      <div className="p" style={{ fontSize: 12, opacity: 0.8 }}>
                        Rating
                      </div>
                      <div style={{ fontWeight: 700 }}>
                        {companyProfile.rating != null
                          ? `${companyProfile.rating} / 5`
                          : "N/A"}
                      </div>
                    </div>

                    <div
                      style={{
                        padding: 10,
                        borderRadius: 12,
                        border: "1px solid var(--border)",
                        background: "rgba(255,255,255,0.02)",
                      }}
                    >
                      <div className="p" style={{ fontSize: 12, opacity: 0.8 }}>
                        Reviews
                      </div>
                      <div style={{ fontWeight: 700 }}>
                        {companyProfile.review_count != null
                          ? companyProfile.review_count
                          : "N/A"}
                      </div>
                    </div>
                  </div>
                </div>
              )}

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

      {showMore && companyProfile && (
        <div
          onClick={() => setShowMore(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 60,
            background: "rgba(6, 8, 14, 0.72)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            className="card"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(840px, 100%)",
              maxHeight: "85vh",
              overflowY: "auto",
              padding: 18,
              background: "rgba(12, 16, 28, 0.94)",
              boxShadow: "0 20px 60px rgba(0, 0, 0, 0.45)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: 12,
                marginBottom: 12,
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: 22, fontWeight: 900 }}>
                  {selectedCompany?.company_name || "Company profile"}
                </h3>
                <div className="p" style={{ marginTop: 6 }}>
                  Detailed overview and fit information
                </div>
              </div>

              <button type="button" className="btn" onClick={() => setShowMore(false)}>
                Close
              </button>
            </div>

            <div style={{ display: "grid", gap: 12 }}>
              <div
                style={{
                  padding: 12,
                  borderRadius: 12,
                  border: "1px solid var(--border)",
                  background: "rgba(255,255,255,0.02)",
                }}
              >
                <div className="p" style={{ fontSize: 12, opacity: 0.8 }}>
                  Description
                </div>
                <div style={{ fontWeight: 600 }}>
                  {companyProfile.long_description ||
                    companyProfile.short_description ||
                    "No detailed company description available yet."}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div
                  style={{
                    padding: 12,
                    borderRadius: 12,
                    border: "1px solid var(--border)",
                    background: "rgba(255,255,255,0.02)",
                  }}
                >
                  <div className="p" style={{ fontSize: 12, opacity: 0.8 }}>
                    Headquarters
                  </div>
                  <div style={{ fontWeight: 700 }}>
                    {companyProfile.headquarters || "N/A"}
                  </div>
                </div>

                <div
                  style={{
                    padding: 12,
                    borderRadius: 12,
                    border: "1px solid var(--border)",
                    background: "rgba(255,255,255,0.02)",
                  }}
                >
                  <div className="p" style={{ fontSize: 12, opacity: 0.8 }}>
                    Company size
                  </div>
                  <div style={{ fontWeight: 700 }}>{companyProfile.company_size || "N/A"}</div>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div
                  style={{
                    padding: 12,
                    borderRadius: 12,
                    border: "1px solid var(--border)",
                    background: "rgba(255,255,255,0.02)",
                  }}
                >
                  <div className="p" style={{ fontSize: 12, opacity: 0.8 }}>
                    Hiring types
                  </div>
                  <div style={{ fontWeight: 600 }}>
                    {companyProfile.hiring_types?.length
                      ? companyProfile.hiring_types.join(", ")
                      : "N/A"}
                  </div>
                </div>

                <div
                  style={{
                    padding: 12,
                    borderRadius: 12,
                    border: "1px solid var(--border)",
                    background: "rgba(255,255,255,0.02)",
                  }}
                >
                  <div className="p" style={{ fontSize: 12, opacity: 0.8 }}>
                    Website
                  </div>
                  {companyProfile.website ? (
                    <a
                      href={companyProfile.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontWeight: 700 }}
                    >
                      {companyProfile.website}
                    </a>
                  ) : (
                    <div style={{ fontWeight: 700 }}>N/A</div>
                  )}
                </div>
              </div>

              <div
                style={{
                  padding: 12,
                  borderRadius: 12,
                  border: "1px solid var(--border)",
                  background: "rgba(255,255,255,0.02)",
                }}
              >
                <div className="p" style={{ fontSize: 12, opacity: 0.8 }}>
                  Preferred majors
                </div>
                <div style={{ fontWeight: 600 }}>
                  {companyProfile.majors?.length ? companyProfile.majors.join(", ") : "N/A"}
                </div>
              </div>

              <div
                style={{
                  padding: 12,
                  borderRadius: 12,
                  border: "1px solid var(--border)",
                  background: "rgba(255,255,255,0.02)",
                }}
              >
                <div className="p" style={{ fontSize: 12, opacity: 0.8 }}>
                  Skills
                </div>
                <div style={{ fontWeight: 600 }}>
                  {companyProfile.skills?.length ? companyProfile.skills.join(", ") : "N/A"}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
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
