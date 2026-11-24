// Un único lugar para las peticiones y los errores HTTP.
export async function api(path, { method = "GET", body } = {}) {
  let response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      headers:
        body instanceof File
          ? { "Content-Type": body.type }
          : { "Content-Type": "application/json" },
      body:
        body === undefined
          ? undefined
          : body instanceof File
            ? body
            : JSON.stringify(body),
    });
  } catch {
    throw new Error(
      "No se pudo conectar. Comprueba que el backend esté encendido.",
    );
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = Array.isArray(data.detail)
      ? data.detail
          .map((item) => `${item.loc.slice(1).join(".")}: ${item.msg}`)
          .join(" · ")
      : data.detail;
    const error = new Error(message || "No se pudo completar la solicitud.");
    error.status = response.status;
    if (response.status === 401 && !path.startsWith("/auth/")) {
      window.dispatchEvent(new Event("session-expired"));
    }
    throw error;
  }
  return data;
}
