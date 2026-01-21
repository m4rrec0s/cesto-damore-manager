import {
  X,
  Search,
  Square,
  Circle,
  Triangle,
  Image as ImageIcon,
  Type,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LayerPanel } from "./LayerPanel";

interface DesignPanelsProps {
  activePanel: string | null;
  onClose: () => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  handleAddShape: (
    type: "rect" | "circle" | "triangle" | "frame" | "frame-circle",
  ) => void;
  handleAddText?: (type: "title" | "subtitle" | "body", font?: string) => void;
  bankElements: any[];
  userUploads: any[];
  onAddBankElement: (url: string) => void;
  onImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDeleteUpload?: (id: string) => void;
  // Novos para Camadas e Design
  canvas?: any;
  selectedObjectId?: string | null;
  onSelectObject?: (obj: any) => void;
  canvasBg?: string;
  onCanvasBgChange?: (color: string) => void;
  isTransparent?: boolean;
  onToggleTransparency?: (val: boolean) => void;
}

export const DesignPanels = ({
  activePanel,
  onClose,
  searchQuery,
  setSearchQuery,
  handleAddShape,
  handleAddText,
  bankElements,
  userUploads,
  onAddBankElement,
  onImageUpload,
  onDeleteUpload,
  canvas,
  selectedObjectId,
  onSelectObject,
  canvasBg = "#ffffff",
  onCanvasBgChange,
  isTransparent = false,
  onToggleTransparency,
}: DesignPanelsProps) => {
  if (!activePanel) return null;

  return (
    <aside className="w-72 bg-neutral-900 border-r border-neutral-800 flex flex-col shrink-0 animate-in slide-in-from-left-1 text-white">
      <div className="p-4 flex items-center justify-between border-b border-neutral-800">
        <h2 className="font-bold text-sm">{activePanel}</h2>
        <X className="h-4 w-4 cursor-pointer" onClick={onClose} />
      </div>

      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        {activePanel === "Elementos" && (
          <div className="flex flex-col gap-4">
            <div className="relative">
              <Search className="h-4 w-4 absolute left-2 top-2.5 text-neutral-500" />
              <Input
                placeholder="Buscar elementos..."
                className="pl-8 h-9 text-xs"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleAddShape("rect")}
                className="p-3 bg-neutral-800 rounded flex flex-col items-center gap-1 hover:bg-neutral-700 transition-colors"
              >
                <Square className="h-5 w-5" />
                <span className="text-[10px]">Quadrado</span>
              </button>
              <button
                onClick={() => handleAddShape("circle")}
                className="p-3 bg-neutral-800 rounded flex flex-col items-center gap-1 hover:bg-neutral-700 transition-colors"
              >
                <Circle className="h-5 w-5" />
                <span className="text-[10px]">Círculo</span>
              </button>
              <button
                onClick={() => handleAddShape("triangle")}
                className="p-3 bg-neutral-800 rounded flex flex-col items-center gap-1 hover:bg-neutral-700 transition-colors"
              >
                <Triangle className="h-5 w-5" />
                <span className="text-[10px]">Triângulo</span>
              </button>
              <button
                onClick={() => handleAddShape("frame")}
                className="p-3 bg-rose-900/40 border border-rose-500/30 rounded flex flex-col items-center gap-1 hover:bg-rose-900/60 transition-colors"
                title="Moldura Retangular (Padrão)"
              >
                <Square className="h-5 w-5 text-rose-400" />
                <span className="text-[10px]">Moldura Rec</span>
              </button>
              <button
                onClick={() => handleAddShape("frame-circle")}
                className="p-3 bg-rose-900/40 border border-rose-500/30 rounded flex flex-col items-center gap-1 hover:bg-rose-900/60 transition-colors"
                title="Moldura Circular"
              >
                <Circle className="h-5 w-5 text-rose-400" />
                <span className="text-[10px]">Moldura Circ</span>
              </button>
            </div>

            <div className="mt-4">
              <h3 className="text-[10px] font-bold text-neutral-500 uppercase mb-2">
                Banco de Elementos
              </h3>
              <div className="grid grid-cols-3 gap-2">
                {bankElements.map((el) => (
                  <div
                    key={el.id}
                    className="aspect-square bg-neutral-800 rounded overflow-hidden cursor-pointer hover:ring-2 hover:ring-blue-500 transition-all"
                    onClick={() => onAddBankElement(el.imageUrl)}
                  >
                    <img
                      src={el.thumbnailUrl || el.imageUrl}
                      alt={el.name}
                      className="w-full h-full object-contain p-1"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activePanel === "Uploads" && (
          <div className="flex flex-col gap-4">
            <Button
              onClick={() =>
                document.getElementById("img-upload-inner")?.click()
              }
              className="w-full h-10 gap-2"
            >
              <ImageIcon className="h-4 w-4" />
              Fazer Upload
            </Button>
            <Input
              id="img-upload-inner"
              type="file"
              className="hidden"
              onChange={onImageUpload}
              accept="image/*"
            />

            {userUploads.length > 0 && (
              <div className="mt-2">
                <h3 className="text-[10px] font-bold text-neutral-500 uppercase mb-2">
                  Seus Uploads
                </h3>
                <div className="grid grid-cols-3 gap-2">
                  {userUploads.map((up) => (
                    <div
                      key={up.id}
                      className="group relative aspect-square bg-neutral-800 rounded overflow-hidden cursor-pointer hover:ring-2 hover:ring-rose-500 transition-all"
                    >
                      <img
                        src={up.imageUrl}
                        className="w-full h-full object-cover"
                        alt="Upload"
                        onClick={() => onAddBankElement(up.imageUrl)}
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onDeleteUpload) onDeleteUpload(up.id);
                        }}
                        className="absolute top-1 right-1 p-1 bg-red-500 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                        title="Excluir imagem"
                      >
                        <Trash2 className="h-3 w-3 text-white" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-neutral-800/50 p-3 rounded-lg border border-neutral-700">
              <p className="text-[10px] text-neutral-400 text-center leading-relaxed">
                Suporta JPG, PNG e WebP até 5MB.
                <br />
                Suas imagens ficam salvas na VPS.
              </p>
            </div>
          </div>
        )}

        {activePanel === "Texto" && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <h3 className="text-[10px] font-bold text-neutral-500 uppercase">
                Estilos Rápidos
              </h3>
              <Button
                onClick={() => handleAddText?.("title")}
                className="p-3 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-left transition-colors"
              >
                <h2 className="text-xl font-bold">Título</h2>
              </Button>
              <Button
                onClick={() => handleAddText?.("subtitle")}
                className="p-3 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-left transition-colors"
              >
                <h3 className="text-lg font-bold">Subtítulo</h3>
              </Button>
              <Button
                onClick={() => handleAddText?.("body")}
                className="p-3 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-left transition-colors"
              >
                <p className="text-sm">Um pouquinho de texto</p>
              </Button>
            </div>

            <div className="pt-4 border-t border-neutral-800">
              <h3 className="text-[10px] font-bold text-neutral-500 uppercase mb-3">
                Fontes Populares
              </h3>
              <div className="flex flex-col gap-1">
                {[
                  "Inter",
                  "Roboto",
                  "Playfair Display",
                  "Lobster",
                  "Pacifico",
                ].map((font) => (
                  <Button
                    key={font}
                    className="flex items-center justify-between p-2 hover:bg-neutral-800 rounded text-xs transition-colors"
                    onClick={() => handleAddText?.("body", font)}
                    style={{ fontFamily: font }}
                  >
                    {font}
                    <Type className="h-3 w-3 text-neutral-600" />
                  </Button>
                ))}
              </div>
            </div>
          </div>
        )}

        {activePanel === "Camadas" && (
          <LayerPanel
            canvas={canvas}
            selectedObjectId={selectedObjectId || null}
            onSelect={onSelectObject!}
          />
        )}

        {activePanel === "Design" && (
          <div className="flex flex-col gap-4">
            <h3 className="text-[10px] font-bold text-neutral-500 uppercase">
              Configurações de Fundo
            </h3>

            <div className="bg-neutral-800 p-4 rounded-lg flex flex-col gap-4 border border-neutral-700">
              <div className="flex items-center justify-between">
                <span className="text-xs">Fundo Transparente</span>
                <Input
                  type="checkbox"
                  checked={isTransparent}
                  onChange={(e) => onToggleTransparency?.(e.target.checked)}
                  className="w-4 h-4 accent-rose-500"
                />
              </div>

              {!isTransparent && (
                <div className="flex flex-col gap-2">
                  <span className="text-xs">Cor de Fundo</span>
                  <div className="flex gap-2 items-center">
                    <input
                      title="colors"
                      type="color"
                      value={canvasBg}
                      onChange={(e) => onCanvasBgChange?.(e.target.value)}
                      className="w-10 h-10 rounded bg-transparent border-0 cursor-pointer"
                    />
                    <input
                      title="colors"
                      value={canvasBg}
                      onChange={(e) => onCanvasBgChange?.(e.target.value)}
                      className="h-9 text-xs font-mono flex-1 bg-neutral-900 border-neutral-700"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="bg-rose-900/20 p-3 rounded-lg border border-rose-500/20">
              <p className="text-[10px] text-rose-300 leading-relaxed">
                <Sparkles className="h-3 w-3 inline mr-1 mb-0.5" />
                Dica: Layouts com fundo transparente funcionam melhor para
                adesivos e recortes personalizados.
              </p>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
