import goToFileIcon from '../../assets/go-to-file.svg'

export function GoToFileIcon() {
  return (
    <span
      class="go-to-file-icon"
      style={{ '--go-to-file-icon': `url("${goToFileIcon}")` }}
      aria-hidden="true"
    />
  )
}
