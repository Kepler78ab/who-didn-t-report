/**
 * Parse roster from JSON or CSV text.
 * JSON: { members: [{ emp_no, name }] } or [{ emp_no, name }]
 * CSV: header 工号,姓名 or emp_no,name
 */
export function parseRosterText(text) {
  const raw = (text || "").trim();
  if (!raw) return [];

  if (raw.startsWith("{") || raw.startsWith("[")) {
    const data = JSON.parse(raw);
    const list = Array.isArray(data) ? data : data.members;
    if (!Array.isArray(list)) return [];
    return list
      .map((m) => ({
        emp_no: String(m.emp_no || m["工号"] || "").trim(),
        name: String(m.name || m["姓名"] || "").trim(),
      }))
      .filter((m) => m.emp_no);
  }

  const lines = raw.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return [];
  const header = lines[0].split(",").map((s) => s.trim());
  let empIdx = header.findIndex((h) =>
    ["工号", "emp_no", "usernum", "fnumber"].includes(h)
  );
  let nameIdx = header.findIndex((h) =>
    ["姓名", "name", "user_name"].includes(h)
  );
  const start = empIdx >= 0 ? 1 : 0;
  if (empIdx < 0) {
    empIdx = 0;
    nameIdx = 1;
  }
  const out = [];
  for (let i = start; i < lines.length; i++) {
    const cols = lines[i].split(",").map((s) => s.trim());
    const emp_no = cols[empIdx] || "";
    if (!emp_no) continue;
    out.push({ emp_no, name: nameIdx >= 0 ? cols[nameIdx] || "" : "" });
  }
  return out;
}

/** @returns {null | { compared, unreported, reported_count, member_count }} */
export function diffUnreported(members, reportedRows) {
  if (!members || !members.length) return null;
  const reported = new Set(
    (reportedRows || [])
      .map((r) => String(r.emp_no || "").trim())
      .filter(Boolean)
  );
  const unreported = members.filter((m) => !reported.has(m.emp_no));
  return {
    compared: true,
    member_count: members.length,
    reported_count: members.filter((m) => reported.has(m.emp_no)).length,
    unreported_count: unreported.length,
    unreported,
  };
}
