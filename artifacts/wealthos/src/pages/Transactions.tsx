import { useState } from "react";
import {
  useListTransactions,
  useCreateTransaction,
  useDeleteTransaction,
  getListTransactionsQueryKey,
  getGetDashboardSummaryQueryKey,
  getGetCashflowTrendQueryKey,
  getGetSpendingBreakdownQueryKey,
  getGetFinancialInsightsQueryKey,
  getGetHealthScoreQueryKey,
  getGetIncomeBreakdownQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { formatCurrency, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, TrendingUp, TrendingDown, Search } from "lucide-react";

const INCOME_CATS = [
  "salary",
  "business",
  "freelance",
  "investment",
  "side_hustle",
  "gift",
  "refund",
  "loan",
];
const EXPENSE_CATS = [
  "rent",
  "food",
  "Wifey",
  "Laundry",
  "tithe",
  "transport",
  "entertainment",
  "daily_expense",
  "internet",
  "electricity",
  "water",
  "shopping",
  "family",
  "healthcare",
  "taxes",
  "insurance",
  "debt",
  "business",
  "lending",
  "fuel",
];

export default function Transactions() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [filter, setFilter] = useState<{
    type?: string;
    month?: string;
    year?: string;
    category?: string;
  }>({});
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<"income" | "expense" | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});

  const params = {
    type: filter.type as "income" | "expense" | undefined,
    month: filter.month,
    year: filter.year || String(new Date().getFullYear()),
    category: filter.category,
  };
  const { data: transactions, isLoading } = useListTransactions(params);
  const createTx = useCreateTransaction();
  const deleteTx = useDeleteTransaction();

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: getListTransactionsQueryKey() });
    qc.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
    qc.invalidateQueries({ queryKey: getGetCashflowTrendQueryKey() });
    qc.invalidateQueries({ queryKey: getGetSpendingBreakdownQueryKey() });
    qc.invalidateQueries({ queryKey: getGetFinancialInsightsQueryKey() });
    qc.invalidateQueries({ queryKey: getGetHealthScoreQueryKey() });
    qc.invalidateQueries({ queryKey: getGetIncomeBreakdownQueryKey() });
  };

  const handleCreate = () => {
    const today = new Date().toISOString().split("T")[0];
    const type = open!;
    const cats = type === "income" ? INCOME_CATS : EXPENSE_CATS;
    createTx.mutate(
      {
        data: {
          type,
          amount: parseFloat(form.amount || "0"),
          category: form.category || cats[0],
          source: form.source,
          date: form.date || today,
          notes: form.notes,
          paymentMethod: form.paymentMethod,
          isRecurring: form.isRecurring === "true",
        },
      },
      {
        onSuccess: () => {
          toast({ title: `${type === "income" ? "Income" : "Expense"} added` });
          setOpen(null);
          setForm({});
          invalidate();
        },
        onError: () => toast({ title: "Error", variant: "destructive" }),
      },
    );
  };

  const handleDelete = (id: number) => {
    deleteTx.mutate(
      { id },
      {
        onSuccess: () => {
          toast({ title: "Deleted" });
          invalidate();
        },
        onError: () => toast({ title: "Error", variant: "destructive" }),
      },
    );
  };

  const filtered = (transactions ?? []).filter(
    (t) =>
      !search ||
      t.category.includes(search.toLowerCase()) ||
      (t.notes ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (t.source ?? "").toLowerCase().includes(search.toLowerCase()),
  );

  const months = [
    "01",
    "02",
    "03",
    "04",
    "05",
    "06",
    "07",
    "08",
    "09",
    "10",
    "11",
    "12",
  ];
  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Transactions</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {filtered.length} records
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setOpen("income");
              setForm({});
            }}
            data-testid="button-add-income"
            className="gap-1.5 text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/10"
          >
            <TrendingUp className="w-4 h-4" />
            <span className="hidden sm:inline">Income</span>
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setOpen("expense");
              setForm({});
            }}
            data-testid="button-add-expense"
            className="gap-1.5 text-rose-500 border-rose-500/30 hover:bg-rose-500/10"
          >
            <TrendingDown className="w-4 h-4" />
            <span className="hidden sm:inline">Expense</span>
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="card-glass p-3 flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-40">
          <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            className="pl-8 h-8 text-sm"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select
          value={filter.type || "all"}
          onValueChange={(v) =>
            setFilter((f) => ({ ...f, type: v === "all" ? undefined : v }))
          }
        >
          <SelectTrigger className="h-8 w-28 text-xs">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="income">Income</SelectItem>
            <SelectItem value="expense">Expense</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={filter.month || "all"}
          onValueChange={(v) =>
            setFilter((f) => ({ ...f, month: v === "all" ? undefined : v }))
          }
        >
          <SelectTrigger className="h-8 w-24 text-xs">
            <SelectValue placeholder="Month" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All months</SelectItem>
            {months.map((m, i) => (
              <SelectItem key={m} value={m}>
                {monthNames[i]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Transaction list */}
      <div className="space-y-2">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))
        ) : filtered.length === 0 ? (
          <div className="card-glass p-8 text-center">
            <p className="text-muted-foreground text-sm">
              No transactions found. Add your first one above.
            </p>
          </div>
        ) : (
          filtered.map((t) => (
            <div
              key={t.id}
              data-testid={`row-transaction-${t.id}`}
              className="card-glass px-4 py-3 flex items-center gap-3 group hover:bg-card/80 transition-colors"
            >
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                  t.type === "income" ? "bg-emerald-500/15" : "bg-rose-500/15",
                )}
              >
                {t.type === "income" ? (
                  <TrendingUp className="w-4 h-4 text-emerald-500" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-rose-500" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Badge
                    variant="secondary"
                    className={`text-[10px] capitalize px-1.5 py-0 ${t.category === "carry_forward" ? "bg-blue-500/20 text-blue-400" : ""}`}
                  >
                    {t.category === "carry_forward" ? "Balance Carry Forward" : t.category.replace(/_/g, " ")}
                  </Badge>
                  {t.source && (
                    <span className="text-xs text-muted-foreground truncate">
                      {t.source}
                    </span>
                  )}
                  {t.isRecurring && (
                    <Badge
                      variant="outline"
                      className="text-[10px] px-1.5 py-0"
                    >
                      Recurring
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-muted-foreground">
                    {formatDate(t.date)}
                  </span>
                  {t.paymentMethod && (
                    <span className="text-[10px] text-muted-foreground/70">
                      {t.paymentMethod}
                    </span>
                  )}
                </div>
                {t.notes && (
                  <p className="text-xs text-muted-foreground/70 truncate mt-0.5">
                    {t.notes}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span
                  className={cn(
                    "text-sm font-semibold tabular-nums",
                    t.type === "income" ? "text-money-in" : "text-money-out",
                  )}
                >
                  {t.type === "income" ? "+" : "-"}
                  {formatCurrency(t.amount)}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-7 h-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                  data-testid={`button-delete-transaction-${t.id}`}
                  onClick={() => handleDelete(t.id)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Modal */}
      <Dialog
        open={open !== null}
        onOpenChange={(o) => {
          if (!o) setOpen(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Add {open === "income" ? "Income" : "Expense"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
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
              <Label>Category</Label>
              <Select
                value={form.category || ""}
                onValueChange={(v) => set("category", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {(open === "income" ? INCOME_CATS : EXPENSE_CATS).map((c) => (
                    <SelectItem key={c} value={c}>
                      {c.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {open === "income" && (
              <div className="space-y-1">
                <Label>Source</Label>
                <Input
                  placeholder="e.g. KCB Bank"
                  value={form.source || ""}
                  onChange={(e) => set("source", e.target.value)}
                />
              </div>
            )}
            {open === "expense" && (
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
            )}
            <div className="space-y-1">
              <Label>Date</Label>
              <Input
                type="date"
                value={form.date || new Date().toISOString().split("T")[0]}
                onChange={(e) => set("date", e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Notes (optional)</Label>
              <Input
                placeholder="Any notes"
                value={form.notes || ""}
                onChange={(e) => set("notes", e.target.value)}
              />
            </div>
            <Button
              className="w-full"
              onClick={handleCreate}
              disabled={createTx.isPending}
              data-testid="button-submit-transaction"
            >
              {createTx.isPending ? "Saving..." : "Add Transaction"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
