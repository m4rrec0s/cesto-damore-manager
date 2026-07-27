import { useState, useRef, useCallback } from "react";
import ReactCrop, { type PixelCrop, centerCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { Crop, X } from "lucide-react";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../ui/dialog";

function canvasPreview(image: HTMLImageElement, canvas: HTMLCanvasElement, crop: PixelCrop) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;

  canvas.width = Math.round(crop.width * scaleX);
  canvas.height = Math.round(crop.height * scaleY);

  ctx.drawImage(
    image,
    crop.x * scaleX,
    crop.y * scaleY,
    crop.width * scaleX,
    crop.height * scaleY,
    0,
    0,
    canvas.width,
    canvas.height,
  );
}

function toBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
      },
      "image/webp",
      0.9,
    );
  });
}

interface ImageCropDialogProps {
  open: boolean;
  imageUrl: string;
  onComplete: (blob: Blob) => void;
  onClose: () => void;
}

export function ImageCropDialog({ open, imageUrl, onComplete, onClose }: ImageCropDialogProps) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [crop, setCrop] = useState<PixelCrop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [loading, setLoading] = useState(false);

  const onImageLoad = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      const { width, height } = e.currentTarget;
      imgRef.current = e.currentTarget;
      const newCrop = centerCrop(
        { unit: "%", x: 5, y: 5, width: 90, height: 90 },
        width,
        height,
      );
      setCrop(newCrop);
      setCompletedCrop(newCrop);
    },
    [],
  );

  const handleConfirm = async () => {
    if (!completedCrop || !imgRef.current || !canvasRef.current) return;
    setLoading(true);
    try {
      canvasPreview(imgRef.current, canvasRef.current, completedCrop);
      const blob = await toBlob(canvasRef.current);
      onComplete(blob);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Recortar Imagem</DialogTitle>
        </DialogHeader>

        <div className="flex justify-center">
          <ReactCrop
            crop={crop}
            onChange={(c) => setCrop(c)}
            onComplete={(c) => setCompletedCrop(c)}
            className="max-h-[60vh] rounded-md overflow-hidden"
          >
            <img
              ref={imgRef}
              src={imageUrl}
              onLoad={onImageLoad}
              alt="Crop preview"
              className="max-h-[60vh] w-auto object-contain"
            />
          </ReactCrop>
        </div>

        <canvas ref={canvasRef} className="hidden" />

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            <X className="mr-1 h-4 w-4" />
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={loading}>
            <Crop className="mr-1 h-4 w-4" />
            {loading ? "Processando..." : "Aplicar Corte"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
