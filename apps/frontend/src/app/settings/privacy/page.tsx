"use client";

import { Shield } from "lucide-react";

export default function PrivacyPage() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-primary-600 to-primary-700 bg-clip-text text-transparent">
          Prywatność
        </h1>
        <p className="text-text-secondary mt-2 text-base font-medium">
          Zarządzaj ustawieniami prywatności i danymi osobowymi
        </p>
      </div>

      {/* Coming soon */}
      <div className="bg-white dark:bg-secondary-800 rounded-2xl border border-border dark:border-border-dark p-12 text-center">
        <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center mx-auto mb-4">
          <Shield className="h-10 w-10 text-white" />
        </div>
        <h3 className="text-xl font-bold text-text mb-2">Wkrótce dostępne</h3>
        <p className="text-text-secondary">
          Funkcja ustawień prywatności jest w przygotowaniu
        </p>
      </div>
    </div>
  );
}
