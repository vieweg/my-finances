import { useState, useMemo, useEffect } from "react";
import { Receipt, ChevronDown, ChevronUp } from "lucide-react";
import { useTransactions } from "../hooks/useTransactions";
import type { TransactionFilters } from "../hooks/useTransactions";
import { TransactionRow } from "./TransactionRow";
import { TransactionFiltersBar } from "./TransactionFilters";
import { formatCurrency, formatListCount } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { components } from "@/api/generated";

type Transaction = components["schemas"]["Transaction"];
type SortField = NonNullable<TransactionFilters["sortBy"]>;

interface SortableHeaderProps {
  field: SortField;
  label: string;
  align?: "left" | "right";
  filters: TransactionFilters;
  onChange: (f: TransactionFilters) => void;
  className?: string;
}

function SortableHeader({ field, label, align = "left", filters, onChange, className }: SortableHeaderProps) {
  const isActive = (filters.sortBy ?? "date") === field;
  const order = filters.sortOrder ?? "desc";
  return (
    <th
      className={cn(
        "py-2.5 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap cursor-pointer select-none hover:text-gray-700",
        align === "right" ? "text-right" : "text-left",
        className,
      )}
      onClick={() =>
        onChange({ ...filters, sortBy: field, sortOrder: isActive && order === "desc" ? "asc" : "desc" })
      }
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {isActive && (order === "desc" ? <ChevronDown size={12} /> : <ChevronUp size={12} />)}
      </span>
    </th>
  );
}

export interface TransactionListProps {
  /** Date range and deleted flag injected by the parent (not shown in filter bar). */
  fixedFilters?: Pick<TransactionFilters, "startDate" | "endDate" | "deleted">;
  /** Hide the date range inputs in the advanced filter panel (use when parent controls the date range). */
  hideDateRange?: boolean;
  /** Filters the list starts with (e.g. from URL params); still editable in the filter bar. */
  initialFilters?: Omit<TransactionFilters, "startDate" | "endDate" | "deleted">;
  /** Controlled selection — pass a Set to enable checkboxes. */
  selectedIds?: Set<string>;
  selectionMode?: boolean;
  onSelectionChange?: (ids: Set<string>) => void;
  onEdit?: (t: Transaction) => void;
  onDelete?: (t: Transaction) => void;
  onRestore?: (t: Transaction) => void;
  onHardDelete?: (t: Transaction) => void;
  emptyMessage?: string;
}

export function TransactionList({
  fixedFilters,
  hideDateRange,
  initialFilters,
  selectedIds,
  selectionMode = false,
  onSelectionChange,
  onEdit,
  onDelete,
  onRestore,
  onHardDelete,
  emptyMessage,
}: TransactionListProps) {
  // Captured once; parents remount the list (via key) to apply new initial filters
  const [defaultFilters] = useState(initialFilters ?? {});
  const [filters, setFilters] =
    useState<Omit<TransactionFilters, "startDate" | "endDate" | "deleted">>(
      defaultFilters,
    );

  useEffect(() => {
    setFilters(defaultFilters);
  }, [defaultFilters, fixedFilters?.startDate, fixedFilters?.endDate]);

  const queryFilters: TransactionFilters = { ...filters, ...fixedFilters };

  const { data, isLoading, error, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useTransactions(queryFilters);

  const transactions = data?.pages.flatMap((p) => p.data ?? []) ?? [];
  const total = data?.pages[data.pages.length - 1]?.pagination?.total;
  const selectable = selectedIds !== undefined;

  function handleSelect(id: string, checked: boolean) {
    if (!onSelectionChange || !selectedIds) return;
    const next = new Set(selectedIds);
    if (checked) next.add(id);
    else next.delete(id);
    onSelectionChange(next);
  }

  function handleSelectAll(checked: boolean) {
    if (!onSelectionChange) return;
    onSelectionChange(checked ? new Set(transactions.map((t) => t.id!)) : new Set());
  }

  function handleFilterChange(f: TransactionFilters) {
    const { startDate: _s, endDate: _e, deleted: _d, ...rest } = f;
    setFilters(rest);
  }

  const allSelected = selectable && transactions.length > 0 && selectedIds!.size === transactions.length;
  const someSelected = selectable && (selectedIds?.size ?? 0) > 0 && !allSelected;

  const summaryRows = useMemo(() => {
    if (selectable && selectedIds!.size > 0) {
      return transactions.filter((t) => selectedIds!.has(t.id!));
    }
    return transactions;
  }, [transactions, selectedIds, selectable]);

  const summary = useMemo(() => {
    const byCurrency: Record<string, { income: number; outcome: number }> = {};
    for (const t of summaryRows) {
      const cur = t.total?.currency ?? "BRL";
      const amt = t.total?.amount ?? 0;
      if (!byCurrency[cur]) byCurrency[cur] = { income: 0, outcome: 0 };
      if (t.type === "income") byCurrency[cur].income += amt;
      else byCurrency[cur].outcome += amt;
    }
    return { byCurrency, count: summaryRows.length };
  }, [summaryRows]);

  return (
    <div className="space-y-2">
      <TransactionFiltersBar
        filters={queryFilters}
        onChange={handleFilterChange}
        hideDateRange={hideDateRange}
        defaultExpanded={!!initialFilters?.tags?.length}
      />

      {isLoading && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-14 border-b border-gray-100 animate-pulse bg-gray-50" />
          ))}
        </div>
      )}

      {error && (
        <p className="text-sm text-red-600">Error loading transactions: {error.message}</p>
      )}

      {!isLoading && transactions.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-lg border border-gray-200 text-center">
          <Receipt size={40} className="text-gray-300 mb-3" />
          <p className="text-sm text-gray-500">
            {emptyMessage ?? (fixedFilters?.deleted ? "No deleted transactions." : "No transactions found.")}
          </p>
        </div>
      )}

      {transactions.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th
                  className={cn(
                    "py-2.5 pl-4 pr-2 w-8",
                    selectable && selectionMode ? "table-cell" : "hidden sm:table-cell",
                  )}
                >
                  {selectable && (
                    <input
                      type="checkbox"
                      checked={allSelected}
                      ref={(el) => { if (el) el.indeterminate = someSelected; }}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  )}
                </th>
                <SortableHeader field="date" label="Date" filters={queryFilters} onChange={handleFilterChange} className="hidden sm:table-cell" />
                <SortableHeader field="description" label="Description" filters={queryFilters} onChange={handleFilterChange} />
                <SortableHeader field="total" label="Amount" align="right" filters={queryFilters} onChange={handleFilterChange} />
                <th className="py-2.5 px-4" />
              </tr>
            </thead>
            <tbody>
              {transactions.map((transaction) => (
                <TransactionRow
                  key={transaction.id}
                  transaction={transaction}
                  selected={selectable ? selectedIds!.has(transaction.id!) : undefined}
                  selectionMode={selectable ? selectionMode : false}
                  onSelect={selectable ? handleSelect : undefined}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onRestore={onRestore}
                  onHardDelete={onHardDelete}
                />
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-gray-200 bg-gray-50">
                <td colSpan={5} className="py-2.5 px-4">
                  <div className="flex flex-1 justify-between items-center text-xs text-gray-500">
                    <div className="font-medium whitespace-nowrap text-gray-700">
                      {selectable && selectedIds!.size > 0
                        ? `${summary.count} selected`
                        : formatListCount(summary.count, total, "transaction")}
                    </div>
                    <div className="flex gap-x-2 flex-wrap whitespace-nowrap w-min">
                      {Object.entries(summary.byCurrency).map(([cur, totals]) => (
                        <div key={cur} className="flex items-center gap-1">
                          <span className="text-gray-400">{cur}</span>
                          <span className="text-green-700">{formatCurrency(totals.income, cur)}</span>
                          <span>-</span>
                          <span className="text-red-700">{formatCurrency(totals.outcome, cur)}</span>
                          <span>=</span>
                          <span className={cn("font-medium", totals.income - totals.outcome >= 0 ? "text-green-700" : "text-red-700")}>
                            {formatCurrency(totals.income - totals.outcome, cur)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </td>
              </tr>
            </tfoot>
          </table>

          {hasNextPage && (
            <div className="flex justify-center py-4 border-t border-gray-100">
              <button
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                className="text-sm text-blue-600 hover:text-blue-700 disabled:opacity-50"
              >
                {isFetchingNextPage ? "Loading..." : "Load more"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
