"use client";

import TagPicker from "@/components/TagPicker";
import { LOCATION_OPTIONS } from "@/lib/locations";

type LocationPickerProps = {
  label?: string;
  value: string[];
  onChange: (locations: string[]) => void;
  maxItems?: number;
};

export default function LocationPicker({
  label = "Locations",
  value,
  onChange,
  maxItems,
}: LocationPickerProps) {
  return (
    <TagPicker
      label={label}
      value={value}
      onChange={onChange}
      options={LOCATION_OPTIONS}
      placeholder="Start typing a location"
      itemName="location"
      maxItems={maxItems}
    />
  );
}
