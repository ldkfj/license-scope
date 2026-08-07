export interface FocusTarget {
  focus: () => void;
}

export function cycleModalFocus(
  focusable: readonly FocusTarget[],
  activeElement: FocusTarget | null,
  backwards: boolean,
): boolean {
  if (focusable.length === 0) return false;
  const activeIndex = focusable.indexOf(activeElement as FocusTarget);
  if (backwards && activeIndex <= 0) {
    focusable[focusable.length - 1].focus();
    return true;
  }
  if (!backwards && (activeIndex === -1 || activeIndex === focusable.length - 1)) {
    focusable[0].focus();
    return true;
  }
  return false;
}

export function handleModalKeyDown(
  event: Pick<KeyboardEvent, 'key' | 'shiftKey' | 'preventDefault'>,
  focusable: readonly FocusTarget[],
  activeElement: FocusTarget | null,
  onClose: () => void,
): void {
  if (event.key === 'Escape') {
    event.preventDefault();
    onClose();
  } else if (event.key === 'Tab' && cycleModalFocus(focusable, activeElement, event.shiftKey)) {
    event.preventDefault();
  }
}
