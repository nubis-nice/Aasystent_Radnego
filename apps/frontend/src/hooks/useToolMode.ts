/**
 * useToolMode - Hook do zarządzania trybem narzędzia w czacie
 */

import { useState, useCallback, useMemo } from "react";
import {
  type ToolType,
  type ToolConfig,
  getToolConfig,
  isValidToolType,
} from "@/config/tools-config";

export interface ToolFormData {
  [fieldId: string]: string | number;
}

export interface ToolModeState {
  isActive: boolean;
  toolType: ToolType | null;
  toolConfig: ToolConfig | null;
  formData: ToolFormData;
  generatedContent: string | null;
  isGenerating: boolean;
}

export interface UseToolModeReturn {
  state: ToolModeState;
  activateTool: (toolType: ToolType | string) => boolean;
  activateToolWithData: (
    toolType: ToolType | string,
    formData: Record<string, string>,
  ) => boolean;
  deactivateTool: () => void;
  updateFormField: (fieldId: string, value: string | number) => void;
  resetForm: () => void;
  setGeneratedContent: (content: string | null) => void;
  setIsGenerating: (isGenerating: boolean) => void;
  buildPrompt: () => string | null;
}

const initialState: ToolModeState = {
  isActive: false,
  toolType: null,
  toolConfig: null,
  formData: {},
  generatedContent: null,
  isGenerating: false,
};

export function useToolMode(): UseToolModeReturn {
  const [state, setState] = useState<ToolModeState>(initialState);

  const activateTool = useCallback((toolType: ToolType | string): boolean => {
    if (!isValidToolType(toolType)) {
      console.warn(`[useToolMode] Invalid tool type: ${toolType}`);
      return false;
    }

    const config = getToolConfig(toolType);
    if (!config) {
      console.warn(`[useToolMode] No config found for tool: ${toolType}`);
      return false;
    }

    // Inicjalizuj formData z domyślnymi wartościami
    const initialFormData: ToolFormData = {};
    config.fields.forEach((field) => {
      if (field.defaultValue !== undefined) {
        initialFormData[field.id] = field.defaultValue;
      } else {
        initialFormData[field.id] = "";
      }
    });

    setState({
      isActive: true,
      toolType,
      toolConfig: config,
      formData: initialFormData,
      generatedContent: null,
      isGenerating: false,
    });

    console.log(`[useToolMode] Activated tool: ${toolType}`);
    return true;
  }, []);

  // Aktywacja narzędzia z wstępnymi danymi z kontekstu rozmowy
  const activateToolWithData = useCallback(
    (
      toolType: ToolType | string,
      prefillData: Record<string, string>,
    ): boolean => {
      if (!isValidToolType(toolType)) {
        console.warn(`[useToolMode] Invalid tool type: ${toolType}`);
        return false;
      }

      const config = getToolConfig(toolType);
      if (!config) {
        console.warn(`[useToolMode] No config found for tool: ${toolType}`);
        return false;
      }

      // Inicjalizuj formData z domyślnymi wartościami
      const initialFormData: ToolFormData = {};
      config.fields.forEach((field) => {
        // Najpierw sprawdź czy mamy dane z kontekstu dla tego pola
        if (prefillData[field.id]) {
          initialFormData[field.id] = prefillData[field.id];
        } else if (field.defaultValue !== undefined) {
          initialFormData[field.id] = field.defaultValue;
        } else {
          initialFormData[field.id] = "";
        }
      });

      setState({
        isActive: true,
        toolType,
        toolConfig: config,
        formData: initialFormData,
        generatedContent: null,
        isGenerating: false,
      });

      console.log(
        `[useToolMode] Activated tool with data: ${toolType}`,
        prefillData,
      );
      return true;
    },
    [],
  );

  const deactivateTool = useCallback(() => {
    setState(initialState);
    console.log("[useToolMode] Tool deactivated");
  }, []);

  const updateFormField = useCallback(
    (fieldId: string, value: string | number) => {
      setState((prev) => ({
        ...prev,
        formData: {
          ...prev.formData,
          [fieldId]: value,
        },
      }));
    },
    [],
  );

  const resetForm = useCallback(() => {
    setState((prev) => {
      if (!prev.toolConfig) return prev;

      const initialFormData: ToolFormData = {};
      prev.toolConfig.fields.forEach((field) => {
        if (field.defaultValue !== undefined) {
          initialFormData[field.id] = field.defaultValue;
        } else {
          initialFormData[field.id] = "";
        }
      });

      return {
        ...prev,
        formData: initialFormData,
        generatedContent: null,
      };
    });
  }, []);

  const setGeneratedContent = useCallback((content: string | null) => {
    setState((prev) => ({
      ...prev,
      generatedContent: content,
    }));
  }, []);

  const setIsGenerating = useCallback((isGenerating: boolean) => {
    setState((prev) => ({
      ...prev,
      isGenerating,
    }));
  }, []);

  const buildPrompt = useCallback((): string | null => {
    if (!state.toolConfig || !state.toolType) return null;

    const { toolConfig, formData } = state;
    let prompt = `[NARZĘDZIE: ${toolConfig.name.toUpperCase()}]\n\n`;

    // Dodaj wartości pól do promptu
    toolConfig.fields.forEach((field) => {
      const value = formData[field.id];
      if (value && String(value).trim()) {
        prompt += `**${field.label}:** ${value}\n`;
      }
    });

    prompt += `\n---\n\n`;
    prompt += `Proszę wygeneruj ${toolConfig.name.toLowerCase()} zgodnie z powyższymi danymi.\n`;
    prompt += `Struktura powinna zawierać następujące sekcje:\n`;
    toolConfig.outputSections.forEach((section, index) => {
      prompt += `${index + 1}. ${section}\n`;
    });

    return prompt;
  }, [state]);

  return useMemo(
    () => ({
      state,
      activateTool,
      activateToolWithData,
      deactivateTool,
      updateFormField,
      resetForm,
      setGeneratedContent,
      setIsGenerating,
      buildPrompt,
    }),
    [
      state,
      activateTool,
      activateToolWithData,
      deactivateTool,
      updateFormField,
      resetForm,
      setGeneratedContent,
      setIsGenerating,
      buildPrompt,
    ],
  );
}
