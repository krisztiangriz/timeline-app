export function DragHandleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
      <path d="M6.75 15C6.338 15 5.984 14.853 5.691 14.559C5.397 14.266 5.25 13.912 5.25 13.5C5.25 13.088 5.397 12.734 5.691 12.441C5.984 12.147 6.338 12 6.75 12C7.162 12 7.516 12.147 7.809 12.441C8.103 12.734 8.25 13.088 8.25 13.5C8.25 13.912 8.103 14.266 7.809 14.559C7.516 14.853 7.162 15 6.75 15ZM11.25 15C10.838 15 10.484 14.853 10.191 14.559C9.897 14.266 9.75 13.912 9.75 13.5C9.75 13.088 9.897 12.734 10.191 12.441C10.484 12.147 10.838 12 11.25 12C11.662 12 12.016 12.147 12.309 12.441C12.603 12.734 12.75 13.088 12.75 13.5C12.75 13.912 12.603 14.266 12.309 14.559C12.016 14.853 11.662 15 11.25 15ZM6.75 10.5C6.338 10.5 5.984 10.353 5.691 10.059C5.397 9.766 5.25 9.412 5.25 9C5.25 8.588 5.397 8.234 5.691 7.941C5.984 7.647 6.338 7.5 6.75 7.5C7.162 7.5 7.516 7.647 7.809 7.941C8.103 8.234 8.25 8.588 8.25 9C8.25 9.412 8.103 9.766 7.809 10.059C7.516 10.353 7.162 10.5 6.75 10.5ZM11.25 10.5C10.838 10.5 10.484 10.353 10.191 10.059C9.897 9.766 9.75 9.412 9.75 9C9.75 8.588 9.897 8.234 10.191 7.941C10.484 7.647 10.838 7.5 11.25 7.5C11.662 7.5 12.016 7.647 12.309 7.941C12.603 8.234 12.75 8.588 12.75 9C12.75 9.412 12.603 9.766 12.309 10.059C12.016 10.353 11.662 10.5 11.25 10.5ZM6.75 6C6.338 6 5.984 5.853 5.691 5.559C5.397 5.266 5.25 4.912 5.25 4.5C5.25 4.088 5.397 3.734 5.691 3.441C5.984 3.147 6.338 3 6.75 3C7.162 3 7.516 3.147 7.809 3.441C8.103 3.734 8.25 4.088 8.25 4.5C8.25 4.912 8.103 5.266 7.809 5.559C7.516 5.853 7.162 6 6.75 6ZM11.25 6C10.838 6 10.484 5.853 10.191 5.559C9.897 5.266 9.75 4.912 9.75 4.5C9.75 4.088 9.897 3.734 10.191 3.441C10.484 3.147 10.838 3 11.25 3C11.662 3 12.016 3.147 12.309 3.441C12.603 3.734 12.75 4.088 12.75 4.5C12.75 4.912 12.603 5.266 12.309 5.559C12.016 5.853 11.662 6 11.25 6Z" fill="currentColor" />
    </svg>
  )
}

export function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
      <path d="M7.5 1.5L6.75 2.25H3V3.75H3.75V15C3.75 15.391 3.895 15.789 4.176 16.074C4.461 16.355 4.859 16.5 5.25 16.5H12.75C13.141 16.5 13.539 16.355 13.824 16.074C14.105 15.789 14.25 15.391 14.25 15V3.75H15V2.25H11.25L10.5 1.5H7.5ZM5.25 3.75H12.75V15H5.25V3.75ZM6.75 5.25V13.5H8.25V5.25H6.75ZM9.75 5.25V13.5H11.25V5.25H9.75Z" fill="currentColor" />
    </svg>
  )
}

export function CloseIcon({ size = 16 }: { size?: number }) {
  if (size === 10) {
    return (
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
        <path d="M2 2L8 8M8 2L2 8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    )
  }
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

export function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M3 8L6.5 11.5L13 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function PlusIcon({ size = 16 }: { size?: number }) {
  if (size === 12) {
    return (
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <path d="M6 2V10M2 6H10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    )
  }
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M8 3V13M3 8H13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

export function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10.5 10.5L13.5 13.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

export function ResetIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M12 20C14.2333 20 16.125 19.225 17.675 17.675C19.225 16.125 20 14.2333 20 12C20 9.76667 19.225 7.875 17.675 6.325C16.125 4.775 14.2333 4 12 4C10.85 4 9.75 4.2375 8.7 4.7125C7.65 5.1875 6.75 5.86667 6 6.75V4H4V11H11V9H6.8C7.33333 8.06667 8.0625 7.33333 8.9875 6.8C9.9125 6.26667 10.9167 6 12 6C13.6667 6 15.0833 6.58333 16.25 7.75C17.4167 8.91667 18 10.3333 18 12C18 13.6667 17.4167 15.0833 16.25 16.25C15.0833 17.4167 13.6667 18 12 18C10.7167 18 9.55833 17.6333 8.525 16.9C7.49167 16.1667 6.76667 15.2 6.35 14H4.25C4.71667 15.7667 5.66667 17.2083 7.1 18.325C8.53333 19.4417 10.1667 20 12 20Z" fill="currentColor" fillOpacity="0.7" />
    </svg>
  )
}

export function ArrowLeftIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M10 4.927L2.92709 11.9999L10 19.0676L11.5 17.5676L6.92709 12.9999H21V10.9999H6.92709L11.5 6.427L10 4.927Z" fill="currentColor" />
    </svg>
  )
}

export function ArrowRightIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M14 4.927L12.5 6.427L17.0677 10.9999H3V12.9999H17.0677L12.5 17.5676L14 19.0676L21.0677 11.9999L14 4.927Z" fill="currentColor" />
    </svg>
  )
}
