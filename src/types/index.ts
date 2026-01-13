// Re-export types from api service to maintain a single source of truth
export {
  type Product,
  type ProductInput,
  type Item,
  type Additional,
  type Type,
  type Customization,
  type CustomizationOption,
  type CustomizationDataMultipleChoice,
  type CustomizationTypeValue,
  type Order,
  type OrderStatus,
  type OrderItemDetailed,
  type OrderItemAdditional,
  type OrderItemCustomizationSummary,
  type ProductsResponse,
} from "../services/api";

// Custom types for manager
export interface User {
  id: string;
  name: string;
  image_url?: string | null;
  email: string;
  phone?: string | null;
  document?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip_code?: string | null;
  role?: "admin" | "ADMIN" | "client" | "customer";
}

export interface Category {
  id: string;
  name: string;
}

export interface LayoutSlot {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  contentType?: "image" | "text" | "shape" | "customization";
}

export interface Layout {
  id: string;
  name: string;
  description?: string;
  image_url?: string;
  slots: LayoutSlot[];
  created_at: string;
  updated_at: string;
}
