#!/usr/bin/env node
'use strict';
const fs = require('node:fs/promises');

function timestamp(value, name) {
  if (
    typeof value !== 'string' ||
    !/(Z|[+-]\d\d:\d\d)$/.test(value) ||
    !Number.isFinite(Date.parse(value))
  )
    throw new Error(`${name} requires an ISO timestamp with timezone`);
  return Date.parse(value);
}
function strings(value, name) {
  if (
    !Array.isArray(value) ||
    value.some((id) => typeof id !== 'string' || !id) ||
    new Set(value).size !== value.length
  )
    throw new Error(`${name} requires unique nonempty strings`);
  return value;
}
function mean(values) {
  return values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : null;
}
function quantile(values, fraction) {
  return values.length
    ? [...values].sort((a, b) => a - b)[
        Math.max(0, Math.ceil(fraction * values.length) - 1)
      ]
    : null;
}
function diversity(ids, tags) {
  const distances = [];
  for (let i = 0; i < ids.length; i++)
    for (let j = i + 1; j < ids.length; j++) {
      const left = new Set(tags[ids[i]]),
        right = new Set(tags[ids[j]]);
      const union = new Set([...left, ...right]);
      if (union.size)
        distances.push(
          1 - [...left].filter((tag) => right.has(tag)).length / union.size,
        );
    }
  return mean(distances);
}

function evaluate(runs, labels, options) {
  if (!Array.isArray(runs) || !runs.length || !Array.isArray(labels))
    throw new Error('Runs must be nonempty and labels must be an array');
  const trainUntil = timestamp(options.trainUntil, 'train-until');
  const validationUntil = timestamp(
    options.validationUntil,
    'validation-until',
  );
  const testStart = timestamp(options.testStart, 'test-start');
  const testEnd = timestamp(options.testEnd, 'test-end');
  if (
    !(
      trainUntil < validationUntil &&
      validationUntil < testStart &&
      testStart < testEnd
    )
  )
    throw new Error(
      'Require train-until < validation-until < test-start < test-end',
    );
  if (testEnd > Date.now())
    throw new Error('Test end must be an already observed timestamp');
  const k = Number(options.k),
    windowMs = Number(options.labelWindowHours) * 3600000;
  if (
    !Number.isInteger(k) ||
    k < 1 ||
    !Number.isFinite(windowMs) ||
    windowMs <= 0
  )
    throw new Error(
      'k must be a positive integer and label-window-hours must be positive',
    );
  const queries = new Map(),
    versions = new Set(),
    catalogSizes = new Set();
  for (const run of runs) {
    for (const field of ['queryId', 'userId', 'strategyRevisionId'])
      if (typeof run[field] !== 'string' || !run[field])
        throw new Error(`Missing prediction identity ${field}`);
    const predictedAt = timestamp(run.predictedAt, 'predictedAt');
    const featureAsOf = timestamp(run.featureAsOf, 'featureAsOf');
    if (featureAsOf > predictedAt)
      throw new Error('Feature snapshot contains information after prediction');
    if (
      predictedAt < testStart ||
      predictedAt >= testEnd ||
      predictedAt + windowMs > testEnd
    )
      throw new Error(
        'Prediction must be inside the independent test window with a mature label window',
      );
    if (
      !Number.isInteger(run.historyCount) ||
      run.historyCount < 0 ||
      !Number.isInteger(run.catalogSize) ||
      run.catalogSize < 1 ||
      typeof run.latencyMs !== 'number' ||
      !Number.isFinite(run.latencyMs) ||
      run.latencyMs < 0
    )
      throw new Error('Invalid history, catalog size or latency');
    strings(run.candidateIds, 'candidateIds');
    strings(run.rankedIds, 'rankedIds');
    if (
      run.candidateIds.length > run.catalogSize ||
      run.rankedIds.some((id) => !run.candidateIds.includes(id))
    )
      throw new Error(
        'Ranked IDs must belong to the recorded candidate set and catalog',
      );
    if (!run.candidateTags || typeof run.candidateTags !== 'object')
      throw new Error('candidateTags is required');
    for (const id of run.candidateIds)
      strings(run.candidateTags[id], `tags for ${id}`);
    if (
      run.fallbackReason !== undefined &&
      (typeof run.fallbackReason !== 'string' || !run.fallbackReason)
    )
      throw new Error('fallbackReason must be a nonempty string when present');
    const identity = JSON.stringify([
      run.userId,
      featureAsOf,
      predictedAt,
      run.historyCount,
      run.catalogSize,
    ]);
    let query = queries.get(run.queryId);
    if (!query) {
      query = { identity, versions: new Set() };
      queries.set(run.queryId, query);
    }
    if (query.identity !== identity)
      throw new Error(
        'Conflicting query identity or feature/prediction snapshot',
      );
    if (query.versions.has(run.strategyRevisionId))
      throw new Error('Duplicate prediction for a query and strategy revision');
    query.versions.add(run.strategyRevisionId);
    versions.add(run.strategyRevisionId);
    catalogSizes.add(run.catalogSize);
  }
  if (catalogSizes.size !== 1)
    throw new Error(
      'Coverage comparison requires one fixed catalog snapshot size',
    );
  for (const query of queries.values())
    if (query.versions.size !== versions.size)
      throw new Error('Every query must contain the same strategy revisions');
  const byUser = new Map(),
    seenLabels = new Set();
  let duplicateLabels = 0;
  for (const label of labels) {
    if (
      typeof label.userId !== 'string' ||
      !label.userId ||
      typeof label.dishId !== 'string' ||
      !label.dishId
    )
      throw new Error('Labels require userId and dishId');
    const eventAt = timestamp(label.eventAt, 'eventAt');
    if (eventAt < testStart || eventAt > testEnd)
      throw new Error('Labels must come from the independent test window');
    const key = JSON.stringify([label.userId, label.dishId, eventAt]);
    if (seenLabels.has(key)) {
      duplicateLabels++;
      continue;
    }
    seenLabels.add(key);
    if (!byUser.has(label.userId)) byUser.set(label.userId, []);
    byUser.get(label.userId).push({ dishId: label.dishId, eventAt });
  }
  const enriched = runs.map((run) => {
    const at = Date.parse(run.predictedAt);
    const relevant = new Set(
      (byUser.get(run.userId) || [])
        .filter((label) => label.eventAt > at && label.eventAt <= at + windowMs)
        .map((label) => label.dishId),
    );
    const ranked = run.rankedIds.slice(0, k),
      candidates = run.candidateIds.slice(0, k);
    const hitCount = ranked.filter((id) => relevant.has(id)).length;
    const dcg = ranked.reduce(
      (sum, id, rank) => sum + (relevant.has(id) ? 1 / Math.log2(rank + 2) : 0),
      0,
    );
    const ideal = Array.from(
      { length: Math.min(k, relevant.size) },
      (_, rank) => 1 / Math.log2(rank + 2),
    ).reduce((sum, value) => sum + value, 0);
    return {
      run,
      ranked,
      relevantCount: relevant.size,
      candidateRecallAtK: relevant.size
        ? candidates.filter((id) => relevant.has(id)).length / relevant.size
        : null,
      candidateRecallAll: relevant.size
        ? run.candidateIds.filter((id) => relevant.has(id)).length /
          relevant.size
        : null,
      ndcgAtK: ideal ? dcg / ideal : null,
      hitRateAtK: relevant.size ? Number(hitCount > 0) : null,
      diversityAtK: diversity(ranked, run.candidateTags),
    };
  });
  const catalogSize = [...catalogSizes][0];
  function summarize(rows) {
    const positives = rows.filter((row) => row.relevantCount > 0);
    const exposed = new Set(rows.flatMap((row) => row.ranked));
    if (exposed.size > catalogSize)
      throw new Error('Observed IDs exceed the declared fixed catalog size');
    const latency = rows.map((row) => row.run.latencyMs);
    return {
      queryCount: rows.length,
      evaluableQueries: positives.length,
      zeroRelevantQueries: rows.length - positives.length,
      candidateRecallAtK: mean(positives.map((row) => row.candidateRecallAtK)),
      candidateRecallAll: mean(positives.map((row) => row.candidateRecallAll)),
      ndcgAtK: mean(positives.map((row) => row.ndcgAtK)),
      hitRateAtK: mean(positives.map((row) => row.hitRateAtK)),
      coverageAtK: rows.length ? exposed.size / catalogSize : null,
      diversityAtK: mean(
        rows.map((row) => row.diversityAtK).filter((value) => value !== null),
      ),
      latency: {
        meanMs: mean(latency),
        p50Ms: quantile(latency, 0.5),
        p95Ms: quantile(latency, 0.95),
      },
      fallbackRate: mean(
        rows.map((row) => Number(Boolean(row.run.fallbackReason))),
      ),
    };
  }
  return {
    metricVersion: 1,
    k,
    labelWindowHours: Number(options.labelWindowHours),
    trainUntil: options.trainUntil,
    validationUntil: options.validationUntil,
    testStart: options.testStart,
    testEnd: options.testEnd,
    queryCount: queries.size,
    uniqueLabelEvents: seenLabels.size,
    duplicateLabels,
    catalogSize,
    population:
      'Future observed positive events; missing events are unobserved relevance. Zero-relevance queries are excluded from recall/NDCG/hit-rate means.',
    provenance:
      'Declared training cutoffs and supplied prediction records; this evaluator does not verify model training history or establish online lift.',
    strategies: [...versions].sort().map((strategyRevisionId) => {
      const rows = enriched.filter(
        (row) => row.run.strategyRevisionId === strategyRevisionId,
      );
      return {
        strategyRevisionId,
        overall: summarize(rows),
        coldStart: summarize(rows.filter((row) => row.run.historyCount === 0)),
        warm: summarize(rows.filter((row) => row.run.historyCount > 0)),
      };
    }),
  };
}

async function readRecords(path, kind) {
  const content = await fs.readFile(path, 'utf8');
  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    return content
      .split(/\r?\n/)
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line));
  }
  if (Array.isArray(parsed)) return parsed;
  if (kind === 'runs') return parsed.data?.runs || parsed.runs || [parsed];
  return [parsed];
}
async function cli(argv) {
  const mode = argv[0] === 'collect' ? argv.shift() : 'evaluate';
  const options = {};
  while (argv.length) {
    const name = argv.shift();
    if (!name?.startsWith('--') || !argv.length)
      throw new Error('Arguments use --name value');
    options[
      name.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())
    ] = argv.shift();
  }
  let result;
  if (mode === 'collect') {
    if (
      !process.env.ADMIN_TOKEN ||
      !options.url ||
      !options.request ||
      !options.output
    )
      throw new Error(
        'collect requires ADMIN_TOKEN, --url, --request and --output',
      );
    const response = await fetch(options.url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.ADMIN_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: await fs.readFile(options.request, 'utf8'),
      signal: AbortSignal.timeout(120000),
      redirect: 'error',
    });
    if (!response.ok)
      throw new Error(`Shadow API returned HTTP ${response.status}`);
    result = await response.json();
    if (!Array.isArray(result.data?.runs))
      throw new Error('Shadow response is missing data.runs');
  } else {
    if (!options.runs || !options.labels)
      throw new Error('Evaluation requires --runs and --labels');
    result = evaluate(
      await readRecords(options.runs, 'runs'),
      await readRecords(options.labels, 'labels'),
      options,
    );
  }
  const serialized = JSON.stringify(result, null, 2) + '\n';
  if (options.output) {
    await fs.writeFile(options.output, serialized, { flag: 'wx', mode: 0o600 });
    process.stdout.write(`Saved ${mode} result to ${options.output}\n`);
  } else process.stdout.write(serialized);
}
module.exports = { evaluate, readRecords, cli };
if (require.main === module)
  cli(process.argv.slice(2)).catch((error) => {
    process.stderr.write(error.message + '\n');
    process.exitCode = 1;
  });
