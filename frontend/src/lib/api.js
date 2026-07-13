import axios from "axios";

export const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
export const TOKEN_KEY = "auth_token";

export const api = axios.create({
  baseURL: API,
  withCredentials: true,
});

// Attach token from sessionStorage as fallback when 3rd-party cookies are blocked.
// sessionStorage is cleared when the browser tab is closed, reducing XSS/session-hijack surface
// compared to localStorage. Primary auth remains the httpOnly cookie set by the backend.
api.interceptors.request.use((cfg) => {
  const token = sessionStorage.getItem(TOKEN_KEY);
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

export function formatApiError(detail) {
  if (detail == null) return "Something went wrong. Please try again.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail
      .map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e)))
      .join(" ");
  if (detail && typeof detail.msg === "string") return detail.msg;
  return String(detail);
}
