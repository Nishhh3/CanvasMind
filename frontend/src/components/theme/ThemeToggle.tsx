"use client";

import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/Button";
import { useTheme } from "./ThemeProvider";

const subscribe = () => () => {};

export function ThemeToggle() {
    const { theme, toggleTheme } = useTheme();
    const mounted = useSyncExternalStore(subscribe, () => true, () => false);
    const isDark = mounted && theme === "dark";
    const label = isDark ? "Switch to light mode" : "Switch to dark mode";

    return (
        <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            aria-label={label}
            title={label}
        >
            {isDark ? <Sun className="h-4 w-4" aria-hidden="true" /> : <Moon className="h-4 w-4" aria-hidden="true" />}
        </Button>
    );
}
