import { Show } from 'solid-js'
import type { InProgressOperation } from '@shared-types/domain'
import { t } from '../../../shared/lib'
import { confirmAbortOperation, operationBadgeText } from '../model/conflictOperation'

export function ConflictOperationControls(props: { operation: InProgressOperation }) {
  return (
    <span class="conflict-operation-controls">
      <span class="operation-badge">{t(operationBadgeText(props.operation.type))}</span>
      <Show when={props.operation.conflictCount > 0}>
        <span class="conflict-count">{t('{0} conflicts', props.operation.conflictCount)}</span>
      </Show>
      <button
        type="button"
        class="conflict-abort-btn"
        onClick={(event) => {
          event.stopPropagation()
          void confirmAbortOperation(props.operation.type)
        }}
      >
        {t('Abort')}
      </button>
    </span>
  )
}
