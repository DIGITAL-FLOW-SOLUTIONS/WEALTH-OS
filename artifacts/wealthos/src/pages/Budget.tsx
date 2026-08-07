import { useMemo, useState } from "react";
import {
  getListBudgetsQueryKey,
  useCreateBudget,
  useCreateBudgetDraft,
  useDeleteBudget,
  useListBudgets,
  useUpdateBudget,
  type Budget,
  type BudgetDraft,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertCircle, ArrowRight, Check, CheckCircle2, ChevronDown, CircleDollarSign, Edit3, Lightbulb, Loader2, Plus, RefreshCw, Sparkles, Trash2, TrendingUp, WalletCards, X } from "lucide-react";
import { formatCurrency, monthLabel } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

const EXPENSE_CATEGORIES = [
  "rent", "food", "Wifey", "Laundry", "tithe", "transport", "entertainment",
  "daily_expense", "internet", "electricity", "water", "shopping", "family",
  "healthcare", "taxes", "insurance", "debt", "business", "lending", "fuel",
];

const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const now = new Date();
const years = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];

const categoryLabel = (category: string) =>
  category.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

const initialForm = (month: number, year: number) => ({
  category: "",
  limit: "",
  month: String(month),
  year: String(year),
});

type BudgetForm = ReturnType<typeof initialForm>;

export default function Budget() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [essentialCategories, setEssentialCategories] = useState<string[]>(["rent", "food", "transport", "internet", "electricity", "water"]);
  const [draft, setDraft] = useState<BudgetDraft | null>(null);
  const [isDraftOpen, setIsDraftOpen] = useState(false);
  const [budgetDialogOpen, setBudgetDialogOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [form, setForm] = useState<BudgetForm>(initialForm(selectedMonth, selectedYear));

  const listParams = useMemo(() => ({ month: String(selectedMonth), year: String(selectedYear) }), [selectedMonth, selectedYear]);
  const { data: budgets, isLoading, isError, refetch } = useListBudgets(listParams);
  const createBudget = useCreateBudget();
  const updateBudget = useUpdateBudget();
  const deleteBudget = useDeleteBudget();
  const createDraft = useCreateBudgetDraft();

  const rows = budgets ?? [];
  const totalBudget = rows.reduce((sum, budget) => sum + Number(budget.limit || 0), 0);
  const totalSpent = rows.reduce((sum, budget) => sum + Number(budget.spent || 0), 0);
  const remaining = totalBudget - totalSpent;
  const onTrackCount = rows.filter((budget) => budget.spent <= budget.limit).length;

  const invalidateBudgets = () => {
    void queryClient.invalidateQueries({ queryKey: getListBudgetsQueryKey(listParams) });
    void queryClient.invalidateQueries({ queryKey: getListBudgetsQueryKey() });
  };

  const openAddDialog = () => {
    setEditingBudget(null);
    setForm(initialForm(selectedMonth, selectedYear));
    setBudgetDialogOpen(true);
  };

  const openEditDialog = (budget: Budget) => {
    setEditingBudget(budget);
    setForm({
      category: budget.category,
      limit: String(budget.limit),
      month: String(budget.month),
      year: String(budget.year),
    });
    setBudgetDialogOpen(true);
  };

  const saveBudget = () => {
    const payload = {
      category: form.category.trim(),
      limit: Number(form.limit),
      month: Number(form.month),
      year: Number(form.year),
    };
    if (!payload.category || !Number.isFinite(payload.limit) || payload.limit <= 0) {
      toast({ title: "Add a category and a positive limit", variant: "destructive" });
      return;
    }
    const onSuccess = () => {
      toast({ title: editingBudget ? "Budget updated" : "Budget added" });
      setBudgetDialogOpen(false);
      invalidateBudgets();
    };
    const onError = () => toast({ title: "Could not save this budget", description: "Please try again.", variant: "destructive" });
    if (editingBudget) {
      updateBudget.mutate({ id: editingBudget.id, data: payload }, { onSuccess, onError });
    } else {
      createBudget.mutate({ data: payload }, { onSuccess, onError });
    }
  };

  const removeBudget = (budget: Budget) => {
    if (!window.confirm(`Delete the ${categoryLabel(budget.category)} budget?`)) return;
    deleteBudget.mutate({ id: budget.id }, {
      onSuccess: () => {
        toast({ title: "Budget removed" });
        invalidateBudgets();
      },
      onError: () => toast({ title: "Could not delete this budget", variant: "destructive" }),
    });
  };

  const generateDraft = () => {
    if (essentialCategories.length === 0) {
      toast({ title: "Choose at least one essential category", description: "The two-month review needs something to learn from.", variant: "destructive" });
      return;
    }
    createDraft.mutate({
      data: {
        month: selectedMonth,
        year: selectedYear,
        essentialCategories,
      },
    }, {
      onSuccess: (nextDraft) => {
        setDraft(nextDraft);
        setIsDraftOpen(true);
      },
      onError: () => toast({ title: "We could not analyse your spending", description: "Check your connection and try again.", variant: "destructive" }),
    });
  };

  const saveDraftRows = async () => {
    if (!draft || draft.items.length === 0) return;
    try {
      await Promise.all(draft.items.map((item) => createBudget.mutateAsync({
        data: {
          category: item.category,
          limit: item.suggestedLimit,
          month: draft.month,
          year: draft.year,
        },
      })));
      toast({ title: `${draft.items.length} budget lines saved`, description: "You can edit each limit whenever your month changes." });
      setIsDraftOpen(false);
      invalidateBudgets();
    } catch {
      toast({ title: "Some budget lines could not be saved", description: "Try saving the suggestions again.", variant: "destructive" });
    }
  };

  const isSaving = createBudget.isPending || updateBudget.isPending;

  return (
    <main className="min-h-[100dvh] overflow-hidden bg-background px-4 pb-16 pt-5 text-foreground sm:px-6 md:px-8">
      <div className="pointer-events-none fixed inset-0 -z-0 opacity-50 [background-image:radial-gradient(circle_at_15%_0%,hsl(var(--primary)/.12),transparent_28%),radial-gradient(circle_at_90%_18%,hsl(42_85%_58%/.08),transparent_22%)]" />
      <div className="relative z-10 mx-auto max-w-6xl space-y-6 md:space-y-8">
        <header className="flex flex-col gap-5 border-b border-border/70 pb-6 md:flex-row md:items-end md:justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-primary">
              <WalletCards className="size-4" /> Your monthly plan
            </div>
            <div>
              <h1 className="max-w-xl text-3xl font-semibold tracking-[-0.04em] text-balance sm:text-4xl">
                Give your money a job.
              </h1>
              <p className="mt-2 max-w-lg text-sm leading-6 text-muted-foreground">
                A clear plan for {monthLabel(selectedMonth, selectedYear)} — built around how you actually spend.
              </p>
            </div>
          </div>
          <Button onClick={openAddDialog} data-testid="button-add-budget" className="w-full gap-2 bg-primary text-primary-foreground shadow-[0_10px_30px_hsl(var(--primary)/.16)] hover:bg-primary/90 sm:w-auto">
            <Plus className="size-4" /> Add a budget line
          </Button>
        </header>

        <section className="grid gap-3 rounded-2xl border border-border/80 bg-card/70 p-3 shadow-sm backdrop-blur md:grid-cols-[1fr_auto] md:items-center md:p-4" data-testid="section-month-selector">
          <div className="flex items-center gap-3 px-1">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><CircleDollarSign className="size-5" /></div>
            <div>
              <p className="text-sm font-medium">Planning for</p>
              <p className="text-xs text-muted-foreground">Switch months to review another plan</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Select value={String(selectedMonth)} onValueChange={(value) => setSelectedMonth(Number(value))}>
              <SelectTrigger className="h-10 min-w-0 border-border bg-background/70 text-sm" data-testid="select-budget-month"><SelectValue /></SelectTrigger>
              <SelectContent>{monthNames.map((month, index) => <SelectItem key={month} value={String(index + 1)}>{month}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={String(selectedYear)} onValueChange={(value) => setSelectedYear(Number(value))}>
              <SelectTrigger className="h-10 border-border bg-background/70 text-sm" data-testid="select-budget-year"><SelectValue /></SelectTrigger>
              <SelectContent>{years.map((year) => <SelectItem key={year} value={String(year)}>{year}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-3" data-testid="section-budget-summary">
          <SummaryCard label="Planned" value={formatCurrency(totalBudget)} detail={`${rows.length} budget ${rows.length === 1 ? "line" : "lines"}`} icon={<WalletCards className="size-4" />} tone="primary" />
          <SummaryCard label="Spent so far" value={formatCurrency(totalSpent)} detail={rows.length ? `${onTrackCount} lines on track` : "Nothing recorded yet"} icon={<TrendingUp className="size-4" />} tone={totalSpent > totalBudget && totalBudget > 0 ? "danger" : "gold"} />
          <SummaryCard label="Still available" value={formatCurrency(remaining)} detail={remaining >= 0 ? "Room left in this plan" : `${formatCurrency(Math.abs(remaining))} over plan`} icon={<CheckCircle2 className="size-4" />} tone={remaining >= 0 ? "primary" : "danger"} />
        </section>

        <section className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(300px,.7fr)]">
          <div className="space-y-4">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Your plan</p>
                <h2 className="mt-1 text-xl font-semibold tracking-tight">Budget lines</h2>
              </div>
              {rows.length > 0 && <span className="text-xs text-muted-foreground">Tap a line to adjust it</span>}
            </div>
            {isLoading ? (
              <div className="space-y-3" data-testid="loading-budgets">{[1, 2, 3, 4].map((item) => <Skeleton key={item} className="h-[108px] w-full rounded-2xl" />)}</div>
            ) : isError ? (
              <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-8 text-center" data-testid="error-budgets">
                <AlertCircle className="mx-auto size-6 text-destructive" />
                <p className="mt-3 text-sm font-medium">Your plan could not load.</p>
                <Button variant="outline" size="sm" className="mt-4 gap-2" onClick={() => void refetch()} data-testid="button-retry-budgets"><RefreshCw className="size-3.5" /> Try again</Button>
              </div>
            ) : rows.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-card/40 px-6 py-12 text-center" data-testid="empty-budgets">
                <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"><WalletCards className="size-6" /></div>
                <h3 className="mt-4 text-base font-medium">No plan for this month yet</h3>
                <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">Start with a two-month review. It gives you a useful first draft without making you guess.</p>
                <Button onClick={generateDraft} disabled={createDraft.isPending} className="mt-5 gap-2" data-testid="button-empty-generate-draft">
                  {createDraft.isPending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />} Build my first plan
                </Button>
              </div>
            ) : (
              <div className="space-y-3" data-testid="list-budgets">
                {rows.map((budget) => <BudgetRow key={budget.id} budget={budget} onEdit={openEditDialog} onDelete={removeBudget} />)}
              </div>
            )}
          </div>

          <aside className="rounded-2xl border border-primary/20 bg-primary/[0.055] p-5 md:p-6" data-testid="card-draft-planner">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex size-10 items-center justify-center rounded-xl bg-primary/15 text-primary"><Sparkles className="size-5" /></div>
                <h2 className="mt-4 text-lg font-semibold tracking-tight">Make it personal</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">Tell WealthOS which essentials matter this month. We will compare your last two months and suggest a starting point.</p>
              </div>
            </div>
            <div className="mt-5 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Essential categories</Label>
                <span className="text-xs tabular-nums text-primary" data-testid="text-selected-category-count">{essentialCategories.length} selected</span>
              </div>
              <div className="flex flex-wrap gap-2" data-testid="list-essential-categories">
                {EXPENSE_CATEGORIES.map((category) => {
                  const isSelected = essentialCategories.includes(category);
                  return (
                    <button
                      type="button"
                      key={category}
                      onClick={() => setEssentialCategories((current) => isSelected ? current.filter((item) => item !== category) : [...current, category])}
                      className={cn("rounded-full border px-3 py-1.5 text-xs transition-colors", isSelected ? "border-primary/60 bg-primary/15 text-primary" : "border-border bg-background/50 text-muted-foreground hover:border-primary/40 hover:text-foreground")}
                      data-testid={`button-category-${category}`}
                      aria-pressed={isSelected}
                    >
                      {isSelected && <Check className="mr-1 inline size-3" />}{categoryLabel(category)}
                    </button>
                  );
                })}
              </div>
              <Button onClick={generateDraft} disabled={createDraft.isPending || essentialCategories.length === 0} className="mt-2 w-full justify-between gap-2" data-testid="button-generate-draft">
                {createDraft.isPending ? <><span className="flex items-center gap-2"><Loader2 className="size-4 animate-spin" /> Reviewing two months</span><span className="text-primary-foreground/60">...</span></> : <><span>Review a suggested plan</span><ArrowRight className="size-4" /></>}
              </Button>
              <p className="text-center text-[11px] leading-5 text-muted-foreground">Nothing is saved until you review and approve the suggestions.</p>
            </div>
          </aside>
        </section>

        {draft && !isDraftOpen && (
          <button type="button" onClick={() => setIsDraftOpen(true)} className="flex w-full items-center justify-between rounded-2xl border border-gold/30 bg-[hsl(43_96%_56%/.08)] p-4 text-left transition-colors hover:bg-[hsl(43_96%_56%/.12)]" data-testid="button-reopen-draft">
            <span className="flex items-center gap-3"><Lightbulb className="size-5 text-gold" /><span><span className="block text-sm font-medium">Your latest suggested plan is ready</span><span className="block text-xs text-muted-foreground">Review {draft.items.length} lines and {draft.ideas.length} wealth ideas</span></span></span>
            <ChevronDown className="size-4 -rotate-90 text-muted-foreground" />
          </button>
        )}
      </div>

      <BudgetDialog open={budgetDialogOpen} setOpen={setBudgetDialogOpen} form={form} setForm={setForm} isEditing={Boolean(editingBudget)} isSaving={isSaving} onSave={saveBudget} />
      <DraftDialog open={isDraftOpen} setOpen={setIsDraftOpen} draft={draft} isSaving={createBudget.isPending} onSave={saveDraftRows} />
    </main>
  );
}

function SummaryCard({ label, value, detail, icon, tone }: { label: string; value: string; detail: string; icon: React.ReactNode; tone: "primary" | "gold" | "danger" }) {
  return (
    <div className="rounded-2xl border border-border/80 bg-card/60 p-4 shadow-sm" data-testid={`summary-${label.toLowerCase().replace(/\s/g, "-")}`}>
      <div className="flex items-center justify-between text-muted-foreground"><span className="text-xs uppercase tracking-[0.12em]">{label}</span><span className={cn(tone === "danger" ? "text-destructive" : tone === "gold" ? "text-gold" : "text-primary")}>{icon}</span></div>
      <p className={cn("mt-3 text-2xl font-semibold tracking-tight tabular-nums", tone === "danger" ? "text-destructive" : tone === "gold" ? "text-gold" : "text-foreground")} data-testid={`value-${label.toLowerCase().replace(/\s/g, "-")}`}>{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

function BudgetRow({ budget, onEdit, onDelete }: { budget: Budget; onEdit: (budget: Budget) => void; onDelete: (budget: Budget) => void }) {
  const limit = Number(budget.limit || 0);
  const spent = Number(budget.spent || 0);
  const over = spent > limit;
  const percent = limit > 0 ? Math.min(100, (spent / limit) * 100) : 0;
  return (
    <article className="group rounded-2xl border border-border/80 bg-card/60 p-4 shadow-sm transition-colors hover:border-primary/35 sm:p-5" data-testid={`card-budget-${budget.id}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", over ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary")}><CircleDollarSign className="size-5" /></div>
          <div className="min-w-0"><h3 className="truncate text-sm font-medium">{categoryLabel(budget.category)}</h3><p className="mt-0.5 text-xs text-muted-foreground">{formatCurrency(spent)} spent of {formatCurrency(limit)}</p></div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {over && <Badge variant="destructive" className="hidden text-[10px] sm:inline-flex">Over plan</Badge>}
          <Button variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-foreground" onClick={() => onEdit(budget)} data-testid={`button-edit-budget-${budget.id}`} aria-label={`Edit ${categoryLabel(budget.category)} budget`}><Edit3 className="size-3.5" /></Button>
          <Button variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-destructive" onClick={() => onDelete(budget)} data-testid={`button-delete-budget-${budget.id}`} aria-label={`Delete ${categoryLabel(budget.category)} budget`}><Trash2 className="size-3.5" /></Button>
        </div>
      </div>
      <Progress value={percent} className={cn("mt-4 h-1.5 bg-muted", over ? "[&>div]:bg-destructive" : "[&>div]:bg-primary")} data-testid={`progress-budget-${budget.id}`} />
      <div className="mt-2 flex justify-between text-[11px] text-muted-foreground"><span>{over ? `${formatCurrency(spent - limit)} over plan` : `${formatCurrency(limit - spent)} left`}</span><span className={cn(over && "text-destructive")}>{Math.round(percent)}%</span></div>
    </article>
  );
}

function BudgetDialog({ open, setOpen, form, setForm, isEditing, isSaving, onSave }: { open: boolean; setOpen: (open: boolean) => void; form: BudgetForm; setForm: React.Dispatch<React.SetStateAction<BudgetForm>>; isEditing: boolean; isSaving: boolean; onSave: () => void }) {
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="border-border bg-card sm:max-w-md">
        <DialogHeader><DialogTitle>{isEditing ? "Edit budget line" : "Add a budget line"}</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2"><Label htmlFor="budget-category">Category</Label><Select value={form.category} onValueChange={(value) => setForm((current) => ({ ...current, category: value }))}><SelectTrigger id="budget-category" data-testid="select-budget-category"><SelectValue placeholder="Choose a category" /></SelectTrigger><SelectContent>{EXPENSE_CATEGORIES.map((category) => <SelectItem key={category} value={category}>{categoryLabel(category)}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-2"><Label htmlFor="budget-limit">Monthly limit</Label><div className="relative"><span className="pointer-events-none absolute left-3 top-2.5 text-xs text-muted-foreground">KES</span><Input id="budget-limit" type="number" min="1" placeholder="0" className="pl-12" value={form.limit} onChange={(event) => setForm((current) => ({ ...current, limit: event.target.value }))} data-testid="input-budget-limit" /></div></div>
          <div className="grid grid-cols-2 gap-3"><div className="space-y-2"><Label>Month</Label><Select value={form.month} onValueChange={(value) => setForm((current) => ({ ...current, month: value }))}><SelectTrigger data-testid="select-form-budget-month"><SelectValue /></SelectTrigger><SelectContent>{monthNames.map((month, index) => <SelectItem key={month} value={String(index + 1)}>{month}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Year</Label><Select value={form.year} onValueChange={(value) => setForm((current) => ({ ...current, year: value }))}><SelectTrigger data-testid="select-form-budget-year"><SelectValue /></SelectTrigger><SelectContent>{years.map((year) => <SelectItem key={year} value={String(year)}>{year}</SelectItem>)}</SelectContent></Select></div></div>
          <Button onClick={onSave} disabled={isSaving} className="w-full gap-2" data-testid="button-submit-budget">{isSaving ? <><Loader2 className="size-4 animate-spin" /> Saving</> : isEditing ? "Save changes" : "Add to my plan"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DraftDialog({ open, setOpen, draft, isSaving, onSave }: { open: boolean; setOpen: (open: boolean) => void; draft: BudgetDraft | null; isSaving: boolean; onSave: () => void }) {
  if (!draft) return null;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto border-border bg-card sm:max-w-2xl">
        <DialogHeader><div className="flex items-start justify-between gap-4"><div><div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-gold"><Sparkles className="size-4" /> Two-month review</div><DialogTitle className="mt-2 text-xl">A practical starting point</DialogTitle><p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">{draft.message}</p></div></div></DialogHeader>
        <div className="mt-2 grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-background/60 p-3"><p className="text-[11px] uppercase tracking-wider text-muted-foreground">Average income</p><p className="mt-1 font-semibold tabular-nums">{formatCurrency(draft.averageIncome)}</p></div><div className="rounded-xl bg-background/60 p-3"><p className="text-[11px] uppercase tracking-wider text-muted-foreground">Suggested essentials</p><p className="mt-1 font-semibold tabular-nums">{formatCurrency(draft.essentialTotal)}</p></div><div className="rounded-xl bg-background/60 p-3"><p className="text-[11px] uppercase tracking-wider text-muted-foreground">Lookback</p><p className="mt-1 font-semibold">{draft.lookbackMonths} months</p></div></div>
        <div className="mt-5 space-y-2"><div className="flex items-center justify-between"><h3 className="text-sm font-semibold">Suggested budget lines</h3><span className="text-xs text-muted-foreground">Editable after saving</span></div>{draft.items.map((item) => <div key={item.category} className="rounded-xl border border-border/70 bg-background/35 p-3" data-testid={`draft-item-${item.category}`}><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-medium">{categoryLabel(item.category)}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{item.note}</p></div><p className="shrink-0 text-sm font-semibold tabular-nums text-primary">{formatCurrency(item.suggestedLimit)}</p></div><div className="mt-2 flex gap-3 text-[11px] text-muted-foreground"><span>Average {formatCurrency(item.averageSpent)}</span><span>Latest {formatCurrency(item.latestSpent)}</span></div></div>)}</div>
        {draft.ideas.length > 0 && <div className="mt-5 space-y-2"><h3 className="text-sm font-semibold">Small moves for future you</h3>{draft.ideas.map((idea) => <div key={idea.name} className="flex gap-3 rounded-xl border border-gold/20 bg-[hsl(43_96%_56%/.06)] p-3" data-testid={`draft-idea-${idea.name.toLowerCase().replace(/\s/g, "-")}`}><div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[hsl(43_96%_56%/.14)] text-gold"><Lightbulb className="size-4" /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-medium">{idea.name}</p><Badge variant="outline" className="border-gold/30 text-[10px] text-gold">{idea.type}</Badge></div><p className="mt-1 text-xs leading-5 text-muted-foreground">{idea.why}</p><p className="mt-2 text-xs tabular-nums text-gold">Suggested {formatCurrency(idea.suggestedAmount)} · Minimum {formatCurrency(idea.minimumAmount)}</p></div></div>)}</div>}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button variant="outline" onClick={() => setOpen(false)} data-testid="button-close-draft"><X className="size-4" /> Keep reviewing</Button><Button onClick={onSave} disabled={isSaving || draft.items.length === 0} className="gap-2" data-testid="button-save-draft">{isSaving ? <><Loader2 className="size-4 animate-spin" /> Saving plan</> : <><Check className="size-4" /> Save suggested lines</>}</Button></div>
      </DialogContent>
    </Dialog>
  );
}