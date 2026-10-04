import { useState, useEffect, useMemo } from "react";
import { FileText, ChevronDown, ChevronUp } from "lucide-react";
import { useInvoices } from "../hooks/useInvoices";
import type { InvoiceFilters } from "../hooks/useInvoices";
import { InvoiceRow } from "./InvoiceRow";
import { InvoiceFiltersBar } from "./InvoiceFiltersBar";
import { formatCurrency, formatListCount } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { components } from "@/api/generated";

type Invoice = components["schemas"]["Invoice"];
type ProjectedInvoice = components["schemas"]["ProjectedInvoice"];
type SortField = NonNullable<InvoiceFilters["sortBy"]>;

function isRealInvoice(inv: Invoice | ProjectedInvoice): inv is Invoice {
  return "id" in inv;
}

/** Projected (forecast) invoices have no id; a contract only projects one invoice per due date. */
function selectionKey(inv: Invoice | ProjectedInvoice): string {
  return isRealInvoice(inv)
    ? inv.id!
    : `projected:${inv.contractId}:${inv.dueDate}`;
}

interface SortableHeaderProps {
  field: SortField;
  label: string;
  align?: "left" | "right";
  filters: InvoiceFilters;
  onChange: (f: InvoiceFilters) => void;
  className?: string;
}

function SortableHeader({
  field,
  label,
  align = "left",
  filters,
  onChange,
  className,
}: SortableHeaderProps) {
  const isActive = (filters.sortBy ?? "dueDate") === field;
  const order = filters.sortOrder ?? "asc";
  return (
    <th
      className={cn(
        "py-2.5 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap cursor-pointer select-none hover:text-gray-700",
        align === "right" ? "text-right" : "text-left",
        className,
      )}
      onClick={() =>
        onChange({
          ...filters,
          sortBy: field,
          sortOrder: isActive && order === "desc" ? "asc" : "desc",
        })
      }
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {isActive &&
          (order === "desc" ? (
            <ChevronDown size={12} />
          ) : (
            <ChevronUp size={12} />
          ))}
      </span>
    </th>
  );
}

export interface InvoiceListProps {
  /** Date range and deleted flag injected by the parent (not shown in filter bar). */
  fixedFilters?: Pick<
    InvoiceFilters,
    "startDate" | "endDate" | "deleted" | "filterByStatus" | "forecast"
  >;
  /** Hide the date range and invoice status inputs in the advanced filter panel. */
  hideDateRange?: boolean;
  hideStatus?: boolean;
  /** Default sort applied when the user hasn't chosen one. */
  defaultSort?: {
    sortBy: InvoiceFilters["sortBy"];
    sortOrder: InvoiceFilters["sortOrder"];
  };
  /** Controlled selection — pass a Set to enable checkboxes. */
  selectedIds?: Set<string>;
  selectionMode?: boolean;
  onSelectionChange?: (ids: Set<string>) => void;
  onEdit?: (invoice: Invoice) => void;
  onDelete?: (invoice: Invoice) => void;
  onAddPayment?: (invoice: Invoice) => void;
  onBulkPay?: (invoices: Invoice[]) => void;
  onRestore?: (invoice: Invoice) => void;
  onHardDelete?: (invoice: Invoice) => void;
  emptyMessage?: string;
}

export function InvoiceList({
  fixedFilters,
  hideDateRange,
  hideStatus,
  defaultSort = { sortBy: "dueDate", sortOrder: "asc" },
  selectedIds,
  selectionMode = false,
  onSelectionChange,
  onEdit,
  onDelete,
  onAddPayment,
  onBulkPay,
  onRestore,
  onHardDelete,
  emptyMessage,
}: InvoiceListProps) {
  const [filters, setFilters] = useState<
    Omit<InvoiceFilters, "startDate" | "endDate" | "deleted">
  >({});

  useEffect(() => {
    setFilters({});
  }, [fixedFilters?.startDate, fixedFilters?.endDate]);

  const queryFilters: InvoiceFilters = {
    ...filters,
    ...fixedFilters,
    sortBy: filters.sortBy ?? defaultSort.sortBy,
    sortOrder: filters.sortOrder ?? defaultSort.sortOrder,
  };

  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInvoices(queryFilters);

  const invoices = data?.pages.flatMap((p) => p.data ?? []) ?? [];
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
    onSelectionChange(
      checked ? new Set(invoices.map(selectionKey)) : new Set(),
    );
  }

  function handleFilterChange(f: InvoiceFilters) {
    const { startDate: _s, endDate: _e, deleted: _d, ...rest } = f;
    setFilters(rest);
  }

  const allSelected =
    selectable && invoices.length > 0 && selectedIds!.size === invoices.length;
  const someSelected =
    selectable && (selectedIds?.size ?? 0) > 0 && !allSelected;

  const summaryRows = useMemo(() => {
    if (selectable && selectedIds!.size > 0)
      return invoices.filter((inv) => selectedIds!.has(selectionKey(inv)));
    return invoices;
  }, [invoices, selectedIds, selectable]);

  // Forecast invoices don't exist yet, so they can't receive payments
  const selectionHasProjected =
    selectable && selectedIds!.size > 0 && !summaryRows.every(isRealInvoice);

  const bulkPayEligible = useMemo(() => {
    if (!onBulkPay || !selectable || !selectedIds?.size) return false;
    if (!summaryRows.every(isRealInvoice)) return false;
    const payable = summaryRows.filter(
      (inv) =>
        inv.status !== "cancelled" &&
        inv.status !== "paid" &&
        Math.max(0, (inv.total?.amount ?? 0) - (inv.paidAmount?.amount ?? 0)) >
          0,
    );
    if (payable.length !== summaryRows.length) return false;
    const type = payable[0]?.type;
    const currency = payable[0]?.total?.currency;
    return payable.every(
      (inv) => inv.type === type && inv.total?.currency === currency,
    );
  }, [summaryRows, onBulkPay, selectable]);

  const summary = useMemo(() => {
    const byCurrency: Record<string, { receivable: number; payable: number }> =
      {};
    for (const inv of summaryRows) {
      const cur = inv.total?.currency ?? "";
      if (!cur) continue;
      const balance = Math.max(
        0,
        (inv.total?.amount ?? 0) - (inv.paidAmount?.amount ?? 0),
      );
      if (!byCurrency[cur]) byCurrency[cur] = { receivable: 0, payable: 0 };
      if (inv.type === "receivable") byCurrency[cur].receivable += balance;
      else byCurrency[cur].payable += balance;
    }
    return { byCurrency, count: summaryRows.length };
  }, [summaryRows]);

  return (
    <div className="space-y-2">
      <InvoiceFiltersBar
        filters={queryFilters}
        onChange={handleFilterChange}
        hideDateRange={hideDateRange}
        hideStatus={hideStatus}
      />

      {isLoading && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="h-14 border-b border-gray-100 animate-pulse bg-gray-50"
            />
          ))}
        </div>
      )}

      {error && (
        <p className="text-sm text-red-600">
          Error loading invoices: {error.message}
        </p>
      )}

      {!isLoading && invoices.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-lg border border-gray-200 text-center">
          <FileText size={40} className="text-gray-300 mb-3" />
          <p className="text-sm text-gray-500">
            {emptyMessage ??
              (fixedFilters?.deleted
                ? "No deleted invoices."
                : "No invoices found.")}
          </p>
        </div>
      )}

      {invoices.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th
                    className={cn(
                      "py-2.5 pl-4 pr-2 w-8",
                      selectable && selectionMode
                        ? "table-cell"
                        : "hidden sm:table-cell",
                    )}
                  >
                    {selectable && (
                      <input
                        type="checkbox"
                        checked={allSelected}
                        ref={(el) => {
                          if (el) el.indeterminate = someSelected;
                        }}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    )}
                  </th>
                  <SortableHeader
                    field="dueDate"
                    label="Due date"
                    filters={queryFilters}
                    onChange={handleFilterChange}
                  />
                  <SortableHeader
                    field="contact"
                    label="Contact"
                    filters={queryFilters}
                    onChange={handleFilterChange}
                    className="hidden sm:table-cell"
                  />
                  <SortableHeader
                    field="description"
                    label="Description"
                    filters={queryFilters}
                    onChange={handleFilterChange}
                    className="hidden sm:table-cell"
                  />
                  <SortableHeader
                    field="amount"
                    label="Amount"
                    align="right"
                    filters={queryFilters}
                    onChange={handleFilterChange}
                    className="hidden sm:table-cell"
                  />
                  <SortableHeader
                    field="outstanding"
                    label="Balance"
                    align="right"
                    filters={queryFilters}
                    onChange={handleFilterChange}
                  />
                  <th className="py-2.5 px-4" />
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => (
                  <InvoiceRow
                    key={selectionKey(invoice)}
                    invoice={invoice}
                    selected={
                      selectable
                        ? selectedIds!.has(selectionKey(invoice))
                        : undefined
                    }
                    selectionMode={selectable ? selectionMode : false}
                    onSelect={
                      selectable
                        ? (checked) =>
                            handleSelect(selectionKey(invoice), checked)
                        : undefined
                    }
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onAddPayment={onAddPayment}
                    onRestore={onRestore}
                    onHardDelete={onHardDelete}
                  />
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-gray-200 bg-gray-50">
                  <td colSpan={7} className="py-2.5 px-4">
                    <div className="flex flex-1 justify-between items-center text-xs text-gray-500">
                      <div className="flex items-center gap-3">
                        <span className="font-medium whitespace-nowrap text-gray-700">
                          {selectable && selectedIds!.size > 0
                            ? `${summary.count} selected`
                            : formatListCount(summary.count, total, "invoice")}
                        </span>
                        {bulkPayEligible && (
                          <button
                            onClick={() => onBulkPay!(summaryRows as Invoice[])}
                            className="px-2.5 py-1 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                          >
                            Pay {summary.count} invoice
                            {summary.count !== 1 ? "s" : ""}
                          </button>
                        )}
                        {onBulkPay && selectionHasProjected && (
                          <span className="text-gray-400 italic">
                            Forecast invoices can't be paid
                          </span>
                        )}
                      </div>
                      <div className="flex gap-x-2 flex-wrap whitespace-nowrap w-min">
                        {Object.entries(summary.byCurrency).map(
                          ([cur, totals]) => {
                            const net = totals.receivable - totals.payable;
                            return (
                              <div
                                key={cur}
                                className="flex items-center gap-1"
                              >
                                <span className="text-gray-400">{cur}</span>
                                <span className="text-green-700">
                                  {formatCurrency(totals.receivable, cur)}
                                </span>
                                <span>-</span>
                                <span className="text-red-700">
                                  {formatCurrency(totals.payable, cur)}
                                </span>
                                <span>=</span>
                                <span
                                  className={cn(
                                    "font-medium",
                                    net >= 0
                                      ? "text-green-700"
                                      : "text-red-700",
                                  )}
                                >
                                  {formatCurrency(net, cur)}
                                </span>
                              </div>
                            );
                          },
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

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
