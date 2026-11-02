import styles from './fold-art.module.scss'

type FoldArtProps = { animated?: boolean; className?: string; variant?: 'monument' | 'portal' }

// An open, interrupted landscape. The large planes continue beyond the print;
// unprinted space connects the hanging architecture to the small traveller.
function Rift() {
  return <>
    <g className={styles.ground}>
      <path className={styles.mist} d="M55 919 693 858 1138 955 902 960 695 887 431 1000H40L600 888Z" />
      <path className={styles.slate} d="m55 919 638-61-310 92-224-7Z" />
      <path className={styles.carbon} d="m693 858 345 56 100 41-395-61-47-15-76 77-143 44H335l317-117Z" />
      <path className={styles.paper} d="m697 887 205 73 236-5-395-61Z" />
      <path className={styles.carbon} d="m40 1000 560-112-169 112H343l197-81-385 81Z" />
      <path className={styles.slate} d="m696 879-76 77 64 44H477Z" />
    </g>
    <g className={styles.far}>
      <path className={styles.mist} d="M133 0h121l184 206-37 155-184-91 11 141-72-68-28-151 169 65 21-54Z" />
      <path className={styles.slate} d="m133 0 185 203-21 54-87-163Z" />
      <path className={styles.carbon} d="m217 270 184 91-65 32-108-70v88Z" />
      <path className={styles.carbon} d="M1115 0h73l-114 321-113 118 71-197Z" />
      <path className={styles.mist} d="m1074 321 64 118-90 191-87-191Z" />
      <path className={styles.slate} d="m1138 439-90 191-22-83 65-142Z" />
    </g>
    <g className={styles.left}>
      <path className={styles.carbon} d="M264 0h116l115 172-72 205 90 140-107 79-123-193 48-155Z" />
      <path className={styles.mist} d="M380 0h51l110 153-46 19Z" />
      <path className={styles.slate} d="m495 172 46-19-54 204-64 20Z" />
      <path className={styles.mist} d="m423 377 64-20 92 129-66 31Z" />
      <path className={styles.slate} d="m513 517 66-31-70 115-103-5Z" />
      <path className={styles.paper} d="m310 41 16-6 52 139-39 128 24-133Z" />
      <path className={styles.carbon} d="m165 451 155 63 86 82-184-84-60 82 18-120Z" />
      <path className={styles.slate} d="m222 512 184 84-35 26-160-69Z" />
    </g>
    <g className={styles.right}>
      <path className={styles.slate} d="M904 0h193l-86 231-155 258 13 156-117 121-45-146 56-274Z" />
      <path className={styles.carbon} d="M904 0h91L822 335l-115 285 42-312Z" />
      <path className={styles.mist} d="m995 0 102 0-86 231-189 104Z" />
      <path className={styles.carbon} d="m822 335 34 154 13 156-117 121-8-214Z" />
      <path className={styles.mist} d="m856 489 74-59-19 165-42 50Z" />
      <path className={styles.paper} d="m1002 80-84 198-38 21 106-219Z" />
      <path className={styles.paper} d="m782 567 19-20-14 106-13 22Z" />
      <path className={styles.carbon} d="m930 430 76-54-16 92-56 77-23 50Z" />
    </g>
    <g className={styles.structure}>
      <path className={styles.carbon} d="M493 0h412L736 223l-91 190 99 139 8 214-100-75-74-128 31-158-107-140Z" />
      <path className={styles.slate} d="m493 0 9 265 107 140 36 8-86-176-4-237Z" />
      <path className={styles.mist} d="m645 413 91-190-30 201 38 128Z" />
      <path className={styles.slate} d="m609 405 36 8 99 139-92 139-74-128Z" />
      <path className={styles.carbon} d="m645 413 62 108-55 170-30-55 50-110Z" />
      <path className={styles.mist} d="m652 691 100 75-47-110 39-104Z" />
      <path className={styles.paper} d="m789 0-88 220-49 75 103-295Z" />
      <path className={styles.mist} d="m610 83 10-3-21 121-10 12Z" />
      <path className={styles.mist} d="m631 59 6-1-23 139-6 10Z" />
      <path className={styles.signal} d="m698 329-7 45-9 12 9-48Z" />
    </g>
    <g className={styles.visitor}>
      <path className={styles.carbon} d="m684 811 7-5 8 5 3 13-18 3Z" />
      <path className={styles.signal} d="m684 825 14-3 14 38-12-7-11 13-18-1Z" />
      <path className={styles.slate} d="m689 843-4 20 12-10 3-22Z" />
      <path className={styles.carbon} d="m686 860 7-3-1 24-6 2Zm10-3 6-4 6 27-5 1Z" />
      <path className={styles.paper} d="m687 826 4-1 2 13-4-2Z" />
      <path className={styles.signal} d="m682 827-9 15-13 4 16-1 11-11Z" />
    </g>
  </>
}

function Passage() {
  return <>
    <g className={styles.ground}>
      <path className={styles.mist} d="M15 1000 576 667h65l544 333Z" />
      <path className={styles.carbon} d="m576 667 36 20-219 313H87Z" />
      <path className={styles.paper} d="m612 687 24-20 228 333H393Z" />
      <path className={styles.slate} d="m636 667 549 333H864Z" />
    </g>
    <g className={styles.far}>
      <path className={styles.mist} d="M86 0h131l271 374 64 326-109 95L321 363Z" />
      <path className={styles.slate} d="M1110 0H992L744 367l-84 324 154 178 98-466Z" />
    </g>
    <g className={styles.left}>
      <path className={styles.carbon} d="M0 0h283l213 271 51 429-124 139-98-376L150 385 71 524Z" />
      <path className={styles.slate} d="M0 0h79l144 348 102 115-175-78-79 139Z" />
      <path className={styles.mist} d="m283 0 64 0 200 280v420l-51-429Z" />
      <path className={styles.paper} d="m223 172 97 89 107 335-102-133-30-169Z" />
      <path className={styles.mist} d="m427 596-44-282-63-53 107 335-102-133 98 376 47-66Z" />
      <path className={styles.carbon} d="m71 524 107 96 48 245-85 135L92 716Z" />
    </g>
    <g className={styles.right}>
      <path className={styles.carbon} d="M1200 0H928L759 289 681 704l140 164 99-386 167-114 53 195Z" />
      <path className={styles.mist} d="M928 0h-66L714 281l-33 423 78-415Z" />
      <path className={styles.slate} d="m1200 0-98 0-90 308-92 174 167-114 53 195Z" />
      <path className={styles.paper} d="m1027 135-79 196-67 144 35-190Z" />
      <path className={styles.mist} d="m881 475 39 7-99 386-50-111Z" />
      <path className={styles.slate} d="m1087 368-19 275-142 357 93-62 121-375Z" />
    </g>
    <g className={styles.structure}>
      <path className={styles.slate} d="m442 213 328 68-11 43-297-61Z" />
      <path className={styles.carbon} d="m462 263 297 61-10 33-282-58Z" />
      <path className={styles.mist} d="m492 362 222 25-8 37-204-27Z" />
      <path className={styles.carbon} d="m502 397 204 27-8 26-192-29Z" />
      <path className={styles.slate} d="m525 479 155 12-4 26-147-13Z" />
      <path className={styles.carbon} d="m529 504 147 13-4 21-141-12Z" />
    </g>
    <g className={styles.visitor}>
      <path className={styles.signal} d="m579 573 52-4-1 111-50 22Z" />
      <path className={styles.carbon} d="m588 583 43-14-1 111-24 9 2-100Z" />
      <path className={styles.signal} d="m580 702 26-13 125 311h-94Z" />
      <path className={styles.paper} d="m606 689 24-9 101 320Z" />
    </g>
  </>
}

export default function FoldArt({ animated = true, className = '', variant = 'monument' }: FoldArtProps) {
  return <svg className={`${styles.art} ${className}`} data-animated={animated} data-variant={variant}
    viewBox="0 0 1200 1000" fill="none" aria-hidden="true" focusable="false">
    <g className={styles.world}>{variant === 'portal' ? <Passage /> : <Rift />}</g>
  </svg>
}
