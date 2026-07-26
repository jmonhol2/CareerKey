"use client";

import { useId, useMemo, useState } from "react";

type TagPickerProps = {
  label: string;
  value: string[];
  onChange: (items: string[]) => void;
  options: readonly string[];
  placeholder: string;
  itemName: string;
  maxItems?: number;
};

function normalize(value: string) {
  return value.trim().toLocaleLowerCase();
}

export default function TagPicker({
  label,
  value,
  onChange,
  options,
  placeholder,
  itemName,
  maxItems,
}: TagPickerProps) {
  const generatedId = useId();
  const inputId = `tag-picker-${generatedId}`;
  const listId = `${inputId}-suggestions`;
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const uniqueValue = useMemo(() => {
    const seen = new Set<string>();

    return value.filter((item) => {
      const normalized = normalize(item);
      if (!normalized || seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    });
  }, [value]);
  const limitReached = maxItems !== undefined && uniqueValue.length >= maxItems;

  const selected = useMemo(() => new Set(uniqueValue.map(normalize)), [uniqueValue]);
  const suggestions = useMemo(() => {
    const search = normalize(query);
    if (!search) return [];

    return options
      .filter(
        (option) =>
          !selected.has(normalize(option)) && normalize(option).includes(search)
      )
      .sort((first, second) => {
        const firstStarts = normalize(first).startsWith(search);
        const secondStarts = normalize(second).startsWith(search);
        if (firstStarts !== secondStarts) return firstStarts ? -1 : 1;
        return first.localeCompare(second);
      })
      .slice(0, 8);
  }, [options, query, selected]);

  function addItem(candidate?: string) {
    if (limitReached) return;

    const nextItem = (candidate ?? suggestions[activeIndex] ?? query).trim();
    if (!nextItem || selected.has(normalize(nextItem))) return;

    onChange([...uniqueValue, nextItem]);
    setQuery("");
    setOpen(false);
    setActiveIndex(0);
  }

  function removeItem(item: string) {
    onChange(uniqueValue.filter((selectedItem) => selectedItem !== item));
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" && suggestions.length) {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) => (current + 1) % suggestions.length);
    } else if (event.key === "ArrowUp" && suggestions.length) {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) => (current - 1 + suggestions.length) % suggestions.length);
    } else if (event.key === "Enter" && query.trim()) {
      event.preventDefault();
      addItem();
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div
      className="tagPicker"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <label htmlFor={inputId}>{label}</label>

      {uniqueValue.length > 0 && (
        <div className="tagPickerTags" aria-label={`Selected ${itemName}s`}>
          {uniqueValue.map((item) => (
            <span className="tagPickerTag" key={item}>
              {item}
              <button
                type="button"
                className="tagPickerTagRemove"
                onClick={() => removeItem(item)}
                aria-label={`Remove ${item}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {!limitReached && (
        <div className="tagPickerControl">
          <input
            id={inputId}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
              setOpen(Boolean(event.target.value.trim()));
            }}
            onFocus={() => setOpen(Boolean(query.trim()))}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={open && suggestions.length > 0}
            aria-controls={listId}
            aria-activedescendant={
              open && suggestions[activeIndex] ? `${listId}-${activeIndex}` : undefined
            }
          />
          <button
            type="button"
            className="btn tagPickerAddButton"
            onClick={() => addItem()}
            disabled={!query.trim()}
          >
            Add
          </button>

          {open && suggestions.length > 0 && (
            <div className="tagPickerSuggestions" id={listId} role="listbox">
              {suggestions.map((suggestion, index) => (
                <button
                  type="button"
                  className={
                    index === activeIndex
                      ? "tagPickerSuggestion tagPickerSuggestionActive"
                      : "tagPickerSuggestion"
                  }
                  id={`${listId}-${index}`}
                  role="option"
                  aria-selected={index === activeIndex}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => addItem(suggestion)}
                  key={suggestion}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <p className="tagPickerHint">
        {limitReached
          ? `Remove the selected ${itemName} to choose another.`
          : `Choose a recommendation or press Enter to add a custom ${itemName}.`}
      </p>
    </div>
  );
}
