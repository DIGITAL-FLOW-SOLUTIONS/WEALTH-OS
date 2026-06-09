import { useState } from "react";
import { useSettings } from "@/context/SettingsContext";
import {
  useGetDashboardSummary,
  useGetCashflowTrend,
  useGetSpendingBreakdown,
  useGetFinancialInsights,
  useGetHealthScore,
  useGetIncomeBreakdown,
  useCreateTransaction,
  useCreateSavings,
  useCreateGoal,
  useCreateAsset,
  useCreateInvestment,
  getGetDashboardSummaryQueryKey,
  getGetCashflowTrendQueryKey,
  getGetSpendingBreakdownQueryKey,
  getGetFinancialInsightsQueryKey,
  getGetHealthScoreQueryKey,
  getListTransactionsQueryKey,
  getListSavingsQueryKey,
  getListGoalsQueryKey,
  getListAssetsQueryKey,
  getListInvestmentsQueryKey,
  getGetNetWorthHistoryQueryKey,
  getGetIncomeBreakdownQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { formatCompact, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Plus,
  AlertTriangle,
  CheckCircle2,
  Info,
  Lightbulb,
  Zap,
  Loader2,
} from "lucide-react";

const COLORS = [
  "#22c55e",
  "#3b82f6",
  "#f59e0b",
  "#a855f7",
  "#ef4444",
  "#06b6d4",
  "#f97316",
  "#ec4899",
  "#84cc16",
  "#6366f1",
];

const INCOME_CATEGORIES = [
  "salary",
  "business",
  "freelance",
  "investment",
  "side_hustle",
  "gift",
  "refund",
  "loan",
  "last_balance",
];
const EXPENSE_CATEGORIES = [
  "rent",
  "food",
  "transport",
  "internet",
  "electricity",
  "water",
  "shopping",
  "family",
  "tithe",
  "healthcare",
  "insurance",
  "entertainment",
  "debt",
  "taxes",
  "business",
  "Lending",
  "fuel",
];

function KpiCard({
  title,
  value,
  sub,
  trend,
  color = "default",
  loading,
}: {
  title: string;
  value: string;
  sub?: string;
  trend?: number;
  color?: string;
  loading?: boolean;
}) {
  return (
    <div className="card-glass p-4 flex flex-col gap-2">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        {title}
      </p>
      {loading ? (
        <Skeleton className="h-7 w-32" />
      ) : (
        <p
          className={cn(
            "text-xl font-bold tabular-nums",
            color === "green" && "text-money-in",
            color === "red" && "text-money-out",
            color === "gold" && "text-gold",
          )}
        >
          {value}
        </p>
      )}
      {(sub || trend !== undefined) && (
        <div className="flex items-center gap-1.5">
          {trend !== undefined &&
            (trend > 0 ? (
              <TrendingUp className="w-3 h-3 text-emerald-500" />
            ) : trend < 0 ? (
              <TrendingDown className="w-3 h-3 text-rose-500" />
            ) : (
              <Minus className="w-3 h-3 text-muted-foreground" />
            ))}
          {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
        </div>
      )}
    </div>
  );
}

const insightIcon = (type: string) => {
  if (type === "success")
    return <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />;
  if (type === "warning")
    return <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />;
  if (type === "tip")
    return <Lightbulb className="w-4 h-4 text-blue-500 shrink-0" />;
  return <Info className="w-4 h-4 text-blue-400 shrink-0" />;
};

const healthColor = (label: string) => {
  if (label === "excellent") return "text-emerald-500";
  if (label === "good") return "text-green-400";
  if (label === "average") return "text-amber-500";
  if (label === "risky") return "text-orange-500";
  return "text-rose-500";
};

export default function Dashboard() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { emergencyFundTarget } = useSettings();
  const [quickOpen, setQuickOpen] = useState(false);

  const { data: summary, isLoading: sumLoading } = useGetDashboardSummary();
  const { data: cashflow, isLoading: cfLoading } = useGetCashflowTrend();
  const { data: spending } = useGetSpendingBreakdown();
  const { data: insights } = useGetFinancialInsights();
  const { data: health } = useGetHealthScore();
  const { data: income } = useGetIncomeBreakdown();

  const createTx = useCreateTransaction();
  const createSavings = useCreateSavings();
  const createGoal = useCreateGoal();
  const createAsset = useCreateAsset();
  const createInvestment = useCreateInvestment();

  const isSubmitting =
    createTx.isPending ||
    createSavings.isPending ||
    createGoal.isPending ||
    createAsset.isPending ||
    createInvestment.isPending;

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
    qc.invalidateQueries({ queryKey: getGetCashflowTrendQueryKey() });
    qc.invalidateQueries({ queryKey: getGetSpendingBreakdownQueryKey() });
    qc.invalidateQueries({ queryKey: getGetFinancialInsightsQueryKey() });
    qc.invalidateQueries({ queryKey: getGetHealthScoreQueryKey() });
    qc.invalidateQueries({ queryKey: getListTransactionsQueryKey() });
    qc.invalidateQueries({ queryKey: getListSavingsQueryKey() });
    qc.invalidateQueries({ queryKey: getGetNetWorthHistoryQueryKey() });
    qc.invalidateQueries({ queryKey: getGetIncomeBreakdownQueryKey() });
  };

  // Quick action state
  const [tab, setTab] = useState("income");
  const [form, setForm] = useState<Record<string, string>>({});
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleQuickSubmit = () => {
    const today = new Date().toISOString().split("T")[0];
    if (tab === "income") {
      createTx.mutate(
        {
          data: {
            type: "income",
            amount: parseFloat(form.amount || "0"),
            category: form.category || "salary",
            source: form.source,
            date: form.date || today,
            notes: form.notes,
            isRecurring: false,
          },
        },
        {
          onSuccess: () => {
            toast({ title: "Income added" });
            setQuickOpen(false);
            setForm({});
            invalidateAll();
            qc.invalidateQueries({ queryKey: getListTransactionsQueryKey() });
          },
          onError: () => toast({ title: "Error", variant: "destructive" }),
        },
      );
    } else if (tab === "expense") {
      createTx.mutate(
        {
          data: {
            type: "expense",
            amount: parseFloat(form.amount || "0"),
            category: form.category || "food",
            date: form.date || today,
            notes: form.notes,
            paymentMethod: form.paymentMethod,
            isRecurring: false,
          },
        },
        {
          onSuccess: () => {
            toast({ title: "Expense added" });
            setQuickOpen(false);
            setForm({});
            invalidateAll();
            qc.invalidateQueries({ queryKey: getListTransactionsQueryKey() });
          },
          onError: () => toast({ title: "Error", variant: "destructive" }),
        },
      );
    } else if (tab === "savings") {
      createSavings.mutate(
        {
          data: {
            amount: parseFloat(form.amount || "0"),
            account: form.account || "M-Shwari",
            date: form.date || today,
            notes: form.notes,
          },
        },
        {
          onSuccess: () => {
            toast({ title: "Savings added" });
            setQuickOpen(false);
            setForm({});
            invalidateAll();
            qc.invalidateQueries({ queryKey: getListSavingsQueryKey() });
          },
          onError: () => toast({ title: "Error", variant: "destructive" }),
        },
      );
    } else if (tab === "goal") {
      createGoal.mutate(
        {
          data: {
            name: form.name || "New Goal",
            targetAmount: parseFloat(form.targetAmount || "10000"),
            priority:
              (form.priority as "low" | "medium" | "high" | "critical") ||
              "medium",
          },
        },
        {
          onSuccess: () => {
            toast({ title: "Goal created" });
            setQuickOpen(false);
            setForm({});
            qc.invalidateQueries({ queryKey: getListGoalsQueryKey() });
          },
          onError: () => toast({ title: "Error", variant: "destructive" }),
        },
      );
    } else if (tab === "asset") {
      createAsset.mutate(
        {
          data: {
            name: form.name || "New Asset",
            category:
              (form.category as
                | "cash"
                | "savings"
                | "land"
                | "vehicle"
                | "investment"
                | "business"
                | "property"
                | "other") || "cash",
            value: parseFloat(form.value || "0"),
          },
        },
        {
          onSuccess: () => {
            toast({ title: "Asset added" });
            setQuickOpen(false);
            setForm({});
            qc.invalidateQueries({ queryKey: getListAssetsQueryKey() });
            invalidateAll();
          },
          onError: () => toast({ title: "Error", variant: "destructive" }),
        },
      );
    } else if (tab === "investment") {
      createInvestment.mutate(
        {
          data: {
            name: form.name || "New Investment",
            type:
              (form.type as
                | "stocks"
                | "sacco"
                | "mmf"
                | "bonds"
                | "crypto"
                | "business"
                | "land"
                | "real_estate") || "mmf",
            purchaseValue: parseFloat(form.purchaseValue || "0"),
            currentValue: parseFloat(form.currentValue || "0"),
            riskLevel:
              (form.riskLevel as "low" | "medium" | "high") || "medium",
          },
        },
        {
          onSuccess: () => {
            toast({ title: "Investment added" });
            setQuickOpen(false);
            setForm({});
            qc.invalidateQueries({ queryKey: getListInvestmentsQueryKey() });
            invalidateAll();
          },
          onError: () => toast({ title: "Error", variant: "destructive" }),
        },
      );
    }
  };

  const prevIncomeDiff =
    summary && summary.prevMonthIncome > 0
      ? ((summary.monthlyIncome - summary.prevMonthIncome) /
          summary.prevMonthIncome) *
        100
      : 0;
  const prevExpenseDiff =
    summary && summary.prevMonthExpenses > 0
      ? ((summary.monthlyExpenses - summary.prevMonthExpenses) /
          summary.prevMonthExpenses) *
        100
      : 0;
  const prevSavingsDiff =
    summary && summary.prevMonthSavings > 0
      ? ((summary.monthlySavings - summary.prevMonthSavings) /
          summary.prevMonthSavings) *
        100
      : 0;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Your financial command center
          </p>
        </div>
        <Button
          onClick={() => setQuickOpen(true)}
          data-testid="button-quick-action"
          className="gap-2"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Add Entry</span>
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        <KpiCard
          title="Total Savings"
          value={formatCompact(summary?.totalBalance ?? 0)}
          sub="All-time savings"
          loading={sumLoading}
        />
        <KpiCard
          title="Monthly Income"
          value={formatCompact(summary?.monthlyIncome ?? 0)}
          color="green"
          trend={prevIncomeDiff}
          sub={
            prevIncomeDiff !== 0
              ? `${formatPercent(prevIncomeDiff)} vs last month`
              : "vs last month"
          }
          loading={sumLoading}
        />
        <KpiCard
          title="Monthly Expenses"
          value={formatCompact(summary?.monthlyExpenses ?? 0)}
          color="red"
          trend={-prevExpenseDiff}
          sub={
            prevExpenseDiff !== 0
              ? `${formatPercent(prevExpenseDiff)} vs last month`
              : "vs last month"
          }
          loading={sumLoading}
        />
        <KpiCard
          title="Monthly Savings"
          value={formatCompact(summary?.monthlySavings ?? 0)}
          color="green"
          trend={prevSavingsDiff}
          sub={
            prevSavingsDiff !== 0
              ? `${formatPercent(prevSavingsDiff)} vs last month`
              : "vs last month"
          }
          loading={sumLoading}
        />
        <KpiCard
          title="Net Cash Flow"
          value={formatCompact(summary?.netCashFlow ?? 0)}
          color={(summary?.netCashFlow ?? 0) >= 0 ? "green" : "red"}
          loading={sumLoading}
        />
        <KpiCard
          title="Net Worth"
          value={formatCompact(summary?.netWorth ?? 0)}
          color={(summary?.netWorth ?? 0) >= 0 ? "green" : "red"}
          sub="Assets minus liabilities"
          loading={sumLoading}
        />
        <KpiCard
          title="Savings Rate"
          value={`${(summary?.savingsRate ?? 0).toFixed(1)}%`}
          color={(summary?.savingsRate ?? 0) >= 20 ? "green" : "red"}
          sub="Target: 20%+"
          loading={sumLoading}
        />
        <KpiCard
          title="Emergency Fund"
          value={`${(summary?.emergencyFundMonths ?? 0).toFixed(1)} / ${emergencyFundTarget} mo`}
          color={
            (summary?.emergencyFundMonths ?? 0) >= emergencyFundTarget
              ? "green"
              : (summary?.emergencyFundMonths ?? 0) >= emergencyFundTarget / 2
                ? "gold"
                : "red"
          }
          sub={`${(((summary?.emergencyFundMonths ?? 0) / emergencyFundTarget) * 100).toFixed(0)}% of ${emergencyFundTarget}-month target`}
          loading={sumLoading}
        />
        <KpiCard
          title="Investments"
          value={formatCompact(summary?.investmentTotal ?? 0)}
          color="gold"
          loading={sumLoading}
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Cashflow Chart */}
        <div className="card-glass p-4 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold">
              Cash Flow — Last 12 Months
            </h2>
          </div>
          {cfLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart
                data={cashflow ?? []}
                margin={{ top: 4, right: 8, left: -20, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="savingsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(217 24% 16%)"
                />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: "hsl(217 10% 55%)" }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "hsl(217 10% 55%)" }}
                  tickLine={false}
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`}
                />
                <Tooltip
                  contentStyle={{
                    background: "hsl(220 16% 10%)",
                    border: "1px solid hsl(217 24% 16%)",
                    borderRadius: "8px",
                    fontSize: 12,
                  }}
                  formatter={(v: number) => [
                    `KES ${v.toLocaleString("en-KE")}`,
                    "",
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey="income"
                  stroke="#22c55e"
                  fill="url(#incomeGrad)"
                  strokeWidth={1.5}
                  name="Income"
                />
                <Area
                  type="monotone"
                  dataKey="expenses"
                  stroke="#ef4444"
                  fill="url(#expenseGrad)"
                  strokeWidth={1.5}
                  name="Expenses"
                />
                <Area
                  type="monotone"
                  dataKey="savings"
                  stroke="#3b82f6"
                  fill="url(#savingsGrad)"
                  strokeWidth={1.5}
                  name="Savings"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
          <div className="flex items-center gap-4 mt-2 justify-center">
            {[
              ["Income", "#22c55e"],
              ["Expenses", "#ef4444"],
              ["Savings", "#3b82f6"],
            ].map(([l, c]) => (
              <div
                key={l}
                className="flex items-center gap-1.5 text-xs text-muted-foreground"
              >
                <span
                  className="w-2.5 h-2.5 rounded-sm"
                  style={{ background: c }}
                />
                {l}
              </div>
            ))}
          </div>
        </div>

        {/* Spending Breakdown */}
        <div className="card-glass p-4">
          <h2 className="text-sm font-semibold mb-3">Spending Breakdown</h2>
          {spending && spending.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie
                    data={spending}
                    cx="50%"
                    cy="50%"
                    outerRadius={65}
                    innerRadius={35}
                    dataKey="amount"
                    nameKey="category"
                    strokeWidth={0}
                  >
                    {spending.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "hsl(220 16% 10%)",
                      border: "1px solid hsl(217 24% 16%)",
                      borderRadius: "8px",
                      fontSize: 11,
                    }}
                    formatter={(v: number) => [
                      `KES ${v.toLocaleString("en-KE")}`,
                      "",
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1 mt-2">
                {spending.slice(0, 5).map((s, i) => (
                  <div
                    key={s.category}
                    className="flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-1.5">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ background: COLORS[i % COLORS.length] }}
                      />
                      <span className="capitalize text-muted-foreground">
                        {s.category}
                      </span>
                    </div>
                    <span className="font-medium tabular-nums">
                      {s.percentage.toFixed(0)}%
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground text-sm">
              <p>No expense data this month</p>
            </div>
          )}
        </div>
      </div>

      {/* Insights + Health Score */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Financial Insights */}
        <div className="card-glass p-4 lg:col-span-2">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold">Financial Insights</h2>
          </div>
          {insights && insights.length > 0 ? (
            <div className="space-y-2.5">
              {insights.map((ins) => (
                <div
                  key={ins.id}
                  className="flex items-start gap-3 p-3 rounded-lg bg-muted/40 border border-border"
                >
                  {insightIcon(ins.type)}
                  <p className="text-sm text-foreground/90 leading-snug">
                    {ins.message}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Add transactions to see insights.
            </p>
          )}
        </div>

        {/* Health Score */}
        <div className="card-glass p-4">
          <h2 className="text-sm font-semibold mb-3">Financial Health Score</h2>
          {health ? (
            <div className="flex flex-col items-center gap-3">
              <div className="relative w-28 h-28">
                <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke="hsl(217 24% 16%)"
                    strokeWidth="10"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke="hsl(142 71% 45%)"
                    strokeWidth="10"
                    strokeDasharray={`${(health.score / 100) * 251.2} 251.2`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span
                    className={cn(
                      "text-2xl font-bold",
                      healthColor(health.label),
                    )}
                  >
                    {health.score}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    /100
                  </span>
                </div>
              </div>
              <Badge
                className={cn("text-xs capitalize", healthColor(health.label))}
                variant="outline"
              >
                {health.label}
              </Badge>
              <div className="w-full space-y-1.5">
                {Object.entries(health.breakdown).map(([key, val]) => (
                  <div key={key} className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground capitalize w-24 truncate">
                      {key.replace(/([A-Z])/g, " $1")}
                    </span>
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${Math.min(100, (val / 20) * 100)}%` }}
                      />
                    </div>
                    <span className="text-[10px] tabular-nums text-muted-foreground w-6 text-right">
                      {val}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <Skeleton className="h-48 w-full" />
          )}
        </div>
      </div>

      {/* Income Breakdown */}
      {income && income.length > 0 && (
        <div className="card-glass p-4">
          <h2 className="text-sm font-semibold mb-3">Income Sources</h2>
          <div className="flex flex-wrap gap-2">
            {income.map((s, i) => (
              <div
                key={s.category}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted/40 border border-border"
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ background: COLORS[i % COLORS.length] }}
                />
                <span className="text-xs capitalize">{s.category}</span>
                <span className="text-xs font-medium text-money-in ml-1">
                  KES {s.amount.toLocaleString("en-KE")}
                </span>
                <span className="text-xs text-muted-foreground">
                  ({s.percentage.toFixed(0)}%)
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Action Modal */}
      <Dialog open={quickOpen} onOpenChange={setQuickOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Quick Add</DialogTitle>
          </DialogHeader>
          <Tabs
            value={tab}
            onValueChange={(v) => {
              setTab(v);
              setForm({});
            }}
          >
            <TabsList className="w-full grid grid-cols-3 sm:grid-cols-6 text-xs">
              <TabsTrigger value="income">Income</TabsTrigger>
              <TabsTrigger value="expense">Expense</TabsTrigger>
              <TabsTrigger value="savings">Savings</TabsTrigger>
              <TabsTrigger value="goal">Goal</TabsTrigger>
              <TabsTrigger value="asset">Asset</TabsTrigger>
              <TabsTrigger value="investment">Invest</TabsTrigger>
            </TabsList>

            <TabsContent value="income" className="space-y-3 mt-3">
              <div className="space-y-1">
                <Label>Amount (KES)</Label>
                <Input
                  data-testid="input-income-amount"
                  type="number"
                  placeholder="0"
                  value={form.amount || ""}
                  onChange={(e) => set("amount", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label>Category</Label>
                <Select
                  value={form.category || ""}
                  onValueChange={(v) => set("category", v)}
                >
                  <SelectTrigger data-testid="select-income-category">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {INCOME_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c.replace(/_/g, " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Source</Label>
                <Input
                  placeholder="e.g. Employer name"
                  value={form.source || ""}
                  onChange={(e) => set("source", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={form.date || new Date().toISOString().split("T")[0]}
                  onChange={(e) => set("date", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label>Notes</Label>
                <Input
                  placeholder="Optional"
                  value={form.notes || ""}
                  onChange={(e) => set("notes", e.target.value)}
                />
              </div>
            </TabsContent>

            <TabsContent value="expense" className="space-y-3 mt-3">
              <div className="space-y-1">
                <Label>Amount (KES)</Label>
                <Input
                  data-testid="input-expense-amount"
                  type="number"
                  placeholder="0"
                  value={form.amount || ""}
                  onChange={(e) => set("amount", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label>Category</Label>
                <Select
                  value={form.category || ""}
                  onValueChange={(v) => set("category", v)}
                >
                  <SelectTrigger data-testid="select-expense-category">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPENSE_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Payment Method</Label>
                <Select
                  value={form.paymentMethod || ""}
                  onValueChange={(v) => set("paymentMethod", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select method" />
                  </SelectTrigger>
                  <SelectContent>
                    {["M-Pesa", "Cash", "Bank Transfer", "Card"].map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={form.date || new Date().toISOString().split("T")[0]}
                  onChange={(e) => set("date", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label>Notes</Label>
                <Input
                  placeholder="Optional"
                  value={form.notes || ""}
                  onChange={(e) => set("notes", e.target.value)}
                />
              </div>
            </TabsContent>

            <TabsContent value="savings" className="space-y-3 mt-3">
              <div className="space-y-1">
                <Label>Amount (KES)</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={form.amount || ""}
                  onChange={(e) => set("amount", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label>Account</Label>
                <Input
                  placeholder="e.g. M-Shwari, KCB Savings"
                  value={form.account || ""}
                  onChange={(e) => set("account", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={form.date || new Date().toISOString().split("T")[0]}
                  onChange={(e) => set("date", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label>Notes</Label>
                <Input
                  placeholder="Optional"
                  value={form.notes || ""}
                  onChange={(e) => set("notes", e.target.value)}
                />
              </div>
            </TabsContent>

            <TabsContent value="goal" className="space-y-3 mt-3">
              <div className="space-y-1">
                <Label>Goal Name</Label>
                <Input
                  placeholder="e.g. Buy Laptop"
                  value={form.name || ""}
                  onChange={(e) => set("name", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label>Target Amount (KES)</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={form.targetAmount || ""}
                  onChange={(e) => set("targetAmount", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label>Deadline</Label>
                <Input
                  type="date"
                  value={form.deadline || ""}
                  onChange={(e) => set("deadline", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label>Priority</Label>
                <Select
                  value={form.priority || "medium"}
                  onValueChange={(v) => set("priority", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["low", "medium", "high", "critical"].map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>

            <TabsContent value="asset" className="space-y-3 mt-3">
              <div className="space-y-1">
                <Label>Asset Name</Label>
                <Input
                  placeholder="e.g. KCB Savings Account"
                  value={form.name || ""}
                  onChange={(e) => set("name", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label>Category</Label>
                <Select
                  value={form.category || ""}
                  onValueChange={(v) => set("category", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {[
                      "cash",
                      "savings",
                      "land",
                      "vehicle",
                      "investment",
                      "business",
                      "property",
                      "other",
                    ].map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Current Value (KES)</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={form.value || ""}
                  onChange={(e) => set("value", e.target.value)}
                />
              </div>
            </TabsContent>

            <TabsContent value="investment" className="space-y-3 mt-3">
              <div className="space-y-1">
                <Label>Name</Label>
                <Input
                  placeholder="e.g. Safaricom MMF"
                  value={form.name || ""}
                  onChange={(e) => set("name", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label>Type</Label>
                <Select
                  value={form.type || ""}
                  onValueChange={(v) => set("type", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {[
                      "stocks",
                      "sacco",
                      "mmf",
                      "bonds",
                      "crypto",
                      "business",
                      "land",
                      "real_estate",
                    ].map((t) => (
                      <SelectItem key={t} value={t}>
                        {t.replace(/_/g, " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Purchase Value (KES)</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={form.purchaseValue || ""}
                  onChange={(e) => set("purchaseValue", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label>Current Value (KES)</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={form.currentValue || ""}
                  onChange={(e) => set("currentValue", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label>Risk Level</Label>
                <Select
                  value={form.riskLevel || "medium"}
                  onValueChange={(v) => set("riskLevel", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["low", "medium", "high"].map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>
          </Tabs>
          <Button
            data-testid="button-submit-quick"
            onClick={handleQuickSubmit}
            disabled={isSubmitting}
            className="w-full mt-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving…
              </>
            ) : (
              "Save"
            )}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
