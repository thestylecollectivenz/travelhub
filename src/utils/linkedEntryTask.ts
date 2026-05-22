export type LinkedEntryTask = {
  reminderId: string;
  text: string;
  taskNote?: string;
  dueDate?: string;
  assignedTo?: string;
  taskCategory?: string;
};

export function linkedTaskDisplayText(task: LinkedEntryTask): string {
  const raw = (task.text || '').trim().replace(/^Task:\s*/i, '');
  return raw || 'Task';
}
