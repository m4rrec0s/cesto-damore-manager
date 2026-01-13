import React, { useState, useEffect } from "react";
import { useEditor } from "../../hooks/useEditor";
import { Eye, EyeOff, Lock, Unlock, Trash2 } from "lucide-react";
import { Button } from "../ui/button";

interface LayerPanelProps {
  onLayersChanged?: () => void;
}

export function LayerPanel({ onLayersChanged }: LayerPanelProps) {
  const { state } = useEditor();
  const [layers, setLayers] = useState<
    Array<{
      id: string;
      name: string;
      type: string;
      visible: boolean;
      locked: boolean;
      opacity: number;
      order: number;
      object: unknown;
    }>
  >([]);

  // Atualizar camadas quando canvas muda
  useEffect(() => {
    if (!state.canvas) return;

    const updateLayers = () => {
      const canvas = state.canvas as unknown as { getObjects: () => unknown[] };
      const objects = canvas.getObjects().map((obj: unknown, index: number) => {
        const objTyped = obj as unknown as {
          objectId?: string;
          id?: string;
          name?: string;
          type?: string;
          opacity?: number;
          selectable?: boolean;
        };
        return {
          id: objTyped.objectId || objTyped.id || `layer-${index}`,
          name: objTyped.name || `${objTyped.type || "Objeto"} ${index + 1}`,
          type: objTyped.type || "unknown",
          visible: !objTyped.opacity || objTyped.opacity > 0,
          locked: objTyped.selectable === false,
          opacity: objTyped.opacity || 1,
          order: index,
          object: obj,
        };
      });

      setLayers(objects.reverse()); // Mostrar do topo para baixo
    };

    updateLayers();

    // Listener para mudanças
    const fabricCanvas = state.canvas as unknown as {
      on: (event: string, callback: () => void) => void;
      off: (event: string, callback: () => void) => void;
    };
    fabricCanvas.on("object:added", updateLayers);
    fabricCanvas.on("object:removed", updateLayers);
    fabricCanvas.on("object:modified", updateLayers);

    return () => {
      fabricCanvas.off("object:added", updateLayers);
      fabricCanvas.off("object:removed", updateLayers);
      fabricCanvas.off("object:modified", updateLayers);
    };
  }, [state.canvas]);

  const handleToggleVisibility = (layer: {
    object: unknown;
    visible: boolean;
  }) => {
    if (!state.canvas) return;

    const obj = layer.object as unknown as { set: (v: unknown) => void };
    obj.set({
      opacity: layer.visible ? 0 : 1,
      selectable: !layer.visible,
    });

    (state.canvas as unknown as { renderAll: () => void }).renderAll();
    onLayersChanged?.();
  };

  const handleToggleLock = (layer: { object: unknown; locked: boolean }) => {
    if (!state.canvas) return;

    const obj = layer.object as unknown as { set: (v: unknown) => void };
    obj.set({
      selectable: !layer.locked,
      evented: !layer.locked,
    });

    (state.canvas as unknown as { renderAll: () => void }).renderAll();
    onLayersChanged?.();
  };

  const handleSelectLayer = (layer: { object: unknown; id: string }) => {
    if (!state.canvas) return;

    (
      state.canvas as unknown as { setActiveObject: (obj: unknown) => void }
    ).setActiveObject(layer.object);
    (state.canvas as unknown as { renderAll: () => void }).renderAll();
  };

  const handleDeleteLayer = (layer: { object: unknown; order: number }) => {
    if (!state.canvas) return;

    const fabricCanvas = state.canvas as unknown as {
      remove: (obj: unknown) => void;
      renderAll: () => void;
    };
    fabricCanvas.remove(layer.object);
    fabricCanvas.renderAll();
    onLayersChanged?.();
  };

  const handleMoveUp = (layer: { object: unknown }) => {
    if (!state.canvas) return;

    const fabricCanvas = state.canvas as unknown as {
      bringToFront: (obj: unknown) => void;
      renderAll: () => void;
    };
    fabricCanvas.bringToFront(layer.object);
    fabricCanvas.renderAll();
    onLayersChanged?.();
  };

  const handleMoveDown = (layer: { object: unknown }) => {
    if (!state.canvas) return;

    const fabricCanvas = state.canvas as unknown as {
      sendToBack: (obj: unknown) => void;
      renderAll: () => void;
    };
    fabricCanvas.sendToBack(layer.object);
    fabricCanvas.renderAll();
    onLayersChanged?.();
  };

  return (
    <div className="flex flex-col h-full bg-white border-l border-gray-200">
      <div className="p-4 border-b border-gray-200">
        <h3 className="font-semibold text-lg">Camadas</h3>
        <p className="text-xs text-gray-500">
          {layers.length} camada{layers.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Lista de camadas */}
      <div className="flex-1 overflow-y-auto">
        {layers.length > 0 ? (
          <div className="space-y-1 p-2">
            {layers.map((layer) => (
              <div
                key={layer.id}
                className={`p-3 rounded-lg border transition-all cursor-pointer group ${
                  state.selectedObjectId === layer.id
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
                onClick={() => handleSelectLayer(layer)}
              >
                <div className="flex items-center gap-2 mb-2">
                  {/* Ícone de tipo */}
                  <div className="w-6 h-6 rounded bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600">
                    {layer.type.charAt(0).toUpperCase()}
                  </div>

                  {/* Nome */}
                  <span className="flex-1 text-sm font-medium truncate">
                    {layer.name}
                  </span>

                  {/* Botões */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {/* Visibilidade */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleVisibility(layer);
                      }}
                      className="h-6 w-6 p-0"
                      title={layer.visible ? "Ocultar" : "Mostrar"}
                    >
                      {layer.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                    </Button>

                    {/* Lock */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleLock(layer);
                      }}
                      className="h-6 w-6 p-0"
                      title={layer.locked ? "Desbloquear" : "Bloquear"}
                    >
                      {layer.locked ? <Lock size={14} /> : <Unlock size={14} />}
                    </Button>

                    {/* Delete */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteLayer(layer);
                      }}
                      className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                      title="Deletar"
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>

                {/* Slider de opacidade */}
                <div className="flex items-center gap-2">
                  <label
                    htmlFor={`opacity-${layer.id}`}
                    className="text-xs text-gray-500"
                  >
                    Opacidade
                  </label>
                  <input
                    id={`opacity-${layer.id}`}
                    type="range"
                    min="0"
                    max="100"
                    value={layer.opacity * 100}
                    onChange={(e) => {
                      if (!state.canvas) return;
                      const opacity = parseFloat(e.target.value) / 100;
                      (
                        layer.object as never as { set: (v: unknown) => void }
                      ).set({ opacity });
                      (
                        state.canvas as never as { renderAll: () => void }
                      ).renderAll();
                    }}
                    className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                  />
                  <span className="text-xs text-gray-500 w-8 text-right">
                    {Math.round(layer.opacity * 100)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <p className="text-sm">Nenhuma camada adicionada</p>
          </div>
        )}
      </div>

      {/* Footer com info */}
      {layers.length > 0 && (
        <div className="p-4 border-t border-gray-200 bg-gray-50 text-xs text-gray-600">
          <p>Clique para selecionar uma camada</p>
        </div>
      )}
    </div>
  );
}
