'use client'

import { useState, useEffect } from 'react'
import { getLocation } from '@/app/actions/getLocation'
import type { IPinfoLite } from 'node-ipinfo/dist/src/common'

export function useGetLocation(): IPinfoLite | null {
  const [location, setLocation] = useState<IPinfoLite | null>(null)

  useEffect(() => {
    let isMounted = true
    getLocation().then((loc) => {
      if (!isMounted) return;
      // todo: toast 提示用户 IP 定位失败
      if ('bogon' in loc && loc.bogon) return;
      setLocation(loc as IPinfoLite)
    })
    return () => {
      isMounted = false
    }
  }, [])

  console.log(location)
  return location
}
