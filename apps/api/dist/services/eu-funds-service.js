/**
 * EU Funds Service
 * Obsługa źródeł danych o funduszach europejskich
 */
export class EUFundsService {
    cache = new Map();
    cacheTTL = 3600000;
    constructor() { }
    async searchProjects(params) {
        console.log("[EU Funds] Searching projects:", params);
        const mockProjects = [
            {
                id: "POIS.01.01.00-00-0001/20",
                title: "Budowa kanalizacji sanitarnej w gminie",
                beneficiary: params.municipality || "Gmina Przykładowa",
                program: "Program Operacyjny Infrastruktura i Środowisko",
                priority: "Oś priorytetowa I - Gospodarka wodno-ściekowa",
                totalValue: 15000000,
                euCoFinancing: 12750000,
                startDate: "2020-01-01",
                endDate: "2023-12-31",
                status: "w realizacji",
                region: params.region || "mazowieckie",
                municipality: params.municipality,
                description: "Budowa sieci kanalizacji sanitarnej wraz z przyłączami",
                category: "infrastruktura",
            },
            {
                id: "RPMA.04.02.00-14-0123/21",
                title: "Termomodernizacja budynków użyteczności publicznej",
                beneficiary: params.municipality || "Gmina Przykładowa",
                program: "Regionalny Program Operacyjny",
                priority: "Oś IV - Przejście na gospodarkę niskoemisyjną",
                totalValue: 5000000,
                euCoFinancing: 4250000,
                startDate: "2021-06-01",
                endDate: "2024-05-31",
                status: "w realizacji",
                region: params.region || "mazowieckie",
                municipality: params.municipality,
                description: "Kompleksowa termomodernizacja 5 budynków gminnych",
                category: "efektywność energetyczna",
            },
        ];
        return mockProjects.filter((p) => {
            if (params.query &&
                !p.title.toLowerCase().includes(params.query.toLowerCase()))
                return false;
            if (params.minValue && p.totalValue < params.minValue)
                return false;
            if (params.maxValue && p.totalValue > params.maxValue)
                return false;
            return true;
        });
    }
    async getActiveCompetitions(params) {
        console.log("[EU Funds] Getting active competitions:", params);
        const competitions = [
            {
                id: "FENG.01.01-IP.02-001/24",
                title: "Ścieżka SMART - projekty B+R+I",
                program: "Fundusze Europejskie dla Nowoczesnej Gospodarki",
                institution: "PARP",
                startDate: "2024-01-15",
                endDate: "2024-12-31",
                budget: 500000000,
                status: "open",
                url: "https://www.parp.gov.pl/component/grants/grants/sciezka-smart",
                description: "Wsparcie projektów badawczo-rozwojowych i innowacyjnych",
                targetGroups: ["MŚP", "duże przedsiębiorstwa"],
            },
            {
                id: "FERC.02.01-IZ.00-001/24",
                title: "Rozwój OZE w jednostkach samorządu terytorialnego",
                program: "Fundusze Europejskie na Infrastrukturę, Klimat, Środowisko",
                institution: "NFOŚiGW",
                startDate: "2024-03-01",
                endDate: "2024-09-30",
                budget: 200000000,
                status: "open",
                url: "https://www.nfosigw.gov.pl/",
                description: "Instalacje OZE dla budynków użyteczności publicznej",
                targetGroups: ["JST", "jednostki organizacyjne JST"],
            },
            {
                id: "FEPW.02.03-IZ.00-001/24",
                title: "Zrównoważona mobilność miejska",
                program: "Fundusze Europejskie dla Polski Wschodniej",
                institution: "Ministerstwo Funduszy i Polityki Regionalnej",
                startDate: "2024-04-01",
                endDate: "2024-06-30",
                budget: 150000000,
                status: "open",
                url: "https://www.funduszeeuropejskie.gov.pl/",
                description: "Zakup autobusów elektrycznych i infrastruktury ładowania",
                targetGroups: [
                    "JST",
                    "związki JST",
                    "operatorzy transportu publicznego",
                ],
            },
        ];
        return competitions.filter((c) => {
            if (params?.program &&
                !c.program.toLowerCase().includes(params.program.toLowerCase()))
                return false;
            return true;
        });
    }
    async getCompetitivenessOffers(params) {
        console.log("[EU Funds] Getting competitiveness offers:", params);
        const offers = [
            {
                id: "2024-12345",
                title: "Dostawa sprzętu komputerowego dla szkół",
                beneficiary: "Gmina Przykładowa",
                deadline: "2024-02-15",
                value: 150000,
                category: "dostawy",
                region: "mazowieckie",
                url: "https://bazakonkurencyjnosci.funduszeeuropejskie.gov.pl/ogloszenia/12345",
            },
            {
                id: "2024-12346",
                title: "Wykonanie dokumentacji projektowej - termomodernizacja",
                beneficiary: "Powiat Przykładowy",
                deadline: "2024-02-20",
                value: 80000,
                category: "usługi",
                region: "mazowieckie",
                url: "https://bazakonkurencyjnosci.funduszeeuropejskie.gov.pl/ogloszenia/12346",
            },
        ];
        return offers.filter((o) => {
            if (params?.category && o.category !== params.category)
                return false;
            if (params?.region && o.region !== params.region)
                return false;
            if (params?.minValue && o.value < params.minValue)
                return false;
            return true;
        });
    }
    async getProjectsSummary(municipality) {
        const projects = await this.searchProjects({ municipality });
        const byProgram = {};
        const byStatus = {};
        for (const project of projects) {
            if (!byProgram[project.program]) {
                byProgram[project.program] = { count: 0, value: 0 };
            }
            byProgram[project.program].count++;
            byProgram[project.program].value += project.euCoFinancing;
            byStatus[project.status] = (byStatus[project.status] || 0) + 1;
        }
        return {
            totalProjects: projects.length,
            totalValue: projects.reduce((sum, p) => sum + p.totalValue, 0),
            totalEuCoFinancing: projects.reduce((sum, p) => sum + p.euCoFinancing, 0),
            byProgram,
            byStatus,
        };
    }
    async getUpcomingCompetitions(months = 3) {
        const competitions = await this.getActiveCompetitions();
        const now = new Date();
        const futureDate = new Date();
        futureDate.setMonth(futureDate.getMonth() + months);
        return competitions.filter((c) => {
            const endDate = new Date(c.endDate);
            return endDate >= now && endDate <= futureDate;
        });
    }
    async findFundingOpportunities(projectType) {
        const allCompetitions = await this.getActiveCompetitions();
        const typeKeywords = {
            infrastruktura: ["infrastruktura", "budowa", "remont", "drogi"],
            oze: ["OZE", "odnawialne", "fotowoltaika", "energia"],
            edukacja: ["edukacja", "szkoła", "kompetencje", "cyfryzacja"],
            zdrowie: ["zdrowie", "szpital", "opieka", "medyczny"],
            transport: ["transport", "mobilność", "autobus", "kolej"],
            środowisko: ["środowisko", "woda", "ścieki", "odpady"],
            cyfryzacja: ["cyfryzacja", "e-usługi", "IT", "digital"],
        };
        const keywords = typeKeywords[projectType.toLowerCase()] || [projectType];
        const relevantCompetitions = allCompetitions.filter((c) => keywords.some((kw) => c.title.toLowerCase().includes(kw.toLowerCase()) ||
            c.description?.toLowerCase().includes(kw.toLowerCase())));
        const relatedPrograms = [
            ...new Set(relevantCompetitions.map((c) => c.program)),
        ];
        const recommendations = [
            `Zidentyfikowano ${relevantCompetitions.length} otwartych naborów dla typu: ${projectType}`,
            relatedPrograms.length > 0
                ? `Najczęstsze programy: ${relatedPrograms.slice(0, 3).join(", ")}`
                : "Brak aktywnych naborów - sprawdź harmonogram na kolejne miesiące",
        ];
        return {
            competitions: relevantCompetitions,
            relatedPrograms,
            recommendations,
        };
    }
}
//# sourceMappingURL=eu-funds-service.js.map