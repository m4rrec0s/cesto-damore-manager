import { ImageIcon, Type, MousePointerClick } from "lucide-react";
import {
  parseCustomizationData,
  getCustomizationTypeLabel,
} from "../utils/customization";

interface CustomizationDisplayProps {
  customization: {
    id?: string;
    customization_type?: string;
    title?: string;
    value?: string | null;
  };
}

export function CustomizationDisplay({
  customization,
}: CustomizationDisplayProps) {
  const data = parseCustomizationData(customization.value);

  const type =
    customization.customization_type || data.customization_type || "UNKNOWN";
  const title = customization.title || data.title || "Personalização";

  const renderContent = () => {
    switch (type) {
      case "IMAGES":
        return (
          <div className="space-y-3">
            {data.photos &&
            Array.isArray(data.photos) &&
            data.photos.length > 0 ? (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                {data.photos.map((photo, idx) => (
                  <div
                    key={idx}
                    className="group relative overflow-hidden rounded-xl border border-neutral-100 bg-neutral-50"
                  >
                    <div className="aspect-square relative">
                      {photo.preview_url ? (
                        <img
                          src={photo.preview_url}
                          alt={photo.original_name || `Foto ${idx + 1}`}
                          className="w-full h-full object-cover transition-transform group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-neutral-300">
                          <ImageIcon className="h-8 w-8" />
                        </div>
                      )}
                    </div>
                    {photo.google_drive_url && (
                      <a
                        href={photo.google_drive_url}
                        target="_blank"
                        rel="noreferrer"
                        className="absolute inset-x-0 bottom-0 block bg-black/60 py-1 text-center text-[10px] text-white backdrop-blur-sm hover:bg-black/80 font-medium"
                      >
                        Ver no Drive
                      </a>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-neutral-400 italic">
                Nenhuma imagem anexada.
              </p>
            )}
          </div>
        );

      case "MULTIPLE_CHOICE":
        return (
          <div className="flex flex-col gap-1">
            {data.selected_option_label || data.selected_option ? (
              <div className="flex items-center gap-2 rounded-xl bg-white border border-neutral-100 p-3 shadow-sm">
                <div className="p-1.5 bg-neutral-50 rounded-lg">
                  <MousePointerClick className="h-4 w-4 text-neutral-500" />
                </div>
                <span className="font-semibold text-neutral-950">
                  {data.selected_option_label || data.selected_option}
                </span>
              </div>
            ) : (
              <p className="text-sm text-neutral-400 italic">
                Nenhuma opção selecionada.
              </p>
            )}
          </div>
        );

      case "DYNAMIC_LAYOUT":
        return (
          <div className="space-y-3">
            {data.text &&
            (data.text.startsWith("http") || data.text.startsWith("/")) ? (
              <div className="relative aspect-video w-full max-w-sm overflow-hidden rounded-2xl border border-neutral-100 bg-neutral-50 shadow-sm">
                <img
                  src={data.text}
                  alt="Layout Preview"
                  className="w-full h-full object-cover"
                />
              </div>
            ) : null}

            {data.selected_item_label ||
            (typeof data.selected_item === "string"
              ? data.selected_item
              : (data.selected_item as any)?.selected_item) ? (
              <div className="p-3 bg-white border border-neutral-100 rounded-xl shadow-sm inline-block">
                <p className="text-sm text-neutral-950">
                  <span className="font-bold text-neutral-600">Layout:</span>{" "}
                  {data.selected_item_label ||
                    (typeof data.selected_item === "string"
                      ? data.selected_item
                      : (data.selected_item as any)?.selected_item)}
                </p>
              </div>
            ) : null}
          </div>
        );

      case "TEXT":
      case "TEXT_INPUT":
        return (
          <div className="rounded-2xl border border-neutral-100 bg-neutral-50/50 p-4">
            <div className="flex gap-3">
              <div className="p-1.5 bg-white rounded-lg shadow-sm h-fit">
                <Type className="h-4 w-4 text-neutral-500" />
              </div>
              <p className="whitespace-pre-wrap text-sm text-neutral-950 leading-relaxed font-medium">
                {data.text || "Sem texto"}
              </p>
            </div>
          </div>
        );

      default:
        return (
          <div className="overflow-hidden rounded-xl bg-neutral-50/50 p-3 text-xs text-neutral-400 font-mono border border-neutral-100">
            {JSON.stringify(data, null, 2)}
          </div>
        );
    }
  };

  const typeLabel = getCustomizationTypeLabel(type);

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-neutral-100/50 bg-white p-5 transition-all hover:shadow-md hover:border-neutral-200">
      <div className="flex items-center gap-2">
        <span className="px-2.5 py-1 rounded-lg bg-neutral-600 text-[10px] font-bold text-white uppercase tracking-wider">
          {typeLabel}
        </span>
        <h5 className="text-sm font-bold text-neutral-950">{title}</h5>
      </div>

      <div className="pl-0.5">{renderContent()}</div>
    </div>
  );
}
