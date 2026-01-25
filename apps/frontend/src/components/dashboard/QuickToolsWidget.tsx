"use client";

import { useRouter } from "next/navigation";
import {
  FileEdit,
  FileText,
  Search,
  BarChart3,
  Scale,
  Wallet,
  Mic,
  ClipboardList,
} from "lucide-react";

interface QuickTool {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  action: () => void;
}

export function QuickToolsWidget() {
  const router = useRouter();

  const tools: QuickTool[] = [
    {
      id: "interpellation",
      label: "Nowa interpelacja",
      description: "Kreator interpelacji radnego",
      icon: <FileEdit className="h-5 w-5" />,
      color: "from-purple-500 to-purple-600",
      action: () => router.push("/chat?tool=interpelation"),
    },
    {
      id: "protocol",
      label: "Generator protokołu",
      description: "AI tworzy protokół z notatek",
      icon: <FileText className="h-5 w-5" />,
      color: "from-blue-500 to-blue-600",
      action: () => router.push("/chat?tool=protocol"),
    },
    {
      id: "search",
      label: "Szukaj w dokumentach",
      description: "Przeszukaj bazę dokumentów",
      icon: <Search className="h-5 w-5" />,
      color: "from-emerald-500 to-emerald-600",
      action: () => router.push("/documents"),
    },
    {
      id: "report",
      label: "Raport dla komisji",
      description: "Generuj raport z dokumentów",
      icon: <BarChart3 className="h-5 w-5" />,
      color: "from-orange-500 to-orange-600",
      action: () => router.push("/chat?tool=report"),
    },
    {
      id: "legal",
      label: "Analiza prawna",
      description: "Sprawdź zgodność z przepisami",
      icon: <Scale className="h-5 w-5" />,
      color: "from-indigo-500 to-indigo-600",
      action: () => router.push("/chat?tool=resolution"),
    },
    {
      id: "budget",
      label: "Kontrola budżetu",
      description: "Analiza wydatków i wykonania",
      icon: <Wallet className="h-5 w-5" />,
      color: "from-yellow-500 to-yellow-600",
      action: () => router.push("/chat?tool=budget"),
    },
    {
      id: "speech",
      label: "Wystąpienie na sesji",
      description: "Przygotuj projekt wystąpienia",
      icon: <Mic className="h-5 w-5" />,
      color: "from-pink-500 to-pink-600",
      action: () => router.push("/chat?tool=speech"),
    },
    {
      id: "letter",
      label: "Pismo urzędowe",
      description: "Generator pism i wniosków",
      icon: <ClipboardList className="h-5 w-5" />,
      color: "from-teal-500 to-teal-600",
      action: () => router.push("/chat?tool=letter"),
    },
  ];

  return (
    <div className="h-full flex flex-col bg-white rounded-2xl border border-border shadow-md overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border bg-gradient-to-r from-secondary-50 to-white shrink-0">
        <h3 className="font-bold text-text flex items-center gap-2">
          🛠️ Szybkie narzędzia
        </h3>
        <p className="text-xs text-text-secondary mt-1">
          Kliknij, aby uruchomić
        </p>
      </div>

      {/* Tools Grid */}
      <div className="p-4 grid grid-cols-2 gap-3 flex-1 overflow-y-auto">
        {tools.map((tool) => (
          <button
            key={tool.id}
            onClick={tool.action}
            className="group flex items-start gap-3 p-3 rounded-xl border border-secondary-200 bg-white hover:border-primary-300 hover:shadow-md transition-all text-left"
          >
            <div
              className={`
                flex-shrink-0 h-10 w-10 rounded-lg bg-gradient-to-br ${tool.color}
                flex items-center justify-center text-white
                group-hover:scale-110 transition-transform
              `}
            >
              {tool.icon}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-sm text-text truncate">
                {tool.label}
              </p>
              <p className="text-xs text-text-secondary truncate">
                {tool.description}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
