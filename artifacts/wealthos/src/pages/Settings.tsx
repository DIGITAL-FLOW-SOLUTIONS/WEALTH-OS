import {
  useGetSettings, useUpdateSettings,
  getGetSettingsQueryKey, getGetDashboardSummaryQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Save, Info } from "lucide-react";

const CURRENCIES = ["KES", "USD", "EUR", "GBP", "UGX", "TZS", "ZAR"];

export default function Settings() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: settings, isLoading } = useGetSettings();
  const update = useUpdateSettings();

  const [form, setForm] = useState({
    currency: "KES",
    emergencyFundMonths: "6",
    usdConversionRate: "130",
    theme: "dark",
  });

  useEffect(() => {
    if (settings) {
      setForm({
        currency: settings.currency,
        emergencyFundMonths: String(settings.emergencyFundMonths),
        usdConversionRate: String(settings.usdConversionRate),
        theme: settings.theme,
      });
    }
  }, [settings]);

  const handleSave = () => {
    update.mutate({
      data: {
        currency: form.currency,
        emergencyFundMonths: parseFloat(form.emergencyFundMonths),
        usdConversionRate: parseFloat(form.usdConversionRate),
        theme: form.theme,
      },
    }, {
      onSuccess: () => {
        toast({ title: "Settings saved" });
        qc.invalidateQueries({ queryKey: getGetSettingsQueryKey() });
        qc.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
      },
      onError: () => toast({ title: "Error saving settings", variant: "destructive" }),
    });
  };

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Customize your WealthOS experience</p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
        </div>
      ) : (
        <>
          {/* Currency */}
          <div className="card-glass p-5 space-y-4">
            <h2 className="text-sm font-semibold">Currency & Locale</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Default Currency</Label>
                <Select value={form.currency} onValueChange={v => setForm(f => ({ ...f, currency: v }))}>
                  <SelectTrigger data-testid="select-currency"><SelectValue /></SelectTrigger>
                  <SelectContent>{CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Used for all currency displays throughout the app</p>
              </div>
              <div className="space-y-1.5">
                <Label>USD Conversion Rate (1 USD = ? {form.currency})</Label>
                <Input
                  data-testid="input-usd-rate"
                  type="number"
                  value={form.usdConversionRate}
                  onChange={e => setForm(f => ({ ...f, usdConversionRate: e.target.value }))}
                  placeholder="130"
                />
                <p className="text-xs text-muted-foreground">For USD-denominated investments</p>
              </div>
            </div>
          </div>

          {/* Emergency Fund */}
          <div className="card-glass p-5 space-y-4">
            <h2 className="text-sm font-semibold">Emergency Fund Target</h2>
            <div className="space-y-1.5">
              <Label>Target Months of Coverage</Label>
              <Input
                data-testid="input-emergency-months"
                type="number"
                value={form.emergencyFundMonths}
                onChange={e => setForm(f => ({ ...f, emergencyFundMonths: e.target.value }))}
                placeholder="6"
                min="1"
                max="24"
              />
              <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <p className="text-xs text-blue-300/80 leading-relaxed">
                  Financial experts recommend keeping 3–6 months of living expenses in an accessible savings account for emergencies. Set to 6 if you have dependents or variable income.
                </p>
              </div>
            </div>
          </div>

          {/* Appearance */}
          <div className="card-glass p-5 space-y-4">
            <h2 className="text-sm font-semibold">Appearance</h2>
            <div className="space-y-1.5">
              <Label>Theme</Label>
              <Select value={form.theme} onValueChange={v => setForm(f => ({ ...f, theme: v }))}>
                <SelectTrigger data-testid="select-theme"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="dark">Dark (Premium)</SelectItem>
                  <SelectItem value="light">Light</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* About */}
          <div className="card-glass p-5 space-y-2">
            <h2 className="text-sm font-semibold">About WealthOS</h2>
            <div className="space-y-1 text-xs text-muted-foreground">
              <p>Version 1.0.0</p>
              <p>Single-user personal finance dashboard</p>
              <p>Default currency: KES (Kenyan Shilling)</p>
              <p>Data stored locally in PostgreSQL</p>
            </div>
          </div>

          <Button onClick={handleSave} disabled={update.isPending} className="gap-2 w-full sm:w-auto" data-testid="button-save-settings">
            <Save className="w-4 h-4" />
            {update.isPending ? "Saving..." : "Save Settings"}
          </Button>
        </>
      )}
    </div>
  );
}
