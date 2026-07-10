import { useState } from "react";
import { useListReports, useGetMonthlyReport } from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { TrendingUp, TrendingDown, ChevronLeft, FileText } from "lucide-react";

const healthColor = (score: number) => {
  if (score >= 80) return "text-emerald-400";
  if (score >= 60) return "text-green-400";
  if (score >= 40) return "text-amber-400";
  if (score >= 20) return "text-orange-400";
  return "text-rose-400";
};

const healthLabel = (score: number) => {
  if (score >= 80) return "Excellent";
  if (score >= 60) return "Good";
  if (score >= 40) return "Average";
  if (score >= 20) return "Risky";
  return "Critical";
};

export default function Reports() {
  const { data: reports, isLoading } = useListReports();
  const [selected, setSelected] = useState<{ month: number; year: number } | null>(null);
  const { data: detail } = useGetMonthlyReport(
    selected?.year ?? 0,
    selected?.month ?? 0,
  );

  if (selected && detail) {
    const netCF = detail.openingBalance + detail.totalIncome - detail.totalExpenses;
    const savingsRate = detail.totalIncome > 0 ? (detail.totalSavings / detail.totalIncome) * 100 : 0;
    return (
      <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-5">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setSelected(null)} className="gap-1.5 text-muted-foreground">
            <ChevronLeft className="w-4 h-4" />Back
          </Button>
          <div>
            <h1 className="text-xl font-bold">{detail.label}</h1>
            <p className="text-sm text-muted-foreground">Monthly Financial Report</p>
          </div>
        </div>

        {/* Key metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="card-glass p-3 text-center">
            <p className="text-xs text-muted-foreground">Income</p>
            <p className="text-lg font-bold text-money-in mt-1">{formatCurrency(detail.totalIncome)}</p>
          </div>
          <div className="card-glass p-3 text-center">
            <p className="text-xs text-muted-foreground">Expenses</p>
            <p className="text-lg font-bold text-money-out mt-1">{formatCurrency(detail.totalExpenses)}</p>
          </div>
          <div className="card-glass p-3 text-center">
            <p className="text-xs text-muted-foreground">Net Cash Flow</p>
            <p className={cn("text-lg font-bold mt-1", netCF >= 0 ? "text-money-in" : "text-money-out")}>{netCF >= 0 ? "+" : ""}{formatCurrency(netCF)}</p>
          </div>
          <div className="card-glass p-3 text-center">
            <p className="text-xs text-muted-foreground">Carry Forward</p>
            <p className="text-lg font-bold text-purple-400 mt-1">{formatCurrency(detail.openingBalance)}</p>
          </div>
          <div className="card-glass p-3 text-center">
            <p className="text-xs text-muted-foreground">Savings</p>
            <p className="text-lg font-bold text-blue-400 mt-1">{formatCurrency(detail.totalSavings)}</p>
          </div>
          <div className="card-glass p-3 text-center">
            <p className="text-xs text-muted-foreground">Investments</p>
            <p className="text-lg font-bold text-gold mt-1">{formatCurrency(detail.totalInvestments ?? 0)}</p>
          </div>
          <div className="card-glass p-3 text-center">
            <p className="text-xs text-muted-foreground">Net Worth</p>
            <p className={cn("text-lg font-bold mt-1", detail.netWorth >= 0 ? "text-money-in" : "text-money-out")}>{formatCurrency(detail.netWorth)}</p>
          </div>
        </div>

        {/* Health Score */}
        <div className="card-glass p-5 flex items-center gap-6">
          <div className="text-center shrink-0">
            <div className={cn("text-5xl font-bold tabular-nums", healthColor(detail.healthScore))}>{detail.healthScore}</div>
            <div className="text-sm text-muted-foreground mt-1">Health Score</div>
            <Badge variant="outline" className={cn("mt-1 text-xs", healthColor(detail.healthScore))}>{healthLabel(detail.healthScore)}</Badge>
          </div>
          <div className="flex-1 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Savings Rate</span>
              <span className="font-medium">{savingsRate.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Top Expense Category</span>
              <span className="font-medium capitalize">{detail.topExpenseCategory}</span>
            </div>
            {detail.insights && (
              <div className="p-3 rounded-lg bg-muted/40 border border-border">
                <p className="text-xs text-muted-foreground leading-relaxed">{detail.insights}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Reports overview bar chart
  const chartData = (reports ?? []).map(r => ({
    label: new Date(r.year, r.month - 1, 1).toLocaleDateString("en-KE", { month: "short" }),
    income: r.totalIncome,
    expenses: r.totalExpenses,
    savings: r.totalSavings,
    carryForward: r.openingBalance,
  }));

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Monthly Reports</h1>
        <p className="text-sm text-muted-foreground mt-0.5">6-month financial summary</p>
      </div>

      {/* Overview chart */}
      {chartData.length > 0 && (
        <div className="card-glass p-5">
          <h2 className="text-sm font-semibold mb-4">6-Month Overview</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 24% 16%)" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(217 10% 55%)" }} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "hsl(217 10% 55%)" }} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}K`} />
              <Tooltip contentStyle={{ background: "hsl(220 16% 10%)", border: "1px solid hsl(217 24% 16%)", borderRadius: "8px", fontSize: 12 }} formatter={(v: number) => [formatCurrency(v), ""]} />
              <Bar dataKey="income" fill="#22c55e" radius={[3, 3, 0, 0]} name="Income" />
              <Bar dataKey="expenses" fill="#ef4444" radius={[3, 3, 0, 0]} name="Expenses" />
              <Bar dataKey="savings" fill="#3b82f6" radius={[3, 3, 0, 0]} name="Savings" />
              <Bar dataKey="carryForward" fill="#a855f7" radius={[3, 3, 0, 0]} name="Carry Forward" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Reports list */}
      <div className="space-y-2">
        {isLoading ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />) :
          (reports ?? []).length === 0 ? (
            <div className="card-glass p-10 text-center">
              <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground text-sm">No reports yet. Add transactions to generate reports.</p>
            </div>
          ) : (
            [...(reports ?? [])].reverse().map(r => {
              const netCF = r.totalIncome - r.totalExpenses;
              const label = new Date(r.year, r.month - 1, 1).toLocaleDateString("en-KE", { month: "long", year: "numeric" });
              return (
                <div key={r.id} data-testid={`card-report-${r.id}`}
                  className="card-glass px-4 py-3 flex items-center gap-4 cursor-pointer hover:bg-card/80 transition-colors"
                  onClick={() => setSelected({ month: r.month, year: r.year })}>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{label}</p>
                      <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", healthColor(r.healthScore))}>
                        Score: {r.healthScore}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                      <span className="text-money-in">{formatCurrency(r.totalIncome)}</span>
                      <span className="text-money-out">{formatCurrency(r.totalExpenses)}</span>
                      <span className={cn("font-medium flex items-center gap-0.5", netCF >= 0 ? "text-blue-400" : "text-rose-400")}>
                        {netCF >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {netCF >= 0 ? "+" : ""}{formatCurrency(netCF)}
                      </span>
                    </div>
                  </div>
                  <ChevronLeft className="w-4 h-4 text-muted-foreground rotate-180 shrink-0" />
                </div>
              );
            })
          )
        }
      </div>
    </div>
  );
}
