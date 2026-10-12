"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

type Theme = "light" | "dark";

type ThemeContextValue = {
    theme: Theme;
    toggleTheme: () => void;
};

const STORAGE_KEY = "studycanvas-theme";
const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyTheme(theme: Theme) {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
    const [theme, setTheme] = useState<Theme>(() =>
        typeof document !== "undefined" && document.documentElement.dataset.theme === "dark" ? "dark" : "light",
    );

    const toggleTheme = useCallback(() => {
        setTheme((current) => {
            const nextTheme = current === "light" ? "dark" : "light";
            window.localStorage.setItem(STORAGE_KEY, nextTheme);
            applyTheme(nextTheme);
            return nextTheme;
        });
    }, []);

    const value = useMemo(() => ({ theme, toggleTheme }), [theme, toggleTheme]);

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
    const context = useContext(ThemeContext);
    if (!context) throw new Error("useTheme must be used within ThemeProvider");
    return context;
}
