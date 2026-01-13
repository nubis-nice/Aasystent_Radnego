/**
 * Test poprawki - czy teraz znajduje dokument "Sesja Nr XXIII"
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const userId = "d7d7a35f-09e2-42cd-92ef-e142bc5c3dde";

function arabicToRoman(num: number): string {
  const romanNumerals: [number, string][] = [
    [1000, "M"],
    [900, "CM"],
    [500, "D"],
    [400, "CD"],
    [100, "C"],
    [90, "XC"],
    [50, "L"],
    [40, "XL"],
    [10, "X"],
    [9, "IX"],
    [5, "V"],
    [4, "IV"],
    [1, "I"],
  ];
  let result = "";
  let remaining = num;
  for (const [value, numeral] of romanNumerals) {
    while (remaining >= value) {
      result += numeral;
      remaining -= value;
    }
  }
  return result;
}

async function testFix() {
  console.log("=== TEST POPRAWKI - Wyszukiwanie Sesji 23 (XXIII) ===\n");

  const sessionNumber = 23;
  const romanNumber = arabicToRoman(sessionNumber);
  const pattern = `Sesja Nr ${romanNumber}`; // "Sesja Nr XXIII"

  console.log(`Pattern: "${pattern}"\n`);

  // Symulacja nowej logiki - najpierw tytuł
  console.log("KROK 1: Szukaj w tytule (priorytet)");
  const { data: titleMatches } = await supabase
    .from("processed_documents")
    .select("id, title, document_type")
    .eq("user_id", userId)
    .ilike("title", `%${pattern}%`)
    .limit(10);

  if (titleMatches && titleMatches.length > 0) {
    console.log(`✅ Znaleziono ${titleMatches.length} dokumentów w tytule:`);
    titleMatches.forEach((doc, idx) => {
      console.log(`  ${idx + 1}. ${doc.title}`);
      console.log(`     Type: ${doc.document_type}`);
    });
  } else {
    console.log(`❌ Brak dokumentów z "${pattern}" w tytule`);
  }

  console.log("\nKROK 2: Szukaj w treści (jeśli < 5 wyników)");
  if (!titleMatches || titleMatches.length < 5) {
    const { data: contentMatches } = await supabase
      .from("processed_documents")
      .select("id, title, document_type")
      .eq("user_id", userId)
      .ilike("content", `%${pattern}%`)
      .limit(5);

    if (contentMatches && contentMatches.length > 0) {
      console.log(
        `✅ Znaleziono ${contentMatches.length} dokumentów w treści:`
      );
      contentMatches.forEach((doc, idx) => {
        console.log(`  ${idx + 1}. ${doc.title.substring(0, 60)}...`);
      });
    } else {
      console.log(`⚠️ Brak dokumentów w treści`);
    }
  } else {
    console.log(
      `⏭️ Pominięto (już mamy ${titleMatches.length} wyników z tytułu)`
    );
  }

  console.log("\n=== WYNIK ===");
  if (
    titleMatches &&
    titleMatches.some((d) => d.title.includes("Sesja Nr XXIII"))
  ) {
    console.log("✅ SUKCES! Dokument 'Sesja Nr XXIII' został znaleziony!");
    console.log("Chat AI powinien teraz widzieć ten dokument w RAG.");
  } else {
    console.log("❌ Problem nadal istnieje - dokument nie został znaleziony.");
  }
}

testFix().catch(console.error);
