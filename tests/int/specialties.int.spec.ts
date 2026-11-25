import { describe, expect, it } from 'vitest'
import { emptySheet, fieldKeys, formToSheet, parseSheetNumber, sheetLines, sheetPayloadFields, sheetToForm, type SheetFieldDef } from '@/lib/sheet'
import { MASSAGE_FIELDS, MASSAGE_KEYS } from '@/lib/massage'
import { formatsFor, initialFormat } from '@/lib/profiles'
import { ORG_TYPES, SPECIALTIES, asOrgType, asSpecialty, orgTypeOf, profileForSignup, specialtiesFor } from '@/lib/specialties'

// Pure suite (no database): the generic sheet engine and the two profile axes.

const EYE_FIELDS: SheetFieldDef[] = [
  { key: 'iop', label: 'PIO', kind: 'number', group: 'exam', unit: 'mmHg', min: 0, max: 80, eyes: true },
  { key: 'va', label: 'AV sin corrección', kind: 'select', group: 'exam', eyes: true, options: [{ value: '20/20', label: '20/20' }, { value: '20/40', label: '20/40' }] },
  { key: 'notes', label: 'Notas', kind: 'long', group: 'exam' },
]

describe('sheet engine — per-eye fields', () => {
  it('expands an eye field into OD/OI keys and schema fields', () => {
    expect(fieldKeys(EYE_FIELDS[0])).toEqual(['iopOD', 'iopOI'])
    expect(Object.keys(emptySheet(EYE_FIELDS))).toEqual(['iopOD', 'iopOI', 'vaOD', 'vaOI', 'notes'])
    const names = sheetPayloadFields(EYE_FIELDS).map((f) => ('name' in f ? f.name : ''))
    expect(names).toEqual(['iopOD', 'iopOI', 'vaOD', 'vaOI', 'notes'])
  })

  it('validates each eye on its own (one bad eye never drops the other)', () => {
    const out = formToSheet(EYE_FIELDS, { ...emptySheet(EYE_FIELDS), iopOD: '15,5', iopOI: '120', vaOD: '20/40', vaOI: '20/15' }, false)
    expect(out).toEqual({ iopOD: 15.5, vaOD: '20/40' })
  })

  it('clears both eyes on update when emptied, and round-trips', () => {
    const cleared = formToSheet(EYE_FIELDS, emptySheet(EYE_FIELDS), true)!
    expect(cleared).toMatchObject({ iopOD: null, iopOI: null, vaOD: null, vaOI: null, notes: null })
    const stored = { iopOD: 14, iopOI: 22, vaOD: '20/20' }
    expect(formToSheet(EYE_FIELDS, sheetToForm(EYE_FIELDS, stored), false)).toEqual(stored)
  })

  it('reads per-eye lines as «OD … · OI …» and skips empty fields', () => {
    expect(sheetLines(EYE_FIELDS, { iopOD: 14, iopOI: 22, vaOI: '20/40' })).toEqual([
      { label: 'PIO', value: 'OD 14 mmHg · OI 22 mmHg' },
      { label: 'AV sin corrección', value: 'OI 20/40' },
    ])
    expect(sheetLines(EYE_FIELDS, {})).toEqual([])
  })

  it('parses numbers strictly within range', () => {
    const f = { min: 0, max: 10 }
    expect(parseSheetNumber(' 4 ', f)).toBe(4)
    expect(parseSheetNumber('4,5', f)).toBe(4.5)
    expect(parseSheetNumber('11', f)).toBeUndefined()
    expect(parseSheetNumber('-1', f)).toBeUndefined()
    expect(parseSheetNumber('1e1', f)).toBeUndefined() // no scientific notation from a keyboard
    expect(parseSheetNumber('4 kg', f)).toBeUndefined()
    expect(parseSheetNumber('', f)).toBeUndefined()
    expect(parseSheetNumber('3.14159', { step: 2 })).toBe(3.14)
  })

  it('drops duplicate and unknown multi options and impossible dates', () => {
    const out = formToSheet(MASSAGE_FIELDS, { ...emptySheet(MASSAGE_FIELDS), services: ['reducing', 'reducing', 'x'], surgeryDate: '2026-02-30' }, false)
    expect(out).toEqual({ services: ['reducing'] })
  })
})

describe('massage sheet on the engine keeps its stored schema', () => {
  it('generates exactly the historical keys (no data migration)', () => {
    const names = sheetPayloadFields(MASSAGE_FIELDS).map((f) => ('name' in f ? f.name : ''))
    expect(names).toEqual(MASSAGE_KEYS)
    expect(MASSAGE_KEYS).toContain('hypertensionDetail')
    expect(MASSAGE_KEYS.filter((k) => k.endsWith('OD'))).toEqual([])
  })
})

describe('specialty catalogue and org types', () => {
  it('has unique keys and every specialty records at least the general consult', () => {
    const keys = SPECIALTIES.map((s) => s.key)
    expect(new Set(keys).size).toBe(keys.length)
    for (const s of SPECIALTIES) expect(s.formats.length).toBeGreaterThan(0)
    for (const o of ORG_TYPES) for (const k of o.suggested) expect(asSpecialty(k), `${o.value} suggests ${k}`).toBe(k)
  })

  it('rejects unknown values', () => {
    expect(asSpecialty('astrology')).toBeNull()
    expect(asSpecialty(undefined)).toBeNull()
    expect(asOrgType('spaceship')).toBeNull()
  })

  it('derives the org type of older clinics from what they already have', () => {
    expect(orgTypeOf(null)).toBe('consultorio')
    expect(orgTypeOf({ practiceType: 'individual' })).toBe('consultorio')
    expect(orgTypeOf({ practiceType: 'clinic' })).toBe('especialidades')
    expect(orgTypeOf({ practiceType: 'clinic', settings: { consultTemplate: 'aesthetic' } })).toBe('estetica')
    // An aesthetic practice run by one doctor is still an aesthetic clinic.
    expect(orgTypeOf({ practiceType: 'individual', settings: { consultTemplate: 'aesthetic' } })).toBe('estetica')
    // A stored value always wins; a corrupt one falls back to derivation.
    expect(orgTypeOf({ practiceType: 'clinic', settings: { orgType: 'policlinica', consultTemplate: 'aesthetic' } })).toBe('policlinica')
    expect(orgTypeOf({ practiceType: 'clinic', settings: { orgType: 'bogus' } })).toBe('especialidades')
  })

  it('lists the org type suggestions first and every specialty exactly once', () => {
    const list = specialtiesFor('estetica')
    expect(list[0].key).toBe('aesthetic')
    expect(list.length).toBe(SPECIALTIES.length)
    expect(new Set(list.map((s) => s.key)).size).toBe(SPECIALTIES.length)
  })

  it('picks the base profile at signup from org type and specialty', () => {
    expect(profileForSignup('consultorio', 'nutrition')).toBe('nutrition')
    expect(profileForSignup('consultorio', 'aesthetic')).toBe('aesthetic')
    expect(profileForSignup('consultorio', 'ophthalmology')).toBe('general')
    expect(profileForSignup('consultorio', null)).toBe('general')
    expect(profileForSignup('estetica', null)).toBe('aesthetic')
    // In a clinic the owner is not the practitioner, so their specialty doesn't set the profile.
    expect(profileForSignup('especialidades', 'nutrition')).toBe('general')
  })
})

describe('formats follow the doctor’s specialty (micro axis)', () => {
  const general = { settings: { consultTemplate: 'general' } }
  const aesthetic = { settings: { consultTemplate: 'aesthetic' } }

  it('falls back to the clinic profile when the doctor has no specialty', () => {
    expect(formatsFor(aesthetic, { role: 'doctor' })).toEqual(['general', 'nutrition', 'program', 'massage'])
    expect(formatsFor(aesthetic, { role: 'doctor', specialtyKey: null })).toEqual(['general', 'nutrition', 'program', 'massage'])
    expect(formatsFor(aesthetic, { role: 'doctor', specialtyKey: 'bogus' })).toEqual(['general', 'nutrition', 'program', 'massage'])
  })

  it('a specialist in a mixed clinic gets only their own sheets', () => {
    expect(formatsFor(aesthetic, { role: 'doctor', specialtyKey: 'ophthalmology' })).toEqual(['general'])
    expect(formatsFor(general, { role: 'doctor', specialtyKey: 'aesthetic' })).toEqual(['general', 'nutrition', 'massage'])
  })

  it('the programme control is only offered where the clinic runs the programme', () => {
    expect(formatsFor(general, { role: 'doctor', specialtyKey: 'nutrition' })).toEqual(['nutrition', 'general'])
    expect(formatsFor(aesthetic, { role: 'doctor', specialtyKey: 'nutrition' })).toEqual(['nutrition', 'general', 'program'])
  })

  it('therapists only fill session sheets, whatever specialty they carry', () => {
    expect(formatsFor(general, { role: 'therapist', specialtyKey: 'ophthalmology' })).toEqual(['massage'])
  })

  it('the default format never opens outside the specialty', () => {
    const formats = formatsFor(aesthetic, { role: 'doctor', specialtyKey: 'ophthalmology' })
    expect(initialFormat(formats, { activeProgram: true, userDefault: 'massage' })).toBe('general')
  })
})
