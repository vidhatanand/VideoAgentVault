import { watchJob } from "./job-progress.js";
import { processingArguments, approvedStart } from "./processing-arguments.js";
import { op, panel, form, error, usd } from "./client.js";
export async function processVideo(video, kind) {
  const titles = {
    index: "Understand speech",
    summarize: "Summarize this video",
    transcode: "Prepare adaptive streaming",
    export: "Export an MP4",
    ask: "Ask this video",
  };
  const root = panel(
    titles[kind],
    `<p>${kind === "ask" ? "Ask a question grounded in the indexed video. Index the video first." : "Review the estimated spending hold before starting. Jobs continue when you close this drawer."}</p><form>${kind === "ask" ? '<label>Your question<textarea name="query" required placeholder="What are the main findings?"></textarea></label>' : ""}<button type="submit">Get estimate</button></form>`,
  );
  form(root, async (data) => {
    const current = await op("video_get", { videoId: video.id });
    const args = processingArguments(current, kind, {
      query: data.get("query"),
    });
    const quote = await op("processing_quote", args.quote);
    const key = crypto.randomUUID();
    root.innerHTML = `<h3>Approve estimated usage</h3><p>Up to <strong>${usd(quote.reserveMicros)}</strong> will be reserved from your workspace's provider-spend budget. Actual usage is settled after processing. This is an estimate, not your Cloudflare invoice.</p><button class="primary" id="approve">Approve and start</button>`;
    root.querySelector("#approve").onclick = async (e) => {
      e.target.disabled = true;
      try {
        const job = await op(
          "processing_start",
          approvedStart(args.start, quote, key),
        );
        watchJob(job.id, root);
      } catch (ex) {
        error(root, ex);
      }
    };
  });
}
