import { useState } from "react";
import {
  useListAssets, useCreateAsset, useDeleteAsset,
  useListLiabilities, useCreateLiability, useDeleteLiability,
  getListAssetsQueryKey, getListLiabilitiesQueryKey,
  getGetDashboardSummaryQueryKey, getGetNetWorthHistoryQueryKey,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, TrendingUp, TrendingDown } from "lucide-react";

const ASSET_CATS = ["cash", "savings", "land", "vehicle", "investment", "business", "property", "other"];
const LIABILITY_CATS = ["loan", "debt", "credit", "bnpl", "mortgage", "other"];

const assetCatColor = (c: string) => {
  const m: Record<string, string> = { cash: "text-emerald-400", savings: "text-blue-400", land: "text-amber-400", vehicle: "text-purple-400", investment: "text-gold", business: "text-cyan-400" };
  return m[c] || "text-muted-foreground";
};

export default function AssetsLiabilities() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [assetOpen, setAssetOpen] = useState(false);
  const [liabOpen, setLiabOpen] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});

  const { data: assets, isLoading: aLoad } = useListAssets();
  const { data: liabilities, isLoading: lLoad } = useListLiabilities();
  const createAsset = useCreateAsset();
  const deleteAsset = useDeleteAsset();
  const createLiab = useCreateLiability();
  const deleteLiab = useDeleteLiability();

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: getListAssetsQueryKey() });
    qc.invalidateQueries({ queryKey: getListLiabilitiesQueryKey() });
    qc.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
    qc.invalidateQueries({ queryKey: getGetNetWorthHistoryQueryKey() });
  };

  const totalAssets = (assets ?? []).reduce((s, a) => s + a.value, 0);
  const totalLiabilities = (liabilities ?? []).reduce((s, l) => s + l.amount, 0);
  const netWorth = totalAssets - totalLiabilities;

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Assets & Liabilities</h1>
        <p className="text-sm text-muted-foreground mt-0.5">What you own vs what you owe</p>
      </div>

      {/* Summary bar */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card-glass p-3 text-center">
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
            <p className="text-xs text-muted-foreground">Total Assets</p>
          </div>
          <p className="text-lg font-bold text-money-in tabular-nums">{formatCurrency(totalAssets)}</p>
        </div>
        <div className="card-glass p-3 text-center">
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <TrendingDown className="w-3.5 h-3.5 text-rose-500" />
            <p className="text-xs text-muted-foreground">Total Liabilities</p>
          </div>
          <p className="text-lg font-bold text-money-out tabular-nums">{formatCurrency(totalLiabilities)}</p>
        </div>
        <div className="card-glass p-3 text-center">
          <p className="text-xs text-muted-foreground mb-1">Net Worth</p>
          <p className={cn("text-lg font-bold tabular-nums", netWorth >= 0 ? "text-money-in" : "text-money-out")}>{formatCurrency(netWorth)}</p>
        </div>
      </div>

      {/* Asset ratio bar */}
      {(totalAssets + totalLiabilities) > 0 && (
        <div className="card-glass p-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
            <span>Assets {totalAssets > 0 ? `(${((totalAssets / (totalAssets + totalLiabilities)) * 100).toFixed(0)}%)` : ""}</span>
            <span>Liabilities {totalLiabilities > 0 ? `(${((totalLiabilities / (totalAssets + totalLiabilities)) * 100).toFixed(0)}%)` : ""}</span>
          </div>
          <div className="flex h-3 rounded-full overflow-hidden bg-muted">
            <div className="bg-emerald-500 h-full transition-all" style={{ width: `${totalAssets / (totalAssets + totalLiabilities) * 100}%` }} />
            <div className="bg-rose-500 h-full flex-1 transition-all" />
          </div>
          <div className="flex items-center gap-4 mt-2 text-xs">
            <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500" />Assets grow wealth</div>
            <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-rose-500" />Liabilities cost money</div>
          </div>
        </div>
      )}

      <Tabs defaultValue="assets">
        <TabsList>
          <TabsTrigger value="assets">Assets ({(assets ?? []).length})</TabsTrigger>
          <TabsTrigger value="liabilities">Liabilities ({(liabilities ?? []).length})</TabsTrigger>
        </TabsList>

        <TabsContent value="assets" className="space-y-3 mt-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => { setAssetOpen(true); setForm({}); }} data-testid="button-add-asset" className="gap-1.5">
              <Plus className="w-3.5 h-3.5" />Add Asset
            </Button>
          </div>
          {aLoad ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />) :
            (assets ?? []).length === 0 ? <div className="card-glass p-8 text-center"><p className="text-muted-foreground text-sm">No assets yet. Add your cash, savings, and valuables.</p></div> :
            (assets ?? []).map(a => (
              <div key={a.id} data-testid={`card-asset-${a.id}`} className="card-glass px-4 py-3 flex items-center gap-3 group">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{a.name}</span>
                    <Badge variant="secondary" className={cn("text-[10px] px-1.5 py-0 capitalize", assetCatColor(a.category))}>{a.category}</Badge>
                  </div>
                  {a.notes && <p className="text-xs text-muted-foreground mt-0.5">{a.notes}</p>}
                </div>
                <span className="text-sm font-semibold text-money-in tabular-nums">{formatCurrency(a.value)}</span>
                <Button variant="ghost" size="icon" className="w-7 h-7 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                  onClick={() => deleteAsset.mutate({ id: a.id }, { onSuccess: invalidateAll })}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))
          }
        </TabsContent>

        <TabsContent value="liabilities" className="space-y-3 mt-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => { setLiabOpen(true); setForm({}); }} data-testid="button-add-liability" className="gap-1.5">
              <Plus className="w-3.5 h-3.5" />Add Liability
            </Button>
          </div>
          {lLoad ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />) :
            (liabilities ?? []).length === 0 ? <div className="card-glass p-8 text-center"><p className="text-muted-foreground text-sm">No liabilities recorded. Debt-free!</p></div> :
            (liabilities ?? []).map(l => (
              <div key={l.id} data-testid={`card-liability-${l.id}`} className="card-glass px-4 py-3 flex items-center gap-3 group">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{l.name}</span>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 capitalize text-rose-400">{l.category}</Badge>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    {l.interestRate != null && <span className="text-xs text-muted-foreground">{l.interestRate}% p.a.</span>}
                    {l.dueDate && <span className="text-xs text-muted-foreground">Due {l.dueDate}</span>}
                  </div>
                </div>
                <span className="text-sm font-semibold text-money-out tabular-nums">{formatCurrency(l.amount)}</span>
                <Button variant="ghost" size="icon" className="w-7 h-7 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                  onClick={() => deleteLiab.mutate({ id: l.id }, { onSuccess: invalidateAll })}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))
          }
        </TabsContent>
      </Tabs>

      {/* Asset Dialog */}
      <Dialog open={assetOpen} onOpenChange={setAssetOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Add Asset</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>Name</Label><Input placeholder="e.g. KCB Savings Account" value={form.name || ""} onChange={e => set("name", e.target.value)} /></div>
            <div className="space-y-1"><Label>Category</Label>
              <Select value={form.category || ""} onValueChange={v => set("category", v)}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>{ASSET_CATS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Current Value (KES)</Label><Input type="number" placeholder="0" value={form.value || ""} onChange={e => set("value", e.target.value)} /></div>
            <div className="space-y-1"><Label>Notes</Label><Input placeholder="Optional" value={form.notes || ""} onChange={e => set("notes", e.target.value)} /></div>
            <Button className="w-full" disabled={createAsset.isPending}
              onClick={() => createAsset.mutate({ data: { name: form.name || "Asset", category: (form.category as "cash" | "savings" | "land" | "vehicle" | "investment" | "business" | "property" | "other") || "cash", value: parseFloat(form.value || "0"), notes: form.notes } }, { onSuccess: () => { toast({ title: "Asset added" }); setAssetOpen(false); setForm({}); invalidateAll(); }, onError: () => toast({ title: "Error", variant: "destructive" }) })}>
              {createAsset.isPending ? "Saving..." : "Add Asset"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Liability Dialog */}
      <Dialog open={liabOpen} onOpenChange={setLiabOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Add Liability</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>Name</Label><Input placeholder="e.g. KCB Loan" value={form.name || ""} onChange={e => set("name", e.target.value)} /></div>
            <div className="space-y-1"><Label>Category</Label>
              <Select value={form.category || ""} onValueChange={v => set("category", v)}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>{LIABILITY_CATS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Amount Owed (KES)</Label><Input type="number" placeholder="0" value={form.amount || ""} onChange={e => set("amount", e.target.value)} /></div>
            <div className="space-y-1"><Label>Interest Rate (%)</Label><Input type="number" placeholder="e.g. 14" value={form.interestRate || ""} onChange={e => set("interestRate", e.target.value)} /></div>
            <div className="space-y-1"><Label>Due Date</Label><Input type="date" value={form.dueDate || ""} onChange={e => set("dueDate", e.target.value)} /></div>
            <Button className="w-full" disabled={createLiab.isPending}
              onClick={() => createLiab.mutate({ data: { name: form.name || "Liability", category: (form.category as "loan" | "debt" | "credit" | "bnpl" | "mortgage" | "other") || "loan", amount: parseFloat(form.amount || "0"), interestRate: form.interestRate ? parseFloat(form.interestRate) : undefined, dueDate: form.dueDate || undefined } }, { onSuccess: () => { toast({ title: "Liability added" }); setLiabOpen(false); setForm({}); invalidateAll(); }, onError: () => toast({ title: "Error", variant: "destructive" }) })}>
              {createLiab.isPending ? "Saving..." : "Add Liability"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
