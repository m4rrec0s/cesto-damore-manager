const API_BASE_URL = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");
const API_KEY =
  import.meta.env.VITE_API_KEY || import.meta.env.VITE_AI_AGENT_API_KEY || "";

let installed = false;

const shouldAttachApiKey = (url: string) => {
  if (!API_KEY) return false;

  if (url.startsWith("/")) {
    return true;
  }

  if (!API_BASE_URL) return false;

  try {
    const resolvedUrl = new URL(url);
    return resolvedUrl.href.startsWith(API_BASE_URL);
  } catch {
    return false;
  }
};

export function installApiKeyFetchInterceptor() {
  if (installed || typeof globalThis.fetch !== "function" || !API_KEY) {
    return;
  }

  const originalFetch = globalThis.fetch.bind(globalThis);

  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(input, init);

    if (!shouldAttachApiKey(request.url)) {
      return originalFetch(request);
    }

    const headers = new Headers(request.headers);
    headers.set("x-api-key", API_KEY);

    return originalFetch(new Request(request, { headers }));
  };

  installed = true;
}
