import { createResource, createSignal, Show } from 'solid-js'
import { fetchAvatar, letterColor } from '../model/avatars'

/**
 * 작성자 프로필 사진 — GitHub(host 캐시) 우선, Gravatar 폴백.
 * 이미지를 못 구하거나 로드에 실패하면 이니셜 원형으로 표시한다 (빈 자리 없음).
 */
export function AuthorAvatar(props: {
  repo: string
  name: string
  email: string
  commitHash: string
  size?: number
  /** co-author 여부 — GitHub 커밋 API 대신 Gravatar/번들 아이콘만 사용 */
  isCoAuthor?: boolean
}) {
  const [failed, setFailed] = createSignal(false)
  const [url] = createResource(
    () => ({
      repo: props.repo,
      name: props.name,
      email: props.email,
      hash: props.commitHash,
      size: props.size ?? 16,
      viaGitHub: !props.isCoAuthor,
    }),
    (source) =>
      fetchAvatar(source.repo, source.name, source.email, source.hash, source.size, source.viaGitHub),
  )

  const initial = () => (props.name.trim()[0] ?? props.email[0] ?? '?').toUpperCase()

  return (
    <Show
      when={!failed() && !url.error && url()}
      fallback={
        <span
          class="author-avatar author-avatar-letter"
          style={{ background: letterColor(props.email) }}
        >
          {initial()}
        </span>
      }
    >
      <img
        class="author-avatar"
        src={url()!}
        width={props.size ?? 16}
        height={props.size ?? 16}
        alt=""
        title={`${props.name} <${props.email}>`}
        loading="lazy"
        onError={() => setFailed(true)}
      />
    </Show>
  )
}
