type ButtonKeyboardEvent = Pick<KeyboardEvent, 'key' | 'preventDefault' | 'stopPropagation'>;

export function useButtonActivation(
  onActivate: () => void,
  isDisabled: () => boolean = () => false
) {
  let pressedKey: string | null = null;

  const clearPress = () => {
    pressedKey = null;
  };
  const activate = () => {
    clearPress();
    if (!isDisabled()) onActivate();
  };
  const handleKeydown = (event: ButtonKeyboardEvent) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    event.stopPropagation();
    pressedKey = isDisabled() ? null : event.key;
  };
  const handleKeyup = (event: ButtonKeyboardEvent) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    event.stopPropagation();
    if (pressedKey !== event.key) return;
    activate();
  };

  return { activate, handleKeydown, handleKeyup, clearPress };
}
