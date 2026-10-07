// Flat string state for the patient form + mapping from the stored document.
// Lives outside the 'use client' component so server pages can call it.

export type PatientInitial = {
  name: string
  phone: string
  gender: string
  ageYears: string
  dateOfBirth: string // YYYY-MM-DD
  bloodGroup: string
  allergies: string
  notes: string
  documentType: string
  documentNumber: string
  email: string
  address: string
  occupation: string
  insuranceProvider: string
  insuranceAffiliate: string
  insurancePlan: string
  emergencyName: string
  emergencyRelationship: string
  emergencyPhone: string
  hxPersonal: string
  hxChronic: string
  hxSurgical: string
  hxFamily: string
  hxMedications: string
  hxHabits: string
  hxGyneco: string
  hxVaccines: string
}

export const EMPTY_PATIENT: PatientInitial = {
  name: '',
  phone: '',
  gender: 'female',
  ageYears: '',
  dateOfBirth: '',
  bloodGroup: '',
  allergies: '',
  notes: '',
  documentType: 'cedula',
  documentNumber: '',
  email: '',
  address: '',
  occupation: '',
  insuranceProvider: '',
  insuranceAffiliate: '',
  insurancePlan: '',
  emergencyName: '',
  emergencyRelationship: '',
  emergencyPhone: '',
  hxPersonal: '',
  hxChronic: '',
  hxSurgical: '',
  hxFamily: '',
  hxMedications: '',
  hxHabits: '',
  hxGyneco: '',
  hxVaccines: '',
}

/** Map a stored patient document onto the form's flat string state. */
export function patientToInitial(p: {
  name: string
  phone: string
  gender: string
  ageYears?: number | null
  dateOfBirth?: string | null
  bloodGroup?: string | null
  allergies?: string | null
  notes?: string | null
  documentType?: string | null
  documentNumber?: string | null
  email?: string | null
  address?: string | null
  occupation?: string | null
  insurance?: { provider?: string | null; affiliateNumber?: string | null; plan?: string | null } | null
  emergencyContact?: { name?: string | null; relationship?: string | null; phone?: string | null } | null
  history?: {
    personal?: string | null
    chronicConditions?: string | null
    surgical?: string | null
    family?: string | null
    medications?: string | null
    habits?: string | null
    gynecoObstetric?: string | null
    vaccines?: string | null
  } | null
}): PatientInitial {
  const h = p.history ?? {}
  return {
    name: p.name,
    phone: p.phone,
    gender: p.gender,
    ageYears: p.ageYears != null ? String(p.ageYears) : '',
    dateOfBirth: p.dateOfBirth ? p.dateOfBirth.slice(0, 10) : '',
    bloodGroup: p.bloodGroup ?? '',
    allergies: p.allergies ?? '',
    notes: p.notes ?? '',
    documentType: p.documentType ?? 'cedula',
    documentNumber: p.documentNumber ?? '',
    email: p.email ?? '',
    address: p.address ?? '',
    occupation: p.occupation ?? '',
    insuranceProvider: p.insurance?.provider ?? '',
    insuranceAffiliate: p.insurance?.affiliateNumber ?? '',
    insurancePlan: p.insurance?.plan ?? '',
    emergencyName: p.emergencyContact?.name ?? '',
    emergencyRelationship: p.emergencyContact?.relationship ?? '',
    emergencyPhone: p.emergencyContact?.phone ?? '',
    hxPersonal: h.personal ?? '',
    hxChronic: h.chronicConditions ?? '',
    hxSurgical: h.surgical ?? '',
    hxFamily: h.family ?? '',
    hxMedications: h.medications ?? '',
    hxHabits: h.habits ?? '',
    hxGyneco: h.gynecoObstetric ?? '',
    hxVaccines: h.vaccines ?? '',
  }
}
