/**
 * Função para converter URL do Google Drive em URL de visualização direta
 * Suporta múltiplos formatos de URLs do Google Drive
 */
export const normalizeGoogleDriveUrl = (url: string): string => {
  if (!url) return url;

  if (
    !url.includes("drive.google.com") &&
    !url.includes("drive.usercontent.google.com")
  ) {
    return url;
  }

  // Extrair FILE_ID de diferentes formatos
  let fileId: string | null = null;

  // Formato: /file/d/FILE_ID/view
  let match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (match) fileId = match[1];

  // Formato: ?id=FILE_ID ou &id=FILE_ID
  if (!fileId) {
    match = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (match) fileId = match[1];
  }

  // Se encontrou FILE_ID, retornar URL de visualização direta
  if (fileId) {
    return `https://drive.google.com/uc?id=${fileId}&export=view`;
  }

  return url;
};

/**
 * Função para obter URL de download direto do Google Drive
 */
export const getGoogleDriveDownloadUrl = (url: string): string => {
  if (!url) return url;

  if (
    !url.includes("drive.google.com") &&
    !url.includes("drive.usercontent.google.com")
  ) {
    return url;
  }

  let fileId: string | null = null;

  let match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (match) fileId = match[1];

  if (!fileId) {
    match = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (match) fileId = match[1];
  }

  if (fileId) {
    return `https://drive.google.com/uc?id=${fileId}&export=download`;
  }

  return url;
};
