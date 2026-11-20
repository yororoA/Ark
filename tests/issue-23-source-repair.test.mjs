import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import repair from '../scripts/repair-issue-23-code-lines.cjs'

const { ARTICLE_ID, REPAIRS, planRepair, repairArticle } = repair
const before = ['# 原标题', 'Unrelated prose and `inline_code` stay intact.', ...REPAIRS.map(item => item.before), '```js\nconst untouched = true\n```', '原文结尾。'].join('\n\n')
const after = ['# 原标题', 'Unrelated prose and `inline_code` stay intact.', ...REPAIRS.map(item => item.after), '```js\nconst untouched = true\n```', '原文结尾。'].join('\n\n')

function collection(content = before, { race = false, missing = false } = {}) {
  const writes = []
  return {
    writes,
    findOne: async query => {
      assert.deepEqual(query, { _id: ARTICLE_ID })
      return missing ? null : { _id: ARTICLE_ID, title: 'Agile Software Development 敏捷软件开发', content }
    },
    updateOne: async (query, update) => {
      writes.push({ query, update })
      assert.deepEqual(query, { _id: ARTICLE_ID, content }, 'The write must compare the entire original source')
      assert.deepEqual(update, { $set: { content: after } }, 'No other article field is modified')
      return race ? { matchedCount: 0, modifiedCount: 0 } : { matchedCount: 1, modifiedCount: 1 }
    },
  }
}

test('The reviewed repair only inserts line breaks into the three exact code fences', () => {
  const plan = planRepair(before)
  assert.equal(plan.content, after)
  assert.equal(plan.changes.length, 3)
  assert.equal(plan.content.replaceAll('\n', ''), before.replaceAll('\n', ''), 'All original non-newline characters remain unchanged')
  for (const item of REPAIRS) assert.equal(item.after.replaceAll('\n', ''), item.before.replaceAll('\n', ''))
})

test('An already repaired or partially repaired article is idempotent', () => {
  assert.deepEqual(planRepair(after), { content: after, changes: [], status: 'already-repaired' })
  const partial = before.replace(REPAIRS[0].before, REPAIRS[0].after)
  assert.equal(planRepair(partial).content, after)
  assert.equal(planRepair(partial).changes.length, 2)
})

for (const [name, source] of [
  ['missing', before.replace(REPAIRS[0].before, '')],
  ['duplicate', before + '\n\n' + REPAIRS[0].before],
  ['both versions', before + '\n\n' + REPAIRS[0].after],
  ['edited original', before.replace('existing = [(14, 16)]', 'existing = [(13, 16)]')],
]) test(`An unexpected ${name} fence is rejected before any write`, async () => {
  const db = collection(source)
  await assert.rejects(repairArticle(db, { articleId: ARTICLE_ID, apply: true }), /expected exactly one/)
  assert.equal(db.writes.length, 0)
})

test('Database repair defaults to a read-only preview', async () => {
  const db = collection()
  const result = await repairArticle(db, { articleId: ARTICLE_ID })
  assert.equal(result.status, 'repair-needed')
  assert.equal(result.apply, false)
  assert.equal(db.writes.length, 0)
})

test('Explicit apply changes only the source that was reviewed in the same run', async () => {
  const db = collection()
  assert.equal((await repairArticle(db, { articleId: ARTICLE_ID, apply: true })).status, 'repaired')
  assert.equal(db.writes.length, 1)
})

test('Reapplying a repaired source does not write again', async () => {
  const db = collection(after)
  assert.equal((await repairArticle(db, { articleId: ARTICLE_ID, apply: true })).status, 'already-repaired')
  assert.equal(db.writes.length, 0)
})

test('A concurrent article edit fails the atomic compare-and-set', async () => {
  const db = collection(before, { race: true })
  await assert.rejects(repairArticle(db, { articleId: ARTICLE_ID, apply: true }), /changed after it was read/)
  assert.equal(db.writes.length, 1)
})

test('A missing article or different target cannot be modified', async () => {
  const missing = collection(before, { missing: true })
  await assert.rejects(repairArticle(missing, { articleId: ARTICLE_ID, apply: true }), /not found/)
  await assert.rejects(repairArticle(collection(), { articleId: 'different', apply: true }), /different article/)
  assert.equal(missing.writes.length, 0)
})

test('The mongosh entry waits for its read-only preview and prints the selected database', async () => {
  const source = await readFile(new URL('../scripts/repair-issue-23-code-lines.mongosh.js', import.meta.url), 'utf8')
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
  const run = new AsyncFunction('db', 'ObjectId', 'process', 'require', 'print', source)
  const printed = [], writes = []
  let readFinished = false
  const db = {
    getName: () => 'local-repair-fixture',
    getCollection: name => {
      assert.equal(name, 'articles')
      return {
        findOne: async ({ _id }) => {
          assert.equal(String(_id), ARTICLE_ID)
          await new Promise(resolve => setTimeout(resolve, 10))
          readFinished = true
          return { _id, content: before }
        },
        updateOne: (...args) => writes.push(args),
      }
    },
  }
  class FakeObjectId { constructor(value) { this.value = value } toString() { return this.value } }
  await run(db, FakeObjectId, { cwd: () => '/fixture', env: {} }, path => {
    assert.equal(path, '/fixture/scripts/repair-issue-23-code-lines.cjs')
    return repair
  }, value => printed.push(JSON.parse(value)))
  assert.equal(readFinished, true)
  assert.equal(printed[0].status, 'repair-needed')
  assert.equal(printed[0].database, 'local-repair-fixture')
  assert.equal(writes.length, 0)
  await assert.rejects(run(db, FakeObjectId, { cwd: () => '/fixture', env: { ARK_REPAIR_ISSUE23_APPLY: 'yes' } }, () => repair, () => {}), /must be 0 or 1/)
})
