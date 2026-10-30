const KEY = "oa_web_cfg";

export function todayStr() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function defaultConfig() {
  const t = todayStr();
  return {
    base: "http://222.223.217.227:8095",
    cookie: "",
    usernum: "",
    workgroup: "4325460",
    reporttype: "1",
    startdate: t,
    enddate: t,
    rosterText: "",
  };
}

export function loadConfig() {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return defaultConfig();
    const parsed = JSON.parse(raw);
    const base = defaultConfig();
    return { ...base, ...parsed };
  } catch {
    return defaultConfig();
  }
}

export function saveConfig(cfg) {
  sessionStorage.setItem(KEY, JSON.stringify(cfg));
}

export function clearConfig() {
  sessionStorage.removeItem(KEY);
}
