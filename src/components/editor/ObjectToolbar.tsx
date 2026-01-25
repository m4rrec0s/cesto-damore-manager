import {
  Trash2,
  Copy,
  Sun,
  ArrowUp,
  ArrowDown,
  Palette,
  Type,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { Input } from "../ui/input";

const FONT_FAMILIES = [
  "Arial",
  "Times New Roman",
  "Courier New",
  "Roboto",
  "Open Sans",
  "Lato",
  "Montserrat",
  "Poppins",
  "Great Vibes",
  "Dancing Script",
  "Pacifico",
  "Luckiest Guy",
  "Bangers",
  "Black Ops One",
  "BBH Bartle",
  "Pinyon Script",
  "Rubik Scribble",
  "Metamorphous",
];

const PRESET_COLORS = [
  "#000000", // Black
  "#FFFFFF", // White
  "#FF0000", // Red
  "#00FF00", // Green
  "#0000FF", // Blue
  "#FFFF00", // Yellow
  "#FF00FF", // Magenta
  "#00FFFF", // Cyan
  "#FFA500", // Orange
  "#800080", // Purple
  "#FFC0CB", // Pink
  "#A52A2A", // Brown
];

interface ObjectToolbarProps {
  selectedObject: any;
  onDelete: () => void;
  onClone: () => void;
  onUpdate: (key: string, value: any) => void;
  updateNonce?: number;
  onBringToFront: () => void;
  onSendToBack: () => void;
}

const SeparatorVertical = () => (
  <span className="h-8 w-0.5 bg-white/30 z-10 rounded mx-2"></span>
);

export const ObjectToolbar = ({
  selectedObject,
  onDelete,
  onClone,
  onUpdate,
  updateNonce,
  onBringToFront,
  onSendToBack,
}: ObjectToolbarProps) => {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [localOpacity, setLocalOpacity] = useState(
    selectedObject?.opacity ?? 1,
  );
  const [localFill, setLocalFill] = useState(selectedObject?.fill ?? "#000000");

  // Sincronizar estados locais quando o objeto selecionado muda ou nonce é atualizado
  useEffect(() => {
    if (selectedObject) {
      setLocalOpacity(selectedObject.opacity ?? 1);
      setLocalFill(selectedObject.fill ?? "#000000");
    }
  }, [
    selectedObject?.id || selectedObject?.name || selectedObject?.type,
    updateNonce,
  ]);

  if (!selectedObject) return null;

  const type = selectedObject.type;
  const opacity = localOpacity;
  const fill = localFill;
  const fontSize = selectedObject.fontSize ?? 24;

  return (
    <div
      className="bg-neutral-800 rounded-full border border-neutral-700 flex items-center p-3 gap-4 animate-in fade-in slide-in-from-top-1 shrink-0 text-white"
      onClick={(e) => e.stopPropagation()}
    >
      <Trash2
        className="h-4 w-4 cursor-pointer hover:text-red-500"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
      />
      <Copy
        className="h-4 w-4 cursor-pointer hover:text-blue-400"
        onClick={(e) => {
          e.stopPropagation();
          onClone();
        }}
      />
      <SeparatorVertical />
      <div className="flex items-center gap-2">
        <Sun className="h-4 w-4" />
        <Input
          type="range"
          min="0"
          max="1"
          step="0.1"
          value={opacity}
          onChange={(e) => {
            e.stopPropagation();
            const newOpacity = parseFloat(e.target.value);
            setLocalOpacity(newOpacity);
            onUpdate("opacity", newOpacity);
          }}
          onClick={(e) => e.stopPropagation()}
          className="w-16"
        />
      </div>
      <Button
        size="sm"
        variant="ghost"
        onClick={(e) => {
          e.stopPropagation();
          onBringToFront();
        }}
        title="Trazer para frente"
      >
        <ArrowUp className="h-3 w-3" />
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={(e) => {
          e.stopPropagation();
          onSendToBack();
        }}
        title="Enviar para trás"
      >
        <ArrowDown className="h-3 w-3" />
      </Button>

      {(type === "i-text" ||
        type === "textbox" ||
        type === "rect" ||
        type === "circle" ||
        type === "triangle") && (
        <>
          <SeparatorVertical />
          <div className="relative">
            <Button
              onClick={(e) => {
                e.stopPropagation();
                setShowColorPicker(!showColorPicker);
              }}
              className="flex items-center gap-2 p-2 hover:bg-neutral-700 rounded transition-colors"
            >
              <Palette className="h-4 w-4" />
              <div
                className="w-5 h-5 rounded border border-neutral-600"
                style={{
                  backgroundColor: typeof fill === "string" ? fill : "#000000",
                }}
              />
            </Button>

            {showColorPicker && (
              <div
                className="absolute top-full left-0 mt-2 bg-neutral-900 border border-neutral-700 rounded-lg p-3 z-50 w-48"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="grid grid-cols-4 gap-2 mb-3">
                  {PRESET_COLORS.map((color) => (
                    <Button
                      key={color}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setLocalFill(color);
                        onUpdate("fill", color);
                        setShowColorPicker(false);
                      }}
                      className="w-8 h-8 rounded border-2 border-neutral-600 hover:border-white transition-colors"
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                </div>

                <div className="border-t border-neutral-700 pt-3">
                  <label className="text-[10px] text-neutral-400 block mb-2">
                    Cor personalizada
                  </label>
                  <Input
                    title="color"
                    type="color"
                    value={typeof fill === "string" ? fill : "#000000"}
                    onChange={(e) => {
                      e.stopPropagation();
                      const newColor = e.target.value;
                      setLocalFill(newColor);
                      onUpdate("fill", newColor);
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full h-8 rounded cursor-pointer border-none"
                  />
                </div>
              </div>
            )}
          </div>

          {(type === "i-text" || type === "textbox") && (
            <>
              <SeparatorVertical />
              <Type className="h-4 w-4" />
              <select
                title="Font Family"
                className="bg-neutral-700 text-xs px-1 h-7 rounded max-w-25"
                value={selectedObject.fontFamily || "Arial"}
                onChange={(e) => {
                  e.stopPropagation();
                  onUpdate("fontFamily", e.target.value);
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {FONT_FAMILIES.map((font) => (
                  <option key={font} value={font}>
                    {font}
                  </option>
                ))}
              </select>

              <select
                title="Font Size"
                className="bg-neutral-700 text-xs px-1 h-7 rounded"
                value={fontSize}
                onChange={(e) => {
                  e.stopPropagation();
                  onUpdate("fontSize", parseInt(e.target.value));
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {[
                  8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 64, 72, 96,
                ].map((s) => (
                  <option key={s} value={s}>
                    {s}px
                  </option>
                ))}
              </select>

              <SeparatorVertical />
              <div className="flex items-center bg-neutral-700/50 rounded p-0.5">
                <Button
                  size="sm"
                  variant={
                    selectedObject.fontWeight === "bold"
                      ? "isSelected"
                      : "ghost"
                  }
                  className="dark h-7 w-7 p-0"
                  onClick={() =>
                    onUpdate(
                      "fontWeight",
                      selectedObject.fontWeight === "bold" ? "normal" : "bold",
                    )
                  }
                >
                  <span className="font-bold text-xs text-white">B</span>
                </Button>
                <Button
                  size="sm"
                  variant={
                    selectedObject.fontStyle === "italic"
                      ? "isSelected"
                      : "ghost"
                  }
                  className="dark h-7 w-7 p-0"
                  onClick={() =>
                    onUpdate(
                      "fontStyle",
                      selectedObject.fontStyle === "italic"
                        ? "normal"
                        : "italic",
                    )
                  }
                >
                  <span className="italic text-xs text-white">I</span>
                </Button>
                <Button
                  size="sm"
                  variant={selectedObject.underline ? "isSelected" : "ghost"}
                  className="dark h-7 w-7 p-0"
                  onClick={() =>
                    onUpdate("underline", !selectedObject.underline)
                  }
                >
                  <span className="underline text-xs text-white">U</span>
                </Button>
              </div>

              <SeparatorVertical />
              <div className="flex items-center bg-neutral-700/50 rounded p-0.5">
                <Button
                  size="sm"
                  variant={
                    selectedObject.textAlign === "left" ? "isSelected" : "ghost"
                  }
                  className="dark h-7 w-7 p-0"
                  onClick={() => onUpdate("textAlign", "left")}
                >
                  <span className="text-[10px] text-white">L</span>
                </Button>
                <Button
                  size="sm"
                  variant={
                    selectedObject.textAlign === "center"
                      ? "isSelected"
                      : "ghost"
                  }
                  className="dark h-7 w-7 p-0"
                  onClick={() => onUpdate("textAlign", "center")}
                >
                  <span className="text-[10px] text-white">C</span>
                </Button>
                <Button
                  size="sm"
                  variant={
                    selectedObject.textAlign === "right"
                      ? "isSelected"
                      : "ghost"
                  }
                  className="dark h-7 w-7 p-0"
                  onClick={() => onUpdate("textAlign", "right")}
                >
                  <span className="text-[10px] text-white">R</span>
                </Button>
              </div>

              <SeparatorVertical />
              <div className="flex flex-col gap-0.5 pr-2">
                <div className="flex items-center gap-2">
                  <span className="text-[8px] text-neutral-400 w-4">LH</span>
                  <Input
                    type="range"
                    min="0.5"
                    max="3"
                    step="0.1"
                    value={selectedObject.lineHeight || 1.16}
                    onChange={(e) =>
                      onUpdate("lineHeight", parseFloat(e.target.value))
                    }
                    className="w-12 h-1 accent-rose-500"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[8px] text-neutral-400 w-4">LS</span>
                  <Input
                    type="range"
                    min="-100"
                    max="500"
                    step="10"
                    value={selectedObject.charSpacing || 0}
                    onChange={(e) =>
                      onUpdate("charSpacing", parseInt(e.target.value))
                    }
                    className="w-12 h-1 accent-rose-500"
                  />
                </div>
              </div>
            </>
          )}

          <SeparatorVertical />
          <div className="flex items-center gap-3 px-2 py-1 bg-neutral-700/50 rounded-lg">
            <div className="flex items-center gap-2">
              <label className="text-[10px] uppercase font-bold text-neutral-400">
                Customizável
              </label>
              <Input
                type="checkbox"
                checked={!!selectedObject.isCustomizable}
                onChange={(e) => {
                  onUpdate("isCustomizable", e.target.checked);
                }}
                className="w-4 h-4 rounded bg-neutral-800 border-neutral-600 focus:ring-rose-500 text-rose-500"
              />
            </div>

            {selectedObject.isCustomizable && (
              <div className="flex items-center gap-2 border-l border-neutral-600 pl-3">
                <label className="text-[10px] uppercase font-bold text-neutral-400 whitespace-nowrap">
                  Label/ID
                </label>
                <Input
                  type="text"
                  value={selectedObject.name || ""}
                  placeholder="Ex: Foto 1"
                  onChange={(e) => {
                    onUpdate("name", e.target.value);
                  }}
                  className="w-20 bg-neutral-800 text-[10px] rounded px-1 py-0.5 border border-neutral-600 outline-none"
                />
              </div>
            )}

            {(type === "rect" || type === "circle" || type === "triangle") && (
              <div className="flex items-center gap-2 border-l border-neutral-600 pl-3">
                <label className="text-[10px] uppercase font-bold text-neutral-400 whitespace-nowrap">
                  Moldura?
                </label>
                <Input
                  type="checkbox"
                  checked={selectedObject.isFrame || false}
                  onChange={(e) => {
                    const val = e.target.checked;
                    onUpdate("isFrame", val);
                    if (val) {
                      onUpdate("isCustomizable", true);
                      onUpdate("fill", "rgba(229, 231, 235, 1)");
                      onUpdate("stroke", "#9ca3af");
                      onUpdate("strokeWidth", 2);
                      onUpdate("strokeDashArray", [5, 5]);
                    } else {
                      onUpdate("strokeDashArray", null);
                    }
                  }}
                  className="w-4 h-4 rounded bg-neutral-800 border-neutral-600 focus:ring-rose-500 text-rose-500"
                />
              </div>
            )}

            {(type === "i-text" || type === "textbox") &&
              selectedObject.isCustomizable && (
                <div className="flex items-center gap-2 border-l border-neutral-600 pl-3">
                  <label className="text-[10px] uppercase font-bold text-neutral-400">
                    Lim.
                  </label>
                  <Input
                    type="number"
                    value={selectedObject.maxChars || 50}
                    onChange={(e) => {
                      onUpdate("maxChars", parseInt(e.target.value) || 50);
                    }}
                    className="w-12 bg-neutral-800 text-[10px] rounded px-1 py-0.5 border border-neutral-600 outline-none"
                    min="1"
                    max="500"
                  />
                </div>
              )}

            {(type === "rect" || selectedObject.isFrame) && (
              <div className="flex items-center gap-2 border-l border-neutral-600 pl-3">
                <label className="text-[10px] uppercase font-bold text-neutral-400 whitespace-nowrap">
                  Raio
                </label>
                <Input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={selectedObject.rx || 0}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    onUpdate("rx", val);
                    onUpdate("ry", val);
                  }}
                  className="w-16"
                />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
