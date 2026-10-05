/** The 60-minute run of show. Shared by the landing page's lab record and the live workshop room. */
export const AGENDA = [
  { at: 0, end: 5, title: 'Set up', body: 'Free Gemini API key and a Hugging Face account. We send a 2-minute checklist the day before, so nobody spends the workshop on logins.' },
  { at: 5, end: 15, title: 'How AI apps actually work', body: 'Prompt → model → structured output. No maths. Just the mental model interviewers test with "how does your project work?"' },
  { at: 15, end: 40, title: 'Build your branch project', body: 'Code along step by step: prompt design, the API call, a simple UI. Starter code is provided, and mentors unblock you in the chat.' },
  { at: 40, end: 50, title: 'Ship it live', body: 'Deploy to a public URL on Hugging Face Spaces, then open it on your phone. It works. You built that.' },
  { at: 50, end: 60, title: 'Package it', body: 'Write your resume bullet, LinkedIn post and 30-second interview answer. Submit your URL to get the certificate.' },
] as const
