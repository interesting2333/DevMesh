import type {WorkbenchLiveStream} from './workbench-live.js';
const names={product:'需求分析',architect:'方案设计',developer:'开发',tester:'测试'};
export function WorkbenchModelProgress({streams}:{streams:WorkbenchLiveStream[]}){
 if(!streams.length)return null;
 return <section className="model-progress" aria-label="模型临时输出"><h3>模型输出</h3><p className="muted">临时片段仅供阅读；刷新和重连不会恢复未保存片段，业务结果以已保存记录为准。</p>{streams.map(stream=><article className="card" key={stream.streamId}><h4>{names[stream.role]}</h4><p>{stream.state==='streaming'?'正在生成，片段尚未保存。':stream.state==='persisted'?'模型响应已保存；后续处理结果另行更新。':'临时输出已中断，片段未恢复。请查看已保存进展。'}</p>{stream.text&&<pre className="source-text">{stream.text}</pre>}</article>)}</section>;
}
