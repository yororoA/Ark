'use client'

import { useEffect, useRef } from 'react';
import {
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  IcosahedronGeometry,
  LineBasicMaterial,
  LineSegments,
  PerspectiveCamera,
  Points,
  PointsMaterial,
  Scene,
  WebGLRenderer,
  WireframeGeometry,
} from 'three';

export default function ConnectionNetwork({ reducedMotion }: { reducedMotion: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true });
    } catch {
      // The connection plate and progress remain usable without WebGL.
      canvas.dataset.renderer = 'unavailable';
      return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    const scene = new Scene();
    const camera = new PerspectiveCamera(38, 1, 0.1, 30);
    camera.position.z = 6;
    const geometry = new IcosahedronGeometry(1.35, 1);
    const wireframe = new WireframeGeometry(geometry);
    const primaryMaterial = new LineBasicMaterial({ color: 0xe8e76a, transparent: true, opacity: 0.78 });
    const secondaryMaterial = new LineBasicMaterial({ color: 0xc5bb5e, transparent: true, opacity: 0.3 });
    const group = new Group();
    const outer = new LineSegments(wireframe, primaryMaterial);
    const inner = new LineSegments(wireframe, secondaryMaterial);
    inner.scale.setScalar(0.9);
    group.add(outer, inner);

    const positions = geometry.getAttribute('position');
    const unique = new Map<string, number[]>();
    for (let index = 0; index < positions.count; index++) {
      const point = [positions.getX(index), positions.getY(index), positions.getZ(index)];
      unique.set(point.map(value => value.toFixed(4)).join(','), point);
    }
    const pointGeometry = new BufferGeometry();
    pointGeometry.setAttribute('position', new Float32BufferAttribute([...unique.values()].flat(), 3));
    const pointMaterial = new PointsMaterial({ color: 0xfffba1, size: 0.025, transparent: true, opacity: 0.9 });
    outer.add(new Points(pointGeometry, pointMaterial));
    scene.add(group);

    const resize = () => {
      const { width, height } = canvas.getBoundingClientRect();
      if (!width || !height) return;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.position.z = 6 * Math.max(1, height / width, height / 680);
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();
    canvas.dataset.renderer = 'ready';

    let frame = 0;
    const startedAt = performance.now();
    const render = (now: number) => {
      const elapsed = reducedMotion ? 0 : (now - startedAt) / 1000;
      outer.rotation.set(0.23 + elapsed * 0.19, elapsed * 0.42, 0.12);
      inner.rotation.set(-0.35 - elapsed * 0.3, -elapsed * 0.24, 0.7);
      renderer.render(scene, camera);
      if (!reducedMotion && !document.hidden) frame = requestAnimationFrame(render);
    };
    const onVisibility = () => {
      cancelAnimationFrame(frame);
      if (!document.hidden) render(performance.now());
    };
    document.addEventListener('visibilitychange', onVisibility);
    render(startedAt);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      geometry.dispose();
      wireframe.dispose();
      pointGeometry.dispose();
      primaryMaterial.dispose();
      secondaryMaterial.dispose();
      pointMaterial.dispose();
      renderer.dispose();
    };
  }, [reducedMotion]);

  return <canvas ref={canvasRef} data-testid="connection-network" aria-hidden="true" />;
}
