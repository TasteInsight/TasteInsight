#!/usr/bin/env node
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { writeFileSync } = require('node:fs');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const sharp = require('sharp');

// This runner creates fixtures. It must never accept a remote or existing application database.
const database = new URL(process.env.DATABASE_URL || 'http://invalid');
assert.equal(
  database.hostname,
  '127.0.0.1',
  'Use a loopback-only isolated PostgreSQL instance',
);
assert.equal(
  database.pathname,
  '/tasteinsight_contributions_e2e',
  'Use the dedicated contribution acceptance database',
);
const publicUrl = new URL(process.env.E2E_PUBLIC_URL);
const adminUrl = new URL(process.env.E2E_ADMIN_URL);
for (const url of [publicUrl, adminUrl])
  assert.equal(url.hostname, '127.0.0.1');
assert.notEqual(
  publicUrl.origin,
  adminUrl.origin,
  'Public/admin gateways must be isolated',
);
const prisma = new PrismaClient();
const prefix = `贡献验收-${Date.now()}`;
const checks = [];

async function call(base, path, token, method = 'GET', body, expected = 200) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20000),
  });
  const result = await response.json();
  assert.equal(
    response.status,
    expected,
    `${method} ${path}: ${JSON.stringify(result)}`,
  );
  return result.data;
}
const userCall = (path, token, method, body, status) =>
  call(publicUrl.href.replace(/\/$/, ''), path, token, method, body, status);
const adminCall = (path, token, method, body, status) =>
  call(adminUrl.href.replace(/\/$/, ''), path, token, method, body, status);
function checked(name) {
  checks.push(name);
  console.log(`PASS ${name}`);
}

async function login(suffix) {
  return userCall('/auth/wechat/login', null, 'POST', {
    code: `mock_contribution_${prefix}_${suffix}`,
    platform: 'mp-weixin',
  });
}
async function upload(token, color = '#8e537c', expected = 201) {
  const buffer = await sharp({
    create: { width: 8, height: 8, channels: 3, background: color },
  })
    .png()
    .toBuffer();
  const body = new FormData();
  body.append('file', new Blob([buffer], { type: 'image/png' }), 'fixture.png');
  const response = await fetch(
    `${publicUrl.href.replace(/\/$/, '')}/upload/image?purpose=dish-contribution`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body,
      signal: AbortSignal.timeout(20000),
    },
  );
  const result = await response.json();
  assert.equal(response.status, expected, JSON.stringify(result));
  return result.data;
}

async function main() {
  const student = await login('student');
  const visitor = await login('visitor');
  const token = student.token.accessToken;
  const visitorToken = visitor.token.accessToken;
  const userId = student.user.id;
  await prisma.studentVerification.create({
    data: {
      userId,
      method: 'acceptance-fixture',
      status: 'VERIFIED',
      verifiedAt: new Date(),
      expiresAt: new Date(Date.now() + 86400000),
    },
  });
  const username = `contribution-${Date.now()}`;
  const password = 'Local-Contribution-E2E-Only!';
  await prisma.admin.create({
    data: {
      username,
      password: await bcrypt.hash(password, 10),
      role: 'superadmin',
    },
  });
  const admin = await adminCall('/auth/admin/login', null, 'POST', {
    username,
    password,
  });
  const adminToken = admin.token.accessToken;
  const canteen = await prisma.canteen.create({
    data: { name: `${prefix}食堂`, images: [], openingHours: [] },
  });
  const floor = await prisma.floor.create({
    data: { canteenId: canteen.id, level: '2', name: '二层' },
  });
  const window = await prisma.window.create({
    data: {
      canteenId: canteen.id,
      floorId: floor.id,
      name: '家常菜',
      number: '02',
      tags: [],
    },
  });
  const dto = (name, extra = {}) => ({
    name,
    price: 12,
    priceUnit: '份',
    description: '本机隔离验收菜品',
    canteenId: canteen.id,
    canteenName: canteen.name,
    windowId: window.id,
    windowName: window.name,
    windowNumber: window.number,
    availableMealTime: ['lunch'],
    images: [],
    tags: ['家常菜'],
    ingredients: [],
    allergens: [],
    clientRequestId: randomUUID(),
    ...extra,
  });
  const detail = (id) => adminCall(`/admin/dishes/uploads/${id}`, adminToken);
  const approve = (id, body, status = 200) =>
    adminCall(
      `/admin/dishes/uploads/${id}/approve`,
      adminToken,
      'POST',
      body,
      status,
    );
  const revoke = (id, revision, status = 200) =>
    adminCall(
      `/admin/dishes/uploads/${id}/revoke`,
      adminToken,
      'POST',
      { revision },
      status,
    );

  await upload(visitorToken, '#fff', 403);
  await userCall(
    '/dishes/upload',
    visitorToken,
    'POST',
    dto('游客不可发布'),
    403,
  );
  checked('unverified users cannot upload contribution media or submit dishes');

  const image = await upload(token);
  assert.equal(
    (await fetch(image.url)).status,
    200,
    'Stored image is publicly readable through the gateway',
  );
  const request = dto(`${prefix}番茄炒蛋`, { images: [image.url] });
  const submitted = await Promise.all([
    userCall('/dishes/upload', token, 'POST', request, 201),
    userCall('/dishes/upload', token, 'POST', request, 201),
  ]);
  assert.equal(submitted[0].id, submitted[1].id);
  const uploadId = submitted[0].id;
  assert.equal(
    await prisma.dishUpload.count({
      where: { userId, clientRequestId: request.clientRequestId },
    }),
    1,
  );
  await userCall(
    '/dishes/upload',
    token,
    'POST',
    { ...request, price: 99 },
    409,
  );
  assert.equal(
    (await prisma.contributionImage.findUnique({ where: { url: image.url } }))
      .expiresAt,
    null,
  );
  await userCall(
    `/user/uploads/${uploadId}`,
    visitorToken,
    'GET',
    undefined,
    404,
  );
  checked(
    'real image upload, ownership, atomic binding and concurrent submission idempotency',
  );

  let reviewed = await detail(uploadId);
  assert.equal(reviewed.price, 12);
  assert.equal(reviewed.priceUnit, '份');
  assert.equal(reviewed.floorLevel, '2');
  const oldRevision = reviewed.revision;
  await adminCall(`/admin/dishes/uploads/${uploadId}`, adminToken, 'PATCH', {
    revision: oldRevision,
    price: 13,
  });
  await approve(uploadId, { revision: oldRevision }, 409);
  reviewed = await detail(uploadId);
  await approve(uploadId, { revision: reviewed.revision });
  let owned = await userCall(`/user/uploads/${uploadId}`, token);
  assert.equal(owned.status, 'approved');
  const history = await userCall('/user/uploads?page=1&pageSize=20', token);
  const summary = history.items.find((item) => item.id === uploadId);
  assert.ok(summary);
  for (const field of [
    'name',
    'images',
    'price',
    'priceUnit',
    'canteenName',
    'windowName',
    'status',
    'revision',
  ]) {
    assert.deepEqual(
      summary[field],
      owned[field],
      `List/detail disagree on ${field}`,
    );
  }
  const dishId = owned.approvedDishId;
  assert.ok(dishId);
  assert.equal((await userCall(`/dishes/${dishId}`, token)).price, 13);
  const inbox = await userCall(
    '/notifications?scope=service&pageSize=50',
    token,
  );
  assert.ok(
    inbox.items.some(
      (item) => item.type === 'upload_approved' && item.targetId === uploadId,
    ),
  );
  assert.equal(
    inbox.items.find(
      (item) => item.type === 'upload_approved' && item.targetId === uploadId,
    ).subject,
    request.name,
  );
  checked(
    'admin edits complete details, rejects stale revisions, publishes and notifies the author',
  );

  await userCall(
    '/reviews',
    token,
    'POST',
    { dishId, rating: 5, content: '本机验收评价', images: [] },
    201,
  );
  await userCall(`/dishes/${dishId}/favorite`, token, 'POST', {});
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  await userCall(
    '/meal-plans',
    token,
    'POST',
    {
      startDate: start.toISOString(),
      endDate: start.toISOString(),
      mealTime: 'lunch',
      dishes: [dishId],
      isPublic: false,
    },
    201,
  );
  const engagement = async () => ({
    reviews: await prisma.review.count({ where: { dishId } }),
    favorites: await prisma.favoriteDish.count({ where: { dishId } }),
    plans: await prisma.mealPlanDish.count({ where: { dishId } }),
  });
  const before = await engagement();
  assert.deepEqual(before, { reviews: 1, favorites: 1, plans: 1 });
  reviewed = await detail(uploadId);
  await revoke(uploadId, reviewed.revision);
  assert.equal(
    (await prisma.dish.findUnique({ where: { id: dishId } })).status,
    'offline',
  );
  assert.deepEqual(await engagement(), before);
  reviewed = await detail(uploadId);
  await approve(uploadId, { revision: reviewed.revision });
  assert.equal(
    (await userCall(`/user/uploads/${uploadId}`, token)).approvedDishId,
    dishId,
  );
  assert.deepEqual(await engagement(), before);
  checked(
    'revoke and reapprove preserve the dish ID, reviews, favorites and meal-plan associations',
  );

  const addition = await upload(token, '#42665a');
  const current = await prisma.dish.findUnique({ where: { id: dishId } });
  const patchRequest = dto(current.name, {
    targetDishId: dishId,
    targetDishUpdatedAt: current.updatedAt.toISOString(),
    changedFields: ['price', 'images'],
    price: 15,
    images: [addition.url],
  });
  const correction = await userCall(
    '/dishes/upload',
    token,
    'POST',
    patchRequest,
    201,
  );
  const competing = await userCall(
    '/dishes/upload',
    token,
    'POST',
    {
      ...patchRequest,
      clientRequestId: randomUUID(),
      price: 16,
      changedFields: ['price'],
      images: [],
    },
    201,
  );
  await approve(correction.id, {
    revision: (await detail(correction.id)).revision,
  });
  let updated = await prisma.dish.findUnique({ where: { id: dishId } });
  assert.equal(updated.price, 15);
  assert.deepEqual(updated.images, [image.url, addition.url]);
  await approve(
    competing.id,
    { revision: (await detail(competing.id)).revision },
    409,
  );
  const conflict = await detail(competing.id);
  await adminCall(
    `/admin/dishes/uploads/${competing.id}`,
    adminToken,
    'PATCH',
    {
      revision: conflict.revision,
      targetDishUpdatedAt: conflict.targetDish.updatedAt,
    },
  );
  await approve(competing.id, {
    revision: (await detail(competing.id)).revision,
  });
  assert.equal(
    (await prisma.dish.findUnique({ where: { id: dishId } })).price,
    16,
  );
  await revoke(correction.id, (await detail(correction.id)).revision, 409);
  assert.deepEqual(await engagement(), before);
  checked(
    'existing-dish additions merge images, preserve identity and require explicit conflict review',
  );

  const declined = await userCall(
    '/dishes/upload',
    token,
    'POST',
    dto(`${prefix}待补充`),
    201,
  );
  await adminCall(
    `/admin/dishes/uploads/${declined.id}/reject`,
    adminToken,
    'POST',
    { revision: 1, reason: '   ' },
    400,
  );
  await adminCall(
    `/admin/dishes/uploads/${declined.id}/reject`,
    adminToken,
    'POST',
    { revision: 1, reason: '请确认价格' },
  );
  const rejected = await userCall(`/user/uploads/${declined.id}`, token);
  assert.equal(rejected.rejectReason, '请确认价格');
  const reposted = await userCall(
    `/user/uploads/${declined.id}`,
    token,
    'PATCH',
    {
      ...dto(`${prefix}待补充`),
      clientRequestId: rejected.clientRequestId,
      revision: rejected.revision,
      price: 0,
    },
  );
  assert.equal(reposted.id, declined.id);
  assert.equal(reposted.status, 'pending');
  await userCall(
    `/user/uploads/${declined.id}/withdraw`,
    token,
    'POST',
    { revision: reposted.revision },
    201,
  );
  assert.equal(
    (await userCall(`/user/uploads/${declined.id}`, token)).status,
    'withdrawn',
  );
  const resultMessages = await userCall(
    '/notifications?scope=service&pageSize=50',
    token,
  );
  for (const [type, targetId] of [
    ['upload_rejected', declined.id],
    ['upload_revoked', uploadId],
  ]) {
    assert.equal(
      resultMessages.items.filter(
        (item) => item.type === type && item.targetId === targetId,
      ).length,
      1,
    );
  }
  checked(
    'rejection reasons, same-record resubmission with explicit zero price and owner withdrawal',
  );

  const thirdImage = await upload(token, '#9b7642');
  const duplicate = await userCall(
    '/dishes/upload',
    token,
    'POST',
    dto(current.name, { price: 88, images: [thirdImage.url] }),
    201,
  );
  const mergeReview = await detail(duplicate.id);
  assert.ok(mergeReview.duplicateCandidates.some((item) => item.id === dishId));
  updated = await prisma.dish.findUnique({ where: { id: dishId } });
  const count = await prisma.dish.count({ where: { canteenId: canteen.id } });
  await approve(duplicate.id, {
    revision: mergeReview.revision,
    mergeDishId: dishId,
    mergeDishUpdatedAt: updated.updatedAt.toISOString(),
    mergeFields: ['images'],
  });
  assert.equal(
    await prisma.dish.count({ where: { canteenId: canteen.id } }),
    count,
  );
  updated = await prisma.dish.findUnique({ where: { id: dishId } });
  assert.equal(updated.price, 16);
  assert.ok(updated.images.includes(thirdImage.url));
  await revoke(duplicate.id, (await detail(duplicate.id)).revision);
  updated = await prisma.dish.findUnique({ where: { id: dishId } });
  assert.deepEqual(updated.images, [image.url, addition.url]);
  assert.equal(updated.status, 'online');
  assert.deepEqual(await engagement(), before);
  checked(
    'selective duplicate merging and safe field rollback do not overwrite unrelated data',
  );

  const deadline = Date.now() + 45000;
  let ready = false;
  while (Date.now() < deadline) {
    const pending = await prisma.dishUpload.count({
      where: { approvedDishId: dishId, refreshPending: true },
    });
    const vectors =
      await prisma.$queryRaw`SELECT count(*)::int AS count FROM dish_embeddings WHERE "dishId" = ${dishId}`;
    if (!pending && vectors[0].count > 0) {
      ready = true;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  assert.ok(
    ready,
    'Worker must finish publication refresh and persist an embedding',
  );
  checked(
    'real Redis worker consumes publication refreshes and persists the dish vector',
  );

  for (const detachBeforeRevoke of [true, false]) {
    const parentUpload = await userCall(
      '/dishes/upload',
      token,
      'POST',
      dto(`${prefix}层级父-${detachBeforeRevoke}`),
      201,
    );
    await approve(parentUpload.id, { revision: 1 });
    const parentId = (await detail(parentUpload.id)).approvedDishId;
    const childUpload = await adminCall(
      '/admin/dishes',
      adminToken,
      'POST',
      {
        name: `${prefix}层级子-${detachBeforeRevoke}`,
        price: 5,
        windowId: window.id,
        parentDishId: parentId,
      },
      201,
    );
    await approve(childUpload.id, { revision: 1 });
    const childId = (await detail(childUpload.id)).approvedDishId;
    if (!detachBeforeRevoke) await revoke(childUpload.id, 2);
    await adminCall(`/admin/dishes/${childId}`, adminToken, 'PUT', {
      parentDishId: null,
      ...(detachBeforeRevoke
        ? { price: 7, description: '正式补充资料', tags: ['保留标签'] }
        : {}),
    });
    await adminCall(`/admin/dishes/${parentId}`, adminToken, 'PUT', {
      parentDishId: childId,
      status: 'offline',
    });
    if (detachBeforeRevoke) await revoke(childUpload.id, 2);
    await adminCall(`/admin/dishes/${parentId}/status`, adminToken, 'PATCH', {
      status: 'online',
    });
    await approve(childUpload.id, { revision: 3 });
    const restored = await prisma.dish.findUnique({ where: { id: childId } });
    assert.equal(
      restored.parentDishId,
      null,
      'Reapproval must not restore an obsolete parent relationship',
    );
    assert.equal(restored.status, 'online');
    assert.equal(
      restored.price,
      detachBeforeRevoke ? 7 : 5,
      'Reapproval must preserve formal edits made before revocation',
    );
    if (detachBeforeRevoke) {
      assert.equal(restored.description, '正式补充资料');
      assert.deepEqual(restored.tags, ['保留标签']);
      await adminCall(`/admin/dishes/${parentId}/status`, adminToken, 'PATCH', {
        status: 'offline',
      });
      await revoke(childUpload.id, (await detail(childUpload.id)).revision);
      await adminCall(
        `/admin/dishes/uploads/${childUpload.id}`,
        adminToken,
        'PATCH',
        {
          revision: (await detail(childUpload.id)).revision,
          price: 9,
        },
      );
      await adminCall(`/admin/dishes/${childId}`, adminToken, 'PUT', {
        description: '离线期间补充资料',
      });
      await approve(childUpload.id, {
        revision: (await detail(childUpload.id)).revision,
      });
      let restoredAgain = await prisma.dish.findUnique({
        where: { id: childId },
      });
      assert.equal(
        restoredAgain.price,
        9,
        'Explicit edits made during rereview are applied',
      );
      assert.equal(
        restoredAgain.description,
        '离线期间补充资料',
        'Unrelated formal edits are retained',
      );
      assert.deepEqual(restoredAgain.tags, ['保留标签']);
      await adminCall(`/admin/dishes/${childId}`, adminToken, 'PUT', {
        price: 12,
      });
      await revoke(childUpload.id, (await detail(childUpload.id)).revision);
      await approve(childUpload.id, {
        revision: (await detail(childUpload.id)).revision,
      });
      restoredAgain = await prisma.dish.findUnique({ where: { id: childId } });
      assert.equal(
        restoredAgain.price,
        12,
        'A later revoke starts a new review baseline',
      );
      await revoke(childUpload.id, (await detail(childUpload.id)).revision);
      await adminCall(
        `/admin/dishes/uploads/${childUpload.id}`,
        adminToken,
        'PATCH',
        {
          revision: (await detail(childUpload.id)).revision,
          price: 13,
        },
      );
      await adminCall(`/admin/dishes/${childId}`, adminToken, 'PUT', {
        price: 14,
      });
      await approve(
        childUpload.id,
        { revision: (await detail(childUpload.id)).revision },
        409,
      );
      assert.equal(
        (await prisma.dish.findUnique({ where: { id: childId } })).price,
        14,
      );
    }
    assert.equal((await detail(childUpload.id)).approvedDishId, childId);
    assert.equal(
      (await prisma.dish.findUnique({ where: { id: parentId } })).parentDishId,
      childId,
    );
  }
  checked(
    'real admin reassignment before and after revoke preserves the current hierarchy on reapproval',
  );
  const tiedIds = [declined.id, duplicate.id];
  await prisma.dishUpload.updateMany({
    where: { id: { in: tiedIds }, userId },
    data: { createdAt: new Date() },
  });
  const orderedHistory = await userCall(
    '/user/uploads?page=1&pageSize=50',
    token,
  );
  assert.deepEqual(
    orderedHistory.items
      .filter((item) => tiedIds.includes(item.id))
      .map((item) => item.id),
    [...tiedIds].sort().reverse(),
    'Equal submission timestamps must retain a deterministic record order',
  );
  checked(
    'contribution history preserves deterministic order for equal submission timestamps',
  );
  const result = {
    checks,
    fixture: { userId, username, canteenId: canteen.id, dishId, uploadId },
    finishedAt: new Date().toISOString(),
  };
  if (process.env.E2E_RESULT_FILE)
    writeFileSync(process.env.E2E_RESULT_FILE, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
}
main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
