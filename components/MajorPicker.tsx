"use client";

import TagPicker from "@/components/TagPicker";
import { MAJOR_OPTIONS } from "@/lib/majors";

type MajorPickerProps = {
  label?: string;
  value: string[];
  onChange: (majors: string[]) => void;
};

export default function MajorPicker({
  label = "Majors sought",
  value,
  onChange,
}: MajorPickerProps) {
  return (
    <TagPicker
      label={label}
      value={value}
      onChange={onChange}
      options={MAJOR_OPTIONS}
      placeholder="Start typing a major"
      itemName="major"
    />
  );
}
