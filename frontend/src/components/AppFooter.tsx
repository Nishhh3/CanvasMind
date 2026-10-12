const AUTHORS = ["Nishant Chauhan", "Nikhil Anumalla", "Sneha Edugunoori"];
const YEAR = 2026;

export function AppFooter() {
    return (
        <footer className="shrink-0 border-t border-line bg-surface px-4 py-4 text-center text-xs text-ink-faint">
            <p>
                <span className="font-medium text-ink-soft">AlgoArtisans&trade;</span>
                <span aria-hidden="true"> &ndash; </span>
                {AUTHORS.join(", ")}
            </p>
            <p className="mt-1">&copy; {YEAR} AlgoArtisans. All rights reserved.</p>
        </footer>
    );
}