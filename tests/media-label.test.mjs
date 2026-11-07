import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mediaFor, mediaLabel } from '../src/lib/blog.ts'

test('moment media and gallery responses share a label and preserve their storage filename', () => {
  for (const desc of ['海边的傍晚', '  ', undefined]) {
    const entry = { title: '这不是图片的名字', filenames: { 'stored.png': 'https://images.test/photo' }, filesDetail: { 'stored.png': { origin: '原始图片.png', desc } } }
    const [moment] = mediaFor(entry)
    const gallery = { filename: 'stored.png', originalName: '原始图片.png', desc }
    assert.equal(mediaLabel(moment), mediaLabel(gallery))
    assert.equal(moment.filename, 'stored.png')
  }
})
test('missing descriptions use filenames consistently without using a post title', () => {
  const [moment] = mediaFor({ title: 'A moment', filenames: { 'old.png': 'https://images.test/old' } })
  assert.equal(mediaLabel(moment), 'old.png')
  assert.equal(mediaLabel({ desc: ' ', originalName: ' ', filename: '' }, '预览'), '预览')
})
