export interface CustomizationData {
  customization_type?: string;
  title?: string;
  photos?: {
    preview_url?: string;
    google_drive_url?: string;
    original_name?: string;
    [key: string]: unknown;
  }[];
  selected_option?: string;
  selected_option_label?: string;
  text?: string;
  selected_item?: { selected_item?: string } | string;
  selected_item_label?: string;
  price_adjustment?: number;
  [key: string]: unknown;
}

export function parseCustomizationData(
  value?: string | null,
): CustomizationData {
  if (!value) return {};

  try {
    const parsed = JSON.parse(value) as CustomizationData;

    // Fix bugged TEXT format
    if (
      parsed.customization_type === "TEXT" &&
      parsed.text &&
      typeof parsed.text === "string"
    ) {
      if (parsed.text.startsWith("text:")) {
        const match = parsed.text.match(/^text:\s*(.*?)(?:,\s*fields:|$)/);
        if (match && match[1]) {
          parsed.text = match[1].trim();
        }
      }
    }

    return parsed;
  } catch {
    return {};
  }
}

export function getCustomizationTypeLabel(type?: string): string {
  switch (type) {
    case "IMAGES":
      return "Fotos";
    case "TEXT":
    case "TEXT_INPUT":
      return "Texto";
    case "MULTIPLE_CHOICE":
      return "Escolha";
    case "DYNAMIC_LAYOUT":
      return "Design Dinâmico";
    default:
      return "Customização";
  }
}
