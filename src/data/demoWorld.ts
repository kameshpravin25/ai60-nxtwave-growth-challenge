/**
 * DEMO MODE ONLY. Fictional Campus Captains, clubs and student first names used to simulate a
 * campaign that is on Day 5 of 7. Nothing here is real data. Live mode never imports the seeds.
 */

export interface Captain {
  code: string
  name: string
  role: string
  college: string
  strength: number
  activeFromDay: number
}

export const CAPTAINS: Captain[] = [
  { code: 'VNR-SNEHA', name: 'Sneha R.', role: 'Placement coordinator', college: 'VNR VJIET', strength: 1.9, activeFromDay: 0 },
  { code: 'CBIT-RAHUL', name: 'Rahul V.', role: 'CR, CSE-B', college: 'CBIT Hyderabad', strength: 1.6, activeFromDay: 0 },
  { code: 'KLU-TEJA', name: 'Teja K.', role: 'Coding club lead', college: 'KL University', strength: 1.4, activeFromDay: 0 },
  { code: 'GRIET-KAVYA', name: 'Kavya P.', role: 'CR, IT-A', college: 'GRIET Hyderabad', strength: 1.2, activeFromDay: 1 },
  { code: 'VASAVI-ARJUN', name: 'Arjun M.', role: 'CR, ECE-A', college: 'Vasavi College of Engg', strength: 1.1, activeFromDay: 0 },
  { code: 'SNIST-DIVYA', name: 'Divya S.', role: 'Placement volunteer', college: 'SNIST Hyderabad', strength: 1.0, activeFromDay: 1 },
  { code: 'GVP-HARSHA', name: 'Harsha N.', role: 'CR, MECH', college: 'GVP College of Engg', strength: 0.9, activeFromDay: 1 },
  { code: 'VITAP-MEGHANA', name: 'Meghana L.', role: 'Student council', college: 'VIT-AP University', strength: 0.9, activeFromDay: 2 },
  { code: 'VRSEC-PAVAN', name: 'Pavan T.', role: 'CR, EEE', college: 'VR Siddhartha Engg College', strength: 0.8, activeFromDay: 1 },
  { code: 'MLRIT-NIKHIL', name: 'Nikhil G.', role: 'CR, CSE-C', college: 'MLR Institute of Tech', strength: 0.7, activeFromDay: 2 },
  { code: 'CVR-ANUSHA', name: 'Anusha B.', role: 'CR, CIVIL', college: 'CVR College of Engg', strength: 0.6, activeFromDay: 2 },
  { code: 'ANURAG-SAI', name: 'Sai Charan', role: 'Hackathon club', college: 'Anurag University', strength: 0.5, activeFromDay: 3 },
  { code: 'MGIT-ROHIT', name: 'Rohit J.', role: 'CR, ECE-B', college: 'MGIT Hyderabad', strength: 0.4, activeFromDay: 3 },
  { code: 'SRMAP-KARTHIK', name: 'Karthik D.', role: 'Tech club', college: 'SRM University AP', strength: 0.3, activeFromDay: 3 },
  { code: 'JNTUH-PRIYA', name: 'Priya A.', role: 'CR, CSE-A', college: 'JNTUH CEH', strength: 0.04, activeFromDay: 1 },
]

export const CLUBS = [
  { code: 'GDG-VNR', name: 'GDG on Campus VNR', college: 'VNR VJIET', strength: 1.3 },
  { code: 'IEEE-CBIT', name: 'IEEE SB CBIT', college: 'CBIT Hyderabad', strength: 1.0 },
  { code: 'CODECLUB-KLU', name: 'KLU Code Club', college: 'KL University', strength: 0.9 },
  { code: 'GDG-GRIET', name: 'GDG on Campus GRIET', college: 'GRIET Hyderabad', strength: 0.7 },
  { code: 'IEEE-VITAP', name: 'IEEE SB VIT-AP', college: 'VIT-AP University', strength: 0.6 },
]

export const FIRST_NAMES = [
  'Aarav', 'Aditi', 'Akhil', 'Ananya', 'Anjali', 'Arjun', 'Bhavana', 'Charan', 'Deepak', 'Deepika', 'Divya', 'Gayathri',
  'Harsha', 'Harini', 'Ishaan', 'Jahnavi', 'Karthik', 'Kavya', 'Keerthi', 'Krishna', 'Lakshmi', 'Lohith', 'Manasa', 'Manoj',
  'Meghana', 'Mohit', 'Mounika', 'Naveen', 'Neha', 'Nikhil', 'Nithya', 'Pavan', 'Pooja', 'Pranav', 'Pranathi', 'Praveen',
  'Priya', 'Rahul', 'Rakesh', 'Ravi', 'Rithika', 'Rohan', 'Sahithi', 'Sai', 'Sameer', 'Sandeep', 'Shreya', 'Siddharth',
  'Sindhu', 'Sneha', 'Sravani', 'Srikanth', 'Swathi', 'Tarun', 'Teja', 'Tejaswini', 'Uday', 'Varun', 'Vamsi', 'Vasavi',
  'Venkat', 'Vignesh', 'Vinay', 'Yamini', 'Yashwanth', 'Zoya', 'Farhan', 'Ayesha', 'Imran', 'Sana', 'Joseph', 'Aditya',
  'Ritika', 'Kunal', 'Ishita', 'Harshit', 'Simran', 'Gautham', 'Hemanth', 'Bindu',
]

export const LAST_INITIALS = 'ABCDGKMNPRSTVY'

/** Colleges that only appear through organic/referral spread (weight = relative size). */
export const ORGANIC_COLLEGES: Array<[string, number]> = [
  ['CBIT Hyderabad', 3], ['VNR VJIET', 3], ['KL University', 3], ['GRIET Hyderabad', 2], ['Vasavi College of Engg', 2],
  ['SNIST Hyderabad', 2], ['MLR Institute of Tech', 1.5], ['CVR College of Engg', 1.5], ['MGIT Hyderabad', 1.2],
  ['Anurag University', 1.2], ['JNTUH CEH', 1.5], ['GVP College of Engg', 1.5], ['VR Siddhartha Engg College', 1.2],
  ["Vignan's University", 1.2], ['SRM University AP', 1], ['VIT-AP University', 1.2], ['Anna University (CEG)', 0.8],
  ['SRM IST Chennai', 0.8], ['VIT Vellore', 1], ['PES University', 0.6], ['RV College of Engg', 0.5], ['PICT Pune', 0.5],
  ['KIIT Bhubaneswar', 0.6], ['Chandigarh University', 0.5], ['LPU Phagwara', 0.4], ['Amrita Coimbatore', 0.5],
]
