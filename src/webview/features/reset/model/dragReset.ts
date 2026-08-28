import { createSignal } from 'solid-js'
import { graphStore } from '../../../entities/graph'
import { shortHash, t } from '../../../shared/lib'
import { formDialog } from '../../../shared/ui'
import type { DragResetPlan } from '../lib/dragPlan'
import { hardWarning, modeField, runReset } from './reset'

/** 다이얼로그 리스트에 펼쳐 보여줄 최대 커밋 수 — 나머지는 "… and N more" */
const LIST_LIMIT = 10

const [plan, setPlanRaw] = createSignal<DragResetPlan | null>(null)

/**
 * drag-to-reset 미리보기 상태 (스펙 60-new-features §10).
 * 드래그 중 GraphView가 갱신하고, 확인 다이얼로그가 닫힐 때까지 유지된다 —
 * 다이얼로그와 그래프 하이라이트를 대조 확인할 수 있게 하기 위함.
 */
export const dragResetStore = {
  plan,
  setPlan: setPlanRaw,
  clear: () => setPlanRaw(null),
}

/**
 * 드래그 종료(mouseup) 시 호출 — 현재 plan으로 확인 다이얼로그를 띄우고,
 * 확인하면 target으로 git reset을 실행한다. 어느 쪽이든 닫히면 미리보기를 지운다.
 */
export async function confirmDragReset(): Promise<void> {
  const current = plan()
  if (!current || current.erased.length === 0) {
    dragResetStore.clear()
    return
  }
  const headBranch = graphStore.graph()?.headBranch ?? 'HEAD'
  try {
    const values = await formDialog({
      title: t('Reset — undo {0} commits', current.erased.length),
      note: t('These commits are removed from {0}:', headBranch),
      list: {
        items: current.erased.slice(0, LIST_LIMIT).map((c) => ({
          code: shortHash(c.hash),
          text: c.subject,
          mark: c.parents.length > 1 ? 'merge' : undefined,
        })),
        more: Math.max(0, current.erased.length - LIST_LIMIT),
        footer: t('→ new HEAD: {0} {1}', shortHash(current.target.hash), current.target.subject),
      },
      fields: [modeField()],
      confirmLabel: 'Reset',
      warning: hardWarning,
    })
    if (!values) return
    await runReset(current.target.hash, String(values.mode))
  } finally {
    dragResetStore.clear()
  }
}
