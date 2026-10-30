/**
 * OA API client (task_11)
 * POST /report/getWorkGroup
 * POST /report/getReport (paginated)
 */

export function normalizeCookie(cookie) {
  const c = (cookie || "").trim();
  if (!c) return "";
  if (c.toLowerCase().startsWith("jsessionid=") || c.includes("=")) return c;
  return `JSESSIONID=${c}`;
}

function requireCfg(cfg) {
  const base = String(cfg?.base || "").replace(/\/$/, "");
  const cookie = normalizeCookie(cfg?.cookie);
  if (!base) throw new Error("请填写 OA Base URL");
  if (!cookie) throw new Error("请填写 JSESSIONID / Cookie");
  return { base, cookie };
}

function resolveWorkgroupId(workgroup) {
  const raw = String(workgroup || "").trim();
  if (!raw) return "";
  if (raw.includes(" - ")) return raw.split(" - ", 1)[0].trim();
  return raw;
}

function formBody(obj) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(obj)) {
    p.set(k, v == null ? "" : String(v));
  }
  return p;
}

async function postForm(base, cookie, path, fields) {
  const url = `${base}${path}`;
  let resp;
  try {
    resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        "X-Requested-With": "XMLHttpRequest",
        Origin: base,
        Referer: `${base}/persons/getWokrReportList.jsp`,
        Cookie: cookie,
      },
      body: formBody(fields),
      redirect: "manual",
      credentials: "omit",
    });
  } catch (e) {
    const msg = String(e && e.message ? e.message : e);
    if (/Failed to fetch|NetworkError|Load failed/i.test(msg)) {
      throw new Error(
        "网络失败（可能是 CORS、混合内容 HTTPS→HTTP，或浏览器禁止自定义 Cookie 头）。" +
          "请用 http://127.0.0.1 打开本页，并确认 Cookie 有效；若仍失败需本地代理。"
      );
    }
    throw e;
  }

  const ctype = (resp.headers.get("content-type") || "").toLowerCase();
  const text = await resp.text();

  if (resp.status !== 200) {
    throw new Error(`HTTP ${resp.status}: ${text.slice(0, 200)}`);
  }
  if (
    ctype.includes("text/html") &&
    (/login/i.test(text) || /tologin/i.test(text))
  ) {
    throw new Error("会话失效或 Cookie 无效（返回登录页），请更新 JSESSIONID");
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`非 JSON 响应 (${ctype}): ${text.slice(0, 200)}`);
  }
}

export async function getWorkGroups(cfg) {
  const { base, cookie } = requireCfg(cfg);
  const usernum = String(cfg.usernum || "").trim();
  if (!usernum) throw new Error("请填写工号 usernum");

  const data = await postForm(base, cookie, "/report/getWorkGroup", {
    usernum,
  });
  if (!Array.isArray(data)) {
    throw new Error("getWorkGroup 返回格式异常");
  }
  return data;
}

function summarizeRows(rows) {
  return (rows || []).map((b) => ({
    type: b?.[0],
    date_title: b?.[1],
    report_id: b?.[2],
    emp_no: b?.[3],
    name: b?.[4],
    submit_time: b?.[6],
    status: b?.[7],
  }));
}

async function getReportPage(base, cookie, params) {
  const data = await postForm(base, cookie, "/report/getReport", {
    pagenow: String(params.pagenow),
    reporttype: params.reporttype || "1",
    workgroup: params.workgroup,
    reportren: params.reportren || "",
    content: params.content || "",
    startdate: params.startdate || "",
    enddate: params.enddate || "",
  });
  if (!data || typeof data !== "object" || !("list" in data)) {
    throw new Error("getReport 返回格式异常");
  }
  return data;
}

/**
 * @returns {{ meta: object, rows: any[][], summary: object[] }}
 */
export async function fetchAllReports(cfg) {
  const { base, cookie } = requireCfg(cfg);
  const workgroup = resolveWorkgroupId(cfg.workgroup);
  if (!workgroup) throw new Error("请选择或填写小组 workgroup");

  const reporttype = String(cfg.reporttype || "1");
  const startdate = String(cfg.startdate || "");
  const enddate = String(cfg.enddate || "");

  const rows = [];
  let meta = await getReportPage(base, cookie, {
    pagenow: 1,
    reporttype,
    workgroup,
    startdate,
    enddate,
  });
  rows.push(...(meta.list || []));

  const countpage = Number(meta.countpage || 1);
  for (let p = 2; p <= countpage; p++) {
    meta = await getReportPage(base, cookie, {
      pagenow: p,
      reporttype,
      workgroup,
      startdate,
      enddate,
    });
    rows.push(...(meta.list || []));
  }

  return {
    meta,
    rows,
    summary: summarizeRows(rows),
  };
}
