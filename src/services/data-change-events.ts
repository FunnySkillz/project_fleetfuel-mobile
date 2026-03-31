export type DataChangeScope = 'vehicles' | 'entries';
export type DataChangeAction = 'create' | 'update' | 'delete';

export type DataChangeEvent = {
  scope: DataChangeScope;
  action: DataChangeAction;
};

type DataChangeListener = (event: DataChangeEvent) => void;

const listeners = new Set<DataChangeListener>();

export function emitDataChange(event: DataChangeEvent) {
  listeners.forEach((listener) => {
    listener(event);
  });
}

export function subscribeToDataChanges(listener: DataChangeListener) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

