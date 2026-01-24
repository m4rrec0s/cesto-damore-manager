import React, { useState, useCallback, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../../contexts/useAuth";
import { useEditor } from "../../hooks/useEditor";
import { Canvas } from "./Canvas.tsx";
import { Toolbar } from "./Toolbar.tsx";
import { ElementPalette } from "./ElementPalette.tsx";
import { LayerPanel } from "./LayerPanel.tsx";
import { useApi } from "../../services/api";
import { fabricService } from "../../services/fabricService";
import { toast } from "sonner";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";

interface Layout {
  id: string;
  name: string;
  type: string;
  baseImageUrl: string;
  fabricJsonState: Record<string, unknown>;
  width: number;
  height: number;
  previewImageUrl?: string;
  tags: string[];
}

/**
 * DesignEditor - Editor visual completo com Fabric.js
 * Suporta criação, edição e salvamento de layouts
 */
export function DesignEditor() {
  const { layoutId } = useParams<{ layoutId: string }>();
  const { user } = useAuth();
  const { state, setError, setLoading, setDirty } = useEditor();

  // Estados
  const [layout, setLayout] = useState<Layout | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showImageDialog, setShowImageDialog] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [showSaveDialog, setShowSaveDialog] = useState(!layoutId);

  // Carregar layout existente
  useEffect(() => {
    if (!layoutId) return;

    const loadLayout = async () => {
      try {
        setLoading(true);
        // Usar API local para carregar layout
        const response = await fetch(`/layouts/dynamic/${layoutId}`);
        if (!response.ok) throw new Error("Layout não encontrado");
        const data = await response.json();
        setLayout(data);

        // Restaurar estado do Fabric
        if (state.canvas && data.fabricJsonState) {
          await fabricService.restoreCanvasState(
            state.canvas as unknown as never,
            data.fabricJsonState,
          );
        }
      } catch (error: unknown) {
        const err = error as { message?: string };
        console.error("Erro ao carregar layout:", err);
        setError(err.message || "Erro ao carregar layout");
      } finally {
        setLoading(false);
      }
    };

    loadLayout();
  }, [layoutId, state.canvas, setLoading, setError]);

  // Handle save
  const handleSave = useCallback(async () => {
    if (!state.canvas || !layout) {
      toast.error("Canvas ou layout não inicializado");
      return;
    }

    try {
      setIsSaving(true);

      // Gerar preview
      const previewImageUrl = fabricService.exportAsImage(
        state.canvas as unknown as never,
      );

      // Preparar dados
      const fabricJsonState = fabricService.getCanvasState(
        state.canvas as unknown as never,
      );

      if (layoutId) {
        // Atualizar layout existente
        const response = await fetch(`/layouts/dynamic/${layoutId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: layout.name,
            fabricJsonState,
            previewImageUrl,
            tags: layout.tags,
          }),
        });
        if (!response.ok) throw new Error("Erro ao atualizar layout");
        const updated = await response.json();

        setLayout(updated);
        toast.success("Layout atualizado com sucesso");
      } else {
        // Criar novo layout
        if (!layout.name || !layout.baseImageUrl) {
          toast.error("Preencha nome e imagem base");
          return;
        }

        const response = await fetch("/layouts/dynamic", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: layout.name,
            type: layout.type,
            baseImageUrl: layout.baseImageUrl,
            fabricJsonState,
            width: layout.width,
            height: layout.height,
            tags: layout.tags,
          }),
        });
        if (!response.ok) throw new Error("Erro ao criar layout");
        const created = await response.json();

        setLayout(created);
        toast.success("Layout criado com sucesso");
        setShowSaveDialog(false);
      }

      setDirty(false);
    } catch (error: unknown) {
      const err = error as { message?: string };
      console.error("Erro ao salvar:", err);
      toast.error(err.message || "Erro ao salvar layout");
    } finally {
      setIsSaving(false);
    }
  }, [state.canvas, layout, layoutId, setDirty]);

  // Handle add image
  const handleAddImage = useCallback(async () => {
    if (!imageUrl) {
      toast.error("Digite uma URL de imagem");
      return;
    }

    if (!state.canvas) {
      toast.error("Canvas não inicializado");
      return;
    }

    try {
      await fabricService.addImage(state.canvas as unknown as never, imageUrl);
      toast.success("Imagem adicionada");
      setShowImageDialog(false);
      setImageUrl("");
    } catch (error) {
      console.error("Erro ao adicionar imagem:", error);
      toast.error("Erro ao adicionar imagem");
    }
  }, [state.canvas, imageUrl]);

  const handleLayoutNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLayout((prev) => (prev ? { ...prev, name: e.target.value } : null));
  };

  if (!layout && layoutId) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-500">Carregando layout...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <Input
              value={layout?.name || ""}
              onChange={handleLayoutNameChange}
              placeholder="Nome do layout"
              className="text-xl font-semibold w-full max-w-md"
            />
            <p className="text-sm text-gray-500 mt-2">
              Tipo: {layout?.type} • {layout?.width}x{layout?.height}px
            </p>
          </div>

          <div className="flex items-center gap-2">
            {state.isDirty && (
              <span className="text-xs text-orange-600 font-medium">
                Não salvo
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Toolbar */}
      {state.canvas && (
        <Toolbar
          onSave={handleSave}
          isSaving={isSaving}
          onAddImage={() => setShowImageDialog(true)}
        />
      )}

      {/* Editor Area */}
      <div className="flex-1 flex gap-4 p-4 overflow-hidden">
        {/* Canvas */}
        <div className="flex-1 flex flex-col min-w-0">
          {layout ? (
            <Canvas
              baseImageUrl={layout.baseImageUrl}
              width={layout.width}
              height={layout.height}
              onObjectModified={() => setDirty(true)}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              <p>Configure o layout para começar</p>
            </div>
          )}
        </div>

        {/* Right Panels */}
        <div className="flex gap-4 w-80">
          {/* Element Palette */}
          <div className="flex-1 rounded-lg overflow-hidden shadow-lg">
            <ElementPalette onElementAdded={() => setDirty(true)} />
          </div>

          {/* Layer Panel */}
          <div className="flex-1 rounded-lg overflow-hidden shadow-lg">
            <LayerPanel
              canvas={state.canvas}
              selectedObjectId={state.selectedObjectId}
              onSelect={(obj) => {
                if (state.canvas) {
                  (state.canvas as any).setActiveObject(obj);
                  (state.canvas as any).renderAll();
                }
              }}
              onLayersChanged={() => setDirty(true)}
            />
          </div>
        </div>
      </div>

      {/* Dialog - Adicionar Imagem */}
      <Dialog open={showImageDialog} onOpenChange={setShowImageDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Imagem</DialogTitle>
            <DialogDescription>
              Cole a URL de uma imagem para adicionar ao canvas
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Input
              placeholder="https://example.com/image.png"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddImage();
              }}
            />

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setShowImageDialog(false)}
              >
                Cancelar
              </Button>
              <Button onClick={handleAddImage}>Adicionar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog - Salvar Novo Layout */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar Novo Layout</DialogTitle>
            <DialogDescription>
              Configure as informações básicas do seu novo layout
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Nome</label>
              <Input
                placeholder="Ex: Caneca Café"
                value={layout?.name || ""}
                onChange={handleLayoutNameChange}
              />
            </div>

            <div>
              <label htmlFor="layout-type" className="text-sm font-medium">
                Tipo
              </label>
              <select
                id="layout-type"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                value={layout?.type || "custom"}
                onChange={(e) =>
                  setLayout(
                    (prev) =>
                      prev && {
                        ...prev,
                        type: e.target.value,
                      },
                  )
                }
              >
                <option value="mug">Caneca</option>
                <option value="frame">Moldura</option>
                <option value="custom">Customizado</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-medium">URL Imagem Base</label>
              <Input
                placeholder="https://example.com/base.png"
                value={layout?.baseImageUrl || ""}
                onChange={(e) =>
                  setLayout(
                    (prev) =>
                      prev && {
                        ...prev,
                        baseImageUrl: e.target.value,
                      },
                  )
                }
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setShowSaveDialog(false)}
              >
                Cancelar
              </Button>
              <Button onClick={() => setShowSaveDialog(false)}>
                Prosseguir
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
