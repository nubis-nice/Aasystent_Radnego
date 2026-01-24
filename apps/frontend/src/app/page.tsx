import Link from "next/link";
import {
  FileText,
  Search,
  MessageSquare,
  ShieldCheck,
  ArrowRight,
  Database,
  Activity,
} from "lucide-react";
import { SystemStatusLinks } from "@/components/SystemStatusLinks";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground font-sans">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-xl text-primary">
            <FileText className="h-6 w-6" />
            <span>Asystent Radnego</span>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-muted-foreground">
            <a
              href="#features"
              className="hover:text-foreground transition-colors"
            >
              Funkcje
            </a>
            <a
              href="#about"
              className="hover:text-foreground transition-colors"
            >
              O projekcie
            </a>
            <a
              href="#contact"
              className="hover:text-foreground transition-colors"
            >
              Kontakt
            </a>
          </nav>
          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary-hover rounded-md transition-colors shadow-sm"
            >
              Zaloguj się
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="py-20 md:py-32 border-b border-border bg-gradient-to-b from-surface to-background">
          <div className="container mx-auto px-4 text-center">
            <div className="inline-flex items-center rounded-full border border-border bg-surface px-3 py-1 text-sm text-secondary mb-8">
              <span className="flex h-2 w-2 rounded-full bg-green-500 mr-2"></span>
              System gotowy do pracy
            </div>
            <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-text mb-6 max-w-4xl mx-auto leading-tight">
              Nowoczesne narzędzie dla{" "}
              <span className="text-primary">Rady Miejskiej</span>
            </h1>
            <p className="text-xl text-secondary mb-10 max-w-2xl mx-auto leading-relaxed">
              Wyszukuj, analizuj i pracuj z dokumentami szybciej niż
              kiedykolwiek. Twój osobisty asystent AI do spraw samorządowych.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/login"
                className="w-full sm:w-auto px-8 py-4 text-base font-semibold text-white bg-primary hover:bg-primary-hover rounded-lg transition-all shadow-lg hover:shadow-primary/25 flex items-center justify-center gap-2"
              >
                Rozpocznij pracę
                <ArrowRight className="h-5 w-5" />
              </Link>
              <a
                href="#features"
                className="w-full sm:w-auto px-8 py-4 text-base font-semibold text-text bg-white border border-border hover:bg-surface rounded-lg transition-colors flex items-center justify-center"
              >
                Dowiedz się więcej
              </a>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-20 bg-background">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold text-text mb-4">
                Wszystko czego potrzebujesz
              </h2>
              <p className="text-lg text-secondary max-w-2xl mx-auto">
                Zintegrowany zestaw narzędzi zaprojektowany specjalnie dla
                potrzeb radnych i urzędników.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {/* Feature 1 */}
              <div className="p-6 rounded-xl border border-border bg-surface hover:shadow-md transition-shadow">
                <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center mb-4">
                  <Search className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-semibold mb-2 text-text">
                  Hybrydowe wyszukiwanie RAG
                </h3>
                <p className="text-secondary">
                  Łączy fulltext, wektory i źródła zewnętrzne (ISAP, BIP,
                  Youtube sesji) w jednym zapytaniu. Cytuje konkretny fragment
                  źródła.
                </p>
              </div>

              {/* Feature 2 */}
              <div className="p-6 rounded-xl border border-border bg-surface hover:shadow-md transition-shadow">
                <div className="w-12 h-12 bg-green-100 text-green-600 rounded-lg flex items-center justify-center mb-4">
                  <FileText className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-semibold mb-2 text-text">
                  Automatyczna analiza dokumentów
                </h3>
                <p className="text-secondary">
                  Streszczenia, klasyfikacja, wyciąganie referencji i embeddingi
                  do pgvector. Wsparcie dla skanów (OCR + Vision) i długich PDF.
                </p>
              </div>

              {/* Feature 3 */}
              <div className="p-6 rounded-xl border border-border bg-surface hover:shadow-md transition-shadow">
                <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-lg flex items-center justify-center mb-4">
                  <MessageSquare className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-semibold mb-2 text-text">
                  Czat z dokumentami i sesjami
                </h3>
                <p className="text-secondary">
                  Pytaj naturalnie, otrzymuj odpowiedzi z cytatem. Rozpoznaje
                  numer sesji, druki, protokoły i załączniki, podpowiada źródła.
                </p>
              </div>

              {/* Feature 4 */}
              <div className="p-6 rounded-xl border border-border bg-surface hover:shadow-md transition-shadow">
                <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-lg flex items-center justify-center mb-4">
                  <Database className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-semibold mb-2 text-text">
                  Integracje i źródła danych
                </h3>
                <p className="text-secondary">
                  BIP, ISAP, RIO, GUS/BDL, KRS/CEIDG, Geoportal, EU Fundusze,
                  YouTube sesji. Automatyczny scraping i import kalendarza
                  sesji.
                </p>
              </div>

              {/* Feature 5 */}
              <div className="p-6 rounded-xl border border-border bg-surface hover:shadow-md transition-shadow">
                <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-lg flex items-center justify-center mb-4">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-semibold mb-2 text-text">
                  Narzędzia AI dla radnego
                </h3>
                <p className="text-secondary">
                  Kreatory interpelacji, pism, wystąpień, protokołów i analiz
                  budżetu. Orkiestrator narzędzi dobiera odpowiedni tryb (RAG,
                  deep research, reasoning).
                </p>
              </div>

              {/* Feature 6 */}
              <div className="p-6 rounded-xl border border-border bg-surface hover:shadow-md transition-shadow">
                <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center mb-4">
                  <Activity className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-semibold mb-2 text-text">
                  Kalendarz, zadania, głos i alerty
                </h3>
                <p className="text-secondary">
                  Widżet kalendarza z auto-importem sesji i komisji, lista
                  zadań, powiadomienia o błędach, sterowanie głosowe Stefanem
                  (dodaj spotkanie, pokaż zadania, nawiguj po aplikacji).
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Tech/Dev Section */}
        <section className="py-12 border-t border-border bg-surface/50">
          <div className="container mx-auto px-4">
            <SystemStatusLinks />
            <div className="text-sm text-secondary flex items-center gap-2 opacity-75 mt-4 md:mt-0">
              <ShieldCheck className="h-4 w-4" />
              <span>Bezpieczny dostęp do danych publicznych i urzędowych</span>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-background py-12">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div className="col-span-1 md:col-span-2">
              <div className="flex items-center gap-2 font-bold text-xl text-primary mb-4">
                <FileText className="h-6 w-6" />
                <span>Asystent Radnego</span>
              </div>
              <p className="text-secondary max-w-sm">
                Kompleksowe narzędzie wspierające pracę radnych miejskich
                poprzez wykorzystanie sztucznej inteligencji.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-text mb-4">Platforma</h4>
              <ul className="space-y-2 text-sm text-secondary">
                <li>
                  <a href="#" className="hover:text-primary transition-colors">
                    Logowanie
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-primary transition-colors">
                    Rejestracja
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-primary transition-colors">
                    Dokumentacja
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-text mb-4">Pomoc</h4>
              <ul className="space-y-2 text-sm text-secondary">
                <li>
                  <a href="#" className="hover:text-primary transition-colors">
                    FAQ
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-primary transition-colors">
                    Wsparcie techniczne
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-primary transition-colors">
                    Kontakt
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-border text-center text-sm text-secondary">
            <p>&copy; 2025 Asystent Radnego. Wszelkie prawa zastrzeżone.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
