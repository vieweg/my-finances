import { useState } from "react";
import { BalanceChart } from "./BalanceChart";
import { defaultBalanceRange } from "../balanceRange";
import type { components } from "@/api/generated";

type Wallet = components["schemas"]["Wallet"];

export function WalletsBalanceChart({ wallets }: { wallets: Wallet[] }) {
  const [range, setRange] = useState(defaultBalanceRange);

  return (
    <BalanceChart
      walletIds={wallets.map((w) => w.id!)}
      range={range}
      onRangeChange={setRange}
    />
  );
}
