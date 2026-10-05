/**
 * Suggested college names for the registration form. Using a datalist with canonical names keeps
 * the inter-college leaderboard clean ("CBIT", "cbit hyd", "C.B.I.T" would otherwise split).
 * Students can still type any college.
 */
export const COLLEGES = [
  'CBIT Hyderabad',
  'VNR VJIET',
  'Vasavi College of Engg',
  'GRIET Hyderabad',
  'MLR Institute of Tech',
  'CVR College of Engg',
  'SNIST Hyderabad',
  'MGIT Hyderabad',
  'Anurag University',
  'JNTUH CEH',
  'KL University',
  'GVP College of Engg',
  'VR Siddhartha Engg College',
  "Vignan's University",
  'SRM University AP',
  'VIT-AP University',
  'Anna University (CEG)',
  'SRM IST Chennai',
  'VIT Vellore',
  'PES University',
  'RV College of Engg',
  'BMS College of Engg',
  'PSG College of Tech',
  'Amrita Coimbatore',
  'PICT Pune',
  'KIIT Bhubaneswar',
  'Chandigarh University',
  'LPU Phagwara',
] as const

/** Normalises free-typed college names onto the canonical list where obvious. */
export function canonicalCollege(input: string): string {
  const clean = input.trim().replace(/\s+/g, ' ')
  const key = clean.toLowerCase().replace(/[^a-z0-9]/g, '')
  const hit = COLLEGES.find((c) => {
    const ck = c.toLowerCase().replace(/[^a-z0-9]/g, '')
    return ck === key || ck.startsWith(key) && key.length >= 4
  })
  return hit ?? clean
}
