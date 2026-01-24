/**
 * Utilitário para gerenciar armazenamento de customizações em localStorage
 * com schema compacto e sem base64
 *
 * Exemplo de estrutura otimizada:
 * {
 *   "productId": "8278449881407",
 *   "customization": {
 *     "343628": "template-683447",              // Template ID
 *     "layer-314974": "ws:uploads/hash.jpg",   // URL relativa
 *     "layer-314974-pos": { x: 0.15, y: -0.3, w: 0.78, h: 1.128, r: 0.75, a: 0 },
 *     "layer-395759": "Marcos & Lizandra",     // Texto
 *     "layer-484922-vis": true,                // Visibilidade
 *     "layer-586399": "2024",                  // Outro texto
 *     "layer-744172": 9364947                  // Número
 *   },
 *   "ts": 1769089537859,
 *   "exp": 1769175937859  // Expira em 24h
 * }
 */

type CustomizationValue =
  | string
  | number
  | boolean
  | Record<string, string | number | boolean>
  | null;

interface PositionData {
  x: string;
  y: string;
  w: string;
  h: string;
  r: string;
  a: number;
}

interface CustomizationState {
  productId: string;
  customization: Record<string, CustomizationValue | PositionData>;
  ts: number;
  exp: number;
}

interface StorageQuota {
  used: number;
  limit: number;
  percentage: number;
}

interface SaveResult {
  success: boolean;
  key: string;
  size: number;
}

interface SaveErrorResult {
  success: false;
  error: string;
}

interface CleanupResult {
  deletedCount: number;
  freedBytes: number;
}

class CustomizationStorage {
  private readonly DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24 horas
  private readonly PREFIX = "cesto-design";
  private readonly WARNING_THRESHOLD = 0.8; // 80% do limite

  /**
   * Salvar customização com schema compacto
   */
  save(
    productId: string,
    customization: Record<string, CustomizationValue | PositionData>,
  ): SaveResult | SaveErrorResult {
    try {
      const now = Date.now();
      const state: CustomizationState = {
        productId,
        customization: this.compactifyCustomization(customization),
        ts: now,
        exp: now + this.DEFAULT_TTL_MS,
      };

      const key = `${this.PREFIX}:${productId}`;
      const jsonStr = JSON.stringify(state);

      // Verificar se vai ultrapassar limite antes de salvar
      const currentSize = this.getCurrentStorageSize();
      const newSize = new Blob([jsonStr]).size;

      if (
        currentSize + newSize >
        this.getStorageLimit() * this.WARNING_THRESHOLD
      ) {
        console.warn(
          "⚠️ LocalStorage próximo do limite. Limpando rascunhos antigos...",
        );
        this.cleanupOldDrafts();
      }

      localStorage.setItem(key, jsonStr);
      console.log(`✅ Customização salva: ${productId} (${newSize} bytes)`);

      return {
        success: true,
        key,
        size: newSize,
      } as SaveResult;
    } catch (error) {
      console.error("❌ Erro ao salvar customização:", error);

      // Se foi erro de quota, tentar limpar e retentar
      if (error instanceof DOMException && error.code === 22) {
        console.warn("⚠️ Quota excedida! Limpando rascunhos...");
        this.cleanupAllExpired();
        return {
          success: false,
          error: "Quota excedida após limpeza",
        } as SaveErrorResult;
      }

      throw error;
    }
  }

  /**
   * Carregar customização
   */
  load(productId: string): CustomizationState | null {
    try {
      const key = `${this.PREFIX}:${productId}`;
      const jsonStr = localStorage.getItem(key);

      if (!jsonStr) {
        return null;
      }

      const state = JSON.parse(jsonStr) as CustomizationState;

      // Verificar expiração
      if (state.exp && Date.now() > state.exp) {
        console.warn(`⚠️ Rascunho de ${productId} expirou`);
        localStorage.removeItem(key);
        return null;
      }

      return state;
    } catch (error) {
      console.error("❌ Erro ao carregar customização:", error);
      return null;
    }
  }

  /**
   * Deletar customização
   */
  delete(productId: string) {
    const key = `${this.PREFIX}:${productId}`;
    localStorage.removeItem(key);
    console.log(`✅ Customização deletada: ${productId}`);
  }

  /**
   * Listar todos os rascunhos
   */
  listAllDrafts(): Array<{
    productId: string;
    timestamp: Date;
    expiresAt: Date;
  }> {
    const drafts = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);

      if (key?.startsWith(`${this.PREFIX}:`)) {
        try {
          const jsonStr = localStorage.getItem(key);
          if (jsonStr) {
            const state = JSON.parse(jsonStr) as CustomizationState;
            drafts.push({
              productId: state.productId,
              timestamp: new Date(state.ts),
              expiresAt: new Date(state.exp),
            });
          }
        } catch (error) {
          console.error(`Erro ao parsear ${key}:`, error);
        }
      }
    }

    return drafts;
  }

  /**
   * Otimizar customização: remover base64, usar URLs
   * Reduz tamanho de ~2-5MB para ~5-10KB
   */
  private compactifyCustomization(
    custom: Record<string, CustomizationValue | PositionData>,
  ): Record<string, CustomizationValue | PositionData> {
    const compacted: Record<string, CustomizationValue | PositionData> = {};

    for (const [key, value] of Object.entries(custom)) {
      // Remover base64 (começam com "data:")
      if (typeof value === "string" && value.startsWith("data:")) {
        console.warn(`🗑️ Removido base64: ${key}`);
        continue;
      }

      // Compactar nomes de propriedades posicionais
      if (key.includes("-position")) {
        const newKey = key.replace("-position", "-pos");
        if (
          typeof value === "object" &&
          value !== null &&
          !Array.isArray(value)
        ) {
          const positionObj = value as Record<string, number | string>;
          compacted[newKey] = {
            x: String(positionObj.x ?? 0).substring(0, 6),
            y: String(positionObj.y ?? 0).substring(0, 6),
            w: String(positionObj.w ?? positionObj.width ?? 0).substring(0, 6),
            h: String(positionObj.h ?? positionObj.height ?? 0).substring(0, 6),
            r: String(positionObj.r ?? positionObj.ratio ?? 0).substring(0, 4),
            a: (positionObj.a ?? positionObj.angle ?? 0) as number,
          } as PositionData;
        }
        continue;
      }

      // Compactar visibility
      if (key.includes("-visibility")) {
        const newKey = key.replace("-visibility", "-vis");
        compacted[newKey] = value;
        continue;
      }

      // Manter outros valores
      compacted[key] = value;
    }

    return compacted;
  }

  /**
   * Descompactar customização (reverter compactação)
   */
  expandCustomization(
    compacted: Record<string, CustomizationValue | PositionData>,
  ): Record<string, CustomizationValue | PositionData> {
    const expanded: Record<string, CustomizationValue | PositionData> = {};

    for (const [key, value] of Object.entries(compacted)) {
      // Reverter nomes posicionais
      if (key.includes("-pos")) {
        const newKey = key.replace("-pos", "-position");
        if (
          typeof value === "object" &&
          value !== null &&
          !Array.isArray(value)
        ) {
          const positionObj = value as PositionData;
          expanded[newKey] = {
            x:
              typeof positionObj.x === "string"
                ? parseFloat(positionObj.x)
                : (positionObj.x as number),
            y:
              typeof positionObj.y === "string"
                ? parseFloat(positionObj.y)
                : (positionObj.y as number),
            width:
              typeof positionObj.w === "string"
                ? parseFloat(positionObj.w)
                : (positionObj.w as number),
            height:
              typeof positionObj.h === "string"
                ? parseFloat(positionObj.h)
                : (positionObj.h as number),
            ratio:
              typeof positionObj.r === "string"
                ? parseFloat(positionObj.r)
                : (positionObj.r as number),
            angle: positionObj.a,
          };
        }
        continue;
      }

      // Reverter visibility
      if (key.includes("-vis")) {
        const newKey = key.replace("-vis", "-visibility");
        expanded[newKey] = value;
        continue;
      }

      expanded[key] = value;
    }

    return expanded;
  }

  /**
   * Obter quota de armazenamento
   */
  getStorageQuota(): StorageQuota {
    const used = this.getCurrentStorageSize();
    const limit = this.getStorageLimit();

    return {
      used,
      limit,
      percentage: (used / limit) * 100,
    };
  }

  /**
   * Limpar rascunhos expirados
   */
  private cleanupAllExpired() {
    const now = Date.now();
    let deletedCount = 0;
    let freedBytes = 0;

    const keysToDelete: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);

      if (key?.startsWith(`${this.PREFIX}:`)) {
        try {
          const jsonStr = localStorage.getItem(key);
          if (jsonStr) {
            const state = JSON.parse(jsonStr) as CustomizationState;

            if (state.exp && now > state.exp) {
              keysToDelete.push(key);
              freedBytes += new Blob([jsonStr]).size;
              deletedCount++;
            }
          }
        } catch (error) {
          console.error(`Erro ao processar ${key}:`, error);
        }
      }
    }

    // Deletar fora do loop para não afetar iteração
    keysToDelete.forEach((key) => localStorage.removeItem(key));

    console.log(
      `🧹 Limpeza: ${deletedCount} rascunhos deletados, ${(freedBytes / 1024).toFixed(2)}KB liberados`,
    );

    return { deletedCount, freedBytes } as CleanupResult;
  }

  /**
   * Limpeza agressiva: manter apenas 5 rascunhos mais recentes
   */
  private cleanupOldDrafts() {
    const drafts = this.listAllDrafts()
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(5); // Manter últimos 5

    drafts.forEach((draft) => this.delete(draft.productId));

    console.log(
      `🧹 Limpeza agressiva: ${drafts.length} rascunhos antigos deletados`,
    );
  }

  /**
   * Limpar TUDO (para logout)
   */
  clear() {
    const keys: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(`${this.PREFIX}:`)) {
        keys.push(key);
      }
    }

    keys.forEach((key) => localStorage.removeItem(key));
    console.log(`🗑️ Todos os rascunhos foram deletados`);
  }

  /**
   * Tamanho atual usado (aproximado)
   */
  private getCurrentStorageSize(): number {
    let total = 0;

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(`${this.PREFIX}:`)) {
        const value = localStorage.getItem(key);
        if (value) {
          total += new Blob([value]).size;
        }
      }
    }

    return total;
  }

  /**
   * Limite padrão de localStorage (5MB)
   */
  private getStorageLimit(): number {
    // Most browsers: 5MB = 5242880 bytes
    // Safari: 5MB
    // Firefox: 10MB
    return 5 * 1024 * 1024; // 5MB
  }
}

export const customizationStorage = new CustomizationStorage();
