'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Cake, Wine, Shirt, Camera, RefreshCcw, HeartHandshake, Pencil, Check } from 'lucide-react'

export type SelectedRule = { templateId: string; key: string; category: string; text: string }

type Template = {
  id: string
  category: string
  key: string
  title: string
  body_text: string
}

const CATEGORY_META: Record<string, { label: string; icon: typeof Cake; required?: boolean }> = {
  age:         { label: 'Age Restrictions', icon: Cake },
  byob:        { label: 'Food & Drink', icon: Wine },
  dress_code:  { label: 'Dress Code', icon: Shirt },
  photography: { label: 'Photography', icon: Camera },
  refund:      { label: 'Refund Policy', icon: RefreshCcw, required: true },
}

// behave_standard is always on and isn't user-toggleable (composition rule
// from the master plan); these are the only behavior chips the host picks
// from, and — unlike the single-select categories above — they can stack
// (newcomer-friendly + low-key aren't contradictory).
const BEHAVIOR_EXTRAS_LABEL = 'Behavior — extras'

export default function RulePicker({
  eventType,
  ageRestricted,
  value,
  onChange,
}: {
  eventType: 'casual' | 'social'
  ageRestricted: boolean
  value: SelectedRule[]
  onChange: (rules: SelectedRule[]) => void
}) {
  const [templates, setTemplates] = useState<Template[]>([])
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const autoSuggestedRef = useRef(false)

  useEffect(() => {
    supabase.from('rule_templates').select('id, category, key, title, body_text')
      .eq('active', true)
      .then(({ data }) => {
        setTemplates(data ?? [])
        setLoading(false)
      })
  }, [])

  // Auto-suggest "18+ only" the first time the host flips their age-restricted
  // toggle on, per the master plan's system-enforceable auto-suggest note.
  // Only runs once so it doesn't fight a host who deliberately picks a
  // different age rule afterward.
  useEffect(() => {
    if (!ageRestricted || autoSuggestedRef.current || templates.length === 0) return
    const already = value.some(r => r.category === 'age')
    if (already) return
    const age18 = templates.find(t => t.key === 'age_18')
    if (age18) {
      onChange([...value, { templateId: age18.id, key: age18.key, category: 'age', text: age18.body_text }])
      autoSuggestedRef.current = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ageRestricted, templates])

  if (loading) return null

  const byCategory = (cat: string) => templates.filter(t => t.category === cat && t.key !== 'behave_standard')
  const selectedInCategory = (cat: string) => value.filter(r => r.category === cat)

  const toggleSingleSelect = (t: Template) => {
    const isSelected = value.some(r => r.templateId === t.id)
    const withoutCategory = value.filter(r => r.category !== t.category)
    if (isSelected) {
      onChange(withoutCategory)
    } else {
      onChange([...withoutCategory, { templateId: t.id, key: t.key, category: t.category, text: t.body_text }])
    }
    setEditingKey(null)
  }

  const toggleMultiSelect = (t: Template) => {
    const isSelected = value.some(r => r.templateId === t.id)
    if (isSelected) {
      onChange(value.filter(r => r.templateId !== t.id))
    } else {
      onChange([...value, { templateId: t.id, key: t.key, category: t.category, text: t.body_text }])
    }
    setEditingKey(null)
  }

  const updateText = (templateId: string, text: string) => {
    onChange(value.map(r => (r.templateId === templateId ? { ...r, text } : r)))
  }

  const categories = ['age', 'byob', 'dress_code', 'photography', ...(eventType === 'social' ? ['refund'] : [])]

  return (
    <div className="space-y-5">
      {categories.map(cat => {
        const meta = CATEGORY_META[cat]
        const Icon = meta.icon
        const options = byCategory(cat)
        const selected = selectedInCategory(cat)[0]
        return (
          <div key={cat}>
            <label className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 mb-1.5">
              <Icon size={14} className="shrink-0" /> {meta.label}
              {meta.required && <span className="text-accent text-xs">· required</span>}
            </label>
            <div className="flex flex-wrap gap-2">
              {options.map(t => {
                const isSelected = value.some(r => r.templateId === t.id)
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => toggleSingleSelect(t)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition inline-flex items-center gap-1 ${
                      isSelected
                        ? 'bg-accent border-accent text-white'
                        : 'bg-white dark:bg-[#221c16] border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    {isSelected && <Check size={11} className="shrink-0" />} {t.title}
                  </button>
                )
              })}
            </div>
            {selected && (
              <div className="mt-1.5 flex items-start gap-1.5">
                {editingKey === selected.key ? (
                  <textarea
                    value={selected.text}
                    onChange={(e) => updateText(selected.templateId, e.target.value)}
                    onBlur={() => setEditingKey(null)}
                    autoFocus
                    rows={2}
                    className="w-full text-xs bg-white dark:bg-[#221c16] border border-gray-300 dark:border-gray-700 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-accent resize-none"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setEditingKey(selected.key)}
                    className="text-xs text-gray-500 dark:text-gray-400 hover:text-accent inline-flex items-center gap-1 text-left"
                  >
                    <Pencil size={11} className="shrink-0" /> {selected.text}
                  </button>
                )}
              </div>
            )}
          </div>
        )
      })}

      {/* Behavior extras — multi-select, stacks with the always-on behave_standard */}
      <div>
        <label className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 mb-1.5">
          <HeartHandshake size={14} className="shrink-0" /> {BEHAVIOR_EXTRAS_LABEL} <span className="text-gray-600 dark:text-gray-400">(optional)</span>
        </label>
        <div className="flex flex-wrap gap-2">
          {byCategory('behavior').map(t => {
            const isSelected = value.some(r => r.templateId === t.id)
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => toggleMultiSelect(t)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition inline-flex items-center gap-1 ${
                  isSelected
                    ? 'bg-accent border-accent text-white'
                    : 'bg-white dark:bg-[#221c16] border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400'
                }`}
              >
                {isSelected && <Check size={11} className="shrink-0" />} {t.title}
              </button>
            )
          })}
        </div>
        <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1.5">
          "Be cool" is included on every event automatically and can't be removed.
        </p>
      </div>
    </div>
  )
}
