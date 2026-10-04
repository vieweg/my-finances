import { Pencil, FileText, RotateCcw, Trash2, Wallet } from "lucide-react";
import { Link } from "react-router-dom";
import { formatCurrency, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { components } from "@/api/generated";

type Transaction = components["schemas"]["Transaction"];

interface Props {
  transaction: Transaction;
  selected?: boolean;
  selectionMode?: boolean;
  onSelect?: (id: string, checked: boolean) => void;
  onEdit?: (t: Transaction) => void;
  onDelete?: (t: Transaction) => void;
  onRestore?: (t: Transaction) => void;
  onHardDelete?: (t: Transaction) => void;
}

export function TransactionRow({
  transaction,
  selected = false,
  selectionMode = false,
  onSelect,
  onEdit,
  onDelete,
  onRestore,
  onHardDelete,
}: Props) {
  const isIncome = transaction.type === "income";
  const amount = transaction.total?.amount ?? 0;
  const currency = transaction.total?.currency ?? "BRL";
  const wallet = transaction.wallet;
  const invoiceId = transaction.invoice?.id ?? false;

  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
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
            onChange={(e) => onSelect(transaction.id!, e.target.checked)}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
        )}
      </td>
      <td className="py-3 px-4 text-sm text-gray-500 whitespace-nowrap hidden sm:table-cell">
        <Link
          to={`/transactions/${transaction.id}`}
          className="text-sm text-gray-900 hover:text-blue-600 hover:underline"
        >
          {transaction.date ? formatDate(transaction.date) : "—"}
        </Link>
      </td>
      <td className="py-3 px-4">
        <Link
          to={`/transactions/${transaction.id}`}
          className="text-sm text-gray-700 hover:text-blue-600 hover:underline sm:hidden"
        >
          {transaction.date ? formatDate(transaction.date) : ""}
        </Link>
        <span className="flex items-center gap-1 mt-0.5">
          {invoiceId && (
            <Link
              to={`/invoices/${invoiceId}`}
              className="p-1.5 shrink-0 text-gray-500 hover:text-blue-500 transition-colors"
              title="View invoice"
              onClick={(e) => e.stopPropagation()}
            >
              <FileText size={15} />
            </Link>
          )}
          <span className="text-gray-700">{transaction.description}</span>
        </span>
        {transaction.tags && transaction.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {transaction.tags.map((tag) => (
              <span
                key={tag.id}
                className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500"
              >
                {tag.name}
              </span>
            ))}
          </div>
        )}
      </td>
      <td className="py-3 px-4 text-right">
        <p
          className={cn(
            "text-sm whitespace-nowrap",
            isIncome ? "text-green-700" : "text-red-700",
          )}
        >
          {isIncome ? "+" : "−"}
          {formatCurrency(amount, currency)}
        </p>
        {wallet && (
          <span
            className={cn(
              "inline-flex items-center gap-1 mt-1 text-xs px-1.5 py-0.5 rounded",
              wallet.deletedAt
                ? "bg-gray-100 text-gray-400 line-through"
                : "bg-blue-50 text-blue-600",
            )}
            title={wallet.deletedAt ? "Deleted wallet" : undefined}
          >
            <Wallet size={10} className="hidden sm:block" />
            {wallet.name}
          </span>
        )}
      </td>
      <td className="py-3 px-2 sm:px-4">
        <div className="flex items-center justify-end gap-1">
          {onRestore ? (
            <>
              <button
                onClick={() => onRestore(transaction)}
                className="p-1.5 rounded text-gray-400 hover:text-green-600 hover:bg-green-50 transition-colors"
                title="Restore transaction"
              >
                <RotateCcw size={15} />
              </button>
              {onHardDelete && (
                <button
                  onClick={() => onHardDelete(transaction)}
                  className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                  title="Permanently delete"
                >
                  <Trash2 size={15} />
                </button>
              )}
            </>
          ) : (
            <>
              <button
                onClick={() => onEdit && onEdit(transaction)}
                className="p-1.5 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                title="Edit transaction"
              >
                <Pencil size={15} />
              </button>
              <button
                onClick={() => onDelete && onDelete(transaction)}
                className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                title="Delete transaction"
              >
                <Trash2 size={15} />
              </button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}
