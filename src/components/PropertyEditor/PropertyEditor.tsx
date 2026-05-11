import { useState, useRef } from 'react'
import { ColorPicker } from '../ColorPicker/ColorPicker'
import { TrashIcon, CheckIcon, PlusIcon } from '../Icons/Icons'
import {
  useHubProperties,
  addHubProperty,
  deleteHubProperty,
  renameHubProperty,
  addPropertyOption,
  deletePropertyOption,
  renamePropertyOption,
  updatePropertyOptionColor,
} from '../../hooks/useHubProperties'
import { CHART_COLORS } from '../../constants/colors'
import { PALETTE_OPTIONS } from '../../hooks/useChartPalette'
import styles from './PropertyEditor.module.css'

import type { HubProperty } from '../../types'

/** Reusable property block — renders a single property with its options */
function PropertyBlock({ prop, renamingPropertyId, renamingPropertyName, setRenamingPropertyId, setRenamingPropertyName, handleRenameProperty, addingOptionForId, setAddingOptionForId, newOptionLabel, setNewOptionLabel, handleAddOption, renamingOption, setRenamingOption, renamingOptionLabel, setRenamingOptionLabel, handleRenameOption, colorPickerFor, setColorPickerFor, colorAnchorRef }: {
  prop: HubProperty
  renamingPropertyId: number | null
  renamingPropertyName: string
  setRenamingPropertyId: (v: number | null) => void
  setRenamingPropertyName: (v: string) => void
  handleRenameProperty: (id: number) => void
  addingOptionForId: number | null
  setAddingOptionForId: (v: number | null) => void
  newOptionLabel: string
  setNewOptionLabel: (v: string) => void
  handleAddOption: (propertyId: number) => void
  renamingOption: { propertyId: number; value: string } | null
  setRenamingOption: (v: { propertyId: number; value: string } | null) => void
  renamingOptionLabel: string
  setRenamingOptionLabel: (v: string) => void
  handleRenameOption: () => void
  colorPickerFor: { propertyId: number; value: string } | null
  setColorPickerFor: (v: { propertyId: number; value: string } | null) => void
  colorAnchorRef: React.RefObject<HTMLButtonElement | null>
}) {
  return (
    <div className={styles.propertyBlock}>
      <div className={styles.propertyRow}>
        {renamingPropertyId === prop.id ? (
          <div className={styles.renameRow}>
            <input
              className={styles.inlineInput}
              type="text"
              value={renamingPropertyName}
              onChange={(e) => setRenamingPropertyName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleRenameProperty(prop.id!); if (e.key === 'Escape') setRenamingPropertyId(null) }}
              autoFocus
            />
            <button className={styles.confirmBtn} onClick={() => handleRenameProperty(prop.id!)}><CheckIcon /></button>
          </div>
        ) : (
          <span
            className={styles.propertyName}
            onClick={() => { setRenamingPropertyId(prop.id!); setRenamingPropertyName(prop.name) }}
          >
            {prop.name}
          </span>
        )}
        <button className={styles.deleteBtn} onClick={() => deleteHubProperty(prop.id!)} aria-label={`Delete ${prop.name}`}>
          <TrashIcon />
        </button>
      </div>

      <div className={styles.optionList}>
        {prop.options.map((opt) => (
          <div key={opt.value} className={styles.optionRow}>
            <div className={styles.colorDotWrapper}>
              <button
                className={styles.colorDot}
                style={{ background: opt.color ?? CHART_COLORS[0] }}
                ref={colorPickerFor?.propertyId === prop.id && colorPickerFor?.value === opt.value ? colorAnchorRef : undefined}
                onClick={(e) => {
                  if (colorPickerFor?.propertyId === prop.id && colorPickerFor?.value === opt.value) {
                    setColorPickerFor(null)
                  } else {
                    (colorAnchorRef as React.MutableRefObject<HTMLButtonElement | null>).current = e.currentTarget as HTMLButtonElement
                    setColorPickerFor({ propertyId: prop.id!, value: opt.value })
                  }
                }}
              />
              {colorPickerFor?.propertyId === prop.id && colorPickerFor?.value === opt.value && (
                <ColorPicker
                  colors={PALETTE_OPTIONS}
                  value={opt.color}
                  onChange={(color) => updatePropertyOptionColor(prop.id!, opt.value, color)}
                  onClose={() => setColorPickerFor(null)}
                  anchorRef={colorAnchorRef}
                />
              )}
            </div>
            {renamingOption?.propertyId === prop.id && renamingOption?.value === opt.value ? (
              <div className={styles.renameRow}>
                <input
                  className={styles.inlineInput}
                  type="text"
                  value={renamingOptionLabel}
                  onChange={(e) => setRenamingOptionLabel(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleRenameOption(); if (e.key === 'Escape') setRenamingOption(null) }}
                  autoFocus
                />
                <button className={styles.confirmBtn} onClick={handleRenameOption}><CheckIcon /></button>
              </div>
            ) : (
              <span
                className={styles.optionLabel}
                onClick={() => { setRenamingOption({ propertyId: prop.id!, value: opt.value }); setRenamingOptionLabel(opt.label) }}
              >
                {opt.label}
              </span>
            )}
            <button className={styles.deleteBtn} onClick={() => deletePropertyOption(prop.id!, opt.value)} aria-label={`Delete ${opt.label}`}>
              <TrashIcon />
            </button>
          </div>
        ))}

        {addingOptionForId === prop.id ? (
          <div className={styles.optionRow}>
            <input
              className={styles.inlineInput}
              type="text"
              value={newOptionLabel}
              onChange={(e) => setNewOptionLabel(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddOption(prop.id!); if (e.key === 'Escape') { setAddingOptionForId(null); setNewOptionLabel('') } }}
              placeholder="Option name"
              autoFocus
            />
            <button className={styles.confirmBtn} onClick={() => handleAddOption(prop.id!)}
              style={{ opacity: newOptionLabel.trim() ? 1 : 0.4, pointerEvents: newOptionLabel.trim() ? 'auto' : 'none' }}><CheckIcon /></button>
            <button className={styles.deleteBtn} onClick={() => { setAddingOptionForId(null); setNewOptionLabel('') }} aria-label="Cancel"><TrashIcon /></button>
          </div>
        ) : (
          <button className={styles.addOptionBtn} onClick={() => setAddingOptionForId(prop.id!)}>
            <PlusIcon size={12} /> Add option
          </button>
        )}
      </div>
    </div>
  )
}

/** Property editor content — reusable inside modals (e.g. PageForm step 2) */
export function PropertyEditorContent({ hubId }: { hubId: number }) {
  const allProperties = useHubProperties(hubId)
  const pageProperties = allProperties.filter((p) => !p.scope || p.scope === 'page')
  const feedbackProperties = allProperties.filter((p) => p.scope === 'feedback')

  // Editing state
  const [renamingPropertyId, setRenamingPropertyId] = useState<number | null>(null)
  const [renamingPropertyName, setRenamingPropertyName] = useState('')
  const [addingPropertyScope, setAddingPropertyScope] = useState<'page' | 'feedback' | null>(null)
  const [addingPropertyName, setAddingPropertyName] = useState('')
  const [addingOptionForId, setAddingOptionForId] = useState<number | null>(null)
  const [newOptionLabel, setNewOptionLabel] = useState('')
  const [renamingOption, setRenamingOption] = useState<{ propertyId: number; value: string } | null>(null)
  const [renamingOptionLabel, setRenamingOptionLabel] = useState('')
  const [colorPickerFor, setColorPickerFor] = useState<{ propertyId: number; value: string } | null>(null)
  const colorAnchorRef = useRef<HTMLButtonElement>(null)

  async function handleAddProperty() {
    if (!addingPropertyName.trim() || !addingPropertyScope) return
    await addHubProperty(hubId, addingPropertyName.trim(), addingPropertyScope)
    setAddingPropertyName('')
    setAddingPropertyScope(null)
  }

  async function handleRenameProperty(id: number) {
    if (!renamingPropertyName.trim()) { setRenamingPropertyId(null); return }
    await renameHubProperty(id, renamingPropertyName.trim())
    setRenamingPropertyId(null)
    setRenamingPropertyName('')
  }

  async function handleAddOption(propertyId: number) {
    if (!newOptionLabel.trim()) return
    await addPropertyOption(propertyId, newOptionLabel.trim())
    setNewOptionLabel('')
    setAddingOptionForId(null)
  }

  async function handleRenameOption() {
    if (!renamingOption || !renamingOptionLabel.trim()) { setRenamingOption(null); return }
    await renamePropertyOption(renamingOption.propertyId, renamingOption.value, renamingOptionLabel.trim())
    setRenamingOption(null)
    setRenamingOptionLabel('')
  }

  return (
    <div className={styles.container}>
      {/* Page Properties section */}
      <div className={styles.sectionHeader}>
        <span className={styles.sectionLabel}>Properties</span>
        <button className={styles.addButton} onClick={() => setAddingPropertyScope('page')} aria-label="Add property">
          <PlusIcon />
        </button>
      </div>

      <div className={styles.propertyList}>
        {pageProperties.map((prop) => (
          <PropertyBlock
            key={prop.id}
            prop={prop}
            renamingPropertyId={renamingPropertyId}
            renamingPropertyName={renamingPropertyName}
            setRenamingPropertyId={setRenamingPropertyId}
            setRenamingPropertyName={setRenamingPropertyName}
            handleRenameProperty={handleRenameProperty}
            addingOptionForId={addingOptionForId}
            setAddingOptionForId={setAddingOptionForId}
            newOptionLabel={newOptionLabel}
            setNewOptionLabel={setNewOptionLabel}
            handleAddOption={handleAddOption}
            renamingOption={renamingOption}
            setRenamingOption={setRenamingOption}
            renamingOptionLabel={renamingOptionLabel}
            setRenamingOptionLabel={setRenamingOptionLabel}
            handleRenameOption={handleRenameOption}
            colorPickerFor={colorPickerFor}
            setColorPickerFor={setColorPickerFor}
            colorAnchorRef={colorAnchorRef}
          />
        ))}

        {addingPropertyScope === 'page' && (
          <div className={styles.propertyRow}>
            <input
              className={styles.inlineInput}
              type="text"
              value={addingPropertyName}
              onChange={(e) => setAddingPropertyName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddProperty(); if (e.key === 'Escape') { setAddingPropertyScope(null); setAddingPropertyName('') } }}
              placeholder="Property name"
              autoFocus
            />
            <button className={styles.confirmBtn} onClick={handleAddProperty}
              style={{ opacity: addingPropertyName.trim() ? 1 : 0.4, pointerEvents: addingPropertyName.trim() ? 'auto' : 'none' }}><CheckIcon /></button>
            <button className={styles.deleteBtn} onClick={() => { setAddingPropertyScope(null); setAddingPropertyName('') }} aria-label="Cancel"><TrashIcon /></button>
          </div>
        )}
      </div>

      {/* Feedback Properties section */}
      <div className={styles.sectionHeader}>
        <span className={styles.sectionLabel}>Feedback</span>
        <button className={styles.addButton} onClick={() => setAddingPropertyScope('feedback')} aria-label="Add feedback property">
          <PlusIcon />
        </button>
      </div>

      <div className={styles.propertyList}>
        {feedbackProperties.map((prop) => (
          <PropertyBlock
            key={prop.id}
            prop={prop}
            renamingPropertyId={renamingPropertyId}
            renamingPropertyName={renamingPropertyName}
            setRenamingPropertyId={setRenamingPropertyId}
            setRenamingPropertyName={setRenamingPropertyName}
            handleRenameProperty={handleRenameProperty}
            addingOptionForId={addingOptionForId}
            setAddingOptionForId={setAddingOptionForId}
            newOptionLabel={newOptionLabel}
            setNewOptionLabel={setNewOptionLabel}
            handleAddOption={handleAddOption}
            renamingOption={renamingOption}
            setRenamingOption={setRenamingOption}
            renamingOptionLabel={renamingOptionLabel}
            setRenamingOptionLabel={setRenamingOptionLabel}
            handleRenameOption={handleRenameOption}
            colorPickerFor={colorPickerFor}
            setColorPickerFor={setColorPickerFor}
            colorAnchorRef={colorAnchorRef}
          />
        ))}

        {addingPropertyScope === 'feedback' && (
          <div className={styles.propertyRow}>
            <input
              className={styles.inlineInput}
              type="text"
              value={addingPropertyName}
              onChange={(e) => setAddingPropertyName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddProperty(); if (e.key === 'Escape') { setAddingPropertyScope(null); setAddingPropertyName('') } }}
              placeholder="Feedback property name"
              autoFocus
            />
            <button className={styles.confirmBtn} onClick={handleAddProperty}
              style={{ opacity: addingPropertyName.trim() ? 1 : 0.4, pointerEvents: addingPropertyName.trim() ? 'auto' : 'none' }}><CheckIcon /></button>
            <button className={styles.deleteBtn} onClick={() => { setAddingPropertyScope(null); setAddingPropertyName('') }} aria-label="Cancel"><TrashIcon /></button>
          </div>
        )}
      </div>
    </div>
  )
}
