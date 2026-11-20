/*
 * One-time repair for https://github.com/yororoA/Ark/issues/23.
 * The published article already contains three flattened Python code fences.
 * This repairs those exact source fragments; it is not a Markdown heuristic.
 *
 * Offline review of a saved public API response with Node >= 24 (never writes):
 *   node scripts/repair-issue-23-code-lines.cjs --input response.json
 * Database preview (the URI must select the intended database):
 *   mongosh "$MONGO_URI" --file scripts/repair-issue-23-code-lines.mongosh.js
 * Explicit apply, only after reviewing the preview:
 *   ARK_REPAIR_ISSUE23_APPLY=1 mongosh "$MONGO_URI" --file scripts/repair-issue-23-code-lines.mongosh.js
 *
 * The update matches both _id and the complete content read during this run.
 * A concurrent edit, missing/duplicate fragment, or different target is rejected.
 * Already repaired blocks are accepted, so repeating a successful run is a no-op.
 */
const ARTICLE_ID = '6afe670f10fead0b1ef9e2dd'
const fence = text => `\`\`\`\n${text}\n\`\`\``
const REPAIRS = [
  {
    label: '11.4 / RED',
    before: fence('existing = [(14, 16)]assert has_conflict(existing, (15, 17)) is True'),
    after: fence('existing = [(14, 16)]\nassert has_conflict(existing, (15, 17)) is True'),
  },
  {
    label: '11.4 / GREEN',
    before: fence('def has_conflict(bookings, new):    for b in bookings:        if new[0] < b[1] and b[0] < new[1]:            return True    return False'),
    after: fence('def has_conflict(bookings, new):\n    for b in bookings:\n        if new[0] < b[1] and b[0] < new[1]:\n            return True\n    return False'),
  },
  {
    label: '11.4 / REFACTOR',
    before: fence('def periods_overlap(a, b):    return a[0] < b[1] and b[0] < a[1]def has_conflict(bookings, new):    return any(periods_overlap(b, new)               for b in bookings)'),
    after: fence('def periods_overlap(a, b):\n    return a[0] < b[1] and b[0] < a[1]\n\ndef has_conflict(bookings, new):\n    return any(periods_overlap(b, new)\n               for b in bookings)'),
  },
]

function planRepair(content) {
  if (typeof content !== 'string') throw new Error('The target article must contain a Markdown string')
  let repaired = content
  const changes = []
  for (const repair of REPAIRS) {
    const beforeCount = content.split(repair.before).length - 1
    const afterCount = content.split(repair.after).length - 1
    if (beforeCount === 0 && afterCount === 1) continue
    if (beforeCount !== 1 || afterCount !== 0) {
      throw new Error(`${repair.label}: expected exactly one original or repaired fence; found ${beforeCount} original and ${afterCount} repaired`)
    }
    repaired = repaired.replace(repair.before, repair.after)
    changes.push(repair)
  }
  return { content: repaired, changes, status: changes.length ? 'repair-needed' : 'already-repaired' }
}

async function repairArticle(collection, { articleId, apply = false } = {}) {
  if (!articleId || String(articleId) !== ARTICLE_ID) throw new Error('Refusing to repair a different article')
  const article = await collection.findOne({ _id: articleId }, { projection: { title: 1, content: 1 } })
  if (!article) throw new Error(`Article ${ARTICLE_ID} was not found in the selected database`)
  const plan = planRepair(article.content)
  const result = { articleId: ARTICLE_ID, title: article.title, status: plan.status, apply, changes: plan.changes }
  if (!apply || !plan.changes.length) return result
  const update = await collection.updateOne(
    { _id: articleId, content: article.content },
    { $set: { content: plan.content } },
  )
  if (update.matchedCount !== 1 || update.modifiedCount !== 1) {
    throw new Error('The article changed after it was read; no repair was applied. Read it again and review a new preview.')
  }
  return { ...result, status: 'repaired' }
}

// The same planning/update functions run in mongosh and the local regression
// tests. Loading the module in Node never opens a database connection.
module.exports = { ARTICLE_ID, REPAIRS, planRepair, repairArticle }

if (require.main === module) {
  const args = process.argv.slice(2)
  if (args.length !== 2 || args[0] !== '--input') throw new Error('Offline preview only: node scripts/repair-issue-23-code-lines.cjs --input response.json')
  const fs = process.getBuiltinModule('node:fs')
  const crypto = process.getBuiltinModule('node:crypto')
  const payload = JSON.parse(fs.readFileSync(args[1], 'utf8'))
  const data = payload.data ?? payload
  const article = Array.isArray(data) ? data.find(item => item._id === ARTICLE_ID) : data
  if (article?._id !== ARTICLE_ID) throw new Error(`Input must contain article ${ARTICLE_ID}`)
  const plan = planRepair(article.content)
  console.log(JSON.stringify({ articleId: ARTICLE_ID, title: article.title, mode: 'offline-preview', status: plan.status,
    sourceSha256: crypto.createHash('sha256').update(article.content).digest('hex'), changes: plan.changes }, null, 2))
}
