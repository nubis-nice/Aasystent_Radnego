"use client";

import { useState, useEffect } from "react";
import {
  User,
  Mail,
  Phone,
  Building,
  Save,
  AlertCircle,
  CheckCircle2,
  Users,
  Calendar,
  Shield,
  X,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getUserProfile, updateUserProfile } from "@/lib/supabase/settings";
import { supabase } from "@/lib/supabase/client";

const COUNCIL_ROLES = [
  "Radny",
  "Przewodniczący Rady",
  "Wiceprzewodniczący Rady",
  "Przewodniczący Komisji",
  "Wiceprzewodniczący Komisji",
  "Sekretarz",
];

const COMMON_COMMITTEES = [
  "Komisja Budżetu i Finansów",
  "Komisja Oświaty i Kultury",
  "Komisja Zdrowia i Spraw Społecznych",
  "Komisja Gospodarki Komunalnej",
  "Komisja Rewizyjna",
  "Komisja Skarg, Wniosków i Petycji",
  "Komisja Planowania Przestrzennego",
  "Komisja Rolnictwa i Ochrony Środowiska",
];

export default function ProfilePage() {
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [newCommittee, setNewCommittee] = useState("");
  const [formData, setFormData] = useState({
    fullName: "",
    phone: "",
    position: "",
    department: "",
    roleInCouncil: "",
    committees: [] as string[],
    councilTerm: "",
  });
  const [originalData, setOriginalData] = useState(formData);

  // Pobierz dane użytkownika przy montowaniu
  useEffect(() => {
    async function loadProfile() {
      try {
        // Pobierz ID użytkownika
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          setMessage({ type: "error", text: "Nie jesteś zalogowany" });
          setLoading(false);
          return;
        }

        setUserId(user.id);
        setEmail(user.email || "");

        // Pobierz profil z bazy
        const profile = await getUserProfile(user.id);
        if (profile) {
          const data = {
            fullName: profile.full_name,
            phone: profile.phone || "",
            position: profile.position || "",
            department: profile.department || "",
            roleInCouncil: profile.role_in_council || "",
            committees: profile.committees || [],
            councilTerm: profile.council_term || "",
          };
          setFormData(data);
          setOriginalData(data);
        }
      } catch (error) {
        console.error("Error loading profile:", error);
        setMessage({ type: "error", text: "Błąd podczas ładowania profilu" });
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, []);

  const handleSave = async () => {
    if (!userId) return;

    setSaving(true);
    setMessage(null);

    try {
      console.log("[Profile] Saving data:", {
        role_in_council: formData.roleInCouncil,
        committees: formData.committees,
        council_term: formData.councilTerm,
      });

      const result = await updateUserProfile(userId, {
        full_name: formData.fullName,
        phone: formData.phone || null,
        position: formData.position || null,
        department: formData.department || null,
        role_in_council: formData.roleInCouncil || null,
        committees: formData.committees.length > 0 ? formData.committees : [],
        council_term: formData.councilTerm || null,
      });

      console.log("[Profile] Save result:", result);

      if (result) {
        setOriginalData(formData);
        setMessage({ type: "success", text: "Profil został zaktualizowany" });
        setIsEditing(false);

        // Ukryj komunikat po 3 sekundach
        setTimeout(() => setMessage(null), 3000);
      } else {
        setMessage({ type: "error", text: "Nie udało się zapisać zmian" });
      }
    } catch (error) {
      console.error("Error saving profile:", error);
      setMessage({ type: "error", text: "Wystąpił błąd podczas zapisywania" });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setFormData(originalData);
    setIsEditing(false);
    setMessage(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-text-secondary">Ładowanie profilu...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Message */}
      {message && (
        <div
          className={`rounded-2xl p-4 mb-6 flex items-center gap-3 ${
            message.type === "success"
              ? "bg-success/20 text-success border border-success/30"
              : "bg-danger/20 text-danger border border-danger/30"
          }`}
        >
          {message.type === "success" ? (
            <CheckCircle2 className="h-5 w-5" />
          ) : (
            <AlertCircle className="h-5 w-5" />
          )}
          <p className="font-medium">{message.text}</p>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-primary-600 to-primary-700 bg-clip-text text-transparent">
            Mój profil
          </h1>
          <p className="text-text-secondary mt-2 text-base font-medium">
            Zarządzaj swoimi danymi osobowymi i informacjami kontaktowymi
          </p>
        </div>
        {!isEditing && (
          <Button onClick={() => setIsEditing(true)}>Edytuj profil</Button>
        )}
      </div>

      {/* Profile card */}
      <div className="bg-white dark:bg-secondary-800 rounded-2xl border border-border dark:border-border-dark p-8 shadow-md">
        <div className="flex items-start gap-6 mb-8">
          <div className="h-24 w-24 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center shadow-lg">
            <User className="h-12 w-12 text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-text mb-2">
              {formData.fullName}
            </h2>
            <p className="text-text-secondary font-medium">
              {formData.position}
            </p>
            <p className="text-text-secondary text-sm mt-1">
              {formData.department}
            </p>
          </div>
        </div>

        {/* Form */}
        <div className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <label className="block text-sm font-semibold text-text mb-2">
                <User className="inline h-4 w-4 mr-2" />
                Imię i nazwisko
              </label>
              <Input
                value={formData.fullName}
                onChange={(e) =>
                  setFormData({ ...formData, fullName: e.target.value })
                }
                disabled={!isEditing}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-text mb-2">
                <Mail className="inline h-4 w-4 mr-2" />
                Email
              </label>
              <Input
                type="email"
                value={email}
                disabled
                className="bg-secondary-50"
              />
              <p className="text-xs text-text-secondary mt-1">
                Email nie może być zmieniony
              </p>
            </div>
            <div>
              <label className="block text-sm font-semibold text-text mb-2">
                <Phone className="inline h-4 w-4 mr-2" />
                Telefon
              </label>
              <Input
                type="tel"
                value={formData.phone}
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value })
                }
                disabled={!isEditing}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-text mb-2">
                <Building className="inline h-4 w-4 mr-2" />
                Stanowisko
              </label>
              <Input
                value={formData.position}
                onChange={(e) =>
                  setFormData({ ...formData, position: e.target.value })
                }
                disabled={!isEditing}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-text mb-2">
              Wydział / Jednostka
            </label>
            <Input
              value={formData.department}
              onChange={(e) =>
                setFormData({ ...formData, department: e.target.value })
              }
              disabled={!isEditing}
            />
          </div>
        </div>
      </div>

      {/* Dane radnego */}
      <div className="bg-white dark:bg-secondary-800 rounded-2xl border border-border dark:border-border-dark p-8 shadow-md">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-text">Dane radnego</h2>
              <p className="text-sm text-text-secondary">
                Rola w radzie i przynależność do komisji
              </p>
            </div>
          </div>
          {!isEditing && (
            <Button variant="outline" onClick={() => setIsEditing(true)}>
              Edytuj
            </Button>
          )}
        </div>

        <div className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <label className="block text-sm font-semibold text-text mb-2">
                <Users className="inline h-4 w-4 mr-2" />
                Rola w Radzie
              </label>
              <select
                value={formData.roleInCouncil}
                onChange={(e) =>
                  setFormData({ ...formData, roleInCouncil: e.target.value })
                }
                disabled={!isEditing}
                className="flex h-11 w-full rounded-xl border-2 border-secondary-200 bg-white px-4 py-2.5 text-sm font-medium text-text transition-all duration-200 hover:border-secondary-300 focus-visible:outline-none focus-visible:border-primary-500 focus-visible:ring-4 focus-visible:ring-primary-100 disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-secondary-50"
              >
                <option value="">Wybierz rolę</option>
                {COUNCIL_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-text mb-2">
                <Calendar className="inline h-4 w-4 mr-2" />
                Kadencja
              </label>
              <Input
                value={formData.councilTerm}
                onChange={(e) =>
                  setFormData({ ...formData, councilTerm: e.target.value })
                }
                placeholder="np. 2024-2029"
                disabled={!isEditing}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-text mb-2">
              <Users className="inline h-4 w-4 mr-2" />
              Komisje
            </label>

            {/* Lista obecnych komisji */}
            <div className="flex flex-wrap gap-2 mb-3">
              {formData.committees.length === 0 ? (
                <p className="text-sm text-text-secondary italic">
                  Brak przypisanych komisji
                </p>
              ) : (
                formData.committees.map((committee, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary-100 text-primary-700 text-sm font-medium"
                  >
                    {committee}
                    {isEditing && (
                      <button
                        type="button"
                        onClick={() => {
                          setFormData({
                            ...formData,
                            committees: formData.committees.filter(
                              (_, i) => i !== index
                            ),
                          });
                        }}
                        className="ml-1 hover:text-danger"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </span>
                ))
              )}
            </div>

            {/* Dodawanie komisji */}
            {isEditing && (
              <div className="flex gap-2">
                <select
                  value={newCommittee}
                  onChange={(e) => setNewCommittee(e.target.value)}
                  className="flex-1 h-11 rounded-xl border-2 border-secondary-200 bg-white px-4 text-sm font-medium focus:border-primary-500 focus:ring-4 focus:ring-primary-100"
                >
                  <option value="">Wybierz komisję do dodania</option>
                  {COMMON_COMMITTEES.filter(
                    (c) => !formData.committees.includes(c)
                  ).map((committee) => (
                    <option key={committee} value={committee}>
                      {committee}
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    if (
                      newCommittee &&
                      !formData.committees.includes(newCommittee)
                    ) {
                      setFormData({
                        ...formData,
                        committees: [...formData.committees, newCommittee],
                      });
                      setNewCommittee("");
                    }
                  }}
                  disabled={!newCommittee}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Dodaj
                </Button>
              </div>
            )}
          </div>

          {isEditing && (
            <div className="flex gap-4 pt-4">
              <Button onClick={handleSave} disabled={saving}>
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Zapisywanie...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Zapisz zmiany
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={handleCancel}
                disabled={saving}
              >
                Anuluj
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Account info */}
      <div className="bg-white dark:bg-secondary-800 rounded-2xl border border-border dark:border-border-dark p-8 shadow-md">
        <h2 className="text-xl font-bold text-text mb-6">
          Informacje o koncie
        </h2>
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <p className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-2">
              Data rejestracji
            </p>
            <p className="text-base font-semibold text-text">
              15 stycznia 2024
            </p>
          </div>
          <div>
            <p className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-2">
              Ostatnie logowanie
            </p>
            <p className="text-base font-semibold text-text">Dzisiaj o 14:30</p>
          </div>
          <div>
            <p className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-2">
              Rola w systemie
            </p>
            <p className="text-base font-semibold text-text">Radny Miejski</p>
          </div>
          <div>
            <p className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-2">
              Status konta
            </p>
            <span className="inline-flex items-center px-3 py-1 rounded-full bg-success/20 text-success font-semibold text-sm">
              Aktywne
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
