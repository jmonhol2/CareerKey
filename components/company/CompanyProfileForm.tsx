import MajorPicker from "@/components/MajorPicker";
import SkillPicker from "@/components/SkillPicker";
import LocationPicker from "@/components/LocationPicker";

type CompanyProfileFormProps = {
  companyName: string;
  description: string;
  website: string;
  majors: string[];
  minGpa: string;
  skills: string[];
  jobTypes: string;
  locations: string[];
  sponsorshipAvailable: boolean;
  onCompanyNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onWebsiteChange: (value: string) => void;
  onMajorsChange: (value: string[]) => void;
  onMinGpaChange: (value: string) => void;
  onSkillsChange: (value: string[]) => void;
  onJobTypesChange: (value: string) => void;
  onLocationsChange: (value: string[]) => void;
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
    <form onSubmit={onSubmit} className="formPanel">
      <div className="formField">
        <label>Company Name</label>
        <input
          value={companyName}
          onChange={(e) => onCompanyNameChange(e.target.value)}
        />
      </div>

      <div className="formField">
        <label>Description</label>
        <textarea
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          rows={4}
        />
      </div>

      <div className="formField">
        <label>Website</label>
        <input value={website} onChange={(e) => onWebsiteChange(e.target.value)} />
      </div>

      <MajorPicker value={majors} onChange={onMajorsChange} />

      <div className="formField">
        <label>Minimum GPA</label>
        <input value={minGpa} onChange={(e) => onMinGpaChange(e.target.value)} type="number" step="0.01" />
      </div>

      <SkillPicker value={skills} onChange={onSkillsChange} />

      <div className="formField">
        <label>Job Types (comma-separated)</label>
        <input value={jobTypes} onChange={(e) => onJobTypesChange(e.target.value)} />
      </div>

      <LocationPicker value={locations} onChange={onLocationsChange} />

      <label>
        <input
          type="checkbox"
          checked={sponsorshipAvailable}
          onChange={(e) => onSponsorshipChange(e.target.checked)}
        />{" "}
        Sponsorship Available
      </label>

      <button type="submit" className="btn btnPrimary">Save Profile</button>
    </form>
  );
}
