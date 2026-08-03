// src/api.js
export function getApiBase() {
  // Siempre mismo origen + proxy de Vercel -> sin CORS
  return "/api";
}
