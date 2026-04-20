"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import AppNav from "@/components/AppNav";

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

type PositionRow = {
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
  companies: {
    company_name: string;
  } | null;
};

function normalizeList(values: string[] | null | undefined) {
  return (values ?? []).map((v) => v.trim().toLowerCase()).filter(Boolean);
}

function computePositionMatch(position: PositionRow, profile: StudentProfile | null) {
  if (!profile) {
    return {
      score: 0,
      reasons: ["Complete your profile to see match scores."],
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

function getProfileCompleteness(profile: StudentProfile | null) {
  if (!profile) {
    return { percent: 0, missing: ["all profile fields"] };
  }

  const checks = [
    { label: "display name", done: !!profile.display_name },
    { label: "major", done: !!profile.major },
    { label: "class year", done: !!profile.class_year },
    { label: "GPA", done: profile.gpa != null },
    { label: "work authorization", done: !!profile.work_authorization },
    { label: "preferred locations", done: !!profile.preferred_locations?.length },
    { label: "interested role types", done: !!profile.interested_role_types?.length },
    { label: "preferred work modes", done: !!profile.preferred_work_modes?.length },
    { label: "industries of interest", done: !!profile.industries_of_interest?.length },
    { label: "skills", done: !!profile.skills?.length },
    { label: "bio", done: !!profile.bio },
  ];

  const completed = checks.filter((c) => c.done).length;
  const percent = Math.round((completed / checks.length) * 100);
  const missing = checks.filter((c) => !c.done).map((c) => c.label);

  return { percent, missing };
}

export default function MatchesPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [studentProfile, setStudentProfile] = useState<StudentProfile | null>(null);
  const [positions, setPositions] = useState<PositionRow[]>([]);
  const [logoMap, setLogoMap] = useState<Record<string, string | null>>({});
  const [minScore, setMinScore] = useState(0);
  const [workModeFilter, setWorkModeFilter] = useState("All");
  const [roleKeyword, setRoleKeyword] = useState("");
  const [locationKeyword, setLocationKeyword] = useState("");

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);

        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.push("/auth");
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from("student_profiles")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle();

        if (profileError) throw profileError;
        setStudentProfile(profile ?? null);

        const { data: positionsData, error: positionsError } = await supabase
          .from("company_positions")
          .select(`
            id,
            company_id,
            title,
            location_city,
            location_state,
            location_country,
            location_label,
            work_mode,
            openings,
            majors,
            skills,
            description,
            companies:company_id (
              company_name
            )
          `)
          .order("created_at", { ascending: false });

        if (positionsError) throw positionsError;

        const { data: profilesData, error: profilesError } = await supabase
          .from("company_profiles")
          .select("company_id, logo_url");

        if (profilesError) throw profilesError;

        const nextLogoMap: Record<string, string | null> = {};
        for (const row of profilesData ?? []) {
          nextLogoMap[row.company_id] = row.logo_url ?? null;
        }

        setLogoMap(nextLogoMap);
        setPositions((positionsData as PositionRow[]) ?? []);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to load matches");
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  const rankedPositions = useMemo(() => {
    return positions
      .map((p) => ({
        ...p,
        match: computePositionMatch(p, studentProfile),
      }))
      .filter((p) => {
        if (p.match.score < minScore) return false;

        if (workModeFilter !== "All" && p.work_mode !== workModeFilter) {
          return false;
        }

        const roleText = `${p.title} ${p.description ?? ""}`.toLowerCase();
        if (roleKeyword.trim() && !roleText.includes(roleKeyword.trim().toLowerCase())) {
          return false;
        }

        const locationText = (
          p.location_label ||
          [p.location_city, p.location_state, p.location_country]
            .filter(Boolean)
            .join(", ")
        ).toLowerCase();

        if (
          locationKeyword.trim() &&
          !locationText.includes(locationKeyword.trim().toLowerCase())
        ) {
          return false;
        }

        return true;
      })
      .sort((a, b) => b.match.score - a.match.score);
  }, [positions, studentProfile, minScore, workModeFilter, roleKeyword, locationKeyword]);

  const profileIncomplete =
    !studentProfile ||
    !studentProfile.major ||
    !studentProfile.skills?.length ||
    !studentProfile.preferred_work_modes?.length;
  const profileCompleteness = getProfileCompleteness(studentProfile);

  function getCompanyLogo(companyId: string) {
    return logoMap[companyId] ?? null;
  }

  return (
    <div className="container">
      <div className="shell">
        <AppNav />

        <div className="main">
          <div className="kicker">BEST MATCHES</div>
          <h1 className="h1" style={{ fontSize: 32 }}>Recommended Positions</h1>
          <p className="p" style={{ marginBottom: 16 }}>
            Ranked roles based on your profile, skills, and preferences.
          </p>

          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 800, marginBottom: 8 }}>
              Profile completeness: {profileCompleteness.percent}%
            </div>

            <div
              style={{
                height: 10,
                borderRadius: 999,
                background: "rgba(255,255,255,0.08)",
                overflow: "hidden",
                marginBottom: 10,
              }}
            >
              <div
                style={{
                  width: `${profileCompleteness.percent}%`,
                  height: "100%",
                  background: "rgba(87, 112, 255, 0.85)",
                }}
              />
            </div>

            <div className="p">
              {profileCompleteness.missing.length
                ? `To improve your matches, add: ${profileCompleteness.missing.join(", ")}`
                : "Your profile is complete and ready for matching."}
            </div>
          </div>

          {profileIncomplete && (
            <div className="card" style={{ marginBottom: 16 }}>
              Your profile is incomplete. Add your major, skills, and work preferences to improve match accuracy.
            </div>
          )}

          {loading && <p className="p">Loading...</p>}

          {error && (
            <div className="card" style={{ marginBottom: 16 }}>
              <b>Error:</b> {error}
            </div>
          )}

          <div
            className="card"
            style={{
              marginBottom: 16,
              display: "grid",
              gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
              gap: 12,
            }}
          >
            <label>
              <div className="p" style={{ fontSize: 14 }}>Minimum match</div>
              <select
                value={minScore}
                onChange={(e) => setMinScore(Number(e.target.value))}
                style={fieldStyle}
              >
                <option value={0}>All</option>
                <option value={25}>25%+</option>
                <option value={50}>50%+</option>
                <option value={75}>75%+</option>
              </select>
            </label>

            <label>
              <div className="p" style={{ fontSize: 14 }}>Work mode</div>
              <select
                value={workModeFilter}
                onChange={(e) => setWorkModeFilter(e.target.value)}
                style={fieldStyle}
              >
                <option value="All">All</option>
                <option value="On-site">On-site</option>
                <option value="Hybrid">Hybrid</option>
                <option value="Remote">Remote</option>
              </select>
            </label>

            <label>
              <div className="p" style={{ fontSize: 14 }}>Role keyword</div>
              <input
                value={roleKeyword}
                onChange={(e) => setRoleKeyword(e.target.value)}
                placeholder="intern, supply chain, quality"
                style={fieldStyle}
              />
            </label>

            <label>
              <div className="p" style={{ fontSize: 14 }}>Location keyword</div>
              <input
                value={locationKeyword}
                onChange={(e) => setLocationKeyword(e.target.value)}
                placeholder="nashville, remote, knoxville"
                style={fieldStyle}
              />
            </label>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {rankedPositions.length === 0 ? (
              <div className="card">
                No positions match your current filters. Try lowering the minimum score or changing your keywords.
              </div>
            ) : (
              rankedPositions.map((p) => (
                <div key={p.id} className="card" style={{ padding: 14 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                      alignItems: "flex-start",
                      marginBottom: 8,
                    }}
                  >
                    <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                      {getCompanyLogo(p.company_id) ? (
                        <img
                          src={getCompanyLogo(p.company_id)!}
                          alt={`${p.companies?.company_name ?? "Company"} logo`}
                          style={{
                            width: 52,
                            height: 52,
                            objectFit: "contain",
                            borderRadius: 12,
                            background: "white",
                            padding: 6,
                            flexShrink: 0,
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: 52,
                            height: 52,
                            borderRadius: 12,
                            border: "1px solid var(--border)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontWeight: 900,
                            background: "rgba(255,255,255,0.03)",
                            flexShrink: 0,
                          }}
                        >
                          {p.companies?.company_name?.[0] ?? "?"}
                        </div>
                      )}

                      <div>
                        <div style={{ fontWeight: 900, fontSize: 18 }}>{p.title}</div>
                        <div className="p">
                          {p.companies?.company_name ?? "Unknown company"}
                        </div>
                      </div>
                    </div>

                    <div
                      style={{
                        padding: "8px 12px",
                        borderRadius: 999,
                        border: "1px solid var(--border)",
                        background: "rgba(87, 112, 255, 0.12)",
                        fontWeight: 900,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {p.match.score}% Match
                    </div>
                  </div>

                  <div className="p" style={{ marginBottom: 8 }}>
                    {p.location_label || "Location not provided"}
                    {p.work_mode ? ` • ${p.work_mode}` : ""}
                    {` • ${p.openings} opening${p.openings === 1 ? "" : "s"}`}
                  </div>

                  <div className="p" style={{ marginBottom: 10 }}>
                    Why matched: {p.match.reasons.join(" • ")}
                  </div>

                  {p.description && (
                    <div className="p" style={{ marginBottom: 10 }}>
                      {p.description}
                    </div>
                  )}

                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <Link
                      className="btn btnPrimary"
                      href={`/schedule?companyId=${encodeURIComponent(p.company_id)}`}
                    >
                      Schedule with Company
                    </Link>
                    <Link className="btn" href="/profile">
                      Update Profile
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const fieldStyle: React.CSSProperties = {
  width: "100%",
  padding: 10,
  borderRadius: 12,
  border: "1px solid var(--border)",
  background: "transparent",
  color: "inherit",
};