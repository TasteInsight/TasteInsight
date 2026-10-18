const { io } = require("/app/node_modules/socket.io-client");
const assert = require("node:assert/strict");
const s = io("http://127.0.0.1:3001", {
  transports: ["websocket"],
  reconnection: false,
});
const call = (name, ...args) =>
  new Promise((res, rej) =>
    s
      .timeout(15000)
      .emit(name, ...args, (e, r) =>
        e
          ? rej(e)
          : r?.ok === false
            ? rej(new Error(name + ":" + JSON.stringify(r)))
            : res(r),
      ),
  );
const theme = process.env.TEST_CUSTOM_CSS;
const password = "Fixture-Only-Kuma-9837!";
const logo = "data:image/png;base64," + process.env.TEST_LOGO_BASE64;
(async () => {
  await new Promise((res, rej) => {
    s.on("loginRequired", res);
    s.on("connect_error", rej);
  });
  if (process.env.TEST_ACTION === "seed") {
    const denied = await new Promise((resolve) =>
      s.emit("getMonitorList", resolve),
    );
    assert.equal(denied.ok, false);
    await call("setup", "operator", password);
  }
  await call("login", { username: "operator", password, token: "" });
  if (process.env.TEST_ACTION !== "seed") {
    const { config } = await call("getStatusPage", "public");
    assert.equal(config.title, "TasteInsight 服务状态");
    assert.equal(config.customCSS, theme);
    if (process.env.TEST_ACTION === "resolve") {
      const history = await fetch(
        "http://127.0.0.1:3001/api/status-page/public/incident-history",
      ).then((r) => r.json());
      await call("resolveIncident", "public", history.incidents[0].id);
      await call("unpinIncident", "public");
    }
    const bytes = await fetch("http://127.0.0.1:3001" + config.icon).then((r) =>
      r.arrayBuffer(),
    );
    assert.equal(Buffer.from(bytes).toString("base64"), logo.split(",")[1]);
    console.log(
      JSON.stringify({ authenticated: true, logoRestored: true, config }),
    );
    s.close();
    return;
  }
  await call(
    "setSettings",
    { trustProxy: true, disableAuth: false, entryPage: "dashboard" },
    password,
  );
  const monitor = async (
    name,
    type = "http",
    parent = null,
    url = "http://fixture:8000/probe?private=private-probe-value",
  ) =>
    (
      await call("add", {
        name,
        type,
        parent,
        url,
        jsonPath: "status",
        jsonPathOperator: "==",
        expectedValue: "ok",
        conditions: [],
        kafkaProducerBrokers: [],
        kafkaProducerSaslOptions: {},
        rabbitmqNodes: [],
        interval: 20,
        retryInterval: 20,
        resendInterval: 0,
        maxretries: 0,
        timeout: 5,
        active: true,
        method: "GET",
        accepted_statuscodes: ["200-299"],
        notificationIDList: {},
        ignoreTls: false,
        upsideDown: false,
        maxredirects: 3,
      })
    ).monitorID;
  const group = await monitor("菜品与食堂", "group");
  const probe = await monitor("private-public-probe", "http", group);
  const health = await monitor(
    "private-internal-health",
    "json-query",
    group,
    "http://fixture:8000/health",
  );
  const secret = await monitor("private-database-monitor");
  await call("addStatusPage", "TasteInsight 服务状态", "public");
  let { config } = await call("getStatusPage", "public");
  const groups = [
    { name: "服务状态", monitorList: [{ id: group, sendUrl: false }] },
  ];
  await call(
    "saveStatusPage",
    "public",
    {
      ...config,
      description: "查看服务运行状态、故障进展与维护安排。",
      customCSS: theme,
      theme: "light",
      autoRefreshInterval: 60,
      showTags: false,
      showCertificateExpiry: false,
      showPoweredBy: true,
      analyticsType: null,
      footerText: "可用率按最近 24 小时内的探测结果统计。",
    },
    logo,
    groups,
  );
  await call("addStatusPage", "private-page-title", "private");
  const p = await call("getStatusPage", "private");
  await call("saveStatusPage", "private", p.config, "/icon.svg", [
    { name: "private-group", monitorList: [{ id: secret, sendUrl: true }] },
  ]);
  const incident = await call("postIncident", "public", {
    title: "服务维护",
    content: "正在进行例行维护，进展将在此更新。",
    style: "info",
  });
  console.log(
    JSON.stringify({
      group,
      probe,
      health,
      secret,
      incident: incident.incident.id,
    }),
  );
  s.close();
})().catch((e) => {
  console.error(e);
  s.close();
  process.exitCode = 1;
});
