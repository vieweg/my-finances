import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

interface Props {
  year: number;
  month: number; // 0-indexed
  onChange: (year: number, month: number) => void;
}

export function MonthNavigator({ year, month, onChange }: Props) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3 flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={() => onChange(year - 1, month)}
          className="p-1 rounded text-gray-500 hover:bg-gray-100 transition-colors cursor-pointer"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="text-sm font-medium text-gray-700 w-12 text-center">
          {year}
        </span>
        <button
          onClick={() => onChange(year + 1, month)}
          className="p-1 rounded text-gray-500 hover:bg-gray-100 transition-colors cursor-pointer"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="flex flex-wrap gap-1">
        {MONTHS.map((label, i) => (
          <button
            key={label}
            onClick={() => onChange(year, i)}
            className={cn(
              "px-3 py-1 text-sm rounded-md transition-colors cursor-pointer",
              month === i
                ? "bg-blue-600 text-white font-medium"
                : "text-gray-600 hover:bg-gray-100",
            )}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
