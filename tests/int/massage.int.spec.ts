import { describe, expect, it } from 'vitest'
import { EMPTY_MASSAGE, formToMassage, massageAlerts, massageLines, massageServicesLine, massageToForm } from '@/lib/massage'
import { formatsFor, practiceProfile, profileFormats } from '@/lib/profiles'
import { doctorWhere, isClinical, isDoctor, isPractitioner, practitionerWhere } from '@/lib/practice'

describe('massage sheet helpers', () => {
  it('keeps only known options, numbers in range and filled details on create', () => {
    const out = formToMassage(
      {
        ...EMPTY_MASSAGE,
        services: ['reducing', 'hacked'],
        hypertension: 'yes',
        hypertensionDetail: ' Losartán 50 mg ',
        painIntensity: '12',
        pressure: 'firm',
        consent: 'yes',
        surgeryDate: 'mañana',
      },
      false,
    )
    expect(out).toEqual({ services: ['reducing'], hypertension: 'yes', hypertensionDetail: 'Losartán 50 mg', pressure: 'firm', consent: true })
  })

  it('returns undefined on create when nothing was filled', () => {
    expect(formToMassage({ ...EMPTY_MASSAGE }, false)).toBeUndefined()
  })

  it('clears emptied fields on update', () => {
    const out = formToMassage({ ...EMPTY_MASSAGE, zones: 'Abdomen' }, true)!
    expect(out.zones).toBe('Abdomen')
    expect(out.pressure).toBeNull()
    expect(out.services).toEqual([])
    expect(out.consent).toBe(false)
  })

  it('round-trips stored values through the form', () => {
    const form = massageToForm({ services: ['lymphatic'], consent: true, painIntensity: 4, surgeryDate: '2026-11-01' })
    expect(form.services).toEqual(['lymphatic'])
    expect(form.consent).toBe('yes')
    expect(form.painIntensity).toBe('4')
    expect(form.surgeryDate).toBe('2026-11-01')
    expect(formToMassage(form, false)).toEqual({ services: ['lymphatic'], consent: true, painIntensity: 4, surgeryDate: '2026-11-01' })
  })

  it('summarises services, flags and readable lines', () => {
    const v = { services: ['reducing', 'gluteLift'], servicesOther: 'Cavitación', diabetes: 'yes', allergyOils: 'yes', allergyOilsDetail: 'Lavanda', cancer: 'no', pressure: 'soft' }
    expect(massageServicesLine(v)).toBe('Masaje reductor, Levantamiento de glúteos, Cavitación')
    expect(massageAlerts(v)).toEqual(['Diabetes', 'Aceites o aceites esenciales: Lavanda'])
    expect(massageLines(v, 'salud')).toEqual([{ label: 'Diabetes', value: 'Sí' }]) // «No» answers are skipped
    expect(massageLines(v, 'evaluacion')).toEqual([{ label: 'Presión recomendada', value: 'Suave' }])
  })
})

describe('practice profiles', () => {
  const aesthetic = { settings: { consultTemplate: 'aesthetic' } }
  it('maps profiles to formats, defaulting unknown values to general', () => {
    expect(profileFormats(aesthetic)).toEqual(['general', 'nutrition', 'program', 'massage'])
    expect(profileFormats({ settings: { consultTemplate: 'nutrition' } })[0]).toBe('nutrition')
    expect(practiceProfile({ settings: { consultTemplate: 'bogus' } })).toBe('general')
    expect(practiceProfile(null)).toBe('general')
  })

  it('limits therapists to massage sheets', () => {
    expect(formatsFor(aesthetic, { role: 'therapist' })).toEqual(['massage'])
    expect(formatsFor(aesthetic, { role: 'doctor' })).toContain('general')
  })
})

describe('therapist role', () => {
  it('is bookable but neither a doctor nor clinical', () => {
    const t = { role: 'therapist' }
    expect(isPractitioner(t)).toBe(true)
    expect(isDoctor(t)).toBe(false)
    expect(isClinical(t)).toBe(false)
  })

  it('is listed with bookable staff but not counted as a doctor', () => {
    expect(JSON.stringify(practitionerWhere('t1'))).toContain('therapist')
    expect(JSON.stringify(doctorWhere('t1'))).not.toContain('therapist')
  })
})
