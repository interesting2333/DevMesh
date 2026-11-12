import { parentPort, workerData } from 'node:worker_threads';
import { TaskDatabase, type Mutation } from './database.js';
import { AppError } from '../shared/task.js';
const options = workerData as { root: string; readOnly: boolean };
const database = new TaskDatabase(options.root, options.readOnly);
parentPort!.on('message', (message: { id: number; method: string; mutation?: Mutation }) => {
  try {
    const value = message.method === 'list' ? database.list() : message.method === 'mutate' ? database.mutate(message.mutation!) : database.close();
    parentPort!.postMessage({ id: message.id, value });
    if (message.method === 'close') parentPort!.close();
  } catch (error) {
    parentPort!.postMessage({ id: message.id, error: error instanceof AppError ? { code: error.code, status: error.status } : { code: 'STORAGE_ERROR', status: 500 } });
  }
});
parentPort!.postMessage({ ready: true });
