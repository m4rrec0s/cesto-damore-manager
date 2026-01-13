import React, { useState } from "react";
import {
  Plus,
  Type,
  Image,
  Square,
  Circle,
  Trash2,
  Copy,
  Undo,
  Redo,
  Download,
  Save,
} from "lucide-react";
import { useEditor } from "../../hooks/useEditor";
import { fabricService } from "../../services/fabricService";
import { toast } from "sonner";
import { Button } from "../ui/button";

interface ToolbarProps {
  onAddText?: () => void;
  onAddImage?: () => void;
  onSave?: () => void;
  isSaving?: boolean;
}

export function Toolbar({
  onAddText,
  onAddImage,
  onSave,
  isSaving,
}: ToolbarProps) {
  const { state, undo, redo } = useEditor();
  const [isDrawing, setIsDrawing] = useState(false);

  const handleAddText = async () => {
    if (!state.canvas) {
      toast.error("Canvas não inicializado");
      return;
    }

    await fabricService.addText(state.canvas as unknown as never, "Novo Texto");
    onAddText?.();
  };

  const handleAddShape = async (shapeType: "rect" | "circle") => {
    if (!state.canvas) {
      toast.error("Canvas não inicializado");
      return;
    }

    await fabricService.addShape(state.canvas as unknown as never, shapeType);
  };

  const handleDelete = () => {
    if (!state.canvas) return;

    if (fabricService.deleteSelected(state.canvas as unknown as never)) {
      toast.success("Elemento deletado");
    } else {
      toast.error("Selecione um elemento para deletar");
    }
  };

  const handleDuplicate = async () => {
    if (!state.canvas) return;

    const cloned = await fabricService.duplicateSelected(
      state.canvas as unknown as never
    );
    if (cloned) {
      toast.success("Elemento duplicado");
    } else {
      toast.error("Selecione um elemento para duplicar");
    }
  };

  const handleExport = () => {
    if (!state.canvas) {
      toast.error("Canvas não inicializado");
      return;
    }

    const imageUrl = fabricService.exportAsImage(
      state.canvas as unknown as never
    );
    const link = document.createElement("a");
    link.href = imageUrl;
    link.download = "design.png";
    link.click();
    toast.success("Imagem exportada");
  };

  const handleToggleDrawing = async () => {
    if (!state.canvas) return;

    if (isDrawing) {
      fabricService.disableDrawing(state.canvas as unknown as never);
      setIsDrawing(false);
      toast.success("Modo desenho desativado");
    } else {
      await fabricService.enableDrawing(state.canvas as unknown as never);
      setIsDrawing(true);
      toast.success("Modo desenho ativado");
    }
  };

  const canUndo = state.currentHistoryIndex > 0;
  const canRedo = state.currentHistoryIndex < state.history.length - 1;

  return (
    <div className="flex items-center gap-2 p-4 bg-white border-b border-gray-200 rounded-t-lg shadow-sm flex-wrap">
      {/* Adicionar elementos */}
      <div className="flex items-center gap-2 border-r border-gray-200 pr-4">
        <Button
          variant="outline"
          size="sm"
          onClick={handleAddText}
          title="Adicionar texto"
          className="gap-2"
        >
          <Type size={18} />
          <span className="hidden sm:inline">Texto</span>
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={onAddImage}
          title="Adicionar imagem"
          className="gap-2"
        >
          <Image size={18} />
          <span className="hidden sm:inline">Imagem</span>
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={() => handleAddShape("rect")}
          title="Adicionar retângulo"
          className="gap-2"
        >
          <Square size={18} />
          <span className="hidden sm:inline">Retângulo</span>
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={() => handleAddShape("circle")}
          title="Adicionar círculo"
          className="gap-2"
        >
          <Circle size={18} />
          <span className="hidden sm:inline">Círculo</span>
        </Button>
      </div>

      {/* Editar elementos */}
      <div className="flex items-center gap-2 border-r border-gray-200 pr-4">
        <Button
          variant="outline"
          size="sm"
          onClick={handleDuplicate}
          title="Duplicar elemento selecionado"
          className="gap-2"
        >
          <Copy size={18} />
          <span className="hidden sm:inline">Duplicar</span>
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={handleDelete}
          title="Deletar elemento selecionado"
          className="gap-2 text-red-600 hover:text-red-700"
        >
          <Trash2 size={18} />
          <span className="hidden sm:inline">Deletar</span>
        </Button>
      </div>

      {/* Histórico */}
      <div className="flex items-center gap-2 border-r border-gray-200 pr-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => undo()}
          disabled={!canUndo}
          title="Desfazer (Ctrl+Z)"
          className="gap-2"
        >
          <Undo size={18} />
          <span className="hidden sm:inline">Desfazer</span>
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={() => redo()}
          disabled={!canRedo}
          title="Refazer (Ctrl+Y)"
          className="gap-2"
        >
          <Redo size={18} />
          <span className="hidden sm:inline">Refazer</span>
        </Button>
      </div>

      {/* Exportar e Salvar */}
      <div className="flex items-center gap-2 ml-auto">
        <Button
          variant="outline"
          size="sm"
          onClick={handleExport}
          title="Exportar como PNG"
          className="gap-2"
        >
          <Download size={18} />
          <span className="hidden sm:inline">Exportar</span>
        </Button>

        <Button
          onClick={onSave}
          disabled={isSaving || !state.isDirty}
          title="Salvar layout"
          className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
        >
          <Save size={18} />
          <span className="hidden sm:inline">
            {isSaving ? "Salvando..." : "Salvar"}
          </span>
        </Button>
      </div>
    </div>
  );
}
