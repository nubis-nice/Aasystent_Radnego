import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
} from "docx";

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
 * Parsuje Markdown do paragrafów DOCX
 */
function parseMarkdownToParagraphs(content: string): Paragraph[] {
  const paragraphs: Paragraph[] = [];
  const lines = content.split("\n");

  for (const line of lines) {
    // Nagłówki H1
    if (line.startsWith("# ")) {
      paragraphs.push(
        new Paragraph({
          text: line.substring(2),
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400, after: 200 },
        }),
      );
    }
    // Nagłówki H2
    else if (line.startsWith("## ")) {
      paragraphs.push(
        new Paragraph({
          text: line.substring(3),
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 300, after: 150 },
        }),
      );
    }
    // Nagłówki H3
    else if (line.startsWith("### ")) {
      paragraphs.push(
        new Paragraph({
          text: line.substring(4),
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 200, after: 100 },
        }),
      );
    }
    // Listy
    else if (line.startsWith("- ") || line.startsWith("* ")) {
      paragraphs.push(
        new Paragraph({
          text: line.substring(2),
          bullet: { level: 0 },
          spacing: { before: 50, after: 50 },
        }),
      );
    }
    // Listy numerowane
    else if (/^\d+\.\s/.test(line)) {
      paragraphs.push(
        new Paragraph({
          text: line.replace(/^\d+\.\s/, ""),
          numbering: { reference: "default-numbering", level: 0 },
          spacing: { before: 50, after: 50 },
        }),
      );
    }
    // Puste linie
    else if (line.trim() === "") {
      paragraphs.push(
        new Paragraph({
          text: "",
          spacing: { before: 100, after: 100 },
        }),
      );
    }
    // Tekst z formatowaniem
    else {
      const runs: TextRun[] = [];
      const currentText = line;

      // Uproszczone parsowanie bold (**text**)
      const boldRegex = /\*\*(.*?)\*\*/g;
      let lastIndex = 0;
      let match;

      while ((match = boldRegex.exec(line)) !== null) {
        // Tekst przed bold
        if (match.index > lastIndex) {
          runs.push(
            new TextRun({
              text: line.substring(lastIndex, match.index),
            }),
          );
        }
        // Bold text
        runs.push(
          new TextRun({
            text: match[1],
            bold: true,
          }),
        );
        lastIndex = match.index + match[0].length;
      }

      // Pozostały tekst
      if (lastIndex < line.length) {
        runs.push(
          new TextRun({
            text: line.substring(lastIndex),
          }),
        );
      }

      // Jeśli nie ma formatowania, dodaj jako zwykły tekst
      if (runs.length === 0) {
        runs.push(new TextRun({ text: currentText }));
      }

      paragraphs.push(
        new Paragraph({
          children: runs,
          spacing: { before: 100, after: 100 },
        }),
      );
    }
  }

  return paragraphs;
}

/**
 * Eksportuje treść do DOCX
 */
export async function exportToDOCX(
  content: string,
  citations: Citation[] = [],
  options: ExportOptions = {},
): Promise<void> {
  const {
    title = "Dokument",
    includeMetadata = true,
    includeCitations = true,
  } = options;

  const sections: Paragraph[] = [];

  // Header - Tytuł i metadata
  if (includeMetadata) {
    sections.push(
      new Paragraph({
        text: "Asystent Radnego",
        heading: HeadingLevel.TITLE,
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
      }),
    );

    sections.push(
      new Paragraph({
        text: title,
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 },
      }),
    );

    const date = new Date().toLocaleString("pl-PL", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    sections.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `Data wygenerowania: ${date}`,
            italics: true,
            color: "666666",
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 },
        border: {
          bottom: {
            color: "CCCCCC",
            space: 1,
            style: BorderStyle.SINGLE,
            size: 6,
          },
        },
      }),
    );
  }

  // Treść główna
  const contentParagraphs = parseMarkdownToParagraphs(content);
  sections.push(...contentParagraphs);

  // Cytaty/Źródła
  if (includeCitations && citations.length > 0) {
    sections.push(
      new Paragraph({
        text: "",
        spacing: { before: 600, after: 200 },
        border: {
          top: {
            color: "CCCCCC",
            space: 1,
            style: BorderStyle.SINGLE,
            size: 6,
          },
        },
      }),
    );

    sections.push(
      new Paragraph({
        text: "📚 Źródła",
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 200, after: 300 },
      }),
    );

    citations.forEach((citation, index) => {
      // Tytuł źródła
      sections.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `[${index + 1}] ${citation.documentTitle}`,
              bold: true,
            }),
          ],
          spacing: { before: 200, after: 100 },
        }),
      );

      // Treść cytatu
      sections.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `"${citation.text.substring(0, 200)}${
                citation.text.length > 200 ? "..." : ""
              }"`,
              italics: true,
              color: "555555",
            }),
          ],
          spacing: { before: 50, after: 50 },
        }),
      );

      // Trafność
      if (citation.relevanceScore) {
        sections.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `Trafność: ${Math.round(citation.relevanceScore * 100)}%`,
                color: "22C55E",
              }),
            ],
            spacing: { before: 50, after: 100 },
          }),
        );
      }
    });
  }

  // Utwórz dokument
  const doc = new Document({
    sections: [
      {
        properties: {},
        children: sections,
      },
    ],
  });

  // Generuj i pobierz
  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${title.replace(/\s+/g, "_")}_${
    new Date().toISOString().split("T")[0]
  }.docx`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Eksportuje całą konwersację do DOCX
 */
export async function exportConversationToDOCX(
  messages: Array<{ role: string; content: string; citations?: Citation[] }>,
  title: string = "Konwersacja",
): Promise<void> {
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
              (c) => c.documentTitle === citation.documentTitle,
            )
          ) {
            allCitations.push(citation);
          }
        });
      }
    }
  });

  await exportToDOCX(fullContent, allCitations, {
    title,
    includeMetadata: true,
    includeCitations: true,
  });
}
