import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <div className="flex flex-1 items-start">
        <Sidebar />
        <main className="flex-1 p-6 md:p-8 overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}
