/**
 * Debug utilities para DesignEditorPage
 * Ajuda a diagnosticar problemas de renderização do canvas
 */

export const debugCanvasState = (canvas: unknown) => {
  if (!canvas) {
    console.warn("Canvas is null or undefined");
    return;
  }

  const canvasObj = canvas as {
    _objects?: unknown[];
    width?: number;
    height?: number;
    backgroundColor?: string;
  };

  console.log("Canvas Debug Info:", {
    objectCount: (canvasObj._objects || []).length,
    width: canvasObj.width,
    height: canvasObj.height,
    backgroundColor: canvasObj.backgroundColor,
    objects: canvasObj._objects,
  });
};

export const debugAddObject = (
  canvas: unknown,
  object: unknown,
  objectType: string
) => {
  console.log(`[DEBUG] Adding ${objectType}:`, {
    object,
    canvasAvailable: !!canvas,
    objectsBeforeAdd: (canvas as { _objects?: unknown[] })._objects?.length,
  });

  try {
    (canvas as { add: (obj: unknown) => void }).add(object);
    console.log(
      `[DEBUG] Successfully added ${objectType}. Objects after add:`,
      (canvas as { _objects?: unknown[] })._objects?.length
    );
  } catch (error) {
    console.error(`[DEBUG] Error adding ${objectType}:`, error);
  }
};

export const debugRenderAll = (canvas: unknown) => {
  try {
    console.log("[DEBUG] Calling renderAll()");
    (canvas as { renderAll: () => void }).renderAll();
    console.log(
      "[DEBUG] renderAll() completed. Current object count:",
      (canvas as { _objects?: unknown[] })._objects?.length
    );
  } catch (error) {
    console.error("[DEBUG] Error in renderAll():", error);
  }
};
