"use client";

import { useEffect, useState } from "react";
import { useCompanyContext } from "@/contexts/CompanyContext";
import { supabase } from "@/lib/supabaseClient";

type Position = {
  id: string;
  title: string;
  location_label: string | null;
  work_mode: string | null;
  openings: number;
};

export default function CompanyPositionsPage() {
  const { company } = useCompanyContext();
  const [positions, setPositions] = useState<Position[]>([]);
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [workMode, setWorkMode] = useState("On-site");
  const [openings, setOpenings] = useState(1);
  const [majors, setMajors] = useState("");
  const [skills, setSkills] = useState("");
  const [description, setDescription] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadPositions() {
      if (!company) {
        setPositions([]);
        return;
      }

      const { data, error } = await supabase
        .from("company_positions")
        .select("id, title, location_label, work_mode, openings")
        .eq("company_id", company.id)
        .order("created_at", { ascending: false });

      if (error) setMessage(error.message);
      setPositions((data ?? []) as Position[]);
    }

    void loadPositions();
  }, [company]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!company) {
      setMessage("Select or create a company profile first.");
      return;
    }

    setSaving(true);
    setMessage(null);

    const toList = (value: string) =>
      value.split(",").map((item) => item.trim()).filter(Boolean);

    const { data, error } = await supabase
      .from("company_positions")
      .insert({
        company_id: company.id,
        title,
        location_label: location || null,
        location_country: "USA",
        work_mode: workMode,
        openings,
        majors: toList(majors),
        skills: toList(skills),
        description: description || null,
      })
      .select("id, title, location_label, work_mode, openings")
      .single();

    if (error) {
      setMessage(error.message);
    } else {
      setPositions((current) => [data as Position, ...current]);
      setTitle("");
      setLocation("");
      setMajors("");
      setSkills("");
      setDescription("");
      setMessage("Position added successfully.");
    }

    setSaving(false);
  }

  return (
    <div style={{ maxWidth: 840 }}>
      <h1>Positions{company ? ` — ${company.company_name}` : ""}</h1>
      <p style={{ color: "rgba(255,255,255,0.72)" }}>
        Create roles for the active company. Database policies restrict company users to
        their own organization while administrators may manage any selected company.
      </p>

      <form onSubmit={handleSubmit} style={formStyle}>
        <label style={fieldStyle}>Title<input value={title} onChange={(e) => setTitle(e.target.value)} required /></label>
        <label style={fieldStyle}>Location<input value={location} onChange={(e) => setLocation(e.target.value)} /></label>
        <label style={fieldStyle}>
          Work mode
          <select value={workMode} onChange={(e) => setWorkMode(e.target.value)}>
            <option>On-site</option><option>Hybrid</option><option>Remote</option>
          </select>
        </label>
        <label style={fieldStyle}>Openings<input type="number" min={1} value={openings} onChange={(e) => setOpenings(Number(e.target.value))} /></label>
        <label style={fieldStyle}>Majors, comma separated<input value={majors} onChange={(e) => setMajors(e.target.value)} /></label>
        <label style={fieldStyle}>Skills, comma separated<input value={skills} onChange={(e) => setSkills(e.target.value)} /></label>
        <label style={{ ...fieldStyle, gridColumn: "1 / -1" }}>Description<textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} /></label>
        <button className="btn btnPrimary" type="submit" disabled={saving}>
          {saving ? "Saving..." : "Add position"}
        </button>
      </form>

      {message && <p>{message}</p>}

      <h2 style={{ marginTop: 30 }}>Current positions</h2>
      <div style={{ display: "grid", gap: 10 }}>
        {positions.map((position) => (
          <article key={position.id} style={positionStyle}>
            <strong>{position.title}</strong>
            <span>{position.location_label || "Location not specified"}</span>
            <span>{position.work_mode || "Work mode not specified"} · {position.openings} opening(s)</span>
          </article>
        ))}
        {positions.length === 0 && <p>No positions have been added for this company.</p>}
      </div>
    </div>
  );
}

const formStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 14,
  marginTop: 24,
  padding: 18,
  border: "1px solid rgba(255,255,255,0.14)",
  borderRadius: 16,
};

const fieldStyle: React.CSSProperties = { display: "grid", gap: 6 };
const positionStyle: React.CSSProperties = {
  display: "grid",
  gap: 4,
  padding: 14,
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 12,
};
