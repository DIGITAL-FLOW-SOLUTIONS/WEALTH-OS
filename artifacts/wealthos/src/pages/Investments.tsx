import { useState } from "react";
import {
  useListInvestments, useCreateInvestment, useUpdateInvestment, useDeleteInvestment,
  getListInvestmentsQueryKey, getGetDashboardSummaryQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Plus, Trash2, TrendingUp, TrendingDown, Edit } from "lucide-react";

const INVESTMENT_TYPES = ["stocks", "sacco", "mmf", "bonds", "crypto", "business", "land", "real_estate"];
const RISK_LEVELS = ["low", "medium", "high"];

const TYPE_COLORS: Record<string, string> = {
  stocks: "#22c55e", sacco: "#3b82f6", mmf: "#f59e0b", bonds: "#6366f1",
  crypto: "#a855f7", business: "#f97316", land: "#ec4899", real_estate: "#06b6d4",
};

const riskBadge = (r: string) => {
  if (r === "high") return "text-rose-400 border-rose-400/30";
  if (r === "medium") return "text-amber-400 border-amber-400/30";
  return "text-emerald-400 border-emerald-400/30";
};

export default function Investments() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});

  const { data: investments, isLoading } = useListInvestments();
  const create = useCreateInvestment();
  const update = useUpdateInvestment();
  const del = useDeleteInvestment();

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: getListInvestmentsQueryKey() });
    qc.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
  };

  const handleCreate = () => {
    create.mutate({
      data: {
        name: form.name || "Investment",
        type: (form.type as "stocks" | "sacco" | "mmf" | "bonds" | "crypto" | "business" | "land" | "real_estate") || "mmf",
        purchaseValue: parseFloat(form.purchaseValue || "0"),
        currentValue: parseFloat(form.currentValue || "0"),
        returnPercent: form.returnPercent ? parseFloat(form.returnPercent) : undefined,
        riskLevel: (form.riskLevel as "low" | "medium" | "high") || "medium",
        notes: form.notes,
      },
    }, {
      onSuccess: () => { toast({ title: "Investment added" }); setOpen(false); setForm({}); invalidate(); },
      onError: () => toast({ title: "Error", variant: "destructive" }),
    });
  };

  const handleUpdate = (id: number) => {
    update.mutate({
      id,
      data: { currentValue: parseFloat(form.currentValue || "0") },
    }, {
      onSuccess: () => { toast({ title: "Updated" }); setEditId(null); setForm({}); invalidate(); },
      onError: () => toast({ title: "Error", variant: "destructive" }),
    });
  };

  const totalCurrent = (investments ?? []).reduce((s, i) => s + i.currentValue, 0);
  const totalPurchase = (investments ?? []).reduce((s, i) => s + i.purchaseValue, 0);
  const totalGain = totalCurrent - totalPurchase;
  const totalReturn = totalPurchase > 0 ? (totalGain / totalPurchase) * 100 : 0;

  // Pie chart data by type
  const byType = Object.entries(
    (investments ?? []).reduce((acc: Record<string, number>, i) => {
      acc[i.type] = (acc[i.type] || 0) + i.currentValue;
      return acc;
    }, {})
  ).map(([type, value]) => ({ type, value }));

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Investments</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Portfolio performance</p>
        </div>
        <Button onClick={() => { setOpen(true); setForm({}); }} data-testid="button-add-investment" className="gap-2">
          <Plus className="w-4 h-4" />Add Investment
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card-glass p-3 text-center">
          <p className="text-xs text-muted-foreground">Portfolio Value</p>
          <p className="text-lg font-bold text-gold mt-1 tabular-nums">{formatCurrency(totalCurrent)}</p>
        </div>
        <div className="card-glass p-3 text-center">
          <p className="text-xs text-muted-foreground">Invested</p>
          <p className="text-lg font-bold mt-1 tabular-nums">{formatCurrency(totalPurchase)}</p>
        </div>
        <div className="card-glass p-3 text-center">
          <p className="text-xs text-muted-foreground">Total Gain/Loss</p>
          <p className={cn("text-lg font-bold mt-1 tabular-nums", totalGain >= 0 ? "text-money-in" : "text-money-out")}>
            {totalGain >= 0 ? "+" : ""}{formatCurrency(totalGain)}
          </p>
        </div>
        <div className="card-glass p-3 text-center">
          <p className="text-xs text-muted-foreground">Return</p>
          <p className={cn("text-lg font-bold mt-1 tabular-nums", totalReturn >= 0 ? "text-money-in" : "text-money-out")}>
            {totalReturn >= 0 ? "+" : ""}{totalReturn.toFixed(1)}%
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Allocation Chart */}
        {byType.length > 0 && (
          <div className="card-glass p-5">
            <h2 className="text-sm font-semibold mb-3">Allocation by Type</h2>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={byType} cx="50%" cy="50%" outerRadius={70} innerRadius={35} dataKey="value" nameKey="type" strokeWidth={0}>
                  {byType.map((entry) => <Cell key={entry.type} fill={TYPE_COLORS[entry.type] || "#6366f1"} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "hsl(220 16% 10%)", border: "1px solid hsl(217 24% 16%)", borderRadius: "8px", fontSize: 11 }} formatter={(v: number) => [formatCurrency(v), ""]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-2">
              {byType.map(b => (
                <div key={b.type} className="flex items-center gap-1.5 text-xs">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: TYPE_COLORS[b.type] || "#6366f1" }} />
                  <span className="capitalize text-muted-foreground">{b.type.replace(/_/g, " ")}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Investment list */}
        <div className={cn("space-y-2", byType.length > 0 ? "lg:col-span-2" : "lg:col-span-3")}>
          {isLoading ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />) :
            (investments ?? []).length === 0 ? (
              <div className="card-glass p-10 text-center">
                <p className="text-muted-foreground text-sm">No investments yet. Add stocks, SACCOs, or MMFs.</p>
              </div>
            ) : (
              (investments ?? []).map(inv => {
                const gain = inv.currentValue - inv.purchaseValue;
                const ret = inv.purchaseValue > 0 ? (gain / inv.purchaseValue) * 100 : 0;
                return (
                  <div key={inv.id} data-testid={`card-investment-${inv.id}`} className="card-glass px-4 py-3 group">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-[11px] font-bold" style={{ background: `${TYPE_COLORS[inv.type]}22`, color: TYPE_COLORS[inv.type] || "#6366f1" }}>
                        {inv.type.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium">{inv.name}</span>
                          <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", riskBadge(inv.riskLevel))}>{inv.riskLevel} risk</Badge>
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 capitalize">{inv.type.replace(/_/g, " ")}</Badge>
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground flex-wrap">
                          <span>Invested: {formatCurrency(inv.purchaseValue)}</span>
                          <span className="text-gold font-medium">Current: {formatCurrency(inv.currentValue)}</span>
                          <span className={cn("font-medium flex items-center gap-0.5", gain >= 0 ? "text-money-in" : "text-money-out")}>
                            {gain >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                            {gain >= 0 ? "+" : ""}{formatCurrency(gain)} ({ret.toFixed(1)}%)
                          </span>
                        </div>
                        {inv.notes && <p className="text-xs text-muted-foreground/70 mt-0.5 truncate">{inv.notes}</p>}
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <Button variant="ghost" size="icon" className="w-7 h-7 text-muted-foreground hover:text-foreground"
                          onClick={() => { setEditId(inv.id); setForm({ currentValue: String(inv.currentValue) }); }}>
                          <Edit className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="w-7 h-7 text-muted-foreground hover:text-destructive"
                          onClick={() => del.mutate({ id: inv.id }, { onSuccess: invalidate })}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })
            )
          }
        </div>
      </div>

      {/* Add Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Add Investment</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>Name</Label><Input placeholder="e.g. Safaricom Shares" value={form.name || ""} onChange={e => set("name", e.target.value)} /></div>
            <div className="space-y-1"><Label>Type</Label>
              <Select value={form.type || ""} onValueChange={v => set("type", v)}>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>{INVESTMENT_TYPES.map(t => <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Purchase Value (KES)</Label><Input type="number" placeholder="0" value={form.purchaseValue || ""} onChange={e => set("purchaseValue", e.target.value)} /></div>
            <div className="space-y-1"><Label>Current Value (KES)</Label><Input type="number" placeholder="0" value={form.currentValue || ""} onChange={e => set("currentValue", e.target.value)} /></div>
            <div className="space-y-1"><Label>Risk Level</Label>
              <Select value={form.riskLevel || "medium"} onValueChange={v => set("riskLevel", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{RISK_LEVELS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Notes</Label><Input placeholder="Optional" value={form.notes || ""} onChange={e => set("notes", e.target.value)} /></div>
            <Button className="w-full" onClick={handleCreate} disabled={create.isPending} data-testid="button-submit-investment">
              {create.isPending ? "Saving..." : "Add Investment"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editId !== null} onOpenChange={o => { if (!o) setEditId(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Update Current Value</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>Current Market Value (KES)</Label>
              <Input type="number" value={form.currentValue || ""} onChange={e => set("currentValue", e.target.value)} />
            </div>
            <Button className="w-full" onClick={() => handleUpdate(editId!)} disabled={update.isPending}>
              {update.isPending ? "Saving..." : "Update"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
