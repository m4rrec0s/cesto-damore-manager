import axios from "axios";

const API_BASE = import.meta.env.VITE_API_URL as string;

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
});

/**
 * Serviço para integração com API de Layouts Dinâmicos
 */
export const layoutApiService = {
  /**
   * Criar novo layout dinâmico
   */
  async createLayout(data: {
    name: string;
    type: "mug" | "frame" | "custom";
    baseImageUrl: string;
    fabricJsonState: Record<string, unknown>;
    width: number;
    height: number;
    tags?: string[];
    token: string;
  }) {
    try {
      const response = await api.post(
        "/layouts/dynamic",
        {
          name: data.name,
          type: data.type,
          baseImageUrl: data.baseImageUrl,
          fabricJsonState: data.fabricJsonState,
          width: data.width,
          height: data.height,
          tags: data.tags || [],
        },
        {
          headers: {
            Authorization: `Bearer ${data.token}`,
          },
        },
      );

      return response.data;
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { error?: string } } };
      throw new Error(
        axiosError.response?.data?.error || "Erro ao criar layout",
      );
    }
  },

  /**
   * Listar layouts dinâmicos
   */
  async listLayouts(filters?: {
    type?: string;
    isPublished?: boolean;
    search?: string;
    token: string;
  }) {
    try {
      const params = new URLSearchParams();
      if (filters?.type) params.append("type", filters.type);
      if (filters?.isPublished !== undefined)
        params.append("isPublished", String(filters.isPublished));
      if (filters?.search) params.append("search", filters.search);

      const response = await api.get("/layouts/dynamic", {
        params,
        headers: {
          Authorization: `Bearer ${filters?.token}`,
        },
      });

      return response.data;
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { error?: string } } };
      throw new Error(
        axiosError.response?.data?.error || "Erro ao listar layouts",
      );
    }
  },

  /**
   * Obter detalhe de um layout
   */
  async getLayout(layoutId: string, token: string) {
    try {
      const response = await api.get(`/layouts/dynamic/${layoutId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      return response.data;
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { error?: string } } };
      throw new Error(
        axiosError.response?.data?.error || "Layout não encontrado",
      );
    }
  },

  /**
   * Atualizar layout dinâmico
   */
  async updateLayout(
    layoutId: string,
    data: {
      name?: string;
      fabricJsonState?: Record<string, unknown>;
      previewImageUrl?: string;
      tags?: string[];
      isPublished?: boolean;
      width?: number;
      height?: number;
      token: string;
    },
  ) {
    try {
      const response = await api.put(
        `/layouts/dynamic/${layoutId}`,
        {
          name: data.name,
          fabricJsonState: data.fabricJsonState,
          previewImageUrl: data.previewImageUrl,
          tags: data.tags,
          isPublished: data.isPublished,
          width: data.width,
          height: data.height,
        },
        {
          headers: {
            Authorization: `Bearer ${data.token}`,
          },
        },
      );

      return response.data;
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { error?: string } } };
      throw new Error(
        axiosError.response?.data?.error || "Erro ao atualizar layout",
      );
    }
  },

  /**
   * Fazer upload de imagem para o banco de elementos do usuário
   */
  async uploadElementImage(file: File, token: string) {
    try {
      const formData = new FormData();
      formData.append("image", file);

      const response = await api.post("/upload/image", formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      });

      return response.data;
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { error?: string } } };
      throw new Error(
        axiosError.response?.data?.error || "Erro ao fazer upload da imagem",
      );
    }
  },

  /**
   * Deletar layout
   */
  async deleteLayout(layoutId: string, token: string) {
    try {
      const response = await api.delete(`/layouts/dynamic/${layoutId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      return response.data;
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { error?: string } } };
      throw new Error(
        axiosError.response?.data?.error || "Erro ao deletar layout",
      );
    }
  },

  /**
   * Salvar versão do layout
   */
  async saveVersion(
    layoutId: string,
    changeDescription: string,
    token: string,
  ) {
    try {
      const response = await api.post(
        `/layouts/dynamic/${layoutId}/versions`,
        { changeDescription },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      return response.data;
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { error?: string } } };
      throw new Error(
        axiosError.response?.data?.error || "Erro ao salvar versão",
      );
    }
  },

  /**
   * Listar versões do layout
   */
  async getVersions(layoutId: string, token: string, limit = 10) {
    try {
      const response = await api.get(`/layouts/dynamic/${layoutId}/versions`, {
        params: { limit },
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      return response.data;
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { error?: string } } };
      throw new Error(
        axiosError.response?.data?.error || "Erro ao listar versões",
      );
    }
  },

  /**
   * Restaurar versão anterior
   */
  async restoreVersion(layoutId: string, versionNumber: number, token: string) {
    try {
      const response = await api.post(
        `/layouts/dynamic/${layoutId}/versions/${versionNumber}/restore`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      return response.data;
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { error?: string } } };
      throw new Error(
        axiosError.response?.data?.error || "Erro ao restaurar versão",
      );
    }
  },
};

/**
 * Serviço para integração com Element Bank
 */
export const elementBankService = {
  /**
   * Listar elementos do banco
   */
  async listElements(filters?: {
    category?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }) {
    try {
      const params = new URLSearchParams();
      if (filters?.category) params.append("category", filters.category);
      if (filters?.search) params.append("search", filters.search);
      if (filters?.limit) params.append("limit", String(filters.limit));
      if (filters?.offset) params.append("offset", String(filters.offset));

      const response = await api.get("/elements/bank", { params });

      return response.data;
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { error?: string } } };
      throw new Error(
        axiosError.response?.data?.error || "Erro ao listar elementos",
      );
    }
  },

  /**
   * Listar categorias disponíveis
   */
  async listCategories() {
    try {
      const response = await api.get("/elements/bank/categories");
      return response.data;
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { error?: string } } };
      throw new Error(
        axiosError.response?.data?.error || "Erro ao listar categorias",
      );
    }
  },

  /**
   * Obter elemento por ID
   */
  async getElementById(elementId: string) {
    try {
      const response = await api.get(`/elements/bank/${elementId}`);
      return response.data;
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { error?: string } } };
      throw new Error(
        axiosError.response?.data?.error || "Elemento não encontrado",
      );
    }
  },

  /**
   * Upload de novo elemento para o banco (admin only)
   */
  async uploadElement(
    data: {
      category: string;
      name: string;
      tags?: string[];
      width?: number;
      height?: number;
      image: File;
    },
    token: string,
  ) {
    try {
      const formData = new FormData();
      formData.append("category", data.category);
      formData.append("name", data.name);
      if (data.tags) {
        data.tags.forEach((tag) => formData.append("tags", tag));
      }
      if (data.width) formData.append("width", String(data.width));
      if (data.height) formData.append("height", String(data.height));
      formData.append("image", data.image);

      const response = await api.post("/elements/bank", formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      });

      return response.data;
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { error?: string } } };
      throw new Error(
        axiosError.response?.data?.error || "Erro ao fazer upload",
      );
    }
  },

  /**
   * Deletar item do banco de elementos
   */
  async deleteElementBankItem(elementId: string, token: string) {
    try {
      const response = await api.delete(`/elements/bank/${elementId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      return response.data;
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { error?: string } } };
      throw new Error(
        axiosError.response?.data?.error || "Erro ao deletar elemento do banco",
      );
    }
  },
};
