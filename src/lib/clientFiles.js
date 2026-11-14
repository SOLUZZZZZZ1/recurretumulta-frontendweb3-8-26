export const MAX_FILE_BYTES = 12 * 1024 * 1024;
export const MAX_CASE_FILES = 5;

export function fileSizeError(file) {
  if (!file || file.size === 0) return "El archivo está vacío. Selecciona otro archivo.";
  if (file.size > MAX_FILE_BYTES) return "El archivo supera 12 MB. Selecciona uno más pequeño.";
  return "";
}

export function selectCaseFiles(fileList, currentCount) {
  const available = Math.max(0, MAX_CASE_FILES - currentCount);
  const incoming = Array.from(fileList || []);
  const valid = incoming.filter((file) => !fileSizeError(file));
  const messages = [];
  if (incoming.some((file) => file.size === 0)) messages.push("Se han omitido los archivos vacíos.");
  if (incoming.some((file) => file.size > MAX_FILE_BYTES)) messages.push("Se han omitido los archivos que superan 12 MB.");
  if (valid.length > available) messages.push(`Máximo ${MAX_CASE_FILES} documentos por subida.`);
  return { files: valid.slice(0, available), message: messages.join(" ") };
}
