import {
  Ban,
  CircleDollarSign,
  Pencil,
  RotateCcw,
  Trash2,
  Repeat2,
} from "lucide-react";
import { Link } from "react-router-dom";
import { formatCurrency, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { components } from "@/api/generated";

type Invoice = components["schemas"]["Invoice"];
type ProjectedInvoice = components["schemas"]["ProjectedInvoice"];

interface Props {
  invoice: Invoice | ProjectedInvoice;
  selected?: boolean;
  selectionMode?: boolean;
  onSelect?: (checked: boolean) => void;
  onEdit?: (invoice: Invoice) => void;
  onDelete?: (invoice: Invoice) => void;
  onAddPayment?: (invoice: Invoice) => void;
  onRestore?: (invoice: Invoice) => void;
  onHardDelete?: (invoice: Invoice) => void;
}

export function InvoiceRow({
  invoice,
  selected = false,
  selectionMode = false,
  onSelect,
  onEdit,
  onDelete,
  onAddPayment,
  onRestore,
  onHardDelete,
}: Props) {
  const isReceivable = invoice.type === "receivable";
  const isOverdue = invoice.isOverdue ?? false;
  const contractId = invoice.contractId ?? false;
  const outstanding =
    (invoice.total?.amount ?? 0) - (invoice.paidAmount?.amount ?? 0);
  const isPaid = invoice.status === "paid";
  const isProjected = invoice.projected === true;
  const realInvoice = invoice as Invoice;

  return (
    <tr
      className={cn(
        "border-b border-gray-100 hover:bg-gray-50 transition-colors",
        (isPaid || isProjected) && "opacity-50",
      )}
    >
      <td
        className={cn(
          "py-3 pl-4 pr-2 w-8",
          selectionMode ? "table-cell" : "hidden sm:table-cell",
        )}
      >
        {onSelect && (
          <input
            type="checkbox"
            checked={selected}
            onChange={(e) => onSelect(e.target.checked)}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
        )}
      </td>
      <td className="py-3 px-4 text-sm whitespace-nowrap hidden sm:table-cell">
        {isProjected ? (
          <span className={cn(isOverdue ? "text-red-600" : "text-gray-500", "text-sm")}>
            {invoice.dueDate ? formatDate(invoice.dueDate) : "—"}
          </span>
        ) : (
          <Link
            to={`/invoices/${realInvoice.id}`}
            className={cn(
              isOverdue ? "text-red-600" : "text-gray-500",
              "text-sm",
              "hover:text-blue-600",
              "hover:underline",
            )}
          >
            {invoice.dueDate ? formatDate(invoice.dueDate) : "—"}
          </Link>
        )}
      </td>
      <td className="py-3 px-4">
        {isProjected ? (
          <span className={cn(isOverdue ? "text-red-600" : "text-gray-500", "text-sm sm:hidden")}>
            {invoice.dueDate ? formatDate(invoice.dueDate) : "—"}
          </span>
        ) : (
          <Link
            to={`/invoices/${realInvoice.id}`}
            className={cn(
              isOverdue ? "text-red-600" : "text-gray-500",
              "text-sm",
              "hover:text-blue-600",
              "hover:underline",
              "sm:hidden",
            )}
          >
            {invoice.dueDate ? formatDate(invoice.dueDate) : "—"}
          </Link>
        )}
        <p className="text-gray-700 mt-0.5">{invoice.contact?.name ?? "—"}</p>
        {invoice.description && (
          <p className="sm:hidden text-xs text-gray-400 mt-0.5 truncate max-w-45 flex items-center gap-1">
            {contractId && (
              <Link
                to={`/contracts/${contractId}`}
                className="p-1.5 shrink-0 text-gray-500 hover:text-blue-500 transition-colors"
                title="View contract"
                onClick={(e) => e.stopPropagation()}
              >
                <Repeat2 size={15} />
              </Link>
            )}
            <span className="truncate">{invoice.description}</span>
          </p>
        )}
      </td>
      <td className="py-3 px-4 hidden sm:table-cell">
        <span className="flex items-center gap-1.5">
          {contractId && (
            <Link
              to={`/contracts/${contractId}`}
              className="mt-1 shrink-0 text-gray-500 hover:text-blue-500 transition-colors"
              title="View contract"
              onClick={(e) => e.stopPropagation()}
            >
              <Repeat2 size={15} />
            </Link>
          )}
          <span className="text-sm text-gray-700 truncate max-w-xs">
            {invoice.description || "—"}
          </span>
        </span>
      </td>
      <td className="py-3 px-4 text-right hidden sm:table-cell">
        <p className="text-sm whitespace-nowrap text-gray-700">
          {isReceivable ? "+" : "−"}
          {formatCurrency(
            invoice.total?.amount ?? 0,
            invoice.total?.currency ?? "",
          )}
        </p>
      </td>
      <td className="py-3 px-4 text-right">
        {outstanding > 0 ? (
          <p
            className={cn(
              "text-sm text-gray-700 whitespace-nowrap",
              isReceivable ? "text-green-700" : "text-red-700",
            )}
          >
            {isReceivable ? "+" : "−"}
            {formatCurrency(outstanding, invoice.total?.currency ?? "")}
          </p>
        ) : (
          <span className="text-sm text-gray-300">—</span>
        )}
      </td>
      <td className="py-3 px-2 sm:px-4">
        <div className="flex items-center justify-end gap-1">
          {isProjected ? null : onRestore ? (
            <>
              <button
                onClick={() => onRestore(realInvoice)}
                className="p-1.5 rounded text-gray-400 hover:text-green-600 hover:bg-green-50 transition-colors"
                title="Restore invoice"
              >
                <RotateCcw size={14} />
              </button>
              {onHardDelete && (
                <button
                  onClick={() => onHardDelete(realInvoice)}
                  className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                  title="Permanently delete"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </>
          ) : (
            <>
              {onAddPayment &&
                (invoice.status === "pending" ||
                  invoice.status === "partial") && (
                  <button
                    onClick={() => onAddPayment(realInvoice)}
                    className="p-1.5 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                    title="Add payment"
                  >
                    <CircleDollarSign size={14} />
                  </button>
                )}
              {onEdit && (
                <button
                  onClick={() => onEdit(realInvoice)}
                  className="p-1.5 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                  title="Edit"
                >
                  <Pencil size={14} />
                </button>
              )}
              {onDelete && (
                <button
                  onClick={() => onDelete(realInvoice)}
                  disabled={invoice.status === "cancelled"}
                  className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-30 transition-colors"
                  title="Cancel invoice"
                >
                  <Ban size={14} />
                </button>
              )}
            </>
          )}
        </div>
      </td>
    </tr>
  );
}
