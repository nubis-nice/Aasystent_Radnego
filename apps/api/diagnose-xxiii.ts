/**
 * Skrypt diagnostyczny - dlaczego chat AI nie widzi "Sesja Nr XXIII"
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function diagnose() {
  console.log("=== DIAGNOSTYKA: Sesja Nr XXIII ===\n");

  // 1. Sprawdź czy dokument istnieje
  console.log("1. Szukam dokumentu w bazie...");
  const { data: docs, error } = await supabase
    .from("processed_documents")
    .select("id, title, document_type, user_id, embedding, content")
    .ilike("title", "%XXIII%");

  if (error) {
    console.error("❌ Błąd zapytania:", error);
    return;
  }

  if (!docs || docs.length === 0) {
    console.log("❌ Dokument NIE ISTNIEJE w processed_documents");
    console.log("\n2. Sprawdzam scraped_content...");

    const { data: scraped } = await supabase
      .from("scraped_content")
      .select("*")
      .ilike("title", "%XXIII%");

    if (scraped && scraped.length > 0) {
      console.log(
        `✅ Znaleziono ${scraped.length} dokumentów w scraped_content:`
      );
      scraped.forEach((doc) => {
        console.log(`  - ${doc.title}`);
        console.log(`    URL: ${doc.url}`);
        console.log(`    Type: ${doc.content_type}`);
        console.log(`    User: ${doc.user_id}`);
      });
      console.log(
        "\n⚠️ PROBLEM: Dokument jest w scraped_content, ale NIE został przetworzony do processed_documents!"
      );
      console.log(
        "   Rozwiązanie: Uruchom proces przetwarzania dokumentów lub ręcznie dodaj do RAG."
      );
    } else {
      console.log("❌ Dokument nie istnieje ani w scraped_content");
    }
    return;
  }

  console.log(`✅ Znaleziono ${docs.length} dokumentów:\n`);

  docs.forEach((doc, idx) => {
    console.log(`--- Dokument ${idx + 1} ---`);
    console.log(`ID: ${doc.id}`);
    console.log(`Tytuł: ${doc.title}`);
    console.log(`Typ: ${doc.document_type}`);
    console.log(`User ID: ${doc.user_id}`);
    console.log(`Ma embedding: ${doc.embedding ? "✅ TAK" : "❌ NIE"}`);
    console.log(`Długość treści: ${doc.content?.length || 0} znaków`);

    if (!doc.embedding) {
      console.log(
        "⚠️ PROBLEM: Brak embeddingu! Chat AI używa semantic search i nie znajdzie tego dokumentu."
      );
      console.log("   Rozwiązanie: Wygeneruj embedding dla tego dokumentu.");
    }
    console.log("");
  });

  // 2. Sprawdź czy chat AI może znaleźć dokument
  console.log("\n3. Testuję wyszukiwanie jak robi to chat AI...");

  const testQueries = [
    "sesja XXIII",
    "sesja nr XXIII",
    "Sesja Nr XXIII",
    "sesja 23",
    "sesja nr 23",
  ];

  for (const query of testQueries) {
    console.log(`\n   Zapytanie: "${query}"`);

    // Test fulltext search
    const { data: fulltext } = await supabase
      .from("processed_documents")
      .select("id, title")
      .or(`title.ilike.%${query}%,content.ilike.%${query}%`)
      .limit(3);

    console.log(`   Fulltext: ${fulltext?.length || 0} wyników`);
    if (fulltext && fulltext.length > 0) {
      fulltext.forEach((d) => console.log(`     - ${d.title}`));
    }
  }

  // 3. Sprawdź user_id
  console.log("\n4. Sprawdzam user_id...");
  const uniqueUserIds = [...new Set(docs.map((d) => d.user_id))];
  console.log(
    `   Znaleziono dokumenty dla ${uniqueUserIds.length} użytkowników:`
  );
  uniqueUserIds.forEach((uid) => {
    const count = docs.filter((d) => d.user_id === uid).length;
    console.log(`   - ${uid}: ${count} dokumentów`);
  });

  // 4. Podsumowanie
  console.log("\n=== PODSUMOWANIE ===");
  const hasEmbedding = docs.every((d) => d.embedding);
  const hasContent = docs.every((d) => d.content && d.content.length > 0);

  if (hasEmbedding && hasContent) {
    console.log("✅ Wszystkie dokumenty mają embedding i treść");
    console.log("✅ Chat AI POWINIEN widzieć te dokumenty");
    console.log("\n⚠️ Jeśli chat AI nadal nie widzi:");
    console.log("   1. Sprawdź czy używasz poprawnego user_id w zapytaniu");
    console.log(
      "   2. Sprawdź logi chat API - czy orkiestrator wykrywa intencję session_search"
    );
    console.log(
      "   3. Sprawdź czy embedding model jest poprawnie skonfigurowany"
    );
  } else {
    console.log("❌ Problemy:");
    if (!hasEmbedding)
      console.log("   - Brak embeddingu w niektórych dokumentach");
    if (!hasContent) console.log("   - Brak treści w niektórych dokumentach");
  }
}

diagnose().catch(console.error);
