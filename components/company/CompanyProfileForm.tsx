type CompanyProfileFormProps = {
  companyName: string;
  description: string;
  website: string;
  majors: string;
  minGpa: string;
  skills: string;
  jobTypes: string;
  locations: string;
  sponsorshipAvailable: boolean;
  onCompanyNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onWebsiteChange: (value: string) => void;
  onMajorsChange: (value: string) => void;
  onMinGpaChange: (value: string) => void;
  onSkillsChange: (value: string) => void;
  onJobTypesChange: (value: string) => void;
  onLocationsChange: (value: string) => void;
  onSponsorshipChange: (value: boolean) => void;
  onSubmit: (e: React.FormEvent) => void;
};

export default function CompanyProfileForm({
  companyName,
  description,
  website,
  majors,
  minGpa,
  skills,
  jobTypes,
  locations,
  sponsorshipAvailable,
  onCompanyNameChange,
  onDescriptionChange,
  onWebsiteChange,
  onMajorsChange,
  onMinGpaChange,
  onSkillsChange,
  onJobTypesChange,
  onLocationsChange,
  onSponsorshipChange,
  onSubmit,
}: CompanyProfileFormProps) {
  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: "16px", maxWidth: "700px" }}>
      <div>
        <label>Company Name</label>
        <br />
        <input
          value={companyName}
          onChange={(e) => onCompanyNameChange(e.target.value)}
          style={{ width: "100%" }}
        />
      </div>

      <div>
        <label>Description</label>
        <br />
        <textarea
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          rows={4}
          style={{ width: "100%" }}
        />
      </div>

      <div>
        <label>Website</label>
        <br />
        <input value={website} onChange={(e) => onWebsiteChange(e.target.value)} style={{ width: "100%" }} />
      </div>

      <div>
        <label>Majors Sought (comma-separated)</label>
        <br />
        <input value={majors} onChange={(e) => onMajorsChange(e.target.value)} style={{ width: "100%" }} />
      </div>

      <div>
        <label>Minimum GPA</label>
        <br />
        <input value={minGpa} onChange={(e) => onMinGpaChange(e.target.value)} type="number" step="0.01" />
      </div>

      <div>
        <label>Skills (comma-separated)</label>
        <br />
        <input value={skills} onChange={(e) => onSkillsChange(e.target.value)} style={{ width: "100%" }} />
      </div>

      <div>
        <label>Job Types (comma-separated)</label>
        <br />
        <input value={jobTypes} onChange={(e) => onJobTypesChange(e.target.value)} style={{ width: "100%" }} />
      </div>

      <div>
        <label>Locations (comma-separated)</label>
        <br />
        <input value={locations} onChange={(e) => onLocationsChange(e.target.value)} style={{ width: "100%" }} />
      </div>

      <label>
        <input
          type="checkbox"
          checked={sponsorshipAvailable}
          onChange={(e) => onSponsorshipChange(e.target.checked)}
        />{" "}
        Sponsorship Available
      </label>

      <button type="submit">Save Profile</button>
    </form>
  );
}
