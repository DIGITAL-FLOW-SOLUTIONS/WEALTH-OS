import { createContext, useContext, useEffect, ReactNode } from "react";
import { useGetSettings } from "@workspace/api-client-react";
import { setActiveCurrency } from "@/lib/format";

interface SettingsContextValue {
  currency: string;
  emergencyFundTarget: number;
  emergencyFundMonthlyAmount: number;
  theme: string;
  isLoaded: boolean;
}

const SettingsContext = createContext<SettingsContextValue>({
  currency: "KES",
  emergencyFundTarget: 6,
  emergencyFundMonthlyAmount: 0,
  theme: "dark",
  isLoaded: false,
});

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { data: settings } = useGetSettings();

  useEffect(() => {
    if (settings) {
      setActiveCurrency(settings.currency);
      if (settings.theme === "light") {
        document.documentElement.classList.remove("dark");
      } else {
        document.documentElement.classList.add("dark");
      }
    }
  }, [settings]);

  return (
    <SettingsContext.Provider
      value={{
        currency: settings?.currency ?? "KES",
        emergencyFundTarget: settings?.emergencyFundMonths ?? 6,
        emergencyFundMonthlyAmount: settings?.emergencyFundMonthlyAmount ?? 0,
        theme: settings?.theme ?? "dark",
        isLoaded: !!settings,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  return useContext(SettingsContext);
}
