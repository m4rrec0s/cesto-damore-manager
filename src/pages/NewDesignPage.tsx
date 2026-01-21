import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Palette,
  Coffee,
  Image as ImageIcon,
  LayoutGrid,
  Square,
  Film,
  Loader2Icon,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { layoutApiService } from "@/services/layoutApiService";
import { toast } from "sonner";

const DESIGN_TEMPLATES = [
  {
    id: "caneca",
    name: "Caneca",
    description: "20 x 9.4 cm",
    icon: Coffee,
    width: 20,
    height: 9.4,
  },
  {
    id: "quadro",
    name: "Quadro",
    description: "10 x 15 cm",
    icon: Square,
    width: 10,
    height: 15,
  },
  {
    id: "poster",
    name: "Pôster",
    description: "50 x 70 cm",
    icon: LayoutGrid,
    width: 50,
    height: 70,
  },
  {
    id: "custom",
    name: "Personalizado",
    description: "Suas dimensões",
    icon: Palette,
    width: null,
    height: null,
  },
];

interface Design {
  id: string;
  name: string;
  width: number;
  height: number;
  baseImageUrl: string;
  previewImageUrl?: string;
  isPublished?: boolean;
}

export function NewDesignPage() {
  const navigate = useNavigate();
  const [showCustom, setShowCustom] = useState(false);
  const [customWidth, setCustomWidth] = useState("20");
  const [customHeight, setCustomHeight] = useState("20");
  const [designs, setDesigns] = useState<Design[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedDesigns, setSelectedDesigns] = useState<Set<string>>(
    new Set(),
  );
  const [isActionLoading, setIsActionLoading] = useState(false);

  // Gerar imagem base64 branca para preview
  const generateWhiteBase64 = () => {
    const canvas = document.createElement("canvas");
    canvas.width = 200;
    canvas.height = 200;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#f5f5f5";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    return canvas.toDataURL("image/png");
  };

  useEffect(() => {
    const token =
      localStorage.getItem("token") || localStorage.getItem("appToken") || "";

    try {
      setIsLoading(true);
      layoutApiService.listLayouts({ token }).then((response) => {
        setDesigns(Array.isArray(response) ? response : response.data || []);
      });
      setIsLoading(false);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleSelectDesign = (designId: string) => {
    const newSelected = new Set(selectedDesigns);
    if (newSelected.has(designId)) {
      newSelected.delete(designId);
    } else {
      newSelected.add(designId);
    }
    setSelectedDesigns(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedDesigns.size === designs.length) {
      setSelectedDesigns(new Set());
    } else {
      const allIds = new Set(designs.map((d: Design) => d.id));
      setSelectedDesigns(allIds);
    }
  };

  const handleDeleteSelected = async () => {
    if (
      !window.confirm(
        `Tem certeza que deseja excluir ${selectedDesigns.size} design(s)?`,
      )
    ) {
      return;
    }

    try {
      setIsActionLoading(true);
      const token =
        localStorage.getItem("token") || localStorage.getItem("appToken") || "";

      for (const designId of selectedDesigns) {
        await layoutApiService.deleteLayout(designId, token);
      }

      setDesigns(designs.filter((d: Design) => !selectedDesigns.has(d.id)));
      setSelectedDesigns(new Set());
      toast.success(
        `${selectedDesigns.size} design(s) excluído(s) com sucesso`,
      );
    } catch (error) {
      console.error("Error deleting designs:", error);
      toast.error("Erro ao excluir designs: " + (error as Error).message);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleTogglePublish = async (published: boolean) => {
    try {
      setIsActionLoading(true);
      const token =
        localStorage.getItem("token") || localStorage.getItem("appToken") || "";

      await Promise.all(
        Array.from(selectedDesigns).map((designId) =>
          layoutApiService.updateLayout(designId, {
            isPublished: !published,
            token,
          }),
        ),
      );

      setDesigns(
        designs.map((d: Design) =>
          selectedDesigns.has(d.id) ? { ...d, isPublished: !published } : d,
        ),
      );

      setSelectedDesigns(new Set());
      toast.success(
        `${selectedDesigns.size} design(s) ${!published ? "publicado(s)" : "despublicado(s)"} com sucesso`,
      );
    } catch (error) {
      console.error("Error toggling publish:", error);
      toast.error(
        "Erro ao atualizar status de publicação: " + (error as Error).message,
      );
    } finally {
      setIsActionLoading(false);
    }
  };

  const generateHighQualityImage = async (design: Design): Promise<string> => {
    try {
      const token =
        localStorage.getItem("token") || localStorage.getItem("appToken") || "";

      // Obter o layout completo com fabricJsonState
      const fullLayout = await layoutApiService.getLayout(design.id, token);

      if (!fullLayout.fabricJsonState) {
        throw new Error("Dados do design não encontrados");
      }

      const { Canvas } = await import("fabric");

      // Criar um elemento canvas temporário
      const tempCanvas = document.createElement("canvas");

      // Criar canvas com alta qualidade (4x o tamanho original)
      const multiplier = 4;
      const canvas = new Canvas(tempCanvas, {
        width: design.width * multiplier,
        height: design.height * multiplier,
      });

      // Carregar o estado do design no canvas
      const fabricState =
        typeof fullLayout.fabricJsonState === "string"
          ? JSON.parse(fullLayout.fabricJsonState)
          : fullLayout.fabricJsonState;

      await canvas.loadFromJSON(fabricState);

      // Forçar fundo branco
      canvas.set("backgroundColor", "#ffffff");
      canvas.renderAll();

      // Exportar com máxima qualidade
      const highQualityImage = canvas.toDataURL({
        format: "png",
        multiplier: 5,
        enableRetinaScaling: true,
      });

      canvas.dispose();
      return highQualityImage;
    } catch (error) {
      console.error("Error generating high quality image:", error);
      throw error;
    }
  };

  const handleExportImages = async () => {
    try {
      setIsActionLoading(true);
      const selectedDesignsList = designs.filter((d: Design) =>
        selectedDesigns.has(d.id),
      );

      for (const design of selectedDesignsList) {
        try {
          // Gerar imagem em alta qualidade
          const highQualityImage = await generateHighQualityImage(design);

          const link = document.createElement("a");
          link.href = highQualityImage;
          link.download = `${design.name.replace(/\s+/g, "_")}.png`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);

          // Pequeno delay entre downloads para evitar bloqueios
          await new Promise((resolve) => setTimeout(resolve, 500));
        } catch (error) {
          console.error(`Erro ao exportar ${design.name}:`, error);
          toast.error(`Erro ao exportar ${design.name}`);
        }
      }

      toast.success(
        `${selectedDesigns.size} imagem(ns) exportada(s) em alta qualidade`,
      );
      setSelectedDesigns(new Set());
    } catch (error) {
      console.error("Error exporting images:", error);
      toast.error("Erro ao exportar imagens: " + (error as Error).message);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleCreateDesign = async (templateId: string) => {
    if (templateId === "custom") {
      setShowCustom(true);
      return;
    }

    const template = DESIGN_TEMPLATES.find((t) => t.id === templateId);
    if (!template) return;

    try {
      const token =
        localStorage.getItem("token") || localStorage.getItem("appToken") || "";
      const CM_TO_PX = 37.795;

      // Mapeamento de IDs do template para tipos aceitos pela API
      const typeMapping: Record<string, "mug" | "frame" | "custom"> = {
        caneca: "mug",
        quadro: "frame",
        camiseta: "custom",
        poster: "custom",
        custom: "custom",
      };

      const newLayout = await layoutApiService.createLayout({
        name: template.name,
        type: typeMapping[templateId] || "custom",
        baseImageUrl: generateWhiteBase64(),
        fabricJsonState: { version: "5.3.0", objects: [] },
        width: Math.round((template.width || 20) * CM_TO_PX),
        height: Math.round((template.height || 9.4) * CM_TO_PX),
        token,
      });

      navigate(`/layouts/editor/${newLayout.id}`);
    } catch (error) {
      console.error("Error creating design:", error);
      toast.error("Erro ao criar design: " + (error as Error).message);
    }
  };

  const handleCreateCustom = async () => {
    const w = parseFloat(customWidth);
    const h = parseFloat(customHeight);

    if (isNaN(w) || isNaN(h) || w <= 0 || h <= 0) {
      toast.error("Por favor, insira dimensões válidas");
      return;
    }

    try {
      const token =
        localStorage.getItem("token") || localStorage.getItem("appToken") || "";
      const CM_TO_PX = 37.795;
      const newLayout = await layoutApiService.createLayout({
        name: `Personalizado ${w}x${h}cm`,
        type: "custom",
        baseImageUrl: generateWhiteBase64(),
        fabricJsonState: { version: "5.3.0", objects: [] },
        width: Math.round(w * CM_TO_PX),
        height: Math.round(h * CM_TO_PX),
        token,
      });

      navigate(`/layouts/editor/${newLayout.id}`);
    } catch (error) {
      console.error("Error creating custom design:", error);
      toast.error("Erro ao criar design");
    }
  };

  return (
    <div className="relative min-h-screen bg-neutral-800 text-white">
      <div className="absolute top-0 w-full h-24 bg-linear-to-r from-teal-500 via-blue-500 to-purple-500 mask-[linear-gradient(to_bottom,black,transparent)] z-0" />

      <div className="w-full p-8 z-10">
        {/* Header */}
        <div className="w-full flex items-center justify-center text-center  my-12">
          <div>
            <h1 className="text-3xl font-bold">Criar Novo Design</h1>
            <p className="text-neutral-400 mt-1">
              Escolha um template ou crie um design personalizado
            </p>
          </div>
        </div>

        {!showCustom ? (
          <div className="flex gap-4 justify-center items-center">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {DESIGN_TEMPLATES.map((template) => {
                const Icon = template.icon;
                return (
                  <button
                    key={template.id}
                    onClick={() => handleCreateDesign(template.id)}
                    className="p-6 min-w-50 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 hover:border-blue-500 rounded-lg transition-all duration-200 flex flex-col items-center gap-3 text-center hover:shadow-lg hover:shadow-blue-500/20"
                  >
                    <Icon className="h-8 w-8 text-blue-400" />
                    <div>
                      <h3 className="font-semibold text-white">
                        {template.name}
                      </h3>
                      <p className="text-xs text-neutral-400 mt-1">
                        {template.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="max-w-md">
            <h2 className="text-xl font-semibold mb-6">
              Dimensões Customizadas
            </h2>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-neutral-300 mb-2 block">
                  Largura (cm)
                </label>
                <Input
                  type="number"
                  value={customWidth}
                  onChange={(e) => setCustomWidth(e.target.value)}
                  step="0.1"
                  min="1"
                  max="500"
                  className="h-10 bg-neutral-700 border-neutral-600 text-white"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-neutral-300 mb-2 block">
                  Altura (cm)
                </label>
                <Input
                  type="number"
                  value={customHeight}
                  onChange={(e) => setCustomHeight(e.target.value)}
                  step="0.1"
                  min="1"
                  max="500"
                  className="h-10 bg-neutral-700 border-neutral-600 text-white"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  onClick={() => setShowCustom(false)}
                  variant="outline"
                  className="flex-1"
                >
                  Voltar
                </Button>
                <Button
                  onClick={handleCreateCustom}
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                >
                  Criar Design
                </Button>
              </div>
            </div>
          </div>
        )}

        <section className="flex flex-col space-y-6 mt-16">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Meus Designs</h2>
            {selectedDesigns.size > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-neutral-400">
                  {selectedDesigns.size} selecionado(s)
                </span>
                <Button
                  onClick={handleSelectAll}
                  variant="secondary"
                  size="sm"
                  className="text-xs"
                >
                  {selectedDesigns.size === designs.length
                    ? "Desselecionar Tudo"
                    : "Selecionar Tudo"}
                </Button>
              </div>
            )}
          </div>

          {selectedDesigns.size > 0 && (
            <div className="bg-neutral-700 rounded-lg p-4 flex items-center justify-between gap-4">
              <div className="flex gap-2">
                <Button
                  onClick={handleDeleteSelected}
                  disabled={isActionLoading}
                  className="bg-red-600 hover:bg-red-700"
                  size="sm"
                >
                  {isActionLoading ? (
                    <Loader2Icon className="w-4 h-4 animate-spin mr-2" />
                  ) : null}
                  Excluir
                </Button>
                <Button
                  onClick={() => {
                    const allPublished = Array.from(selectedDesigns).every(
                      (id) =>
                        designs.find((d: Design) => d.id === id)?.isPublished,
                    );
                    handleTogglePublish(allPublished);
                  }}
                  disabled={isActionLoading}
                  className="bg-blue-600 hover:bg-blue-700"
                  size="sm"
                >
                  {isActionLoading ? (
                    <Loader2Icon className="w-4 h-4 animate-spin mr-2" />
                  ) : null}
                  {Array.from(selectedDesigns).every(
                    (id) =>
                      designs.find((d: Design) => d.id === id)?.isPublished,
                  )
                    ? "Despublicar"
                    : "Publicar"}
                </Button>
                <Button
                  onClick={handleExportImages}
                  disabled={isActionLoading}
                  className="bg-green-600 hover:bg-green-700"
                  size="sm"
                >
                  {isActionLoading ? (
                    <Loader2Icon className="w-4 h-4 animate-spin mr-2" />
                  ) : null}
                  Exportar Imagens
                </Button>
              </div>
              <Button
                onClick={() => setSelectedDesigns(new Set())}
                disabled={isActionLoading}
                variant="ghost"
                size="sm"
              >
                Fechar
              </Button>
            </div>
          )}
          {!isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {designs && !isLoading && designs.length > 0 ? (
                designs.map((design: Design) => (
                  <Link
                    to={"/layouts/editor/" + design.id}
                    key={design.id}
                    className="relative p-4 rounded-lg flex flex-col gap-1 text-left group"
                  >
                    <div className="w-full min-h-55 aspect-video bg-neutral-700 group-hover:bg-neutral-500 transition-colors rounded-md overflow-hidden flex items-center justify-center relative">
                      <Input
                        type="checkbox"
                        checked={selectedDesigns.has(design.id)}
                        className="hidden group-hover:block absolute top-2 left-2 z-20 w-6 h-6 bg-transparent border-2 border-white rounded-md hover:border-purple-500 transition-colors cursor-pointer accent-purple-500"
                        onChange={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          handleSelectDesign(design.id);
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectDesign(design.id);
                        }}
                      />
                      {selectedDesigns.has(design.id) && (
                        <div className="absolute inset-0 bg-purple-500/20 rounded-md" />
                      )}
                      <img
                        src={design.previewImageUrl || design.baseImageUrl}
                        alt={design.name}
                        className="h-full w-full object-contain p-2"
                      />
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm text-white">
                        {design.name}
                      </h3>
                      <p className="text-xs text-neutral-400 mt-1">
                        {Math.round(design.width / 37.795)} x{" "}
                        {Math.round(design.height / 37.795)} cm
                      </p>
                    </div>
                  </Link>
                ))
              ) : (
                <p className="text-neutral-400">Nenhum design encontrado.</p>
              )}
            </div>
          ) : (
            <div className="w-full flex justify-center items-center text-purple-500">
              <Loader2Icon className="animate-spin" />
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
