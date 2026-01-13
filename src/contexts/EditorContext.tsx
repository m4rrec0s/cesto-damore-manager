import React, { createContext, useContext, useState, useCallback } from "react";
import type { FabricCanvas } from "../types/fabric";

export interface EditorObject {
  id: string;
  type: "text" | "image" | "shape";
  data: Record<string, unknown>;
  order: number;
  isLocked: boolean;
}

export interface EditorState {
  canvas: FabricCanvas | null;
  selectedObjectId: string | null;
  history: Record<string, unknown>[];
  currentHistoryIndex: number;
  isDirty: boolean;
  isLoading: boolean;
  error: string | null;
}

interface EditorContextType {
  state: EditorState;
  setCanvas: (canvas: FabricCanvas | null) => void;
  setSelectedObject: (id: string | null) => void;
  addToHistory: (state: Record<string, unknown>) => void;
  undo: () => void;
  redo: () => void;
  setDirty: (dirty: boolean) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

const EditorContext = createContext<EditorContextType | undefined>(undefined);

export function EditorProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<EditorState>({
    canvas: null,
    selectedObjectId: null,
    history: [],
    currentHistoryIndex: -1,
    isDirty: false,
    isLoading: false,
    error: null,
  });

  const setCanvas = useCallback((canvas: FabricCanvas | null) => {
    setState((prev) => ({ ...prev, canvas }));
  }, []);

  const setSelectedObject = useCallback((id: string | null) => {
    setState((prev) => ({ ...prev, selectedObjectId: id }));
  }, []);

  const addToHistory = useCallback((canvasState: Record<string, unknown>) => {
    setState((prev) => {
      const newHistory = prev.history.slice(0, prev.currentHistoryIndex + 1);
      newHistory.push(canvasState);

      return {
        ...prev,
        history: newHistory,
        currentHistoryIndex: newHistory.length - 1,
        isDirty: true,
      };
    });
  }, []);

  const undo = useCallback(() => {
    setState((prev) => {
      if (prev.currentHistoryIndex > 0) {
        return {
          ...prev,
          currentHistoryIndex: prev.currentHistoryIndex - 1,
          isDirty: true,
        };
      }
      return prev;
    });
  }, []);

  const redo = useCallback(() => {
    setState((prev) => {
      if (prev.currentHistoryIndex < prev.history.length - 1) {
        return {
          ...prev,
          currentHistoryIndex: prev.currentHistoryIndex + 1,
          isDirty: true,
        };
      }
      return prev;
    });
  }, []);

  const setDirty = useCallback((dirty: boolean) => {
    setState((prev) => ({ ...prev, isDirty: dirty }));
  }, []);

  const setLoading = useCallback((loading: boolean) => {
    setState((prev) => ({ ...prev, isLoading: loading }));
  }, []);

  const setError = useCallback((error: string | null) => {
    setState((prev) => ({ ...prev, error }));
  }, []);

  const value: EditorContextType = {
    state,
    setCanvas,
    setSelectedObject,
    addToHistory,
    undo,
    redo,
    setDirty,
    setLoading,
    setError,
  };

  return (
    <EditorContext.Provider value={value}>{children}</EditorContext.Provider>
  );
}

function useEditorContext() {
  const context = useContext(EditorContext);
  if (!context) {
    throw new Error("useEditorContext deve ser usado dentro de EditorProvider");
  }
  return context;
}

export default useEditorContext;
