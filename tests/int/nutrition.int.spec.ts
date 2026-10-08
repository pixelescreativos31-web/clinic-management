import { describe, expect, it } from 'vitest'
import {
  EMPTY_NUTRITION,
  formToNutrition,
  isNutritionPractice,
  nutritionLines,
  nutritionToForm,
  waistHipRatio,
} from '@/lib/nutrition'

describe('nutrition template helpers', () => {
  it('parses numbers (comma decimals too) and drops blanks on create', () => {
    const out = formToNutrition({ ...EMPTY_NUTRITION, waistCm: '92,5', constipation: 'yes', goal: '  ' }, false)
    expect(out).toEqual({ waistCm: 92.5, constipation: 'yes' })
  })

  it('returns undefined on create when nothing was filled', () => {
    expect(formToNutrition({ ...EMPTY_NUTRITION }, false)).toBeUndefined()
  })

  it('clears emptied fields with null on update', () => {
    const out = formToNutrition({ ...EMPTY_NUTRITION, hipCm: '100' }, true)!
    expect(out.hipCm).toBe(100)
    expect(out.waistCm).toBeNull()
  })

  it('round-trips stored values through the form', () => {
    const form = nutritionToForm({ usualWeightKg: 80, anxiety: 'no' })
    expect(form.usualWeightKg).toBe('80')
    expect(form.anxiety).toBe('no')
    expect(form.goal).toBe('')
  })

  it('computes the waist/hip ratio and lists it with anthropometry', () => {
    expect(waistHipRatio({ waistCm: 80, hipCm: 100 })).toBe(0.8)
    expect(waistHipRatio({ waistCm: 80 })).toBeNull()
    const lines = nutritionLines({ waistCm: 80, hipCm: 100 }, 'antropometria')
    expect(lines).toContainEqual({ label: 'Relación cintura/cadera', value: '0.8' })
    expect(lines).toContainEqual({ label: 'Cintura', value: '80 cm' })
  })

  it('is enabled only for clinics on the nutrition template', () => {
    expect(isNutritionPractice({ settings: { consultTemplate: 'nutrition' } })).toBe(true)
    expect(isNutritionPractice({ settings: { consultTemplate: 'general' } })).toBe(false)
    expect(isNutritionPractice(null)).toBe(false)
  })
})
