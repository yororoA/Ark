# 夜航海面雕版素材

制作方式：内置 `image_gen`，未使用 CLI/API 回退。生成后仅通过 Sharp 进行尺寸适配和 WebP 格式压缩，未更改画面内容。

项目素材：

- `public/themes/voyage/ocean-engraving.webp` — 1672 × 941，370,910 bytes，桌面原尺寸。
- `public/themes/voyage/ocean-engraving-900.webp` — 900 × 507，92,210 bytes，手机。
- `public/themes/voyage/ocean-engraving-520.webp` — 520 × 293，28,558 bytes，静态缩略图。

主画面是密刻浪纹和大片夜空，远岸灯塔只保留一个极小朱红信号。文字和导航由页面独立排版，不烧录进图。

最终提示词：

```text
Use case: stylized-concept.
Asset type: full-bleed illustration for an original literary website named Night Voyage. Generate a finished image asset, not a website mockup.
A vast nocturnal sea rendered as a remarkably intricate drypoint engraving and black-ink woodcut. Elevated shore-side viewpoint across the open ocean. Dense, flowing, anatomically convincing engraved silver-white wave crests and curling foam occupy the lower half and sweep diagonally toward the right. Thousands of hand-cut, irregular hairline strokes articulate the restless water, with deep areas of ink between them. In the far upper-right, a very small, distant coastal beacon on a sheer black rocky headland, just a tiny vermilion red slit of light. The lighthouse is a distant architectural accent occupying less than 4 percent of the image, never a cartoon icon. Upper-left half is almost empty ink-black night, with just sparse scratched horizon wisps, suitable for huge typography to be added later.
Composition: wide landscape 16:9, 2048x1152 if possible. Horizon in upper third, dramatic wave detail in bottom/right. Refined asymmetry and large negative space, the craftsmanship of a museum print or serious literary magazine cover. Restrained ink black #0b151c, slate black, warm ivory engraved lines. Only one small vermilion red light; no other colors.
Texture: fine dense intaglio hatching, subtle matte paper tooth, highly intentional strokes, no fake aged stains. Mood is immense, unsettling and quietly beautiful.
Absolutely no words, letters, typography, text, watermark, logo, compass, radar, circles, diagrams, interface, frame or border. No moon, stars, sailing ships, flat-vector geometry, cartoon style, 3D rendering, photography, blue gradients, glossy light beams, smooth digital painting or fantasy scenery.
```
