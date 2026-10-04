import { useState, useRef, useEffect } from "react";
import { useContacts } from "../hooks";

interface Props {
  value: string;
  initialName?: string;
  onChange: (id: string) => void;
  className?: string;
}

export function ContactCombobox({ value, initialName = "", onChange, className }: Props) {
  const [inputValue, setInputValue] = useState(initialName);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const { data } = useContacts({ name: debouncedQuery || undefined });
  const contacts = data?.pages.flatMap((p) => p.data ?? []) ?? [];

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearchQuery("");
        // restore display to selected contact name or clear if nothing selected
        setInputValue(value ? inputValue : "");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [value, inputValue]);

  function handleSelect(id: string, name: string) {
    onChange(id);
    setInputValue(name);
    setSearchQuery("");
    setDebouncedQuery("");
    setOpen(false);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    setInputValue(v);
    setSearchQuery(v);
    if (!open) setOpen(true);
    if (v === "") onChange("");
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        onFocus={() => setOpen(true)}
        placeholder="Search contact..."
        className={className}
        autoComplete="off"
      />
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg">
          <ul className="max-h-52 overflow-y-auto py-1">
            {contacts.length === 0 && (
              <li className="px-3 py-2 text-sm text-gray-400">No contacts found.</li>
            )}
            {contacts.map((c) => (
              <li
                key={c.id}
                onMouseDown={() => handleSelect(c.id!, c.name ?? "")}
                className={`px-3 py-2 text-sm cursor-pointer hover:bg-blue-50 ${
                  c.id === value ? "bg-blue-50 font-medium text-blue-700" : "text-gray-700"
                }`}
              >
                {c.name}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
