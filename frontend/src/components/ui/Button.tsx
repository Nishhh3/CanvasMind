import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { Spinner } from "./Spinner";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "icon";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: Variant;
    size?: Size;
    loading?: boolean;
}

const base =
    "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-ctl font-medium transition-all duration-150 focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:ring-offset-1 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50";

const variants: Record<Variant, string> = {
    primary: "bg-accent text-white shadow-sm hover:bg-accent-hover",
    secondary: "border border-line bg-surface text-ink shadow-sm hover:border-line-strong hover:bg-surface-muted",
    ghost: "text-ink-soft hover:bg-surface-muted hover:text-ink",
    danger: "bg-danger text-white hover:opacity-90",
};

const sizes: Record<Size, string> = {
    sm: "h-8 px-3 text-sm",
    md: "h-10 px-4 text-sm",
    icon: "h-9 w-9",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
    { variant = "secondary", size = "md", loading = false, className, disabled, children, type = "button", ...rest },
    ref,
) {
    return (
        <button
            ref={ref}
            type={type}
            disabled={disabled || loading}
            aria-busy={loading || undefined}
            className={cn(base, variants[variant], sizes[size], className)}
            {...rest}
        >
            {loading && <Spinner />}
            {!(loading && size === "icon") && children}
        </button>
    );
});