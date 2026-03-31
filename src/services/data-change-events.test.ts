import { describe, expect, it, vi } from 'vitest';

import { emitDataChange, subscribeToDataChanges } from '@/services/data-change-events';

describe('data change events', () => {
  it('notifies listeners on emitted changes', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToDataChanges(listener);

    emitDataChange({ scope: 'vehicles', action: 'create' });
    emitDataChange({ scope: 'entries', action: 'delete' });

    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener).toHaveBeenNthCalledWith(1, { scope: 'vehicles', action: 'create' });
    expect(listener).toHaveBeenNthCalledWith(2, { scope: 'entries', action: 'delete' });

    unsubscribe();
  });

  it('stops notifications after unsubscribe', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToDataChanges(listener);

    emitDataChange({ scope: 'vehicles', action: 'update' });
    unsubscribe();
    emitDataChange({ scope: 'vehicles', action: 'delete' });

    expect(listener).toHaveBeenCalledTimes(1);
  });
});

