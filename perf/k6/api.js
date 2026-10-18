import http from "k6/http";
import { check } from "k6";
import { joinUrl } from "../config.mjs";
import { validateResponse } from "../contracts.mjs";

export function api(config, slot, journey, phase = "workload") {
  return (
    realm,
    method,
    path,
    body,
    operation,
    predicate,
    statuses = [200],
    actor = null,
  ) => {
    const identity = actor || slot[realm === "admin" ? "admin" : "user"];
    const response = http.request(
      method,
      joinUrl(
        config[realm === "admin" ? "adminBaseUrl" : "publicBaseUrl"],
        path,
      ),
      body == null ? null : JSON.stringify(body),
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${identity.token}`,
        },
        tags: { name: operation, journey, phase },
        timeout: "15s",
        redirects: 0,
        responseCallback: http.expectedStatuses(...statuses),
      },
    );
    const result = validateResponse(response, statuses, predicate);
    check(
      result,
      { [`${operation}: contract`]: (value) => value.ok },
      { journey, phase },
    );
    if (!result.ok)
      throw new Error(
        `${operation}: contract failed (HTTP ${response.status})`,
      );
    return result.data;
  };
}
