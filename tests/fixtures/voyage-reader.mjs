// Deliberately long, in-memory content for reading-navigation browser tests.
// Enabled only by ARK_VERIFY_READER=1 in the isolated verification server.
export const readerImageResponse = '<svg xmlns="http://www.w3.org/2000/svg" width="960" height="600"><rect width="960" height="600" fill="#203447"/><path d="M0 300H960M480 0V600" stroke="#bf8650"/></svg>'

export function applyVoyageReaderFixture(article, backend) {
  const paragraph = 'The coast is quiet at this hour. We keep a record of ordinary details: a window lit across the water, the shape of a sentence, a page turned before dawn. A reader should be able to pause here and return without losing the place. These paragraphs deliberately create enough real text for a long, measurable reading surface.'
  const passage = Array.from({ length: 7 }, (_, index) => `${index + 1}. ${paragraph}`).join('\n\n')
  const content = [
    '## First bearing', passage,
    '### A quiet interval', passage,
    '```markdown\n## Not a real heading\n### Still just code\n```',
    `![Delayed chart](${backend}/reader-delayed.svg)`,
    '## First bearing', passage,
    '#### Pocket note', 'This small note belongs inside the third part of the voyage.',
    '## Landfall', passage,
  ].join('\n\n')
  return [
    { ...article, title: 'A reader’s four bearings', content },
    {
      ...article, _id: 'eeeeeeeeeeeeeeeeeeeeeeee', title: 'One short dispatch',
      content: 'A short dispatch without section headings. Its complete thought fits on a single screen.',
    },
    {
      ...article, _id: 'ffffffffffffffffffffffff', title: 'Twenty-eight stations, a close-set ending',
      content: [
        ...Array.from({ length: 20 }, (_, index) => `## Station ${index + 1}\n\n${paragraph}`),
        ...Array.from({ length: 8 }, (_, index) => `#### Closing note ${index + 1}\n\nA small detail worth keeping.`),
      ].join('\n\n'),
    },
    {
      ...article, _id: 'abababababababababababab', title: 'Code, without losing a line',
      content: [
        '## Code notes',
        '```ts\nfunction hello(name: string) {\n\tconst message = "你好, " + name\n\treturn message\n}\n\nconsole.log(hello("Ark"))\n```',
        '```中文\n记录：\n  保留缩进与换行。\n```',
        `\`\`\`\n<literal> & "quotes"\n\t${'wide_code_segment_'.repeat(22)}\n\`\`\``,
        '```\n```',
        '## A plain ending', 'The surrounding text and its anchors stay in place while code is copied.',
      ].join('\n\n'),
    },
  ]
}
