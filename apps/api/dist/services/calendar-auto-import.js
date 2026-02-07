/**
 * Auto-import wydarzeń do kalendarza z przetworzonych dokumentów
 * Automatycznie tworzy wydarzenia gdy scrapowane są dokumenty sesji/komisji
 * Używa AI do ekstrakcji daty, godziny i miejsca z treści dokumentu
 */
import { createClient } from "@supabase/supabase-js";
import { getLLMClient, getAIConfig } from "../ai/index.js";
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
/**
 * Automatycznie tworzy wydarzenie w kalendarzu dla dokumentów sesji/komisji
 */
export async function autoImportToCalendar(doc) {
    // Sprawdź czy tytuł wskazuje na sesję/komisję (niezależnie od document_type)
    const titleLower = doc.title.toLowerCase();
    const isSessionByTitle = titleLower.includes("sesja") ||
        titleLower.includes("posiedzenie") ||
        titleLower.includes("obrady");
    const isCommitteeByTitle = titleLower.includes("komisj") || titleLower.includes("komitet");
    // Mapowanie document_type na event_type
    const eventTypes = {
        session: "session",
        protocol: "session",
        committee: "committee",
        session_agenda: "session",
        session_protocol: "session",
        committee_meeting: "committee",
        commission_protocol: "committee",
        article: isSessionByTitle
            ? "session"
            : isCommitteeByTitle
                ? "committee"
                : undefined,
    };
    let eventType = eventTypes[doc.document_type];
    // Fallback: jeśli tytuł wskazuje na sesję/komisję, użyj tego
    if (!eventType && isSessionByTitle) {
        eventType = "session";
    }
    else if (!eventType && isCommitteeByTitle) {
        eventType = "committee";
    }
    if (!eventType) {
        return; // Nie jest to dokument sesji/komisji
    }
    // Sprawdź czy wydarzenie już istnieje dla tego dokumentu
    const { data: existingByDoc } = await supabase
        .from("user_calendar_events")
        .select("id")
        .eq("user_id", doc.user_id)
        .eq("document_id", doc.id)
        .single();
    if (existingByDoc) {
        console.log(`[CalendarAutoImport] Event already exists for document ${doc.id}`);
        return;
    }
    // Użyj AI do ekstrakcji daty, godziny, miejsca i reasoning
    let extractedInfo = {};
    if (doc.content) {
        try {
            extractedInfo = await extractEventInfoWithAI(doc.user_id, doc.title, doc.content);
            console.log(`[CalendarAutoImport] AI extracted:`, extractedInfo);
            // Wymóg: reasoning musi wskazywać że to obowiązek radnego
            if (!extractedInfo.reasoning || !extractedInfo.isCouncilDuty) {
                console.log(`[CalendarAutoImport] Skipping - not confirmed as council duty: ${doc.title}`);
                return;
            }
        }
        catch (aiError) {
            console.warn(`[CalendarAutoImport] AI extraction failed:`, aiError);
            return; // Nie importuj bez AI validation
        }
    }
    else {
        console.log(`[CalendarAutoImport] Skipping - no content to analyze: ${doc.title}`);
        return;
    }
    // Wyodrębnij datę wydarzenia - TYLKO z AI (inteligentny scraping)
    // Usunięto fallback na regex - dane muszą pochodzić z analizy AI
    let eventDate = null;
    if (extractedInfo.date) {
        eventDate = new Date(extractedInfo.date);
        // Ustaw godzinę z AI jeśli dostępna
        if (extractedInfo.time) {
            const [hours, minutes] = extractedInfo.time.split(":").map(Number);
            eventDate.setHours(hours, minutes, 0, 0);
        }
    }
    // Wymóg: data MUSI być wyodrębniona przez AI
    if (!eventDate || isNaN(eventDate.getTime())) {
        console.log(`[CalendarAutoImport] Skipping - AI nie znalazło daty dla: ${doc.title}`);
        return;
    }
    // Wymóg: godzina MUSI być wyodrębniona przez AI
    if (!extractedInfo.time) {
        console.log(`[CalendarAutoImport] Skipping - no time found for: ${doc.title}`);
        return;
    }
    // Wymóg: miejsce MUSI być wyodrębnione
    if (!extractedInfo.location) {
        console.log(`[CalendarAutoImport] Skipping - no location found for: ${doc.title}`);
        return;
    }
    // Przygotuj tytuł wydarzenia
    const eventTitle = formatEventTitle(doc.title, doc.session_number, eventType);
    // Sprawdź duplikaty przez tytuł, datę i miejsce (nie tylko document_id)
    const eventDateStr = eventDate.toISOString().split("T")[0];
    const { data: duplicateCheck } = await supabase
        .from("user_calendar_events")
        .select("id, title, start_date, location")
        .eq("user_id", doc.user_id)
        .gte("start_date", `${eventDateStr}T00:00:00Z`)
        .lte("start_date", `${eventDateStr}T23:59:59Z`);
    if (duplicateCheck && duplicateCheck.length > 0) {
        for (const existing of duplicateCheck) {
            const titleSimilar = existing.title.toLowerCase() === eventTitle.toLowerCase() ||
                existing.title
                    .toLowerCase()
                    .includes(eventTitle.toLowerCase().substring(0, 20));
            const locationSimilar = existing.location &&
                extractedInfo.location &&
                existing.location.toLowerCase() ===
                    extractedInfo.location.toLowerCase();
            if (titleSimilar && locationSimilar) {
                console.log(`[CalendarAutoImport] Skipping - duplicate event detected: ${eventTitle} on ${eventDateStr}`);
                return;
            }
        }
    }
    // Utwórz wydarzenie
    const { error } = await supabase.from("user_calendar_events").insert({
        user_id: doc.user_id,
        title: eventTitle,
        description: `Automatycznie zaimportowano z dokumentu: ${doc.title}`,
        event_type: eventType,
        start_date: eventDate.toISOString(),
        all_day: false,
        location: extractedInfo.location || null,
        document_id: doc.id,
        source_url: doc.source_url,
        reminder_minutes: [1440, 60], // 1 dzień i 1 godzina przed
        color: eventType === "session" ? "purple" : "blue",
        is_auto_imported: true,
        metadata: {
            document_type: doc.document_type,
            session_number: doc.session_number,
            ai_extracted: extractedInfo,
            reasoning: extractedInfo.reasoning,
            verified_at: new Date().toISOString(),
        },
    });
    if (error) {
        console.error(`[CalendarAutoImport] Failed to create event:`, error);
    }
    else {
        console.log(`[CalendarAutoImport] Created event: ${eventTitle} for ${eventDate.toISOString()}${extractedInfo.location ? ` at ${extractedInfo.location}` : ""}`);
    }
}
/**
 * Używa AI do ekstrakcji daty, godziny i miejsca z treści dokumentu
 */
async function extractEventInfoWithAI(userId, title, content) {
    const llm = await getLLMClient(userId);
    const config = await getAIConfig(userId, "llm");
    // Użyj tylko pierwszych 3000 znaków treści dla wydajności
    const truncatedContent = content.substring(0, 3000);
    const prompt = `Przeanalizuj poniższy dokument i wyodrębnij informacje o wydarzeniu.

TYTUŁ: ${title}

TREŚĆ:
${truncatedContent}

Wyodrębnij:
1. DATE - DOKŁADNĄ datę wydarzenia w formacie YYYY-MM-DD (np. 2026-01-14)
2. TIME - DOKŁADNĄ godzinę rozpoczęcia w formacie HH:MM (np. 10:00)
3. LOCATION - DOKŁADNE miejsce wydarzenia (np. "Sala obrad Urzędu Miejskiego", "Sala konferencyjna")
4. REASONING - szczegółowe uzasadnienie dlaczego to wydarzenie jest OBOWIĄZKIEM radnego (np. "Sesja Rady Miejskiej jest obowiązkowym spotkaniem dla wszystkich radnych zgodnie z regulaminem")
5. IS_COUNCIL_DUTY - boolean (true/false) - czy to wydarzenie jest bezwzględnym obowiązkiem radnego

KRYTERIA:
- Jeśli to sesja rady, komisja, posiedzenie - IS_COUNCIL_DUTY = true
- Jeśli to publikacja dokumentu, ogłoszenie, informacja - IS_COUNCIL_DUTY = false
- Wszystkie pola MUSZĄ być wypełnione lub null jeśli nie można ustalić

Odpowiedz TYLKO w formacie JSON:
{"date": "YYYY-MM-DD", "time": "HH:MM", "location": "miejsce", "reasoning": "uzasadnienie", "isCouncilDuty": true/false}

Jeśli nie możesz znaleźć WSZYSTKICH informacji (data, czas, miejsce), zwróć null dla brakujących pól.
Szukaj konkretnych dat sesji/posiedzeń, nie dat publikacji dokumentu.`;
    try {
        console.log(`[CalendarAutoImport] Calling LLM for: ${title.substring(0, 50)}...`);
        const response = await llm.chat.completions.create({
            model: config.modelName,
            messages: [
                {
                    role: "system",
                    content: "Jesteś asystentem wyodrębniającym informacje o wydarzeniach z dokumentów urzędowych. Odpowiadaj tylko w formacie JSON.",
                },
                { role: "user", content: prompt },
            ],
            temperature: 0.1,
            max_tokens: 500,
        });
        const responseText = response.choices[0]?.message?.content?.trim() || "{}";
        console.log(`[CalendarAutoImport] LLM response: ${responseText.substring(0, 300)}`);
        // Wyodrębnij JSON z odpowiedzi - obsłuż też markdown code blocks
        let jsonStr = responseText;
        // Usuń markdown code blocks jeśli obecne
        const codeBlockMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (codeBlockMatch) {
            jsonStr = codeBlockMatch[1].trim();
        }
        const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            console.log(`[CalendarAutoImport] Parsed JSON:`, parsed);
            return {
                date: parsed.date || undefined,
                time: parsed.time || undefined,
                location: parsed.location || undefined,
                reasoning: parsed.reasoning || undefined,
                isCouncilDuty: parsed.isCouncilDuty === true || parsed.is_council_duty === true,
            };
        }
        else {
            console.warn(`[CalendarAutoImport] No JSON found in response`);
        }
    }
    catch (error) {
        console.error("[CalendarAutoImport] AI extraction error:", error);
    }
    return {};
}
/**
 * Formatuje tytuł wydarzenia
 */
function formatEventTitle(docTitle, sessionNumber, eventType) {
    if (eventType === "session" && sessionNumber) {
        return `Sesja Rady nr ${sessionNumber}`;
    }
    // Skróć tytuł jeśli za długi
    if (docTitle.length > 80) {
        return docTitle.substring(0, 77) + "...";
    }
    return docTitle;
}
/**
 * Batch import - importuj wszystkie istniejące dokumenty sesji/komisji do kalendarza
 */
export async function batchImportExistingDocuments(userId) {
    const stats = { imported: 0, skipped: 0, errors: 0 };
    // Pobierz dokumenty sesji/komisji użytkownika - szukaj po tytule i typie
    const { data: documents, error } = await supabase
        .from("processed_documents")
        .select("id, user_id, title, document_type, content, session_number, normalized_publish_date, source_url")
        .eq("user_id", userId)
        .or("document_type.in.(session,protocol,committee,session_agenda,session_protocol,committee_meeting,commission_protocol)," +
        "title.ilike.%sesja%,title.ilike.%posiedzenie%,title.ilike.%komisj%");
    if (error || !documents) {
        console.error("[CalendarAutoImport] Failed to fetch documents:", error);
        return stats;
    }
    console.log(`[CalendarAutoImport] Found ${documents.length} session/committee documents to import`);
    for (const doc of documents) {
        try {
            // Sprawdź czy już istnieje
            const { data: existing } = await supabase
                .from("user_calendar_events")
                .select("id")
                .eq("user_id", userId)
                .eq("document_id", doc.id)
                .single();
            if (existing) {
                stats.skipped++;
                continue;
            }
            await autoImportToCalendar(doc);
            stats.imported++;
        }
        catch (err) {
            console.error(`[CalendarAutoImport] Error importing doc ${doc.id}:`, err);
            stats.errors++;
        }
    }
    console.log(`[CalendarAutoImport] Batch import complete:`, stats);
    return stats;
}
//# sourceMappingURL=calendar-auto-import.js.map