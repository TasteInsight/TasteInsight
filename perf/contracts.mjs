export const hasId = (data) =>
  typeof data?.id === "string" && data.id.length > 0;
export const list = (data) =>
  Array.isArray(data?.items) && typeof data?.meta?.total === "number";
export function validateResponse(response, statuses, predicate) {
  let body;
  try {
    body =
      typeof response.body === "string"
        ? JSON.parse(response.body)
        : response.body;
  } catch {
    return { ok: false };
  }
  const ok =
    statuses.includes(response.status) &&
    body &&
    typeof body.code === "number" &&
    body.code >= 200 &&
    body.code < 300 &&
    predicate(body.data);
  return { ok: Boolean(ok), data: body?.data };
}
export function assertSlotIdentity(data, slot, kind) {
  return data?.id === slot[kind].id;
}
