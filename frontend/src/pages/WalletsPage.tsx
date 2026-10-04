import { useState, useEffect, useRef, useMemo } from "react";
import { Plus, RotateCcw, Trash2, Wallet, GripVertical } from "lucide-react";
import { DragDropProvider } from "@dnd-kit/react";
import { useSortable } from "@dnd-kit/react/sortable";
import { move } from "@dnd-kit/helpers";
import {
  useWallets,
  useDeleteWallet,
  useRestoreWallet,
  useHardDeleteWallet,
  useReorderWallets,
} from "@/features/wallets";
import {
  WalletCard,
  WalletFormDialog,
  AdjustBalanceDialog,
  WalletsBalanceChart,
} from "@/features/wallets";
import { useCurrencyStore } from "@/store/currency";
import { cn } from "@/lib/utils";
import type { components } from "@/api/generated";

type WalletType = components["schemas"]["Wallet"];

type DialogState =
  | { type: "create" }
  | { type: "edit"; wallet: WalletType }
  | { type: "adjust"; wallet: WalletType }
  | null;

interface SortableCardProps {
  wallet: WalletType;
  index: number;
  showDeleted: boolean;
  onEdit: (w: WalletType) => void;
  onAdjust: (w: WalletType) => void;
  onDelete: (w: WalletType) => void;
  onRestore?: (w: WalletType) => void;
  onHardDelete?: (w: WalletType) => void;
}

function SortableWalletCard({ wallet, index, showDeleted, onEdit, onAdjust, onDelete, onRestore, onHardDelete }: SortableCardProps) {
  const { ref, handleRef, isDragging, isDropTarget } = useSortable({
    id: wallet.id!,
    index,
    data: wallet,
    disabled: showDeleted,
  });

  return (
    <div
      ref={ref}
      className={cn(
        "relative group",
        isDragging && "opacity-40",
        isDropTarget && "ring-2 ring-blue-400 rounded-lg",
      )}
    >
      {!showDeleted && (
        <div
          ref={handleRef}
          className="absolute top-0 bottom-0 left-0 z-10 w-5 flex items-center justify-center cursor-grab opacity-0 group-hover:opacity-100 text-gray-300 hover:text-gray-500 transition-opacity rounded-l-lg"
          title="Drag to reorder"
        >
          <GripVertical size={14} />
        </div>
      )}
      <WalletCard
        wallet={wallet}
        onEdit={onEdit}
        onAdjust={onAdjust}
        onDelete={onDelete}
        onRestore={onRestore}
        onHardDelete={onHardDelete}
      />
    </div>
  );
}

export default function WalletsPage() {
  const [showDeleted, setShowDeleted] = useState(false);
  const { data: wallets, isLoading, error } = useWallets({ deleted: showDeleted || undefined });
  const deleteWallet = useDeleteWallet();
  const restoreWallet = useRestoreWallet();
  const hardDeleteWallet = useHardDeleteWallet();
  const reorderWallets = useReorderWallets();
  const [dialog, setDialog] = useState<DialogState>(null);
  const { currency } = useCurrencyStore();

  const [orderedIds, setOrderedIds] = useState<string[]>([]);
  const isDraggingRef = useRef(false);

  useEffect(() => {
    if (!isDraggingRef.current) {
      setOrderedIds(wallets?.map((w) => w.id!) ?? []);
    }
  }, [wallets]);

  const walletMap = useMemo(
    () => new Map(wallets?.map((w) => [w.id!, w])),
    [wallets],
  );
  const displayedWallets = orderedIds.map((id) => walletMap.get(id)).filter((w): w is WalletType => !!w);

  async function handleDelete(wallet: WalletType) {
    if (!confirm(`Delete wallet "${wallet.name}"?`)) return;
    await deleteWallet.mutateAsync(wallet.id!);
  }

  async function handleRestore(wallet: WalletType) {
    await restoreWallet.mutateAsync(wallet.id!);
  }

  async function handleHardDelete(wallet: WalletType) {
    if (
      !confirm(
        `Permanently delete wallet "${wallet.name}"?\n\nThis action is irreversible and cannot be undone.`,
      )
    )
      return;
    await hardDeleteWallet.mutateAsync(wallet.id!);
  }

  const cardProps = {
    showDeleted,
    onEdit: (w: WalletType) => setDialog({ type: "edit", wallet: w }),
    onAdjust: (w: WalletType) => setDialog({ type: "adjust", wallet: w }),
    onDelete: handleDelete,
    onRestore: showDeleted ? handleRestore : undefined,
    onHardDelete: showDeleted ? handleHardDelete : undefined,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Wallets</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowDeleted((v) => !v)}
            className={`flex items-center gap-2 px-3 py-2 text-sm rounded-md border transition-colors ${
              showDeleted
                ? "bg-red-50 border-red-200 text-red-600 hover:bg-red-100"
                : "border-gray-200 text-gray-500 hover:bg-gray-50"
            }`}
          >
            {showDeleted ? <RotateCcw size={14} /> : <Trash2 size={14} />}
            {showDeleted ? "Active" : "Deleted"}
          </button>
          {!showDeleted && (
            <button
              onClick={() => setDialog({ type: "create" })}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
            >
              <Plus size={16} />
              New Wallet
            </button>
          )}
        </div>
      </div>

      {isLoading && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg border border-gray-200 h-64 animate-pulse" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-white rounded-lg border border-gray-200 p-5 h-36 animate-pulse" />
            ))}
          </div>
        </div>
      )}

      {error && (
        <p className="text-sm text-red-600">Error loading wallets: {error.message}</p>
      )}

      {wallets && wallets.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Wallet size={40} className="text-gray-300 mb-3" />
          <p className="text-sm text-gray-500">
            {showDeleted ? "No deleted wallets." : "No wallets yet."}
          </p>
          {!showDeleted && (
            <button
              onClick={() => setDialog({ type: "create" })}
              className="mt-3 text-sm text-blue-600 hover:underline"
            >
              Create your first wallet
            </button>
          )}
        </div>
      )}

      {displayedWallets.length > 0 && (
        <>
          {currency && !showDeleted && <WalletsBalanceChart wallets={wallets ?? displayedWallets} />}

          <DragDropProvider
            onDragStart={() => { isDraggingRef.current = true; }}
            onDragEnd={async (event) => {
              isDraggingRef.current = false;
              if (event.canceled) {
                setOrderedIds(wallets?.map((w) => w.id!) ?? []);
                return;
              }
              const newIds = move(orderedIds, event) as string[];
              setOrderedIds(newIds);
              await reorderWallets.mutateAsync(newIds);
            }}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {displayedWallets.map((wallet, index) => (
                <SortableWalletCard key={wallet.id} wallet={wallet} index={index} {...cardProps} />
              ))}
            </div>
          </DragDropProvider>
        </>
      )}

      {dialog?.type === "create" && (
        <WalletFormDialog onClose={() => setDialog(null)} />
      )}
      {dialog?.type === "edit" && (
        <WalletFormDialog wallet={dialog.wallet} onClose={() => setDialog(null)} />
      )}
      {dialog?.type === "adjust" && (
        <AdjustBalanceDialog wallet={dialog.wallet} onClose={() => setDialog(null)} />
      )}
    </div>
  );
}
