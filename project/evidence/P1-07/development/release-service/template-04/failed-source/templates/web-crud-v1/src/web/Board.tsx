import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { TaskInput, type Task } from '../shared/task.js';
import { BoardApi, errorMessage } from './api.js';
const columns = [{ status: 'todo', name: '待办', hint: '整理想法，准备开始' }, { status: 'doing', name: '进行中', hint: '专注于手头的工作' }, { status: 'done', name: '已完成', hint: '记录每一次进展' }] as const;
const empty: TaskInput = { title: '', description: '', status: 'todo' };
const defaultApi = new BoardApi();
export function Board({ api = defaultApi }: { api?: BoardApi }) {
  const [initialPending] = useState(() => { try { return { pending: api.hasPending(), error: '' }; } catch (failure) { return { pending: true, error: errorMessage(failure) }; } });
  const [tasks, setTasks] = useState<Task[]>([]);
  const [readOnly, setReadOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialPending.error);
  const [pending, setPending] = useState(initialPending.pending);
  const [editor, setEditor] = useState<{ original?: Task; input: TaskInput } | null>(null);
  async function load() {
    setLoading(true);
    try { const result = await api.list(); setTasks(result.tasks); setReadOnly(result.readOnly); }
    catch (failure) { setError(errorMessage(failure)); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, [api]);
  async function change(action: () => Promise<void>) {
    setBusy(true); setError('');
    try { await action(); setEditor(null); await load(); }
    catch (failure) { setError(errorMessage(failure)); }
    finally { try { setPending(api.hasPending()); } catch { setPending(true); } setBusy(false); }
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!editor) return;
    const input = TaskInput.safeParse(editor.input);
    if (!input.success) { setError('标题不能为空，最多 120 字；说明最多 4000 字。'); return; }
    void change(() => api.save(input.data, editor.original));
  }
  const disabled = busy || loading || readOnly || pending;
  return <div className="app-shell">
    <header className="topbar"><a href="/" className="brand"><span className="brand-mark">✓</span> 任务看板</a><span className="workspace">我的工作空间</span></header>
    <main>
      <div className="page-heading"><div><p className="eyebrow">WORKSPACE / BOARD</p><h1>把想法，变成进展。</h1><p className="subtitle">一目了然地安排工作，让每件事都有着落。</p></div><button className="primary" disabled={disabled} onClick={() => { setError(''); setEditor({ input: { ...empty } }); }}>＋ 新建任务</button></div>
      <div className="board-toolbar"><span className="view-label">▦ 看板视图</span><span className="total">共 {tasks.length} 项任务</span><button className="quiet" disabled={busy || loading} onClick={() => { setError(''); void load(); }}>刷新</button></div>
      {readOnly && <p className="notice" role="status">当前看板为只读。</p>}
      {pending && !editor && <div className="notice"><span>有一次保存结果尚未确认。</span><button disabled={busy || readOnly} onClick={() => void change(() => api.recover())}>核对上次保存</button></div>}
      {error && !editor && <p className="error" role="alert">{error}</p>}
      {loading && <p role="status" className="loading">正在加载任务…</p>}
      <div className="board" aria-busy={loading || busy}>
        {columns.map(column => <section className={`column ${column.status}`} key={column.status} aria-label={column.name}>
          <div className="column-heading"><h2><span className="status-dot" />{column.name}<span className="count">{tasks.filter(task => task.status === column.status).length}</span></h2><span className="ellipsis" aria-hidden="true">···</span></div>
          <p className="column-hint">{column.hint}</p>
          <div className="cards">{tasks.filter(task => task.status === column.status).map(task => <article className="task-card" key={task.id}>
            <span className={`badge ${column.status}`}>{column.name}</span><h3>{task.title}</h3>{task.description && <p className="description">{task.description}</p>}
            <div className="card-footer"><span>版本 {task.revision}</span><div><button disabled={disabled} aria-label={`编辑 ${task.title}`} onClick={() => { setError(''); setEditor({ original: task, input: { title: task.title, description: task.description, status: task.status } }); }}>编辑</button><button className="danger" disabled={disabled} aria-label={`删除 ${task.title}`} onClick={() => { if (window.confirm(`删除“${task.title}”？此操作无法撤销。`)) void change(() => api.remove(task)); }}>删除</button></div></div>
          </article>)}</div>
          {!loading && !tasks.some(task => task.status === column.status) && <p className="empty">还没有任务</p>}
          <button className="add-task" disabled={disabled} onClick={() => { setError(''); setEditor({ input: { ...empty, status: column.status } }); }}>＋ 添加任务</button>
        </section>)}
      </div>
      <footer className="page-footer">每一小步，都在让事情向前。</footer>
    </main>
    {editor && <div className="modal-backdrop"><section className="editor" role="dialog" aria-modal="true" aria-labelledby="editor-title"><form onSubmit={submit}>
      <div className="editor-heading"><h2 id="editor-title">{editor.original ? '编辑任务' : '新建任务'}</h2><button type="button" disabled={busy} aria-label="关闭编辑" onClick={() => setEditor(null)}>×</button></div>
      {error && <p className="error" role="alert">{error}</p>}
      {pending && <div className="notice"><span>有一次保存结果尚未确认。</span><button type="button" disabled={busy || readOnly} onClick={() => void change(() => api.recover())}>核对上次保存</button></div>}
      <label>标题<input autoFocus value={editor.input.title} disabled={busy || pending} onChange={event => setEditor({ ...editor, input: { ...editor.input, title: event.target.value } })} placeholder="这次想完成什么？" /></label>
      <label>说明<textarea value={editor.input.description} disabled={busy || pending} onChange={event => setEditor({ ...editor, input: { ...editor.input, description: event.target.value } })} rows={4} placeholder="补充细节（选填）" /></label>
      <label>状态<select value={editor.input.status} disabled={busy || pending} onChange={event => setEditor({ ...editor, input: { ...editor.input, status: event.target.value as Task['status'] } })}>{columns.map(column => <option key={column.status} value={column.status}>{column.name}</option>)}</select></label>
      <div className="editor-actions"><button type="button" disabled={busy} onClick={() => setEditor(null)}>取消</button><button className="primary" disabled={busy || pending || readOnly} type="submit">{busy ? '正在保存…' : '保存任务'}</button></div>
    </form></section></div>}
  </div>;
}
