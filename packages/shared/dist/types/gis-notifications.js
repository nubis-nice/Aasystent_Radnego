/**
 * Typy dla GIS (Global Information System) - Powiadomienia
 */
// Pomocnicze funkcje
export function getNotificationTypeLabel(type) {
    const labels = {
        new_document: "Nowy dokument",
        update: "Aktualizacja",
        alert: "Alert",
        reminder: "Przypomnienie",
        system: "System",
    };
    return labels[type];
}
export function getNotificationTypeIcon(type) {
    const icons = {
        new_document: "FileText",
        update: "RefreshCw",
        alert: "AlertTriangle",
        reminder: "Bell",
        system: "Info",
    };
    return icons[type];
}
export function getPriorityLabel(priority) {
    const labels = {
        low: "Niski",
        normal: "Normalny",
        high: "Wysoki",
        urgent: "Pilny",
    };
    return labels[priority];
}
export function getPriorityColor(priority) {
    const colors = {
        low: "text-text-secondary",
        normal: "text-primary-600",
        high: "text-warning",
        urgent: "text-danger",
    };
    return colors[priority];
}
export function getEmailFrequencyLabel(frequency) {
    const labels = {
        immediate: "Natychmiast",
        daily_digest: "Dzienny digest",
        weekly_digest: "Tygodniowy digest",
        never: "Nigdy",
    };
    return labels[frequency];
}
export function formatNotificationTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 1)
        return "Teraz";
    if (diffMins < 60)
        return `${diffMins} min temu`;
    if (diffHours < 24)
        return `${diffHours} godz. temu`;
    if (diffDays < 7)
        return `${diffDays} dni temu`;
    return date.toLocaleDateString("pl-PL", {
        day: "numeric",
        month: "short",
        year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
}
//# sourceMappingURL=gis-notifications.js.map