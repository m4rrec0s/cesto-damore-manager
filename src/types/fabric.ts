/**
 * Tipos para Fabric Canvas
 */

export type FabricCanvas = {
  add: (obj: unknown) => void;
  remove: (obj: unknown) => void;
  getActiveObject: () => unknown;
  getActiveObjects: () => unknown[];
  setActiveObject: (obj: unknown) => void;
  discardActiveObject: () => void;
  renderAll: () => void;
  bringToFront: (obj: unknown) => void;
  sendToBack: (obj: unknown) => void;
  toDataURL: (options?: Record<string, unknown>) => string;
  toJSON: () => string;
  loadFromJSON: (json: string, callback: () => void) => void;
  on: (event: string, callback: (e?: unknown) => void) => void;
  backgroundImage?: unknown;
  util?: {
    createSerializedArray: (objs: unknown[]) => unknown[];
  };
};

export type FabricObject = {
  set: (properties: Record<string, unknown>) => void;
  clone: (callback: (cloned: unknown) => void) => void;
  left?: number;
  top?: number;
};

export type FabricModule = {
  default: {
    Canvas: new (
      element: HTMLCanvasElement,
      options?: Record<string, unknown>
    ) => FabricCanvas;
    IText: new (
      text: string,
      options?: Record<string, unknown>
    ) => FabricObject;
    Rect: new (options?: Record<string, unknown>) => FabricObject;
    Circle: new (options?: Record<string, unknown>) => FabricObject;
    Image: {
      fromURL: (
        url: string,
        callback: (img: FabricObject) => void,
        options?: Record<string, unknown>
      ) => void;
    };
  };
};
