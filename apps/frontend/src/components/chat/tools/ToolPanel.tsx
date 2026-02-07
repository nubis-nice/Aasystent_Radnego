"use client";

/**
 * ToolPanel - Uniwersalny panel narzędzia dla ChatAI
 * Dynamicznie renderuje formularz na podstawie konfiguracji narzędzia
 */

import { useState, useEffect } from "react";
import { X, Loader2, Download, FileText, RotateCcw } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ToolConfig, ToolFieldConfig } from "@/config/tools-config";
import type { ToolFormData } from "@/hooks/useToolMode";

interface ToolPanelProps {
  config: ToolConfig;
  formData: ToolFormData;
  generatedContent: string | null;
  isGenerating: boolean;
  onFieldChange: (fieldId: string, value: string | number) => void;
  onGenerate: () => void;
  onReset: () => void;
  onClose: () => void;
  onExportPDF?: () => void;
  onExportDOCX?: () => void;
}

export function ToolPanel({
  config,
  formData,
  generatedContent,
  isGenerating,
  onFieldChange,
  onGenerate,
  onReset,
  onClose,
  onExportPDF,
  onExportDOCX,
}: ToolPanelProps) {
  const [showOutput, setShowOutput] = useState(false);

  const IconComponent = config.icon;

  // Obsługa klawisza Escape i blokowanie scrollowania body
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const isFormValid = config.fields
    .filter((f) => f.required)
    .every((f) => {
      const value = formData[f.id];
      return value !== undefined && String(value).trim() !== "";
    });

  const handleGenerate = () => {
    if (!isFormValid) return;
    setShowOutput(true);
    onGenerate();
  };

  const renderField = (field: ToolFieldConfig) => {
    const value = formData[field.id] ?? "";
    const baseInputClass =
      "w-full px-3 py-2 border border-secondary-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors text-sm";

    switch (field.type) {
      case "text":
        return (
          <input
            type="text"
            id={field.id}
            value={String(value)}
            onChange={(e) => onFieldChange(field.id, e.target.value)}
            placeholder={field.placeholder}
            className={baseInputClass}
          />
        );

      case "textarea":
        return (
          <textarea
            id={field.id}
            value={String(value)}
            onChange={(e) => onFieldChange(field.id, e.target.value)}
            placeholder={field.placeholder}
            rows={4}
            className={`${baseInputClass} resize-none`}
          />
        );

      case "select":
        return (
          <select
            id={field.id}
            value={String(value)}
            onChange={(e) => onFieldChange(field.id, e.target.value)}
            className={baseInputClass}
          >
            {field.options?.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        );

      case "number":
        return (
          <input
            type="number"
            id={field.id}
            value={value}
            onChange={(e) => onFieldChange(field.id, Number(e.target.value))}
            placeholder={field.placeholder}
            className={baseInputClass}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay tła */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Modal - 80% szerokości z resize */}
      <div
        className="relative w-[80vw] min-w-[400px] max-w-[1400px] max-h-[90vh] bg-white rounded-2xl shadow-2xl overflow-auto animate-in zoom-in-95 fade-in duration-200"
        style={{ resize: "both" }}
      >
        {/* Header */}
        <div
          className={`bg-gradient-to-r ${config.color} px-5 py-4 flex items-center justify-between`}
        >
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center">
              <IconComponent className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-white font-bold text-lg">{config.name}</h2>
              <p className="text-white/80 text-sm">{config.description}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-white/20 transition-colors"
            title="Zamknij narzędzie (Esc)"
          >
            <X className="h-5 w-5 text-white" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {!showOutput || !generatedContent ? (
            /* Formularz */
            <div className="space-y-4">
              {config.fields.map((field) => (
                <div key={field.id}>
                  <label
                    htmlFor={field.id}
                    className="block text-sm font-medium text-secondary-700 mb-1"
                  >
                    {field.label}
                    {field.required && (
                      <span className="text-red-500 ml-1">*</span>
                    )}
                  </label>
                  {renderField(field)}
                </div>
              ))}

              {/* Przyciski */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleGenerate}
                  disabled={!isFormValid || isGenerating}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all ${
                    isFormValid && !isGenerating
                      ? `bg-gradient-to-r ${config.color} text-white hover:shadow-lg`
                      : "bg-secondary-100 text-secondary-400 cursor-not-allowed"
                  }`}
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Generowanie...
                    </>
                  ) : (
                    <>
                      <IconComponent className="h-4 w-4" />
                      {config.generateButtonLabel}
                    </>
                  )}
                </button>
                <button
                  onClick={onReset}
                  className="px-4 py-2.5 rounded-lg border border-secondary-200 text-secondary-600 hover:bg-secondary-50 transition-colors"
                  title="Resetuj formularz"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : (
            /* Wynik */
            <div className="space-y-4">
              {/* Przycisk powrotu do formularza */}
              <button
                onClick={() => setShowOutput(false)}
                className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
              >
                ← Wróć do formularza
              </button>

              {/* Wygenerowana treść - formatowanie Markdown */}
              <div className="bg-white rounded-xl border border-secondary-200 p-5 max-h-[500px] overflow-y-auto shadow-sm">
                <div
                  className="prose prose-sm max-w-none
                prose-headings:text-slate-800 prose-headings:font-bold
                prose-h1:text-lg prose-h1:mb-3 prose-h1:pb-2 prose-h1:border-b prose-h1:border-slate-200
                prose-h2:text-base prose-h2:mt-4 prose-h2:mb-2 prose-h2:text-slate-700
                prose-h3:text-sm prose-h3:mt-3 prose-h3:mb-1 prose-h3:text-slate-600 prose-h3:font-semibold
                prose-h4:text-sm prose-h4:mt-2 prose-h4:mb-1 prose-h4:text-slate-600
                prose-p:text-slate-700 prose-p:leading-relaxed prose-p:mb-2
                prose-ul:my-2 prose-ul:pl-4 prose-ol:my-2 prose-ol:pl-4
                prose-li:my-0.5 prose-li:text-slate-700 prose-li:marker:text-primary-500
                prose-strong:text-slate-800 prose-strong:font-semibold
                prose-em:text-slate-600
                prose-code:bg-slate-100 prose-code:text-primary-700 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs
                prose-blockquote:border-l-4 prose-blockquote:border-primary-400 prose-blockquote:bg-primary-50/50 prose-blockquote:py-1 prose-blockquote:px-3 prose-blockquote:rounded-r-lg prose-blockquote:italic prose-blockquote:text-slate-600
                prose-table:border-collapse prose-th:bg-slate-100 prose-th:px-2 prose-th:py-1 prose-th:text-left prose-th:text-xs prose-th:font-semibold prose-td:px-2 prose-td:py-1 prose-td:border prose-td:border-slate-200 prose-td:text-sm
                prose-hr:border-slate-200 prose-hr:my-4"
                >
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {generatedContent
                      .replace(/<br\s*\/?>/gi, "\n")
                      .replace(/<\/?p>/gi, "\n")
                      .replace(/<\/?div>/gi, "\n")
                      .replace(/\n{3,}/g, "\n\n")}
                  </ReactMarkdown>
                </div>
              </div>

              {/* Eksport */}
              <div className="flex gap-3 pt-2 border-t border-secondary-100">
                {onExportPDF && (
                  <button
                    onClick={onExportPDF}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg border border-secondary-200 text-secondary-700 hover:bg-secondary-50 transition-colors text-sm"
                  >
                    <Download className="h-4 w-4" />
                    Eksport PDF
                  </button>
                )}
                {onExportDOCX && (
                  <button
                    onClick={onExportDOCX}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg border border-secondary-200 text-secondary-700 hover:bg-secondary-50 transition-colors text-sm"
                  >
                    <FileText className="h-4 w-4" />
                    Eksport DOCX
                  </button>
                )}
                <button
                  onClick={onReset}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-secondary-200 text-secondary-700 hover:bg-secondary-50 transition-colors text-sm ml-auto"
                >
                  <RotateCcw className="h-4 w-4" />
                  Nowy dokument
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Sekcje wyjściowe (info) */}
        {!generatedContent && (
          <div className="px-4 pb-4">
            <div className="bg-secondary-50 rounded-lg p-3">
              <p className="text-xs text-secondary-500 mb-2">
                Wygenerowany dokument będzie zawierał:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {config.outputSections.map((section, idx) => (
                  <span
                    key={idx}
                    className="text-xs bg-white px-2 py-1 rounded border border-secondary-200 text-secondary-600"
                  >
                    {section}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
