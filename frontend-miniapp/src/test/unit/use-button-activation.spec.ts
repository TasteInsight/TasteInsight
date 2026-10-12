import { useButtonActivation } from '@/composables/use-button-activation';

it('accepts normalized Uni keyboard events without DOM target identity', () => {
  const onActivate = jest.fn();
  const button = useButtonActivation(onActivate);
  const makeKey = (key: string) => ({
    key,
    preventDefault: jest.fn(),
    stopPropagation: jest.fn(),
  });

  const down = makeKey('Enter');
  const up = makeKey('Enter');
  button.handleKeydown(down);
  button.handleKeyup(up);

  expect(down.preventDefault).toHaveBeenCalledTimes(1);
  expect(up.preventDefault).toHaveBeenCalledTimes(1);
  expect(onActivate).toHaveBeenCalledTimes(1);
  button.handleKeyup(up);
  expect(onActivate).toHaveBeenCalledTimes(1);
});

it('ignores unrelated keys and clears a held activation after a pointer click', () => {
  const onActivate = jest.fn();
  const button = useButtonActivation(onActivate);
  const event = {
    key: 'ArrowRight',
    preventDefault: jest.fn(),
    stopPropagation: jest.fn(),
  };
  button.handleKeydown(event);
  button.handleKeyup(event);
  expect(event.preventDefault).not.toHaveBeenCalled();
  expect(event.stopPropagation).not.toHaveBeenCalled();
  expect(onActivate).not.toHaveBeenCalled();

  event.key = 'Enter';
  button.handleKeydown(event);
  button.activate();
  button.handleKeyup(event);
  expect(onActivate).toHaveBeenCalledTimes(1);
});

it('checks current disabled state for pointer and normalized keyboard activation', () => {
  const onActivate = jest.fn();
  let disabled = true;
  const button = useButtonActivation(onActivate, () => disabled);
  const event = {
    key: ' ',
    preventDefault: jest.fn(),
    stopPropagation: jest.fn(),
  };

  button.activate();
  button.handleKeydown(event);
  button.handleKeyup(event);
  expect(event.preventDefault).toHaveBeenCalledTimes(2);
  expect(onActivate).not.toHaveBeenCalled();

  disabled = false;
  button.handleKeydown(event);
  disabled = true;
  button.handleKeyup(event);
  expect(onActivate).not.toHaveBeenCalled();
});
