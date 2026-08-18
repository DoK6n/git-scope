import { createResource, createSignal, Show } from 'solid-js'
import { fetchAvatar } from '../model/avatars'

/**
 * 작성자 프로필 사진 — GitHub(host 캐시) 우선, Gravatar 폴백.
 * 로드 실패(오프라인 등) 시 숨긴다.
 */
export function AuthorAvatar(props: {
  repo: string
  email: string
  commitHash: string
  size?: number
}) {
  const [failed, setFailed] = createSignal(false)
  const [url] = createResource(
    () => ({ repo: props.repo, email: props.email, hash: props.commitHash }),
    (source) => fetchAvatar(source.repo, source.email, source.hash, props.size ?? 16),
  )

  return (
    <Show when={!failed() && url()}>
      <img
        class="author-avatar"
        src={url()}
        width={props.size ?? 16}
        height={props.size ?? 16}
        alt=""
        loading="lazy"
        onError={() => setFailed(true)}
      />
    </Show>
  )
}
