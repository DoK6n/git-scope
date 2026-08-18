import { createResource, createSignal, Show } from 'solid-js'
import { gravatarUrl } from '../../../shared/lib'

/** 작성자 프로필 사진 (Gravatar). 로드 실패(오프라인 등) 시 숨긴다 */
export function AuthorAvatar(props: { email: string; size?: number }) {
  const [failed, setFailed] = createSignal(false)
  const [url] = createResource(
    () => props.email,
    // 표시 크기의 2배로 요청해 레티나에서도 선명하게
    (email) => gravatarUrl(email, (props.size ?? 16) * 2),
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
