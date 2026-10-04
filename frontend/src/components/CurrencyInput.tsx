import type { InputHTMLAttributes } from "react";

interface CurrencyInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> {
  value: number | null;
  onChange: (value: number | null) => void;
}

function formatCents(digits: string): string {
  if (!digits) return "";
  const padded = digits.padStart(3, "0");
  const dec = padded.slice(-2);
  const intStr = padded.slice(0, -2).replace(/^0+/, "") || "0";
  const intFormatted = intStr.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${intFormatted},${dec}`;
}

export function CurrencyInput({ value, onChange, ...props }: CurrencyInputProps) {
  const digits = value ? Math.round(value * 100).toString() : "";
  const display = formatCents(digits);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/\D/g, "").replace(/^0+/, "");
    onChange(raw ? parseInt(raw, 10) / 100 : null);
  }

  return (
    <input
      {...props}
      type="text"
      inputMode="numeric"
      value={display}
      onChange={handleChange}
      placeholder={props.placeholder ?? "0,00"}
    />
  );
}
