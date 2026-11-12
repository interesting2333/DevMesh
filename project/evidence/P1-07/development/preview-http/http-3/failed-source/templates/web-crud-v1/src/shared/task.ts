import { z } from 'zod';
const boundedText = (maximum: number) => z.string().refine(value => Array.from(value).length <= maximum, 'Text too long');
export const TaskInput = z.object({
  title: boundedText(120).transform(value => value.trim()).refine(value => value.length > 0, 'Title required'),
  description: boundedText(4000),
  status: z.enum(['todo', 'doing', 'done'])
}).strict();
export type TaskInput = z.infer<typeof TaskInput>;
export const Task = TaskInput.extend({
  id: z.uuid(), revision: z.number().int().positive(), createdAt: z.iso.datetime(), updatedAt: z.iso.datetime()
}).strict();
export type Task = z.infer<typeof Task>;
export const TaskList = z.object({ tasks: z.array(Task).max(1000), readOnly: z.boolean() }).strict();
export type TaskList = z.infer<typeof TaskList>;
export class AppError extends Error {
  constructor(public readonly code: string, public readonly status: number) { super(code); }
}
