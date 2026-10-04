import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft,
  TrendingDown,
  TrendingUp,
  FilePlus,
  FileX,
  FilePen,
  CheckCircle,
  XCircle,
  RotateCcw,
  Pencil,
  Ban,
  PlusCircle,
  type LucideIcon,
} from "lucide-react";
import type { components } from "@/api/generated";

type HistoryEvent = NonNullable<
  components["schemas"]["Invoice"]["history"]
>[number]["event"];

function historyMeta(event: HistoryEvent): {
  label: string;
  Icon: LucideIcon;
  color: string;
} {
  switch (event) {
    case "created":
      return {
        label: "Invoice created",
        Icon: PlusCircle,
        color: "text-blue-500",
      };
    case "transaction_added":
      return {
        label: "Payment added",
        Icon: FilePlus,
        color: "text-green-600",
      };
    case "transaction_removed":
      return {
        label: "Payment removed",
        Icon: FileX,
        color: "text-orange-500",
      };
    case "transaction_updated":
      return {
        label: "Payment updated",
        Icon: FilePen,
        color: "text-blue-500",
      };
    case "mark_paid":
      return {
        label: "Marked as paid",
        Icon: CheckCircle,
        color: "text-green-600",
      };
    case "mark_unpaid":
      return {
        label: "Marked as unpaid",
        Icon: XCircle,
        color: "text-orange-500",
      };
    case "updated":
      return { label: "Invoice updated", Icon: Pencil, color: "text-gray-500" };
    case "cancelled":
      return { label: "Invoice cancelled", Icon: Ban, color: "text-red-500" };
    case "restored":
      return {
        label: "Invoice restored",
        Icon: RotateCcw,
        color: "text-green-500",
      };
    default:
      return { label: event ?? "Event", Icon: Pencil, color: "text-gray-400" };
  }
}
import {
  useInvoice,
  useMarkInvoicePaid,
  useUnmarkInvoicePaid,
  useDeleteInvoice,
  promptCancelReason,
  useRestoreInvoice,
  InvoiceStatusBadge,
  InvoiceFormDialog,
  AddPaymentDialog,
} from "@/features/invoices";
import { WalletLink } from "@/features/wallets";
import { DeletedBanner } from "@/components/DeletedBanner";
import { formatCurrency, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [showEdit, setShowEdit] = useState(false);
  const [showPayment, setShowPayment] = useState(false);

  const { data: invoice, isLoading, error } = useInvoice(id!);
  const markPaid = useMarkInvoicePaid();
  const unmarkPaid = useUnmarkInvoicePaid();
  const deleteInvoice = useDeleteInvoice();
  const restoreInvoice = useRestoreInvoice();

  const actionError = markPaid.error || unmarkPaid.error || deleteInvoice.error;

  async function handleCancel() {
    const reason = promptCancelReason(invoice?.contact?.name);
    if (reason === null) return;
    await deleteInvoice.mutateAsync({ id: invoice!.id!, reason });
    navigate("/invoices");
  }

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-2xl">
        <div className="h-8 w-48 rounded bg-gray-200 animate-pulse" />
        <div className="h-40 rounded-lg bg-gray-200 animate-pulse" />
        <div className="h-48 rounded-lg bg-gray-200 animate-pulse" />
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => navigate("/invoices")}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft size={15} />
          Back
        </button>
        <p className="text-sm text-red-600">
          {error?.message ?? "Invoice not found."}
        </p>
      </div>
    );
  }

  const isPayable = invoice.type === "payable";
  const amount = invoice.total?.amount ?? 0;
  const paidAmount = invoice.paidAmount?.amount ?? 0;
  const remaining = Math.max(0, amount - paidAmount);
  const progressPct =
    amount > 0 ? Math.min(100, (paidAmount / amount) * 100) : 0;
  const isDeleted = !!invoice.deletedAt;
  const isActionable =
    invoice.status === "pending" || invoice.status === "partial";
  const wallet = invoice.wallet;

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="p-1.5 rounded hover:bg-gray-100 text-gray-500 transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-xl font-semibold text-gray-900">Invoice Detail</h1>
      </div>

      {isDeleted && (
        <DeletedBanner
          resource="invoice"
          deletedAt={invoice.deletedAt!}
          onRestore={() => restoreInvoice.mutate(invoice.id!)}
          isRestoring={restoreInvoice.isPending}
          error={restoreInvoice.error}
        />
      )}

      {/* Header card */}
      <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <p className="text-lg font-semibold text-gray-900 truncate">
              {invoice.contact?.name ?? "—"}
            </p>
            {invoice.contact?.email && (
              <p className="text-sm text-gray-500">{invoice.contact.email}</p>
            )}
            <div className="flex items-center gap-2 mt-1">
              <span
                className={cn(
                  "inline-flex items-center gap-1 text-xs font-medium",
                  isPayable ? "text-orange-600" : "text-green-600",
                )}
              >
                {isPayable ? (
                  <TrendingDown size={12} />
                ) : (
                  <TrendingUp size={12} />
                )}
                {isPayable ? "Payable" : "Receivable"}
              </span>
              <InvoiceStatusBadge
                status={invoice.status}
                isOverdue={invoice.isOverdue}
              />
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-2xl font-bold text-gray-900">
              {formatCurrency(amount, invoice.total?.currency ?? "")}
            </p>
            {paidAmount > 0 && (
              <p className="text-sm text-gray-500 mt-0.5">
                {formatCurrency(paidAmount, invoice.total?.currency ?? "")} paid
              </p>
            )}
          </div>
        </div>

        {/* Progress bar */}
        {amount > 0 && invoice.status !== "cancelled" && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-gray-500">
              <span>{progressPct.toFixed(0)}% paid</span>
              {remaining > 0 && (
                <span>
                  {formatCurrency(remaining, invoice.total?.currency ?? "")}{" "}
                  remaining
                </span>
              )}
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  progressPct >= 100 ? "bg-green-500" : "bg-blue-500",
                )}
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        )}

        {/* Detail grid */}
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm border-t border-gray-100 pt-3">
          <dt className="text-gray-500">Issue date</dt>
          <dd className="text-gray-900">
            {invoice.issueDate ? formatDate(invoice.issueDate) : "—"}
          </dd>
          <dt className="text-gray-500">Due date</dt>
          <dd
            className={cn(
              "font-medium",
              invoice.isOverdue ? "text-red-600" : "text-gray-900",
            )}
          >
            {invoice.dueDate ? formatDate(invoice.dueDate) : "—"}
          </dd>
          {wallet && (
            <>
              <dt className="text-gray-500">Wallet</dt>
              <dd>
                <WalletLink wallet={wallet} />
              </dd>
            </>
          )}
          {invoice.contractId && (
            <>
              <dt className="text-gray-500">Contract</dt>
              <dd className="text-gray-900">
                <Link
                  to={`/contracts/${invoice.contractId}`}
                  className="text-blue-600 hover:underline"
                >
                  View contract
                </Link>
              </dd>
            </>
          )}
          {invoice.description && (
            <>
              <dt className="text-gray-500">Description</dt>
              <dd className="text-gray-900">{invoice.description}</dd>
            </>
          )}
          {invoice.notes && (
            <>
              <dt className="text-gray-500">Notes</dt>
              <dd className="text-gray-900 whitespace-pre-wrap">
                {invoice.notes}
              </dd>
            </>
          )}
        </dl>

        {invoice.tags && invoice.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {invoice.tags.map((tag) => (
              <span
                key={tag.id}
                className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600"
              >
                {tag.name}
              </span>
            ))}
          </div>
        )}

        {actionError && (
          <p className="text-sm text-red-600">{actionError.message}</p>
        )}

        {/* Actions */}
        {!isDeleted && invoice.status !== "cancelled" && (
          <div className="flex flex-wrap gap-2 pt-1 border-t border-gray-100">
            <button
              onClick={() => setShowEdit(true)}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Edit
            </button>
            {isActionable && (
              <>
                <button
                  onClick={() => setShowPayment(true)}
                  className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  Add Payment
                </button>
                <button
                  onClick={() => markPaid.mutate(invoice.id!)}
                  disabled={markPaid.isPending}
                  className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 transition-colors"
                >
                  {markPaid.isPending ? "Saving..." : "Mark as Paid"}
                </button>
              </>
            )}
            {invoice.status === "paid" && (
              <button
                onClick={() => unmarkPaid.mutate(invoice.id!)}
                disabled={unmarkPaid.isPending}
                className="px-3 py-1.5 text-sm border border-gray-200 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                {unmarkPaid.isPending ? "Saving..." : "Unmark Paid"}
              </button>
            )}
            <button
              onClick={handleCancel}
              disabled={deleteInvoice.isPending}
              className="ml-auto px-3 py-1.5 text-sm border border-red-200 rounded-md text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
            >
              {deleteInvoice.isPending ? "Cancelling..." : "Cancel Invoice"}
            </button>
          </div>
        )}
      </div>

      {/* Linked payments */}
      <div className="space-y-3">
        <h2 className="text-sm font-medium text-gray-700">Linked Payments</h2>

        {(!invoice.transactions || invoice.transactions.length === 0) && (
          <p className="text-sm text-gray-400">No payments recorded yet.</p>
        )}

        {invoice.transactions && invoice.transactions.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
            {invoice.transactions.map((tx) => (
              <div
                key={tx.id}
                className="flex items-center justify-between px-4 py-3 gap-4"
              >
                <div className="text-sm text-gray-500 whitespace-nowrap">
                  <Link
                    to={`/transactions/${tx.id}`}
                    className="text-sm text-gray-900 hover:text-blue-600 hover:underline"
                  >
                    {tx.date ? formatDate(tx.date) : "—"}
                  </Link>
                </div>
                <div className="flex-1 min-w-0">
                  <p>{tx.description}</p>
                </div>
                <div className="text-sm font-medium text-gray-900 whitespace-nowrap">
                  {tx.type === "income" ? "+" : "−"}
                  {formatCurrency(
                    tx.total?.amount ?? 0,
                    tx.total?.currency ?? invoice.total?.currency ?? "",
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Activity history */}
      {invoice.history && invoice.history.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-gray-700">Activity</h2>
          <div className="relative">
            <div className="absolute left-2.25 top-2 bottom-2 w-px bg-gray-200" />
            <div className="space-y-3">
              {invoice.history
                .sort((a, b) => {
                  if (a.at && b.at) {
                    if (a.at > b.at) {
                      return -1;
                    } else {
                      return 1;
                    }
                  }
                  return 0;
                })
                .map((item, idx) => {
                  const { label, Icon, color } = historyMeta(item.event);
                  return (
                    <div key={idx} className="flex items-start gap-3">
                      <div
                        className={cn(
                          "flex-none w-4.5 h-4.5 mt-0.5 rounded-full bg-white border border-gray-200 flex items-center justify-center z-10",
                          color,
                        )}
                      >
                        <Icon size={10} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm text-gray-900">{label}</span>
                          <span className="text-xs text-gray-400 whitespace-nowrap">
                            {item.at ? formatDate(item.at) : "—"}
                          </span>
                        </div>
                        {item.transactionAmount != null && (
                          <p className="text-xs text-gray-500 mt-0.5">
                            {formatCurrency(
                              item.transactionAmount,
                              invoice.total?.currency ?? "",
                            )}
                            {item.transactionId && (
                              <Link
                                to={`/transactions/${item.transactionId}`}
                                className="ml-2 text-blue-500 hover:underline"
                              >
                                View
                              </Link>
                            )}
                          </p>
                        )}
                        {item.reason && (
                          <p className="text-xs text-gray-500 mt-0.5 italic whitespace-pre-wrap">
                            “{item.reason}”
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {showEdit && (
        <InvoiceFormDialog
          invoice={invoice}
          onClose={() => setShowEdit(false)}
        />
      )}
      {showPayment && (
        <AddPaymentDialog
          invoice={invoice}
          onClose={() => setShowPayment(false)}
        />
      )}
    </div>
  );
}
