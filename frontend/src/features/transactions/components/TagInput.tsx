import { useState, useEffect, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTagSearch } from "../hooks/useTagSearch";
import type { TagEntry } from "@/features/tags/filters";

function tagName(t: TagEntry): string {
  return typeof t === "string" ? t : t.name;
}

function tagKey(t: TagEntry): string {
  return typeof t === "string" ? t : (t.id ?? t.name);
}

interface Props {
  value: TagEntry[];
  onChange: (tags: TagEntry[]) => void;
}

export function TagInput({ value, onChange }: Props) {
  const [inputValue, setInputValue] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [debouncedInput, setDebouncedInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedInput(inputValue), 300);
    return () => clearTimeout(timer);
  }, [inputValue]);

  const { data: suggestions = [] } = useTagSearch(debouncedInput);

  const selectedNames = new Set(value.map(tagName).map((n) => n.toLowerCase()));

  const filteredSuggestions = suggestions.filter(
    (s) => s.name && !selectedNames.has(s.name.toLowerCase())
  );

  const trimmed = inputValue.trim();
  const exactMatch = suggestions.some(
    (s) => s.name?.toLowerCase() === trimmed.toLowerCase()
  );
  const showAddOption = trimmed.length > 0 && !exactMatch && !selectedNames.has(trimmed.toLowerCase());

  function addTag(tag: TagEntry) {
    onChange([...value, tag]);
    setInputValue("");
    setDebouncedInput("");
    setIsOpen(false);
    inputRef.current?.focus();
  }

  function removeTag(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (filteredSuggestions.length > 0) {
        const s = filteredSuggestions[0];
        addTag({ id: s.id, name: s.name! });
      } else if (trimmed) {
        addTag(trimmed);
      }
    } else if (e.key === "Backspace" && inputValue === "" && value.length > 0) {
      removeTag(value.length - 1);
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  }

  return (
    <div className="relative">
      <div
        className={cn(
          "flex flex-wrap gap-1.5 min-h-9 px-2 py-1.5 border border-gray-300 rounded-md",
          "focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500",
          "cursor-text"
        )}
        onClick={() => inputRef.current?.focus()}
      >
        {value.map((tag, i) => (
          <span
            key={tagKey(tag)}
            className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded-full"
          >
            {tagName(tag)}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); removeTag(i); }}
              className="hover:text-blue-600"
            >
              <X size={10} />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onBlur={() => setTimeout(() => setIsOpen(false), 150)}
          onKeyDown={handleKeyDown}
          placeholder={value.length === 0 ? "Add tags..." : ""}
          className="flex-1 min-w-24 text-sm outline-none bg-transparent"
        />
      </div>

      {isOpen && (filteredSuggestions.length > 0 || showAddOption) && (
        <ul className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto">
          {filteredSuggestions.map((s) => (
            <li key={s.id ?? s.name}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => addTag({ id: s.id, name: s.name! })}
                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
              >
                {s.name}
              </button>
            </li>
          ))}
          {showAddOption && (
            <li>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => addTag(trimmed)}
                className="w-full text-left px-3 py-2 text-sm text-blue-600 hover:bg-blue-50"
              >
                Add &quot;{trimmed}&quot;
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
