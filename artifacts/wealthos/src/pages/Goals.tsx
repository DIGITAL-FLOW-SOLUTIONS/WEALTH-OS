import { useState } from "react";
import {
  useListGoals, useCreateGoal, useUpdateGoal, useDeleteGoal,
  useListSavings, useCreateSavings, useDeleteSavings,
  getListGoalsQueryKey, getListSavingsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { formatCurrency, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, CheckCircle2, Target, PiggyBank, Loader2 } from "lucide-react";

const priorityColor = (p: string) => {
  if (p === "critical") return "text-rose-500 border-rose-500/30";
  if (p === "high") return "text-orange-500 border-orange-500/30";
  if (p === "medium") return "text-amber-500 border-amber-500/30";
  return "text-blue-400 border-blue-400/30";
};

function GoalRing({ current, target }: { current: number; target: number }) {
  const pct = target > 0 ? Math.min(100, (current / target) * 100) : 0;
  const r = 32;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <svg width="80" height="80" viewBox="0 0 80 80" className="-rotate-90">
      <circle cx="40" cy="40" r={r} fill="none" stroke="hsl(217 24% 16%)" strokeWidth="8" />
      <circle cx="40" cy="40" r={r} fill="none" stroke="#22c55e" strokeWidth="8"
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" className="transition-all duration-700" />
      <text x="40" y="40" textAnchor="middle" dominantBaseline="middle" className="fill-foreground text-[11px] font-bold rotate-90"
        style={{ transform: "rotate(90deg)", transformOrigin: "40px 40px", fontSize: 11, fontWeight: 700 }}>
        {pct.toFixed(0)}%
      </text>
    </svg>
  );
}

export default function Goals() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editGoal, setEditGoal] = useState<number | null>(null);
  const [savingsOpen, setSavingsOpen] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});

  const { data: goals, isLoading: goalsLoading } = useListGoals();
  const { data: savings, isLoading: savingsLoading } = useListSavings();
  const create = useCreateGoal();
  const update = useUpdateGoal();
  const del = useDeleteGoal();
  const createSavings = useCreateSavings();
  const deleteSavings = useDeleteSavings();

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const invalidateGoals = () => qc.invalidateQueries({ queryKey: getListGoalsQueryKey() });
  const invalidateSavings = () => qc.invalidateQueries({ queryKey: getListSavingsQueryKey() });

  const handleCreate = () => {
    create.mutate({
      data: {
        name: form.name || "New Goal",
        targetAmount: parseFloat(form.targetAmount || "0"),
        currentAmount: parseFloat(form.currentAmount || "0"),
        deadline: form.deadline || undefined,
        priority: (form.priority as "low" | "medium" | "high" | "critical") || "medium",
        notes: form.notes,
      },
    }, {
      onSuccess: () => { toast({ title: "Goal created" }); setOpen(false); setForm({}); invalidateGoals(); },
      onError: () => toast({ title: "Error", variant: "destructive" }),
    });
  };

  const handleUpdate = (id: number) => {
    update.mutate({
      id,
      data: { currentAmount: parseFloat(form.contribution || "0") },
    }, {
      onSuccess: () => { toast({ title: "Progress updated" }); setEditGoal(null); setForm({}); invalidateGoals(); },
      onError: () => toast({ title: "Error", variant: "destructive" }),
    });
  };

  const handleDelete = (id: number) => {
    del.mutate({ id }, {
      onSuccess: () => { toast({ title: "Goal deleted" }); invalidateGoals(); },
      onError: () => toast({ title: "Error", variant: "destructive" }),
    });
  };

  const handleAddSavings = () => {
    const today = new Date().toISOString().split("T")[0];
    createSavings.mutate({
      data: {
        amount: parseFloat(form.savAmount || "0"),
        account: form.savAccount || "Savings Account",
        date: form.savDate || today,
        notes: form.savNotes,
      },
    }, {
      onSuccess: () => { toast({ title: "Savings entry added" }); setSavingsOpen(false); setForm({}); invalidateSavings(); },
      onError: () => toast({ title: "Error adding savings", variant: "destructive" }),
    });
  };

  const handleDeleteSavings = (id: number) => {
    deleteSavings.mutate({ id }, {
      onSuccess: () => { toast({ title: "Deleted" }); invalidateSavings(); },
      onError: () => toast({ title: "Error", variant: "destructive" }),
    });
  };

  const active = (goals ?? []).filter(g => !g.isCompleted);
  const completed = (goals ?? []).filter(g => g.isCompleted);
  const totalSaved = (savings ?? []).reduce((s, r) => s + r.amount, 0);

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Goals & Savings</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{active.length} active goal{active.length !== 1 ? "s" : ""}</p>
        </div>
        <Button onClick={() => { setOpen(true); setForm({}); }} data-testid="button-add-goal" className="gap-2">
          <Plus className="w-4 h-4" />New Goal
        </Button>
      </div>

      {/* ── GOALS SECTION ── */}
      {goalsLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
        </div>
      ) : (goals ?? []).length === 0 ? (
        <div className="card-glass p-10 text-center">
          <Target className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
          <p className="text-muted-foreground text-sm">No goals yet. Create your first financial goal.</p>
        </div>
      ) : (
        <>
          {active.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-muted-foreground mb-3">Active Goals ({active.length})</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {active.map(g => (
                  <div key={g.id} data-testid={`card-goal-${g.id}`} className="card-glass p-4 group relative">
                    <div className="flex items-start gap-4">
                      <GoalRing current={g.currentAmount} target={g.targetAmount} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-1">
                          <p className="text-sm font-semibold leading-tight">{g.name}</p>
                          <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 capitalize shrink-0", priorityColor(g.priority))}>{g.priority}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          <span className="text-money-in font-medium">{formatCurrency(g.currentAmount)}</span>
                          {" of "}{formatCurrency(g.targetAmount)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {formatCurrency(g.targetAmount - g.currentAmount)} remaining
                        </p>
                        {g.deadline && <p className="text-xs text-muted-foreground mt-0.5">By {formatDate(g.deadline)}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-3">
                      <Button size="sm" variant="outline" className="h-7 text-xs flex-1"
                        onClick={() => { setEditGoal(g.id); setForm({ contribution: "" }); }}>
                        Update Progress
                      </Button>
                      <Button variant="ghost" size="icon" className="w-7 h-7 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100"
                        onClick={() => handleDelete(g.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {completed.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-muted-foreground mb-3">Completed ({completed.length})</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {completed.map(g => (
                  <div key={g.id} className="card-glass p-3 flex items-center gap-3 opacity-60">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{g.name}</p>
                      <p className="text-xs text-muted-foreground">{formatCurrency(g.targetAmount)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── SAVINGS SECTION ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <PiggyBank className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold">Savings Entries</h2>
            {(savings ?? []).length > 0 && (
              <Badge variant="outline" className="text-[10px] text-money-in border-money-in/30 px-1.5 py-0">
                Total: {formatCurrency(totalSaved)}
              </Badge>
            )}
          </div>
          <Button size="sm" onClick={() => { setSavingsOpen(true); setForm({}); }} className="gap-1.5 h-8 text-xs" data-testid="button-add-savings">
            <Plus className="w-3.5 h-3.5" />Add Entry
          </Button>
        </div>

        {savingsLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
          </div>
        ) : (savings ?? []).length === 0 ? (
          <div className="card-glass p-8 text-center">
            <PiggyBank className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-muted-foreground text-sm">No savings entries yet.</p>
            <p className="text-muted-foreground text-xs mt-1">Track deposits to savings accounts, M-Shwari, SACCOs, etc.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {[...(savings ?? [])].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(s => (
              <div key={s.id} className="card-glass p-3 flex items-center gap-3 group">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <PiggyBank className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{s.account}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(s.date)}{s.notes ? ` · ${s.notes}` : ""}</p>
                </div>
                <p className="text-sm font-semibold text-money-in tabular-nums">{formatCurrency(s.amount)}</p>
                <Button variant="ghost" size="icon" className="w-7 h-7 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive shrink-0"
                  onClick={() => handleDeleteSavings(s.id)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Goal Modal */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>New Financial Goal</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>Goal Name</Label><Input data-testid="input-goal-name" placeholder="e.g. Buy Laptop" value={form.name || ""} onChange={e => set("name", e.target.value)} /></div>
            <div className="space-y-1"><Label>Target Amount</Label><Input type="number" placeholder="0" value={form.targetAmount || ""} onChange={e => set("targetAmount", e.target.value)} /></div>
            <div className="space-y-1"><Label>Current Amount</Label><Input type="number" placeholder="0" value={form.currentAmount || ""} onChange={e => set("currentAmount", e.target.value)} /></div>
            <div className="space-y-1"><Label>Deadline (optional)</Label><Input type="date" value={form.deadline || ""} onChange={e => set("deadline", e.target.value)} /></div>
            <div className="space-y-1"><Label>Priority</Label>
              <Select value={form.priority || "medium"} onValueChange={v => set("priority", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["low", "medium", "high", "critical"].map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Notes</Label><Input placeholder="Optional" value={form.notes || ""} onChange={e => set("notes", e.target.value)} /></div>
            <Button className="w-full" onClick={handleCreate} disabled={create.isPending} data-testid="button-submit-goal">
              {create.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving…</> : "Create Goal"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Update Progress Modal */}
      <Dialog open={editGoal !== null} onOpenChange={o => { if (!o) setEditGoal(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Update Progress</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>New Total Saved</Label>
              <Input type="number" placeholder="0" value={form.contribution || ""} onChange={e => set("contribution", e.target.value)} />
              <p className="text-xs text-muted-foreground">Enter your new total saved amount for this goal</p>
            </div>
            <Button className="w-full" onClick={() => handleUpdate(editGoal!)} disabled={update.isPending}>
              {update.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving…</> : "Update"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Savings Modal */}
      <Dialog open={savingsOpen} onOpenChange={setSavingsOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Add Savings Entry</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>Amount</Label>
              <Input type="number" placeholder="0" value={form.savAmount || ""} onChange={e => set("savAmount", e.target.value)} />
            </div>
            <div className="space-y-1"><Label>Account / Platform</Label>
              <Input placeholder="e.g. M-Shwari, KCB Savings, SACCO" value={form.savAccount || ""} onChange={e => set("savAccount", e.target.value)} />
            </div>
            <div className="space-y-1"><Label>Date</Label>
              <Input type="date" value={form.savDate || new Date().toISOString().split("T")[0]} onChange={e => set("savDate", e.target.value)} />
            </div>
            <div className="space-y-1"><Label>Notes (optional)</Label>
              <Input placeholder="Optional" value={form.savNotes || ""} onChange={e => set("savNotes", e.target.value)} />
            </div>
            <Button className="w-full" onClick={handleAddSavings} disabled={createSavings.isPending || !form.savAmount} data-testid="button-submit-savings">
              {createSavings.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving…</> : "Add Entry"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
