function pad2(n) {
  return String(n).padStart(2, "0");
}

/** Parse ISO date or datetime into local calendar parts (date-only strings avoid TZ shift). */
export function parseIsoDateParts(value) {
  if (value == null || value === "") {
    return null;
  }
  const s = String(value).trim();
  if (!s) {
    return null;
  }
  const datePart = s.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
    const [year, month, day] = datePart.split("-").map(Number);
    return { day, month, year };
  }
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) {
    return null;
  }
  return { day: d.getDate(), month: d.getMonth() + 1, year: d.getFullYear() };
}

/** Display date as dd-mm-yyyy. */
export function formatDate(value) {
  const parts = parseIsoDateParts(value);
  if (!parts) {
    return "-";
  }
  return `${pad2(parts.day)}-${pad2(parts.month)}-${parts.year}`;
}

/** Display datetime as dd-mm-yyyy HH:mm:ss. Date-only values use 00:00:00. */
export function formatDateTime(value) {
  if (value == null || value === "") {
    return "-";
  }
  const s = String(value).trim();
  if (!s) {
    return "-";
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [year, month, day] = s.split("-");
    return `${day}-${month}-${year} 00:00:00`;
  }
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) {
    return "-";
  }
  return `${pad2(d.getDate())}-${pad2(d.getMonth() + 1)}-${d.getFullYear()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}
