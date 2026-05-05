import { useState, type MouseEvent } from "react";
import {
  AlignLeft,
  LayoutGrid,
  Eye,
  ExternalLink,
  Package,
  Clock,
  Image as LucideImage,
  Cat as Panda,
  X,
  FolderOpen,
} from "lucide-react";
import { parseCustomizationData } from "../utils/customization";

interface CustomizationDisplayProps {
  customization: {
    id?: string;
    customization_type?: string;
    title?: string;
    value?: string | null;
  };
}

interface PhotoData {
  preview_url?: string;
  google_drive_url?: string;
  original_name?: string;
}

export function CustomizationDisplay({
  customization,
}: CustomizationDisplayProps) {
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showImagesModal, setShowImagesModal] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  const parsed = parseCustomizationData(customization.value);
  const data = parsed as Record<string, unknown> & {
    photos?: PhotoData[];
    customization_type?: string;
    title?: string;
    selected_option_label?: string;
    selected_option?: string;
    selected_item_label?: string;
    selected_item?: string | { selected_item?: string };
    additional_time?: number;
    text?: string;
    google_drive_url?: string;
  };

  const type =
    customization.customization_type || data.customization_type || "UNKNOWN";
  const title = customization.title || data.title || "Personalização";

  const isPelucia =
    (type === "MULTIPLE_CHOICE" && title.toLowerCase().includes("pelúcia")) ||
    title.toLowerCase().includes("pelucia");

  const getIcon = () => {
    if (isPelucia) {
      return <Panda className="h-5 w-5 text-neutral-600" strokeWidth={1.5} />;
    }

    switch (type) {
      case "IMAGES":
        return (
          <LucideImage className="h-5 w-5 text-neutral-600" strokeWidth={1.5} />
        );
      case "DYNAMIC_LAYOUT":
        return (
          <LayoutGrid className="h-5 w-5 text-neutral-600" strokeWidth={1.5} />
        );
      case "TEXT":
      case "TEXT_INPUT":
        return (
          <AlignLeft className="h-5 w-5 text-neutral-600" strokeWidth={1.5} />
        );
      case "MULTIPLE_CHOICE":
      default:
        return (
          <Package className="h-5 w-5 text-neutral-600" strokeWidth={1.5} />
        );
    }
  };

  const openModal = (url: string, e: MouseEvent) => {
    e.stopPropagation();
    setPreviewImageUrl(url);
    setShowPreviewModal(true);
  };

  return (
    <>
      <div className="flex gap-4 py-2 border-b border-neutral-100 last:border-0 last:pb-0 first:pt-0">
        <div className="shrink-0 mt-0.5">{getIcon()}</div>
        <div className="flex flex-col gap-1 w-full">
          <span className="text-sm font-semibold text-neutral-900">
            {title}
          </span>

          {type === "IMAGES" && (
            <div className="flex flex-col gap-3 mt-1">
              {data.photos &&
              Array.isArray(data.photos) &&
              data.photos.length > 0 ? (
                <div className="flex items-center gap-3 mt-1">
                  {data.photos.some((p: PhotoData) => p.preview_url) ? (
                    <button
                      onClick={() => setShowImagesModal(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors text-xs font-semibold w-fit border border-blue-100/50 shadow-sm"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      Ver imagens anexadas
                    </button>
                  ) : (
                    <span className="text-xs text-neutral-500 italic bg-neutral-50 px-2 py-1 rounded">
                      Imagens pendentes no BD
                    </span>
                  )}

                  {data.photos.some((p: PhotoData) => p.google_drive_url) && (
                    <a
                      href={
                        data.photos.find((p: PhotoData) => p.google_drive_url)
                          ?.google_drive_url
                      }
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-blue-600 hover:text-blue-700 hover:underline flex items-center justify-center gap-1 font-medium bg-blue-50/50 px-3 py-1.5 rounded-lg"
                    >
                      <FolderOpen className="h-3.5 w-3.5" /> Acessar pasta no
                      Drive
                    </a>
                  )}
                </div>
              ) : (
                <span className="text-sm text-neutral-500">
                  Nenhuma imagem anexada.
                </span>
              )}
            </div>
          )}

          {type === "MULTIPLE_CHOICE" && (
            <span className="text-sm text-neutral-500">
              {data.selected_option_label ||
                data.selected_option ||
                "Nenhuma opção selecionada"}
            </span>
          )}

          {type === "DYNAMIC_LAYOUT" && (
            <div className="flex flex-col gap-2 items-start mt-0.5">
              <span className="text-sm text-neutral-500">
                {data.selected_item_label ||
                  (typeof data.selected_item === "string"
                    ? data.selected_item
                    : typeof data.selected_item === "object" &&
                        data.selected_item !== null
                      ? ((data.selected_item as Record<string, unknown>)
                          ?.selected_item as string)
                      : null)}
              </span>

              {typeof data.additional_time === "number" &&
                data.additional_time > 0 && (
                  <div className="flex items-center gap-1.5 text-xs text-neutral-400 mt-1">
                    <Clock className="h-3.5 w-3.5" />
                    <span>Produção: +{String(data.additional_time)}h</span>
                  </div>
                )}

              {data.text &&
              (data.text.startsWith("http") || data.text.startsWith("/")) ? (
                <div className="mt-1 flex items-center gap-2">
                  <button
                    onClick={(e) => openModal(data.text as string, e)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors text-xs font-semibold w-fit border border-blue-100/50 shadow-sm"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    Ver prévia do layout
                  </button>
                  {!!data.google_drive_url &&
                    typeof data.google_drive_url === "string" && (
                      <a
                        href={data.google_drive_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-blue-600 hover:text-blue-700 hover:underline flex items-center justify-center gap-1 font-medium bg-blue-50/50 px-3 py-1.5 rounded-lg"
                      >
                        <FolderOpen className="h-3.5 w-3.5" /> Drive
                      </a>
                    )}
                </div>
              ) : data.text ? (
                <span className="text-xs text-neutral-500 italic bg-neutral-50 px-2 py-1 rounded mt-1">
                  Logo/Layout pendente no BD
                </span>
              ) : null}
            </div>
          )}

          {(type === "TEXT" || type === "TEXT_INPUT") && (
            <p className="text-sm text-neutral-500 whitespace-pre-wrap mt-0.5">
              {data.text || "Sem texto"}
            </p>
          )}

          {type !== "IMAGES" &&
            type !== "MULTIPLE_CHOICE" &&
            type !== "DYNAMIC_LAYOUT" &&
            type !== "TEXT" &&
            type !== "TEXT_INPUT" && (
              <pre className="text-xs text-neutral-400 font-mono mt-2 overflow-x-auto bg-neutral-50 p-3 rounded-lg border border-neutral-100">
                {JSON.stringify(data, null, 2)}
              </pre>
            )}
        </div>
      </div>

      {/* Modal Genérico de Imagem Única (Layout ou apenas 1 foto) */}
      {showPreviewModal && previewImageUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setShowPreviewModal(false)}
        >
          <div
            className="relative max-w-4xl w-full max-h-screen flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowPreviewModal(false)}
              className="absolute -top-10 right-0 text-white hover:text-neutral-200 transition-colors bg-white/10 p-2 rounded-full"
            >
              <X className="h-5 w-5" />
            </button>
            <img
              src={previewImageUrl}
              alt="Prévia Ampliada"
              className="max-w-full max-h-[85vh] rounded-lg shadow-xl object-contain bg-white"
            />
          </div>
        </div>
      )}

      {/* Modal de Múltiplas Imagens (IMAGES) */}
      {showImagesModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 md:p-8"
          onClick={() => setShowImagesModal(false)}
        >
          <div
            className="relative max-w-5xl w-full max-h-[90vh] bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-neutral-100">
              <h3 className="font-semibold text-neutral-900">
                Imagens Anexadas
              </h3>
              <button
                onClick={() => setShowImagesModal(false)}
                className="text-neutral-400 hover:text-neutral-600 transition-colors p-1 rounded-full hover:bg-neutral-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto w-full">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {data.photos?.map((photo: PhotoData, idx: number) => (
                  <div key={idx} className="flex flex-col gap-2">
                    <div className="relative aspect-square overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50 flex items-center justify-center group shadow-sm transition-all hover:shadow-md">
                      {photo.preview_url ? (
                        <img
                          src={photo.preview_url}
                          alt={`Foto ${idx + 1}`}
                          className="h-full w-full object-cover cursor-pointer"
                          onClick={(e) =>
                            openModal(photo.preview_url as string, e)
                          }
                        />
                      ) : (
                        <LucideImage className="h-8 w-8 text-neutral-300" />
                      )}

                      {photo.preview_url && (
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors pointer-events-none" />
                      )}
                    </div>
                    {photo.google_drive_url && (
                      <a
                        href={photo.google_drive_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 justify-center py-1.5 px-2 bg-blue-50 rounded-lg"
                      >
                        <ExternalLink className="h-3 w-3" /> Ver no Drive
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
