import { readFile, readdir, stat } from 'node:fs/promises'
import { gzipSync } from 'node:zlib'
import path from 'node:path'

const root = process.cwd()
const nextDirectory = path.join(root, '.next')
const manifestDirectory = path.join(nextDirectory, 'server', 'app')
const budgets = JSON.parse(await readFile(path.join(root, 'performance-budgets.json'), 'utf8'))
const imageExtensions = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.avif'])

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  return (await Promise.all(entries.map(entry => {
    const target = path.join(directory, entry.name)
    return entry.isDirectory() ? walk(target) : [target]
  }))).flat()
}

function routeName(manifestPath) {
  const relative = path.relative(manifestDirectory, manifestPath)
    .replace(/\/page_client-reference-manifest\.js$/, '')
    .replaceAll(path.sep, '/')
    .replace(/^\/?\([^/]+\)\//, '/')
  return relative === 'page_client-reference-manifest.js' ? '/' : `/${relative.replace(/\/page$/, '')}`
    .replace(/^\/+/, '/')
}

async function assetMetrics(files) {
  let rawBytes = 0
  let gzipBytes = 0
  for (const file of files) {
    const contents = await readFile(path.join(nextDirectory, file))
    rawBytes += contents.length
    gzipBytes += gzipSync(contents).length
  }
  return { rawBytes, gzipBytes }
}

let manifests
try {
  manifests = (await walk(manifestDirectory)).filter(file => file.endsWith('page_client-reference-manifest.js'))
} catch {
  console.error('Build output is missing. Run `npm run build` before checking budgets.')
  process.exit(1)
}

const routes = []
for (const manifestPath of manifests) {
  const source = await readFile(manifestPath, 'utf8')
  const assignment = source.lastIndexOf(' = ')
  const terminator = source.lastIndexOf(';')
  if (assignment < 0 || terminator < assignment) throw new Error(`Cannot parse ${manifestPath}`)
  const manifest = JSON.parse(source.slice(assignment + 3, terminator))
  const jsFiles = [...new Set(Object.values(manifest.entryJSFiles || {}).flat())]
  const cssFiles = [...new Set(Object.values(manifest.entryCSSFiles || {}).flatMap(files => files.map(file => file.path)))]
  routes.push({
    route: routeName(manifestPath),
    requestCount: jsFiles.length + cssFiles.length,
    ...(await assetMetrics(jsFiles)),
  })
}

const publicFiles = await walk(path.join(root, 'public'))
const images = []
for (const file of publicFiles) {
  if (!imageExtensions.has(path.extname(file).toLowerCase())) continue
  images.push({ file: path.relative(root, file), bytes: (await stat(file)).size })
}

const failures = []
for (const route of routes) {
  if (route.rawBytes > budgets.routeJsRawKb * 1024) failures.push(`${route.route}: JS raw ${Math.ceil(route.rawBytes / 1024)} KB`)
  if (route.gzipBytes > budgets.routeJsGzipKb * 1024) failures.push(`${route.route}: JS gzip ${Math.ceil(route.gzipBytes / 1024)} KB`)
  if (route.requestCount > budgets.firstLoadAssetRequests) failures.push(`${route.route}: ${route.requestCount} first-load JS/CSS requests`)
}
for (const image of images) {
  if (image.bytes > budgets.publicImageMaxKb * 1024) failures.push(`${image.file}: ${Math.ceil(image.bytes / 1024)} KB image`)
}
const imageBytes = images.reduce((total, image) => total + image.bytes, 0)
if (imageBytes > budgets.publicImagesTotalKb * 1024) {
  failures.push(`public images: ${Math.ceil(imageBytes / 1024)} KB total`)
}

const largestRoute = [...routes].sort((a, b) => b.gzipBytes - a.gzipBytes)[0]
const mostRequests = [...routes].sort((a, b) => b.requestCount - a.requestCount)[0]
const largestImage = [...images].sort((a, b) => b.bytes - a.bytes)[0]
console.log(`budget  JS ${Math.ceil(largestRoute.gzipBytes / 1024)}/${budgets.routeJsGzipKb} KB gzip (${largestRoute.route})`)
console.log(`budget  requests ${mostRequests.requestCount}/${budgets.firstLoadAssetRequests} (${mostRequests.route})`)
console.log(`budget  images ${Math.ceil(imageBytes / 1024)}/${budgets.publicImagesTotalKb} KB; max ${Math.ceil(largestImage.bytes / 1024)}/${budgets.publicImageMaxKb} KB`)

if (failures.length) {
  console.error(`Budget exceeded:\n${failures.map(failure => `- ${failure}`).join('\n')}`)
  process.exit(1)
}
