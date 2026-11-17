/** Shared, local-only presentation for the protected workbench. */
export const workbenchStyles = `
:root{
 --bg:#f2f5fa;--surface:#fff;--surface-muted:#f8fafd;--text:#1c2941;--text-soft:#5c6b82;--text-faint:#6c7a90;
 --border:#e2e8f1;--border-strong:#c9d3e2;--accent:#304f92;--accent-hover:#233f79;--accent-text:#fff;--accent-soft:#edf2fc;
 --focus:#476ec0;--notice:#fff8e9;--notice-border:#e8d4a3;--danger:#b42318;--success:#237656;
 --radius:10px;--radius-lg:14px;--shadow:0 3px 14px #192b4d04;
 --mono:ui-monospace,SFMono-Regular,Consolas,monospace;
 --sans:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;color-scheme:light;
}
@media(prefers-color-scheme:dark){:root{
 --bg:#101622;--surface:#182130;--surface-muted:#1c2739;--text:#e4eaf5;--text-soft:#acbad0;--text-faint:#95a6bf;
 --border:#2e3b50;--border-strong:#465771;--accent:#adc4ff;--accent-hover:#c3d4ff;--accent-text:#15243e;--accent-soft:#253650;
 --focus:#a1bdff;--notice:#342d20;--notice-border:#75613e;--danger:#ffaaa3;--success:#8cd6b3;color-scheme:dark;
}}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%;scroll-padding-top:24px}
body{margin:0;background:var(--bg);color:var(--text);font-family:var(--sans);font-size:14px;line-height:1.6;text-rendering:optimizeLegibility}
::selection{background:var(--accent);color:var(--accent-text)}
button,input,textarea,select{font:inherit;color:inherit}
button,a,input,select,textarea{touch-action:manipulation}
button{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:36px;max-width:100%;padding:7px 12px;border:1px solid var(--border-strong);border-radius:8px;background:var(--surface);color:var(--text);cursor:pointer;line-height:1.5;transition:background .15s,border-color .15s}
button:hover:not(:disabled){background:var(--accent-soft);border-color:var(--focus)}
button:disabled{opacity:.5;cursor:default}
button:focus-visible,a:focus-visible,input:focus-visible,textarea:focus-visible,select:focus-visible,summary:focus-visible{outline:3px solid var(--focus);outline-offset:3px}
.primary{background:var(--accent);border-color:var(--accent);color:var(--accent-text);font-weight:600}
.primary:hover:not(:disabled){background:var(--accent-hover);border-color:var(--accent-hover)}
a{color:var(--accent);text-underline-offset:3px}
h1,h2,h3,h4{color:var(--text);font-weight:650;line-height:1.5;margin:0 0 12px;overflow-wrap:anywhere}
h1{font-size:25px;letter-spacing:-.035em}h2{font-size:16px}h3{font-size:14px}h4{font-size:13px}
p{line-height:1.75;overflow-wrap:anywhere;white-space:pre-wrap;margin:0 0 12px}
p:last-child{margin-bottom:0}
.muted{color:var(--text-soft);font-size:12px}
.ui-icon{flex:none;vertical-align:middle}
.bar{background:var(--surface);border-bottom:1px solid var(--border)}
.header-main{display:flex;align-items:center;gap:28px;min-height:76px;max-width:1800px;margin:auto;padding:16px 28px}
.brand{display:inline-flex;gap:10px;align-items:center;flex:none;font-size:21px;font-weight:750;letter-spacing:-.6px}
.brand-mark{width:34px;height:34px;display:grid;place-items:center;background:var(--accent);color:var(--accent-text);border-radius:10px}
.brand-mark svg{width:24px;height:24px}
.header-context{min-width:0;display:flex;align-items:center;gap:12px;border-left:1px solid var(--border);padding-left:24px}
.header-context>span:first-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text-soft)}
.context-badge{flex:none;border:1px solid var(--border);border-radius:6px;padding:2px 7px;font-size:11px;color:var(--text-soft);background:var(--surface-muted)}
.header-main>.actions{margin-left:auto;flex:none}
.header-status{display:flex;align-items:center;flex-wrap:wrap;gap:8px 24px;border-top:1px solid var(--border);padding:7px max(28px,calc((100vw - 1744px)/2));background:var(--surface-muted)}
.event-notice{display:flex;align-items:center;gap:10px;margin:0;color:var(--text-soft);font-size:12px;min-width:0}
.event-notice span{min-width:0;overflow-wrap:anywhere}
.event-notice button{min-height:27px;font-size:12px;padding:3px 9px;background:var(--surface)}
.connection-indicator{width:6px;height:6px;border-radius:50%;background:var(--text-faint);flex:none}
.event-notice[data-state=live] .connection-indicator{background:var(--success);box-shadow:0 0 0 3px color-mix(in srgb,var(--success) 9%,transparent)}
.header-status .event-notice:last-child{margin-left:auto}
.bar>.result-notice{margin:8px 24px}
.mobile-nav{display:none}
.layout{display:grid;grid-template-columns:224px minmax(0,1fr) minmax(380px,.88fr);align-items:start;gap:18px;max-width:1800px;min-height:calc(100dvh - 110px);margin:0 auto;padding:22px 24px 32px}
.sidebar,.detail{position:sticky;top:20px;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg);box-shadow:var(--shadow);min-width:0}
.sidebar{display:flex;flex-direction:column;padding:20px 14px;min-height:calc(100dvh - 156px);max-height:calc(100dvh - 40px);overflow:auto}
.sidebar-heading{display:flex;align-items:center;gap:9px;padding:0 7px 17px;color:var(--text-soft)}
.sidebar-heading h2{margin:0;font-size:13px;letter-spacing:.02em}
.sidebar .primary{width:100%;margin:0 0 24px;min-height:40px}
.nav-caption{font-size:11px;color:var(--text-faint);padding:0 9px;margin-bottom:9px;letter-spacing:.06em}
.project-list{display:flex;flex-direction:column;gap:5px;margin:0 0 12px}
.project-list button{justify-content:flex-start;gap:10px;min-height:43px;width:100%;text-align:left;border-color:transparent;background:transparent;color:var(--text-soft);padding:9px 11px}
.project-list .project-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.project-list .ui-icon{width:17px;height:17px;color:var(--text-faint)}
.project-list button.selected{background:var(--accent-soft);color:var(--accent);font-weight:600}
.project-list button.selected .ui-icon{color:var(--accent)}
.sidebar-footer{margin-top:12px;padding:20px 3px 0;border-top:1px solid var(--border);position:relative}
.sidebar-footer>button{justify-content:flex-start;width:100%;border:0;color:var(--text-soft)}
.sidebar-note{margin-top:auto;padding:18px 8px 8px;color:var(--text-faint);font-size:11px}
.conversation{min-width:0;padding:4px 8px 36px}
.workspace-heading{margin:0 0 24px}
.workspace-heading h1{margin:4px 0 6px}
.eyebrow,.section-label{color:var(--text-faint);font-size:10px;letter-spacing:.15em;text-transform:uppercase}
.workspace-heading>.eyebrow{display:flex;align-items:center;gap:7px}
.workspace-heading>.eyebrow .ui-icon{width:14px;height:14px}
.workspace-subtitle{color:var(--text-soft);font-size:13px}
.section-heading{display:flex;align-items:center;gap:9px;margin-bottom:14px}
.section-heading h2{margin:0;font-size:13px;color:var(--text-soft)}
.section-heading .ui-icon{color:var(--text-faint);width:16px;height:16px}
.card,.message{border:1px solid var(--border);border-radius:var(--radius-lg);background:var(--surface);padding:18px 20px;margin:0 0 18px;box-shadow:var(--shadow)}
.message{position:relative;border-left:3px solid color-mix(in srgb,var(--accent) 45%,var(--border));padding:17px 20px}
.message .muted{display:flex;align-items:center;gap:7px;margin-bottom:10px;font-size:11px}
.message p{font-size:14px;line-height:1.9}
.next-target{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:3px 12px;padding:14px 16px;background:var(--surface-muted);box-shadow:none}
.next-target h2{font-size:13px;margin:0 0 3px}
.next-target p{grid-column:1;font-size:12px;color:var(--text-soft);margin:0}
.next-target>button{grid-column:2;grid-row:1 / span 2;font-size:12px}
.next-target>.notice,.next-target>[role=alert]{grid-column:1 / -1}
.next-target.expanded{display:block}
.next-target.expanded p{margin-bottom:12px}
.composer{padding:20px;border-color:var(--border-strong);box-shadow:0 4px 22px #1d365e05}
.composer>h2{font-size:15px;margin-bottom:16px}
label{display:block;font-size:12px;font-weight:500;color:var(--text-soft);margin:12px 0 6px}
input:not([type=checkbox]):not([type=radio]):not([type=file]),select{width:100%;min-width:0;min-height:39px;padding:8px 11px;border:1px solid var(--border-strong);border-radius:8px;background:var(--surface);color:var(--text)}
textarea{display:block;width:100%;min-height:132px;resize:vertical;padding:12px 14px;border:1px solid var(--border-strong);border-radius:9px;background:var(--surface-muted);color:var(--text);font-size:14px;line-height:1.8}
textarea::placeholder,input::placeholder{color:var(--text-faint);opacity:1}
.composer:focus-within{border-color:var(--focus)}
.status,.badge,.version{display:inline-flex;align-items:center;gap:6px;min-height:23px;padding:2px 8px;border-radius:5px;background:var(--surface-muted);color:var(--text-soft);font-size:11px;border:1px solid var(--border)}
.composer .status{margin:9px 0 14px;font-weight:400;max-width:100%}
.composer .status:before{content:'';width:5px;height:5px;background:currentColor;border-radius:50%;flex:none}
.attachments{border-top:1px solid var(--border);padding:14px 0 4px;margin-bottom:14px}
.attachments h3{font-size:12px;margin:0 0 5px}
.attachments>p.muted{font-size:11px;line-height:1.65;margin-bottom:10px}
.attachments>label{font-size:11px;margin:8px 0 5px}
input[type=file]{display:block;width:100%;font-size:11px;color:var(--text-soft);padding:7px;border:1px dashed var(--border-strong);border-radius:7px;background:var(--surface-muted)}
input[type=file]::file-selector-button{font:inherit;border:0;background:var(--accent-soft);color:var(--accent);padding:5px 8px;border-radius:4px;margin-right:8px;cursor:pointer}
.attachments>button{font-size:11px;min-height:28px;padding:3px 7px;border-color:transparent;color:var(--text-soft);margin-top:7px}
.attachments>p.muted:last-of-type{margin:7px 0 0}
.attachments .card{margin:12px 0;padding:12px}
.actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.composer form>.actions{padding-top:14px;border-top:1px solid var(--border);flex-direction:row-reverse;justify-content:space-between;gap:10px}
.composer form>.actions .muted{font-size:10px}
.composer form>.actions .primary{min-height:38px}
.notice{border:1px solid var(--notice-border);background:var(--notice);border-radius:8px;padding:11px 13px;margin:14px 0;font-size:12px;line-height:1.8}
.notice button{margin:6px 0 0 6px;font-size:12px}
.result-notice{background:var(--accent-soft);border-color:var(--border);color:var(--text)}
.detail{padding:0 20px 22px;max-height:calc(100dvh - 40px);overflow:auto;min-height:calc(100dvh - 156px)}
.detail-heading{display:flex;align-items:center;gap:7px;padding:18px 0 13px}
.detail-heading h2{margin:0;font-size:12px;color:var(--text-soft)}
.detail-heading .ui-icon{color:var(--text-faint);width:16px;height:16px}
.tabs{display:flex;gap:4px;margin:0 -4px 22px;padding:4px;border-radius:9px;background:var(--surface-muted);border:1px solid var(--border)}
.tabs button{flex:1;min-width:0;gap:5px;min-height:35px;padding:6px 4px;border-color:transparent;background:transparent;font-size:12px;color:var(--text-soft);border-radius:6px;white-space:nowrap}
.tabs button .ui-icon{width:14px;height:14px}
.tabs button[aria-selected=true]{color:var(--accent);background:var(--surface);border-color:var(--border);box-shadow:0 1px 3px #192b4d09;font-weight:650}
.planning{border:0;background:transparent;padding:0}
.planning>nav{display:flex;align-items:center;gap:10px;margin-bottom:18px;padding-bottom:14px;border-bottom:1px solid var(--border);font-size:11px;color:var(--text-soft)}
.planning section>h2{font-size:17px}
.planning section>p{font-size:13px}
.planning details{margin:14px 0}
details{font-size:12px;margin:12px 0}summary{cursor:pointer;color:var(--text-soft);padding:5px 0}
details[open]>summary{margin-bottom:8px;color:var(--text)}
.toolbar,.topline,.row,.version-head,.job-head{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px}
.toolbar{justify-content:flex-start;margin:8px 0}
.row{padding:10px 0;border-bottom:1px solid var(--border)}
.hash,.commit{font:11px var(--mono);overflow-wrap:anywhere;color:var(--text-soft)}
.source-text{white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px}
.source-links,.pager{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}
.jobs,.job-details,.history{display:flex;flex-direction:column;gap:10px}
.job,.model-progress{padding:12px;border:1px solid var(--border);border-radius:8px;background:var(--surface-muted)}
.model-progress{margin-top:18px;font-size:12px}
.model-progress pre{white-space:pre-wrap;overflow-wrap:anywhere;max-height:240px;overflow:auto;font:11px/1.8 var(--mono)}
.expected{color:var(--text-soft)}
.dag-scroll{overflow:auto;max-width:100%;padding:8px;border:1px solid var(--border);border-radius:8px;background:var(--surface-muted)}
.empty{padding:20px;border:1px dashed var(--border-strong);border-radius:10px;color:var(--text-soft);text-align:center}
.welcome{padding:8px 0 14px;margin-bottom:12px}
.welcome-badge{display:grid;place-items:center;width:42px;height:42px;border:1px solid var(--border);border-radius:12px;background:var(--surface);color:var(--accent);margin-bottom:18px}
.welcome h1{font-size:29px;margin-bottom:12px}
.welcome p{font-size:13px;color:var(--text-soft);max-width:48ch}
.workflow-guide{list-style:none;padding:0;margin:0;counter-reset:step}
.workflow-guide li{position:relative;padding:0 0 25px 36px;margin:0;counter-increment:step}
.workflow-guide li:before{content:counter(step,decimal-leading-zero);position:absolute;left:0;top:2px;font:10px var(--mono);color:var(--accent);background:var(--accent-soft);border-radius:7px;width:25px;height:25px;display:grid;place-items:center}
.workflow-guide li:not(:last-child):after{content:'';position:absolute;left:12px;top:32px;bottom:6px;width:1px;background:var(--border)}
.workflow-guide h3{font-size:13px;margin-bottom:6px}.workflow-guide p{font-size:12px;color:var(--text-soft);margin:0}
.guide-note{border-top:1px solid var(--border);padding-top:16px;font-size:11px;color:var(--text-soft)}
ol,ul{padding-left:20px}li{margin:5px 0;overflow-wrap:anywhere}
.more-menu{position:absolute;left:0;right:0;bottom:calc(100% + 6px);z-index:30;display:flex;flex-direction:column;padding:6px;border:1px solid var(--border);border-radius:10px;background:var(--surface);box-shadow:0 10px 30px #0002}
.more-menu button{text-align:left;justify-content:flex-start;border:0}
.modal-backdrop{position:fixed;inset:0;z-index:100;display:flex;align-items:center;justify-content:center;padding:20px;background:#101b3866;backdrop-filter:blur(3px)}
.modal{width:min(520px,100%);max-height:90dvh;overflow:auto;background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:24px;box-shadow:0 25px 80px #0003}
.modal-head{display:flex;align-items:center;justify-content:space-between;padding-bottom:16px;margin-bottom:18px;border-bottom:1px solid var(--border)}
.modal-head h2{margin:0;font-size:19px}.modal .actions{margin:20px 0}.modal .actions .primary{margin-left:auto}
.settings-model-choice{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center}.settings-model-choice select{margin:0;min-width:0}.settings-model-choice button{white-space:nowrap}
.settings-key-hint{margin:-2px 0 18px}.settings-model-hint{min-height:20px;margin:8px 0 0;overflow-wrap:anywhere}.settings-current{display:flex;align-items:center;gap:8px;padding-top:16px;border-top:1px solid var(--border);font-size:12px;color:var(--text-soft);overflow-wrap:anywhere}.settings-connected{color:var(--success)}
.settings-message{margin:14px 0;padding:12px;border:1px solid var(--border);background:var(--accent-soft);border-radius:8px}
.footer{border-top:1px solid var(--border);margin-top:20px;padding-top:12px;color:var(--text-faint);font-size:11px}
@media(min-width:1600px){.layout{grid-template-columns:238px minmax(0,1fr) minmax(420px,.9fr);gap:24px}.conversation{padding:6px 18px 40px}}
@media(max-width:1180px) and (min-width:981px){.layout{grid-template-columns:190px minmax(0,1fr) 350px;gap:12px;padding:16px}.conversation{padding:0}.composer,.message{padding:15px}.detail{padding:0 14px 20px}.tabs button .ui-icon{display:none}.header-context{padding-left:16px}.header-main{gap:16px;padding-inline:20px}}
@media(min-width:981px){
 #root{display:flex;flex-direction:column;height:100dvh;overflow:hidden}
 .bar{flex:none}
 .layout{flex:1;min-height:0;width:100%;grid-template-rows:minmax(0,1fr);align-items:stretch;padding-bottom:22px}
 .sidebar,.detail,.conversation{position:relative;top:auto;height:100%;min-height:0;max-height:none;border:1px solid var(--border);border-radius:var(--radius-lg);background:var(--surface);box-shadow:var(--shadow)}
 .sidebar{overflow:hidden}
 .sidebar-heading,.sidebar>.primary,.nav-caption,.sidebar-note,.sidebar-footer{flex:none}
 .project-list{flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;scrollbar-gutter:stable}
 .project-list button{flex:none}
 .detail{overflow-y:auto;overscroll-behavior:contain}
 .conversation{display:flex;flex-direction:column;overflow-y:auto;overscroll-behavior:contain;padding:24px}
 .conversation>*{flex-shrink:0}
 .conversation>.composer{border:0;padding:0;margin-bottom:0;box-shadow:none}
 .conversation>.composer:focus-within{border-color:transparent}
 .conversation:has(.welcome) .composer>h2{display:none}
 .conversation:has(.welcome) .composer form>label:first-of-type{margin-top:0}
 .welcome{padding:0 0 20px;margin:0 0 20px;border-bottom:1px solid var(--border)}
 .welcome-badge{display:none}
 .welcome>.eyebrow{display:none}
 .welcome h1{font-size:25px;margin:0 0 10px}
 .welcome p{max-width:none;margin:0}
}
@media(max-width:980px){
 .header-main{padding:14px 16px;gap:12px;min-height:70px;flex-wrap:wrap}.brand{font-size:19px}.brand-mark{width:30px;height:30px}
 .header-context{flex:1;padding-left:12px;gap:7px}.header-context>span:first-child{font-size:12px}.context-badge{font-size:10px}
 .header-main>.actions{margin-left:auto}.header-main>.actions button{font-size:11px;padding:5px 8px;min-height:32px}.header-main>.actions .ui-icon{width:14px;height:14px}
 .header-status{padding:9px 16px;gap:7px}.header-status .event-notice:last-child{margin-left:0}.event-notice{font-size:11px;flex:1 1 100%;justify-content:space-between}.event-notice .connection-indicator{display:none}
 .bar>.result-notice{margin:10px 16px}
 .mobile-nav{display:flex;gap:5px;padding:0 16px 12px}.mobile-nav button{flex:1;min-height:36px;font-size:12px;border-color:transparent;background:var(--surface-muted);color:var(--text-soft)}.mobile-nav button[aria-pressed=true]{background:var(--accent-soft);color:var(--accent);border-color:var(--border)}
 .layout{display:block;min-height:calc(100dvh - 120px);padding:18px 16px 32px}
 .sidebar,.detail,.conversation{display:none;position:static;max-height:none;min-height:0;width:100%}
 .sidebar.visible{display:flex;min-height:65dvh}.detail.visible,.conversation.visible{display:block}
 .conversation{padding:0}.workspace-heading{margin-bottom:20px}.workspace-heading h1{font-size:23px}
 .detail{padding:0 16px 22px}.detail-heading{padding-top:16px}.tabs{margin-bottom:20px}.tabs button{font-size:12px;min-height:38px}.tabs button .ui-icon{width:13px;height:13px}
 .card,.message{padding:16px;margin-bottom:14px}.composer{padding:17px}.next-target{grid-template-columns:1fr;gap:8px}.next-target>button{grid-row:auto;grid-column:1;justify-self:start;min-height:34px}.next-target h2{margin-bottom:0}
 .composer form>.actions{align-items:flex-start}.composer form>.actions .primary{width:100%}.composer form>.actions .muted{width:100%;text-align:center}
 .welcome h1{font-size:26px}.welcome{padding:0 0 8px}.welcome-badge{margin-bottom:14px}
}
@media(max-width:480px){.header-context{order:3;flex-basis:100%;border:0;padding:0}.header-main{gap:10px}.header-main>.actions{margin-left:auto}.brand{font-size:19px}.header-status{border-top:0}.modal{padding:18px}.notice button{margin-left:0}}
@media(prefers-reduced-motion:reduce){*{transition:none!important;scroll-behavior:auto!important}}
`;
