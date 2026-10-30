import { html } from "htm/preact";
import { useMemo, useState } from "preact/hooks";
import { fetchAllReports, getWorkGroups } from "./api.js";
import { diffUnreported, parseRosterText } from "./roster.js";
import {
  clearConfig,
  defaultConfig,
  loadConfig,
  saveConfig,
  todayStr,
} from "./storage.js";

const TYPE_LABEL = { 1: "日报", 2: "周报", 3: "月报" };

function Field({ label, children }) {
  return html`<label class="field"><span>${label}</span>${children}</label>`;
}

export function App() {
  const [cfg, setCfg] = useState(() => loadConfig());
  const [status, setStatus] = useState("就绪：填写 Cookie 后可刷新小组 / 查询");
  const [statusWarn, setStatusWarn] = useState(false);
  const [groups, setGroups] = useState([]);
  const [reported, setReported] = useState([]);
  const [unreported, setUnreported] = useState([]);
  const [busy, setBusy] = useState(false);

  const members = useMemo(() => {
    try {
      return parseRosterText(cfg.rosterText || "");
    } catch {
      return [];
    }
  }, [cfg.rosterText]);

  const typeLabel = TYPE_LABEL[cfg.reporttype] || "汇报";

  function patch(partial) {
    setCfg((c) => ({ ...c, ...partial }));
  }

  function onSave() {
    saveConfig(cfg);
    setStatusWarn(false);
    setStatus("已保存到 sessionStorage（关闭标签页会清除）");
  }

  function onClear() {
    clearConfig();
    const next = defaultConfig();
    setCfg(next);
    setReported([]);
    setUnreported([]);
    setGroups([]);
    setStatusWarn(false);
    setStatus("已清除会话配置");
  }

  function onRosterFile(ev) {
    const file = ev.target.files && ev.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      patch({ rosterText: String(reader.result || "") });
      setStatus(`已读入文件：${file.name}`);
    };
    reader.readAsText(file, "UTF-8");
    ev.target.value = "";
  }

  async function onRefreshGroups() {
    setBusy(true);
    setStatusWarn(false);
    setStatus("刷新小组…");
    try {
      const data = await getWorkGroups(cfg);
      setGroups(data);
      setStatus(`小组 ${data.length} 个`);
    } catch (e) {
      setStatusWarn(true);
      setStatus(String(e.message || e));
    } finally {
      setBusy(false);
    }
  }

  async function onQuery() {
    setBusy(true);
    setStatusWarn(false);
    setStatus("查询中…");
    try {
      const { summary } = await fetchAllReports(cfg);
      setReported(summary);
      const diff = diffUnreported(members, summary);
      if (!diff) {
        setUnreported([]);
        setStatus(`已汇报 ${summary.length} 条 · 姓名表为空，未对比未汇报`);
      } else {
        setUnreported(diff.unreported);
        setStatus(
          `已汇报 ${summary.length} · 未汇报 ${diff.unreported_count}（名单 ${diff.member_count}）`
        );
      }
    } catch (e) {
      setStatusWarn(true);
      setStatus(String(e.message || e));
    } finally {
      setBusy(false);
    }
  }

  const httpsPage = typeof location !== "undefined" && location.protocol === "https:";

  return html`
    <div class="app">
      <h1 class="brand">OA 日报查询</h1>
      <p class="sub">
        网页试用 · Preact + htm · 配置仅存本页 sessionStorage · 目录
        <code>html version/</code>
      </p>

      ${httpsPage &&
      html`<div class="banner">
        当前为 HTTPS 页面。若 OA 为 HTTP，浏览器可能拦截请求（混合内容）。请用本地
        <code>npx serve</code> 以 http://127.0.0.1 打开本目录再实调。
      </div>`}

      <div class="grid">
        <section class="card">
          <h2>连接</h2>
          <div class="fields">
            <${Field} label="OA Base URL">
              <input
                type="text"
                value=${cfg.base}
                onInput=${(e) => patch({ base: e.target.value })}
              />
            <//>
            <${Field} label="JSESSIONID / Cookie">
              <input
                type="password"
                value=${cfg.cookie}
                autocomplete="off"
                onInput=${(e) => patch({ cookie: e.target.value })}
              />
            <//>
            <${Field} label="工号 usernum">
              <input
                type="text"
                value=${cfg.usernum}
                onInput=${(e) => patch({ usernum: e.target.value })}
              />
            <//>
            <div class="row">
              <button class="primary" type="button" onClick=${onSave}>保存到会话</button>
              <button type="button" onClick=${onClear}>清除会话</button>
            </div>
          </div>
        </section>

        <section class="card">
          <h2>查询</h2>
          <div class="fields">
            <${Field} label="汇报类型">
              <select
                value=${cfg.reporttype}
                onChange=${(e) => patch({ reporttype: e.target.value })}
              >
                <option value="1">1 · 日报</option>
                <option value="2">2 · 周报</option>
                <option value="3">3 · 月报</option>
              </select>
            <//>
            <${Field} label="小组 workgroup">
              <div class="row">
                <input
                  type="text"
                  list="group-list"
                  value=${cfg.workgroup}
                  onInput=${(e) => patch({ workgroup: e.target.value })}
                  style="flex:1"
                />
                <button type="button" disabled=${busy} onClick=${onRefreshGroups}>
                  刷新小组
                </button>
              </div>
              <datalist id="group-list">
                ${groups.map(
                  (g) =>
                    html`<option value=${g[0]}>${g[0]} - ${g[1]}</option>`
                )}
              </datalist>
            <//>
            <div class="row dates">
              <${Field} label="开始日期">
                <input
                  type="date"
                  value=${cfg.startdate || todayStr()}
                  onInput=${(e) => patch({ startdate: e.target.value })}
                />
              <//>
              <${Field} label="结束日期">
                <input
                  type="date"
                  value=${cfg.enddate || todayStr()}
                  onInput=${(e) => patch({ enddate: e.target.value })}
                />
              <//>
            </div>
            <div class="row">
              <button class="primary" type="button" disabled=${busy} onClick=${onQuery}>
                查询
              </button>
              <button
                type="button"
                onClick=${() => {
                  const t = todayStr();
                  patch({ startdate: t, enddate: t });
                }}
              >
                日期设为今天
              </button>
            </div>
            <p class="hint">已汇报列表：${typeLabel}（不显示类型/状态列）</p>
          </div>
        </section>

        <section class="card">
          <h2>成员名单</h2>
          <p class="hint">
            粘贴 JSON（<code>{"members":[{"emp_no":"","name":""}]}</code>）或 CSV（工号,姓名）。空名单则不做未汇报对比。
            当前解析 ${members.length} 人。
          </p>
          <div class="fields">
            <textarea
              value=${cfg.rosterText}
              onInput=${(e) => patch({ rosterText: e.target.value })}
              placeholder=${'{"version":1,"members":[{"emp_no":"044001","name":"张三"}]}'}
            />
            <div class="row">
              <input type="file" accept=".json,.csv,text/csv,application/json" onChange=${onRosterFile} />
            </div>
          </div>
        </section>

        <section class="card">
          <h2>结果</h2>
          <p class=${statusWarn ? "status warn" : "status"}>${status}</p>
          <div class="results">
            <div class="panel">
              <h3>已汇报（${typeLabel}）· ${reported.length}</h3>
              <div class="table-wrap">
                ${reported.length
                  ? html`<table>
                      <thead>
                        <tr>
                          <th>汇报日期</th>
                          <th>工号</th>
                          <th>姓名</th>
                          <th>提交时间</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${reported.map(
                          (r) => html`<tr>
                            <td>${r.date_title || ""}</td>
                            <td>${r.emp_no || ""}</td>
                            <td>${r.name || ""}</td>
                            <td>${r.submit_time || ""}</td>
                          </tr>`
                        )}
                      </tbody>
                    </table>`
                  : html`<div class="empty">暂无数据，点击「查询」拉取</div>`}
              </div>
            </div>
            <div class="panel">
              <h3>
                未汇报 · ${members.length ? unreported.length : "未对比"}
              </h3>
              <div class="table-wrap">
                ${!members.length
                  ? html`<div class="empty">姓名表为空：不做未汇报对比</div>`
                  : unreported.length
                    ? html`<table>
                        <thead>
                          <tr>
                            <th>工号</th>
                            <th>姓名</th>
                          </tr>
                        </thead>
                        <tbody>
                          ${unreported.map(
                            (u) => html`<tr>
                              <td>${u.emp_no}</td>
                              <td>${u.name || ""}</td>
                            </tr>`
                          )}
                        </tbody>
                      </table>`
                    : html`<div class="empty">暂无未汇报（或尚未查询）</div>`}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  `;
}
