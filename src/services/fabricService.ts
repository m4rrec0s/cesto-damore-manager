import { v4 as uuidv4 } from "uuid";
import type { FabricCanvas, FabricObject } from "../types/fabric";

/**
 * Serviço para operações do Fabric.js
 * Abstrai a complexidade da biblioteca e fornece API simplificada
 */
export const fabricService = {
  /**
   * Inicializar canvas com imagem base
   */
  async initCanvas(
    canvasElement: HTMLCanvasElement,
    baseImageUrl: string,
    width: number,
    height: number,
  ): Promise<FabricCanvas> {
    // Dinâmica import para evitar problemas de SSR
    const fabricModule = await import("fabric");
    const fabric = fabricModule.default;

    const canvas = new fabric.Canvas(canvasElement, {
      width,
      height,
      preserveObjectStacking: true,
      selection: true,
      hoverCursor: "pointer",
      enableRetinaScaling: true,
      devicePixelRatio: Math.max(window.devicePixelRatio || 1, 2),
      imageSmoothingEnabled: true,
    }) as unknown as FabricCanvas;

    // Carregar imagem base como background
    try {
      await new Promise<void>((resolve, reject) => {
        // @ts-expect-error - Fabric.js LoadImageOptions mismatch
        fabric.Image.fromURL(baseImageUrl, (img: unknown) => {
          if (!img) {
            reject(new Error("Erro ao carregar imagem base"));
            return;
          }
          (
            img as unknown as { scaleToWidth: (w: number) => void }
          ).scaleToWidth(width);
          (canvas as unknown as { backgroundImage: unknown }).backgroundImage =
            img as unknown;
          canvas.renderAll();
          resolve();
        });
      });
    } catch (error) {
      console.error("Erro ao inicializar canvas:", error);
      throw error;
    }

    return canvas;
  },

  /**
   * Adicionar texto ao canvas
   */
  async addText(
    canvas: FabricCanvas,
    text: string = "Digite aqui",
    options: Record<string, unknown> = {},
  ) {
    const fabricModule = await import("fabric");
    const fabric = fabricModule.default;

    const textbox = new fabric.Textbox(text, {
      left: 100,
      top: 100,
      width: 200,
      fontSize: 32,
      fill: "#000000",
      fontFamily: "Arial",
      editable: false, // Começa desabilitado para seleção do objeto primeiro
      selectable: true,
      evented: true,
      id: uuidv4(),
      // Configurações CRÍTICAS para cursor alinhado
      splitByGrapheme: false, // Voltando para FALSE para corrigir atalhos e posição em textos longos
      padding: 15,
      lineHeight: 1.3,
      textAlign: "left",
      // FORÇAR quebra de linha por palavra
      wordWrap: true,
      // Evitar distorção
      objectCaching: false,
      noScaleCache: true,
      strokeUniform: true,
      perPixelTargetFind: false, // Facilita seleção da caixa inteira
      // Melhorar seleção
      hasControls: true,
      hasBorders: true,
      transparentCorners: false,
      cornerColor: "rgba(59, 130, 246, 0.8)",
      cornerSize: 8,
      borderColor: "rgba(59, 130, 246, 0.8)",
      borderDashArray: [5, 5],
      // Melhorar seleção de texto
      selectionBackgroundColor: "rgba(59, 130, 246, 0.2)",
      selectionColor: "#3b82f6",
      ...options,
    }) as unknown as FabricObject;

    canvas.add(textbox);
    canvas.setActiveObject(textbox);
    canvas.renderAll();

    return textbox;
  },

  /**
   * Adicionar imagem ao canvas
   */
  async addImage(
    canvas: FabricCanvas,
    imageUrl: string,
    options: Record<string, unknown> = {},
  ) {
    const fabricModule = await import("fabric");
    const fabric = fabricModule.default;

    return new Promise<FabricObject>((resolve, reject) => {
      // @ts-expect-error - Fabric.js LoadImageOptions mismatch
      fabric.Image.fromURL(imageUrl, (img: unknown) => {
        if (!img) {
          reject(new Error("Erro ao carregar imagem"));
          return;
        }

        (img as never as { set: (v: unknown) => void }).set({
          left: 100,
          top: 100,
          objectId: uuidv4(),
          ...options,
        });

        canvas.add(img);
        canvas.setActiveObject(img);
        canvas.renderAll();
        resolve(img as FabricObject);
      });
    });
  },

  /**
   * Adicionar forma geométrica (retângulo, círculo)
   */
  async addShape(
    canvas: FabricCanvas,
    shapeType: "rect" | "circle",
    options: Record<string, unknown> = {},
  ) {
    const fabricModule = await import("fabric");
    const fabric = fabricModule.default;

    let shape: FabricObject;

    if (shapeType === "rect") {
      shape = new fabric.Rect({
        left: 100,
        top: 100,
        width: 200,
        height: 150,
        fill: "#FF0000",
        objectId: uuidv4(),
        ...options,
      }) as unknown as FabricObject;
    } else {
      shape = new fabric.Circle({
        left: 100,
        top: 100,
        radius: 75,
        fill: "#00FF00",
        objectId: uuidv4(),
        ...options,
      }) as unknown as FabricObject;
    }

    canvas.add(shape);
    canvas.setActiveObject(shape);
    canvas.renderAll();

    return shape;
  },

  /**
   * Deletar objeto selecionado
   */
  deleteSelected(canvas: FabricCanvas) {
    const activeObject =
      canvas.getActiveObject() as unknown as FabricObject | null;
    if (activeObject) {
      canvas.remove(activeObject);
      canvas.renderAll();
      return true;
    }
    return false;
  },

  /**
   * Duplicar objeto selecionado
   */
  async duplicateSelected(canvas: FabricCanvas) {
    const activeObject =
      canvas.getActiveObject() as unknown as FabricObject | null;
    if (!activeObject) return;

    const cloned = await new Promise<FabricObject>((resolve) => {
      activeObject.clone((clonedObj: unknown) => {
        const cloned = clonedObj as FabricObject;
        cloned.set({
          left: (activeObject.left || 0) + 10,
          top: (activeObject.top || 0) + 10,
          objectId: uuidv4(),
        });
        resolve(cloned);
      });
    });

    canvas.add(cloned);
    canvas.setActiveObject(cloned);
    canvas.renderAll();

    return cloned;
  },

  /**
   * Trazer para frente
   */
  bringToFront(canvas: FabricCanvas) {
    const activeObject =
      canvas.getActiveObject() as unknown as FabricObject | null;
    if (activeObject) {
      canvas.bringToFront(activeObject);
      canvas.renderAll();
    }
  },

  /**
   * Enviar para trás
   */
  sendToBack(canvas: FabricCanvas) {
    const activeObject =
      canvas.getActiveObject() as unknown as FabricObject | null;
    if (activeObject) {
      canvas.sendToBack(activeObject);
      canvas.renderAll();
    }
  },

  /**
   * Agrupar objetos selecionados
   */
  groupSelected(canvas: FabricCanvas) {
    const activeObjects =
      canvas.getActiveObjects() as unknown as FabricObject[];
    if (activeObjects.length < 2) return null;

    const group = (
      canvas.util?.createSerializedArray(activeObjects as unknown[]) || []
    ).map((o: unknown) => o);

    // Desselecionar todos
    canvas.discardActiveObject();
    canvas.renderAll();

    return null; // Fabric v6 removeu grouping nativo
  },

  /**
   * Desagrupar objetos
   */
  ungroupSelected(canvas: FabricCanvas) {
    const activeObject = canvas.getActiveObject() as unknown as {
      type?: string;
    } | null;
    if (!activeObject || activeObject.type !== "group") return;

    // Implementação simplificada
    canvas.renderAll();
  },

  /**
   * Exportar canvas como JSON (para salvar)
   */
  exportAsJSON(canvas: FabricCanvas) {
    return JSON.stringify(canvas.toJSON());
  },

  /**
   * Importar canvas de JSON (para carregar)
   */
  async importFromJSON(canvas: FabricCanvas, jsonString: string) {
    return new Promise<void>((resolve, reject) => {
      try {
        const json = JSON.parse(jsonString);
        canvas.loadFromJSON(json, () => {
          canvas.renderAll();
          resolve();
        });
      } catch (error) {
        reject(error);
      }
    });
  },

  /**
   * Exportar canvas como imagem (PNG/JPG)
   */
  exportAsImage(canvas: FabricCanvas, format: "png" | "jpg" = "png") {
    return canvas.toDataURL({
      format,
      quality: 1,
      multiplier: 5, // Aumentado para 5x para qualidade de produção (conforme feedback do usuário)
    });
  },

  /**
   * Exportar como PDF
   */
  async exportAsPDF(canvas: FabricCanvas, filename: string = "design.pdf") {
    // Removido jsPDF por falta de dependência - usar html2canvas se necessário
    console.warn(
      "PDF export não disponível. Use exportAsImage para salvar como PNG.",
    );
  },

  /**
   * Limpar canvas
   */
  clearCanvas(canvas: FabricCanvas) {
    (canvas as unknown as { clear: () => void }).clear?.();
    canvas.renderAll();
  },

  /**
   * Obter estado atual do canvas (para salvar em histórico)

   */
  getCanvasState(canvas: FabricCanvas) {
    return canvas.toJSON();
  },

  /**
   * Restaurar estado do canvas
   */
  async restoreCanvasState(canvas: FabricCanvas, state: string) {
    return new Promise<void>((resolve) => {
      canvas.loadFromJSON(state, () => {
        canvas.renderAll();
        resolve();
      });
    });
  },

  /**
   * Obter objeto selecionado
   */
  getSelectedObject(canvas: FabricCanvas): FabricObject | null {
    return canvas.getActiveObject() as unknown as FabricObject | null;
  },

  /**
   * Configurar propriedades do objeto selecionado
   */
  updateSelectedObject(
    canvas: FabricCanvas,
    properties: Record<string, unknown>,
  ) {
    const activeObject =
      canvas.getActiveObject() as unknown as FabricObject | null;
    if (activeObject) {
      activeObject.set(properties);
      canvas.renderAll();
    }
  },

  /**
   * Traçar / Desenho livre
   */
  async enableDrawing(canvas: FabricCanvas) {
    const fabricModule = await import("fabric");
    const fabric = fabricModule.default;
    (canvas as unknown as { isDrawingMode: boolean }).isDrawingMode = true;
  },

  /**
   * Desabilitar desenho livre
   */
  disableDrawing(canvas: FabricCanvas) {
    (canvas as unknown as { isDrawingMode: boolean }).isDrawingMode = false;
  },

  /**
   * Configurar pincel de desenho
   */
  setBrushOptions(
    canvas: FabricCanvas,
    color: string = "#000000",
    width: number = 2,
  ) {
    const brush = (
      canvas as unknown as {
        freeDrawingBrush?: { color?: string; width?: number };
      }
    ).freeDrawingBrush;
    if (brush) {
      brush.color = color;
      brush.width = width;
    }
  },

  /**
   * Aplicar filtros (blur, brightness, etc)
   */
  async applyFilter(
    canvas: FabricCanvas,
    filterType: string = "brightness",
    value: number = 0,
  ) {
    console.warn("Filters API não disponível na versão atual de Fabric.js");
  },
};
