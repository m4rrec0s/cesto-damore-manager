export const formatCurrency = (value?: number | null) => {
    if (typeof value !== "number" || Number.isNaN(value)) return "R$ 0,00";
    return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
    }).format(value);
};

export const formatDate = (value?: string | null) => {
    if (!value) return "Data indisponível";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Data indisponível";
    return date.toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
};

export const shortId = (id: string) => {
    return id ? id.substring(0, 8).toUpperCase() : "--";
};

export const onlyDigits = (value?: string | null) => {
    return value ? value.replace(/\D/g, "") : "";
};

export const extractErrorMessage = (error: unknown, fallback: string) => {
    if (typeof error === "object" && error !== null && "response" in error) {
        const response = (error as any).response;
        const message = response?.data?.error || response?.data?.message;
        if (typeof message === "string" && message.trim().length > 0) {
            return message;
        }
    }

    if (error instanceof Error && error.message) {
        return error.message;
    }

    return fallback;
};
