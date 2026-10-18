const names = {
  operational: "运行正常",
  disrupted: "服务异常",
  unknown: "状态暂不可用",
};
const summary = document.querySelector("#summary");
const updated = document.querySelector("#updated");
const list = document.querySelector("#services");
const refresh = document.querySelector("#refresh");
let running = false;
async function update() {
  if (running) return;
  running = true;
  refresh.disabled = true;
  list.setAttribute("aria-busy", "true");
  try {
    const response = await fetch("/api/status", {
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (!response.ok) throw new Error("Unavailable");
    const data = await response.json();
    const overall = data.services.some((s) => s.status === "disrupted")
      ? "disrupted"
      : data.services.every((s) => s.status === "operational")
        ? "operational"
        : "unknown";
    document.body.dataset.state = overall;
    summary.textContent = {
      operational: "各项服务运行正常",
      disrupted: "部分服务出现异常",
      unknown: "正在确认服务状态",
    }[overall];
    updated.textContent = data.updatedAt
      ? `最近更新：${new Date(data.updatedAt * 1000).toLocaleString("zh-CN")}`
      : "暂时无法获取最新状态，请稍后刷新";
    list.replaceChildren(
      ...data.services.map((service) => {
        const li = document.createElement("li");
        const title = document.createElement("span");
        title.textContent = service.name;
        const state = document.createElement("span");
        state.className = `state ${service.status}`;
        state.textContent = names[service.status] || names.unknown;
        li.append(title, state);
        return li;
      }),
    );
    document.querySelector("#notice").hidden = !data.notice;
    document.querySelector("#notice-text").textContent = data.notice;
    document.querySelector("#feedback").textContent = "";
  } catch {
    document.body.dataset.state = "unknown";
    summary.textContent = "状态暂不可用";
    updated.textContent = "连接中断，请稍后刷新";
    list.querySelectorAll(".state").forEach((state) => {
      state.className = "state unknown";
      state.textContent = names.unknown;
    });
    document.querySelector("#feedback").textContent = "暂时无法获取最新状态";
  } finally {
    running = false;
    refresh.disabled = false;
    list.setAttribute("aria-busy", "false");
  }
}
refresh.addEventListener("click", update);
update();
setInterval(update, 30000);
