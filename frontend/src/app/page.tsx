import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { AppFooter } from "@/components/AppFooter";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex-1">
        <DashboardShell />
      </div>
      <AppFooter />
    </div>
  );
}