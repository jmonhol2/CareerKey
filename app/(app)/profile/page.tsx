"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function ProfilePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState("");
  const [major, setMajor] = useState("");
  const [classYear, setClassYear] = useState("");
  const [gpa, setGpa] = useState("");
  const [workAuthorization, setWorkAuthorization] = useState("");
  const [openToRelocation, setOpenToRelocation] = useState(false);
  const [preferredLocations, setPreferredLocations] = useState("");
  const [interestedRoleTypes, setInterestedRoleTypes] = useState("");
  const [preferredWorkModes, setPreferredWorkModes] = useState("");
  const [industriesOfInterest, setIndustriesOfInterest] = useState("");
  const [skills, setSkills] = useState("");
  const [bio, setBio] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      setMessage(null);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/auth");
        return;
      }

      const { data, error } = await supabase
        .from("student_profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        setMessage(error.message);
      } else if (data) {
        setDisplayName(data.display_name ?? "");
        setMajor(data.major ?? "");
        setClassYear(data.class_year ?? "");
        setGpa(data.gpa != null ? String(data.gpa) : "");
        setWorkAuthorization(data.work_authorization ?? "");
        setOpenToRelocation(!!data.open_to_relocation);
        setPreferredLocations((data.preferred_locations ?? []).join(", "));
        setInterestedRoleTypes((data.interested_role_types ?? []).join(", "));
        setPreferredWorkModes((data.preferred_work_modes ?? []).join(", "));
        setIndustriesOfInterest((data.industries_of_interest ?? []).join(", "));
        setSkills((data.skills ?? []).join(", "));
        setBio(data.bio ?? "");
      }

      setLoading(false);
    })();
  }, [router]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setMessage("You must be logged in.");
      setSaving(false);
      return;
    }

    const payload = {
      user_id: user.id,
      display_name: displayName || null,
      major: major || null,
      class_year: classYear || null,
      gpa: gpa ? Number(gpa) : null,
      work_authorization: workAuthorization || null,
      open_to_relocation: openToRelocation,
      preferred_locations: preferredLocations
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      interested_role_types: interestedRoleTypes
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      preferred_work_modes: preferredWorkModes
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      industries_of_interest: industriesOfInterest
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      skills: skills
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      bio: bio || null,
    };

    const { error } = await supabase
      .from("student_profiles")
      .upsert(payload, { onConflict: "user_id" });

    if (error) {
      setMessage(error.message);
    } else {
      setMessage("Profile saved successfully.");
    }

    setSaving(false);
  }

  if (loading) {
    return (
      <div className="container">
        <div className="shell">
          <div className="main">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="shell">
        <div className="nav">
          <div className="brand">CareerKey</div>
          <div className="navlinks">
            <Link className="navlink" href="/home">
              Home
            </Link>
            <Link className="navlink" href="/schedule">
              Schedule
            </Link>
            <Link className="navlink navlinkActive" href="/profile">
              Profile
            </Link>
          </div>
        </div>

        <div className="main">
          <div className="kicker">STUDENT PROFILE</div>
          <h1 className="h1" style={{ fontSize: 32 }}>
            Build Your Profile
          </h1>
          <p className="p" style={{ marginBottom: 16 }}>
            Complete your information so CareerKey can better match you to roles.
          </p>

          {message && (
            <div className="card" style={{ marginBottom: 16 }}>
              {message}
            </div>
          )}

          <form onSubmit={handleSave} className="card" style={{ display: "grid", gap: 12 }}>
            <label>
              <div className="p" style={{ fontSize: 14 }}>Display name</div>
              <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} style={fieldStyle} />
            </label>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <label>
                <div className="p" style={{ fontSize: 14 }}>Major</div>
                <input value={major} onChange={(e) => setMajor(e.target.value)} style={fieldStyle} />
              </label>

              <label>
                <div className="p" style={{ fontSize: 14 }}>Class year</div>
                <input value={classYear} onChange={(e) => setClassYear(e.target.value)} placeholder="Junior, Senior, 2027" style={fieldStyle} />
              </label>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <label>
                <div className="p" style={{ fontSize: 14 }}>GPA</div>
                <input type="number" step="0.01" min="0" max="4" value={gpa} onChange={(e) => setGpa(e.target.value)} style={fieldStyle} />
              </label>

              <label>
                <div className="p" style={{ fontSize: 14 }}>Work authorization</div>
                <input value={workAuthorization} onChange={(e) => setWorkAuthorization(e.target.value)} placeholder="US Citizen, OPT, Sponsorship needed" style={fieldStyle} />
              </label>
            </div>

            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="checkbox"
                checked={openToRelocation}
                onChange={(e) => setOpenToRelocation(e.target.checked)}
              />
              <span className="p">Open to relocation</span>
            </label>

            <label>
              <div className="p" style={{ fontSize: 14 }}>Preferred locations</div>
              <input value={preferredLocations} onChange={(e) => setPreferredLocations(e.target.value)} placeholder="Knoxville, TN, Nashville, TN, Remote" style={fieldStyle} />
            </label>

            <label>
              <div className="p" style={{ fontSize: 14 }}>Interested role types</div>
              <input value={interestedRoleTypes} onChange={(e) => setInterestedRoleTypes(e.target.value)} placeholder="Internship, Co-op, Full-time" style={fieldStyle} />
            </label>

            <label>
              <div className="p" style={{ fontSize: 14 }}>Preferred work modes</div>
              <input value={preferredWorkModes} onChange={(e) => setPreferredWorkModes(e.target.value)} placeholder="On-site, Hybrid, Remote" style={fieldStyle} />
            </label>

            <label>
              <div className="p" style={{ fontSize: 14 }}>Industries of interest</div>
              <input value={industriesOfInterest} onChange={(e) => setIndustriesOfInterest(e.target.value)} placeholder="Manufacturing, Supply Chain, Healthcare" style={fieldStyle} />
            </label>

            <label>
              <div className="p" style={{ fontSize: 14 }}>Skills</div>
              <input value={skills} onChange={(e) => setSkills(e.target.value)} placeholder="Lean, Excel, SQL, Quality, Process Improvement" style={fieldStyle} />
            </label>

            <label>
              <div className="p" style={{ fontSize: 14 }}>Short bio</div>
              <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={4} style={{ ...fieldStyle, resize: "vertical" }} />
            </label>

            <button type="submit" className="btn btnPrimary" disabled={saving}>
              {saving ? "Saving..." : "Save Profile"}
            </button>
          </form>
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