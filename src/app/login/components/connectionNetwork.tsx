'use client'

import { useEffect, useLayoutEffect, useRef } from 'react';
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
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;
const MAX_NETWORK_VIEWPORT_SCALE = 2;

interface ConnectionNetworkProps {
  onReady: () => void;
}

export default function ConnectionNetwork({ onReady }: ConnectionNetworkProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useIsoLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true });
    } catch {
      // The connection plate and progress remain usable without WebGL.
      canvas.dataset.renderer = 'unavailable';
      onReady();
      return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    const scene = new Scene();
    const camera = new PerspectiveCamera(38, 1, 0.1, 30);
    camera.position.z = 6;
    const geometry = new IcosahedronGeometry(1.35, 1);
    const wireframe = new WireframeGeometry(geometry);
    const primaryGeometry = new LineSegmentsGeometry();
    primaryGeometry.setPositions(new Float32Array(wireframe.getAttribute('position').array));
    const primaryMaterial = new LineMaterial({ color: 0xe8e76a, linewidth: 1.3, transparent: true, opacity: 0.82 });
    const secondaryMaterial = new LineBasicMaterial({ color: 0xd6d18a, transparent: true, opacity: 0.28 });
    const group = new Group();
    const outer = new LineSegments2(primaryGeometry, primaryMaterial);
    const inner = new LineSegments(wireframe, secondaryMaterial);
    inner.scale.setScalar(.9);
    group.add(outer, inner);

    const positions = geometry.getAttribute('position');
    const unique = new Map<string, number[]>();
    for (let index = 0; index < positions.count; index++) {
      const point = [positions.getX(index), positions.getY(index), positions.getZ(index)];
      unique.set(point.map(value => value.toFixed(4)).join(','), point);
    }
    const pointGeometry = new BufferGeometry();
    pointGeometry.setAttribute('position', new Float32BufferAttribute(
      [...unique.values()].flat(),
      3,
    ));
    const pointMaterial = new PointsMaterial({ color: 0xfffba1, size: 0.035, transparent: true, opacity: 0.9 });
    outer.add(new Points(pointGeometry, pointMaterial));
    scene.add(group);

    const resize = () => {
      // CSS stage transitions must not alter the camera's viewport calculation.
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (!width || !height) return;
      renderer.setSize(width, height, false);
      primaryMaterial.resolution.set(width, height);
      camera.aspect = width / height;
      const viewportScale = Math.min(width / 960, height / 540);
      const oversizeScale = Math.max(1, viewportScale / MAX_NETWORK_VIEWPORT_SCALE);
      camera.position.z = 6.9 * Math.max(1, .565 * height / width, oversizeScale);
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();
    canvas.dataset.renderer = 'ready';
    onReady();

    let frame = 0;
    const startedAt = performance.now();
    const render = (now: number) => {
      const elapsed = (now - startedAt) / 1000;
      outer.rotation.set(0.23 + elapsed * 0.19, elapsed * 0.42, 0.12);
      inner.rotation.set(-0.35 - elapsed * 0.3, -elapsed * 0.24, 0.7);
      renderer.render(scene, camera);
      if (!document.hidden) frame = requestAnimationFrame(render);
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
      primaryGeometry.dispose();
      pointGeometry.dispose();
      primaryMaterial.dispose();
      secondaryMaterial.dispose();
      pointMaterial.dispose();
      renderer.dispose();
    };
  }, [onReady]);

  return <canvas ref={canvasRef} data-testid="connection-network" aria-hidden="true" />;
}
