export type LinkedEntryTask = {
  reminderId: string;
  text: string;
  taskNote?: string;
  dueDate?: string;
  assignedTo?: string;
  taskCategory?: string;
};

export function linkedTaskDisplayText(task: LinkedEntryTask): string {
  const raw = (task.text || '')
    .trim()
    .replace(/^Task:\s*/i, '')
    .replace(/^Follow\s*up:\s*/i, '')
    .trim();
  return raw || 'Task';
}

export function linkedTaskNoteDisplay(task: LinkedEntryTask): string | null {
  const note = (task.taskNote || '')
    .trim()
    .replace(/^Follow\s*up:\s*/i, '')
    .trim();
  if (!note) return null;
  const titleNorm = linkedTaskDisplayText(task).toLowerCase();
  if (note.toLowerCase() === titleNorm) return null;
  return note;
}
