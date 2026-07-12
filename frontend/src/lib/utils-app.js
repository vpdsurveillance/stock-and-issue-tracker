export const DEPARTMENTS = ["MDS", "VPD", "Media"];

export function fmtDate(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export function toISODate(d) {
  if (!d) return "";
  const dt = d instanceof Date ? d : new Date(d);
  return dt.toISOString();
}

export function daysUntil(iso) {
  const now = new Date();
  const then = new Date(iso);
  return Math.round((then - now) / (1000 * 60 * 60 * 24));
}

export async function downloadExcel(apiClient, resource, department) {
  const params = department ? { department } : {};
  const res = await apiClient.get(`/export/${resource}`, {
    params,
    responseType: "blob",
  });
  const url = URL.createObjectURL(res.data);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${resource}${department ? "-" + department : ""}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
