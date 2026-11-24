import {useEffect,useRef,useState} from 'react';
import {WorkbenchApiError} from './workbench-api.js';
import {WorkbenchMcpSettings} from './workbench-mcp-settings.js';

type ModelSettings={configured:boolean;providerId:string|null;endpoint:string|null;model:string|null;hasApiKey:boolean;updatedAt:string|null};
type SettingsForm={providerId:string;endpoint:string;model:string;apiKey:string};
type ModelList={ok:boolean;status:number|null;models:string[];message:string};
type Api=(path:string,init?:RequestInit)=>Promise<unknown>;
const defaultForm:SettingsForm={providerId:'deepseek',endpoint:'https://api.deepseek.com',model:'deepseek-chat',apiKey:''};
const endpoint=(value:string)=>/^https?:\/\//i.test(value.trim())?value.trim():`https://${value.trim()}`;

function failure(error:unknown,fallback:string){
  if(!(error instanceof WorkbenchApiError))return fallback;
  return ({MODEL_ENDPOINT_INVALID:'请填写有效的 HTTPS Endpoint，本机服务可使用 HTTP。',MODEL_KEY_REQUIRED:'请填写此接入的 API Key；已保存密钥仅用于原 Provider 和 Endpoint。',MODEL_KEY_INVALID:'API Key 含换行或长度不合法。',MODEL_SETTINGS_INVALID:'请检查 Provider 和模型 ID。'}[error.code]??fallback);
}

export function WorkbenchSettings({api,onClose}:{api:Api;onClose:()=>void}){
  const [section,setSection]=useState<'model'|'mcp'>('model');
  const [saved,setSaved]=useState<ModelSettings|null>(null),[form,setForm]=useState<SettingsForm>(defaultForm),[busy,setBusy]=useState(true),[message,setMessage]=useState('');
  const [models,setModels]=useState<string[]>([]),[modelsBusy,setModelsBusy]=useState(false),[modelsMessage,setModelsMessage]=useState(''),[manual,setManual]=useState(false);
  const alive=useRef(true),modelGeneration=useRef(0),modelAbort=useRef<AbortController|null>(null),operationAbort=useRef<AbortController|null>(null);

  async function discover(connection:SettingsForm){
    modelAbort.current?.abort();
    const controller=new AbortController(),version=++modelGeneration.current;
    modelAbort.current=controller;setModelsBusy(true);setModelsMessage('正在获取可选模型…');
    try{
      const result=await api('/api/v1/settings/model:models',{method:'POST',headers:{'content-type':'application/json'},signal:controller.signal,body:JSON.stringify({providerId:connection.providerId,endpoint:endpoint(connection.endpoint),...(connection.apiKey.trim()?{apiKey:connection.apiKey.trim()}:{})})}) as ModelList;
      if(!alive.current||version!==modelGeneration.current)return;
      setModels(result.models);setModelsMessage(result.message);
      if(!result.ok||!result.models.length)setManual(true);
    }catch(error){
      if(!alive.current||version!==modelGeneration.current)return;
      setModels([]);setManual(true);setModelsMessage(failure(error,'获取模型列表失败，可重试或手动输入模型 ID。'));
    }finally{
      if(alive.current&&version===modelGeneration.current)setModelsBusy(false);
    }
  }

  useEffect(()=>{
    alive.current=true;
    const controller=new AbortController();operationAbort.current=controller;
    const escape=(event:KeyboardEvent)=>{if(event.key==='Escape')onClose();};
    window.addEventListener('keydown',escape);
    void api('/api/v1/settings/model',{signal:controller.signal}).then(value=>{
      if(!alive.current)return;
      const current=value as ModelSettings,next={providerId:current.providerId??defaultForm.providerId,endpoint:current.endpoint??defaultForm.endpoint,model:current.model??defaultForm.model,apiKey:''};
      setSaved(current);setForm(next);
      if(current.configured)void discover(next);
    }).catch(()=>{if(alive.current)setMessage('设置暂时无法加载，请关闭后重试。');}).finally(()=>{if(alive.current)setBusy(false);});
    return()=>{alive.current=false;modelGeneration.current++;modelAbort.current?.abort();operationAbort.current?.abort();window.removeEventListener('keydown',escape);};
  },[]);

  function editConnection(patch:Partial<SettingsForm>){
    modelGeneration.current++;modelAbort.current?.abort();setModelsBusy(false);setModels([]);setModelsMessage('接入信息已变化，请重新获取模型列表。');setMessage('');setForm(current=>({...current,...patch}));
  }

  async function save(){
    const controller=new AbortController();operationAbort.current=controller;setBusy(true);setMessage('');
    try{
      const value=await api('/api/v1/settings/model',{method:'PUT',headers:{'content-type':'application/json'},signal:controller.signal,body:JSON.stringify({...form,endpoint:endpoint(form.endpoint),...(form.apiKey.trim()?{apiKey:form.apiKey.trim()}:{apiKey:undefined})})}) as ModelSettings;
      if(!alive.current)return;
      setSaved(value);setForm(current=>({...current,providerId:value.providerId!,endpoint:value.endpoint!,model:value.model!,apiKey:''}));setMessage('已保存。重启服务后生效。');
    }catch(error){if(alive.current)setMessage(failure(error,'保存失败，请检查网络后重试。'));}
    finally{if(alive.current)setBusy(false);}
  }

  async function testConnection(){
    const controller=new AbortController();operationAbort.current=controller;setBusy(true);setMessage('正在测试已保存的连接…');
    try{
      const result=await api('/api/v1/settings/model:test',{method:'POST',signal:controller.signal}) as {ok:boolean;status:number|null};
      if(alive.current)setMessage((result.ok?'连接成功':'连接未通过')+(result.status?`（HTTP ${result.status}）`:'')+'。'+(result.ok?'':'请检查已保存的 Endpoint 和密钥。'));
    }catch(error){if(alive.current)setMessage(failure(error,'测试失败，请先保存配置或检查网络。'));}
    finally{if(alive.current)setBusy(false);}
  }

  return <div className="modal-backdrop" onClick={onClose}><section className="modal" role="dialog" aria-modal="true" aria-label="设置" onClick={event=>event.stopPropagation()}>
    <div className="modal-head"><h2>设置</h2><button onClick={onClose} aria-label="关闭设置">关闭</button></div>
    <nav className="settings-nav" aria-label="设置分类">
      <button type="button" aria-pressed={section==='model'} onClick={()=>setSection('model')}>模型设置</button>
      <button type="button" aria-pressed={section==='mcp'} onClick={()=>setSection('mcp')}>MCP 服务</button>
    </nav>
    {section==='mcp'?<WorkbenchMcpSettings api={api}/>:<>
    <h3>模型接入</h3><p className="muted">选择接入服务和模型。保存后需重启服务生效。</p>
    <label>Provider<input value={form.providerId} disabled={busy} onChange={event=>editConnection({providerId:event.target.value})} autoComplete="off" maxLength={64}/></label>
    <label>Endpoint<input value={form.endpoint} disabled={busy} onChange={event=>editConnection({endpoint:event.target.value})} autoComplete="off" inputMode="url" maxLength={500}/></label>
    <label>API Key<input type="password" value={form.apiKey} disabled={busy} placeholder={saved?.hasApiKey?'已保存，留空保持不变':'输入 API Key'} onChange={event=>editConnection({apiKey:event.target.value})} autoComplete="new-password" maxLength={500}/></label>
    <p className="muted settings-key-hint">密钥只保存在本机，不回显，也不写入数据库。</p>
    <label htmlFor="settings-model-choice">模型</label>
    <div className="settings-model-choice">
      <select id="settings-model-choice" value={manual?'$custom':form.model} disabled={busy} onChange={event=>{const value=event.target.value;setManual(value==='$custom');if(value!=='$custom')setForm(current=>({...current,model:value}));}}>
        {!models.includes(form.model)&&<option value={form.model}>{form.model}{saved?.model===form.model?'（当前配置）':''}</option>}
        {models.map(model=><option key={model} value={model}>{model}</option>)}
        <option value="$custom">手动输入模型 ID…</option>
      </select>
      <button disabled={busy||modelsBusy||!form.providerId.trim()||!form.endpoint.trim()} onClick={()=>void discover(form)}>{modelsBusy?'获取中…':models.length?'刷新列表':'获取模型列表'}</button>
    </div>
    {manual&&<label>自定义模型 ID<input value={form.model} disabled={busy} onChange={event=>setForm(current=>({...current,model:event.target.value}))} autoComplete="off" maxLength={128} placeholder="填写服务商提供的模型 ID"/></label>}
    <p className="muted settings-model-hint" role="status" aria-label="模型列表状态">{modelsMessage||'获取此接入的可选模型，也可以选择手动输入。'}</p>
    <div className="actions"><button disabled={busy||!saved?.configured} onClick={()=>void testConnection()} title="测试已保存的模型接入">测试连接</button><button className="primary" disabled={busy||!form.model.trim()} onClick={()=>void save()}>保存设置</button></div>
    {message&&<p role="status" aria-label="设置操作状态" className="settings-message">{message}</p>}
    <div className="settings-current"><span className={saved?.configured?'badge settings-connected':'badge'}>{saved?.configured?'已配置':'未配置'}</span><span>{saved?.model??'保存配置后即可使用'}{saved?.hasApiKey?' · 密钥已保存':''}</span></div>
    </>}
  </section></div>;
}
