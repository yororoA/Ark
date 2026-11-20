/* global db, ObjectId, print */
// Run from the Ark repository root. Preview is the default; the core module
// contains the reviewed replacements and the complete-content update guard.
// eslint-disable-next-line @typescript-eslint/no-require-imports -- mongosh supports CommonJS modules.
const { ARTICLE_ID, repairArticle } = require(process.cwd() + '/scripts/repair-issue-23-code-lines.cjs')
const setting = process.env.ARK_REPAIR_ISSUE23_APPLY
if (setting !== undefined && setting !== '0' && setting !== '1') throw new Error('ARK_REPAIR_ISSUE23_APPLY must be 0 or 1')
const result = await repairArticle(db.getCollection('articles'), { articleId: new ObjectId(ARTICLE_ID), apply: setting === '1' })
print(JSON.stringify({ database: db.getName(), ...result }, null, 2))
