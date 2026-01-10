"use client";

import {
  Shield,
  UserPlus,
  Search,
  MoreVertical,
  Edit,
  Trash2,
  KeyRound,
} from "lucide-react";
import Link from "next/link";

export default function AdminUsersPage() {
  // Placeholder data
  const users = [
    {
      id: "1",
      fullName: "Jan Kowalski",
      email: "jan.kowalski@drawno.pl",
      role: "radny",
      isActive: true,
      lastLogin: "2024-12-27",
    },
    {
      id: "2",
      fullName: "Anna Nowak",
      email: "anna.nowak@drawno.pl",
      role: "admin",
      isActive: true,
      lastLogin: "2024-12-26",
    },
    {
      id: "3",
      fullName: "Piotr Wiśniewski",
      email: "piotr.wisniewski@drawno.pl",
      role: "radny",
      isActive: false,
      lastLogin: "2024-12-20",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shadow-lg">
            <Shield className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-purple-600 to-purple-700 bg-clip-text text-transparent">
              Zarządzanie użytkownikami
            </h1>
            <p className="text-text-secondary mt-2 text-base font-medium">
              Panel administratora - zarządzaj kontami użytkowników
            </p>
          </div>
        </div>
        <Link
          href="/admin/users/new"
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-500 to-purple-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-purple-500/30 hover:from-purple-600 hover:to-purple-700 transition-all duration-200"
        >
          <UserPlus className="h-5 w-5" />
          <span>Dodaj użytkownika</span>
        </Link>
      </div>

      {/* Search and filters */}
      <div className="bg-white rounded-2xl border border-border p-6 shadow-md">
        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-secondary-400" />
            <input
              type="text"
              placeholder="Szukaj użytkowników..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border-2 border-secondary-200 focus:border-primary-500 focus:ring-4 focus:ring-primary-100 transition-all duration-200"
            />
          </div>
          <select className="px-4 py-2.5 rounded-xl border-2 border-secondary-200 focus:border-primary-500 focus:ring-4 focus:ring-primary-100 transition-all duration-200">
            <option>Wszystkie role</option>
            <option>Admin</option>
            <option>Radny</option>
            <option>Gość</option>
          </select>
          <select className="px-4 py-2.5 rounded-xl border-2 border-secondary-200 focus:border-primary-500 focus:ring-4 focus:ring-primary-100 transition-all duration-200">
            <option>Wszystkie statusy</option>
            <option>Aktywni</option>
            <option>Nieaktywni</option>
          </select>
        </div>
      </div>

      {/* Users table */}
      <div className="bg-white rounded-2xl border border-border shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-secondary-50 border-b border-border">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-text uppercase tracking-wide">
                  Użytkownik
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-text uppercase tracking-wide">
                  Email
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-text uppercase tracking-wide">
                  Rola
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-text uppercase tracking-wide">
                  Status
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-text uppercase tracking-wide">
                  Ostatnie logowanie
                </th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-text uppercase tracking-wide">
                  Akcje
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map((user) => (
                <tr
                  key={user.id}
                  className="hover:bg-secondary-50 transition-colors"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center">
                        <span className="text-white font-semibold text-sm">
                          {user.fullName
                            .split(" ")
                            .map((n) => n[0])
                            .join("")}
                        </span>
                      </div>
                      <span className="font-semibold text-text">
                        {user.fullName}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-text-secondary">
                    {user.email}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                        user.role === "admin"
                          ? "bg-purple-100 text-purple-700"
                          : "bg-primary-100 text-primary-700"
                      }`}
                    >
                      {user.role === "admin" ? "Administrator" : "Radny"}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                        user.isActive
                          ? "bg-success/20 text-success"
                          : "bg-secondary-200 text-secondary-700"
                      }`}
                    >
                      {user.isActive ? "Aktywny" : "Nieaktywny"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-text-secondary">
                    {new Date(user.lastLogin).toLocaleDateString("pl-PL")}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        className="p-2 rounded-lg text-secondary-600 hover:bg-secondary-100 transition-colors"
                        title="Edytuj"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        className="p-2 rounded-lg text-secondary-600 hover:bg-secondary-100 transition-colors"
                        title="Resetuj hasło"
                      >
                        <KeyRound className="h-4 w-4" />
                      </button>
                      <button
                        className="p-2 rounded-lg text-danger hover:bg-red-50 transition-colors"
                        title="Usuń"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                      <button className="p-2 rounded-lg text-secondary-600 hover:bg-secondary-100 transition-colors">
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-6 md:grid-cols-3">
        <div className="bg-white rounded-2xl border border-border p-6 shadow-md">
          <p className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-2">
            Wszyscy użytkownicy
          </p>
          <p className="text-4xl font-bold bg-gradient-to-br from-primary-600 to-primary-700 bg-clip-text text-transparent">
            {users.length}
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-border p-6 shadow-md">
          <p className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-2">
            Aktywni użytkownicy
          </p>
          <p className="text-4xl font-bold bg-gradient-to-br from-success to-success/80 bg-clip-text text-transparent">
            {users.filter((u) => u.isActive).length}
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-border p-6 shadow-md">
          <p className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-2">
            Administratorzy
          </p>
          <p className="text-4xl font-bold bg-gradient-to-br from-purple-600 to-purple-700 bg-clip-text text-transparent">
            {users.filter((u) => u.role === "admin").length}
          </p>
        </div>
      </div>
    </div>
  );
}
