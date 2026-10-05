export type Branch = 'CSE' | 'IT' | 'ECE' | 'EEE' | 'MECH' | 'CIVIL' | 'OTHER'

export type Source = 'captain' | 'referral' | 'club' | 'linkedin' | 'instagram' | 'email' | 'bot' | 'direct'

/** A public seat row. Never contains phone or email. */
export interface Seat {
  seat: number
  code: string
  name: string
  college: string
  branch: Branch
  gradYear: number
  referredBy: string | null
  source: Source
  campaign: string | null
  createdAt: number
}

export interface PrivateSeat extends Seat {
  fullName: string
  email: string
  phone: string
}

export interface RegisterInput {
  name: string
  email: string
  phone: string
  college: string
  branch: Branch
  gradYear: number
  referredBy: string | null
  source: Source
  campaign: string | null
}

export interface RegisterResult {
  seat: Seat
  existing: boolean
}

export interface Campaign {
  start: number
  workshopAt: number
}

export interface Store {
  mode: 'demo' | 'live'
  campaign(): Campaign
  seats(): Promise<Seat[]>
  register(input: RegisterInput): Promise<RegisterResult>
  findTicket(phone: string, email: string): Promise<Seat | null>
  exportRows(adminKey: string): Promise<PrivateSeat[]>
}
