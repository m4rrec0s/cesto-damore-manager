import { ImageIcon, Type, MousePointerClick, Clock } from "lucide-react";
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
              <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 md:grid-cols-5">
                {data.photos.map((photo, idx) => (
                  <div
                    key={idx}
                    className="group relative overflow-hidden rounded-lg border border-neutral-100 bg-neutral-50"
                  >
                    <div className="aspect-square relative bg-white">
                      {photo.preview_url ? (
                        <img
                          src={photo.preview_url}
                          alt={photo.original_name || `Foto ${idx + 1}`}
                          className="w-full h-full object-contain p-2"
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
                        className="absolute inset-x-0 bottom-0 block bg-black/60 py-0.5 text-center text-[9px] text-white backdrop-blur-sm hover:bg-black/80 font-medium"
                      >
                        Ver no Drive
                      </a>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-neutral-400 italic">
                Nenhuma imagem anexada.
              </p>
            )}
          </div>
        );

      case "MULTIPLE_CHOICE":
        return (
          <div className="flex flex-col gap-1">
            {data.selected_option_label || data.selected_option ? (
              <div className="flex items-center gap-1.5 rounded-lg bg-white border border-neutral-100 p-2 shadow-sm">
                <div className="p-1 bg-neutral-50 rounded-md">
                  <MousePointerClick className="h-3.5 w-3.5 text-neutral-500" />
                </div>
                <span className="font-semibold text-neutral-950 text-xs">
                  {data.selected_option_label || data.selected_option}
                </span>
              </div>
            ) : (
              <p className="text-xs text-neutral-400 italic">
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
              <div className="relative aspect-video w-full max-w-xs overflow-hidden rounded-xl border border-neutral-100 bg-white shadow-sm">
                <img
                  src={data.text}
                  alt="Layout Preview"
                  className="w-full h-full object-contain p-1.5"
                />
              </div>
            ) : null}

            {data.selected_item_label ||
              (typeof data.selected_item === "string"
                ? data.selected_item
                : (data.selected_item as any)?.selected_item) ? (
              <div className="flex flex-col gap-2">
                <div className="p-2 bg-white border border-neutral-100 rounded-lg shadow-sm inline-block w-fit">
                  <p className="text-xs text-neutral-950">
                    <span className="font-bold text-neutral-600">Layout:</span>{" "}
                    {data.selected_item_label ||
                      (typeof data.selected_item === "string"
                        ? data.selected_item
                        : (data.selected_item as any)?.selected_item)}
                  </p>
                </div>
                {(data.additional_time as number) > 0 && (
                  <div className="flex items-center gap-1 pl-0.5">
                    <Clock className="h-3 w-3 text-neutral-400" />
                    <span className="text-[10px] font-semibold text-neutral-500">
                      Produção: {String(data.additional_time)}h
                    </span>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        );

      case "TEXT":
      case "TEXT_INPUT":
        return (
          <div className="rounded-xl border border-neutral-100 bg-neutral-50/50 p-3">
            <div className="flex gap-2">
              <div className="p-1 bg-white rounded-md shadow-sm h-fit">
                <Type className="h-3.5 w-3.5 text-neutral-500" />
              </div>
              <p className="whitespace-pre-wrap text-xs text-neutral-950 leading-relaxed font-medium">
                {data.text || "Sem texto"}
              </p>
            </div>
          </div>
        );

      default:
        return (
          <div className="overflow-hidden rounded-lg bg-neutral-50/50 p-2 text-[10px] text-neutral-400 font-mono border border-neutral-100">
            {JSON.stringify(data, null, 2)}
          </div>
        );
    }
  };

  const typeLabel = getCustomizationTypeLabel(type);

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-neutral-100/50 bg-white p-3 transition-all hover:shadow-md hover:border-neutral-200">
      <div className="flex items-center gap-1.5">
        <span className="px-2 py-0.5 rounded-md bg-neutral-600 text-[9px] font-bold text-white uppercase tracking-wider">
          {typeLabel}
        </span>
        <h5 className="text-xs font-bold text-neutral-950">{title}</h5>
      </div>

      <div className="pl-0">{renderContent()}</div>
    </div>
  );
}
