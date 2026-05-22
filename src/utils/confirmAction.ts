/** Browser confirm dialog for destructive actions. Returns true if user confirmed. */
export function confirmUserAction(message: string): boolean {
  if (typeof window === 'undefined') return false;
  return window.confirm(message);
}
