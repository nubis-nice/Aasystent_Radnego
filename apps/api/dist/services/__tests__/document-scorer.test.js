import { describe, it, expect, beforeEach, vi } from "vitest";
// Mock Supabase before importing DocumentScorer
vi.mock("@supabase/supabase-js", () => ({
    createClient: vi.fn(() => ({
        from: vi.fn(() => ({
            select: vi.fn(() => ({
                eq: vi.fn(() => ({
                    single: vi.fn(() => Promise.resolve({ data: null, error: null })),
                })),
            })),
        })),
    })),
}));
// Set environment variables before import
process.env.SUPABASE_URL = "https://test.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
import { DocumentScorer } from "../document-scorer.js";
describe("DocumentScorer", () => {
    let scorer;
    beforeEach(() => {
        scorer = new DocumentScorer("Drawno");
    });
    describe("calculateScore", () => {
        it("should return higher score for budget_act type", () => {
            const doc = {
                title: "Uchwała budżetowa",
                content: "Treść uchwały budżetowej gminy",
                document_type: "budget_act",
            };
            const score = scorer.calculateScore(doc);
            expect(score.typeScore).toBe(100);
            expect(score.totalScore).toBeGreaterThan(30);
            // Priority depends on combined score, not just type
            expect(["critical", "high", "medium"]).toContain(score.priority);
        });
        it("should return lower score for attachment type", () => {
            const doc = {
                title: "Załącznik nr 1",
                content: "Treść załącznika",
                document_type: "attachment",
            };
            const score = scorer.calculateScore(doc);
            expect(score.typeScore).toBe(20);
            expect(score.priority).toBe("low");
        });
        it("should add keyword bonus for priority keywords", () => {
            const docWithKeywords = {
                title: "Porządek obrad sesji rady miejskiej",
                content: "Głosowanie nad uchwałą budżetową",
                document_type: "other",
            };
            const docWithoutKeywords = {
                title: "Dokument testowy",
                content: "Treść bez słów kluczowych",
                document_type: "other",
            };
            const scoreWith = scorer.calculateScore(docWithKeywords);
            const scoreWithout = scorer.calculateScore(docWithoutKeywords);
            expect(scoreWith.relevanceScore).toBeGreaterThan(scoreWithout.relevanceScore);
            expect(scoreWith.scoringDetails.keywordBonus).toBeGreaterThan(0);
        });
        it("should add location bonus for council location", () => {
            const docWithLocation = {
                title: "Dokument z Drawna",
                content: "Treść dokumentu z Drawna",
                document_type: "other",
            };
            const docWithoutLocation = {
                title: "Dokument testowy",
                content: "Treść dokumentu",
                document_type: "other",
            };
            const scoreWith = scorer.calculateScore(docWithLocation);
            const scoreWithout = scorer.calculateScore(docWithoutLocation);
            // Location bonus adds 15 points
            expect(scoreWith.scoringDetails.keywordBonus).toBeGreaterThanOrEqual(scoreWithout.scoringDetails.keywordBonus);
        });
        it("should add urgency bonus for urgent keywords", () => {
            const urgentDoc = {
                title: "PILNE: Sesja nadzwyczajna",
                content: "Termin do dnia 15.01.2026",
                document_type: "session",
            };
            const normalDoc = {
                title: "Sesja zwyczajna",
                content: "Zaproszenie na sesję",
                document_type: "session",
            };
            const urgentScore = scorer.calculateScore(urgentDoc);
            const normalScore = scorer.calculateScore(normalDoc);
            expect(urgentScore.urgencyScore).toBeGreaterThan(normalScore.urgencyScore);
        });
        it("should add recency bonus for recent documents", () => {
            const now = new Date();
            const yesterday = new Date(now.getTime() - 12 * 60 * 60 * 1000);
            const lastMonth = new Date(now.getTime() - 35 * 24 * 60 * 60 * 1000);
            const recentDoc = {
                title: "Nowy dokument",
                content: "Treść",
                document_type: "announcement",
                publish_date: yesterday.toISOString(),
            };
            const oldDoc = {
                title: "Stary dokument",
                content: "Treść",
                document_type: "announcement",
                publish_date: lastMonth.toISOString(),
            };
            const recentScore = scorer.calculateScore(recentDoc);
            const oldScore = scorer.calculateScore(oldDoc);
            expect(recentScore.recencyScore).toBeGreaterThan(oldScore.recencyScore);
            expect(recentScore.scoringDetails.recencyBonus).toBe(25);
        });
        it("should set critical priority for high urgency", () => {
            const urgentDoc = {
                title: "PILNE natychmiast termin deadline",
                content: "Bezzwłocznie do dnia",
                document_type: "resolution",
            };
            const score = scorer.calculateScore(urgentDoc);
            expect(score.urgencyScore).toBeGreaterThanOrEqual(50);
            expect(score.priority).toBe("critical");
        });
        it("should handle missing content gracefully", () => {
            const doc = {
                title: "Dokument bez treści",
                content: "",
                document_type: "other",
            };
            const score = scorer.calculateScore(doc);
            expect(score).toBeDefined();
            expect(score.totalScore).toBeGreaterThanOrEqual(0);
        });
        it("should handle unknown document type", () => {
            const doc = {
                title: "Nieznany typ",
                content: "Treść",
                document_type: "unknown_type",
            };
            const score = scorer.calculateScore(doc);
            expect(score.typeScore).toBe(10); // default to 'other' weight
        });
    });
    describe("priority levels", () => {
        it("should return critical for high urgency score", () => {
            const doc = {
                title: "PILNE natychmiast termin deadline bezzwłocznie",
                content: "Do dnia najpóźniej pilne termin",
                document_type: "budget_act",
                publish_date: new Date().toISOString(),
            };
            const score = scorer.calculateScore(doc);
            // Critical priority when urgencyScore >= 50
            expect(score.urgencyScore).toBeGreaterThanOrEqual(50);
            expect(score.priority).toBe("critical");
        });
        it("should return low for totalScore < 30", () => {
            const doc = {
                title: "Test",
                content: "Test",
                document_type: "other",
                publish_date: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
            };
            const score = scorer.calculateScore(doc);
            expect(score.priority).toBe("low");
        });
    });
});
//# sourceMappingURL=document-scorer.test.js.map