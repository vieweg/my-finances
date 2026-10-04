import { cn } from "@/lib/utils";

type Status = "active" | "completed" | "cancelled";

interface Props {
  status?: Status;
}

const statusStyles: Record<Status, string> = {
  active: "bg-green-100 text-green-700",
  completed: "bg-blue-100 text-blue-700",
  cancelled: "bg-slate-100 text-slate-500",
};

const statusLabels: Record<Status, string> = {
  active: "Active",
  completed: "Completed",
  cancelled: "Cancelled",
};

export function ContractStatusBadge({ status }: Props) {
  const s = status ?? "active";
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
        statusStyles[s],
      )}
    >
      {statusLabels[s]}
    </span>
  );
}
