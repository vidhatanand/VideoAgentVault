/** Select a viewer or owner entry point without exposing owner APIs to shared links. */
export async function resolveEntry(url, { api, op }) {
  const match = /^\/watch\/(v_[A-Za-z0-9_-]+)$/.exec(url.pathname);
  const hash = new URLSearchParams(url.hash.slice(1));
  if (match && hash.has("share")) {
    const token = hash.get("share");
    if (!token || token.length > 100)
      throw new Error("Invalid shared video link.");
    return {
      kind: "shared",
      videoId: match[1],
      shareToken: token,
      start: Math.max(0, Number(hash.get("t")) || 0),
    };
  }
  const me = await api("/api/me"),
    workspace = me.tenants[0]?.id;
  if (!workspace)
    throw new Error("The installation has no accessible workspace.");
  return match
    ? {
        kind: "video",
        workspace,
        video: await op("video_get", { videoId: match[1] }),
      }
    : { kind: "library", workspace };
}
