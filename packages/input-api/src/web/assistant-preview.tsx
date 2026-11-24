import {createPortal} from 'react-dom';
export function AssistantPreview({url,onClose}:{url:string;onClose:()=>void}){
 return createPortal(<div className="conversation-shell generated-preview-portal"><div className="modal-backdrop"><section className="modal generated-preview" role="dialog" aria-modal="true" aria-label="生成页面预览"><div className="modal-head"><h2>页面预览</h2><button onClick={onClose}>关闭预览</button></div><iframe src={url} sandbox="allow-scripts" title="生成的 HTML 页面"/><p className="muted">隔离预览已限制网络和父页面访问；预览数据仅在当前窗口保留。</p></section></div></div>,document.body);
}
