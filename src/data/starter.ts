import type { Branch } from '../types'

interface StarterSpec {
  project: string
  system: string
  inputs: Array<{ name: string; label: string; lines: number }>
  image?: { name: string; label: string }
  /** The input that must be filled before calling the model. */
  required?: string
  compose: string
}

/**
 * Starter code for each branch project: a single-file Gradio app on the Gemini API (google-genai SDK),
 * deployable to Hugging Face Spaces from the browser. `compose` is the Python expression sent as contents.
 */
const SPECS: Record<Branch, StarterSpec> = {
  CSE: {
    project: 'ResumeRadar',
    system:
      'You are a strict technical recruiter. Compare the resume to the job description. Reply in Markdown with: a fit score out of 100, the 5 most important missing skills, and 3 resume bullets rewritten to match the role. Never invent experience the resume does not show.',
    inputs: [
      { name: 'jd', label: 'Job description', lines: 8 },
      { name: 'resume', label: 'Your resume (paste text)', lines: 12 },
    ],
    compose: 'f"JOB DESCRIPTION:\\n{jd}\\n\\nRESUME:\\n{resume}"',
  },
  IT: {
    project: 'MockMate',
    system:
      'You are an interviewer for the given company and role. Ask exactly one interview question, then grade the candidate\'s answer against this rubric: correctness, clarity, depth, examples (0-5 each). Reply in Markdown with the scores and one concrete tip.',
    inputs: [
      { name: 'role', label: 'Company and role (e.g. TCS Digital, Developer)', lines: 1 },
      { name: 'answer', label: 'Your answer to the last question (leave empty to get a question)', lines: 8 },
    ],
    required: 'role',
    compose: 'f"ROLE: {role}\\n\\nCANDIDATE ANSWER:\\n{answer or \'(no answer yet - ask the first question)\'}"',
  },
  ECE: {
    project: 'DatasheetGPT',
    system:
      'You answer questions about an electronic component using ONLY the datasheet text provided. Quote the exact line you used and the section it came from. If the datasheet does not contain the answer, say so. Never guess numbers.',
    inputs: [
      { name: 'datasheet', label: 'Datasheet text (copy from the PDF)', lines: 12 },
      { name: 'question', label: 'Your question', lines: 2 },
    ],
    compose: 'f"DATASHEET:\\n{datasheet}\\n\\nQUESTION: {question}"',
  },
  EEE: {
    project: 'BillBot',
    system:
      'You read photos of Indian electricity bills. Extract the units consumed, the billing period and the tariff slabs as a table. Explain each charge in one line, then give 3 practical ways to reduce next month\'s bill. If a value is unreadable, say so instead of guessing.',
    inputs: [],
    image: { name: 'bill', label: 'Photo of your electricity bill' },
    compose: '[bill, "Explain this electricity bill."]',
  },
  MECH: {
    project: 'ManualMate',
    system:
      'You are a maintenance engineer. Using ONLY the manual text provided, list the most likely causes of the symptom, ordered from the safest and quickest check to the most invasive. Quote the manual section for each step. Always start with the safety precautions.',
    inputs: [
      { name: 'manual', label: 'Maintenance manual text', lines: 12 },
      { name: 'symptom', label: 'Symptom (e.g. lathe chatter at high RPM)', lines: 2 },
    ],
    compose: 'f"MANUAL:\\n{manual}\\n\\nSYMPTOM: {symptom}"',
  },
  CIVIL: {
    project: 'SiteEstimate',
    system:
      'Extract the structural element, its dimensions in metres and the concrete grade from the description. Reply ONLY with JSON: {"element": str, "length": float, "width": float, "thickness": float, "grade": str}.',
    inputs: [{ name: 'description', label: 'Describe the structure (e.g. 3 m x 4 m RCC slab, 150 mm thick, M20)', lines: 4 }],
    compose: 'description',
  },
  OTHER: {
    project: 'RecordWriter',
    system:
      'Turn rough lab observations into a neatly formatted lab record in Markdown with these headings: Aim, Apparatus, Procedure (numbered), Observations (as a table), Result. Do not invent readings that are not in the notes.',
    inputs: [
      { name: 'experiment', label: 'Experiment name', lines: 1 },
      { name: 'notes', label: 'Your rough notes and readings', lines: 12 },
    ],
    compose: 'f"EXPERIMENT: {experiment}\\n\\nNOTES:\\n{notes}"',
  },
}

const quote = (s: string) => s.replace(/\\/g, '\\\\').replace(/"""/g, '\\"\\"\\"')

/** SiteEstimate's key design decision: the LLM only extracts; Python does the arithmetic. */
const CIVIL_BODY = `    import json
    raw = response.text.strip().removeprefix("\`\`\`json").removesuffix("\`\`\`")
    d = json.loads(raw)
    volume = d["length"] * d["width"] * d["thickness"]          # m³ of concrete
    dry = volume * 1.54                                          # dry-volume factor
    cement_bags = dry * (1 / 5.5) * 1440 / 50                    # M20 ≈ 1 : 1.5 : 3
    return (
        f"### {d['element']} ({d['grade']})\\n"
        f"- Concrete volume: **{volume:.2f} m³**\\n"
        f"- Cement: **{cement_bags:.0f} bags** (50 kg)\\n"
        f"- Sand: **{dry * 1.5 / 5.5:.2f} m³**, aggregate: **{dry * 3 / 5.5:.2f} m³**\\n\\n"
        "_Assumptions: nominal mix 1:1.5:3, dry-volume factor 1.54, cement density 1440 kg/m³._"
    )`

export function starterCode(branch: Branch): { project: string; app: string; requirements: string } {
  const s = SPECS[branch]
  const params = [...s.inputs.map((i) => i.name), ...(s.image ? [s.image.name] : [])]
  const required = s.required ?? s.inputs[s.inputs.length - 1]?.name
  const guard = s.image
    ? `    if ${s.image.name} is None:\n        return "Please upload an image first."`
    : `    if not ${required}.strip():\n        return "Please fill in the inputs first."`
  const gradioInputs = [
    ...s.inputs.map((i) => `gr.Textbox(lines=${i.lines}, label="${i.label}")`),
    ...(s.image ? [`gr.Image(type="pil", label="${s.image.label}")`] : []),
  ]
  const body = branch === 'CIVIL' ? CIVIL_BODY : '    return response.text'

  const app = `import os
import gradio as gr
from google import genai
from google.genai import types

# Add GEMINI_API_KEY as a Secret in your Space settings. Never paste the key into this file.
client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
MODEL = "gemini-flash-latest"

SYSTEM = """${quote(s.system)}"""


def run(${params.join(', ')}):
${guard}
    try:
        response = client.models.generate_content(
            model=MODEL,
            contents=${s.compose},
            config=types.GenerateContentConfig(system_instruction=SYSTEM),
        )
    except Exception as e:  # show the error in the app instead of crashing
        return f"Something went wrong: {e}"
${body}


demo = gr.Interface(
    fn=run,
    inputs=[${gradioInputs.join(', ')}],
    outputs=gr.Markdown(label="Result"),
    title="${s.project}",
    flagging_mode="never",
)

if __name__ == "__main__":
    demo.launch()
`
  return { project: s.project, app, requirements: `gradio\ngoogle-genai${s.image ? '\npillow' : ''}\n` }
}
