import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="h-screen flex flex-col bg-background dark:bg-background-dark overflow-hidden">
      <Header />
      <div className="flex flex-1 min-h-0">
        <Sidebar />
        <main className="flex-1 p-6 md:p-8 overflow-x-hidden overflow-y-auto bg-secondary-50 dark:bg-secondary-900">
          {children}
        </main>
      </div>
    </div>
  );
}
