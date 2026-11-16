import {randomBytes} from 'node:crypto';
import type {WorkbenchBoot} from './web/workbench-context.js';

const css = `
:root{
  --bg:#f7f7f5;--surface:#ffffff;--surface-muted:#fbfbfa;--text:#161616;--text-soft:#5f5f5b;--text-faint:#8a8a84;
  --border:#e7e6e1;--border-strong:#d6d5cf;--accent:#111111;--accent-text:#ffffff;--accent-soft:#f0efeb;
  --focus:#2f6feb;--notice:#fff8e8;--notice-border:#ecd9a7;--danger:#b42318;
  --radius:10px;--radius-lg:14px;--shadow:0 1px 2px rgba(20,20,20,.04),0 8px 24px rgba(20,20,20,.04);
  --mono:ui-monospace,SFMono-Regular,"SF Mono",Menlo,Consolas,"Liberation Mono",monospace;
  --sans:ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI","Helvetica Neue",Arial,"PingFang SC","Microsoft YaHei",sans-serif;
  color-scheme:light;
}
@media (prefers-color-scheme: dark){
  :root{--bg:#0e0e0d;--surface:#161615;--surface-muted:#1b1b1a;--text:#f2f2ef;--text-soft:#b4b4ae;--text-faint:#8b8b84;
  --border:#2a2a28;--border-strong:#3a3a37;--accent:#f2f2ef;--accent-text:#111111;--accent-soft:#232321;
  --focus:#7aa2ff;--notice:#2a2314;--notice-border:#5c4a20;color-scheme:dark;}
}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--text);font-family:var(--sans);font-size:15px;line-height:1.6;text-rendering:optimizeLegibility}
::selection{background:var(--accent);color:var(--accent-text)}
button,input,textarea,select{font:inherit;color:inherit}
a{color:var(--text);text-decoration:none;border-bottom:1px solid var(--border-strong)}
a:hover{border-bottom-color:var(--text)}
button{min-height:34px;padding:7px 12px;border:1px solid var(--border-strong);border-radius:8px;background:var(--surface);color:var(--text);cursor:pointer;transition:background .15s ease,border-color .15s ease,transform .05s ease}
button:hover:not(:disabled){background:var(--accent-soft);border-color:var(--border-strong)}
button:active:not(:disabled){transform:translateY(1px)}
button:disabled{opacity:.45;cursor:default}
button:focus-visible,a:focus-visible,input:focus-visible,textarea:focus-visible,select:focus-visible,[role=tab]:focus-visible{outline:2px solid var(--focus);outline-offset:2px}
.primary{background:var(--accent);border-color:var(--accent);color:var(--accent-text);font-weight:600}
.primary:hover:not(:disabled){background:var(--accent);filter:brightness(1.12)}
.bar{position:sticky;top:0;z-index:20;display:flex;align-items:center;gap:14px;flex-wrap:wrap;padding:12px 22px;background:color-mix(in srgb,var(--surface) 88%,transparent);backdrop-filter:saturate(1.4) blur(10px);border-bottom:1px solid var(--border)}
.bar .brand{font-family:var(--mono);font-size:12px;font-weight:700;letter-spacing:.14em;color:var(--text)}
.bar .muted{max-width:52ch;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bar .actions{margin-left:auto;display:flex;gap:8px;align-items:center}
.bar .result-notice,.bar .event-notice{flex-basis:100%;margin:0}
.result-notice{background:var(--accent-soft);border:1px solid var(--border);color:var(--text)}
.event-notice{display:flex;align-items:center;gap:10px;min-height:34px;padding:5px 0 0;border:0;background:transparent;color:var(--text-soft);font-size:13px}
.event-notice span{flex:1;min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.event-notice button{min-width:auto;min-height:28px;padding:3px 10px;font-size:12px}
.layout{display:grid;grid-template-columns:264px minmax(0,1fr) 348px;align-items:start;min-height:calc(100vh - 62px);max-width:1560px;margin:0 auto;border-left:1px solid var(--border);border-right:1px solid var(--border);background:var(--surface)}
.sidebar{padding:20px 14px;border-right:1px solid var(--border);background:var(--surface-muted);position:sticky;top:62px;height:calc(100vh - 62px);overflow:auto}
.sidebar h2,.detail h2{margin:0 0 12px;font-size:12px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--text-faint);font-family:var(--mono)}
.sidebar .primary{width:100%;justify-content:center;margin-bottom:14px}
.project-list{display:flex;flex-direction:column;gap:2px;margin:0 0 12px}
.project-list button{width:100%;min-height:36px;display:block;text-align:left;border:1px solid transparent;background:transparent;border-radius:8px;padding:7px 10px;color:var(--text-soft);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.project-list button:hover{background:var(--accent-soft);color:var(--text)}
.project-list button.selected{background:var(--accent-soft);border-color:var(--border);color:var(--text);font-weight:600}
.sidebar > button:not(.primary){width:100%;margin-top:4px}
.conversation{padding:34px 40px 120px;min-width:0;max-width:900px;margin:0 auto}
.conversation > h1{font-size:28px;line-height:1.2;letter-spacing:-.02em;margin:0 0 22px;font-weight:650}
h1,h2,h3{font-weight:600;letter-spacing:-.01em}
h2{font-size:17px;margin:0 0 10px}
h3{font-size:15px;margin:0 0 8px}
p{line-height:1.65;overflow-wrap:anywhere;white-space:pre-wrap;margin:0 0 12px}
.muted{color:var(--text-soft);font-size:13.5px}
.notice{padding:11px 14px;margin:14px 0;border:1px solid var(--notice-border);border-radius:var(--radius);background:var(--notice);color:var(--text);font-size:14px}
.notice button{margin-left:10px}
.card,.message{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg);padding:16px 18px;margin:12px 0;box-shadow:var(--shadow)}
.message{box-shadow:none}
.message .muted{display:block;margin-bottom:6px;font-size:12px;color:var(--text-faint)}
.message p{margin:0}
.tabs{display:flex;gap:2px;border-bottom:1px solid var(--border);margin:0 0 18px;overflow-x:auto;scrollbar-width:none}
.tabs::-webkit-scrollbar{display:none}
.tabs button{flex:none;border:0;border-bottom:2px solid transparent;border-radius:0;background:transparent;min-height:38px;padding:8px 11px;color:var(--text-soft);font-size:13.5px}
.tabs button:hover:not(:disabled){background:transparent;color:var(--text)}
.tabs button[aria-selected=true]{color:var(--text);border-bottom-color:var(--text);font-weight:600}
.detail{padding:22px 20px 80px;border-left:1px solid var(--border);background:var(--surface-muted);position:sticky;top:62px;height:calc(100vh - 62px);overflow:auto}
.detail section{color:var(--text)}
.composer,.planning,.attachments{border:1px solid var(--border);border-radius:var(--radius-lg);background:var(--surface);padding:14px;box-shadow:var(--shadow)}
.composer textarea,.planning textarea,textarea{width:100%;min-height:120px;resize:vertical;border:0;background:transparent;color:var(--text);padding:6px 2px;font-size:15px;line-height:1.65}
textarea:focus{outline:none}
.composer:focus-within,.planning:focus-within{border-color:var(--border-strong);box-shadow:0 0 0 3px color-mix(in srgb,var(--focus) 18%,transparent)}
input[type=text],input[type=search],select{width:100%;min-height:36px;padding:7px 10px;border:1px solid var(--border-strong);border-radius:8px;background:var(--surface);color:var(--text)}
input[type=file]{font-size:13px;color:var(--text-soft)}
label{display:block;font-size:13px;color:var(--text-soft);margin:10px 0 4px}
.actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.actions .primary{margin-left:auto}
.toolbar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:8px 0}
.badge,.status,.version,.eyebrow,.section-label{display:inline-flex;align-items:center;gap:5px;min-height:22px;padding:1px 8px;border:1px solid var(--border);border-radius:999px;background:var(--surface);color:var(--text-soft);font-family:var(--mono);font-size:11px;letter-spacing:.02em}
.section-label,.eyebrow{display:block;border:0;background:transparent;padding:0;margin:16px 0 8px;color:var(--text-faint);text-transform:uppercase;letter-spacing:.09em}
.hash,.commit{font-family:var(--mono);font-size:12px;color:var(--text-soft);word-break:break-all}
.row{display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap;padding:10px 0;border-bottom:1px solid var(--border)}
.row:last-child{border-bottom:0}
.topline{display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap}
.version-head,.job-head{display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap;margin-bottom:8px}
.jobs,.job-details,.history{display:flex;flex-direction:column;gap:8px}
.job{border:1px solid var(--border);border-radius:var(--radius);background:var(--surface);padding:10px 12px}
.pager{display:flex;gap:8px;align-items:center;justify-content:flex-end;margin:12px 0}
.source-links{display:flex;gap:8px;flex-wrap:wrap;margin:8px 0}
.source-text{font-size:13.5px;color:var(--text-soft)}
.empty{padding:22px;border:1px dashed var(--border-strong);border-radius:var(--radius-lg);color:var(--text-soft);text-align:center}
.footer{margin-top:26px;padding-top:14px;border-top:1px solid var(--border);color:var(--text-faint);font-size:12px}
.download{display:inline-flex;align-items:center;gap:6px}
.mobile-nav{display:none}
.model-progress{border:1px solid var(--border);border-radius:var(--radius);background:var(--surface);padding:10px 12px;font-size:13px}
.expected{color:var(--text-soft)}
.dag-scroll{overflow:auto;border:1px solid var(--border);border-radius:var(--radius);background:var(--surface);padding:8px}
ol,ul{padding-left:20px}
li{margin:4px 0}
@media (max-width:1180px){
  .layout{grid-template-columns:236px minmax(0,1fr) 300px}
  .conversation{padding:28px 26px 100px}
}
@media (max-width:980px){
  .layout{display:block;min-height:calc(100vh - 56px);border-left:0;border-right:0}
  .bar{padding:10px 14px}
  .bar .actions{margin-left:0}
  .mobile-nav{display:flex;gap:6px;width:100%}
  .mobile-nav button{flex:1;min-height:32px;padding:5px 8px;font-size:13px}
  .mobile-nav button[aria-pressed=true]{background:var(--accent);border-color:var(--accent);color:var(--accent-text)}
  .sidebar,.detail{display:none;position:static;height:auto;border:0;border-top:1px solid var(--border)}
  .sidebar.visible,.detail.visible{display:block}
  .conversation{display:none;padding:22px 16px 80px;max-width:none}
  .conversation.visible{display:block}
  .conversation > h1{font-size:23px}
  .event-notice{white-space:normal}
  .event-notice span{white-space:normal}
}
@media (prefers-reduced-motion: reduce){
  *{transition:none!important;scroll-behavior:auto!important}
}
`;

export function workbenchPage(value:WorkbenchBoot){
 const nonce=randomBytes(18).toString('base64url'),json=JSON.stringify(value).replaceAll('<','\\u003c').replaceAll('>','\\u003e').replaceAll('&','\\u0026').replaceAll('\u2028','\\u2028').replaceAll('\u2029','\\u2029');
 return {policy:`default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; connect-src 'self'; frame-src 'none'; frame-ancestors 'self'; base-uri 'none'; object-src 'none'; worker-src 'none'; form-action 'none'`,html:`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light dark"><title>工作台 · DevMesh</title><style nonce="${nonce}">${css}</style></head><body><div id="root"><main class="conversation"><h1>DevMesh 工作台</h1><p>正在加载工作台…</p><noscript>请启用JavaScript进入工作台。</noscript></main></div><script id="workbench-data" type="application/json" nonce="${nonce}">${json}</script><script defer nonce="${nonce}" src="/api/v1/workbench/client.js"></script></body></html>`};
}