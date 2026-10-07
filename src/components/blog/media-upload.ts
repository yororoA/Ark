'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import { request } from './blog-provider'

export type MediaUploadScope = 'moment' | 'gallery' | 'chat' | 'article'
export type UploadStatus = 'queued' | 'uploading' | 'processing' | 'done' | 'error'
export type UploadedAsset = {
  id: string
  scope: MediaUploadScope
  filename: string
  mime: string
  url: string
  bytes: number
  status: 'staged' | 'referenced'
}
export type ManagedUploadItem = {
  key: string
  uploadKey: string
  file?: File
  status: UploadStatus
  progress: number
  error?: string
  asset?: UploadedAsset
}

type UploadEnvelope = { success?: boolean; data?: UploadedAsset; message?: string; error?: string }

function fileFingerprint(file: File) {
  return `${file.name}:${file.size}:${file.lastModified}:${file.type}`
}

function newUploadKey() {
  const random = typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  return `media:${random}`
}

function uploadFile(
  item: ManagedUploadItem,
  scope: MediaUploadScope,
  update: (values: Partial<ManagedUploadItem>) => void,
) {
  if (!item.file) return Promise.reject(new Error('文件不可用，请重新选择'))
  return new Promise<UploadedAsset>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    const form = new FormData()
    form.append('scope', scope)
    form.append('file', item.file!)
    xhr.open('POST', '/api/blog/media/upload')
    xhr.timeout = 120_000
    xhr.setRequestHeader('X-Idempotency-Key', item.uploadKey)
    xhr.upload.addEventListener('progress', event => {
      if (!event.lengthComputable) return
      update({ status: 'uploading', progress: Math.min(100, Math.round((event.loaded / event.total) * 100)) })
    })
    xhr.upload.addEventListener('load', () => update({ status: 'processing', progress: 100 }))
    xhr.addEventListener('load', () => {
      let payload: UploadEnvelope | null = null
      try { payload = JSON.parse(xhr.responseText) as UploadEnvelope } catch { /* The status message below remains useful. */ }
      if (xhr.status === 401) window.dispatchEvent(new Event('ark:session-invalid'))
      if (xhr.status >= 200 && xhr.status < 300 && payload?.data) {
        update({ status: 'done', progress: 100, error: undefined, asset: payload.data })
        resolve(payload.data)
        return
      }
      const error = new Error(payload?.message || `上传失败 (${xhr.status || 'network'})`)
      update({ status: 'error', error: error.message })
      reject(error)
    })
    xhr.addEventListener('error', () => {
      const error = new Error('网络中断，文件未上传')
      update({ status: 'error', error: error.message })
      reject(error)
    })
    xhr.addEventListener('timeout', () => {
      const error = new Error('上传超时，可单独重试此文件')
      update({ status: 'error', error: error.message })
      reject(error)
    })
    xhr.send(form)
  })
}

export function useManagedUploads(scope: MediaUploadScope, concurrency = 4) {
  const [items, setItemsState] = useState<ManagedUploadItem[]>([])
  const itemsRef = useRef(items)
  const active = useRef(new Map<string, Promise<UploadedAsset>>())

  const setItems = useCallback((value: ManagedUploadItem[] | ((current: ManagedUploadItem[]) => ManagedUploadItem[])) => {
    const next = typeof value === 'function' ? value(itemsRef.current) : value
    itemsRef.current = next
    setItemsState(next)
  }, [])

  const updateItem = useCallback((key: string, values: Partial<ManagedUploadItem>) => {
    setItems(current => current.map(item => item.key === key ? { ...item, ...values } : item))
  }, [setItems])

  const setFiles = useCallback((files: File[]) => {
    const existing = new Map(itemsRef.current.filter(item => item.file).map(item => [item.key, item]))
    const remote = itemsRef.current.filter(item => !item.file)
    const next = files.map(file => {
      const key = fileFingerprint(file)
      return existing.get(key) || {
        key,
        uploadKey: newUploadKey(),
        file,
        status: 'queued' as const,
        progress: 0,
      }
    })
    const retained = new Set(next.map(item => item.key))
    for (const item of existing.values()) {
      if (!retained.has(item.key) && item.asset?.status === 'staged') {
        void request(`media/${item.asset.id}`, { method: 'DELETE' }).catch(() => {})
      }
    }
    setItems([...remote, ...next])
  }, [setItems])

  const uploadOne = useCallback((key: string) => {
    const pending = active.current.get(key)
    if (pending) return pending
    const item = itemsRef.current.find(candidate => candidate.key === key)
    if (!item) return Promise.reject(new Error('找不到待上传文件'))
    if (item.asset && item.status === 'done') return Promise.resolve(item.asset)
    updateItem(key, { status: 'uploading', progress: 0, error: undefined })
    const promise = uploadFile(item, scope, values => updateItem(key, values))
      .finally(() => active.current.delete(key))
    active.current.set(key, promise)
    return promise
  }, [scope, updateItem])

  const uploadAll = useCallback(async () => {
    const queue = itemsRef.current.filter(item => item.file && item.status !== 'done').map(item => item.key)
    const failures: Error[] = []
    let cursor = 0
    async function worker() {
      while (cursor < queue.length) {
        const key = queue[cursor++]
        try { await uploadOne(key) } catch (error) { failures.push(error as Error) }
      }
    }
    await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, worker))
    if (failures.length) throw new Error(failures[0].message)
    return itemsRef.current.flatMap(item => item.asset ? [item.asset] : [])
  }, [concurrency, uploadOne])

  const retry = useCallback((key: string) => uploadOne(key), [uploadOne])

  const remove = useCallback((key: string) => {
    const item = itemsRef.current.find(candidate => candidate.key === key)
    if (item?.asset?.status === 'staged') {
      void request(`media/${item.asset.id}`, { method: 'DELETE' }).catch(() => {})
    }
    setItems(current => current.filter(candidate => candidate.key !== key))
  }, [setItems])

  const restoreAssets = useCallback((assets: UploadedAsset[]) => {
    const local = itemsRef.current.filter(item => item.file)
    const restored = assets.map(asset => ({
      key: `asset:${asset.id}`,
      uploadKey: `restored:${asset.id}`,
      status: 'done' as const,
      progress: 100,
      asset,
    }))
    setItems([...restored, ...local])
  }, [setItems])

  const reset = useCallback(() => setItems([]), [setItems])
  const files = useMemo(() => items.flatMap(item => item.file ? [item.file] : []), [items])
  const assets = useMemo(() => items.flatMap(item => item.asset ? [item.asset] : []), [items])

  return {
    items,
    files,
    assets,
    isUploading: items.some(item => item.status === 'uploading' || item.status === 'processing'),
    hasFailures: items.some(item => item.status === 'error'),
    setFiles,
    uploadAll,
    retry,
    remove,
    restoreAssets,
    reset,
  }
}
