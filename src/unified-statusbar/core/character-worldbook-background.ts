export type CharacterWorldbookBackgroundMode = 'create' | 'create-fresh' | 'update';

export interface CharacterWorldbookBackgroundTask<T> {
  mode: CharacterWorldbookBackgroundMode;
  characterName: string;
  status: 'running' | 'ready';
  value?: T;
}

let activeTask: CharacterWorldbookBackgroundTask<unknown> | null = null;

export function getCharacterWorldbookBackgroundTask<T>(): CharacterWorldbookBackgroundTask<T> | null {
  return activeTask as CharacterWorldbookBackgroundTask<T> | null;
}

export function clearCharacterWorldbookBackgroundTask(): void {
  activeTask = null;
}

export function startCharacterWorldbookBackgroundTask<T>(
  mode: CharacterWorldbookBackgroundMode,
  characterName: string,
  work: () => Promise<T>,
  onReady: (task: CharacterWorldbookBackgroundTask<T>) => void,
  onError: (error: unknown) => void,
): boolean {
  if (activeTask) return false;
  const task: CharacterWorldbookBackgroundTask<T> = { mode, characterName, status: 'running' };
  activeTask = task;
  void Promise.resolve().then(work).then(value => {
    if (activeTask !== task) return;
    task.status = 'ready';
    task.value = value;
    onReady(task);
  }).catch(error => {
    if (activeTask === task) activeTask = null;
    onError(error);
  });
  return true;
}
