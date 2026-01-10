interface Citation {
  documentTitle: string;
  text: string;
  relevanceScore?: number;
}

interface ExportOptions {
  title?: string;
  includeMetadata?: boolean;
  includeCitations?: boolean;
}

/**
 * Konwertuje tekst do prostego formatu RTF
 */
function convertToSimpleRTF(
  content: string,
  title: string,
  citations: Citation[] = []
): string {
  // RTF header
  let rtf = "{\\rtf1\\ansi\\deff0\n";

  // Font table
  rtf += "{\\fonttbl{\\f0\\fswiss\\fcharset0 Arial;}}\n";

  // Color table
  rtf += "{\\colortbl;\\red59\\green130\\blue246;\\red34\\green197\\blue94;}\n";

  rtf += "\\viewkind4\\uc1\\pard\\f0\\fs22\n";

  // Escape special RTF characters
  const escapeRTF = (text: string) => {
    return text
      .replace(/\\/g, "\\\\")
      .replace(/{/g, "\\{")
      .replace(/}/g, "\\}")
      .replace(/\n/g, "\\par\n");
  };

  // Title
  rtf += "\\qc\\b\\fs32\\cf1 Asystent Radnego\\par\n";
  rtf += "\\fs24 " + escapeRTF(title) + "\\par\n";
  rtf += "\\b0\\fs18 Data: " + new Date().toLocaleString("pl-PL") + "\\par\n";
  rtf += "\\pard\\par\n";

  // Content
  rtf += "\\fs22 " + escapeRTF(content) + "\\par\n";

  // Citations
  if (citations.length > 0) {
    rtf += "\\par\\par\\b\\fs24 Zrodla:\\b0\\fs22\\par\n";
    citations.forEach((citation, index) => {
      rtf +=
        "\\par [" +
        (index + 1) +
        "] \\b " +
        escapeRTF(citation.documentTitle) +
        "\\b0\\par\n";
      rtf +=
        "\\i " + escapeRTF(citation.text.substring(0, 200)) + "\\i0\\par\n";
      if (citation.relevanceScore) {
        rtf +=
          "\\cf2 Trafnosc: " +
          Math.round(citation.relevanceScore * 100) +
          "%\\cf0\\par\n";
      }
    });
  }

  rtf += "}";

  return rtf;
}

/**
 * Konwertuje Markdown do HTML (nieużywane w RTF)
 */
function markdownToHtml(markdown: string): string {
  let html = markdown;

  // Nagłówki
  html = html.replace(/^# (.+)$/gm, "<h1>$1</h1>");
  html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>");
  html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");

  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

  // Italic
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");

  // Listy
  html = html.replace(/^- (.+)$/gm, "<li>$1</li>");
  html = html.replace(/^(\d+)\. (.+)$/gm, "<li>$2</li>");

  // Zawijanie list w <ul>
  html = html.replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`);

  // Paragrafy
  html = html.replace(/^(?!<[h|u|l])(.*?)$/gm, (match) => {
    if (match.trim() === "") return "<br/>";
    if (match.startsWith("<")) return match;
    return `<p>${match}</p>`;
  });

  return html;
}

/**
 * Eksportuje treść do RTF
 */
export function exportToRTF(
  content: string,
  citations: Citation[] = [],
  options: ExportOptions = {}
): void {
  const { title = "Dokument" } = options;

  // Konwertuj do RTF
  const rtfContent = convertToSimpleRTF(content, title, citations);

  // Pobierz plik
  const blob = new Blob([rtfContent], { type: "application/rtf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${title.replace(/\s+/g, "_")}_${
    new Date().toISOString().split("T")[0]
  }.rtf`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Eksportuje całą konwersację do RTF
 */
export function exportConversationToRTF(
  messages: Array<{ role: string; content: string; citations?: Citation[] }>,
  title: string = "Konwersacja"
): void {
  let fullContent = "";
  const allCitations: Citation[] = [];

  messages.forEach((msg) => {
    if (msg.role === "user") {
      fullContent += `\n\n## 👤 Użytkownik:\n\n${msg.content}\n`;
    } else if (msg.role === "assistant") {
      fullContent += `\n\n## 🤖 Asystent:\n\n${msg.content}\n`;

      // Zbierz cytaty
      if (msg.citations) {
        msg.citations.forEach((citation) => {
          if (
            !allCitations.find(
              (c) => c.documentTitle === citation.documentTitle
            )
          ) {
            allCitations.push(citation);
          }
        });
      }
    }
  });

  exportToRTF(fullContent, allCitations, {
    title,
    includeMetadata: true,
    includeCitations: true,
  });
}
