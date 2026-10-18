import test from "node:test";
import assert from "node:assert/strict";
import { validateResponse, hasId, list } from "../contracts.mjs";
test("HTTP success never masks business errors or malformed payloads", () => {
  for (const body of [
    "invalid",
    "{}",
    '{"code":500,"data":{"id":"a"}}',
    '{"code":200,"data":null}',
  ])
    assert.equal(
      validateResponse({ status: 200, body }, [200], hasId).ok,
      false,
    );
  assert.equal(
    validateResponse(
      { status: 200, body: '{"code":200,"data":{"id":"a"}}' },
      [201],
      hasId,
    ).ok,
    false,
  );
  assert.equal(
    validateResponse(
      { status: 201, body: '{"code":201,"data":{"id":"a"}}' },
      [201],
      hasId,
    ).ok,
    true,
  );
});
test("paginated lists require current items/meta contract", () => {
  assert.equal(list({ items: [], meta: { total: 0 } }), true);
  assert.equal(list({ list: [], total: 0 }), false);
});
