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
}) {
  const [failed, setFailed] = createSignal(false)
  const [url] = createResource(
    () => ({
      repo: props.repo,
      email: props.email,
      hash: props.commitHash,
      size: props.size ?? 16,
    }),
    (source) => fetchAvatar(source.repo, source.email, source.hash, source.size),
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
        loading="lazy"
        onError={() => setFailed(true)}
      />
    </Show>
  )
}
