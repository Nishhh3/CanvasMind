import { Plus, Upload } from "lucide-react";
import { Button } from "@/components/ui/Button";

type WelcomeSectionProps = {
    onNewProject: () => void;
    onImport: () => void;
};

export function WelcomeSection({ onNewProject, onImport }: WelcomeSectionProps) {
    return (
        <section className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-accent">Your learning workspace</p>
                <h2 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">Welcome back</h2>
                <p className="mt-2 max-w-xl text-sm text-ink-soft sm:text-base">
                    Pick up where you left off, or start a fresh canvas for your next topic.
                </p>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                <Button variant="primary" onClick={onNewProject} className="h-11 w-full px-5 sm:w-auto">
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Create a project
                </Button>
                <Button onClick={onImport} className="h-11 w-full sm:w-auto">
                    <Upload className="h-4 w-4" aria-hidden="true" />
                    Import notes
                </Button>
            </div>
        </section>
    );
}