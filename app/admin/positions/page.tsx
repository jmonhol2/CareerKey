"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

type Company = {
  id: string;
  company_name: string;
};

export default function AdminPositionsPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyId, setCompanyId] = useState("");
  const [title, setTitle] = useState("");
  const [locationLabel, setLocationLabel] = useState("");
  const [locationCity, setLocationCity] = useState("");
  const [locationState, setLocationState] = useState("");
  const [workMode, setWorkMode] = useState("On-site");
  const [openings, setOpenings] = useState(1);
  const [majors, setMajors] = useState("");
  const [skills, setSkills] = useState("");
  const [description, setDescription] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("id, company_name")
        .order("company_name");

      if (!error && data) {
        setCompanies(data);
        if (data.length > 0) setCompanyId(data[0].id);
      }
    })();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    const majorsArray = majors
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const skillsArray = skills
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const { error } = await supabase.from("company_positions").insert({
      company_id: companyId,
      title,
      location_label: locationLabel || null,
      location_city: locationCity || null,
      location_state: locationState || null,
      location_country: "USA",
      work_mode: workMode,
      openings,
      majors: majorsArray.length ? majorsArray : null,
      skills: skillsArray.length ? skillsArray : null,
      description: description || null,
    });

    if (error) {
      setMessage(error.message);
    } else {
      setMessage("Position added successfully.");
      setTitle("");
      setLocationLabel("");
      setLocationCity("");
      setLocationState("");
      setWorkMode("On-site");
      setOpenings(1);
      setMajors("");
      setSkills("");
      setDescription("");
    }

    setSaving(false);
  }

  return (
    <div className="container">
      <div className="shell">
        <div className="nav">
          <div className="brand">CareerKey Admin</div>
          <div className="navlinks">
            <Link className="navlink" href="/schedule">Schedule</Link>
          </div>
        </div>

        <div className="main">
          <div className="kicker">ADMIN</div>
          <h1 className="h1" style={{ fontSize: 32 }}>Add Company Position</h1>

          {message && (
            <div className="card" style={{ marginBottom: 16 }}>
              {message}
            </div>
          )}

          <form onSubmit={handleSubmit} className="card" style={{ display: "grid", gap: 12 }}>
            <label>
              <div className="p" style={{ fontSize: 14 }}>Company</div>
              <select
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                style={fieldStyle}
              >
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.company_name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <div className="p" style={{ fontSize: 14 }}>Title</div>
              <input value={title} onChange={(e) => setTitle(e.target.value)} style={fieldStyle} />
            </label>

            <label>
              <div className="p" style={{ fontSize: 14 }}>Location label</div>
              <input
                value={locationLabel}
                onChange={(e) => setLocationLabel(e.target.value)}
                placeholder="Nashville, TN"
                style={fieldStyle}
              />
            </label>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <label>
                <div className="p" style={{ fontSize: 14 }}>City</div>
                <input value={locationCity} onChange={(e) => setLocationCity(e.target.value)} style={fieldStyle} />
              </label>

              <label>
                <div className="p" style={{ fontSize: 14 }}>State</div>
                <input value={locationState} onChange={(e) => setLocationState(e.target.value)} style={fieldStyle} />
              </label>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <label>
                <div className="p" style={{ fontSize: 14 }}>Work mode</div>
                <select value={workMode} onChange={(e) => setWorkMode(e.target.value)} style={fieldStyle}>
                  <option value="On-site">On-site</option>
                  <option value="Hybrid">Hybrid</option>
                  <option value="Remote">Remote</option>
                </select>
              </label>

              <label>
                <div className="p" style={{ fontSize: 14 }}>Openings</div>
                <input
                  type="number"
                  min={1}
                  value={openings}
                  onChange={(e) => setOpenings(Number(e.target.value))}
                  style={fieldStyle}
                />
              </label>
            </div>

            <label>
              <div className="p" style={{ fontSize: 14 }}>Majors</div>
              <input
                value={majors}
                onChange={(e) => setMajors(e.target.value)}
                placeholder="Industrial Engineering, Mechanical Engineering"
                style={fieldStyle}
              />
            </label>

            <label>
              <div className="p" style={{ fontSize: 14 }}>Skills</div>
              <input
                value={skills}
                onChange={(e) => setSkills(e.target.value)}
                placeholder="Lean, Excel, Quality"
                style={fieldStyle}
              />
            </label>

            <label>
              <div className="p" style={{ fontSize: 14 }}>Description</div>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                style={{ ...fieldStyle, resize: "vertical" }}
              />
            </label>

            <button type="submit" className="btn btnPrimary" disabled={saving}>
              {saving ? "Saving..." : "Add Position"}
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