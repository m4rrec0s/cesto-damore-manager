import React, { useEffect, useRef } from "react";
import { useEditor } from "../../hooks/useEditor";
import { fabricService } from "../../services/fabricService";
import type { FabricCanvas } from "../../types/fabric";
import { toast } from "sonner";

interface CanvasProps {
  baseImageUrl: string;
  width: number;
  height: number;
  onCanvasReady?: (canvas: FabricCanvas) => void;
  onObjectSelected?: (object: unknown) => void;
  onObjectModified?: () => void;
}

export function Canvas({
  baseImageUrl,
  width,
  height,
  onCanvasReady,
  onObjectSelected,
  onObjectModified,
}: CanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { setCanvas, setSelectedObject, addToHistory } = useEditor();

  useEffect(() => {
    const initializeCanvas = async () => {
      if (!canvasRef.current) return;

      try {
        const canvas = await fabricService.initCanvas(
          canvasRef.current,
          baseImageUrl,
          width,
          height
        );

        setCanvas(canvas);
        onCanvasReady?.(canvas);

        // Salvar estado inicial no histórico
        addToHistory(JSON.parse(fabricService.getCanvasState(canvas)));

        // Event listeners
        canvas.on("object:added", () => {
          addToHistory(JSON.parse(fabricService.getCanvasState(canvas)));
          onObjectModified?.();
        });

        canvas.on("object:modified", () => {
          addToHistory(JSON.parse(fabricService.getCanvasState(canvas)));
          onObjectModified?.();
        });

        canvas.on("object:removed", () => {
          addToHistory(JSON.parse(fabricService.getCanvasState(canvas)));
          onObjectModified?.();
        });

        canvas.on("selection:created", (e: unknown) => {
          const selected = (
            e as { selected?: Array<{ objectId?: string; id?: string }> }
          )?.selected?.[0];
          if (selected) {
            setSelectedObject(selected.objectId || selected.id || null);
            onObjectSelected?.(selected);
          }
        });

        canvas.on("selection:updated", (e: unknown) => {
          const selected = (
            e as { selected?: Array<{ objectId?: string; id?: string }> }
          )?.selected?.[0];
          if (selected) {
            setSelectedObject(selected.objectId || selected.id || null);
            onObjectSelected?.(selected);
          }
        });

        canvas.on("selection:cleared", () => {
          setSelectedObject(null);
        });
      } catch (error) {
        console.error("Erro ao inicializar canvas:", error);
        toast.error("Erro ao inicializar editor");
      }
    };

    initializeCanvas();

    return () => {
      // Cleanup se necessário
    };
  }, [
    baseImageUrl,
    width,
    height,
    setCanvas,
    setSelectedObject,
    addToHistory,
    onCanvasReady,
    onObjectSelected,
    onObjectModified,
  ]);

  return (
    <div className="flex items-center justify-center w-full h-full bg-gray-100 rounded-lg border-2 border-dashed border-gray-300 p-4">
      <canvas
        ref={canvasRef}
        className="border border-gray-400 bg-white shadow-lg rounded max-w-full max-h-full"
      />
    </div>
  );
}
