/**
 * Tipos TypeScript para ItemConstraints
 */

export type ItemType = "PRODUCT" | "ADDITIONAL";
export type ConstraintType = "MUTUALLY_EXCLUSIVE" | "REQUIRES";

export interface ItemConstraint {
  id: string;
  target_item_id: string;
  target_item_type: ItemType;
  target_item_name: string | null;
  constraint_type: ConstraintType;
  related_item_id: string;
  related_item_type: ItemType;
  related_item_name: string | null;
  message: string | null;
  created_at: string;
  updated_at: string;
}

export interface ItemConstraintInput {
  target_item_id: string;
  target_item_type: ItemType;
  constraint_type: ConstraintType;
  related_item_id: string;
  related_item_type: ItemType;
  message?: string;
}

export interface SearchableItem {
  id: string;
  name: string;
  type: ItemType;
  image_url: string | null;
}

export interface SearchItemsResponse {
  products: SearchableItem[];
  additionals: SearchableItem[];
}

export const CONSTRAINT_TYPE_LABELS: Record<ConstraintType, string> = {
  MUTUALLY_EXCLUSIVE: "Mutuamente Exclusivo",
  REQUIRES: "Requer",
};

export const CONSTRAINT_TYPE_DESCRIPTIONS: Record<ConstraintType, string> = {
  MUTUALLY_EXCLUSIVE:
    "Os itens não podem ser selecionados juntos no mesmo pedido",
  REQUIRES:
    "O item principal requer que o item relacionado também seja adicionado",
};

export const ITEM_TYPE_LABELS: Record<ItemType, string> = {
  PRODUCT: "Produto",
  ADDITIONAL: "Adicional",
};
