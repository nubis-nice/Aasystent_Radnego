import jsPDF from "jspdf";

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
 * Eksportuje treść do PDF z formatowaniem
 */
export async function exportToPDF(
  content: string,
  citations: Citation[] = [],
  options: ExportOptions = {}
): Promise<void> {
  const {
    title = "Dokument",
    includeMetadata = true,
    includeCitations = true,
  } = options;

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const maxWidth = pageWidth - 2 * margin;
  let yPosition = margin;

  // Funkcja dodawania nowej strony
  const addNewPageIfNeeded = (requiredSpace: number) => {
    if (yPosition + requiredSpace > pageHeight - margin) {
      doc.addPage();
      yPosition = margin;
      return true;
    }
    return false;
  };

  // Funkcja dodawania tekstu z zawijaniem
  const addText = (
    text: string,
    fontSize: number,
    fontStyle: "normal" | "bold" | "italic" = "normal",
    color: [number, number, number] = [0, 0, 0]
  ) => {
    doc.setFontSize(fontSize);
    doc.setFont("helvetica", fontStyle);
    doc.setTextColor(color[0], color[1], color[2]);

    const lines = doc.splitTextToSize(text, maxWidth);
    const lineHeight = fontSize * 0.5;

    lines.forEach((line: string) => {
      addNewPageIfNeeded(lineHeight);
      doc.text(line, margin, yPosition);
      yPosition += lineHeight;
    });
  };

  // Header - Logo i tytuł
  if (includeMetadata) {
    doc.setFillColor(59, 130, 246); // primary-500
    doc.rect(0, 0, pageWidth, 40, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont("helvetica", "bold");
    doc.text("Asystent Radnego", margin, 20);

    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text(title, margin, 30);

    yPosition = 50;

    // Metadata
    doc.setTextColor(100, 100, 100);
    doc.setFontSize(10);
    const date = new Date().toLocaleString("pl-PL", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    doc.text(`Data wygenerowania: ${date}`, margin, yPosition);
    yPosition += 10;

    // Separator
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 10;
  }

  // Parsowanie i formatowanie treści Markdown
  const lines = content.split("\n");

  for (const line of lines) {
    // Nagłówki H1
    if (line.startsWith("# ")) {
      yPosition += 5;
      addText(line.substring(2), 18, "bold", [59, 130, 246]);
      yPosition += 3;
    }
    // Nagłówki H2
    else if (line.startsWith("## ")) {
      yPosition += 4;
      addText(line.substring(3), 14, "bold", [0, 0, 0]);
      yPosition += 2;
    }
    // Nagłówki H3
    else if (line.startsWith("### ")) {
      yPosition += 3;
      addText(line.substring(4), 12, "bold", [0, 0, 0]);
      yPosition += 2;
    }
    // Listy
    else if (line.startsWith("- ") || line.startsWith("* ")) {
      addText(`  • ${line.substring(2)}`, 11, "normal");
    }
    // Listy numerowane
    else if (/^\d+\.\s/.test(line)) {
      addText(`  ${line}`, 11, "normal");
    }
    // Bold text (uproszczone)
    else if (line.includes("**")) {
      const cleaned = line.replace(/\*\*/g, "");
      addText(cleaned, 11, "bold");
    }
    // Puste linie
    else if (line.trim() === "") {
      yPosition += 3;
    }
    // Zwykły tekst
    else {
      addText(line, 11, "normal");
    }
  }

  // Cytaty/Źródła
  if (includeCitations && citations.length > 0) {
    yPosition += 10;
    addNewPageIfNeeded(30);

    // Separator
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 10;

    addText("📚 Źródła", 14, "bold", [59, 130, 246]);
    yPosition += 5;

    citations.forEach((citation, index) => {
      addNewPageIfNeeded(20);

      // Tytuł źródła
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(0, 0, 0);
      const citationTitle = `[${index + 1}] ${citation.documentTitle}`;
      const titleLines = doc.splitTextToSize(citationTitle, maxWidth - 5);
      titleLines.forEach((line: string) => {
        doc.text(line, margin + 5, yPosition);
        yPosition += 5;
      });

      // Treść cytatu
      doc.setFont("helvetica", "italic");
      doc.setTextColor(80, 80, 80);
      doc.setFontSize(9);
      const citationText = `"${citation.text.substring(0, 200)}${
        citation.text.length > 200 ? "..." : ""
      }"`;
      const textLines = doc.splitTextToSize(citationText, maxWidth - 5);
      textLines.forEach((line: string) => {
        doc.text(line, margin + 5, yPosition);
        yPosition += 4;
      });

      // Trafność
      if (citation.relevanceScore) {
        doc.setFont("helvetica", "normal");
        doc.setTextColor(34, 197, 94); // green-500
        doc.text(
          `Trafność: ${Math.round(citation.relevanceScore * 100)}%`,
          margin + 5,
          yPosition
        );
        yPosition += 4;
      }

      yPosition += 5;
    });
  }

  // Footer na każdej stronie
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`Strona ${i} z ${totalPages}`, pageWidth / 2, pageHeight - 10, {
      align: "center",
    });
    doc.text(
      "Wygenerowano przez Asystent Radnego",
      pageWidth / 2,
      pageHeight - 5,
      { align: "center" }
    );
  }

  // Pobierz plik
  const fileName = `${title.replace(/\s+/g, "_")}_${
    new Date().toISOString().split("T")[0]
  }.pdf`;
  doc.save(fileName);
}

/**
 * Eksportuje całą konwersację do PDF
 */
export async function exportConversationToPDF(
  messages: Array<{ role: string; content: string; citations?: Citation[] }>,
  title: string = "Konwersacja"
): Promise<void> {
  let fullContent = "";
  const allCitations: Citation[] = [];

  messages.forEach((msg, index) => {
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

  await exportToPDF(fullContent, allCitations, {
    title,
    includeMetadata: true,
    includeCitations: true,
  });
}
