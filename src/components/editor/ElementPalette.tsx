import React, { useState, useEffect } from "react";
import { useEditor } from "../../hooks/useEditor";
import { fabricService } from "../../services/fabricService";
import { toast } from "sonner";
import { Loader, Search } from "lucide-react";
import { Input } from "../ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

interface ElementPaletteProps {
  onElementAdded?: () => void;
}

export function ElementPalette({ onElementAdded }: ElementPaletteProps) {
  const { state } = useEditor();
  const [elements, setElements] = useState<unknown[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  // Carregar categorias
  useEffect(() => {
    const loadCategories = async () => {
      try {
        // Usar lista vazia por enquanto
        setCategories([]);
      } catch (error) {
        console.error("Erro ao carregar categorias:", error);
      }
    };

    loadCategories();
  }, []);

  // Carregar elementos quando categoria muda
  useEffect(() => {
    const loadElements = async () => {
      if (!selectedCategory) {
        setElements([]);
        return;
      }

      try {
        setIsLoading(true);
        // Usar dados vazios por enquanto
        setElements([]);
      } catch (error) {
        console.error("Erro ao carregar elementos:", error);
        toast.error("Erro ao carregar elementos");
      } finally {
        setIsLoading(false);
      }
    };

    loadElements();
  }, [selectedCategory, searchTerm]);

  const handleElementClick = async (element: unknown) => {
    if (!state.canvas) {
      toast.error("Canvas não inicializado");
      return;
    }

    try {
      if (
        typeof element === "object" &&
        element !== null &&
        "imageUrl" in element &&
        "name" in element
      ) {
        const elem = element as unknown as { imageUrl: string; name: string };
        await fabricService.addImage(
          state.canvas as unknown as never,
          elem.imageUrl
        );
        toast.success(`${elem.name} adicionado`);
        onElementAdded?.();
      }
    } catch (error) {
      console.error("Erro ao adicionar elemento:", error);
      toast.error("Erro ao adicionar elemento");
    }
  };

  return (
    <div className="flex flex-col h-full bg-white border-l border-gray-200">
      <div className="p-4 border-b border-gray-200">
        <h3 className="font-semibold text-lg mb-4">Banco de Elementos</h3>

        {/* Categoria */}
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="mb-4">
            <SelectValue placeholder="Selecione categoria" />
          </SelectTrigger>
          <SelectContent>
            {categories.map((cat) => {
              const catItem =
                typeof cat === "string" ? { name: cat, count: 0 } : cat;
              return (
                <SelectItem key={catItem.name} value={catItem.name}>
                  {catItem.name}{" "}
                  {typeof catItem === "object" && "count" in catItem
                    ? `(${catItem.count})`
                    : ""}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>

        {/* Busca */}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-3 text-gray-400" />
          <Input
            placeholder="Buscar elementos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Grid de elementos */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader className="animate-spin text-gray-400" />
          </div>
        ) : elements.length > 0 ? (
          <div className="grid grid-cols-2 gap-3">
            {elements.map((element: unknown) => {
              const elem = element as unknown as {
                id?: string;
                thumbnailUrl?: string;
                imageUrl?: string;
                name?: string;
              };
              return (
                <div
                  key={elem.id || Math.random()}
                  className="group relative overflow-hidden rounded-lg border border-gray-200 hover:border-blue-500 transition-all cursor-pointer"
                  onClick={() => handleElementClick(element)}
                >
                  <img
                    src={elem.thumbnailUrl || elem.imageUrl || ""}
                    alt={elem.name || "Element"}
                    className="w-full h-24 object-cover group-hover:scale-110 transition-transform"
                  />
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all flex items-center justify-center">
                    <span className="text-white text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                      Adicionar
                    </span>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 bg-white py-2 px-2 text-xs font-medium truncate">
                    {elem.name || "Element"}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <p className="text-sm">Nenhum elemento encontrado</p>
          </div>
        )}
      </div>
    </div>
  );
}
