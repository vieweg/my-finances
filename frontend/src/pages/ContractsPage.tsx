import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Plus,
  RotateCcw,
  Trash2,
  Search,
  X,
  ChevronDown,
  ChevronUp,
  Repeat2,
  Ban,
  Pencil,
} from "lucide-react";
import {
  useContracts,
  useDeleteContract,
  useHardDeleteContract,
  useRestoreContract,
  ContractStatusBadge,
  ContractFormDialog,
} from "@/features/contracts";
import { useContacts } from "@/features/contacts";
import { formatCurrency, formatDate, formatListCount } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { components } from "@/api/generated";
import type { ContractFilters } from "@/features/contracts";

type Contract = components["schemas"]["Contract"];
type SortField = NonNullable<ContractFilters["sortBy"]>;

interface SortableHeaderProps {
  field: SortField;
  label: string;
  align?: "left" | "right";
  filters: ContractFilters;
  onChange: (f: ContractFilters) => void;
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
  const isActive = (filters.sortBy ?? "nextDueDate") === field;
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

type DialogState =
  { type: "create" } | { type: "edit"; contract: Contract } | null;

const TYPE_OPTIONS: {
  label: string;
  value: ContractFilters["filterByType"];
}[] = [
  { label: "All", value: undefined },
  { label: "Payable", value: "payable" },
  { label: "Receivable", value: "receivable" },
];

// Cancelled contracts are always soft-deleted, so they only show in the Deleted view
const STATUS_OPTIONS: {
  label: string;
  value: Pick<ContractFilters, "filterByStatus" | "includeCompleted">;
}[] = [
  { label: "Active", value: {} },
  { label: "Completed", value: { filterByStatus: "completed" } },
  { label: "All", value: { includeCompleted: true } },
];

export default function ContractsPage() {
  const [showDeleted, setShowDeleted] = useState(false);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [filters, setFilters] = useState<ContractFilters>({});
  const [expandedFilters, setExpandedFilters] = useState(false);

  const deleteContract = useDeleteContract();
  const hardDeleteContract = useHardDeleteContract();
  const restoreContract = useRestoreContract();
  const { data: contactsData } = useContacts();
  const contacts = contactsData?.pages.flatMap((p) => p.data ?? []) ?? [];

  const queryFilters: ContractFilters = {
    ...filters,
    deleted: showDeleted || undefined,
    sortBy: filters.sortBy ?? "nextDueDate",
    sortOrder: filters.sortOrder ?? "asc",
  };

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    error,
  } = useContracts(queryFilters);

  const contracts = data?.pages.flatMap((p) => p.data ?? []) ?? [];
  const total = data?.pages[data.pages.length - 1]?.pagination?.total;

  const advancedCount =
    (filters.filterByStatus || filters.includeCompleted ? 1 : 0) + (filters.filterByContactId ? 1 : 0);

  function toggleShowDeleted() {
    setShowDeleted((v) => !v);
    setFilters({});
  }

  async function handleDelete(contract: Contract) {
    if (!confirm(`Cancel contract "${contract.name}"?`)) return;
    await deleteContract.mutateAsync(contract.id!);
  }

  async function handleRestore(contract: Contract) {
    await restoreContract.mutateAsync(contract.id!);
  }

  async function handleHardDelete(contract: Contract) {
    if (
      !confirm(
        `Permanently delete contract "${contract.name}"?\n\nThis action is irreversible and cannot be undone.`,
      )
    )
      return;
    await hardDeleteContract.mutateAsync(contract.id!);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Contracts</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleShowDeleted}
            className={`flex items-center gap-2 px-3 py-2 text-sm rounded-md border transition-colors ${
              showDeleted
                ? "bg-red-50 border-red-200 text-red-600 hover:bg-red-100"
                : "border-gray-200 text-gray-500 hover:bg-gray-50"
            }`}
          >
            {showDeleted ? <RotateCcw size={14} /> : <Trash2 size={14} />}
            <span className="hidden sm:inline">
              {showDeleted ? "Active" : "Deleted"}
            </span>
          </button>
          {!showDeleted && (
            <button
              onClick={() => setDialog({ type: "create" })}
              className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
            >
              <Plus size={16} />
              <span className="hidden sm:inline">New Contract</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter bar */}
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
                setFilters((f) => ({
                  ...f,
                  search: e.target.value || undefined,
                }))
              }
              placeholder="Search description, notes or contact..."
              className="w-full pl-9 pr-8 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {filters.search && (
              <button
                onClick={() => setFilters((f) => ({ ...f, search: undefined }))}
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
                onClick={() =>
                  setFilters((f) => ({ ...f, filterByType: value }))
                }
                className={cn(
                  "px-3 py-1.5 text-xs font-medium transition-colors",
                  filters.filterByType === value
                    ? "bg-blue-600 text-white"
                    : "text-gray-600 hover:bg-gray-50",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <button
            onClick={() => setExpandedFilters((v) => !v)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border transition-colors",
              expandedFilters
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
            {expandedFilters ? (
              <ChevronUp size={14} />
            ) : (
              <ChevronDown size={14} />
            )}
          </button>
        </div>

        {expandedFilters && (
          <div className="border-t border-gray-100 p-3 space-y-3">
            {!showDeleted && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-gray-500 shrink-0">Status:</span>
                <div className="flex rounded-md border border-gray-200 overflow-hidden">
                  {STATUS_OPTIONS.map(({ label, value }) => (
                    <button
                      key={label}
                      onClick={() =>
                        setFilters((f) => ({
                          ...f,
                          filterByStatus: value.filterByStatus,
                          includeCompleted: value.includeCompleted,
                        }))
                      }
                      className={cn(
                        "px-3 py-1.5 text-xs font-medium transition-colors",
                        filters.filterByStatus === value.filterByStatus &&
                          !!filters.includeCompleted === !!value.includeCompleted
                          ? "bg-blue-600 text-white"
                          : "text-gray-600 hover:bg-gray-50",
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {contacts.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 shrink-0">Contact:</span>
                <select
                  value={filters.filterByContactId ?? ""}
                  onChange={(e) =>
                    setFilters((f) => ({
                      ...f,
                      filterByContactId: e.target.value || undefined,
                    }))
                  }
                  className="text-sm border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All contacts</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Loading */}
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
          Error loading contracts: {error.message}
        </p>
      )}
      {restoreContract.error && (
        <p className="text-sm text-red-600">{restoreContract.error.message}</p>
      )}

      {/* Empty state */}
      {!isLoading && contracts.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-lg border border-gray-200 text-center">
          <Repeat2 size={40} className="text-gray-300 mb-3" />
          <p className="text-sm text-gray-500">
            {showDeleted ? "No deleted contracts." : "No contracts found."}
          </p>
        </div>
      )}

      {/* Table */}
      {contracts.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <SortableHeader
                    field="nextDueDate"
                    label="Next due"
                    filters={queryFilters}
                    onChange={(f) =>
                      setFilters((prev) => ({
                        ...prev,
                        sortBy: f.sortBy,
                        sortOrder: f.sortOrder,
                      }))
                    }
                  />
                  <SortableHeader
                    field="name"
                    label="Name"
                    filters={queryFilters}
                    onChange={(f) =>
                      setFilters((prev) => ({
                        ...prev,
                        sortBy: f.sortBy,
                        sortOrder: f.sortOrder,
                      }))
                    }
                  />
                  <SortableHeader
                    field="status"
                    label="Status"
                    filters={queryFilters}
                    onChange={(f) =>
                      setFilters((prev) => ({
                        ...prev,
                        sortBy: f.sortBy,
                        sortOrder: f.sortOrder,
                      }))
                    }
                    className="hidden sm:table-cell"
                  />
                  <SortableHeader
                    field="type"
                    label="Type"
                    filters={queryFilters}
                    onChange={(f) =>
                      setFilters((prev) => ({
                        ...prev,
                        sortBy: f.sortBy,
                        sortOrder: f.sortOrder,
                      }))
                    }
                    className="hidden md:table-cell"
                  />
                  <SortableHeader
                    field="amount"
                    label="Amount"
                    align="right"
                    filters={queryFilters}
                    onChange={(f) =>
                      setFilters((prev) => ({
                        ...prev,
                        sortBy: f.sortBy,
                        sortOrder: f.sortOrder,
                      }))
                    }
                  />
                  <th className="py-2.5 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide text-left hidden lg:table-cell whitespace-nowrap">
                    Progress
                  </th>
                  <th className="py-2.5 px-4" />
                </tr>
              </thead>
              <tbody>
                {contracts.map((contract) => {
                  const totalInstalments = contract.instalments ?? 0;
                  const done = contract.instalmentsDone ?? 0;
                  const isInfinite = totalInstalments === 0;
                  const progressLabel = isInfinite
                    ? `${done} generated`
                    : `${done} / ${totalInstalments}`;

                  return (
                    <tr
                      key={contract.id}
                      className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                    >
                      <td className="py-3 px-4 text-sm whitespace-nowrap">
                        <Link
                          to={`/contracts/${contract.id}`}
                          className="text-gray-500 hover:text-blue-600 hover:underline"
                        >
                          {contract.nextDueDate
                            ? formatDate(contract.nextDueDate)
                            : "—"}
                        </Link>
                      </td>
                      <td className="py-3 px-4">
                        <p className="text-sm text-gray-900 font-medium">
                          {contract.name}
                        </p>
                        {contract.contact?.name && (
                          <p className="text-xs text-gray-400 mt-0.5">
                            {contract.contact.name}
                          </p>
                        )}
                      </td>
                      <td className="py-3 px-4 hidden sm:table-cell">
                        <ContractStatusBadge status={contract.status} />
                      </td>
                      <td className="py-3 px-4 hidden md:table-cell">
                        <span
                          className={cn(
                            "text-xs font-medium capitalize",
                            contract.type === "payable"
                              ? "text-orange-600"
                              : "text-green-600",
                          )}
                        >
                          {contract.type}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <p className="text-sm text-gray-700 whitespace-nowrap">
                          {contract.type === "receivable" ? "+" : "−"}
                          {formatCurrency(
                            contract.total?.amount ?? 0,
                            contract.total?.currency ?? "",
                          )}
                        </p>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-500 hidden lg:table-cell whitespace-nowrap">
                        {progressLabel}
                      </td>
                      <td className="py-3 px-2 sm:px-4">
                        <div className="flex items-center justify-end gap-1">
                          {showDeleted ? (
                            <>
                              <button
                                onClick={() => handleRestore(contract)}
                                disabled={restoreContract.isPending}
                                className="p-1.5 rounded text-gray-400 hover:text-green-600 hover:bg-green-50 transition-colors disabled:opacity-40"
                                title="Restore contract"
                              >
                                <RotateCcw size={14} />
                              </button>
                              <button
                                onClick={() => handleHardDelete(contract)}
                                disabled={hardDeleteContract.isPending}
                                className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-30"
                                title="Permanently delete"
                              >
                                <Trash2 size={14} />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() =>
                                  setDialog({ type: "edit", contract })
                                }
                                className="p-1.5 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                                title="Edit"
                              >
                                <Pencil size={14} />
                              </button>
                              <button
                                onClick={() => handleDelete(contract)}
                                disabled={
                                  contract.status === "cancelled" ||
                                  deleteContract.isPending
                                }
                                className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-30 transition-colors"
                                title="Cancel contract"
                              >
                                <Ban size={14} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-gray-200 bg-gray-50">
                  <td colSpan={7} className="py-2.5 px-4">
                    <span className="text-xs font-medium text-gray-700">
                      {formatListCount(contracts.length, total, "contract")}
                    </span>
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

      {dialog?.type === "create" && (
        <ContractFormDialog onClose={() => setDialog(null)} />
      )}
      {dialog?.type === "edit" && (
        <ContractFormDialog
          contract={dialog.contract}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
}
