import {
  useGetCashflowTrend, useGetSpendingBreakdown, useGetIncomeBreakdown, useListTransactions,
} from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend,
} from "recharts";

const COLORS = ["#22c55e", "#ef4444", "#f59e0b", "#3b82f6", "#a855f7", "#06b6d4", "#f97316", "#ec4899", "#84cc16", "#6366f1"];

export default function Analytics() {
  const { data: cashflow, isLoading: cfLoad } = useGetCashflowTrend();
  const { data: spending } = useGetSpendingBreakdown();
  const { data: income } = useGetIncomeBreakdown();
  const { data: allTx } = useListTransactions();

  // Build savings rate trend from cashflow data
  const savingsRateTrend = (cashflow ?? []).map(m => ({
    label: m.label,
    rate: m.income > 0 ? ((m.savings / m.income) * 100) : 0,
  }));

  // Monthly expense comparison
  const expenseComparison = (cashflow ?? []).map(m => ({
    label: m.label,
    income: m.income,
    expenses: m.expenses,
  }));

  // Category totals from all transactions
  const expensesByCategory = Object.entries(
    (allTx ?? [])
      .filter(t => t.type === "expense")
      .reduce((acc: Record<string, number>, t) => {
        acc[t.category] = (acc[t.category] || 0) + t.amount;
        return acc;
      }, {})
  ).map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10);

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Deep financial intelligence</p>
      </div>

      {/* Cashflow trend */}
      <div className="card-glass p-5">
        <h2 className="text-sm font-semibold mb-4">Income vs Expenses — 12 Month Trend</h2>
        {cfLoad ? <Skeleton className="h-56 w-full" /> : (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={cashflow ?? []} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="ig2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="eg2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 24% 16%)" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(217 10% 55%)" }} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "hsl(217 10% 55%)" }} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}K`} />
              <Tooltip contentStyle={{ background: "hsl(220 16% 10%)", border: "1px solid hsl(217 24% 16%)", borderRadius: "8px", fontSize: 12 }} formatter={(v: number) => [formatCurrency(v), ""]} />
              <Area type="monotone" dataKey="income" stroke="#22c55e" fill="url(#ig2)" strokeWidth={2} name="Income" />
              <Area type="monotone" dataKey="expenses" stroke="#ef4444" fill="url(#eg2)" strokeWidth={2} name="Expenses" />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Savings Rate Trend */}
        <div className="card-glass p-5">
          <h2 className="text-sm font-semibold mb-4">Savings Rate Trend (%)</h2>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={savingsRateTrend} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 24% 16%)" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(217 10% 55%)" }} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "hsl(217 10% 55%)" }} tickLine={false} tickFormatter={v => `${v.toFixed(0)}%`} />
              <Tooltip contentStyle={{ background: "hsl(220 16% 10%)", border: "1px solid hsl(217 24% 16%)", borderRadius: "8px", fontSize: 12 }} formatter={(v: number) => [`${v.toFixed(1)}%`, "Savings Rate"]} />
              <Line type="monotone" dataKey="rate" stroke="#3b82f6" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Spending by Category Bar */}
        <div className="card-glass p-5">
          <h2 className="text-sm font-semibold mb-4">Expenses by Category</h2>
          {expensesByCategory.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={expensesByCategory} layout="vertical" margin={{ top: 0, right: 8, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 24% 16%)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: "hsl(217 10% 55%)" }} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}K`} />
                <YAxis type="category" dataKey="category" tick={{ fontSize: 10, fill: "hsl(217 10% 55%)" }} tickLine={false} width={75} />
                <Tooltip contentStyle={{ background: "hsl(220 16% 10%)", border: "1px solid hsl(217 24% 16%)", borderRadius: "8px", fontSize: 12 }} formatter={(v: number) => [formatCurrency(v), ""]} />
                <Bar dataKey="amount" radius={[0, 4, 4, 0]}>
                  {expensesByCategory.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">No expense data yet</div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Spending Breakdown Pie */}
        <div className="card-glass p-5">
          <h2 className="text-sm font-semibold mb-3">This Month — Spending Breakdown</h2>
          {spending && spending.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={spending} cx="50%" cy="50%" outerRadius={80} innerRadius={45} dataKey="amount" nameKey="category" strokeWidth={0}>
                    {spending.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "hsl(220 16% 10%)", border: "1px solid hsl(217 24% 16%)", borderRadius: "8px", fontSize: 11 }} formatter={(v: number) => [formatCurrency(v), ""]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2">
                {spending.map((s, i) => (
                  <div key={s.category} className="flex items-center gap-1.5 text-xs">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                    <span className="capitalize text-muted-foreground truncate">{s.category.replace(/_/g, " ")}</span>
                    <span className="ml-auto font-medium">{s.percentage.toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">No expenses this month</div>
          )}
        </div>

        {/* Income Breakdown */}
        <div className="card-glass p-5">
          <h2 className="text-sm font-semibold mb-3">This Month — Income Sources</h2>
          {income && income.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={income} cx="50%" cy="50%" outerRadius={80} innerRadius={45} dataKey="amount" nameKey="category" strokeWidth={0}>
                    {income.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "hsl(220 16% 10%)", border: "1px solid hsl(217 24% 16%)", borderRadius: "8px", fontSize: 11 }} formatter={(v: number) => [formatCurrency(v), ""]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2">
                {income.map((s, i) => (
                  <div key={s.category} className="flex items-center gap-1.5 text-xs">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                    <span className="capitalize text-muted-foreground truncate">
                      {s.category === "carry_forward" ? "Balance Carry Forward" : s.category === "last_balance" ? "Last Balance" : s.category.replace(/_/g, " ")}
                    </span>
                    <span className="ml-auto font-medium text-money-in">{formatCurrency(s.amount)}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">No income this month</div>
          )}
        </div>
      </div>

      {/* Monthly comparison bar chart */}
      <div className="card-glass p-5">
        <h2 className="text-sm font-semibold mb-4">Monthly Income vs Expenses Comparison</h2>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={expenseComparison} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 24% 16%)" />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(217 10% 55%)" }} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: "hsl(217 10% 55%)" }} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}K`} />
            <Tooltip contentStyle={{ background: "hsl(220 16% 10%)", border: "1px solid hsl(217 24% 16%)", borderRadius: "8px", fontSize: 12 }} formatter={(v: number) => [formatCurrency(v), ""]} />
            <Bar dataKey="income" fill="#22c55e" radius={[3, 3, 0, 0]} name="Income" />
            <Bar dataKey="expenses" fill="#ef4444" radius={[3, 3, 0, 0]} name="Expenses" />
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
