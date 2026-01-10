/**
 * Typy dla systemu źródeł danych opartego na API
 * Agent AI "Winsdurf" - architektura bez MCP, tylko API/scraping
 */
// ============================================================================
// PREDEFINED SOURCE TEMPLATES
// ============================================================================
export const PREDEFINED_SOURCES = {
    isap: {
        name: "ISAP - Internetowy System Aktów Prawnych",
        sourceType: "api_isap",
        fetchMethod: "scraping", // ISAP nie ma publicznego API, używamy scrapingu
        scraperConfig: {
            maxPages: 50,
            maxDepth: 2,
            delayMs: 2000,
            selectors: {
                documentList: ".act-list .act-item, table.acts tr",
                title: "h1.act-title, .title",
                content: ".act-content, .content",
                date: ".act-date, .date",
            },
            urlPatterns: {
                include: ["isap.sejm.gov.pl"],
                exclude: ["login", "admin"],
            },
        },
        metadata: {
            category: "legal",
            tags: ["prawo", "ustawy", "rozporządzenia"],
            priority: "high",
            jurisdiction: "Rzeczpospolita Polska",
            legalScope: ["prawo powszechnie obowiązujące"],
        },
    },
    wsa_nsa: {
        name: "WSA/NSA - Orzecznictwo sądów administracyjnych",
        sourceType: "api_wsa_nsa",
        fetchMethod: "scraping",
        scraperConfig: {
            maxPages: 30,
            maxDepth: 2,
            delayMs: 2000,
            selectors: {
                documentList: ".judgment-list .judgment-item",
                title: "h2.judgment-title",
                content: ".judgment-content",
                date: ".judgment-date",
            },
        },
        metadata: {
            category: "legal",
            tags: ["orzecznictwo", "sądy administracyjne"],
            priority: "high",
            legalScope: ["orzecznictwo"],
        },
    },
    rio: {
        name: "RIO - Regionalna Izba Obrachunkowa",
        sourceType: "api_rio",
        fetchMethod: "scraping",
        scraperConfig: {
            maxPages: 20,
            maxDepth: 2,
            delayMs: 1500,
            selectors: {
                documentList: ".resolution-list .item, table.resolutions tr",
                title: "h3.title, .resolution-title",
                content: ".content, .resolution-content",
                date: ".date, .resolution-date",
            },
        },
        metadata: {
            category: "administrative",
            tags: ["RIO", "nadzór", "finanse publiczne"],
            priority: "critical",
            legalScope: ["finanse publiczne", "nadzór"],
        },
    },
    bip_template: {
        name: "BIP - Biuletyn Informacji Publicznej",
        sourceType: "scraper_bip",
        fetchMethod: "scraping",
        scraperConfig: {
            maxPages: 50,
            maxDepth: 3,
            delayMs: 1000,
            selectors: {
                documentList: ".dokument, .document, table.dokumenty tr, .lista-dokumentow li",
                title: "h1, h2, .title, .tytul",
                content: ".tresc, .content, .main-content, article",
                links: "a[href]",
                pdfLinks: 'a[href$=".pdf"], a[href*="pdf"]',
                date: ".data, .date, time",
            },
            urlPatterns: {
                include: ["uchwaly", "protokoly", "zarzadzenia", "ogloszenia"],
                exclude: ["login", "admin", "rss"],
            },
        },
        metadata: {
            category: "administrative",
            tags: ["BIP", "samorząd"],
            priority: "high",
            legalScope: ["prawo lokalne"],
        },
    },
};
//# sourceMappingURL=data-sources-api.js.map