const LEGACY_PIN_STORAGE_KEY = "reservas_pin";

export function purgeLegacyRestaurantPinStorage(browserWindow = globalThis.window) {
  for (const storageName of ["sessionStorage", "localStorage"]) {
    try {
      browserWindow?.[storageName]?.removeItem(LEGACY_PIN_STORAGE_KEY);
    } catch {
      // Un navegador que bloquee storage no debe impedir el arranque ni el cierre.
    }
  }
}
