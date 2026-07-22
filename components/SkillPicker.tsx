"use client";

import TagPicker from "@/components/TagPicker";
import { SKILL_OPTIONS } from "@/lib/skills";

type SkillPickerProps = {
  label?: string;
  value: string[];
  onChange: (skills: string[]) => void;
};

export default function SkillPicker({
  label = "Skills",
  value,
  onChange,
}: SkillPickerProps) {
  return (
    <TagPicker
      label={label}
      value={value}
      onChange={onChange}
      options={SKILL_OPTIONS}
      placeholder="Start typing a skill"
      itemName="skill"
    />
  );
}
