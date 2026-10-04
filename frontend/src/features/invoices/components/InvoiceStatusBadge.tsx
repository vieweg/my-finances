import { cn } from "@/lib/utils";

type Status = "pending" | "partial" | "paid" | "cancelled";

interface Props {
  status?: Status;
  isOverdue?: boolean;
}

const statusStyles: Record<Status, string> = {
  pending: "bg-gray-100 text-gray-600",
  partial: "bg-yellow-100 text-yellow-700",
  paid: "bg-green-100 text-green-700",
  cancelled: "bg-slate-100 text-slate-500",
};

const statusLabels: Record<Status, string> = {
  pending: "Pending",
  partial: "Partial",
  paid: "Paid",
  cancelled: "Cancelled",
};

export function InvoiceStatusBadge({ status, isOverdue }: Props) {
  const s = status ?? "pending";
  const overdue = isOverdue && (s === "pending" || s === "partial");

  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
        overdue ? "bg-red-100 text-red-700" : statusStyles[s],
      )}
    >
      {overdue ? "Overdue" : statusLabels[s]}
    </span>
  );
}
