import { useState } from "react";
import { useListReports, useGetMonthlyReport } from "@workspace/api-client-react";
import type { MonthlyReport } from "@workspace/api-client-react";
import { formatCurrency, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import {
  TrendingUp, TrendingDown, ChevronLeft, FileText,
  ArrowDown, ArrowUp, ArrowLeftRight,
  Wallet, Target, PiggyBank, Lightbulb,
  CheckCircle2, AlertTriangle, Info,
} from "lucide-react";

const COLORS = [
  "#22c55e", "#3b82f6", "#f59e0b", "#a855f7", "#ef4444",
  "#06b6d4", "#f97316", "#ec4899", "#84cc16", "#6366f1",
];

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

const insightIcon = (type: string) => {
  if (type === "success")
    return <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />;
  if (type === "warning")
    return <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />;
  if (type === "tip")
    return <Lightbulb className="w-4 h-4 text-blue-500 shrink-0" />;
  return <Info className="w-4 h-4 text-blue-400 shrink-0" />;
};

function SpendingBreakdownCard({ data }: { data: Array<{ category: string; amount: number; percentage: number }> }) {
  if (data.length === 0) {
    return (
      <div className="card-glass p-5">
        <h2 className="text-sm font-semibold mb-3">Spending Breakdown</h2>
        <p className="text-sm text-muted-foreground">No expenses recorded this month.</p>
      </div>
    );
  }
  return (
    <div className="card-glass p-5">
      <h2 className="text-sm font-semibold mb-3">Spending Breakdown</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="w-full max-w-[200px] mx-auto">
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie
                data={data}
                dataKey="amount"
                nameKey="category"
                cx="50%"
                cy="50%"
                innerRadius={45}
                outerRadius={70}
                stroke="none"
                paddingAngle={2}
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: "hsl(220 16% 10%)", border: "1px solid hsl(217 24% 16%)", borderRadius: "8px", fontSize: 12 }}
                formatter={(v: number) => [formatCurrency(v), ""]}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="space-y-2">
          {data.map((s, i) => (
            <div key={s.category} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                <span className="capitalize text-muted-foreground">{s.category}</span>
              </div>
              <div className="text-right">
                <span className="font-medium tabular-nums">{formatCurrency(s.amount)}</span>
                <span className="text-xs text-muted-foreground ml-1.5">({s.percentage.toFixed(1)}%)</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function IncomeSourcesCard({ data }: { data: Array<{ category: string; amount: number; percentage: number }> }) {
  if (data.length === 0) {
    return (
      <div className="card-glass p-5">
        <h2 className="text-sm font-semibold mb-3">Income Sources</h2>
        <p className="text-sm text-muted-foreground">No income transactions this month.</p>
      </div>
    );
  }
  return (
    <div className="card-glass p-5">
      <h2 className="text-sm font-semibold mb-3">Income Sources</h2>
      <div className="flex flex-wrap gap-2">
        {data.map((s, i) => (
          <div key={s.category} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted/40 border border-border">
            <span className="w-2 h-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
            <span className="text-xs capitalize">{s.category}</span>
            <span className="text-xs font-medium text-money-in ml-1">{formatCurrency(s.amount)}</span>
            <span className="text-xs text-muted-foreground">({s.percentage.toFixed(0)}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ExpenseSourcesCard({ data }: { data: Array<{ category: string; amount: number; percentage: number }> }) {
  if (data.length === 0) {
    return (
      <div className="card-glass p-5">
        <h2 className="text-sm font-semibold mb-3">Expense Sources</h2>
        <p className="text-sm text-muted-foreground">No expense transactions this month.</p>
      </div>
    );
  }
  return (
    <div className="card-glass p-5">
      <h2 className="text-sm font-semibold mb-3">Expense Sources</h2>
      <div className="space-y-2">
        {data.map((s, i) => (
          <div key={s.category} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
              <span className="text-sm capitalize text-muted-foreground">{s.category}</span>
            </div>
            <div className="text-right">
              <span className="text-sm font-medium tabular-nums text-money-out">{formatCurrency(s.amount)}</span>
              <span className="text-xs text-muted-foreground ml-1.5">({s.percentage.toFixed(1)}%)</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TransactionRow({ tx }: { tx: { id: number; type: string; amount: number; category: string; source?: string | null; date: string; notes?: string | null } }) {
  return (
    <div className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/30 border border-border/60">
      <div className={cn("w-7 h-7 rounded-full flex items-center justify-center shrink-0",
        tx.type === "income" ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
      )}>
        {tx.type === "income" ? <ArrowDown className="w-3.5 h-3.5" /> : <ArrowUp className="w-3.5 h-3.5" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium capitalize truncate">{tx.category}</span>
          {tx.source && <span className="text-xs text-muted-foreground">&bull; {tx.source}</span>}
        </div>
        {tx.notes && <p className="text-xs text-muted-foreground truncate">{tx.notes}</p>}
      </div>
      <div className="text-right shrink-0">
        <p className={cn("text-sm font-medium tabular-nums", tx.type === "income" ? "text-money-in" : "text-money-out")}>
          {tx.type === "income" ? "+" : "-"}{formatCurrency(tx.amount)}
        </p>
        <p className="text-[10px] text-muted-foreground">{new Date(tx.date).toLocaleDateString("en-KE", { day: "numeric", month: "short" })}</p>
      </div>
    </div>
  );
}

function MonthTransactions({ detail }: { detail: MonthlyReport }) {
  const monthName = new Date(detail.year, detail.month - 1, 1).toLocaleDateString("en-KE", { month: "long" }).toUpperCase();
  const hasAny = (detail.incomeTransactions?.length ?? 0) > 0 || (detail.expenseTransactions?.length ?? 0) > 0 || (detail.savingsRecords?.length ?? 0) > 0 || (detail.goalsRecords?.length ?? 0) > 0;

  if (!hasAny) {
    return (
      <div className="card-glass p-5">
        <h2 className="text-sm font-semibold mb-3">{monthName} Transactions</h2>
        <p className="text-sm text-muted-foreground">No transactions, savings, or goals recorded this month.</p>
      </div>
    );
  }

  return (
    <div className="card-glass p-5 space-y-4">
      <h2 className="text-sm font-semibold">{monthName} Transactions</h2>

      {/* Income */}
      {(detail.incomeTransactions?.length ?? 0) > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-medium text-money-in uppercase tracking-wider flex items-center gap-1.5">
            <ArrowDown className="w-3.5 h-3.5" /> Income Transactions ({detail.incomeTransactions!.length})
          </h3>
          <div className="space-y-1.5">
            {detail.incomeTransactions!.map(tx => <TransactionRow key={tx.id} tx={tx} />)}
          </div>
        </div>
      )}

      {/* Expenses */}
      {(detail.expenseTransactions?.length ?? 0) > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-medium text-money-out uppercase tracking-wider flex items-center gap-1.5">
            <ArrowUp className="w-3.5 h-3.5" /> Expense Transactions ({detail.expenseTransactions!.length})
          </h3>
          <div className="space-y-1.5">
            {detail.expenseTransactions!.map(tx => <TransactionRow key={tx.id} tx={tx} />)}
          </div>
        </div>
      )}

      {/* Savings & Goals */}
      {((detail.savingsRecords?.length ?? 0) > 0 || (detail.goalsRecords?.length ?? 0) > 0) && (
        <div className="space-y-2">
          <h3 className="text-xs font-medium text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
            <PiggyBank className="w-3.5 h-3.5" /> Savings & Goals
          </h3>
          <div className="space-y-1.5">
            {(detail.savingsRecords ?? []).map(s => (
              <div key={s.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/30 border border-border/60">
                <div className="w-7 h-7 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0">
                  <Wallet className="w-3.5 h-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{s.account}</p>
                  {s.notes && <p className="text-xs text-muted-foreground truncate">{s.notes}</p>}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-medium tabular-nums text-blue-400">+{formatCurrency(s.amount)}</p>
                  <p className="text-[10px] text-muted-foreground">{new Date(s.date).toLocaleDateString("en-KE", { day: "numeric", month: "short" })}</p>
                </div>
              </div>
            ))}
            {(detail.goalsRecords ?? []).map(g => (
              <div key={g.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/30 border border-border/60">
                <div className="w-7 h-7 rounded-full bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0">
                  <Target className="w-3.5 h-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{g.name}</p>
                  {g.notes && <p className="text-xs text-muted-foreground truncate">{g.notes}</p>}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-medium tabular-nums">{formatCurrency(g.currentAmount)} / {formatCurrency(g.targetAmount)}</p>
                  <p className="text-[10px] text-muted-foreground">{g.priority} priority</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MonthlyInsights({ insights }: { insights: Array<{ id: string; type: string; message: string }> }) {
  if (!insights || insights.length === 0) {
    return (
      <div className="card-glass p-5">
        <h2 className="text-sm font-semibold mb-3">Monthly Insights</h2>
        <p className="text-sm text-muted-foreground">Add more transactions to generate insights.</p>
      </div>
    );
  }
  return (
    <div className="card-glass p-5">
      <h2 className="text-sm font-semibold mb-3">Monthly Insights</h2>
      <div className="space-y-2">
        {insights.map(ins => (
          <div key={ins.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/40 border border-border">
            {insightIcon(ins.type)}
            <p className="text-sm text-foreground/90 leading-snug">{ins.message}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

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

        {/* Spending Breakdown */}
        <SpendingBreakdownCard data={detail.spendingBreakdown ?? []} />

        {/* Income Sources */}
        <IncomeSourcesCard data={detail.incomeBreakdown ?? []} />

        {/* Expense Sources */}
        <ExpenseSourcesCard data={detail.spendingBreakdown ?? []} />

        {/* Month Transactions */}
        <MonthTransactions detail={detail} />

        {/* Monthly Insights */}
        <MonthlyInsights insights={detail.monthlyInsights ?? []} />
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
