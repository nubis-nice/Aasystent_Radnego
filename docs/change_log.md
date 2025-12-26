# Change Log

## 2025-12-26
- Dodano `docs/PLAN_BUDOWY_AGENTA_AI.md` (plan budowy agenta analizy dokumentów Rady).
- Zaktualizowano plan o:
  - OpenAI jako warstwę LLM
  - konfigurację API przez zmienne środowiskowe (bez klucza w repo)
  - projekt narzędzi (tool calling) dla zadań Radnego
  - rozdzielenie systemu na Frontend oraz Backend (API + odseparowany Worker)
  - zastąpienie OCR ekstrakcją treści multimodalnym LLM
  - dodanie funkcji transkrypcji nagrań sesji rady oraz generowania scenopisów
- Dodano dokumentację w `/docs`:
  - `architecture.md`
  - `todo.md`
  - `change_log.md`
