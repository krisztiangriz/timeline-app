import { Modal } from '../Modal/Modal'
import styles from './HelpModal.module.css'

interface HelpModalProps {
  open: boolean
  onClose: () => void
}

const SHORTCUTS = [
  {
    title: 'Text Formatting',
    items: [
      { label: 'Bold', keys: '⌘ B' },
      { label: 'Italic', keys: '⌘ I' },
      { label: 'Underline', keys: '⌘ U' },
    ],
  },
  {
    title: 'Text Styles',
    items: [
      { label: 'Title', keys: '⌃ 1' },
      { label: 'Heading', keys: '⌃ 2' },
      { label: 'Sub heading', keys: '⌃ 3' },
      { label: 'Body (reset)', keys: '⌃ 0' },
      { label: 'Monospaced', keys: '⌃ M' },
    ],
  },
  {
    title: 'Lists',
    items: [
      { label: 'Bullet list', keys: '⌃ 7' },
      { label: 'Dash list', keys: '⌃ 8' },
      { label: 'Numbered list', keys: '⌃ 9' },
    ],
  },
  {
    title: 'Editor',
    items: [
      { label: 'Insert link', keys: '⌃ K' },
      { label: 'Insert date', keys: '⌃ D' },
      { label: 'Indent', keys: 'Tab' },
      { label: 'Outdent', keys: '⇧ Tab' },
      { label: 'Checkbox', keys: '[ ]' },
    ],
  },
  {
    title: 'References',
    items: [
      { label: 'Mention colleague', keys: '@ ...' },
      { label: 'Mention project', keys: '# ...' },
    ],
  },
  {
    title: 'Global',
    items: [
      { label: 'Search', keys: '⌃ ⇧ K' },
      { label: 'Add feedback', keys: '⌃ ⇧ F' },
      { label: 'Close / deselect', keys: 'Esc' },
      { label: 'Confirm modal', keys: 'Enter' },
    ],
  },
]

export function HelpModal({ open, onClose }: HelpModalProps) {
  return (
    <Modal title="Help" open={open} onClose={onClose} hideFooter>
      <div className={styles.body}>
        {SHORTCUTS.map((group) => (
          <div key={group.title} className={styles.group}>
            <span className={styles.groupTitle}>{group.title}</span>
            {group.items.map((item) => (
              <div key={item.label} className={styles.row}>
                <kbd className={styles.kbd}>{item.keys}</kbd>
                <span className={styles.label}>{item.label}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </Modal>
  )
}
