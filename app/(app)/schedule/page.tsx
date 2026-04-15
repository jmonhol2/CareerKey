"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import AppNav from "@/components/AppNav";

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

type CompanyPosition = {
  id: string;
  company_id: string;
  title: string;
  location_city: string | null;
  location_state: string | null;
  location_country: string | null;
  location_label: string | null;
  work_mode: "On-site" | "Hybrid" | "Remote" | null;
  openings: number;
  majors: string[] | null;
  skills: string[] | null;
  description: string | null;
};

type StudentProfile = {
  user_id: string;
  display_name: string | null;
  major: string | null;
  class_year: string | null;
  gpa: number | null;
  work_authorization: string | null;
  open_to_relocation: boolean | null;
  preferred_locations: string[] | null;
  interested_role_types: string[] | null;
  preferred_work_modes: string[] | null;
  industries_of_interest: string[] | null;
  skills: string[] | null;
  bio: string | null;
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
  const searchParams = useSearchParams();
  const companyIdFromUrl = searchParams.get("companyId");

  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [positions, setPositions] = useState<CompanyPosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null);
  const [studentProfile, setStudentProfile] = useState<StudentProfile | null>(null);
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

  const totalOpenings = useMemo(
    () => positions.reduce((sum, p) => sum + (p.openings ?? 0), 0),
    [positions]
  );

  const totalRoles = useMemo(() => positions.length, [positions]);

  const topLocations = useMemo(() => {
    const counts = new Map<string, number>();

    for (const p of positions) {
      const label =
        p.location_label ||
        [p.location_city, p.location_state].filter(Boolean).join(", ") ||
        p.work_mode ||
        "Unspecified";

      counts.set(label, (counts.get(label) ?? 0) + (p.openings ?? 0));
    }

    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
  }, [positions]);

  const sortedPositions = useMemo(() => {
    return [...positions].sort((a, b) => {
      const matchA = computePositionMatch(a, studentProfile).score;
      const matchB = computePositionMatch(b, studentProfile).score;
      return matchB - matchA;
    });
  }, [positions, studentProfile]);

  const bestCompanyMatch = useMemo(() => {
    if (positions.length === 0) return null;
    return Math.max(...positions.map((p) => computePositionMatch(p, studentProfile).score));
  }, [positions, studentProfile]);

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
    if (companyIdFromUrl && data?.some((c) => c.id === companyIdFromUrl)) {
      setSelectedCompanyId(companyIdFromUrl);
    } else if (!selectedCompanyId && data?.length) {
      setSelectedCompanyId(data[0].id);
    }
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

  async function loadPositions(companyId: string) {
    const { data, error } = await supabase
      .from("company_positions")
      .select("*")
      .eq("company_id", companyId)
      .order("title");

    if (error) throw error;

    setPositions(data ?? []);
  }

  async function loadStudentProfile() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setStudentProfile(null);
      return;
    }

    const { data, error } = await supabase
      .from("student_profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) throw error;

    setStudentProfile(data ?? null);
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
        await loadStudentProfile();
      } catch (e: any) {
        setError(e?.message ?? "Failed to load page data");
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
         loadPositions(selectedCompanyId),
      ]);
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

  function normalizeList(values: string[] | null | undefined) {
    return (values ?? []).map((v) => v.trim().toLowerCase()).filter(Boolean);
  }

  function computePositionMatch(position: CompanyPosition, profile: StudentProfile | null) {
    if (!profile) {
      return {
        score: 0,
        reasons: ["Complete your profile to see a match score."],
      };
    }

    let score = 0;
    const reasons: string[] = [];

    const studentSkills = normalizeList(profile.skills);
    const positionSkills = normalizeList(position.skills);

    if (positionSkills.length > 0) {
      const matchedSkills = positionSkills.filter((skill) => studentSkills.includes(skill));
      const skillScore = Math.round((matchedSkills.length / positionSkills.length) * 35);
      score += skillScore;

      if (matchedSkills.length > 0) {
        reasons.push(`matched skills: ${matchedSkills.join(", ")}`);
      }
    }

    const studentMajor = profile.major?.trim().toLowerCase();
    const positionMajors = normalizeList(position.majors);

    if (studentMajor && positionMajors.length > 0) {
      const exactMajorMatch = positionMajors.some((m) => m === studentMajor);
      const partialMajorMatch = positionMajors.some(
        (m) => m.includes(studentMajor) || studentMajor.includes(m)
      );

      if (exactMajorMatch) {
        score += 25;
        reasons.push("major aligns strongly");
      } else if (partialMajorMatch) {
        score += 15;
        reasons.push("major partially aligns");
      }
    }

    const preferredLocations = normalizeList(profile.preferred_locations);
    const positionLocation = (
      position.location_label ||
      [position.location_city, position.location_state].filter(Boolean).join(", ")
    )
      .trim()
      .toLowerCase();

    if (positionLocation) {
      const exactLocation = preferredLocations.some((loc) => positionLocation.includes(loc));
      if (exactLocation) {
        score += 20;
        reasons.push("preferred location match");
      } else if (profile.open_to_relocation) {
        score += 10;
        reasons.push("open to relocation");
      }
    }

    const preferredWorkModes = normalizeList(profile.preferred_work_modes);
    const positionWorkMode = position.work_mode?.trim().toLowerCase();

    if (positionWorkMode && preferredWorkModes.includes(positionWorkMode)) {
      score += 10;
      reasons.push(`${position.work_mode} work preference match`);
    }

    const roleTypes = normalizeList(profile.interested_role_types);
    const titleAndDescription = `${position.title} ${position.description ?? ""}`.toLowerCase();

    const matchedRoleType = roleTypes.find((roleType) => titleAndDescription.includes(roleType));
    if (matchedRoleType) {
      score += 10;
      reasons.push(`${matchedRoleType} interest match`);
    }

    return {
      score: Math.min(score, 100),
      reasons: reasons.length ? reasons : ["Limited profile overlap so far."],
    };
  }

  return (
    <div className="container">
      <div className="shell">
        <AppNav />

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
                        Open positions
                      </div>
                      <div style={{ fontWeight: 700 }}>{totalOpenings}</div>
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
                        Listed roles
                      </div>
                      <div style={{ fontWeight: 700 }}>{totalRoles}</div>
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
                        Best match
                      </div>
                      <div style={{ fontWeight: 700 }}>
                        {bestCompanyMatch != null ? `${bestCompanyMatch}%` : "N/A"}
                      </div>
                    </div>

                    <div
                      style={{
                        padding: 10,
                        borderRadius: 12,
                        border: "1px solid var(--border)",
                        background: "rgba(255,255,255,0.02)",
                        gridColumn: "1 / -1",
                      }}
                    >
                      <div className="p" style={{ fontSize: 12, opacity: 0.8 }}>
                        Top locations
                      </div>
                      <div style={{ fontWeight: 700 }}>
                        {topLocations.length
                          ? topLocations
                              .map(([label, count]) => `${label} (${count})`)
                              .join(", ")
                          : "N/A"}
                      </div>
                    </div>

                    <div
                      style={{
                        padding: 10,
                        borderRadius: 12,
                        border: "1px solid var(--border)",
                        background: "rgba(255,255,255,0.02)",
                        gridColumn: "1 / -1",
                      }}
                    >
                      <div className="p" style={{ fontSize: 12, opacity: 0.8 }}>
                        Website
                      </div>
                      <div style={{ fontWeight: 700 }}>
                        {companyProfile.website ? (
                          <a href={companyProfile.website} target="_blank" rel="noreferrer">
                            {companyProfile.website}
                          </a>
                        ) : (
                          "N/A"
                        )}
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

              <div style={{ marginTop: 16 }}>
                <h3 style={{ marginBottom: 12 }}>Available Positions</h3>

                {positions.length === 0 ? (
                  <p className="p">No positions listed for this company yet.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {sortedPositions.map((p) => {
                      const match = computePositionMatch(p, studentProfile);

                      return (
                        <div key={p.id} className="card" style={{ padding: 12 }}>
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "flex-start",
                              gap: 12,
                              marginBottom: 4,
                            }}
                          >
                            <div style={{ fontWeight: 800 }}>{p.title}</div>
                            <div
                              style={{
                                padding: "6px 10px",
                                borderRadius: 999,
                                border: "1px solid var(--border)",
                                background: "rgba(87, 112, 255, 0.12)",
                                fontWeight: 800,
                                whiteSpace: "nowrap",
                              }}
                            >
                              {match.score}% Match
                            </div>
                          </div>

                          <div className="p" style={{ fontSize: 13, marginBottom: 6 }}>
                            {p.location_label || "Location not provided"}
                            {p.work_mode ? ` • ${p.work_mode}` : ""}
                            {` • ${p.openings} opening${p.openings === 1 ? "" : "s"}`}
                          </div>

                          <div className="p" style={{ fontSize: 13, marginBottom: 8 }}>
                            Why: {match.reasons.join(" • ")}
                          </div>

                          {p.description && (
                            <div className="p" style={{ marginBottom: 6 }}>
                              {p.description}
                            </div>
                          )}

                          {p.majors?.length ? (
                            <div className="p" style={{ fontSize: 13 }}>
                              <b>Majors:</b> {p.majors.join(", ")}
                            </div>
                          ) : null}

                          {p.skills?.length ? (
                            <div className="p" style={{ fontSize: 13 }}>
                              <b>Skills:</b> {p.skills.join(", ")}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                )}
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
