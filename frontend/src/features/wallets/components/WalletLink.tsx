import { Link } from "react-router-dom";
import type { components } from "@/api/generated";

type WalletSummary = components["schemas"]["WalletSummary"];

/** Wallet name linking to its detail page; soft-deleted wallets are still shown, marked as deleted. */
export function WalletLink({ wallet }: { wallet: WalletSummary }) {
  return (
    <Link
      to={`/wallets/${wallet.id}`}
      className={
        wallet.deletedAt
          ? "text-gray-400 line-through hover:text-blue-600"
          : "text-gray-900 hover:text-blue-600 hover:underline"
      }
      title={wallet.deletedAt ? "Deleted wallet" : undefined}
    >
      {wallet.name}
    </Link>
  );
}
