/**
 * Test wyszukiwania sesji 23 (XXIII)
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const userId = "d7d7a35f-09e2-42cd-92ef-e142bc5c3dde"; // Z diagnostyki

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

async function testSessionSearch() {
  console.log("=== TEST WYSZUKIWANIA SESJI 23 (XXIII) ===\n");

  const sessionNumber = 23;
  const romanNumber = arabicToRoman(sessionNumber);
  const arabicNumber = sessionNumber.toString();

  console.log(`Sesja: ${sessionNumber}`);
  console.log(`Rzymski: ${romanNumber}`);
  console.log(`Arabski: ${arabicNumber}\n`);

  // Wzorce z document-query-service.ts
  const searchPatterns = [
    `Sesja Nr ${romanNumber}`,
    `Sesja nr ${romanNumber}`,
    `sesja ${romanNumber}`,
    `Sesja Nr ${arabicNumber}`,
    `Sesja nr ${arabicNumber}`,
    `sesja ${arabicNumber}`,
    `${romanNumber} sesja`,
    `${arabicNumber} sesja`,
  ];

  console.log("Testuję wzorce wyszukiwania:\n");

  for (const pattern of searchPatterns) {
    console.log(`Pattern: "${pattern}"`);

    const { data, error } = await supabase
      .from("processed_documents")
      .select("id, title, document_type")
      .eq("user_id", userId)
      .or(`title.ilike.%${pattern}%,content.ilike.%${pattern}%`)
      .limit(5);

    if (error) {
      console.log(`  ❌ Error: ${error.message}`);
    } else if (data && data.length > 0) {
      console.log(`  ✅ Znaleziono ${data.length} dokumentów:`);
      data.forEach((doc) => {
        console.log(`     - ${doc.title.substring(0, 60)}...`);
      });
    } else {
      console.log(`  ⚠️ Brak wyników`);
    }
    console.log("");
  }

  // Test dokładnego dopasowania
  console.log("\n=== TEST DOKŁADNEGO DOPASOWANIA ===\n");

  const exactTitle = "Sesja Nr XXIII | Urząd Miejski w Drawnie | System Rada";
  console.log(`Szukam dokładnego tytułu: "${exactTitle}"`);

  const { data: exact } = await supabase
    .from("processed_documents")
    .select("id, title")
    .eq("user_id", userId)
    .eq("title", exactTitle);

  if (exact && exact.length > 0) {
    console.log(`✅ Znaleziono ${exact.length} dokumentów z dokładnym tytułem`);
  } else {
    console.log(`❌ Nie znaleziono dokumentu z dokładnym tytułem`);
  }

  // Test z ILIKE na pełny tytuł
  console.log(`\nTest ILIKE na fragment tytułu: "Sesja Nr XXIII%"`);
  const { data: ilike } = await supabase
    .from("processed_documents")
    .select("id, title")
    .eq("user_id", userId)
    .ilike("title", "Sesja Nr XXIII%");

  if (ilike && ilike.length > 0) {
    console.log(`✅ Znaleziono ${ilike.length} dokumentów`);
    ilike.forEach((doc) => console.log(`   - ${doc.title}`));
  } else {
    console.log(`❌ Nie znaleziono`);
  }
}

testSessionSearch().catch(console.error);
