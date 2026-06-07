import { useState, useEffect, useCallback, useRef } from "react";

export interface DynamicLayoutPage {
  id: string;
  name: string;
  order: number;
  canvasState: Record<string, unknown> & { objects?: any[] };
  thumbnailDataUrl?: string;
}

export function extractPages(fabricJsonState: any): DynamicLayoutPage[] {
  if (!fabricJsonState) return [];
  if (Array.isArray(fabricJsonState.pages)) {
    return fabricJsonState.pages;
  }
  return [
    {
      id: "page_1",
      name: "Página 1",
      order: 0,
      canvasState: fabricJsonState,
    },
  ];
}

const CUSTOM_PROPS = [
  "name",
  "id",
  "selectable",
  "evented",
  "editable",
  "isCustomizable",
  "maxChars",
  "isFrame",
  "backgroundColor",
  "customData",
  "rx",
  "ry",
  "stroke",
  "strokeWidth",
  "strokeDashArray",
  "radius",
  "width",
  "height",
  "splitByGrapheme",
  "objectCaching",
  "linkedFrameId",
  "imageSmoothing",
  "noScaleCache",
];

interface FabricLike {
  toObject: (props?: string[]) => Record<string, unknown>;
  toDataURL: (opt?: Record<string, unknown>) => string;
  loadFromJSON: (json: unknown) => Promise<void>;
  renderAll: () => void;
}

async function serializeInWorker(
  canvas: FabricLike,
  worker: Worker | null,
): Promise<Record<string, unknown>> {
  const canvasObject = canvas.toObject(CUSTOM_PROPS);
  if (!worker) return canvasObject;

  return new Promise((resolve, reject) => {
    const onMessage = (e: MessageEvent) => {
      worker.removeEventListener("message", onMessage);
      if (e.data.success) resolve(e.data.result);
      else reject(new Error(e.data.error));
    };
    worker.addEventListener("message", onMessage);
    worker.postMessage({ canvasObject });
  });
}

export function usePageManager(
  canvas: FabricLike | null,
  onBeforeLoad?: () => void,
  onAfterLoad?: () => void,
  baseDimensions?: { width: number; height: number },
) {
  const [pages, setPages] = useState<DynamicLayoutPage[]>([]);
  const [activePageIndex, setActivePageIndex] = useState(0);
  const [isPageSwitching, setIsPageSwitching] = useState(false);
  const serializeWorkerRef = useRef<Worker | null>(null);
  const baseDimensionsRef = useRef(baseDimensions);
  baseDimensionsRef.current = baseDimensions;

  const pagesRef = useRef(pages);
  pagesRef.current = pages;
  const activePageIndexRef = useRef(activePageIndex);
  activePageIndexRef.current = activePageIndex;
  const canvasRef = useRef(canvas);
  canvasRef.current = canvas;

  useEffect(() => {
    serializeWorkerRef.current = new Worker(
      new URL("../workers/canvasSerialize.worker.ts", import.meta.url),
      { type: "module" },
    );
    return () => serializeWorkerRef.current?.terminate();
  }, []);

  const saveCurrentPageState = useCallback(async (): Promise<
    DynamicLayoutPage[]
  > => {
    const c = canvasRef.current;
    const currentPages = pagesRef.current;
    const currentIndex = activePageIndexRef.current;

    if (!c || currentPages.length === 0) return currentPages;

    const canvasState = await serializeInWorker(c, serializeWorkerRef.current);

    // Fix: save base design dimensions, not backstore (DPR-scaled) dimensions
    if (baseDimensionsRef.current) {
      canvasState.width = baseDimensionsRef.current.width;
      canvasState.height = baseDimensionsRef.current.height;
    }

    const thumbnailDataUrl = c.toDataURL({
      multiplier: 0.15,
      format: "jpeg",
      quality: 0.5,
    });

    return currentPages.map((p, i) =>
      i === currentIndex ? { ...p, canvasState, thumbnailDataUrl } : p,
    );
  }, []);

  const switchToPage = useCallback(
    async (targetIndex: number) => {
      const c = canvasRef.current;
      const currentPages = pagesRef.current;
      const currentIndex = activePageIndexRef.current;

      if (!c || targetIndex === currentIndex) return;
      if (targetIndex < 0 || targetIndex >= currentPages.length) return;

      setIsPageSwitching(true);
      onBeforeLoad?.();
      try {
        const updatedPages = await saveCurrentPageState();
        setPages(updatedPages);
        pagesRef.current = updatedPages;

        const targetPage = updatedPages[targetIndex];
        await c.loadFromJSON(targetPage.canvasState);
        c.renderAll();

        setActivePageIndex(targetIndex);
        activePageIndexRef.current = targetIndex;
      } finally {
        onAfterLoad?.();
        setIsPageSwitching(false);
      }
    },
    [saveCurrentPageState, onBeforeLoad, onAfterLoad],
  );

  const addPage = useCallback(async () => {
    const updatedPages = await saveCurrentPageState();
    const newPage: DynamicLayoutPage = {
      id: `page_${Date.now()}`,
      name: `Página ${updatedPages.length + 1}`,
      order: updatedPages.length,
      canvasState: {
        objects: [],
        backgroundColor: "#ffffff",
        version: "5.3.0",
      },
    };
    const newPages = [...updatedPages, newPage];
    setPages(newPages);
    pagesRef.current = newPages;

    const c = canvasRef.current;
    if (c && newPages.length > 0) {
      setIsPageSwitching(true);
      onBeforeLoad?.();
      try {
        const targetPage = newPages[newPages.length - 1];
        await c.loadFromJSON(targetPage.canvasState);
        c.renderAll();
        setActivePageIndex(newPages.length - 1);
        activePageIndexRef.current = newPages.length - 1;
      } finally {
        onAfterLoad?.();
        setIsPageSwitching(false);
      }
    }
  }, [saveCurrentPageState, onBeforeLoad, onAfterLoad]);

  const removePage = useCallback(
    async (index: number) => {
      const currentPages = pagesRef.current;
      if (currentPages.length === 1) return;

      const updatedPages = await saveCurrentPageState();
      const filtered = updatedPages
        .filter((_, i) => i !== index)
        .map((p, i) => ({ ...p, order: i }));
      setPages(filtered);
      pagesRef.current = filtered;

      const c = canvasRef.current;
      const currentIndex = activePageIndexRef.current;
      const newActiveIndex = Math.min(currentIndex, filtered.length - 1);

      if (c && filtered.length > 0) {
        setIsPageSwitching(true);
        onBeforeLoad?.();
        try {
          await c.loadFromJSON(filtered[newActiveIndex].canvasState);
          c.renderAll();
          setActivePageIndex(newActiveIndex);
          activePageIndexRef.current = newActiveIndex;
        } finally {
          onAfterLoad?.();
          setIsPageSwitching(false);
        }
      }
    },
    [saveCurrentPageState, onBeforeLoad, onAfterLoad],
  );

  const reorderPages = useCallback(
    async (fromIndex: number, toIndex: number) => {
      const updatedPages = await saveCurrentPageState();
      const reordered = [...updatedPages];
      const [moved] = reordered.splice(fromIndex, 1);
      reordered.splice(toIndex, 0, moved);
      const withOrder = reordered.map((p, i) => ({ ...p, order: i }));
      setPages(withOrder);
      pagesRef.current = withOrder;

      const currentPages = pagesRef.current;
      const currentIndex = activePageIndexRef.current;
      const newIndex = withOrder.findIndex(
        (p) => p.id === currentPages[currentIndex]?.id,
      );
      setActivePageIndex(newIndex);
      activePageIndexRef.current = newIndex;
    },
    [saveCurrentPageState],
  );
const duplicatePage = useCallback(
    async (sourceIndex: number) => {
      const updatedPages = await saveCurrentPageState();
      const sourcePage = updatedPages[sourceIndex];
      if (!sourcePage) return;

      const ts = Date.now();
      const newId = `page_${ts}`;
      const idPrefix = `dup${ts}`;

      const clonedCanvasState = JSON.parse(
        JSON.stringify(sourcePage.canvasState),
      );

      if (Array.isArray(clonedCanvasState.objects)) {
        clonedCanvasState.objects = clonedCanvasState.objects.map(
          (obj: any) => ({
            ...obj,
            id: obj.id ? `${idPrefix}_${obj.id}` : obj.id,
            // Não alterar o name: é o label visual (ex: "Foto 1") usado para matching de frames
          }),
        );
      }

      const newPage: DynamicLayoutPage = {
        id: newId,
        name: `${sourcePage.name} (Cópia)`,
        order: sourceIndex + 1,
        canvasState: clonedCanvasState,
      };

      const newPages = [
        ...updatedPages.slice(0, sourceIndex + 1),
        newPage,
        ...updatedPages.slice(sourceIndex + 1),
      ].map((p, i) => ({ ...p, order: i }));

      setPages(newPages);
      pagesRef.current = newPages;

      const c = canvasRef.current;
      if (c) {
        setIsPageSwitching(true);
        onBeforeLoad?.();
        try {
          await c.loadFromJSON(newPage.canvasState);
          c.renderAll();
          setActivePageIndex(sourceIndex + 1);
          activePageIndexRef.current = sourceIndex + 1;
        } finally {
          onAfterLoad?.();
          setIsPageSwitching(false);
        }
      }
    },
    [saveCurrentPageState, onBeforeLoad, onAfterLoad],
  );

  const renamePage = useCallback(
    (pageIndex: number, newName: string) => {
      const currentPages = pagesRef.current;
      if (pageIndex < 0 || pageIndex >= currentPages.length) return;

      const updated = currentPages.map((p, i) =>
        i === pageIndex ? { ...p, name: newName } : p,
      );
      setPages(updated);
      pagesRef.current = updated;
    },
    [],
  );

  return {
    pages,
    setPages,
    activePageIndex,
    setActivePageIndex,
    isPageSwitching,
    switchToPage,
    addPage,
    removePage,
    reorderPages,
    duplicatePage,
    renamePage,
    saveCurrentPageState,
  };
}
