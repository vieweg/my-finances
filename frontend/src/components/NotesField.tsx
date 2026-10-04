interface NotesFieldProps {
  value: string;
  onChange: (value: string) => void;
}

/** Optional free-text notes textarea shared by the transaction, invoice and contract forms. */
export function NotesField({ value, onChange }: NotesFieldProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Notes <span className="text-xs font-normal text-gray-400">(optional)</span>
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        maxLength={2000}
        placeholder="Anything worth remembering about this..."
        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
      />
    </div>
  );
}
