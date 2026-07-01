/** Cliente HTTP de la API. Mismo origen: nginx proxea /api → backend. */
const BASE = "/api";

function getToken() { return localStorage.getItem("token") || ""; }
export function setToken(t) { localStorage.setItem("token", t); }
export function clearToken() { localStorage.removeItem("token"); }
export function hasToken() { return !!getToken(); }

async function req(path, { method = "GET", body, auth = false } = {}) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (auth) headers["Authorization"] = "Bearer " + getToken();
  const res = await fetch(BASE + path, {
    method, headers, body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const ct = res.headers.get("content-type") || "";
  const data = ct.includes("application/json") ? await res.json().catch(() => null) : null;
  if (!res.ok) throw new Error((data && data.error) || `Error ${res.status}`);
  return data;
}

export const api = {
  // --- público ---
  eventosPublicos: () => req("/eventos/publicos"),
  resolverVendedor: (slug) => req("/vendedores/" + encodeURIComponent(slug)),
  crearInscripcion: (body) => req("/inscripciones", { method: "POST", body }),
  marcarAsistencia: (codigo) => req("/asistencia/" + encodeURIComponent(codigo), { method: "POST" }),
  credencialPng: (codigo) => `${BASE}/inscripciones/${encodeURIComponent(codigo)}/credencial.png`,
  credencialPdf: (codigo) => `${BASE}/inscripciones/${encodeURIComponent(codigo)}/credencial.pdf`,

  // --- auth ---
  login: (email, password) => req("/auth/login", { method: "POST", body: { email, password } }),
  me: () => req("/auth/me", { auth: true }),

  // --- panel (staff) ---
  listarInscripciones: () => req("/inscripciones", { auth: true }),
  eliminarInscripcion: (codigo) => req("/inscripciones/" + encodeURIComponent(codigo), { method: "DELETE", auth: true }),
  listarEventos: () => req("/eventos", { auth: true }),
  crearEvento: (b) => req("/eventos", { method: "POST", body: b, auth: true }),
  eliminarEvento: (id) => req("/eventos/" + id, { method: "DELETE", auth: true }),
  listarVendedores: () => req("/vendedores", { auth: true }),
  crearVendedor: (b) => req("/vendedores", { method: "POST", body: b, auth: true }),
  eliminarVendedor: (id) => req("/vendedores/" + id, { method: "DELETE", auth: true }),
  listarUsuarios: () => req("/usuarios", { auth: true }),
  crearUsuario: (b) => req("/usuarios", { method: "POST", body: b, auth: true }),
};
