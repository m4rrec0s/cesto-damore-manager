import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";

// ===== Basic Types =====
export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  name: string;
  email: string;
  password: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  document?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip_code?: string | null;
  role?: "admin" | "ADMIN" | "client" | "customer";
  image_url?: string | null;
}

export interface Category {
  id: string;
  name: string;
}

export interface Type {
  id: string;
  name: string;
}

export interface Color {
  id: string;
  name: string;
  hex_code: string;
  created_at: string;
  updated_at: string;
}

export interface CepInfo {
  zip_code: string;
  address: string;
  neighborhood: string;
  city: string;
  state: string;
  additional_info: {
    ibge_code: string;
    ddd: string;
  };
}

export interface PaginationInfo {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}

// ===== Product Types =====
export interface ProductComponent {
  id: string;
  product_id: string;
  item_id: string;
  quantity: number;
  item: Item;
}

export interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  discount?: number;
  image_url?: string | null;
  categories: Category[];
  type_id: string;
  production_time?: number;
  is_active?: boolean;
  components?: ProductComponent[];
  related_products?: Omit<Product, "components" | "related_products">[];
  created_at: string;
  updated_at: string;
}

export interface ProductInput {
  name: string;
  description?: string;
  price: number;
  discount?: number;
  image_url?: string | null;
  categories: string[];
  type_id: string;
  production_time?: number;
  is_active?: boolean;
  components?: { item_id: string; quantity: number }[];
  additionals?: { item_id: string; custom_price?: number }[];
}

export interface ProductsResponse {
  products: Product[];
  pagination: PaginationInfo;
}

// ===== Item/Additional Types =====
export interface CustomizationOption {
  id: string;
  label: string;
  image_url?: string;
  description?: string;
  image_filename?: string;
  price_modifier: number;
}

export interface CustomizationDataMultipleChoice {
  options: CustomizationOption[];
  max_selection?: number;
  min_selection?: number;
  [key: string]: unknown;
}

export type CustomizationTypeValue =
  | "DYNAMIC_LAYOUT"
  | "IMAGES"
  | "TEXT"
  | "MULTIPLE_CHOICE";

export interface Customization {
  id: string;
  name: string;
  description?: string;
  item_id: string;
  price: number;
  isRequired: boolean;
  type: CustomizationTypeValue;
  customization_data: CustomizationDataMultipleChoice | Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Item {
  id: string;
  name: string;
  description?: string;
  type: "caneca" | "quadro";
  stock_quantity: number;
  base_price: number;
  discount: number;
  image_url: string;
  allows_customization: boolean;
  layout_base_id: string | null;
  created_at: string;
  updated_at: string;
  additionals: Additional[];
  customizations: Customization[];
  layout_base?: {
    id: string;
    additional_time: number;
  };
}

export interface Additional {
  id: string;
  name: string;
  description?: string;
  price: number;
  discount?: number;
  image_url?: string;
  stock_quantity?: number;
  allows_customization?: boolean;
  customizations?: Customization[];
  compatible_products?: Array<{
    product_id: string;
    product_name: string;
    custom_price: number | null;
    is_active: boolean;
  }>;
}

export interface ItemsResponse {
  items: Item[];
  pagination: PaginationInfo;
}

export interface OrdersResponse {
  data: {
    data: Order[];
    pagination: PaginationInfo;
  };
}

// ===== Order Types =====
export type OrderStatus =
  | "PENDING"
  | "PAID"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELED";

export interface OrderItemAdditional {
  id: string;
  additional_id: string;
  quantity: number;
  price: number;
  additional?: Additional;
}

export interface OrderItemCustomizationSummary {
  id: string;
  customization_id?: string | null;
  title: string;
  customization_type: CustomizationTypeValue;
  google_drive_url?: string | null;
  value?: string | null;
}

export interface OrderItemDetailed {
  id: string;
  product_id: string;
  quantity: number;
  price: number;
  product?: Product;
  additionals: OrderItemAdditional[];
  customizations: OrderItemCustomizationSummary[];
}

export interface OrderItemInput {
  product_id: string;
  quantity: number;
  price: number;
  additionals?: { additional_id: string; quantity: number; price: number }[];
}

export interface Order {
  id: string;
  status: OrderStatus;
  user_id: string;
  user?: User & { phone?: string | null };
  items: OrderItemDetailed[];
  total: number;
  discount?: number | null;
  created_at: string;
  updated_at: string;
  delivery_address?: string | null;
  complement?: string | null;
  send_anonymously?: boolean | null;
  delivery_city?: string | null;
  delivery_state?: string | null;
  delivery_method?: string | null;
  delivery_date?: string | null;
  shipping_price?: number | null;
  payment_method?: string | null;
  grand_total?: number | null;
  recipient_phone?: string | null;
  payment?: {
    id: string;
    status: string;
    payment_method?: string | null;
    approved_at?: string | null;
    mercado_pago_id?: string | null;
    webhook_attempts?: number | null;
    last_webhook_at?: string | null;
  } | null;
}

interface CacheShape {
  users: unknown | null;
  products: unknown | null;
  categories: unknown | null;
  items: unknown | null;
  types: unknown | null;
  orders: unknown | null;
  [key: string]: unknown | null;
}

const API_URL = import.meta.env.VITE_API_URL as string;

class ApiService {
  private static cache: CacheShape = {
    users: null,
    products: null,
    categories: null,
    items: null,
    types: null,
    orders: null,
  };

  private client = axios.create({
    baseURL: API_URL,
  });

  constructor() {
    this.client.interceptors.request.use((config) => {
      const token =
        localStorage.getItem("token") || localStorage.getItem("appToken");

      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      return config;
    });

    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        // 401: Token inválido ou expirado
        if (error.response?.status === 401) {
          console.warn("❌ Sessão expirada ou token inválido");
          localStorage.removeItem("token");
          localStorage.removeItem("appToken");
          localStorage.removeItem("user");
          window.location.href = "/login";
        }

        // 403: Acesso negado (falha na autorização do servidor)
        // Isto significa que o usuário tentou acessar algo sem permissão
        if (error.response?.status === 403) {
          console.error(
            "🚫 ACESSO NEGADO: Você não tem permissão para esta ação",
          );
          // Limpar dados de usuário em caso de inconsistência
          localStorage.removeItem("user");
          throw new Error(
            "Acesso negado: você não tem permissão para esta ação",
          );
        }

        return Promise.reject(error);
      },
    );
  }

  // ===== Admin Validation =====
  /**
   * ⚠️ DEPRECATED: Não use mais para validação de segurança
   *
   * Esta função apenas valida localmente se o usuário tem role de admin
   * MAS o servidor sempre valida em TODA requisição admin
   *
   * Use apenas para lançar erro rápido antes de fazer a requisição
   * A validação REAL é feita pelo servidor (que retorna 403 se não autorizado)
   */
  private validateAdminRole() {
    const userStr = localStorage.getItem("user");
    if (!userStr) {
      throw new Error("Usuário não autenticado");
    }

    try {
      const user = JSON.parse(userStr) as User;
      // ⚠️ AVISO: Este é apenas um check local
      // O servidor SEMPRE valida o role no banco de dados
      if (user.role !== "admin" && user.role !== "ADMIN") {
        throw new Error("Acesso restrito a administradores");
      }
      return user;
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes("Acesso restrito")) {
        throw err;
      }
      throw new Error("Erro ao validar permissões de admin");
    }
  }

  // ===== Cache Utilities =====
  static getCache() {
    return ApiService.cache;
  }

  clearAllCache() {
    ApiService.cache = {
      users: null,
      products: null,
      categories: null,
      items: null,
      types: null,
      orders: null,
    };
  }

  clearCache(key: string) {
    (ApiService.cache as Record<string, unknown>)[key] = null;
  }

  // ===== HTTP Methods =====
  get = async (url: string, config?: Record<string, unknown>) =>
    this.client.get(url, config);

  post = async (url: string, data: unknown) => this.client.post(url, data);
  put = async (url: string, data: unknown) => this.client.put(url, data);
  delete = async (url: string) => this.client.delete(url);

  // ===== Auth =====
  register = async (data: RegisterCredentials) =>
    (await this.post("/auth/register", data)).data;

  login = async (credentials: LoginCredentials) => {
    const response = await this.post("/auth/login", credentials);
    const { token, appToken, requires2FA } = response.data;

    // If 2FA is required, we don't save token yet
    if (requires2FA) {
      return response.data;
    }

    if (token || appToken) {
      localStorage.setItem("token", token || appToken);
    }
    return response.data;
  };

  verify2FA = async (email: string, code: string) => {
    const response = await this.post("/auth/verify-2fa", { email, code });
    const { appToken, user } = response.data;
    if (appToken) {
      localStorage.setItem("token", appToken);
    }
    if (user) {
      localStorage.setItem("user", JSON.stringify(user));
    }
    return response.data;
  };

  google = async (
    idToken: string,
    userData: {
      email: string | null;
      name: string | null;
      imageUrl: string | null;
    },
  ) => {
    const response = await this.post("/auth/google", {
      idToken,
      email: userData.email,
      name: userData.name,
      imageUrl: userData.imageUrl,
    });
    const { appToken } = response.data;
    if (appToken) {
      localStorage.setItem("appToken", appToken);
    }
    return response.data;
  };

  logoutLocal = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("appToken");
    this.clearAllCache();
  };

  // ===== Users =====
  getUsers = async () => {
    if (ApiService.cache.users) return ApiService.cache.users;
    const response = await this.get("/users");
    ApiService.cache.users = response.data;
    return response.data;
  };

  getUser = async (id: string) => (await this.get(`/users/${id}`)).data;

  getCepInfo = async (zipCode: string): Promise<CepInfo> =>
    (await this.get(`/cep/${zipCode}`)).data;

  createUser = async (payload: Partial<User>) =>
    (await this.post("/users", payload)).data;

  updateUser = async (id: string, payload: Partial<User>) =>
    (await this.put(`/users/${id}`, payload)).data;

  deleteUser = async (id: string) => (await this.delete(`/users/${id}`)).data;

  // ===== Categories =====
  getCategories = async () => {
    if (ApiService.cache.categories) return ApiService.cache.categories;
    const response = await this.get("/categories");
    ApiService.cache.categories = response.data;
    return response.data;
  };

  getCategory = async (id: string) =>
    (await this.get(`/categories/${id}`)).data;

  createCategory = async (payload: Partial<Category>) => {
    return (await this.post("/categories", payload)).data;
  };

  updateCategory = async (id: string, payload: Partial<Category>) => {
    return (await this.put(`/categories/${id}`, payload)).data;
  };

  deleteCategory = async (id: string) => {
    return (await this.delete(`/categories/${id}`)).data;
  };

  // ===== Types =====
  getTypes = async () => {
    if (ApiService.cache.types) return ApiService.cache.types;
    const response = await this.get("/types");
    ApiService.cache.types = response.data;
    return response.data;
  };

  getType = async (id: string) => (await this.get(`/types/${id}`)).data;

  createType = async (payload: Partial<Type>) => {
    return (await this.post("/types", payload)).data;
  };

  updateType = async (id: string, payload: Partial<Type>) => {
    return (await this.put(`/types/${id}`, payload)).data;
  };

  deleteType = async (id: string) => {
    return (await this.delete(`/types/${id}`)).data;
  };

  // ===== Items =====
  getItems = async (params?: {
    page?: number;
    perPage?: number;
    search?: string;
    id?: string;
  }): Promise<ItemsResponse> => {
    const response = await this.client.get("/items", {
      params,
    });
    return response.data;
  };

  getItem = async (id: string) => (await this.get(`/items/${id}`)).data;

  createItem = async (
    payload: Partial<Item>,
    imageFile?: File,
  ): Promise<Item> => {
    if (!imageFile) {
      return (await this.post("/items", payload)).data;
    }

    const formData = new FormData();
    Object.entries(payload).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (typeof value === "object" && !Array.isArray(value)) {
          formData.append(key, JSON.stringify(value));
        } else if (Array.isArray(value)) {
          formData.append(key, JSON.stringify(value));
        } else {
          formData.append(key, String(value));
        }
      }
    });
    formData.append("image", imageFile);

    return (
      await this.client.post("/items", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      })
    ).data;
  };

  updateItem = async (
    id: string,
    payload: Partial<Item>,
    imageFile?: File,
  ): Promise<Item> => {
    if (!imageFile) {
      return (await this.put(`/items/${id}`, payload)).data;
    }

    const formData = new FormData();
    Object.entries(payload).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (typeof value === "object" && !Array.isArray(value)) {
          formData.append(key, JSON.stringify(value));
        } else if (Array.isArray(value)) {
          formData.append(key, JSON.stringify(value));
        } else {
          formData.append(key, String(value));
        }
      }
    });
    formData.append("image", imageFile);

    return (
      await this.client.put(`/items/${id}`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      })
    ).data;
  };

  deleteItem = async (id: string) => {
    return (await this.delete(`/items/${id}`)).data;
  };

  // ===== Additionals =====
  getAdditionals = async () => {
    if (ApiService.cache.items) return ApiService.cache.items;
    const response = await this.get("/additional");
    ApiService.cache.items = response.data;
    return response.data;
  };

  getAdditional = async (id: string) =>
    (await this.get(`/additional/${id}`)).data;

  createAdditional = async (
    payload: Partial<Additional> & {
      colors?: Array<{ color_id: string; stock_quantity: number }>;
    },
    imageFile?: File,
  ): Promise<Additional> => {
    if (!imageFile) {
      return (await this.post("/additional", payload)).data;
    }

    const formData = new FormData();
    Object.entries(payload).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (key === "colors") {
          formData.append(key, JSON.stringify(value));
        } else {
          formData.append(key, String(value));
        }
      }
    });
    formData.append("image", imageFile);

    return (
      await this.client.post("/additional", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      })
    ).data;
  };

  updateAdditional = async (
    id: string,
    payload: Partial<Additional>,
    imageFile?: File,
  ): Promise<Additional> => {
    if (!imageFile) {
      return (await this.put(`/additional/${id}`, payload)).data;
    }

    const formData = new FormData();
    Object.entries(payload).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        formData.append(key, String(value));
      }
    });
    formData.append("image", imageFile);

    return (
      await this.client.put(`/additional/${id}`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      })
    ).data;
  };

  deleteAdditional = async (id: string) => {
    return (await this.delete(`/additional/${id}`)).data;
  };

  // ===== Products =====
  getProducts = async (params?: {
    page?: number;
    perPage?: number;
    search?: string;
    category_id?: string;
    type_id?: string;
  }): Promise<ProductsResponse> => {
    const response = await this.client.get("/products", {
      params,
    });
    return response.data;
  };

  getProduct = async (id: string) => (await this.get(`/products/${id}`)).data;

  createProduct = async (
    payload: Partial<ProductInput>,
    imageFile?: File,
  ): Promise<Product> => {
    if (!imageFile) {
      return (await this.post("/products", payload)).data;
    }

    const formData = new FormData();
    Object.entries(payload).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (Array.isArray(value)) {
          formData.append(key, JSON.stringify(value));
        } else {
          formData.append(key, String(value));
        }
      }
    });
    formData.append("image", imageFile);

    return (
      await this.client.post("/products", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      })
    ).data;
  };

  updateProduct = async (
    id: string,
    payload: Partial<ProductInput>,
    imageFile?: File,
  ): Promise<Product> => {
    if (!imageFile) {
      return (await this.put(`/products/${id}`, payload)).data;
    }

    const formData = new FormData();
    Object.entries(payload).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (Array.isArray(value)) {
          formData.append(key, JSON.stringify(value));
        } else {
          formData.append(key, String(value));
        }
      }
    });
    formData.append("image", imageFile);

    return (
      await this.client.put(`/products/${id}`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      })
    ).data;
  };

  deleteProduct = async (id: string) => {
    return (await this.delete(`/products/${id}`)).data;
  };

  // ===== Customizations =====
  getCustomizations = async (itemId?: string) =>
    (await this.get("/customizations", { params: { itemId } })).data;

  getCustomization = async (id: string) =>
    (await this.get(`/customizations/${id}`)).data;

  createCustomization = async (payload: Record<string, unknown>) => {
    return (await this.post("/customizations", payload)).data;
  };

  updateCustomization = async (
    id: string,
    payload: Record<string, unknown>,
  ) => {
    return (await this.put(`/customizations/${id}`, payload)).data;
  };

  deleteCustomization = async (id: string) => {
    return (await this.delete(`/customizations/${id}`)).data;
  };

  // ===== Constraints =====
  getConstraints = async () => (await this.get("/admin/constraints")).data;

  getConstraint = async (id: string) =>
    (await this.get(`/admin/constraints/${id}`)).data;

  createConstraint = async (payload: Record<string, unknown>) => {
    return (await this.post("/admin/constraints", payload)).data;
  };

  updateConstraint = async (id: string, payload: Record<string, unknown>) => {
    return (await this.put(`/admin/constraints/${id}`, payload)).data;
  };

  deleteConstraint = async (id: string) => {
    return (await this.delete(`/admin/constraints/${id}`)).data;
  };

  // ===== Layouts (Base) =====
  getLayouts = async () => (await this.get("/layouts")).data;

  getLayout = async (id: string) => (await this.get(`/layouts/${id}`)).data;

  // ===== Dynamic Layouts (para customizações) =====
  getDynamicLayouts = async () => {
    try {
      const response = await this.get("/layouts/dynamic");
      return response.data;
    } catch (error) {
      console.error("Erro ao carregar layouts dinâmicos:", error);
      return [];
    }
  };

  createLayout = async (payload: Record<string, unknown>, imageFile?: File) => {
    if (!imageFile) {
      return (await this.post("/admin/layouts", payload)).data;
    }

    const formData = new FormData();
    Object.entries(payload).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        formData.append(key, String(value));
      }
    });
    formData.append("image", imageFile);

    return (
      await this.client.post("/admin/layouts", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      })
    ).data;
  };

  updateLayout = async (
    id: string,
    payload: Record<string, unknown>,
    imageFile?: File,
  ) => {
    this.validateAdminRole();
    if (!imageFile) {
      return (await this.put(`/admin/layouts/${id}`, payload)).data;
    }

    const formData = new FormData();
    Object.entries(payload).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        formData.append(key, String(value));
      }
    });
    formData.append("image", imageFile);

    return (
      await this.client.put(`/admin/layouts/${id}`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      })
    ).data;
  };

  deleteLayout = async (id: string) => {
    this.validateAdminRole();
    return (await this.delete(`/admin/layouts/${id}`)).data;
  };

  // ===== Temporary Uploads (Com TTL) =====
  uploadTempFile = async (file: File, ttlHours?: number) => {
    const formData = new FormData();
    formData.append("file", file);
    if (ttlHours) {
      formData.append("ttlHours", String(ttlHours));
    }

    return (
      await this.client.post("/uploads/temp", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      })
    ).data;
  };

  makePermanentUpload = async (uploadId: string, orderId: string) => {
    return await this.post("/uploads/temp/" + uploadId + "/make-permanent", {
      orderId,
    });
  };

  getUploadStats = async () => {
    this.validateAdminRole();
    return (await this.get("/uploads/stats")).data;
  };

  runUploadCleanup = async () => {
    this.validateAdminRole();
    return (await this.post("/uploads/cleanup", {})).data;
  };

  // ===== Orders =====
  getOrders = async (params?: {
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<OrdersResponse> => await this.client.get("/orders", { params });

  getOrder = async (id: string) => (await this.get(`/orders/${id}`)).data;

  createOrder = async (payload: {
    user_id: string;
    items: OrderItemInput[];
    delivery_address?: string | null;
    delivery_city?: string;
    delivery_state?: string;
    delivery_date?: Date | null;
    payment_method?: "pix" | "card";
    recipient_phone?: string;
    discount?: number;
    is_draft?: boolean;
    send_anonymously?: boolean;
    complement?: string;
    delivery_method?: "delivery" | "pickup";
  }) => (await this.post("/orders", payload)).data;

  deleteOrder = async (id: string) => (await this.delete(`/orders/${id}`)).data;

  updateOrderItems = async (id: string, items: OrderItemInput[]) =>
    (await this.put(`/orders/${id}/items`, { items })).data;

  // ===== Feed Management =====
  getFeedConfigurations = async () =>
    (await this.get("/admin/feed/configurations")).data;
  getFeedConfiguration = async (id: string) =>
    (await this.get(`/admin/feed/configurations/${id}`)).data;
  createFeedConfiguration = async (data: any) =>
    (await this.post("/admin/feed/configurations", data)).data;
  updateFeedConfiguration = async (id: string, data: any) =>
    (await this.put(`/admin/feed/configurations/${id}`, data)).data;
  deleteFeedConfiguration = async (id: string) =>
    (await this.delete(`/admin/feed/configurations/${id}`)).data;

  createFeedBanner = async (data: any, imageFile?: File) => {
    if (!imageFile) return (await this.post("/admin/feed/banners", data)).data;
    const formData = new FormData();
    Object.entries(data).forEach(([key, value]) =>
      formData.append(key, String(value)),
    );
    formData.append("image", imageFile);
    return (
      await this.client.post("/admin/feed/banners", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      })
    ).data;
  };

  updateFeedBanner = async (id: string, data: any, imageFile?: File) => {
    if (!imageFile)
      return (await this.put(`/admin/feed/banners/${id}`, data)).data;
    const formData = new FormData();
    Object.entries(data).forEach(([key, value]) =>
      formData.append(key, String(value)),
    );
    formData.append("image", imageFile);
    return (
      await this.client.put(`/admin/feed/banners/${id}`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      })
    ).data;
  };

  deleteFeedBanner = async (id: string) =>
    (await this.delete(`/admin/feed/banners/${id}`)).data;

  createFeedSection = async (data: any) =>
    (await this.post("/admin/feed/sections", data)).data;
  updateFeedSection = async (id: string, data: any) =>
    (await this.put(`/admin/feed/sections/${id}`, data)).data;
  deleteFeedSection = async (id: string) =>
    (await this.delete(`/admin/feed/sections/${id}`)).data;

  createFeedSectionItem = async (data: any) =>
    (await this.post("/admin/feed/section-items", data)).data;
  updateFeedSectionItem = async (id: string, data: any) =>
    (await this.put(`/admin/feed/section-items/${id}`, data)).data;
  deleteFeedSectionItem = async (id: string) =>
    (await this.delete(`/admin/feed/section-items/${id}`)).data;
  getSectionTypes = async () => (await this.get("/feed/section-types")).data;

  updateOrderMetadata = async (
    id: string,
    metadata: {
      send_anonymously?: boolean;
      complement?: string;
      delivery_address?: string | null;
      delivery_city?: string | null;
      delivery_state?: string | null;
      recipient_phone?: string | null;
      delivery_date?: string | Date | null;
      shipping_price?: number;
      delivery_method?: "delivery" | "pickup";
    },
  ) => (await this.put(`/orders/${id}/metadata`, metadata)).data;

  updateOrderStatus = async (
    id: string,
    status: OrderStatus,
    options?: { notifyCustomer?: boolean },
  ) =>
    (
      await this.client.put(
        `/orders/${id}/status`,
        { status },
        {
          params: options,
        },
      )
    ).data;

  deleteAllCanceledOrders = async () =>
    (await this.delete("/orders/canceled/all")).data;

  // ===== Image Upload =====
  uploadImage = async (file: File): Promise<{ url: string }> => {
    const formData = new FormData();
    formData.append("file", file);

    return (
      await this.client.post("/uploads", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      })
    ).data;
  };

  // ===== Dashboard / Analytics =====
  getBusinessStatus = async (days: number = 30) => {
    return (await this.get("/admin/status", { params: { days } })).data;
  };

  getAiSummary = async (forceRefresh: boolean = false) => {
    return (
      await this.get("/admin/ai/summary", {
        params: { force_refresh: forceRefresh },
      })
    ).data;
  };

  // ===== AIAgent Sessions =====
  getSessions = async () => (await this.get("/admin/ai/agent/sessions")).data;

  blockSession = async (sessionId: string) =>
    (await this.post(`/admin/ai/agent/sessions/${sessionId}/block`, {})).data;

  unblockSession = async (sessionId: string) =>
    (await this.post(`/admin/ai/agent/sessions/${sessionId}/unblock`, {})).data;

  clearSessionHistory = async (sessionId: string) =>
    (await this.delete(`/admin/ai/agent/sessions/${sessionId}/history`)).data;

  getSessionHistory = async (sessionId: string) =>
    (
      await this.client.get(`/ai/agent/history/${sessionId}`, {
        headers: {
          "x-ai-api-key": import.meta.env.VITE_AI_API_KEY || "",
        },
      })
    ).data;

  // ===== Holidays =====
  getHolidays = async () => (await this.get("/admin/holidays")).data;

  createHoliday = async (payload: Record<string, unknown>) =>
    (await this.post("/admin/holidays", payload)).data;

  updateHoliday = async (id: string, payload: Record<string, unknown>) =>
    (await this.put(`/admin/holidays/${id}`, payload)).data;

  deleteHoliday = async (id: string) =>
    (await this.delete(`/admin/holidays/${id}`)).data;

  // ===== FollowUp =====
  getFollowUpHistory = async () =>
    (await this.get("/admin/followup/history")).data;

  toggleFollowUp = async (phone: string, status: boolean) =>
    (await this.post("/admin/followup/toggle", { phone, status })).data;

  triggerFollowUp = async () =>
    (await this.post("/admin/followup/trigger", {})).data;
}

export function useApi(): ApiService & {
  invalidateCache: () => void;
  clearSpecificCache: (key: string) => void;
} {
  const [refreshToken, setRefreshToken] = useState(0);
  const invalidateCache = useCallback(() => setRefreshToken((v) => v + 1), []);

  const api = useMemo(() => new ApiService(), []);

  useEffect(() => {
    if (refreshToken > 0) api.clearAllCache();
  }, [refreshToken, api]);

  const clearSpecificCache = useCallback(
    (key: string) => api.clearCache(key),
    [api],
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const value: any = useMemo(
    () => ({
      ...api,
      invalidateCache,
      clearSpecificCache,
    }),
    [api, invalidateCache, clearSpecificCache],
  );

  return value;
}

export default useApi;
