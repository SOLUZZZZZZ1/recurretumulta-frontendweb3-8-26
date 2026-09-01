export const RTM_OPERATOR_PASSWORD_CHANGE_ROUTE =
  "/api/ops/auth/password/change";

const MIN_PASSWORD_LENGTH = 12;
const MAX_PASSWORD_LENGTH = 256;

export class RtmOperatorOnboardingError extends Error {
  constructor(code, message, status = null) {
    super(message);
    this.name = "RtmOperatorOnboardingError";
    this.code = code;
    this.status = status;
  }
}

function fail(code, message, status = null) {
  throw new RtmOperatorOnboardingError(code, message, status);
}

function validatePassword(value, field) {
  const password = String(value || "");
  const minimum = field === "new_password" ? MIN_PASSWORD_LENGTH : 1;
  if (
    password.length < minimum ||
    password.length > MAX_PASSWORD_LENGTH ||
    password.includes("\0")
  ) {
    fail(
      `operator_onboarding.${field}_invalid`,
      field === "new_password"
        ? "La nueva contraseña debe tener entre 12 y 256 caracteres."
        : "La contraseña temporal no es válida."
    );
  }
  return password;
}

function publicHttpMessage(status) {
  if (status === 401) {
    return "La contraseña temporal no es correcta o la sesión ha caducado.";
  }
  if (status === 409) {
    return "La nueva contraseña debe ser distinta de la temporal.";
  }
  if (status === 422) {
    return "Revisa las contraseñas: la nueva debe tener al menos 12 caracteres.";
  }
  return "No se pudo cambiar la contraseña temporal.";
}

async function readPayload(response) {
  const text = await response?.text?.().catch(() => "");
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return {};
  }
}

export async function changeTemporaryOperatorPassword({
  bearerToken,
  currentPassword,
  newPassword,
  signal = null,
  fetchImpl = globalThis.fetch?.bind(globalThis),
} = {}) {
  const token = String(bearerToken || "");
  if (token.length < 32) {
    fail(
      "operator_onboarding.session_required",
      "La sesión temporal ha caducado. Vuelve a identificarte.",
      401
    );
  }
  if (typeof fetchImpl !== "function") {
    fail(
      "operator_onboarding.fetch_required",
      "No hay transporte seguro disponible."
    );
  }

  const current = validatePassword(currentPassword, "current_password");
  const next = validatePassword(newPassword, "new_password");
  if (current === next) {
    fail(
      "operator_onboarding.password_reuse",
      "La nueva contraseña debe ser distinta de la temporal.",
      409
    );
  }

  let response;
  try {
    response = await fetchImpl(RTM_OPERATOR_PASSWORD_CHANGE_ROUTE, {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        current_password: current,
        new_password: next,
        reason: "Cambio inicial de contraseña temporal",
      }),
      cache: "no-store",
      credentials: "same-origin",
      redirect: "error",
      referrerPolicy: "same-origin",
      signal,
    });
  } catch {
    if (signal?.aborted) {
      fail("operator_onboarding.request_aborted", "Operación cancelada.");
    }
    fail(
      "operator_onboarding.transport_failed",
      "No se pudo conectar con el servicio de credenciales."
    );
  }

  const payload = await readPayload(response);
  if (!response?.ok) {
    fail(
      "operator_onboarding.password_change_rejected",
      publicHttpMessage(response?.status),
      response?.status ?? null
    );
  }
  if (
    payload?.ok !== true ||
    payload?.password_returned !== false ||
    payload?.reauthentication_required !== true ||
    payload?.legacy_login_unchanged !== true ||
    payload?.operator?.must_change_password !== false
  ) {
    fail(
      "operator_onboarding.response_contract_invalid",
      "El servidor no confirmó de forma segura el cambio de contraseña."
    );
  }

  return Object.freeze({ reauthenticationRequired: true });
}
