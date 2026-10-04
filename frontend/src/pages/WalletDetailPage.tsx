import { useState, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft,
  Trash2,
  ChevronDown,
  TrendingUp,
  TrendingDown,
  SlidersHorizontal,
  Link as LinkIcon,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  useWallet,
  useWalletHistory,
  useDeleteWalletSnapshot,
  useRestoreWallet,
  BalanceChart,
} from "@/features/wallets";
import { defaultBalanceRange } from "@/features/wallets/balanceRange";
import { DeletedBanner } from "@/components/DeletedBanner";
import type { components } from "@/api/generated";

type Snapshot = components["schemas"]["WalletSnapshot"];

export default function WalletDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  // Shared by the chart and the entry list so both show the same period
  const [range, setRange] = useState(defaultBalanceRange);

  const {
    data: wallet,
    isLoading: walletLoading,
    error: walletError,
  } = useWallet(id!);
  const {
    data: historyData,
    isLoading: historyLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useWalletHistory(id!, range);
  const deleteSnapshot = useDeleteWalletSnapshot(id!);
  const restoreWallet = useRestoreWallet();

  const allSnapshots = useMemo(
    () => historyData?.pages.flatMap((p) => p.data ?? []) ?? [],
    [historyData],
  );

  const currency = wallet?.currency ?? "BRL";

  async function handleDelete(snapshot: Snapshot) {
    if (!confirm("Remove this manual adjustment from history?")) return;
    await deleteSnapshot.mutateAsync(snapshot.id!);
  }

  if (walletLoading) {
    return (
      <div className="space-y-4 max-w-2xl">
        <div className="h-8 w-48 rounded bg-gray-200 animate-pulse" />
        <div className="h-32 rounded-lg bg-gray-200 animate-pulse" />
        <div className="h-64 rounded-lg bg-gray-200 animate-pulse" />
      </div>
    );
  }

  if (walletError || !wallet) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => navigate("/wallets")}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft size={15} />
          Back
        </button>
        <p className="text-sm text-red-600">
          {walletError?.message ?? "Wallet not found."}
        </p>
      </div>
    );
  }

  const isDeleted = !!wallet.deletedAt;

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate("/wallets")}
          className="p-1.5 rounded hover:bg-gray-100 text-gray-500 transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-xl font-semibold text-gray-900">{wallet.name}</h1>
          <p className="text-sm text-gray-500">{wallet.currency}</p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-2xl font-bold text-gray-900">
            {formatCurrency(wallet.currentBalance ?? 0, wallet.currency)}
          </p>
          <p className="text-xs text-gray-400">current balance</p>
        </div>
      </div>

      {isDeleted && (
        <DeletedBanner
          resource="wallet"
          deletedAt={wallet.deletedAt!}
          onRestore={() => restoreWallet.mutate(wallet.id!)}
          isRestoring={restoreWallet.isPending}
          error={restoreWallet.error}
        />
      )}

      <BalanceChart walletIds={[id!]} range={range} onRangeChange={setRange} />

      {/* Snapshot list */}
      <div className="space-y-3">
        <h2 className="text-sm font-medium text-gray-700">History entries</h2>

        {historyLoading && (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="h-14 rounded-lg bg-gray-100 animate-pulse"
              />
            ))}
          </div>
        )}

        {!historyLoading && allSnapshots.length === 0 && (
          <p className="text-sm text-gray-400 py-4">No history entries.</p>
        )}

        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          {allSnapshots.map((snap, i) => {
            const isManual = snap.source === "manual";
            const isPositive = (snap.delta ?? 0) >= 0;

            return (
              <div
                key={snap.id}
                className={cn(
                  "flex items-center gap-3 px-4 py-3",
                  i < allSnapshots.length - 1 && "border-b border-gray-100",
                )}
              >
                <div
                  className={cn(
                    "flex items-center justify-center w-7 h-7 rounded-full shrink-0",
                    isManual
                      ? "bg-purple-50 text-purple-600"
                      : isPositive
                        ? "bg-green-50 text-green-600"
                        : "bg-red-50 text-red-600",
                  )}
                >
                  {isManual ? (
                    <SlidersHorizontal size={13} />
                  ) : isPositive ? (
                    <TrendingUp size={13} />
                  ) : (
                    <TrendingDown size={13} />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {/* effectiveAt is the date the change counts from (what the chart uses) */}
                    <span className="text-xs text-gray-500">
                      {snap.effectiveAt ? formatDate(snap.effectiveAt) : "—"}
                    </span>
                    {snap.recordedAt &&
                      snap.effectiveAt &&
                      formatDate(snap.recordedAt) !==
                        formatDate(snap.effectiveAt) && (
                        <span
                          className="text-xs text-gray-400"
                          title="Entered later than the date it counts from"
                        >
                          (entered {formatDate(snap.recordedAt)})
                        </span>
                      )}
                    {isManual && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-purple-50 text-purple-600">
                        manual adjustment
                      </span>
                    )}
                    {!isManual && snap.transactionId && (
                      <Link to={`/transactions/${snap.transactionId}`}>
                        <span className="inline-flex items-center gap-1 text-xs text-blue-500">
                          <LinkIcon size={10} />
                          transaction
                        </span>
                      </Link>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span
                      className={cn(
                        "text-sm font-medium",
                        isPositive ? "text-green-700" : "text-red-700",
                      )}
                    >
                      {isPositive ? "+" : ""}
                      {formatCurrency(snap.delta ?? 0, currency)}
                    </span>
                    <span
                      className="text-xs text-gray-500"
                      title="Wallet balance at the moment this entry was saved. For entries dated in the past it won't follow on from the entries around it; the chart shows the balance by date."
                    >
                      Balance when entered:{" "}
                      {formatCurrency(snap.amount ?? 0, currency)}
                    </span>
                  </div>
                </div>

                {isManual && !isDeleted && (
                  <button
                    onClick={() => handleDelete(snap)}
                    disabled={deleteSnapshot.isPending}
                    className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50 shrink-0"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {hasNextPage && (
          <button
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 disabled:opacity-50"
          >
            <ChevronDown size={15} />
            {isFetchingNextPage ? "Loading..." : "Load more"}
          </button>
        )}
      </div>
    </div>
  );
}
