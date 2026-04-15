"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

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

type StudentResume = {
  id: string;
  file_name: string;
  file_path: string;
  created_at: string;
  raw_text: string | null;
  parsed_json: any;
};

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
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [resumeMessage, setResumeMessage] = useState<string | null>(null);
  const [uploadingResume, setUploadingResume] = useState(false);
  const [latestResume, setLatestResume] = useState<StudentResume | null>(null);
  const [autofillLoading, setAutofillLoading] = useState(false);

  async function loadLatestResume(userId: string) {
    const { data, error } = await supabase
      .from("student_resumes")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    setLatestResume(data ?? null);
  }

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

      await loadLatestResume(user.id);

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

  async function handleResumeUpload(e: React.FormEvent) {
    e.preventDefault();
    setUploadingResume(true);
    setResumeMessage(null);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setResumeMessage("You must be logged in.");
        setUploadingResume(false);
        return;
      }

      if (!resumeFile) {
        setResumeMessage("Please choose a resume file first.");
        setUploadingResume(false);
        return;
      }

      const fileExt = resumeFile.name.split(".").pop() || "pdf";
      const filePath = `${user.id}/${crypto.randomUUID()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("resumes")
        .upload(filePath, resumeFile, { upsert: true });

      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase
        .from("student_resumes")
        .insert({
          user_id: user.id,
          file_name: resumeFile.name,
          file_path: filePath,
        });

      if (dbError) throw dbError;

      await loadLatestResume(user.id);

      setResumeMessage("Resume uploaded successfully.");
      setResumeFile(null);
    } catch (err: any) {
      setResumeMessage(err?.message ?? "Resume upload failed.");
    } finally {
      setUploadingResume(false);
    }
  }

  async function handleAutofillFromResume() {
    if (!latestResume) {
      setResumeMessage("No uploaded resume found.");
      return;
    }

    setAutofillLoading(true);
    setResumeMessage(null);

    try {
      const res = await fetch("/api/parse-resume", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          resumeId: latestResume.id,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to parse resume");
      }

      const parsed = json.parsed ?? {};

      if (parsed.display_name) setDisplayName(parsed.display_name);
      if (parsed.major) setMajor(parsed.major);
      if (parsed.class_year) setClassYear(parsed.class_year);
      if (parsed.skills?.length) setSkills(parsed.skills.join(", "));
      if (parsed.bio) setBio(parsed.bio);

      setResumeMessage("Resume fields applied. Please review before saving.");
    } catch (err: any) {
      setResumeMessage(err?.message ?? "Resume autofill failed.");
    } finally {
      setAutofillLoading(false);
    }
  }

  const studentProfile: StudentProfile = {
    user_id: "",
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

  const profileCompleteness = getProfileCompleteness(studentProfile);

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

          {message && (
            <div className="card" style={{ marginBottom: 16 }}>
              {message}
            </div>
          )}

          <div className="card" style={{ marginBottom: 16 }}>
            <h2 style={{ marginTop: 0, fontSize: 20 }}>Resume Upload</h2>
            <p className="p" style={{ marginBottom: 12 }}>
              Upload your resume to help prefill your profile. You will still be able to
              review and correct everything manually.
            </p>

            {resumeMessage && (
              <div className="card" style={{ marginBottom: 12 }}>
                {resumeMessage}
              </div>
            )}

            <form onSubmit={handleResumeUpload} style={{ display: "grid", gap: 12 }}>
              <input
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={(e) => setResumeFile(e.target.files?.[0] ?? null)}
                style={fieldStyle}
              />

              <button type="submit" className="btn btnPrimary" disabled={uploadingResume}>
                {uploadingResume ? "Uploading..." : "Upload Resume"}
              </button>
            </form>

            {latestResume && (
              <div className="card" style={{ marginTop: 12 }}>
                <div style={{ fontWeight: 800, marginBottom: 6 }}>Latest uploaded resume</div>
                <div className="p" style={{ marginBottom: 10 }}>
                  {latestResume.file_name} • {new Date(latestResume.created_at).toLocaleString()}
                </div>

                <button
                  type="button"
                  className="btn"
                  onClick={handleAutofillFromResume}
                  disabled={autofillLoading}
                >
                  {autofillLoading ? "Applying..." : "Autofill From Resume"}
                </button>
              </div>
            )}
          </div>

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