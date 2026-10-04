import { useState } from "react";
import { Search, X, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCurrencyStore } from "@/store/currency";
import type { TransactionFilters } from "../hooks/useTransactions";
import { TagInput } from "./TagInput";
import type { TagEntry } from "@/features/tags/filters";

interface Props {
  filters: TransactionFilters;
  onChange: (filters: TransactionFilters) => void;
  hideDateRange?: boolean;
  /** Start with the advanced filter panel open. */
  defaultExpanded?: boolean;
}

const TYPE_OPTIONS: { label: string; value: TransactionFilters["type"] }[] = [
  { label: "All", value: undefined },
  { label: "Income", value: "income" },
  { label: "Expenses", value: "outcome" },
];

function countAdvancedFilters(
  filters: TransactionFilters,
  hideDateRange?: boolean,
): number {
  let count = 0;
  if (!hideDateRange) {
    if (filters.startDate) count++;
    if (filters.endDate) count++;
  }
  if (filters.filterByCurrency) count++;
  if (filters.tags?.length) count++;
  return count;
}

export function TransactionFiltersBar({
  filters,
  onChange,
  hideDateRange,
  defaultExpanded = false,
}: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const { currency: appCurrency, availableCurrencies } = useCurrencyStore();

  const advancedCount = countAdvancedFilters(filters, hideDateRange);

  function handleTagsChange(tags: TagEntry[]) {
    onChange({ ...filters, tags: tags.length ? tags : undefined });
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <div className="p-3 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            value={filters.search ?? ""}
            onChange={(e) =>
              onChange({ ...filters, search: e.target.value || undefined })
            }
            placeholder="Search description, notes, wallet or tags..."
            className="w-full pl-9 pr-8 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {filters.search && (
            <button
              onClick={() => onChange({ ...filters, search: undefined })}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="flex rounded-md border border-gray-200 overflow-hidden">
          {TYPE_OPTIONS.map(({ label, value }) => (
            <button
              key={label}
              onClick={() => onChange({ ...filters, type: value })}
              className={cn(
                "px-3 py-1.5 text-xs font-medium transition-colors",
                filters.type === value
                  ? "bg-blue-600 text-white"
                  : "text-gray-600 hover:bg-gray-50",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <button
          onClick={() => setExpanded((v) => !v)}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border transition-colors",
            expanded
              ? "border-blue-300 bg-blue-50 text-blue-700"
              : "border-gray-200 text-gray-600 hover:bg-gray-50",
          )}
        >
          More filters
          {advancedCount > 0 && (
            <span className="inline-flex items-center justify-center w-4 h-4 text-xs bg-blue-600 text-white rounded-full">
              {advancedCount}
            </span>
          )}
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 p-3 space-y-3">
          {!hideDateRange && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-gray-500 w-6">From:</span>
              <input
                type="date"
                value={filters.startDate ?? ""}
                onChange={(e) =>
                  onChange({
                    ...filters,
                    startDate: e.target.value || undefined,
                  })
                }
                className="text-sm border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-xs text-gray-500">To:</span>
              <input
                type="date"
                value={filters.endDate ?? ""}
                onChange={(e) =>
                  onChange({ ...filters, endDate: e.target.value || undefined })
                }
                className="text-sm border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {!appCurrency && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 shrink-0">Currency:</span>
              <div className="flex rounded-md border border-gray-200 overflow-hidden">
                <button
                  onClick={() =>
                    onChange({ ...filters, filterByCurrency: undefined })
                  }
                  className={cn(
                    "px-3 py-1.5 text-xs font-medium transition-colors",
                    filters.filterByCurrency === undefined
                      ? "bg-blue-600 text-white"
                      : "text-gray-600 hover:bg-gray-50",
                  )}
                >
                  All
                </button>
                {availableCurrencies.map((currency) => (
                  <button
                    key={currency}
                    onClick={() =>
                      onChange({ ...filters, filterByCurrency: currency })
                    }
                    className={cn(
                      "px-3 py-1.5 text-xs font-medium transition-colors",
                      filters.filterByCurrency === currency
                        ? "bg-blue-600 text-white"
                        : "text-gray-600 hover:bg-gray-50",
                    )}
                  >
                    {currency}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Tags:</span>
            <TagInput
              value={filters.tags ?? []}
              onChange={handleTagsChange}
            />
          </div>
        </div>
      )}
    </div>
  );
}
