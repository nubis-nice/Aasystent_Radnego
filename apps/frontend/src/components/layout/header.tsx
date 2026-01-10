import { FileText, Bell, Menu } from "lucide-react";

export function Header() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border dark:border-border-dark bg-white dark:bg-secondary-900 shadow-sm backdrop-blur-sm bg-white/95 dark:bg-secondary-900/95">
      <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-4 md:hidden">
          {/* Mobile menu button */}
          <button className="text-secondary-600 hover:text-secondary-900 hover:bg-secondary-50 p-2 rounded-lg transition-colors">
            <span className="sr-only">Menu</span>
            <Menu className="h-6 w-6" />
          </button>
        </div>

        <div className="flex items-center gap-3 font-bold text-xl md:hidden">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-lg">
            <FileText className="h-5 w-5 text-white" />
          </div>
          <span className="bg-gradient-to-r from-primary-600 to-primary-700 bg-clip-text text-transparent">
            Asystent
          </span>
        </div>

        <div className="flex flex-1 items-center justify-end gap-3">
          <button className="relative rounded-xl p-2.5 text-secondary-600 hover:bg-secondary-50 hover:text-secondary-900 transition-all duration-200">
            <span className="sr-only">Powiadomienia</span>
            <Bell className="h-5 w-5" />
            <span className="absolute top-1.5 right-1.5 h-2.5 w-2.5 rounded-full bg-danger ring-2 ring-white"></span>
          </button>
        </div>
      </div>
    </header>
  );
}
