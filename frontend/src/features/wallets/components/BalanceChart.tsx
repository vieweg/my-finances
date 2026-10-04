import { useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  ResponsiveContainer,
  type TooltipContentProps,
  type TooltipValueType,
} from "recharts";
import { format } from "date-fns";
import { RotateCcw } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  useWalletBalanceSeries,
  type BalanceInterval,
} from "../hooks/useWalletBalanceSeries";
import { defaultBalanceRange, type DateRange } from "../balanceRange";

// Categorical slots in fixed order (validated for colour-vision deficiency and
// normal-vision separation on the white surface). A wallet keeps its slot; past
// MAX_LINES the remaining wallets fold into one "Other" line instead of reusing hues.
const COLORS = [
  "#2a78d6", // blue
  "#eb6834", // orange
  "#1baf7a", // aqua
  "#eda100", // yellow
  "#e87ba4", // magenta
  "#008300", // green
  "#4a3aa7", // violet
  "#e34948", // red
];
const MAX_LINES = COLORS.length;
const TOTAL_KEY = "__total__";
const TOTAL_COLOR = "#374151";
// Dots only help when there are few points; otherwise the hover dot is enough
const MAX_POINTS_WITH_DOTS = 30;

type IntervalChoice = "auto" | BalanceInterval;

const INTERVAL_OPTIONS: { value: IntervalChoice; label: string }[] = [
  { value: "auto", label: "Auto" },
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
];

interface ChartLine {
  key: string;
  name: string;
  color: string;
  values: number[];
}

function parseBucket(bucket: string) {
  return new Date(bucket + "T00:00:00");
}

function tickLabel(bucket: string, interval: BalanceInterval) {
  return format(parseBucket(bucket), interval === "month" ? "MMM yy" : "dd/MM");
}

function periodLabel(bucket: string, interval: BalanceInterval) {
  const d = parseBucket(bucket);
  if (interval === "month") return format(d, "MMMM yyyy");
  if (interval === "week") return `Week of ${format(d, "dd/MM/yyyy")}`;
  return format(d, "dd/MM/yyyy");
}

interface Props {
  title?: string;
  /** Wallets to chart, in legend/colour order. Omit for all active wallets of the current currency. */
  walletIds?: string[];
  range: DateRange;
  onRangeChange: (range: DateRange) => void;
}

export function BalanceChart({
  title = "Balance History",
  walletIds,
  range,
  onRangeChange,
}: Props) {
  const [intervalChoice, setIntervalChoice] = useState<IntervalChoice>("auto");
  const [view, setView] = useState<"chart" | "table">("chart");

  const { data, isLoading, error, isFetching } = useWalletBalanceSeries({
    ...range,
    interval: intervalChoice === "auto" ? undefined : intervalChoice,
    walletIds,
  });

  const interval: BalanceInterval = data?.interval ?? "day";
  const buckets = data?.buckets ?? [];

  // Keep the caller's wallet order so colours follow the wallet, not the response order
  const series = [...(data?.series ?? [])];
  if (walletIds?.length) {
    series.sort(
      (a, b) => walletIds.indexOf(a.walletId!) - walletIds.indexOf(b.walletId!),
    );
  }

  const lines: ChartLine[] = [];
  const individual =
    series.length > MAX_LINES ? series.slice(0, MAX_LINES - 1) : series;
  individual.forEach((s, i) =>
    lines.push({
      key: s.walletId!,
      name: s.name ?? "—",
      color: COLORS[i],
      values: s.balances ?? [],
    }),
  );
  if (series.length > MAX_LINES) {
    const rest = series.slice(MAX_LINES - 1);
    lines.push({
      key: "__other__",
      name: `Other (${rest.length} wallets)`,
      color: COLORS[MAX_LINES - 1],
      values: buckets.map((_, i) =>
        rest.reduce((sum, s) => sum + (s.balances?.[i] ?? 0), 0),
      ),
    });
  }

  const showTotal = series.length > 1 && !!data?.total;
  const currencies = [...new Set(series.map((s) => s.currency))];
  const singleCurrency = currencies.length === 1 ? currencies[0] : undefined;
  const formatValue = (v: number) =>
    singleCurrency
      ? formatCurrency(v, singleCurrency)
      : v.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

  const rows = buckets.map((bucket, i) => {
    const row: Record<string, number | string> = { bucket };
    lines.forEach((l) => (row[l.key] = l.values[i] ?? 0));
    if (showTotal) row[TOTAL_KEY] = data!.total![i];
    return row;
  });

  const showDots = buckets.length <= MAX_POINTS_WITH_DOTS;

  function renderTooltip({
    active,
    payload,
    label,
  }: TooltipContentProps<TooltipValueType, string | number>) {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-white border border-gray-200 rounded-md shadow-sm px-3 py-2 text-xs space-y-1">
        <p className="font-medium text-gray-900">
          {periodLabel(String(label), interval)}
        </p>
        {payload.map((p) => (
          <div key={String(p.dataKey)} className="flex items-center gap-2">
            <span
              className="inline-block w-2.5 h-0.5 rounded"
              style={{ background: p.color }}
            />
            <span className="text-gray-600">
              {p.dataKey === TOTAL_KEY ? "Total" : p.name}
            </span>
            <span className="ml-auto pl-3 font-medium text-gray-900 tabular-nums">
              {formatValue(Number(p.value))}
            </span>
          </div>
        ))}
      </div>
    );
  }

  const isDefaultRange =
    JSON.stringify(range) === JSON.stringify(defaultBalanceRange());

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-sm font-medium text-gray-700">{title}</h2>
        <div className="flex items-center gap-2 text-xs text-gray-500 flex-wrap">
          <span>From:</span>
          <input
            type="date"
            value={range.startDate}
            max={range.endDate}
            onChange={(e) =>
              e.target.value &&
              onRangeChange({ ...range, startDate: e.target.value })
            }
            className="border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <span>To:</span>
          <input
            type="date"
            value={range.endDate}
            min={range.startDate}
            onChange={(e) =>
              e.target.value &&
              onRangeChange({ ...range, endDate: e.target.value })
            }
            className="border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {!isDefaultRange && (
            <button
              onClick={() => onRangeChange(defaultBalanceRange())}
              className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              title="Back to the last month"
            >
              <RotateCcw size={13} />
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex rounded-md border border-gray-200 overflow-hidden">
          {INTERVAL_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setIntervalChoice(value)}
              className={cn(
                "px-2.5 py-1 text-xs font-medium transition-colors",
                intervalChoice === value
                  ? "bg-blue-600 text-white"
                  : "text-gray-600 hover:bg-gray-50",
              )}
            >
              {value === "auto" && intervalChoice === "auto" && data
                ? `Auto (${data.interval})`
                : label}
            </button>
          ))}
        </div>
        <div className="flex rounded-md border border-gray-200 overflow-hidden">
          {(["chart", "table"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn(
                "px-2.5 py-1 text-xs font-medium capitalize transition-colors",
                view === v
                  ? "bg-gray-700 text-white"
                  : "text-gray-600 hover:bg-gray-50",
              )}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error.message}</p>}

      {isLoading && <div className="h-56 animate-pulse bg-gray-50 rounded" />}

      {!isLoading && !error && data && lines.length === 0 && (
        <p className="text-sm text-gray-400 py-8 text-center">
          No wallets to show.
        </p>
      )}

      {!error && data && lines.length > 0 && view === "chart" && (
        <div className={cn("transition-opacity", isFetching && "opacity-60")}>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={rows} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
              <CartesianGrid vertical={false} stroke="#f3f4f6" />
              <XAxis
                dataKey="bucket"
                tickFormatter={(b) => tickLabel(b, interval)}
                tick={{ fontSize: 11, fill: "#6b7280" }}
                tickLine={false}
                axisLine={false}
                minTickGap={16}
              />
              <YAxis
                tickFormatter={formatValue}
                tick={{ fontSize: 11, fill: "#6b7280" }}
                tickLine={false}
                axisLine={false}
                width={90}
              />
              <Tooltip
                content={renderTooltip}
                cursor={{ stroke: "#9ca3af", strokeDasharray: "3 3" }}
              />
              {(lines.length > 1 || showTotal) && (
                <Legend
                  formatter={(value) => (
                    <span className="text-gray-600">
                      {value === TOTAL_KEY
                        ? "Total"
                        : lines.find((l) => l.key === value)?.name ?? value}
                    </span>
                  )}
                  wrapperStyle={{ fontSize: 12 }}
                />
              )}
              {lines.map((l) => (
                <Line
                  key={l.key}
                  dataKey={l.key}
                  name={l.name}
                  type="stepAfter"
                  stroke={l.color}
                  strokeWidth={2}
                  dot={showDots ? { r: 4, strokeWidth: 2, stroke: "#fff", fill: l.color } : false}
                  activeDot={{ r: 4, strokeWidth: 2, stroke: "#fff" }}
                  isAnimationActive={false}
                />
              ))}
              {showTotal && (
                <Line
                  dataKey={TOTAL_KEY}
                  name="Total"
                  type="stepAfter"
                  stroke={TOTAL_COLOR}
                  strokeWidth={2}
                  strokeDasharray="5 3"
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 2, stroke: "#fff" }}
                  isAnimationActive={false}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {!error && data && lines.length > 0 && view === "table" && (
        <div className="max-h-72 overflow-auto border border-gray-100 rounded">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-gray-50">
              <tr>
                <th className="text-left px-3 py-2 font-medium text-gray-600">
                  Period
                </th>
                {lines.map((l) => (
                  <th
                    key={l.key}
                    className="text-right px-3 py-2 font-medium text-gray-600 whitespace-nowrap"
                  >
                    {l.name}
                  </th>
                ))}
                {showTotal && (
                  <th className="text-right px-3 py-2 font-medium text-gray-600">
                    Total
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {[...rows].reverse().map((row) => (
                <tr key={String(row.bucket)}>
                  <td className="px-3 py-1.5 text-gray-600 whitespace-nowrap">
                    {periodLabel(String(row.bucket), interval)}
                  </td>
                  {lines.map((l) => (
                    <td
                      key={l.key}
                      className="px-3 py-1.5 text-right text-gray-900 tabular-nums whitespace-nowrap"
                    >
                      {formatValue(Number(row[l.key]))}
                    </td>
                  ))}
                  {showTotal && (
                    <td className="px-3 py-1.5 text-right font-medium text-gray-900 tabular-nums whitespace-nowrap">
                      {formatValue(Number(row[TOTAL_KEY]))}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data && series.length > 1 && !data.total && (
        <p className="text-xs text-gray-400">
          No total line: these wallets use different currencies.
        </p>
      )}
    </div>
  );
}
