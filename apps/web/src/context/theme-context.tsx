import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";

type ThemeContextValue = {
  theme: "light";
  resolvedTheme: "light";
  setTheme: (theme: "light" | "dark" | "system") => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

/** Light-only product chrome. Dark mode is intentionally disabled. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    document.documentElement.classList.remove("dark");
    localStorage.setItem("cb_theme", "light");
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme: "light",
      resolvedTheme: "light",
      setTheme: () => {
        document.documentElement.classList.remove("dark");
        localStorage.setItem("cb_theme", "light");
      },
    }),
    [],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) {
    throw new Error("useTheme must be used inside ThemeProvider");
  }
  return value;
}
