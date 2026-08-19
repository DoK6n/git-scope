import { graphStore } from '../../../entities/graph'
import { request } from '../../../shared/api'
import { confirmDialog, formDialog } from '../../../shared/ui'

/** 특정 커밋에 태그 생성 (lightweight 또는 annotated) */
export async function createTagAt(hash: string): Promise<void> {
  const repo = graphStore.currentRepo()
  if (!repo) return
  const values = await formDialog({
    title: `Create Tag at ${hash.slice(0, 8)}`,
    fields: [
      { kind: 'text', name: 'name', label: 'Tag name', placeholder: 'v1.0.0' },
      { kind: 'checkbox', name: 'annotated', label: 'Annotated tag', initial: false },
      { kind: 'text', name: 'message', label: 'Message (annotated일 때)', initial: '' },
    ],
    confirmLabel: 'Create',
  })
  if (!values || String(values.name).trim() === '') return
  await graphStore.runAction(
    request('createTag', {
      repo,
      name: String(values.name).trim(),
      at: hash,
      message: values.annotated ? String(values.message) : null,
    }),
  )
}

/** 태그 상세 정보 (annotated: tagger·메시지) */
export async function viewTagDetails(name: string): Promise<void> {
  const repo = graphStore.currentRepo()
  if (!repo) return
  try {
    const d = await request('getTagDetails', { repo, name })
    const lines = [
      `Tag: ${d.name}${d.isAnnotated ? ' (annotated)' : ' (lightweight)'}`,
      `Commit: ${d.hash}`,
      ...(d.tagger ? [`Tagger: ${d.tagger} <${d.taggerEmail ?? ''}>`] : []),
      ...(d.taggerDate
        ? [`Date: ${new Date(d.taggerDate * 1000).toLocaleString()}`]
        : []),
      ...(d.message ? ['', d.message] : []),
    ]
    await confirmDialog({ title: 'Tag Details', message: lines.join('\n'), confirmLabel: 'OK' })
  } catch (e) {
    graphStore.setError(e instanceof Error ? e.message : String(e))
  }
}

/** 태그 삭제 */
export async function deleteTag(name: string): Promise<void> {
  const repo = graphStore.currentRepo()
  if (!repo) return
  const ok = await confirmDialog({
    title: 'Delete Tag',
    message: `태그 "${name}"을(를) 삭제할까요?`,
    confirmLabel: 'Delete',
    danger: true,
  })
  if (!ok) return
  await graphStore.runAction(request('deleteTag', { repo, name }))
}
