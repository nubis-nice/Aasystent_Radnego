/**
 * Test script for Intelligent RAG Search
 *
 * Uruchom: npx tsx test-rag-search.ts
 */

const API_URL = "http://localhost:3001";

interface TestCase {
  name: string;
  query: string;
  expectedEntities?: string[];
}

const testCases: TestCase[] = [
  {
    name: "Sesja z numerem rzymskim XXIII",
    query: "Pokaż mi protokół z sesji nr XXIII",
    expectedEntities: ["session"],
  },
  {
    name: "Sesja z numerem arabskim 23",
    query: "Protokół sesji 23",
    expectedEntities: ["session"],
  },
  {
    name: "Uchwała z numerem",
    query: "Znajdź uchwałę nr 123/2024",
    expectedEntities: ["resolution"],
  },
  {
    name: "Druk z numerem",
    query: "Druk nr 45 dotyczący budżetu",
    expectedEntities: ["druk"],
  },
  {
    name: "Ogólne zapytanie o sesję",
    query: "Co było omawiane na ostatniej sesji rady?",
  },
  {
    name: "Zapytanie o konkretny temat",
    query: "Budżet gminy na 2024 rok",
  },
];

async function runTests() {
  console.log("=".repeat(60));
  console.log("TEST INTELIGENTNEGO WYSZUKIWANIA RAG");
  console.log("=".repeat(60));
  console.log();

  // Najpierw sprawdź czy API działa
  try {
    const healthCheck = await fetch(`${API_URL}/health`);
    if (!healthCheck.ok) {
      console.error("❌ API nie odpowiada na /health");
      return;
    }
    console.log("✅ API działa poprawnie");
    console.log();
  } catch (error) {
    console.error("❌ Nie można połączyć z API:", error);
    return;
  }

  // Test bez autoryzacji - tylko sprawdzenie czy endpoint istnieje
  console.log("Test 1: Sprawdzenie endpointu /documents/intelligent-search");
  console.log("-".repeat(60));

  try {
    const response = await fetch(`${API_URL}/documents/intelligent-search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": "test-user-id", // Wymaga prawdziwego user ID
      },
      body: JSON.stringify({
        query: "sesja nr XXIII",
        maxResults: 10,
      }),
    });

    const data = await response.json();

    console.log("Status:", response.status);
    console.log("Response:", JSON.stringify(data, null, 2).substring(0, 500));

    if (response.status === 401) {
      console.log("\n⚠️  Wymagana autoryzacja - użyj prawdziwego tokenu JWT");
      console.log("\nAby przetestować z autoryzacją:");
      console.log("1. Zaloguj się w aplikacji frontend");
      console.log("2. Otwórz DevTools → Application → Local Storage");
      console.log("3. Skopiuj wartość 'sb-xxx-auth-token'");
      console.log("4. Użyj tokenu w nagłówku Authorization: Bearer <token>");
    }
  } catch (error) {
    console.error("Error:", error);
  }

  console.log();
  console.log("=".repeat(60));
  console.log("PRZYKŁADOWE ZAPYTANIA DO PRZETESTOWANIA");
  console.log("=".repeat(60));

  for (const testCase of testCases) {
    console.log(`\n📝 ${testCase.name}`);
    console.log(`   Query: "${testCase.query}"`);
    if (testCase.expectedEntities) {
      console.log(
        `   Expected entities: ${testCase.expectedEntities.join(", ")}`
      );
    }
  }

  console.log();
  console.log("=".repeat(60));
  console.log("CURL PRZYKŁAD");
  console.log("=".repeat(60));
  console.log(`
curl -X POST ${API_URL}/documents/intelligent-search \\
  -H "Content-Type: application/json" \\
  -H "x-user-id: YOUR_USER_ID" \\
  -d '{"query": "protokół sesji XXIII", "maxResults": 10}'
`);

  console.log(`
curl -X POST ${API_URL}/documents/test-rag-search \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \\
  -d '{"query": "sesja nr XXIII"}'
`);
}

runTests().catch(console.error);
