import {
  useGetNetWorthHistory, useListAssets, useListLiabilities,
} from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { TrendingUp, TrendingDown } from "lucide-react";

const ASSET_COLORS: Record<string, string> = {
  cash: "#22c55e",
  savings: "#3b82f6",
  land: "#f59e0b",
  vehicle: "#a855f7",
  investment: "#f97316",
  business: "#06b6d4",
  property: "#ec4899",
  other: "#6366f1",
};

export default function NetWorth() {
  const { data: history, isLoading } = useGetNetWorthHistory();
  const { data: assets } = useListAssets();
  const { data: liabilities } = useListLiabilities();

  const totalAssets = (assets ?? []).reduce((s, a) => s + a.value, 0);
  const totalLiabilities = (liabilities ?? []).reduce((s, l) => s + l.amount, 0);
  const netWorth = totalAssets - totalLiabilities;

  // Group assets by category
  const assetsByCategory = (assets ?? []).reduce((acc: Record<string, number>, a) => {
    acc[a.category] = (acc[a.category] || 0) + a.value;
    return acc;
  }, {});

  const liabsByCategory = (liabilities ?? []).reduce((acc: Record<string, number>, l) => {
    acc[l.category] = (acc[l.category] || 0) + l.amount;
    return acc;
  }, {});

  // Net worth change
  const latestTwo = (history ?? []).slice(-2);
  const nwChange = latestTwo.length === 2
    ? latestTwo[1].netWorth - latestTwo[0].netWorth : 0;
  const nwChangePct = latestTwo.length === 2 && latestTwo[0].netWorth !== 0
    ? (nwChange / Math.abs(latestTwo[0].netWorth)) * 100 : 0;

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Net Worth</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Your total wealth snapshot</p>
      </div>

      {/* Hero stat */}
      <div className="card-glass p-6 text-center">
        <p className="text-sm text-muted-foreground">Current Net Worth</p>
        <p className={cn("text-4xl font-bold mt-2 tabular-nums", netWorth >= 0 ? "text-money-in" : "text-money-out")}>
          {formatCurrency(netWorth)}
        </p>
        {nwChange !== 0 && (
          <div className={cn("flex items-center justify-center gap-1.5 mt-2 text-sm", nwChange >= 0 ? "text-emerald-500" : "text-rose-500")}>
            {nwChange >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            <span>{nwChange >= 0 ? "+" : ""}{formatCurrency(nwChange)} ({nwChangePct.toFixed(1)}%) vs last month</span>
          </div>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="card-glass p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-emerald-500" />
            <p className="text-sm font-semibold">Total Assets</p>
          </div>
          <p className="text-2xl font-bold text-money-in tabular-nums">{formatCurrency(totalAssets)}</p>
          <div className="mt-3 space-y-1.5">
            {Object.entries(assetsByCategory).sort(([,a], [,b]) => b - a).map(([cat, val]) => (
              <div key={cat} className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ background: ASSET_COLORS[cat] || "#6366f1" }} />
                <span className="text-xs capitalize text-muted-foreground flex-1">{cat}</span>
                <span className="text-xs tabular-nums font-medium">{formatCurrency(val)}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="card-glass p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className="w-4 h-4 text-rose-500" />
            <p className="text-sm font-semibold">Total Liabilities</p>
          </div>
          <p className="text-2xl font-bold text-money-out tabular-nums">{formatCurrency(totalLiabilities)}</p>
          {Object.keys(liabsByCategory).length > 0 && (
            <div className="mt-3 space-y-1.5">
              {Object.entries(liabsByCategory).sort(([,a], [,b]) => b - a).map(([cat, val]) => (
                <div key={cat} className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full shrink-0 bg-rose-500" />
                  <span className="text-xs capitalize text-muted-foreground flex-1">{cat}</span>
                  <span className="text-xs tabular-nums font-medium text-rose-400">{formatCurrency(val)}</span>
                </div>
              ))}
            </div>
          )}
          {Object.keys(liabsByCategory).length === 0 && (
            <p className="text-xs text-muted-foreground mt-3">Debt-free!</p>
          )}
        </div>
      </div>

      {/* Net Worth History Chart */}
      <div className="card-glass p-5">
        <h2 className="text-sm font-semibold mb-4">Net Worth History — 12 Months</h2>
        {isLoading ? <Skeleton className="h-56 w-full" /> : (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={history ?? []} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="assetsGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="liabGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="nwGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 24% 16%)" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(217 10% 55%)" }} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "hsl(217 10% 55%)" }} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}K`} />
              <ReferenceLine y={0} stroke="hsl(217 24% 30%)" strokeDasharray="4 2" />
              <Tooltip
                contentStyle={{ background: "hsl(220 16% 10%)", border: "1px solid hsl(217 24% 16%)", borderRadius: "8px", fontSize: 12 }}
                formatter={(v: number) => [formatCurrency(v), ""]}
              />
              <Area type="monotone" dataKey="assets" stroke="#22c55e" fill="url(#assetsGrad)" strokeWidth={1.5} name="Assets" />
              <Area type="monotone" dataKey="liabilities" stroke="#ef4444" fill="url(#liabGrad)" strokeWidth={1.5} name="Liabilities" />
              <Area type="monotone" dataKey="netWorth" stroke="#3b82f6" fill="url(#nwGrad)" strokeWidth={2} name="Net Worth" />
            </AreaChart>
          </ResponsiveContainer>
        )}
        <div className="flex items-center gap-4 mt-2 justify-center">
          {[["Assets", "#22c55e"], ["Liabilities", "#ef4444"], ["Net Worth", "#3b82f6"]].map(([l, c]) => (
            <div key={l} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ background: c }} />
              {l}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
