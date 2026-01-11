import { FileText, Menu } from "lucide-react";

export function Header() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border dark:border-border-dark bg-white dark:bg-secondary-900 shadow-sm backdrop-blur-sm bg-white/95 dark:bg-secondary-900/95">
      <div className="flex h-10 items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-4 md:hidden">
          {/* Mobile menu button */}
          <button className="text-secondary-600 hover:text-secondary-900 hover:bg-secondary-50 p-1.5 rounded-lg transition-colors">
            <span className="sr-only">Menu</span>
            <Menu className="h-5 w-5" />
          </button>
        </div>

        <div className="flex items-center gap-2 font-bold text-lg md:hidden">
          <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-md">
            <FileText className="h-4 w-4 text-white" />
          </div>
          <span className="bg-gradient-to-r from-primary-600 to-primary-700 bg-clip-text text-transparent">
            Asystent
          </span>
        </div>

        {/* Pusty div dla zachowania layoutu */}
        <div className="flex-1"></div>
      </div>
    </header>
  );
}
