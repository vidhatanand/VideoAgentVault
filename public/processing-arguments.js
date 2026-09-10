export function processingArguments(
  video,
  kind,
  { query, maxWallSeconds = 900 } = {},
) {
  const quote = {
    kind,
    videoId: video.id,
    maxWallSeconds,
    ...(kind === "transcode" ? { profile: "economy" } : {}),
  };
  const start = {
    ...quote,
    expectedRevision: video.revision,
    ...(kind === "ask" ? { query: String(query || "") } : {}),
  };
  return { quote, start };
}
export function approvedStart(start, quote, requestKey) {
  if (!Number.isSafeInteger(quote.reserveMicros) || quote.reserveMicros < 0)
    throw new Error("Invalid processing estimate. No job was started.");
  return { ...start, requestKey, budgetMicros: quote.reserveMicros };
}
