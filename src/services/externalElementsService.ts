/**
 * Serviço de elementos externos (OpenSource)
 * Integra múltiplas APIs de elementos gratuitas
 */

interface ExternalElement {
  id: string;
  imageUrl: string;
  thumbnailUrl?: string;
  name: string;
  source: "unsplash" | "pexels" | "pixabay" | "flaticon" | "noun-project";
  category?: string;
}

class ExternalElementsService {
  private unsplashAccessKey: string;
  private pexelsApiKey: string;
  private pixabayApiKey: string;

  constructor() {
    this.unsplashAccessKey =
      (import.meta.env as Record<string, string>).VITE_UNSPLASH_ACCESS_KEY ||
      "";
    this.pexelsApiKey =
      (import.meta.env as Record<string, string>).VITE_PEXELS_API_KEY || "";
    this.pixabayApiKey =
      (import.meta.env as Record<string, string>).VITE_PIXABAY_API_KEY || "";
  }

  /**
   * Buscar elementos do Unsplash
   */
  async searchUnsplash(query: string, page = 1): Promise<ExternalElement[]> {
    try {
      // Fallback para queries sem chave de API
      const searchQuery = query || "design";
      const response = await fetch(
        `https://api.unsplash.com/search/photos?query=${searchQuery}&page=${page}&per_page=10`,
        {
          headers: this.unsplashAccessKey
            ? { Authorization: `Client-ID ${this.unsplashAccessKey}` }
            : {},
        }
      );

      if (!response.ok) {
        // Retornar elementos padrão se a API falhar
        return this.getDefaultElements().filter((el) =>
          el.name.toLowerCase().includes(searchQuery.toLowerCase())
        );
      }

      const data = (await response.json()) as {
        results: Array<{
          id: string;
          urls: { regular: string; thumb: string };
          alt_description: string;
        }>;
      };

      return (data.results || []).map((img) => ({
        id: `unsplash-${img.id}`,
        imageUrl: img.urls.regular,
        thumbnailUrl: img.urls.thumb,
        name: img.alt_description || "Imagem Unsplash",
        source: "unsplash" as const,
      }));
    } catch (error) {
      console.warn("Unsplash API error, using defaults:", error);
      return this.getDefaultElements();
    }
  }

  /**
   * Buscar elementos do Pexels
   */
  async searchPexels(query: string, page = 1): Promise<ExternalElement[]> {
    try {
      const searchQuery = query || "design";

      // Se não tiver chave, retornar elementos padrão
      if (!this.pexelsApiKey) {
        return this.getDefaultElements().filter((el) =>
          el.name.toLowerCase().includes(searchQuery.toLowerCase())
        );
      }

      const response = await fetch(
        `https://api.pexels.com/v1/search?query=${searchQuery}&page=${page}&per_page=10`,
        {
          headers: { Authorization: this.pexelsApiKey },
        }
      );

      if (!response.ok) {
        return this.getDefaultElements();
      }

      const data = (await response.json()) as {
        photos: Array<{
          id: number;
          src: { original: string; tiny: string };
          alt: string;
        }>;
      };

      return (data.photos || []).map((img) => ({
        id: `pexels-${img.id}`,
        imageUrl: img.src.original,
        thumbnailUrl: img.src.tiny,
        name: img.alt || "Imagem Pexels",
        source: "pexels" as const,
      }));
    } catch (error) {
      console.warn("Pexels API error, using defaults:", error);
      return this.getDefaultElements();
    }
  }

  /**
   * Buscar elementos do Pixabay
   */
  async searchPixabay(query: string, page = 1): Promise<ExternalElement[]> {
    try {
      const searchQuery = query || "design";

      // Se não tiver chave, retornar elementos padrão
      if (!this.pixabayApiKey) {
        return this.getDefaultElements().filter((el) =>
          el.name.toLowerCase().includes(searchQuery.toLowerCase())
        );
      }

      const response = await fetch(
        `https://pixabay.com/api/?key=${this.pixabayApiKey}&q=${searchQuery}&page=${page}&per_page=10&image_type=photo`,
        { mode: "cors" }
      );

      if (!response.ok) {
        return this.getDefaultElements();
      }

      const data = (await response.json()) as {
        hits: Array<{
          id: number;
          largeImageURL: string;
          previewURL: string;
          tags: string;
        }>;
      };

      return (data.hits || []).map((img) => ({
        id: `pixabay-${img.id}`,
        imageUrl: img.largeImageURL,
        thumbnailUrl: img.previewURL,
        name: img.tags || "Imagem Pixabay",
        source: "pixabay" as const,
      }));
    } catch (error) {
      console.warn("Pixabay API error, using defaults:", error);
      return this.getDefaultElements();
    }
  }

  /**
   * Elementos padrão (placeholder)
   * Usando SVG inline para garantir que sempre renderizam
   */
  getDefaultElements(): ExternalElement[] {
    const elements = [
      { color: "FF6B6B", emoji: "❤️", name: "Coração Vermelho" },
      { color: "FF1493", emoji: "💕", name: "Coração Rosa" },
      { color: "FFD700", emoji: "⭐", name: "Estrela Dourada" },
      { color: "4ECDC4", emoji: "💎", name: "Diamante Azul" },
      { color: "FFE66D", emoji: "✨", name: "Brilho Amarelo" },
      { color: "95E1D3", emoji: "🌸", name: "Flor Verde" },
      { color: "F38181", emoji: "🌹", name: "Rosa Rosa" },
      { color: "AA96DA", emoji: "🦋", name: "Borboleta Roxa" },
      { color: "FF9F43", emoji: "🍊", name: "Laranja Quente" },
      { color: "54a0ff", emoji: "💙", name: "Coração Azul" },
      { color: "5f27cd", emoji: "👑", name: "Coroa Roxa" },
      { color: "ff9ff3", emoji: "🎀", name: "Laço Rosa" },
    ];

    return elements.map((el, index) => {
      // Criar SVG inline como data URL
      const svgContent = `
        <svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
          <rect width="200" height="200" fill="#${el.color}"/>
          <text x="100" y="120" font-size="80" text-anchor="middle" dominant-baseline="middle">
            ${el.emoji}
          </text>
          <text x="100" y="160" font-size="14" text-anchor="middle" fill="white" font-weight="bold">
            ${el.name}
          </text>
        </svg>
      `;
      const dataUrl = `data:image/svg+xml;base64,${btoa(svgContent)}`;

      return {
        id: `default-${index + 1}`,
        imageUrl: dataUrl,
        thumbnailUrl: dataUrl,
        name: el.name,
        source: "flaticon" as const,
        category: "decoracao",
      };
    });
  }

  /**
   * Buscar elementos de múltiplas fontes
   */
  async searchMultiple(query: string): Promise<ExternalElement[]> {
    try {
      // Buscar de todas as fontes em paralelo, mas usar fallback se falharem
      const [unsplash, pexels, pixabay] = await Promise.allSettled([
        this.searchUnsplash(query),
        this.searchPexels(query),
        this.searchPixabay(query),
      ]);

      const results: ExternalElement[] = [];

      if (unsplash.status === "fulfilled") {
        results.push(...unsplash.value.slice(0, 5));
      }
      if (pexels.status === "fulfilled") {
        results.push(...pexels.value.slice(0, 5));
      }
      if (pixabay.status === "fulfilled") {
        results.push(...pixabay.value.slice(0, 5));
      }

      // Se nenhuma fonte retornar resultados, usar padrão
      if (results.length === 0) {
        return this.getDefaultElements();
      }

      return results;
    } catch (error) {
      console.warn("Multi-search error:", error);
      return this.getDefaultElements();
    }
  }

  /**
   * Obter elementos por categoria
   */
  async getByCategory(category: string): Promise<ExternalElement[]> {
    const categoryMap: Record<string, string> = {
      decoracao: "decoration",
      flores: "flowers",
      coracao: "heart",
      presente: "gift",
      amor: "love",
      romantico: "romantic",
    };

    const query = categoryMap[category] || category;
    return this.searchMultiple(query);
  }
}

export const externalElementsService = new ExternalElementsService();
export type { ExternalElement };
