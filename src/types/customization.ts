// ================ NEW REFACTORED TYPES (Aligned with Backend) ================

/**
 * Tipos de regras de customização
 *
 * - PHOTO_UPLOAD: Upload simples de fotos (sem layout específico)
 * - LAYOUT_PRESET: Layout pré-pronto (usuário apenas escolhe, sem upload)
 * - LAYOUT_WITH_PHOTOS: Layout com espaços para fotos do usuário
 * - TEXT_INPUT: Campo de texto personalizado
 * - OPTION_SELECT: Escolha de opção (ex: cor, tamanho)
 * - ITEM_SUBSTITUTION: Substituição de item
 */
export type ConstraintType = "MUTUALLY_EXCLUSIVE" | "REQUIRES";

export type ItemType = "PRODUCT" | "ADDITIONAL";

/**
 * CustomizationType enum do Prisma
 */
export enum CustomizationType {
  IMAGES = "IMAGES",
  TEXT = "TEXT",
  MULTIPLE_CHOICE = "MULTIPLE_CHOICE",
  BASE_LAYOUT = "BASE_LAYOUT",
}

/**
 * Estrutura de um layout pronto (sem upload de fotos)
 * Exemplo: "Layout Romântico", "Layout Esportivo"
 */
export interface LayoutPreset {
  id: string;
  name: string;
  description?: string;
  preview_image_url: string;
  price_adjustment?: number;
}

/**
 * Estrutura de um layout com espaços para fotos do usuário
 * Exemplo: "Layout 4 Fotos", "Collage 6 Fotos"
 */
export interface LayoutWithPhotos {
  id: string;
  name: string;
  description?: string;
  preview_image_url: string;
  photo_slots: number;
  photo_slots_config?: Array<{
    slot: number;
    x: number;
    y: number;
    width: number;
    height: number;
    rotation?: number;
  }>;
  price_adjustment?: number;
}

/**
 * Opção genérica para OPTION_SELECT
 */
export interface SelectOption {
  id: string;
  label: string;
  value: string;
  price_adjustment?: number;
  image_url?: string;
}

/**
 * Estrutura de item para substituição
 */
export interface SubstitutionItem {
  original_item: string;
  available_substitutes: Array<{
    item: string;
    price_adjustment: number;
  }>;
}

/**
 * Opções disponíveis para cada tipo de regra
 */
export type RuleAvailableOptions =
  | LayoutPreset[]
  | LayoutWithPhotos[]
  | SelectOption[]
  | { items: SubstitutionItem[] }
  | null;

// ================ Backend DTO Types ================

/**
 * Layout DTO retornado pelo backend
 */
export interface LayoutDTO {
  id: string;
  name: string;
  description?: string | null;
  baseImageUrl: string;
  placeholderPositions: Record<string, unknown>[];
  allowsPhotoUpload: boolean;
  maxPhotos: number;
  allowsTextInput: boolean;
  textPositions: Record<string, unknown>[];
  maxTextInputs: number;
  preview3dUrl?: string | null;
  displayOrder: number;
}

/**
 * ProductRule DTO retornado pelo backend
 */
export interface ProductRuleDTO {
  id: string;
  ruleType: string;
  title: string;
  description?: string | null;
  required: boolean;
  maxItems?: number | null;
  conflictWith: string[];
  dependencies: string[];
  availableOptions: Record<string, unknown> | null;
  previewImageUrl?: string | null;
  displayOrder: number;
}

/**
 * Legacy Customization DTO retornado pelo backend
 */
export interface LegacyCustomizationDTO {
  id: string;
  customizationType: CustomizationType;
  title: string;
  description?: string | null;
  isRequired: boolean;
  maxItems?: number | null;
  availableOptions: Record<string, unknown> | null;
  layoutId?: string | null;
  previewImageUrl?: string | null;
  displayOrder: number;
}

/**
 * Constraint retornado pelo backend
 */
export interface ConstraintDTO {
  id: string;
  targetItemId: string;
  targetItemType: ItemType;
  constraintType: string;
  relatedItemId: string;
  relatedItemType: ItemType;
  message?: string | null;
}

/**
 * Resposta de configuração de customização do backend
 */
export interface CustomizationConfigResponse {
  item: {
    id: string;
    name: string;
    type?: ItemType;
    allowsCustomization?: boolean;
    allows_customization?: boolean; // Backend retorna em snake_case
    has3dPreview?: boolean;
  };
  customizations: Array<{
    id: string;
    type: string;
    name: string;
    description?: string;
    isRequired: boolean;
    customization_data: Record<string, unknown>;
    price: number;
  }>;
  layouts?: LayoutDTO[];
  rules?: ProductRuleDTO[];
  legacyRules?: LegacyCustomizationDTO[];
  constraints?: ConstraintDTO[];
}

/**
 * Input para customização que será enviado ao backend
 */
export interface CustomizationInput {
  ruleId?: string | null;
  customizationRuleId?: string | null;
  customizationType: CustomizationType;
  data: Record<string, unknown>;
  selectedLayoutId?: string | null;
}

/**
 * Preview payload retornado pelo backend
 */
export interface PreviewPayload {
  layout: LayoutDTO;
  photos: Array<{
    source: string;
    positionKey?: string;
    placement?: Record<string, unknown>;
  }>;
  texts: Array<{
    value: string;
    positionKey?: string;
    placement?: Record<string, unknown>;
  }>;
  metadata: Record<string, unknown>;
}

/**
 * Artwork asset para enviar ao backend
 */
export interface ArtworkAsset {
  base64?: string;
  base64Data?: string;
  mimeType?: string;
  fileName?: string;
}

/**
 * Payload para salvar customização de item do pedido
 */
export interface SaveOrderItemCustomizationPayload {
  customizationRuleId?: string | null;
  customizationType: CustomizationType;
  title: string;
  selectedLayoutId?: string | null;
  data: Record<string, unknown>;
  finalArtwork?: ArtworkAsset;
  finalArtworks?: ArtworkAsset[];
}

/**
 * Validação de customizações
 */
export interface ValidationResponse {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// ================ Frontend State Types ================

export interface ItemConstraint {
  id: string;
  target_item_id: string;
  target_item_type: ItemType;
  constraint_type: ConstraintType;
  related_item_id: string;
  related_item_type: ItemType;
  message?: string;
  created_at: string;
  updated_at: string;
}

export interface ProductType {
  id: string;
  name: string;
  category: "PERSONALIZADA" | "MODELO_PRONTO";
  delivery_type: "PRONTA_ENTREGA" | "PRAZO_24H";
  stock_quantity?: number | null;
  has_3d_preview: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Input para criar/atualizar ProductRule
 */
export interface ProductRuleInput {
  product_type_id: string;
  title: string;
  description?: string;
  required?: boolean;
  max_items?: number | null;
  conflict_with?: string[] | null;
  dependencies?: string[] | null;
  available_options?: RuleAvailableOptions;
  preview_image_url?: string | null;
  display_order?: number;
}

/**
 * Foto enviada pelo usuário
 */
export interface UserPhoto {
  temp_file_id?: string;
  original_name: string;
  preview_url?: string;
  position: number;
  slot?: number;
}

export interface CustomizationData {
  // Para LAYOUT_PRESET
  selected_layout_id?: string;

  // Para LAYOUT_WITH_PHOTOS
  selected_layout_with_photos_id?: string;

  // Para PHOTO_UPLOAD e LAYOUT_WITH_PHOTOS
  photos?: UserPhoto[];

  // Para TEXT_INPUT
  text?: string;

  // Para OPTION_SELECT
  selected_option?: string;

  // Para ITEM_SUBSTITUTION
  selected_item?: {
    original_item: string;
    selected_item: string;
    price_adjustment: number;
  };

  [key: string]: unknown;
}

export interface CustomizationState {
  productId: string;
  data: Record<string, CustomizationData>;
  previewUrl?: string;
}

export interface PreviewResponse {
  previewUrl?: string;
  model3d?: string;
  message?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

// ================ LEGACY TYPES (Mantidos para retrocompatibilidade) ================

export type CustomizationTypeValue =
  | "PHOTO_UPLOAD"
  | "TEXT_INPUT"
  | "MULTIPLE_CHOICE"
  | "ITEM_SUBSTITUTION";

export interface CustomizationRule {
  id: string;
  product_id?: string;
  additional_id?: string;
  customization_type: CustomizationTypeValue;
  title: string;
  description?: string;
  is_required: boolean;
  max_items?: number | null;
  available_options?: CustomizationAvailableOptions | null;
  preview_image_url?: string | null;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export type CustomizationAvailableOptions =
  | Array<{
    id?: string;
    label: string;
    value: string;
    price_adjustment?: number;
  }>
  | Record<string, unknown>;

export interface CustomizationRuleInput {
  customization_type: CustomizationTypeValue;
  title: string;
  description?: string;
  is_required?: boolean;
  max_items?: number | null;
  available_options?: CustomizationAvailableOptions | null;
  display_order?: number;
}

// ================ HELPER FUNCTIONS ================

/**
 * Helper para verificar se é um array de layouts prontos
 */
export function isLayoutPresetArray(
  options: RuleAvailableOptions
): options is LayoutPreset[] {
  return (
    Array.isArray(options) &&
    options.length > 0 &&
    "preview_image_url" in options[0] &&
    !("photo_slots" in options[0])
  );
}

/**
 * Helper para verificar se é um array de layouts com fotos
 */
export function isLayoutWithPhotosArray(
  options: RuleAvailableOptions
): options is LayoutWithPhotos[] {
  return (
    Array.isArray(options) && options.length > 0 && "photo_slots" in options[0]
  );
}

/**
 * Helper para verificar se é um array de opções de seleção
 */
export function isSelectOptionArray(
  options: RuleAvailableOptions
): options is SelectOption[] {
  return (
    Array.isArray(options) &&
    options.length > 0 &&
    "value" in options[0] &&
    !("photo_slots" in options[0]) &&
    !("preview_image_url" in options[0])
  );
}

/**
 * Helper para verificar se são opções de substituição
 */
export function isSubstitutionOptions(
  options: RuleAvailableOptions
): options is { items: SubstitutionItem[] } {
  return (
    options !== null &&
    typeof options === "object" &&
    !Array.isArray(options) &&
    "items" in options
  );
}
