import { useRef, useEffect } from 'react'

type MousePosition = {
  x: number
  y: number
}

export function useMouse() {
  const mouse = useRef<MousePosition>({
    x: 0,
    y: 0,
  });

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      mouse.current = {
        x: e.clientX,
        y: e.clientY,
      }
      // console.log(mouse.current)
    }


    window.addEventListener('mousemove', handler);
    return () => {
      window.removeEventListener('mousemove', handler);
    }
  }, [])

  return mouse;
}