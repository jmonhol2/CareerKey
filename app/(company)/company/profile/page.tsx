"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import CompanyProfileForm from "@/components/company/CompanyProfileForm";

export default function CompanyProfilePage() {
  const [companyName, setCompanyName] = useState("");
  const [description, setDescription] = useState("");
  const [website, setWebsite] = useState("");
  const [majors, setMajors] = useState("");
  const [minGpa, setMinGpa] = useState("");
  const [skills, setSkills] = useState("");
  const [jobTypes, setJobTypes] = useState("");
  const [locations, setLocations] = useState("");
  const [sponsorshipAvailable, setSponsorshipAvailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadCompanyProfile() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      const { data: company } = await supabase
        .from("companies")
        .select("*")
        .eq("owner_user_id", user.id)
        .single();

      if (company) {
        setCompanyName(company.company_name ?? "");
        setDescription(company.description ?? "");
        setWebsite(company.website ?? "");
        setMajors((company.majors ?? []).join(", "));
        setMinGpa(company.min_gpa?.toString() ?? "");
        setSkills((company.skills ?? []).join(", "));
        setJobTypes((company.job_types ?? []).join(", "));
        setLocations((company.locations ?? []).join(", "));
        setSponsorshipAvailable(company.sponsorship_available ?? false);
      }

      setLoading(false);
    }

    loadCompanyProfile();
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setMessage("You must be logged in.");
      return;
    }

    const payload = {
      owner_user_id: user.id,
      company_name: companyName,
      description,
      website,
      majors: majors
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      min_gpa: minGpa ? Number(minGpa) : null,
      skills: skills
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      job_types: jobTypes
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      locations: locations
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      sponsorship_available: sponsorshipAvailable,
    };

    const { error } = await supabase
      .from("companies")
      .upsert(payload, { onConflict: "owner_user_id" });

    if (error) {
      setMessage(`Error: ${error.message}`);
      return;
    }

    setMessage("Company profile saved successfully.");
  }

  if (loading) return <p>Loading profile...</p>;

  return (
    <div>
      <h1>Company Profile</h1>
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
