const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtemp, writeFile, readFile, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { createServer } = require('node:http');
const { evaluate } = require('./recommendation-evaluate.cjs');
const options = {
  trainUntil: '2020-01-01T00:00:00Z',
  validationUntil: '2020-02-01T00:00:00Z',
  testStart: '2020-03-01T00:00:00Z',
  testEnd: '2020-03-05T00:00:00Z',
  labelWindowHours: 24,
  k: 2,
};
function fixture() {
  const tags = { a: ['x'], b: ['y'], c: ['z'], d: ['x'] };
  const cases = [
    {
      queryId: 'q1',
      userId: 'cold',
      predictedAt: '2020-03-01T01:00:00Z',
      historyCount: 0,
      candidateIds: ['a', 'b', 'c'],
      rankedIds: ['b', 'a'],
      latencyMs: 10,
    },
    {
      queryId: 'q2',
      userId: 'warm',
      predictedAt: '2020-03-02T01:00:00Z',
      historyCount: 3,
      candidateIds: ['a', 'b', 'd'],
      rankedIds: ['a', 'd'],
      latencyMs: 30,
      fallbackReason: 'fixture-failure',
    },
    {
      queryId: 'q3',
      userId: 'zero',
      predictedAt: '2020-03-03T01:00:00Z',
      historyCount: 0,
      candidateIds: ['a', 'd'],
      rankedIds: ['a'],
      latencyMs: 20,
    },
  ];
  const runs = cases.flatMap((row) =>
    ['s1', 's2'].map((strategyRevisionId) => ({
      ...row,
      strategyRevisionId,
      featureAsOf: row.predictedAt,
      catalogSize: 4,
      candidateTags: Object.fromEntries(
        row.candidateIds.map((id) => [id, tags[id]]),
      ),
    })),
  );
  const labels = [
    { userId: 'cold', dishId: 'a', eventAt: '2020-03-01T01:00:00Z' },
    { userId: 'cold', dishId: 'b', eventAt: '2020-03-01T02:00:00Z' },
    { userId: 'cold', dishId: 'c', eventAt: '2020-03-02T01:00:00Z' },
    { userId: 'cold', dishId: 'd', eventAt: '2020-03-02T01:00:01Z' },
    { userId: 'warm', dishId: 'd', eventAt: '2020-03-02T03:00:00Z' },
  ];
  return { runs, labels };
}
const near = (left, right) =>
  assert.ok(Math.abs(left - right) < 1e-12, `${left} != ${right}`);
test('computes future-label relevance, candidate recall, NDCG, coverage, diversity and cold/warm strata', () => {
  const { runs, labels } = fixture();
  const report = evaluate(runs, labels, options);
  const { overall, coldStart, warm } = report.strategies[0];
  assert.equal(report.queryCount, 3);
  assert.equal(overall.evaluableQueries, 2);
  assert.equal(overall.zeroRelevantQueries, 1);
  near(overall.candidateRecallAtK, 0.25);
  near(overall.candidateRecallAll, 1);
  near(overall.ndcgAtK, (1 / (1 + 1 / Math.log2(3)) + 1 / Math.log2(3)) / 2);
  near(overall.hitRateAtK, 1);
  near(overall.coverageAtK, 0.75);
  near(overall.diversityAtK, 0.5);
  near(overall.fallbackRate, 1 / 3);
  assert.deepEqual(overall.latency, { meanMs: 20, p50Ms: 20, p95Ms: 30 });
  assert.equal(coldStart.queryCount, 2);
  assert.equal(coldStart.evaluableQueries, 1);
  near(coldStart.candidateRecallAtK, 0.5);
  assert.equal(warm.queryCount, 1);
  near(warm.candidateRecallAtK, 0);
});
test('deduplicates repeated event labels and uses binary per-dish relevance', () => {
  const { runs, labels } = fixture();
  const baseline = evaluate(runs, labels, options);
  const report = evaluate(
    runs,
    [...labels, labels[1], { ...labels[1], eventAt: '2020-03-01T03:00:00Z' }],
    options,
  );
  assert.equal(report.duplicateLabels, 1);
  assert.deepEqual(report.strategies, baseline.strategies);
});
test('zero-relevance queries have null relevance means while operational metrics remain measured', () => {
  const { runs } = fixture();
  const result = evaluate(runs, [], options).strategies[0].overall;
  assert.equal(result.evaluableQueries, 0);
  assert.equal(result.zeroRelevantQueries, 3);
  assert.equal(result.ndcgAtK, null);
  assert.equal(result.hitRateAtK, null);
  assert.equal(result.candidateRecallAtK, null);
  near(result.coverageAtK, 0.75);
  assert.equal(result.latency.meanMs, 20);
});
test('rejects temporal leakage, nonmature windows and labels outside the independent test interval', () => {
  const { runs, labels } = fixture();
  assert.throws(
    () =>
      evaluate(runs, labels, {
        ...options,
        validationUntil: options.testStart,
      }),
    /Require train/,
  );
  assert.throws(
    () => evaluate(runs, labels, { ...options, labelWindowHours: 120 }),
    /mature/,
  );
  const leaked = structuredClone(runs);
  leaked[0].featureAsOf = '2020-03-01T01:00:01Z';
  assert.throws(() => evaluate(leaked, labels, options), /after prediction/);
  const past = structuredClone(runs);
  past[0].predictedAt = '2020-02-28T00:00:00Z';
  past[0].featureAsOf = past[0].predictedAt;
  assert.throws(() => evaluate(past, labels, options), /independent test/);
  assert.throws(
    () =>
      evaluate(
        runs,
        [...labels, { ...labels[0], eventAt: '2020-01-01T00:00:00Z' }],
        options,
      ),
    /independent test/,
  );
});
test('rejects query identity, strategy revision, candidate shape and comparison population conflicts', () => {
  const { runs, labels } = fixture();
  assert.throws(
    () => evaluate([...runs, runs[0]], labels, options),
    /Duplicate prediction/,
  );
  const conflict = structuredClone(runs);
  conflict[1].userId = 'someone-else';
  assert.throws(() => evaluate(conflict, labels, options), /Conflicting query/);
  const time = structuredClone(runs);
  time[1].predictedAt = '2020-03-01T02:00:00Z';
  assert.throws(() => evaluate(time, labels, options), /Conflicting query/);
  const version = structuredClone(runs);
  version[1].strategyRevisionId = 'different-revision';
  assert.throws(() => evaluate(version, labels, options), /same strategy/);
  const unknown = structuredClone(runs);
  unknown[0].rankedIds = ['outside'];
  assert.throws(() => evaluate(unknown, labels, options), /belong/);
  const duplicate = structuredClone(runs);
  duplicate[0].candidateIds.push('a');
  assert.throws(() => evaluate(duplicate, labels, options), /unique/);
  const invalid = structuredClone(runs);
  invalid[0].latencyMs = Infinity;
  assert.throws(() => evaluate(invalid, labels, options), /latency/);
});
test('CLI evaluates saved HTTP envelopes and JSONL labels and collects a real HTTP response without printing tokens', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'recommendation-evaluate-'));
  const { runs, labels } = fixture();
  const secret = 'fixture-token-not-for-output';
  const server = createServer(async (req, res) => {
    assert.equal(req.headers.authorization, `Bearer ${secret}`);
    for await (const _chunk of req) {
      /* drain request */
    }
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ code: 200, data: { runs } }));
  });
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  try {
    const input = join(directory, 'runs.json'),
      labelFile = join(directory, 'labels.jsonl'),
      requestFile = join(directory, 'request.json');
    await writeFile(
      requestFile,
      JSON.stringify({ userIds: ['cold'], strategyRevisionIds: ['s1', 's2'] }),
    );
    const collect = await promisify(execFile)(
      process.execPath,
      [
        __dirname + '/recommendation-evaluate.cjs',
        'collect',
        '--url',
        `http://127.0.0.1:${server.address().port}/admin/recommendation/shadow`,
        '--request',
        requestFile,
        '--output',
        input,
      ],
      { env: { ...process.env, ADMIN_TOKEN: secret } },
    );
    assert.ok(!collect.stdout.includes(secret));
    assert.ok(!collect.stderr.includes(secret));
    await writeFile(
      labelFile,
      labels.map((row) => JSON.stringify(row)).join('\n'),
    );
    const args = Object.entries(options).flatMap(([name, value]) => [
      '--' + name.replace(/[A-Z]/g, (letter) => '-' + letter.toLowerCase()),
      String(value),
    ]);
    const evaluated = await promisify(execFile)(process.execPath, [
      __dirname + '/recommendation-evaluate.cjs',
      '--runs',
      input,
      '--labels',
      labelFile,
      ...args,
    ]);
    assert.equal(JSON.parse(evaluated.stdout).strategies.length, 2);
    assert.equal(JSON.parse(await readFile(input, 'utf8')).data.runs.length, 6);
  } finally {
    await new Promise((done) => server.close(done));
    await rm(directory, { recursive: true, force: true });
  }
});
