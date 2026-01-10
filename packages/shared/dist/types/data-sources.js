/**
 * Typy dla systemu źródeł danych (scraping)
 */
export const PREDEFINED_SOURCES = [
    // Portale prawne
    {
        name: "ISAP - Internetowy System Aktów Prawnych",
        type: "legal",
        url: "https://isap.sejm.gov.pl",
        description: "Oficjalna baza aktów prawnych Sejmu RP",
        scraping_frequency: "weekly",
        scraping_config: {
            search_params: {
                category: "samorzad",
            },
        },
        icon: "Scale",
        category: "Prawo",
    },
    {
        name: "Lexlege - Baza Aktów Prawnych",
        type: "legal",
        url: "https://lexlege.pl",
        description: "Kompleksowa baza aktów prawnych",
        scraping_frequency: "weekly",
        scraping_config: {},
        icon: "BookOpen",
        category: "Prawo",
    },
    {
        name: "Monitor Polski",
        type: "legal",
        url: "https://monitorpolski.gov.pl",
        description: "Dziennik urzędowy RP - akty wykonawcze",
        scraping_frequency: "daily",
        scraping_config: {},
        icon: "FileText",
        category: "Prawo",
    },
    // Serwisy dla radnych
    {
        name: "Portal Samorządowy",
        type: "councilor",
        url: "https://portalsamorzadowy.pl",
        description: "Informacje, szkolenia i narzędzia dla samorządowców",
        scraping_frequency: "daily",
        scraping_config: {
            selectors: {
                news_list: ".article",
                title: "h2",
                content: ".content",
            },
        },
        icon: "Users",
        category: "Dla radnych",
    },
    {
        name: "Związek Gmin Wiejskich RP",
        type: "councilor",
        url: "https://zgwrp.org.pl",
        description: "Aktualności i stanowiska ZGW RP",
        scraping_frequency: "weekly",
        scraping_config: {},
        icon: "Home",
        category: "Dla radnych",
    },
    {
        name: "Fundacja Rozwoju Demokracji Lokalnej",
        type: "councilor",
        url: "https://frdl.org.pl",
        description: "Szkolenia, publikacje, projekty dla JST",
        scraping_frequency: "weekly",
        scraping_config: {},
        icon: "GraduationCap",
        category: "Dla radnych",
    },
    // Dane statystyczne
    {
        name: "GUS - Bank Danych Lokalnych",
        type: "statistics",
        url: "https://bdl.stat.gov.pl",
        description: "Dane demograficzne, ekonomiczne, społeczne",
        scraping_frequency: "monthly",
        scraping_config: {
            api_endpoint: "/api/v1/data",
        },
        icon: "BarChart",
        category: "Statystyki",
    },
    {
        name: "Ministerstwo Finansów - Budżety JST",
        type: "statistics",
        url: "https://www.gov.pl/web/finanse",
        description: "Dane budżetowe jednostek samorządu terytorialnego",
        scraping_frequency: "monthly",
        scraping_config: {},
        icon: "DollarSign",
        category: "Statystyki",
    },
    // Parki narodowe
    {
        name: "Drawieński Park Narodowy",
        type: "national_park",
        url: "https://www.dpn.pl",
        description: "Aktualności, wydarzenia, ochrona przyrody",
        scraping_frequency: "weekly",
        scraping_config: {
            selectors: {
                news_list: ".news-item",
                title: "h2",
                content: ".content",
            },
        },
        icon: "Trees",
        category: "Instytucje lokalne",
    },
    // Szpitale
    {
        name: "Szpital Powiatowy w Drawsku",
        type: "hospital",
        url: "https://szpital-drawsko.pl",
        description: "Informacje o szpitalu, godziny przyjęć, ogłoszenia",
        scraping_frequency: "daily",
        scraping_config: {
            selectors: {
                news_list: ".announcement",
                title: "h3",
                content: ".text",
            },
        },
        icon: "Hospital",
        category: "Instytucje lokalne",
    },
    // Szkoły
    {
        name: "Szkoły w Gminie Drawno",
        type: "school",
        url: "https://szkoly.drawno.pl",
        description: "Aktualności ze szkół, wydarzenia, ogłoszenia",
        scraping_frequency: "daily",
        scraping_config: {},
        icon: "School",
        category: "Instytucje lokalne",
    },
    // Kultura
    {
        name: "Gminny Ośrodek Kultury",
        type: "cultural",
        url: "https://gok.drawno.pl",
        description: "Wydarzenia kulturalne, wystawy, koncerty",
        scraping_frequency: "daily",
        scraping_config: {},
        icon: "Theater",
        category: "Instytucje lokalne",
    },
    {
        name: "Biblioteka Publiczna",
        type: "cultural",
        url: "https://biblioteka.drawno.pl",
        description: "Nowości książkowe, wydarzenia, godziny otwarcia",
        scraping_frequency: "weekly",
        scraping_config: {},
        icon: "Library",
        category: "Instytucje lokalne",
    },
    // Ochrona środowiska
    {
        name: "WIOŚ - Wojewódzki Inspektorat Ochrony Środowiska",
        type: "environmental",
        url: "https://www.wios.szczecin.pl",
        description: "Raporty o stanie środowiska, kontrole, decyzje",
        scraping_frequency: "weekly",
        scraping_config: {},
        icon: "Leaf",
        category: "Środowisko",
    },
    // Transport
    {
        name: "PKS - Rozkład jazdy",
        type: "transport",
        url: "https://pks.drawno.pl",
        description: "Rozkład jazdy, zmiany w kursach, ogłoszenia",
        scraping_frequency: "daily",
        scraping_config: {},
        icon: "Bus",
        category: "Transport",
    },
    // Służby ratunkowe
    {
        name: "Straż Pożarna - OSP Drawno",
        type: "emergency",
        url: "https://osp.drawno.pl",
        description: "Interwencje, szkolenia, apele",
        scraping_frequency: "daily",
        scraping_config: {},
        icon: "Siren",
        category: "Bezpieczeństwo",
    },
];
// Pomocnicze funkcje
export function getSourceTypeLabel(type) {
    const labels = {
        municipality: "Strona gminy",
        bip: "BIP",
        legal: "Portal prawny",
        councilor: "Serwis dla radnych",
        statistics: "Dane statystyczne",
        national_park: "Park narodowy",
        hospital: "Szpital",
        school: "Szkoła",
        cultural: "Kultura",
        environmental: "Środowisko",
        transport: "Transport",
        emergency: "Służby ratunkowe",
        custom: "Własne źródło",
    };
    return labels[type];
}
export function getDocumentTypeLabel(type) {
    const labels = {
        resolution: "Uchwała",
        protocol: "Protokół",
        news: "Aktualność",
        legal_act: "Akt prawny",
        announcement: "Ogłoszenie",
        article: "Artykuł",
    };
    return labels[type];
}
export function getFrequencyLabel(frequency) {
    const labels = {
        hourly: "Co godzinę",
        daily: "Codziennie",
        weekly: "Co tydzień",
        monthly: "Co miesiąc",
        manual: "Ręcznie",
    };
    return labels[frequency];
}
export function getStatusColor(status) {
    const colors = {
        success: "text-success",
        error: "text-danger",
        partial: "text-warning",
        skipped: "text-text-secondary",
    };
    return colors[status];
}
//# sourceMappingURL=data-sources.js.map