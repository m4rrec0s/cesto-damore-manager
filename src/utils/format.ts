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
    const isGenericServerMessage = (message?: string) => {
        if (!message) return false;
        const normalized = message.toLowerCase();
        return (
            normalized.includes("erro interno do servidor") ||
            normalized.includes("internal server error") ||
            normalized.includes("request failed with status code")
        );
    };

    if (typeof error === "object" && error !== null && "response" in error) {
        const response = (error as any).response;
        const payload = response?.data;

        const detailsMessage =
            payload?.details ||
            payload?.detail ||
            payload?.reason ||
            payload?.cause;

        const errorsList = Array.isArray(payload?.errors)
            ? payload.errors
                .map((item: any) => {
                    if (typeof item === "string") return item;
                    if (item?.message) return String(item.message);
                    if (item?.msg) return String(item.msg);
                    if (item?.error) return String(item.error);
                    return "";
                })
                .filter(Boolean)
                .join(" | ")
            : "";

        const message =
            payload?.error ||
            payload?.message ||
            errorsList ||
            detailsMessage;

        if (typeof message === "string" && message.trim().length > 0) {
            if (isGenericServerMessage(message) && detailsMessage) {
                return String(detailsMessage);
            }
            return message;
        }
    }

    if (error instanceof Error && error.message) {
        return error.message;
    }

    return fallback;
};
