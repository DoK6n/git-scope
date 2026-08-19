/** 그래프 레인·뱃지·이니셜 아바타가 공유하는 브랜치 색상 팔레트 (app/styles.css의 .color-N과 동일) */
export const BRANCH_PALETTE = [
  '#4e9de6',
  '#d9699e',
  '#53c17f',
  '#d9a03f',
  '#9d78d9',
  '#4fc3c3',
  '#d96c57',
  '#a8b840',
] as const

/** 문자열 해시 → 팔레트 색상. 같은 이름은 항상 같은 색 */
export function hashColor(text: string): string {
  let hash = 0
  for (let i = 0; i < text.length; i++) hash = (hash * 31 + text.charCodeAt(i)) | 0
  return BRANCH_PALETTE[Math.abs(hash) % BRANCH_PALETTE.length]!
}
