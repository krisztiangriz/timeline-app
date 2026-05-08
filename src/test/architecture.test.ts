import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'

/**
 * Architectural constraints for the onboarding system.
 *
 * These tests enforce that performance-sensitive components never directly
 * consume the onboarding context, preventing re-render cascades that could
 * cause cursor loss or keystroke drops in contentEditable editors.
 *
 * PATTERN: The parent component (e.g., BlockRenderer, TimelineView) should
 * own the anchor ref and render <OnboardingGuide> as a sibling — NOT inside
 * RichTextEditor.
 */

const RICH_TEXT_EDITOR_DIR = join(__dirname, '../components/RichTextEditor')

describe('Architectural constraints', () => {
  describe('RichTextEditor must NOT import useOnboardingGuides', () => {
    it('no file in RichTextEditor/ imports useOnboardingGuides', () => {
      const files = readdirSync(RICH_TEXT_EDITOR_DIR)
        .filter((f) => f.endsWith('.tsx') || f.endsWith('.ts'))

      for (const file of files) {
        const content = readFileSync(join(RICH_TEXT_EDITOR_DIR, file), 'utf-8')
        expect(
          content.includes('useOnboardingGuides'),
          `${file} must NOT import useOnboardingGuides — see architectural note in this test file`
        ).toBe(false)
      }
    })

    it('no file in RichTextEditor/ imports OnboardingGuide component', () => {
      const files = readdirSync(RICH_TEXT_EDITOR_DIR)
        .filter((f) => f.endsWith('.tsx') || f.endsWith('.ts'))

      for (const file of files) {
        const content = readFileSync(join(RICH_TEXT_EDITOR_DIR, file), 'utf-8')
        expect(
          content.includes('OnboardingGuide'),
          `${file} must NOT import OnboardingGuide — render it from the parent component instead`
        ).toBe(false)
      }
    })
  })
})
