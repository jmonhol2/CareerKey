"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import AppNav from "@/components/AppNav";
import LocationMapPicker from "@/components/LocationMapPicker";
import LocationPicker from "@/components/LocationPicker";
import MajorPicker from "@/components/MajorPicker";
import RequirePermission from "@/components/RequirePermission";
import SkillPicker from "@/components/SkillPicker";
import TagPicker from "@/components/TagPicker";

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
  parsed_json:
    | {
        rule_parsed?: ResumeParsedFields;
        ai_parsed?: ResumeParsedFields;
        merged?: {
          display_name?: string | null;
          major?: string | null;
          class_year?: string | null;
          gpa?: number | null;
          preferred_work_modes?: string[];
          interested_role_types?: string[];
          skills?: string[];
          bio?: string | null;
        };
      }
    | null;
};

type ResumeParsedFields = {
  display_name?: string | null;
  major?: string | null;
  class_year?: string | null;
  gpa?: number | null;
  preferred_work_modes?: string[];
  interested_role_types?: string[];
  skills?: string[];
  bio?: string | null;
};

type ProfileMethod = "choose" | "resume" | "manual" | "review";

const ROLE_TYPE_OPTIONS = [
  "Internship",
  "Co-op",
  "Part-time",
  "Full-time",
  "Apprenticeship",
  "Contract",
] as const;

const WORK_MODE_OPTIONS = ["On-site", "Hybrid", "Remote"] as const;

const INDUSTRY_OPTIONS = [
  "Aerospace",
  "Automotive",
  "Construction",
  "Consulting",
  "Consumer Goods",
  "Education",
  "Energy",
  "Engineering",
  "Financial Services",
  "Government",
  "Healthcare",
  "Hospitality",
  "Information Technology",
  "Logistics",
  "Manufacturing",
  "Nonprofit",
  "Pharmaceuticals",
  "Retail",
  "Supply Chain",
  "Telecommunications",
] as const;

function uniqueList(values: readonly string[]) {
  const seen = new Set<string>();

  return values.filter((value) => {
    const normalized = value.trim().toLocaleLowerCase();
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
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
    {
      label: "location preference",
      done:
        !!profile.open_to_relocation ||
        !!profile.preferred_locations?.length,
    },
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
  return (
    <RequirePermission permission="student.portal">
      <Suspense fallback={<p className="p">Preparing your profile...</p>}>
        <ProfilePageContent />
      </Suspense>
    </RequirePermission>
  );
}

function ProfilePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [showOnboardingPrompt, setShowOnboardingPrompt] = useState(
    searchParams.get("welcome") === "1"
  );
  const [leavingOnboarding, setLeavingOnboarding] = useState(false);

  const [displayName, setDisplayName] = useState("");
  const [major, setMajor] = useState("");
  const [classYear, setClassYear] = useState("");
  const [gpa, setGpa] = useState("");
  const [workAuthorization, setWorkAuthorization] = useState("");
  const [openToRelocation, setOpenToRelocation] = useState(false);
  const [preferredLocations, setPreferredLocations] = useState<string[]>([]);
  const [interestedRoleTypes, setInterestedRoleTypes] = useState<string[]>([]);
  const [preferredWorkModes, setPreferredWorkModes] = useState<string[]>([]);
  const [industriesOfInterest, setIndustriesOfInterest] = useState<string[]>([]);
  const [skills, setSkills] = useState<string[]>([]);
  const [bio, setBio] = useState("");
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [resumeMessage, setResumeMessage] = useState<string | null>(null);
  const [uploadingResume, setUploadingResume] = useState(false);
  const [latestResume, setLatestResume] = useState<StudentResume | null>(null);
  const [autofillLoading, setAutofillLoading] = useState(false);
  const [profileMethod, setProfileMethod] = useState<ProfileMethod>("choose");

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
        setPreferredLocations(uniqueList(data.preferred_locations ?? []));
        setInterestedRoleTypes(uniqueList(data.interested_role_types ?? []));
        setPreferredWorkModes(uniqueList(data.preferred_work_modes ?? []));
        setIndustriesOfInterest(uniqueList(data.industries_of_interest ?? []));
        setSkills(uniqueList(data.skills ?? []));
        setBio(data.bio ?? "");

        const hasStartedProfile = [
          data.display_name,
          data.major,
          data.class_year,
          data.work_authorization,
          data.bio,
          ...(data.preferred_locations ?? []),
          ...(data.interested_role_types ?? []),
          ...(data.preferred_work_modes ?? []),
          ...(data.industries_of_interest ?? []),
          ...(data.skills ?? []),
        ].some(Boolean) || data.gpa != null;

        if (hasStartedProfile) setProfileMethod("manual");
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
      preferred_locations: uniqueList(preferredLocations),
      interested_role_types: uniqueList(interestedRoleTypes),
      preferred_work_modes: uniqueList(preferredWorkModes),
      industries_of_interest: uniqueList(industriesOfInterest),
      skills: uniqueList(skills),
      bio: bio || null,
    };

    const { error } = await supabase
      .from("student_profiles")
      .upsert(payload, { onConflict: "user_id" });

    if (error) {
      setMessage(error.message);
    } else {
      const { error: onboardingError } = await supabase.auth.updateUser({
        data: { profile_onboarding_pending: false },
      });

      setShowOnboardingPrompt(false);
      window.history.replaceState(null, "", "/profile");
      setMessage(
        onboardingError
          ? "Profile saved, but we could not finish the welcome step. Your profile changes are safe."
          : "Profile saved successfully."
      );
    }

    setSaving(false);
  }

  function handleBeginProfile() {
    setShowOnboardingPrompt(false);
    window.history.replaceState(null, "", "/profile");
    window.requestAnimationFrame(() => {
      document
        .getElementById("profile-method-heading")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  async function handleProfileLater() {
    setLeavingOnboarding(true);
    setMessage(null);

    const { error } = await supabase.auth.updateUser({
      data: { profile_onboarding_pending: false },
    });

    if (error) {
      setMessage(
        "We could not dismiss the welcome step yet. Please try again."
      );
      setLeavingOnboarding(false);
      return;
    }

    router.push("/home");
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

      const { data: uploadedResume, error: dbError } = await supabase
        .from("student_resumes")
        .insert({
          user_id: user.id,
          file_name: resumeFile.name,
          file_path: filePath,
        })
        .select("*")
        .single();

      if (dbError) throw dbError;

      setResumeFile(null);
      setLatestResume(uploadedResume as StudentResume);
      setResumeMessage("Resume uploaded. CareerKey is preparing your profile...");
      await autofillFromResume(uploadedResume as StudentResume);
    } catch (err: unknown) {
      setResumeMessage(err instanceof Error ? err.message : "Resume upload failed.");
    } finally {
      setUploadingResume(false);
    }
  }

  function applyParsedToForm(parsed: ResumeParsedFields | null | undefined) {
    if (!parsed) return;

    if (parsed.display_name) setDisplayName(parsed.display_name);
    if (parsed.major) setMajor(parsed.major);
    if (parsed.class_year) setClassYear(parsed.class_year);
    if (parsed.gpa != null) setGpa(String(parsed.gpa));
    if (parsed.preferred_work_modes?.length) {
      setPreferredWorkModes(uniqueList(parsed.preferred_work_modes));
    }
    if (parsed.interested_role_types?.length) {
      setInterestedRoleTypes(uniqueList(parsed.interested_role_types));
    }
    if (parsed.skills?.length) setSkills(uniqueList(parsed.skills));
    if (parsed.bio) setBio(parsed.bio);
  }

  async function autofillFromResume(resume: StudentResume) {
    setAutofillLoading(true);
    setResumeMessage(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        throw new Error("Your session has expired. Please sign in again.");
      }

      const cachedParsed = resume.parsed_json?.merged;

      if (cachedParsed) {
        applyParsedToForm(cachedParsed);
        setResumeMessage("Used saved resume parsing results. Please review before saving.");
        setProfileMethod("review");
        return;
      }

      const res = await fetch("/api/parse-resume", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          resumeId: resume.id,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to parse resume");
      }

      const parsed = json.parsed ?? {};
      applyParsedToForm(parsed);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        await loadLatestResume(user.id);
      }

      setResumeMessage("Resume parsed and applied. Please review before saving.");
      setProfileMethod("review");
    } catch (err: unknown) {
      setResumeMessage(err instanceof Error ? err.message : "Resume autofill failed.");
    } finally {
      setAutofillLoading(false);
    }
  }

  async function handleAutofillFromResume() {
    if (!latestResume) {
      setResumeMessage("No uploaded resume found.");
      return;
    }

    await autofillFromResume(latestResume);
  }

  const studentProfile: StudentProfile = {
    user_id: "",
    display_name: displayName || null,
    major: major || null,
    class_year: classYear || null,
    gpa: gpa ? Number(gpa) : null,
    work_authorization: workAuthorization || null,
    open_to_relocation: openToRelocation,
    preferred_locations: uniqueList(preferredLocations),
    interested_role_types: uniqueList(interestedRoleTypes),
    preferred_work_modes: uniqueList(preferredWorkModes),
    industries_of_interest: uniqueList(industriesOfInterest),
    skills: uniqueList(skills),
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
        <AppNav />

        <div className="main profilePage">
          {showOnboardingPrompt && (
            <section
              className="profileOnboardingPrompt"
              aria-labelledby="profile-welcome-heading"
            >
              <div className="profileOnboardingIcon" aria-hidden="true">CK</div>
              <div className="profileOnboardingCopy">
                <span className="profileStep">RECOMMENDED NEXT STEP</span>
                <h2 id="profile-welcome-heading">
                  Welcome to CareerKey—let’s make your matches personal.
                </h2>
                <p>
                  Completing your profile helps companies understand what you
                  bring and gives you more relevant recommendations. Start with
                  your resume or fill it out manually.
                </p>
              </div>
              <div className="profileOnboardingActions">
                <button
                  type="button"
                  className="btn btnPrimary"
                  onClick={handleBeginProfile}
                >
                  Complete my profile
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={() => void handleProfileLater()}
                  disabled={leavingOnboarding}
                >
                  {leavingOnboarding ? "Continuing..." : "I’ll do this later"}
                </button>
              </div>
            </section>
          )}

          <header className="profileHero">
            <div className="profileHeroCopy">
              <div className="kicker">STUDENT PROFILE</div>
              <h1 className="h1">Build a profile that opens doors</h1>
              <p className="p">
                Tell CareerKey what you are looking for so we can surface stronger
                company and role matches.
              </p>
            </div>

            <div className="profileProgressCard">
              <div className="profileProgressTopline">
                <span>Profile strength</span>
                <strong>{profileCompleteness.percent}%</strong>
              </div>
              <div
                className="progressTrack"
                role="progressbar"
                aria-label="Profile completeness"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={profileCompleteness.percent}
              >
                <div
                  className="progressFill"
                  style={{ width: `${profileCompleteness.percent}%` }}
                />
              </div>
              <p>
                {profileCompleteness.missing.length
                  ? `${profileCompleteness.missing.length} profile ${
                      profileCompleteness.missing.length === 1 ? "detail" : "details"
                    } left to add`
                  : "Ready for matching"}
              </p>
            </div>
          </header>

          {message && (
            <div className="profileNotice" role="status">
              {message}
            </div>
          )}

          {profileMethod === "choose" && (
            <section className="profileMethodSection" aria-labelledby="profile-method-heading">
              <div className="profileSectionHeading">
                <span className="profileStep">STEP 1</span>
                <h2 id="profile-method-heading">How would you like to begin?</h2>
                <p>Choose the path that feels easiest. You can switch at any time.</p>
              </div>

              <div className="profileMethodGrid">
                <button
                  type="button"
                  className="profileMethodCard profileMethodCardFeatured"
                  onClick={() => setProfileMethod("resume")}
                >
                  <span className="profileMethodBadge">FASTEST</span>
                  <span className="profileMethodIcon" aria-hidden="true">
                    <svg fill="none" viewBox="0 0 24 24">
                      <path d="M7 3h7l4 4v14H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
                      <path d="M14 3v5h5M9 13h6M9 17h4" />
                      <path d="m19 11 .6 1.4L21 13l-1.4.6L19 15l-.6-1.4L17 13l1.4-.6L19 11Z" />
                    </svg>
                  </span>
                  <span className="profileMethodTitle">Use my resume</span>
                  <span className="profileMethodDescription">
                    Upload a PDF or Word document and let AI prepare your profile fields
                    for review.
                  </span>
                  <span className="profileMethodAction">Upload and autofill <span>→</span></span>
                </button>

                <button
                  type="button"
                  className="profileMethodCard"
                  onClick={() => setProfileMethod("manual")}
                >
                  <span className="profileMethodIcon profileMethodIconWarm" aria-hidden="true">
                    <svg fill="none" viewBox="0 0 24 24">
                      <path d="m4 20 4.2-1 10.9-10.9a2.2 2.2 0 0 0-3.2-3.2L5 15.8 4 20Z" />
                      <path d="m14.5 6.5 3 3M4 20h6" />
                    </svg>
                  </span>
                  <span className="profileMethodTitle">Fill it out myself</span>
                  <span className="profileMethodDescription">
                    Work through a simple form with helpful prompts and recommendations.
                  </span>
                  <span className="profileMethodAction">Start manually <span>→</span></span>
                </button>
              </div>
            </section>
          )}

          {profileMethod !== "choose" && (
            <div className="profileModeBar">
              <div>
                <span className="profileModeLabel">YOUR PROFILE PATH</span>
                <strong>
                  {profileMethod === "resume"
                    ? "Resume-assisted setup"
                    : profileMethod === "review"
                      ? "Review AI suggestions"
                      : "Manual setup"}
                </strong>
              </div>
              <div className="profileModeActions" aria-label="Change profile setup method">
                <button
                  type="button"
                  className={
                    profileMethod === "resume" || profileMethod === "review"
                      ? "profileModeButton active"
                      : "profileModeButton"
                  }
                  aria-pressed={profileMethod === "resume" || profileMethod === "review"}
                  onClick={() => setProfileMethod("resume")}
                >
                  Use resume
                </button>
                <button
                  type="button"
                  className={profileMethod === "manual" ? "profileModeButton active" : "profileModeButton"}
                  aria-pressed={profileMethod === "manual"}
                  onClick={() => setProfileMethod("manual")}
                >
                  Enter manually
                </button>
              </div>
            </div>
          )}

          {profileMethod === "resume" && (
          <div className="profileResumePanel">
            <div className="profileSectionHeading">
              <span className="profileStep">AI-ASSISTED SETUP</span>
              <h2>Turn your resume into a starting point</h2>
              <p>
                We will suggest profile details from your resume. Nothing is saved to
                your profile until you review and confirm it.
              </p>
            </div>

            <div className="profileMiniSteps" aria-label="Resume setup steps">
              <span><strong>1</strong> Upload</span>
              <span><strong>2</strong> Autofill</span>
              <span><strong>3</strong> Review</span>
            </div>

            {resumeMessage && (
              <div className="profileNotice" role="status">
                {resumeMessage}
              </div>
            )}

            <form onSubmit={handleResumeUpload} className="profileUploadForm">
              <label className="profileUploadZone" htmlFor="student-resume">
                <input
                  id="student-resume"
                  className="profileFileInput"
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={(event) => setResumeFile(event.target.files?.[0] ?? null)}
                />
                <span className="profileUploadIcon" aria-hidden="true">↑</span>
                <strong>{resumeFile ? resumeFile.name : "Choose your resume"}</strong>
                <span>
                  {resumeFile
                    ? "Ready to upload and review"
                    : "PDF, DOC, or DOCX · click to browse"}
                </span>
              </label>

              <button
                type="submit"
                className="btn btnPrimary profileResumeSubmit"
                disabled={!resumeFile || uploadingResume || autofillLoading}
              >
                {uploadingResume || autofillLoading
                  ? "Preparing your profile..."
                  : "Upload and fill my profile"}
              </button>
            </form>

            <p className="profilePrivacyNote">
              Your resume is private and is used only to prepare your CareerKey profile.
            </p>

            {latestResume && (
              <div className="profileLatestResume">
                <div className="profileResumeFileIcon" aria-hidden="true">R</div>
                <div className="profileLatestResumeCopy">
                  <strong>Latest uploaded resume</strong>
                  <div className="profileResumeMeta">
                  {latestResume.file_name} • {new Date(latestResume.created_at).toLocaleString()}
                  <br />
                  {latestResume.parsed_json?.merged
                    ? "Parsed resume data is already saved."
                    : "This resume has not been parsed yet."}
                </div>
                </div>

                <button
                  type="button"
                  className="btn"
                  onClick={handleAutofillFromResume}
                  disabled={autofillLoading}
                >
                  {autofillLoading
                    ? "Applying..."
                    : latestResume?.parsed_json?.merged
                    ? "Use Saved Autofill"
                    : "Autofill From Resume"}
                </button>
              </div>
            )}
          </div>
          )}

          {(profileMethod === "manual" || profileMethod === "review") && (
          <form onSubmit={handleSave} className="profileForm">
            {profileMethod === "review" && (
              <div className="profileReviewBanner">
                <span aria-hidden="true">✓</span>
                <div>
                  <strong>Your resume suggestions are ready</strong>
                  <p>
                    Review each field, make any changes, and save when everything looks right.
                  </p>
                </div>
              </div>
            )}

            <div className="profileFormSectionHeader">
              <span>01</span>
              <div>
                <h2>About you</h2>
                <p>The essentials companies use to understand your background.</p>
              </div>
            </div>

            <label>
              <div className="p" style={{ fontSize: 14 }}>Display name</div>
              <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} style={fieldStyle} />
            </label>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <MajorPicker
                label="Major"
                value={major ? [major] : []}
                onChange={(items) => setMajor(items[0] ?? "")}
                maxItems={1}
              />

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

            <div className="profileFormSectionHeader">
              <span>02</span>
              <div>
                <h2>What you are looking for</h2>
                <p>Choose the preferences CareerKey should use when ranking opportunities.</p>
              </div>
            </div>

            <label
              className={
                openToRelocation
                  ? "profileAnywhereToggle selected"
                  : "profileAnywhereToggle"
              }
            >
              <input
                type="checkbox"
                checked={openToRelocation}
                onChange={(e) => setOpenToRelocation(e.target.checked)}
              />
              <span className="profileAnywhereIcon" aria-hidden="true">◎</span>
              <span className="profileAnywhereCopy">
                <strong>Relocate anywhere</strong>
                <small>
                  Select this when location does not matter. Every position
                  location will count as a match.
                </small>
              </span>
              <span className="profileAnywhereStatus">
                {openToRelocation ? "Selected" : "Select"}
              </span>
            </label>

            {openToRelocation ? (
              <div className="profileAnywhereNotice">
                <strong>You are open to opportunities everywhere.</strong>
                <p>
                  Your saved city and state preferences are being kept, but
                  CareerKey will ignore them while this option is selected.
                </p>
              </div>
            ) : (
              <div className="profileLocationField">
                <LocationPicker
                  label="Preferred locations"
                  value={preferredLocations}
                  onChange={setPreferredLocations}
                />
                <LocationMapPicker
                  value={preferredLocations}
                  onChange={setPreferredLocations}
                />
              </div>
            )}

            <TagPicker
              label="Interested role types"
              value={interestedRoleTypes}
              onChange={setInterestedRoleTypes}
              options={ROLE_TYPE_OPTIONS}
              placeholder="Add a role type"
              itemName="role type"
            />

            <TagPicker
              label="Preferred work modes"
              value={preferredWorkModes}
              onChange={setPreferredWorkModes}
              options={WORK_MODE_OPTIONS}
              placeholder="Add a work mode"
              itemName="work mode"
            />

            <TagPicker
              label="Industries of interest"
              value={industriesOfInterest}
              onChange={setIndustriesOfInterest}
              options={INDUSTRY_OPTIONS}
              placeholder="Start typing an industry"
              itemName="industry"
            />

            <div className="profileFormSectionHeader">
              <span>03</span>
              <div>
                <h2>Skills and introduction</h2>
                <p>Show companies what you can contribute and what motivates you.</p>
              </div>
            </div>

            <SkillPicker
              value={skills}
              onChange={setSkills}
            />

            <label className="profileBioField">
              <div className="p" style={{ fontSize: 14 }}>Short bio</div>
              <textarea
                value={bio}
                onChange={(event) => setBio(event.target.value.slice(0, 600))}
                rows={5}
                placeholder="Share what you are studying, what kind of work interests you, and what you hope to learn next."
                style={{ ...fieldStyle, resize: "vertical" }}
              />
              <small>{bio.length}/600 characters</small>
            </label>

            <div className="profileSaveBar">
              <div>
                <strong>{profileCompleteness.percent}% complete</strong>
                <span>
                  {profileCompleteness.missing.length
                    ? `Next up: ${profileCompleteness.missing.slice(0, 3).join(", ")}`
                    : "Your profile is ready for matching."}
                </span>
              </div>
              <button type="submit" className="btn btnPrimary" disabled={saving}>
                {saving ? "Saving profile..." : "Save profile"}
              </button>
            </div>
          </form>
          )}
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
  background: "#fbfdfc",
  color: "var(--text)",
};
