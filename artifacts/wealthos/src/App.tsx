import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useEffect } from "react";
import Layout from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import Transactions from "@/pages/Transactions";
import Analytics from "@/pages/Analytics";
import Budget from "@/pages/Budget";
import Goals from "@/pages/Goals";
import AssetsLiabilities from "@/pages/AssetsLiabilities";
import NetWorth from "@/pages/NetWorth";
import Investments from "@/pages/Investments";
import Reports from "@/pages/Reports";
import Settings from "@/pages/Settings";
import Auth from "@/pages/Auth";
import NotFound from "@/pages/not-found";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { SettingsProvider } from "@/context/SettingsContext";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import { getSupabase } from "@/lib/supabase";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

setAuthTokenGetter(async () => {
  try {
    const { data: { session } } = await getSupabase().auth.getSession();
    return session?.access_token ?? null;
  } catch {
    return null;
  }
});

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0f1c] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
          <p className="text-slate-400 text-sm">Loading WealthOS…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Auth />;
  }

  return (
    <SettingsProvider>
      <Layout>
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/transactions" component={Transactions} />
          <Route path="/analytics" component={Analytics} />
          <Route path="/budget" component={Budget} />
          <Route path="/goals" component={Goals} />
          <Route path="/assets-liabilities" component={AssetsLiabilities} />
          <Route path="/net-worth" component={NetWorth} />
          <Route path="/investments" component={Investments} />
          <Route path="/reports" component={Reports} />
          <Route path="/settings" component={Settings} />
          <Route component={NotFound} />
        </Switch>
      </Layout>
    </SettingsProvider>
  );
}

function App() {
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <AppRoutes />
          </WouterRouter>
          <Toaster />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
