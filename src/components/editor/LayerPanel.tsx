import { Reorder, useDragControls } from "framer-motion";
import { Eye, EyeOff, Lock, Unlock, Trash2, GripVertical } from "lucide-react";
import { useState, useEffect } from "react";

interface LayerPanelProps {
  canvas: any;
  selectedObjectId: string | null;
  onSelect: (obj: any) => void;
  onLayersChanged?: () => void;
}

export function LayerPanel({ canvas, selectedObjectId, onSelect, onLayersChanged }: LayerPanelProps) {
  const [layers, setLayers] = useState<any[]>([]);

  // Atualizar camadas quando canvas muda
  useEffect(() => {
    if (!canvas) return;

    const updateLayers = () => {
      const objects = canvas.getObjects().map((obj: any, index: number) => {
        return {
          id: obj.id || obj.name || `layer-${index}-${Math.random()}`,
          name: obj.name || `${obj.type || "Objeto"} ${index + 1}`,
          type: obj.type || "unknown",
          visible: obj.opacity > 0,
          locked: obj.selectable === false,
          opacity: obj.opacity || 1,
          order: index,
          object: obj,
        };
      });

      setLayers([...objects].reverse()); // Mostrar do topo para baixo na UI
    };

    updateLayers();

    canvas.on("object:added", updateLayers);
    canvas.on("object:removed", updateLayers);
    canvas.on("object:modified", updateLayers);
    canvas.on("selection:created", updateLayers);
    canvas.on("selection:updated", updateLayers);
    canvas.on("selection:cleared", updateLayers);

    return () => {
      canvas.off("object:added", updateLayers);
      canvas.off("object:removed", updateLayers);
      canvas.off("object:modified", updateLayers);
      canvas.off("selection:created", updateLayers);
      canvas.off("selection:updated", updateLayers);
      canvas.off("selection:cleared", updateLayers);
    };
  }, [canvas]);

  const handleReorder = (newLayers: any[]) => {
    if (!canvas) return;

    // newLayers está invertido (topo primeiro)
    const correctlyOrdered = [...newLayers].reverse();

    correctlyOrdered.forEach((layer, index) => {
      canvas.moveObjectTo(layer.object, index);
    });

    canvas.renderAll();
    setLayers(newLayers);
    onLayersChanged?.();
  };

  const handleToggleVisibility = (layer: any) => {
    if (!canvas) return;
    layer.object.set({
      opacity: layer.visible ? 0 : (layer.object.lastOpacity || 1),
      selectable: !layer.visible,
      evented: !layer.visible,
    });
    if (layer.visible) {
      layer.object.lastOpacity = layer.opacity;
    }
    canvas.renderAll();
    onLayersChanged?.();
  };

  const handleToggleLock = (layer: any) => {
    if (!canvas) return;
    layer.object.set({
      selectable: !layer.locked,
      evented: !layer.locked,
      lockMovementX: !layer.locked,
      lockMovementY: !layer.locked,
    });
    canvas.renderAll();
    onLayersChanged?.();
  };

  const handleDeleteLayer = (layer: any) => {
    if (!canvas) return;
    canvas.remove(layer.object);
    canvas.renderAll();
    onLayersChanged?.();
  };

  return (
    <div className="flex flex-col h-full bg-neutral-900 text-white">
      <div className="p-4 border-b border-neutral-800">
        <h3 className="font-bold text-xs uppercase tracking-wider text-neutral-500">Camadas</h3>
      </div>

      <div className="flex-1 overflow-y-auto p-2 scrollbar-hide">
        <Reorder.Group axis="y" values={layers} onReorder={handleReorder} className="space-y-1">
          {layers.map((layer) => (
            <Reorder.Item
              key={layer.id}
              value={layer}
              className={`p-2 rounded border transition-all cursor-pointer group flex items-center gap-2 ${selectedObjectId === layer.id
                ? "border-rose-500 bg-rose-500/10"
                : "border-neutral-800 bg-neutral-800/50 hover:border-neutral-700"
                }`}
              onClick={() => onSelect(layer.object)}
            >
              <GripVertical className="h-4 w-4 text-neutral-600 cursor-grab active:cursor-grabbing" />

              <div className="w-6 h-6 rounded bg-neutral-700 flex items-center justify-center text-[10px] font-bold text-neutral-400 shrink-0">
                {layer.type === 'i-text' ? 'T' : layer.type === 'image' ? 'I' : 'S'}
              </div>

              <span className="flex-1 text-xs truncate">
                {layer.name}
              </span>

              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => { e.stopPropagation(); handleToggleVisibility(layer); }}
                  className="p-1 hover:bg-neutral-700 rounded text-neutral-400"
                >
                  {layer.visible ? <Eye size={12} /> : <EyeOff size={12} />}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleToggleLock(layer); }}
                  className="p-1 hover:bg-neutral-700 rounded text-neutral-400"
                >
                  {layer.locked ? <Lock size={12} /> : <Unlock size={12} />}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDeleteLayer(layer); }}
                  className="p-1 hover:bg-neutral-700 rounded text-rose-500"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </Reorder.Item>
          ))}
        </Reorder.Group>

        {layers.length === 0 && (
          <div className="flex flex-col items-center justify-center h-40 text-neutral-600">
            <p className="text-xs italic">Nenhuma camada</p>
          </div>
        )}
      </div>
    </div>
  );
}
