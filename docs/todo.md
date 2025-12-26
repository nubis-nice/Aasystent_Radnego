# TODO (produkt + technologia)

## MVP (Etap 1–2)
- [ ] Potwierdzić źródła dokumentów dla Drawna (BIP/system „Rada”) i metodę pobierania.
- [ ] Zdefiniować kontrakt `Document`/`Metadata` (Zod) i strategię deduplikacji (hash + URL).
- [ ] Utworzyć **Frontend** (panel webowy + czat) jako osobną aplikację.
- [ ] Utworzyć **Backend API** (REST) jako osobny serwis.
- [ ] Utworzyć **Backend Worker** jako odseparowany proces/usługę (kolejka zadań BullMQ/Redis) do ekstrakcji treści multimodalnej, analiz, embeddingów, raportów, transkrypcji.
- [ ] Pipeline: pobranie -> ekstrakcja treści multimodalna (PDF/skan) -> zapis tekstu -> metadane.
- [ ] Streszczenie + kluczowe punkty (OpenAI, `temperature=0`).
- [ ] Chunking + embedding + indeks pgvector.
- [ ] Q&A z cytatami (RAG).
- [ ] Panel: lista dokumentów + podgląd + wynik analizy.

## Sesje rady (audio/wideo)
- [ ] Ustalić źródło nagrań sesji (BIP/transmisje/YouTube/pliki) i sposób pobierania.
- [ ] Transkrypcja nagrań sesji (ASR) + segmentacja czasowa.
- [ ] Generowanie scenopisów sesji na bazie transkryptu (krótki i szczegółowy).
- [ ] Indeksowanie transkryptów do wyszukiwania i Q&A.

## Etap 3 (powiązania i zmiany)
- [ ] Wykrywanie odniesień do innych uchwał (regex + analiza kontekstu).
- [ ] Linkowanie „zmienia/uchyla/wykonuje”.
- [ ] Porównywanie wersji / projekt vs uchwała.

## Etap 4 (ryzyka)
- [ ] `legal_risk_scan` – sygnały/heurystyki + cytaty.
- [ ] Repozytorium wiedzy prawnej (zakres do ustalenia).

## Etap 5 (raporty)
- [ ] Raport tygodniowy/miesięczny.
- [ ] Brief na sesję/komisję.
- [ ] Alerty o nowych dokumentach i wysokim ryzyku.
