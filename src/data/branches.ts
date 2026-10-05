import type { Branch } from '../types'

export interface BranchProject {
  branch: Branch
  label: string
  project: string
  what: string
  skills: string[]
  bullet: string
  before: string
  after: string
  note: string
}

/**
 * One project per branch, each buildable in the 25-minute build block with a browser-only stack.
 * The "after" answers each carry one real engineering judgement call, because that's what
 * interviewers actually probe.
 */
export const BRANCHES: BranchProject[] = [
  {
    branch: 'CSE',
    label: 'CSE',
    project: 'ResumeRadar',
    what: 'Paste a job description and your resume. It scores the match, flags missing skills and rewrites three bullets to fit the role.',
    skills: ['Prompt design', 'JSON output', 'Gemini API', 'Live deploy'],
    bullet: 'Built and deployed ResumeRadar, an LLM app that scores resume–JD fit and rewrites bullets (Gemini API, Gradio, Hugging Face Spaces).',
    before: "Umm… I use ChatGPT a lot. I'm planning to do an AI course soon.",
    after:
      "Yes. I built ResumeRadar. It reads a job description and a resume and returns a fit score, missing skills and rewritten bullets. The hard part was getting clean JSON back every time, so I gave the model a strict schema and added a retry. It's live. I can show you on my phone.",
    note: 'Specific. Live. Shows judgement.',
  },
  {
    branch: 'IT',
    label: 'IT',
    project: 'MockMate',
    what: 'Pick a company and a role. It runs a 5-question mock interview and grades every answer against a rubric.',
    skills: ['Prompt chaining', 'Rubric scoring', 'Gemini API', 'Live deploy'],
    bullet: 'Built MockMate, an AI mock-interview app that generates role-specific questions and grades answers against a rubric (Gemini API, Gradio).',
    before: "I know the basics of Python… AI is something I want to explore.",
    after:
      "Yes. MockMate asks role-specific interview questions and grades my answers. The grading was random at first. It only became consistent once I passed the rubric explicitly and asked for a score per criterion. I used it to prepare for this interview.",
    note: 'Ha! Meta. Memorable.',
  },
  {
    branch: 'ECE',
    label: 'ECE',
    project: 'DatasheetGPT',
    what: "Upload a component datasheet PDF and ask things like \"What's the max supply voltage?\" It answers and cites the page.",
    skills: ['Document Q&A', 'Citations', 'Gemini API', 'Live deploy'],
    bullet: 'Built DatasheetGPT, a document Q&A app that answers questions from electronic component datasheets with page citations (Gemini API, Gradio).',
    before: "I'm from ECE, so I haven't really done anything in AI…",
    after:
      "Yes. In my lab, finding one spec in a 40-page datasheet took forever, so I built DatasheetGPT. Upload the PDF, ask a question, and it answers with the page number. I added citations on purpose, because models can hallucinate numbers and an engineer has to verify them.",
    note: 'Real problem → real tool.',
  },
  {
    branch: 'EEE',
    label: 'EEE',
    project: 'BillBot',
    what: 'Snap a photo of your electricity bill. It reads the units and tariff slabs, explains every charge and suggests 3 ways to cut the next bill.',
    skills: ['Vision models', 'Data extraction', 'Validation', 'Live deploy'],
    bullet: 'Built BillBot, a vision-LLM app that extracts usage and tariff slabs from electricity-bill photos and recommends savings (Gemini Vision, Gradio).',
    before: 'Not yet… our branch is mostly core subjects.',
    after:
      "Yes. BillBot reads a photo of an electricity bill and explains the charges slab by slab. I didn't let the model calculate the total. It only extracts the units, and a Python function applies the tariff, so the numbers can't be made up. It's live on Hugging Face.",
    note: 'Core branch + AI = rare.',
  },
  {
    branch: 'MECH',
    label: 'MECH',
    project: 'ManualMate',
    what: 'Describe a symptom like "lathe chatter at high RPM". It works through likely causes and the safest checks first, using a manual you upload.',
    skills: ['Grounded answers', 'Safety-first prompts', 'Gemini API', 'Live deploy'],
    bullet: 'Built ManualMate, an AI troubleshooting assistant that diagnoses machine faults from symptoms using uploaded maintenance manuals (Gemini API, Gradio).',
    before: "I'm mechanical. I didn't think AI was for us.",
    after:
      "Yes. ManualMate is a troubleshooting assistant for machines. You describe a symptom and it works through causes from the uploaded manual, ordered from the safest check first. I forced it to quote the manual section, so it can't invent procedures. It's built for shop-floor technicians.",
    note: 'Domain + AI. Stands out.',
  },
  {
    branch: 'CIVIL',
    label: 'CIVIL',
    project: 'SiteEstimate',
    what: 'Describe a structure, e.g. "3 m × 4 m RCC slab, 150 mm thick". It returns a material estimate (cement bags, sand, steel) and lists every assumption.',
    skills: ['Structured extraction', 'LLM + code', 'Gemini API', 'Live deploy'],
    bullet: 'Built SiteEstimate, an AI quantity-estimation tool that turns plain-English structure descriptions into material estimates with stated assumptions (Gemini API, Gradio).',
    before: 'Software roles are hard for civil students. I applied anyway…',
    after:
      "Yes. SiteEstimate turns a plain-English description of a structure into a material estimate. My key design decision: I didn't trust the model with arithmetic. It only extracts the dimensions, and Python runs the formulas. That's how you make AI output reliable.",
    note: 'Excellent judgement!',
  },
  {
    branch: 'OTHER',
    label: 'Other',
    project: 'RecordWriter',
    what: 'Paste rough lab observations. It returns a neatly formatted lab record: aim, procedure, observation table and result.',
    skills: ['Prompt templates', 'Table output', 'Gemini API', 'Live deploy'],
    bullet: 'Built RecordWriter, an LLM app that turns rough lab observations into structured lab records (Gemini API, Gradio, Hugging Face Spaces).',
    before: "I haven't built anything yet… I'll start after placements.",
    after:
      "Yes. RecordWriter turns rough lab notes into a formatted record, which every engineering student wishes existed. I learned prompt templating and how to force a consistent table structure in the output. My whole lab batch uses it now.",
    note: 'Solves a real pain. Nice.',
  },
]
