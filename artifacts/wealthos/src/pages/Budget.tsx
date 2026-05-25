import { useState } from "react";
import {
  useListBudgets, useCreateBudget, useDeleteBudget,
  getListBudgetsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";

const EXPENSE_CATS = ["rent", "food", "transport", "fuel", "internet", "electricity", "water", "shopping", "family", "healthcare", "insurance", "entertainment", "debt", "taxes", "business", "miscellaneous"];

const now = new Date();

export default function Budget() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [form, setForm] = useState({ category: "", limit: "", month: String(now.getMonth() + 1), year: String(now.getFullYear()) });

  const { data: budgets, isLoading, isError, refetch } = useListBudgets({ month: String(selectedMonth), year: String(selectedYear) });
  const create = useCreateBudget();
  const deleteBudget = useDeleteBudget();

  const invalidateBudgets = () => {
    qc.invalidateQueries({ queryKey: getListBudgetsQueryKey({ month: String(selectedMonth), year: String(selectedYear) }) });
    qc.invalidateQueries({ queryKey: getListBudgetsQueryKey() });
  };

  const handleCreate = () => {
    create.mutate({
      data: {
        category: form.category,
        limit: parseFloat(form.limit || "0"),
        month: parseInt(form.month),
        year: parseInt(form.year),
      },
    }, {
      onSuccess: () => {
        toast({ title: "Budget created" });
        setOpen(false);
        setForm({ category: "", limit: "", month: String(selectedMonth), year: String(selectedYear) });
        invalidateBudgets();
        refetch();
      },
      onError: () => toast({ title: "Error creating budget", variant: "destructive" }),
    });
  };

  const handleDelete = (id: number) => {
    deleteBudget.mutate({ id }, {
      onSuccess: () => { toast({ title: "Deleted" }); invalidateBudgets(); },
      onError: () => toast({ title: "Error", variant: "destructive" }),
    });
  };

  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const totalBudget = (budgets ?? []).reduce((s, b) => s + b.limit, 0);
  const totalSpent = (budgets ?? []).reduce((s, b) => s + b.spent, 0);

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Budget Planner</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Set limits. Track spending.</p>
        </div>
        <Button onClick={() => setOpen(true)} data-testid="button-add-budget" className="gap-2">
          <Plus className="w-4 h-4" />Add Budget
        </Button>
      </div>

      {/* Month selector */}
      <div className="card-glass p-3 flex gap-2 flex-wrap items-center">
        <Select value={String(selectedMonth)} onValueChange={v => setSelectedMonth(Number(v))}>
          <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {monthNames.map((m, i) => <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={String(selectedYear)} onValueChange={v => setSelectedYear(Number(v))}>
          <SelectTrigger className="w-24 h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map(y => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Summary */}
      {budgets && budgets.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="card-glass p-3 text-center">
            <p className="text-xs text-muted-foreground">Total Budget</p>
            <p className="text-lg font-bold text-money-in mt-1">{formatCurrency(totalBudget)}</p>
          </div>
          <div className="card-glass p-3 text-center">
            <p className="text-xs text-muted-foreground">Total Spent</p>
            <p className={cn("text-lg font-bold mt-1", totalSpent > totalBudget ? "text-money-out" : "text-foreground")}>{formatCurrency(totalSpent)}</p>
          </div>
          <div className="card-glass p-3 text-center">
            <p className="text-xs text-muted-foreground">Remaining</p>
            <p className={cn("text-lg font-bold mt-1", totalBudget - totalSpent < 0 ? "text-money-out" : "text-money-in")}>{formatCurrency(totalBudget - totalSpent)}</p>
          </div>
        </div>
      )}

      {/* Budget list */}
      <div className="space-y-3">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)
        ) : isError ? (
          <div className="card-glass p-10 text-center">
            <p className="text-destructive text-sm">Failed to load budgets. <button className="underline" onClick={() => refetch()}>Try again</button></p>
          </div>
        ) : (budgets ?? []).length === 0 ? (
          <div className="card-glass p-10 text-center">
            <p className="text-muted-foreground text-sm">No budgets for this month. Create one above.</p>
          </div>
        ) : (
          (budgets ?? []).map(b => {
            const pct = b.limit > 0 ? Math.min(100, (b.spent / b.limit) * 100) : 0;
            const over = b.spent > b.limit;
            return (
              <div key={b.id} data-testid={`card-budget-${b.id}`} className="card-glass p-4 group">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {over ? <AlertTriangle className="w-3.5 h-3.5 text-amber-500" /> : <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
                    <span className="text-sm font-medium capitalize">{b.category}</span>
                    {over && <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Over budget</Badge>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground tabular-nums">
                      <span className={over ? "text-money-out font-medium" : ""}>{formatCurrency(b.spent)}</span>
                      {" / "}{formatCurrency(b.limit)}
                    </span>
                    <Button variant="ghost" size="icon" className="w-6 h-6 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDelete(b.id)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
                <Progress value={pct} className={cn("h-2", over ? "[&>div]:bg-destructive" : "[&>div]:bg-primary")} />
                <p className="text-xs text-muted-foreground mt-1.5">
                  {over ? `Over by ${formatCurrency(b.spent - b.limit)}` : `${formatCurrency(b.limit - b.spent)} remaining (${(100 - pct).toFixed(0)}%)`}
                </p>
              </div>
            );
          })
        )}
      </div>

      {/* Add Modal */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>New Budget</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>Category</Label>
              <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                <SelectTrigger data-testid="select-budget-category"><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>{EXPENSE_CATS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Budget Limit</Label><Input type="number" placeholder="0" value={form.limit} onChange={e => setForm(f => ({ ...f, limit: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1"><Label>Month</Label>
                <Select value={form.month} onValueChange={v => setForm(f => ({ ...f, month: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{monthNames.map((m, i) => <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label>Year</Label>
                <Select value={form.year} onValueChange={v => setForm(f => ({ ...f, year: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <Button className="w-full" onClick={handleCreate} disabled={create.isPending || !form.category || !form.limit} data-testid="button-submit-budget">
              {create.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving…</>
              ) : "Create Budget"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
