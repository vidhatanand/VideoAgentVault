import { op, escape, error } from "./client.js";
export async function watchJob(id, root) {
  let cancelled = false;
  document.querySelector("#drawer").addEventListener(
    "close",
    () => {
      cancelled = true;
    },
    { once: true },
  );
  while (!cancelled) {
    try {
      const job = await op("job_get", { jobId: id });
      const p = job.progress;
      root.innerHTML = `<h3>${escape(job.kind)} · ${escape(job.state)}</h3><p>Job ${escape(id)}</p>${p ? `<p>${escape(p.stage)} ${p.etaSeconds ? `· estimated ${Math.ceil(p.etaSeconds / 60)} minutes remaining` : ""}</p><progress max="${Number(p.total) || 1}" value="${Number(p.completed) || 0}"></progress>` : "<p>Waiting for the next processing update…</p>"}`;
      if (job.finished_at) {
        const result =
          job.result?.summary || job.result?.answer || job.result?.text;
        if (result)
          root.innerHTML += `<div class="chat-answer">${escape(typeof result === "string" ? result : JSON.stringify(result))}</div>`;
        if (job.last_error) error(root, new Error(job.last_error));
        root.innerHTML +=
          "<p>Results remain in your workspace. You can reopen them from Activity.</p>";
        break;
      }
    } catch (ex) {
      error(root, ex);
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
}
