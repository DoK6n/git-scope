import { graphStore } from '../../../entities/graph'
import { request } from '../../../shared/api'
import { formDialog } from '../../../shared/ui'

/** 브랜치/커밋을 현재 브랜치로 merge */
export async function mergeInto(target: string): Promise<void> {
  const repo = graphStore.currentRepo()
  if (!repo) return
  const headBranch = graphStore.graph()?.headBranch ?? 'current branch'
  const values = await formDialog({
    title: `Merge ${target} into ${headBranch}`,
    fields: [
      {
        kind: 'radio',
        name: 'mode',
        label: 'Merge mode',
        options: [
          { value: 'default', label: 'Default', hint: 'fast-forward 가능하면 ff' },
          { value: 'no-ff', label: 'No fast-forward', hint: '항상 merge 커밋 생성' },
          { value: 'squash', label: 'Squash', hint: '변경만 가져오고 커밋은 직접' },
        ],
        initial: 'default',
      },
    ],
    confirmLabel: 'Merge',
  })
  if (!values) return
  await graphStore.runAction(
    request('merge', {
      repo,
      target,
      noFf: values.mode === 'no-ff',
      squash: values.mode === 'squash',
    }),
  )
}
