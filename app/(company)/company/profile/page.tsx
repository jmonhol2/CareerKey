"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import CompanyProfileForm from "@/components/company/CompanyProfileForm";
import { useCompanyContext } from "@/contexts/CompanyContext";

export default function CompanyProfilePage() {
  const context = useCompanyContext();
  const [companyName, setCompanyName] = useState("");
  const [description, setDescription] = useState("");
  const [website, setWebsite] = useState("");
  const [majors, setMajors] = useState<string[]>([]);
  const [minGpa, setMinGpa] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [jobTypes, setJobTypes] = useState("");
  const [locations, setLocations] = useState<string[]>([]);
  const [sponsorshipAvailable, setSponsorshipAvailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadCompanyProfile() {
      if (!context.company) {
        setLoading(false);
        return;
      }

      const { data: companyData } = await supabase
        .from("companies")
        .select("*")
        .eq("id", context.company.id)
        .single();

      if (companyData) {
        setCompanyName(companyData.company_name ?? "");
        setDescription(companyData.description ?? "");
        setWebsite(companyData.website ?? "");
        setMajors(companyData.majors ?? []);
        setMinGpa(companyData.min_gpa?.toString() ?? "");
        setSkills(companyData.skills ?? []);
        setJobTypes((companyData.job_types ?? []).join(", "));
        setLocations(companyData.locations ?? []);
        setSponsorshipAvailable(companyData.sponsorship_available ?? false);
      }

      setLoading(false);
    }

    void loadCompanyProfile();
  }, [context.company]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");

    if (!context.userId) {
      setMessage("You must be logged in.");
      return;
    }

    const payload = {
      company_name: companyName,
      description,
      website,
      majors,
      min_gpa: minGpa ? Number(minGpa) : null,
      skills,
      job_types: jobTypes
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      locations,
      sponsorship_available: sponsorshipAvailable,
    };

    const result =
      context.role === "admin"
        ? context.company
          ? await supabase.from("companies").update(payload).eq("id", context.company.id)
          : { error: new Error("Select a company before editing its profile.") }
        : await supabase.from("companies").upsert(
            { ...payload, owner_user_id: context.userId },
            { onConflict: "owner_user_id" }
          );

    if (result.error) {
      setMessage(`Error: ${result.error.message}`);
      return;
    }

    await context.refreshCompany();
    setMessage("Company profile saved successfully.");
  }

  if (loading) return <p>Loading profile...</p>;

  return (
    <div>
      <div className="kicker">COMPANY SETTINGS</div>
      <h1>Company Profile</h1>
      <p className="p" style={{ marginBottom: 22 }}>Keep the details students use to evaluate your opportunities current.</p>
      <CompanyProfileForm
        companyName={companyName}
        description={description}
        website={website}
        majors={majors}
        minGpa={minGpa}
        skills={skills}
        jobTypes={jobTypes}
        locations={locations}
        sponsorshipAvailable={sponsorshipAvailable}
        onCompanyNameChange={setCompanyName}
        onDescriptionChange={setDescription}
        onWebsiteChange={setWebsite}
        onMajorsChange={setMajors}
        onMinGpaChange={setMinGpa}
        onSkillsChange={setSkills}
        onJobTypesChange={setJobTypes}
        onLocationsChange={setLocations}
        onSponsorshipChange={setSponsorshipAvailable}
        onSubmit={handleSave}
      />

      {message && <p style={{ marginTop: "16px" }}>{message}</p>}
    </div>
  );
}
