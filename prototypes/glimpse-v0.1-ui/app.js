// PROTOTYPE: Three variants of the Glimpse V0.1 SQL editor-first surface,
// switchable via ?variant=, on a throwaway static route.

const variants = [
  { key: "A", name: "Workbench" },
  { key: "B", name: "Command Deck" },
  { key: "C", name: "Session Timeline" },
];

const mock = {
  connection: {
    name: "prod-readonly-tidb",
    dialect: "MySQL / TiDB",
    schema: "audit_workflow",
    status: "Connected",
  },
  sessions: [
    {
      id: "qs-142",
      title: "Passage pickup funnel",
      time: "09:42",
      status: "Result ready",
    },
    {
      id: "qs-141",
      title: "Reviewer backlog by queue",
      time: "Yesterday",
      status: "Draft",
    },
    {
      id: "qs-140",
      title: "Rejected task retry volume",
      time: "Tue",
      status: "Error repaired",
    },
  ],
  catalog: [
    {
      table: "task_detail",
      comment: "Task lifecycle detail",
      columns: 18,
      indexes: 4,
      fields: [
        ["id", "bigint", "Primary key"],
        ["passage_id", "varchar(64)", "Passage identifier"],
        ["status", "tinyint", "Task status enum"],
        ["create_time", "datetime", "Creation time"],
        ["submit_time", "datetime", "Submission time"],
      ],
    },
    {
      table: "task_claim",
      comment: "Claim attempts",
      columns: 12,
      indexes: 3,
      fields: [
        ["id", "bigint", "Primary key"],
        ["task_id", "bigint", "Task id"],
        ["operator_id", "varchar(64)", "Operator id"],
      ],
    },
    {
      table: "review_event",
      comment: "Review state changes",
      columns: 15,
      indexes: 5,
      fields: [
        ["id", "bigint", "Primary key"],
        ["task_id", "bigint", "Task id"],
        ["event_type", "varchar(32)", "Event type"],
      ],
    },
  ],
  candidates: ["task_detail", "task_claim", "review_event"],
  prompt:
    "Show pickup, claimed, and submitted counts by passage_id in the last hour, ordered by total volume.",
  sql: `SELECT
  td.passage_id,
  SUM(CASE WHEN td.status = 1 THEN 1 ELSE 0 END) AS pending_pickup_count,
  SUM(CASE WHEN td.status = 2 THEN 1 ELSE 0 END) AS claimed_count,
  SUM(CASE WHEN td.status = 3 THEN 1 ELSE 0 END) AS submitted_count,
  COUNT(*) AS total_count
FROM task_detail td
WHERE td.create_time >= NOW() - INTERVAL 1 HOUR
GROUP BY td.passage_id
ORDER BY total_count DESC
LIMIT 100;`,
  result: [
    ["px_01831", 42, 31, 18, 91],
    ["px_01792", 35, 22, 19, 76],
    ["px_01877", 29, 18, 14, 61],
    ["px_01602", 21, 19, 7, 47],
  ],
  messages: [
    ["user", "Show pickup, claimed, and submitted counts by passage_id in the last hour."],
    ["ai", "Candidate tables found: task_detail, task_claim, review_event."],
    ["ai", "SQL generated in Read-only Mode. Execution requires manual action."],
  ],
};

const state = {
  variant: getVariant(),
  activeSession: "qs-142",
  selectedTable: "task_detail",
  candidates: [...mock.candidates],
  sql: mock.sql,
  status: "Generated",
  warning: "Missing LIMIT warnings are advisory only. This query already includes LIMIT 100.",
  execution: {
    state: "success",
    rows: mock.result.length,
    duration: "184 ms",
    persistedRows: false,
  },
};

function getVariant() {
  const value = new URLSearchParams(window.location.search).get("variant") || "A";
  return variants.some((v) => v.key === value) ? value : "A";
}

function setVariant(next) {
  const url = new URL(window.location);
  url.searchParams.set("variant", next);
  window.history.replaceState({}, "", url);
  state.variant = next;
  render();
}

function cycleVariant(direction) {
  const index = variants.findIndex((v) => v.key === state.variant);
  const next = variants[(index + direction + variants.length) % variants.length].key;
  setVariant(next);
}

function generateSql() {
  state.status = "Streaming generation";
  state.sql = "-- Streaming SQL from mock OpenAI-compatible provider...";
  render();
  setTimeout(() => {
    state.status = "Generated";
    state.sql = mock.sql;
    state.execution = { state: "not run", rows: 0, duration: "0 ms", persistedRows: false };
    render();
  }, 550);
}

function iterateSql() {
  state.status = "Iterated";
  state.sql = `${mock.sql.replace("LIMIT 100;", "LIMIT 50;")}
-- Iteration: limit changed to 50 for a tighter inspection window.`;
  render();
}

function executeSql() {
  state.status = "Executed";
  state.execution = {
    state: "success",
    rows: mock.result.length,
    duration: "184 ms",
    persistedRows: false,
  };
  render();
}

function repairSql() {
  state.status = "Repair suggested";
  state.sql = state.sql.replace("td.status = 3", "td.status IN (3, 4)");
  render();
}

function toggleCandidate(table) {
  if (state.candidates.includes(table)) {
    state.candidates = state.candidates.filter((item) => item !== table);
  } else {
    state.candidates = [...state.candidates, table];
  }
  render();
}

function h(tag, attrs = {}, children = []) {
  const el = document.createElement(tag);
  Object.entries(attrs).forEach(([key, value]) => {
    if (key === "class") el.className = value;
    else if (key === "text") el.textContent = value;
    else if (key === "value") el.value = value;
    else if (key.startsWith("on")) el.addEventListener(key.slice(2).toLowerCase(), value);
    else el.setAttribute(key, value);
  });
  children.forEach((child) => {
    if (typeof child === "string") el.appendChild(document.createTextNode(child));
    else if (child) el.appendChild(child);
  });
  return el;
}

function panel(title, body, right = "") {
  return h("section", { class: "panel" }, [
    h("div", { class: "panel-header" }, [
      h("div", { class: "panel-title", text: title }),
      typeof right === "string" ? h("div", { class: "small muted", text: right }) : right,
    ]),
    h("div", { class: "section" }, body),
  ]);
}

function topbar() {
  return h("header", { class: "topbar" }, [
    h("div", { class: "brand" }, [
      h("div", { class: "mark", text: "G" }),
      h("div", { text: "Glimpse" }),
      h("span", { class: "pill blue", text: "V0.1 prototype" }),
    ]),
    h("div", { class: "top-meta" }, [
      h("span", { class: "pill ok", text: mock.connection.status }),
      h("span", { class: "pill", text: mock.connection.name }),
      h("span", { class: "pill", text: mock.connection.schema }),
    ]),
  ]);
}

function sessionList() {
  return panel(
    "Query Sessions",
    [
      h(
        "div",
        { class: "stack" },
        mock.sessions.map((session) =>
          h(
            "div",
            {
              class: `session-item ${session.id === state.activeSession ? "active" : ""}`,
              onclick: () => {
                state.activeSession = session.id;
                render();
              },
            },
            [
              h("div", { class: "row" }, [
                h("strong", { text: session.title }),
                h("span", { class: "pill", text: session.status }),
              ]),
              h("div", { class: "small muted", text: `${session.id} · ${session.time}` }),
            ],
          ),
        ),
      ),
    ],
    "local",
  );
}

function catalogTree() {
  return panel(
    "Catalog",
    [
      h(
        "div",
        { class: "stack" },
        mock.catalog.map((table) =>
          h(
            "div",
            {
              class: `tree-item ${table.table === state.selectedTable ? "active" : ""}`,
              onclick: () => {
                state.selectedTable = table.table;
                render();
              },
            },
            [
              h("div", { class: "row" }, [
                h("strong", { class: "mono", text: table.table }),
                h("span", { class: "pill", text: `${table.columns} cols` }),
              ]),
              h("div", { class: "small muted", text: table.comment }),
            ],
          ),
        ),
      ),
    ],
    "cached",
  );
}

function candidateSet() {
  return panel(
    "Candidate Table Set",
    [
      h(
        "div",
        { class: "stack" },
        mock.catalog.map((table) =>
          h("div", { class: "candidate" }, [
            h("div", {}, [
              h("strong", { class: "mono", text: table.table }),
              h("div", { class: "small muted", text: table.comment }),
            ]),
            h("button", {
              class: state.candidates.includes(table.table) ? "primary" : "",
              text: state.candidates.includes(table.table) ? "Selected" : "Add",
              onclick: () => toggleCandidate(table.table),
            }),
          ]),
        ),
      ),
    ],
    `${state.candidates.length} selected`,
  );
}

function tableInspector() {
  const table = mock.catalog.find((item) => item.table === state.selectedTable) || mock.catalog[0];
  return panel(
    `Table: ${table.table}`,
    [
      h("div", { class: "stack" }, [
        h("div", { class: "small muted", text: table.comment }),
        ...table.fields.map(([name, type, comment]) =>
          h("div", { class: "field-row" }, [
            h("div", {}, [
              h("div", { class: "mono", text: name }),
              h("div", { class: "small muted", text: comment }),
            ]),
            h("span", { class: "pill", text: type }),
          ]),
        ),
      ]),
    ],
    `${table.indexes} indexes`,
  );
}

function aiPanel(compact = false) {
  return panel("AI Assistant", [
    h("div", { class: "stack" }, [
      h("textarea", {
        class: "command-input",
        rows: compact ? "3" : "4",
        value: mock.prompt,
      }),
      h("div", { class: "toolbar" }, [
        h("button", { class: "primary", text: "Generate", onclick: generateSql }),
        h("button", { text: "Iterate", onclick: iterateSql }),
        h("button", { text: "Repair", onclick: repairSql }),
      ]),
      h(
        "div",
        { class: "stack" },
        mock.messages.map(([role, text]) =>
          h("div", { class: `message ${role}` }, [
            h("div", { class: "small muted", text: role === "ai" ? "AI" : "User" }),
            h("div", { text }),
          ]),
        ),
      ),
    ]),
  ]);
}

function sqlEditor() {
  return h("div", { class: "sql-editor" }, [
    h("div", { class: "editor-head" }, [
      h("div", { text: "SQL Draft · Read-only Mode" }),
      h("div", { class: "toolbar" }, [
        h("span", { class: "pill warn", text: "manual execution" }),
        h("button", { text: "Format" }),
        h("button", { class: "primary", text: "Run", onclick: executeSql }),
      ]),
    ]),
    h("pre", { class: "code mono", text: state.sql }),
  ]);
}

function resultTable() {
  const headers = ["#", "passage_id", "pending_pickup", "claimed", "submitted", "total"];
  return panel(
    "Result",
    [
      h("div", { class: "stack" }, [
        h("div", { class: "row" }, [
          h("span", { class: "pill ok", text: state.execution.state }),
          h("span", { class: "pill", text: `${state.execution.rows} rows` }),
          h("span", { class: "pill", text: state.execution.duration }),
          h("span", { class: "pill", text: "rows not persisted" }),
        ]),
        h("div", { class: "result-scroll" }, [
          h("table", { class: "result-table" }, [
            h("thead", {}, [h("tr", {}, headers.map((head) => h("th", { text: head })))]),
            h(
              "tbody",
              {},
              mock.result.map((row, index) =>
                h("tr", {}, [h("td", { text: String(index + 1) }), ...row.map((cell) => h("td", { text: String(cell) }))]),
              ),
            ),
          ]),
        ]),
      ]),
    ],
    "copy visible",
  );
}

function statePanel() {
  const exposed = {
    variant: state.variant,
    activeSession: state.activeSession,
    selectedTable: state.selectedTable,
    candidates: state.candidates,
    status: state.status,
    execution: state.execution,
    modelContextExcludes: ["password", "api_key", "ssh_key", "sample_data", "result_rows"],
  };
  return panel("Prototype State", [h("pre", { class: "proto-state mono", text: JSON.stringify(exposed, null, 2) })]);
}

function VariantA() {
  return h("main", { class: "variant-a" }, [
    h("div", { class: "left" }, [sessionList(), catalogTree()]),
    h("div", { class: "center" }, [
      h("div", { class: "center-main" }, [sqlEditor(), resultTable()]),
    ]),
    h("div", { class: "right" }, [aiPanel(), candidateSet(), tableInspector(), statePanel()]),
  ]);
}

function VariantB() {
  return h("main", { class: "variant-b" }, [
    h("section", { class: "command-band" }, [
      panel("Ask", [
        h("textarea", { class: "command-input", rows: "2", value: mock.prompt }),
        h("div", { class: "toolbar", style: "margin-top:10px" }, [
          h("button", { class: "primary", text: "Generate SQL", onclick: generateSql }),
          h("button", { text: "Discover tables", onclick: () => render() }),
          h("button", { text: "Repair last error", onclick: repairSql }),
        ]),
      ]),
      panel("Connection", [
        h("div", { class: "stack" }, [
          h("div", { class: "row" }, [h("span", { class: "pill ok", text: "Connected" }), h("span", { class: "pill", text: mock.connection.dialect })]),
          h("div", { class: "mono", text: mock.connection.name }),
          h("div", { class: "small muted", text: `Default schema: ${mock.connection.schema}` }),
        ]),
      ]),
      panel("Session", [
        h("div", { class: "stack" }, [
          h("strong", { text: "Passage pickup funnel" }),
          h("div", { class: "small muted", text: "Draft, AI messages, and execution metadata persist locally." }),
          h("div", { class: "row" }, [
            h("span", { class: "pill", text: "4 executions" }),
            h("span", { class: "pill", text: "0 saved rows" }),
          ]),
        ]),
      ]),
    ]),
    h("section", { class: "workspace" }, [
      h("div", { class: "main-split" }, [sqlEditor(), resultTable()]),
      h("div", { class: "stack" }, [candidateSet(), tableInspector(), statePanel()]),
    ]),
  ]);
}

function VariantC() {
  return h("main", { class: "variant-c" }, [
    h("div", { class: "stack" }, [
      sessionList(),
      panel("Lifecycle", [
        h("div", { class: "timeline stack" }, [
          h("div", { class: "timeline-step" }, [h("strong", { text: "Intent captured" }), h("div", { class: "small muted", text: mock.prompt })]),
          h("div", { class: "timeline-step" }, [h("strong", { text: "Tables discovered" }), h("div", { class: "small muted", text: state.candidates.join(", ") })]),
          h("div", { class: "timeline-step" }, [h("strong", { text: "SQL generated" }), h("div", { class: "small muted", text: "Manual execution required" })]),
          h("div", { class: "timeline-step" }, [h("strong", { text: "Read-only execution" }), h("div", { class: "small muted", text: `${state.execution.rows} rows · ${state.execution.duration}` })]),
        ]),
      ]),
    ]),
    h("div", { class: "stack" }, [
      h("div", { class: "kpi-row" }, [
        h("div", { class: "kpi" }, [h("strong", { text: String(state.candidates.length) }), h("span", { class: "small muted", text: "candidate tables" })]),
        h("div", { class: "kpi" }, [h("strong", { text: state.execution.duration }), h("span", { class: "small muted", text: "last run" })]),
        h("div", { class: "kpi" }, [h("strong", { text: "0" }), h("span", { class: "small muted", text: "persisted rows" })]),
      ]),
      sqlEditor(),
      resultTable(),
    ]),
    h("div", { class: "stack" }, [aiPanel(true), candidateSet(), statePanel()]),
  ]);
}

function switcher() {
  const current = variants.find((v) => v.key === state.variant);
  return h("div", { class: "switcher" }, [
    h("button", { class: "icon", text: "←", title: "Previous variant", onclick: () => cycleVariant(-1) }),
    h("div", { class: "switcher-label", text: `${current.key} - ${current.name}` }),
    h("button", { class: "icon", text: "→", title: "Next variant", onclick: () => cycleVariant(1) }),
  ]);
}

function render() {
  const app = document.getElementById("app");
  app.innerHTML = "";
  const content =
    state.variant === "A" ? VariantA() : state.variant === "B" ? VariantB() : VariantC();
  app.appendChild(h("div", { class: "prototype-shell" }, [topbar(), content, switcher()]));
}

document.addEventListener("keydown", (event) => {
  const target = event.target;
  const editing =
    target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
  if (editing) return;
  if (event.key === "ArrowLeft") cycleVariant(-1);
  if (event.key === "ArrowRight") cycleVariant(1);
});

window.addEventListener("popstate", () => {
  state.variant = getVariant();
  render();
});

render();
