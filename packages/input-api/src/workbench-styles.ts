/** Shared, local-only presentation for the protected workbench. */
export const workbenchStyles = `
:root{
 --bg:#19191c;--surface:#19191c;--surface-muted:#222225;--text:#e9e9eb;--text-soft:#adadb3;--text-faint:#8b8b94;
 --border:#303034;--border-strong:#414146;--accent:#f2f0eb;--accent-hover:#fff;--accent-text:#19191c;--accent-soft:#28282d;
 --focus:#b9b9c2;--notice:#302a20;--notice-border:#63553c;--danger:#ffa3a3;--success:#7dcc92;
 --radius:8px;--radius-lg:10px;--shadow:none;
 --mono:ui-monospace,SFMono-Regular,Consolas,monospace;
 --sans:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei UI",sans-serif;color-scheme:dark;
}
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
/* Approved Paseo-inspired desktop workspace. */
:root{--sidebar-width:260px;--sidebar:#121214;--composer:#222225;--content-width:1024px}
#root{display:grid;grid-template-columns:var(--sidebar-width) minmax(0,1fr);grid-template-rows:auto minmax(0,1fr);height:100dvh;overflow:hidden}
.layout{display:contents}
.bar{grid-column:2;grid-row:1;background:var(--bg);min-width:0;z-index:20}
.header-main{min-height:60px;height:60px;max-width:none;padding:0 28px;gap:16px}
.header-context{border:0;padding:0;gap:12px;flex:1;font-size:15px;min-width:0}
.header-context>span:first-child{flex:none;color:var(--text-soft)}
.breadcrumb-slash{color:var(--text-faint)}
.breadcrumb-current{white-space:nowrap;text-overflow:ellipsis;overflow:hidden;color:var(--text);min-width:0}
.context-badge{background:transparent;border-color:var(--border);color:var(--text-soft)}
.header-main>.actions{margin:0;gap:8px;flex:none}
.header-main button{background:transparent;border-color:transparent;min-height:32px;padding:4px 8px;font-size:13px;color:var(--text-soft)}
.header-main button:hover:not(:disabled){background:var(--accent-soft);color:var(--text);border-color:transparent}
.header-main .ui-icon{width:18px;height:18px}
.header-main .detail-toggle{gap:9px}
.detail-toggle .ui-icon:last-child{width:13px;height:13px}
.icon-button{width:32px;min-width:32px;padding:4px}
.header-status{background:var(--bg);padding:6px 28px;gap:8px 20px;border-top:0}
.header-status .event-notice{font-size:11px}
.header-status button{background:transparent;border-color:var(--border)}
.sidebar{grid-column:1;grid-row:1 / -1;position:relative;top:auto;height:100%;min-height:0;max-height:none;padding:0 12px;overflow:hidden;border:0;border-right:1px solid var(--border);border-radius:0;box-shadow:none;background:var(--sidebar)}
.sidebar-brand{display:flex;align-items:center;gap:12px;height:60px;flex:none;margin:0 -12px 18px;padding:0 26px;font-size:23px;font-weight:600;letter-spacing:-.6px}
.sidebar-brand .ui-icon{width:28px;height:30px;color:var(--text)}
.new-project{flex:none;width:100%;height:44px;justify-content:flex-start;gap:14px;padding:0 16px;margin:0 0 5px;border:0;border-radius:6px;background:transparent;font-size:15px;font-weight:450}
.new-project.selected{background:#29292d;color:var(--text)}
.new-project:hover:not(:disabled){background:#2d2d32;border:0}
.new-project .ui-icon{width:20px;height:20px}
.project-search{display:flex;align-items:center;gap:14px;flex:none;margin:0 0 34px;padding:0 16px;height:42px;color:var(--text-soft)}
.project-search .ui-icon{width:20px;height:20px;flex:none}
.project-search input:not([type=checkbox]):not([type=radio]):not([type=file]){font-size:14px;height:36px;min-height:0;width:100%;min-width:0;padding:3px 0;background:transparent;border:0;border-radius:3px}
.project-search input::placeholder{color:var(--text-soft)}
.nav-caption{flex:none;font-size:12px;padding:0 14px;margin:0 0 14px;color:var(--text-faint);letter-spacing:0}
.project-list{flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;margin:0;gap:4px;scrollbar-gutter:stable}
.project-list button{height:44px;min-height:44px;padding:0 14px;gap:12px;font-size:14px;font-weight:400;color:var(--text);border:0;border-radius:6px;background:transparent;flex:none}
.project-list button:hover:not(:disabled){background:#242428;border:0}
.project-list button.selected{background:#29292f;color:var(--text);font-weight:500}
.project-list .ui-icon,.project-list button.selected .ui-icon{width:18px;height:18px;color:var(--text-soft)}
.sidebar-empty{color:var(--text-faint);font-size:12px;padding:0 14px;margin:0 0 24px;flex:none}
.sidebar-footer{display:flex;align-items:center;justify-content:space-between;gap:8px;flex:none;margin:16px 0 0;padding:14px 0;border-top:1px solid var(--border);position:relative}
.sidebar-footer>button{min-height:32px;width:auto;padding:4px 7px;font-size:12px;border:0;background:transparent;color:var(--text-soft)}
.sidebar-footer>button .ui-icon{width:18px;height:18px}
.sidebar-footer>.icon-button{width:30px;min-width:30px}
.local-workspace{display:flex;align-items:center;justify-content:center;gap:7px;white-space:nowrap;font-size:11px;color:var(--text-soft)}
.local-workspace i{width:6px;height:6px;border-radius:50%;background:var(--success);flex:none}
.more-menu{background:#222225;border-color:var(--border-strong);box-shadow:0 8px 25px #0004}
.conversation{grid-column:2;grid-row:2;display:flex;flex-direction:column;min-width:0;min-height:0;height:100%;padding:0;overflow:hidden;border:0;border-radius:0;background:var(--bg);box-shadow:none}
.conversation-output{flex:1;min-height:0;overflow:auto;overscroll-behavior:contain;scrollbar-gutter:stable;padding:28px max(32px,calc((100% - var(--content-width))/2 + 24px))}
.conversation-output:has(>.welcome){display:flex;flex-direction:column;justify-content:safe center}
.conversation-output>.welcome{flex:none;padding:0;margin:0 0 32px;border:0;width:100%}
.welcome h1{font-size:30px;font-weight:600;letter-spacing:-.7px;margin:0 0 10px;line-height:1.5}
.welcome p{font-size:16px;line-height:1.8;max-width:none;color:var(--text-soft);margin:0}
.starter-heading{display:flex;justify-content:space-between;gap:12px;margin:34px 0 12px;font-size:12px;color:var(--text-faint)}
.starter-heading>span:last-child{font-size:11px}
.starter-examples{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
.starter-example{display:flex;flex-direction:column;align-items:stretch;justify-content:flex-start;gap:9px;min-width:0;padding:18px;border:1px solid #343439;border-radius:12px;background:#202023;text-align:left;line-height:1.6}
.starter-example:hover:not(:disabled){background:#28282c;border-color:#585861}
.starter-example:disabled{opacity:.65}
.starter-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:5px}
.starter-icon{display:grid;place-items:center;width:34px;height:34px;border:1px solid #3a3a40;border-radius:9px;background:#29292e;color:#d2d2d8}
.starter-icon .ui-icon{width:18px;height:18px}
.starter-top>.ui-icon{width:16px;height:16px;color:var(--text-faint)}
.starter-example strong{font-size:14px;font-weight:550;color:var(--text)}
.starter-description{font-size:12px;color:var(--text-soft);line-height:1.8}
.workspace-heading{margin:0 0 24px}.workspace-heading h1{font-size:23px;margin:0 0 6px}
.workspace-title{display:flex;align-items:center;gap:12px;min-width:0;flex-wrap:wrap}
.workspace-title h1{min-width:0;margin-right:auto}
.rename-project{font-size:11px;min-height:28px;padding:3px 8px;color:var(--text-faint);background:transparent;border-color:transparent}
.workspace-subtitle{font-size:12px;color:var(--text-faint)}
.conversation-planning{border-top:1px solid var(--border);margin-top:24px;padding-top:24px}
.conversation-output .message{border:0;border-radius:0;background:transparent;padding:14px 0;margin:0 0 16px;box-shadow:none}
.composer-dock{flex:none;max-height:48%;overflow:auto;overscroll-behavior:contain;padding:12px max(32px,calc((100% - var(--content-width))/2)) 36px;border:0;background:var(--bg)}
.composer-dock:empty{display:none}
.composer-dock .composer{margin:0;padding:20px 22px 16px;border:1px solid #424247;border-radius:18px;background:var(--composer);box-shadow:none}
.composer-dock .composer:focus-within{border-color:#68686f}
.composer-dock .composer>h2{display:none}
.composer-dock .composer form{position:relative;display:flex;flex-direction:column}
.composer-dock .composer textarea{order:0;display:block;min-height:96px;height:110px;max-height:220px;margin:0 0 14px;padding:0;resize:vertical;border:0;border-radius:0;background:transparent;box-shadow:none;line-height:1.8;font-size:16px}
.composer-dock .composer textarea:focus-visible{outline:0}
.composer-dock .composer textarea::placeholder{color:#a0a0a7}
.composer-dock .composer .attachments{order:1;margin:0;padding:0;border:0;background:transparent}
.attachment-picker{position:absolute;left:0;bottom:3px;display:flex;align-items:center;gap:8px;max-width:calc(100% - 140px);height:34px}
.attachment-picker input[type=file].sr-only{width:1px;height:1px;min-height:0;left:0;top:0;padding:0;border:0}
.attachment-add{display:inline-flex;align-items:center;gap:8px;margin:0!important;padding:3px 0;font-size:13px!important;font-weight:400;color:var(--text-soft);cursor:pointer}
.attachment-add:has(+input:disabled){opacity:.5;cursor:default}
.attachment-picker:focus-within .attachment-add{outline:2px solid var(--focus);outline-offset:3px;border-radius:3px}
.composer-dock .composer form>.actions{position:sticky;bottom:0;z-index:1;display:flex;flex-direction:row;justify-content:flex-end;align-items:center;order:3;flex-wrap:wrap;margin:0;padding:0;min-height:40px;border:0;background:transparent;pointer-events:none}
.composer-dock .composer form>.actions>button{pointer-events:auto}
.composer-dock .composer form>.actions .primary{min-height:38px;min-width:108px;padding:7px 13px;background:var(--accent);border-color:transparent;color:var(--accent-text);font-size:14px;font-weight:550;gap:8px;border-radius:10px}
.composer-dock .composer form>.actions .primary:disabled{opacity:.42}
.composer-dock .composer form>.actions .primary .ui-icon{width:18px;height:18px}
.attachment-list{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 14px;max-height:120px;overflow:auto;overscroll-behavior:contain}
.attachment-chip{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:3px 10px;align-items:center;flex:1 1 240px;min-width:0;max-width:100%;padding:8px 10px;border:1px solid var(--border-strong);border-radius:8px;background:#29292d}
.attachment-chip .attachment-file{display:flex;align-items:center;gap:8px;min-width:0;margin:0;font-size:12px}
.attachment-file strong{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:500}
.attachment-file>.muted{flex:none;font-size:10px}
.attachment-chip .attachment-state{grid-column:1;font-size:10px;color:var(--text-faint);margin:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.attachment-chip .actions{grid-column:2;grid-row:1 / span 2;gap:4px;margin:0}
.attachment-chip .actions button{font-size:10px;min-height:26px;padding:2px 5px;border:0;background:transparent;color:var(--text-soft)}
.attachment-library{width:min(640px,100%)}.attachment-library .card{margin-top:12px}
.composer.dragging{border-color:var(--focus)!important;outline:2px dashed var(--focus);outline-offset:3px;background:#29292e!important}
.detail{display:none;min-width:0;height:100%;min-height:0;max-height:none;overflow:auto;position:relative;top:auto;padding:0 16px 20px;border:0;border-left:1px solid var(--border);border-radius:0;background:var(--sidebar);box-shadow:none}
.detail-open>.detail{display:block;grid-column:3;grid-row:1 / -1}
#root:has(.detail-open){grid-template-columns:var(--sidebar-width) minmax(0,1fr) 320px}
.detail-heading{display:flex;align-items:center;gap:8px;min-height:60px;padding:0;border-bottom:1px solid var(--border);margin-bottom:16px}
.detail-heading h2{font-size:13px;font-weight:500}
.detail-heading>button{margin-left:auto;border:0;background:transparent;min-height:28px;width:28px;padding:0;font-size:20px;color:var(--text-soft)}
.detail .tabs{display:flex;gap:3px;flex-wrap:wrap;margin:0 0 20px;padding:3px;background:transparent;border-color:var(--border);border-radius:7px}
.detail .tabs button{flex:1 1 auto;font-size:11px;padding:6px 4px;min-width:0}
.detail .tabs .ui-icon{display:none}.tabs button[aria-selected=true]{background:var(--accent-soft);box-shadow:none;color:var(--text)}
.detail-backdrop{display:none}
.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap;border:0}
[hidden]{display:none!important}
.modal-backdrop{background:#0008;backdrop-filter:blur(4px)}
.modal{background:#1f1f22;border-color:var(--border-strong);border-radius:12px}
.notice{background:var(--notice);border-color:var(--notice-border)}
.dag-scroll rect{fill:var(--surface-muted);stroke:var(--border-strong)}.dag-scroll text{fill:var(--text-soft)}.dag-scroll path{stroke:var(--text-faint)}.dag-scroll marker path{fill:var(--text-faint)}
button:focus-visible,a:focus-visible,input:focus-visible,textarea:focus-visible,select:focus-visible,summary:focus-visible{outline:2px solid var(--focus);outline-offset:3px}
@media(min-width:1440px){:root{--sidebar-width:288px}}
@media(min-width:981px) and (max-width:1199px){#root:has(.detail-open){grid-template-columns:var(--sidebar-width) minmax(0,1fr)}.detail-open>.detail{grid-column:2;grid-row:2;justify-self:end;width:320px;z-index:31}.detail-backdrop:not([hidden]){display:block;grid-column:2;grid-row:2;position:relative;inset:auto;z-index:30;width:100%;height:100%;border:0;border-radius:0;background:#0006}}
@media(max-width:980px){
 #root,#root:has(.detail-open){grid-template-columns:minmax(0,1fr);grid-template-rows:auto minmax(0,1fr)}
 .bar{grid-column:1}.header-main{padding:0 16px;height:52px;min-height:52px;gap:10px}.header-context{font-size:13px;gap:8px}.header-context>span:first-child{display:none}.breadcrumb-slash{display:none}.header-main .detail-toggle{font-size:12px;gap:6px}
 .mobile-nav{display:flex;gap:6px;padding:0 12px 10px}.mobile-nav button{flex:1;min-height:30px;font-size:12px;background:transparent;color:var(--text-soft);border-color:transparent}.mobile-nav button[aria-pressed=true]{background:var(--accent-soft);color:var(--text)}
 .header-status{padding:5px 14px;gap:6px}.header-status .event-notice:last-child{margin:0}.event-notice{flex-wrap:wrap;font-size:10px}
 .sidebar{display:none;grid-column:1;grid-row:2;border:0}.sidebar.visible{display:flex}.sidebar-brand{height:48px;margin-bottom:8px;font-size:21px}.project-search{margin-bottom:18px}
 .conversation{display:none;grid-column:1;grid-row:2}.conversation.visible{display:flex}
 .conversation-output{padding:24px}.conversation-output>.welcome{margin:12px 0}.welcome h1{font-size:25px}.welcome p{font-size:14px}
 .starter-heading{margin-top:24px}.starter-heading>span:last-child{display:none}.starter-examples{grid-template-columns:minmax(0,1fr);gap:8px}.starter-example{display:grid;grid-template-columns:34px minmax(0,1fr) 16px;gap:3px 12px;padding:12px 14px;align-items:center}.starter-top{display:contents}.starter-icon{grid-column:1;grid-row:1 / span 2}.starter-top>.ui-icon{grid-column:3;grid-row:1 / span 2}.starter-example strong{grid-column:2;font-size:13px}.starter-description{grid-column:2;font-size:11px}
 .composer-dock{padding:12px 16px 20px;max-height:55%}.composer-dock .composer{padding:16px 16px 12px;border-radius:15px}.composer-dock .composer textarea{font-size:14px;height:90px;min-height:70px}
 .composer-dock .composer form>.actions .primary{width:auto;min-width:94px;font-size:12px;min-height:36px}.attachment-picker{max-width:calc(100% - 108px)}.attachment-add{font-size:12px!important}.attachment-chip{flex-basis:100%}
 .detail-open>.detail{grid-column:1;grid-row:2;justify-self:end;position:relative;inset:auto;width:min(340px,calc(100vw - 16px));z-index:31;box-shadow:-15px 0 40px #0003}
 .detail-backdrop:not([hidden]){display:block;grid-column:1;grid-row:2;position:relative;inset:auto;z-index:30;width:100%;height:100%;border:0;border-radius:0;background:#0006}
 .modal{padding:18px}.modal-backdrop{padding:14px}.workspace-title h1{font-size:21px}
}
@media(prefers-reduced-motion:reduce){*{transition:none!important;scroll-behavior:auto!important}}


/* Continuous conversation uses the approved workspace shell. */
.chat-message{padding:18px 0 24px;max-width:100%;overflow-wrap:anywhere}
.chat-author{display:flex;align-items:center;gap:9px;margin-bottom:9px;font-size:12px;color:var(--text-soft)}
.chat-author .ui-icon{width:17px;height:17px}.chat-message p{font-size:14px;line-height:1.9;white-space:pre-wrap;margin-bottom:8px}
.chat-text h3{font-size:16px;line-height:1.6;margin:14px 0 8px}.chat-text ul,.chat-text ol{padding-left:22px;margin:12px 0 16px}.chat-text li{font-size:14px;line-height:1.9;margin:5px 0}.chat-text strong{font-weight:600;color:var(--text)}.chat-text code{font:12px/1.7 ui-monospace,Consolas,monospace;background:var(--surface-alt);padding:2px 5px;border-radius:4px}.chat-text pre{overflow:auto;max-width:100%;padding:14px;border:1px solid var(--border);border-radius:10px}.chat-text pre code{padding:0;background:none}
.chat-user{padding-left:18px;border-left:2px solid var(--border-strong)}.chat-progress{border-top:1px solid var(--border);margin-top:8px}.chat-progress .chat-author{color:var(--text-faint)}
.chat-state{font-size:12px;color:var(--text-soft);display:flex;align-items:center;gap:8px;padding:8px 0 18px}.chat-state:before{content:'';width:6px;height:6px;border-radius:50%;background:var(--text-faint)}.chat-state[data-state=WORKING]:before,.chat-state[data-state=THINKING]:before{background:var(--success)}
.conversation-composer-tools{display:flex;align-items:center;gap:12px;min-height:40px;order:2;position:sticky;bottom:0;background:var(--composer)}
.conversation-composer-tools .attachment-add{margin-right:auto!important;position:relative;white-space:nowrap}.conversation-mode{margin:0;flex:none}.conversation-mode select{border:0;background:transparent;font-size:12px;min-height:32px;padding:3px 24px 3px 7px;width:80px}
.conversation-composer-tools .primary{min-width:88px;min-height:38px;background:var(--accent);color:var(--accent-text);border:0;font-size:14px}.conversation-composer-tools .primary:disabled{opacity:.42}
.conversation-composer .attachment-list{order:1}.conversation-composer .attachment-chip{flex:0 1 310px}.more-menu a{padding:7px 12px;color:var(--text-soft);font-size:12px;text-decoration:none;border-radius:6px}.more-menu a:hover{background:var(--accent-soft)}
@media(max-width:980px){.chat-message{padding:12px 0 18px}.chat-message p{font-size:13px}.conversation-composer-tools{gap:6px}.conversation-composer-tools .attachment-add{font-size:11px!important}.conversation-mode select{width:69px;font-size:11px}.conversation-composer-tools .primary{min-width:73px;font-size:12px}}

/* Desktop conversation refinement; legacy views retain their own shell. */
.sidebar-collapse{display:none}.conversation-rename{width:min(440px,90vw);color:var(--text)}.conversation-rename::backdrop{background:#0009;backdrop-filter:blur(3px)}.conversation-rename h2{margin:0 0 20px}.conversation-rename input{width:100%;margin:8px 0 24px}.conversation-rename .actions{justify-content:flex-end}
@media(min-width:981px){
 #root.conversation-shell{--sidebar-width:240px;--content-width:840px;--sidebar:#121214;--composer:#242428;--text:#efeff2;--text-soft:#acacb6;--text-faint:#a1a1ac;--border:#34343b;position:relative;grid-template-columns:var(--sidebar-width) minmax(0,1fr)}
 #root.conversation-shell[data-sidebar-collapsed=true]{--sidebar-width:64px}
 #root.conversation-shell[data-details-open=true][data-detail-layout=inline]{grid-template-columns:var(--sidebar-width) minmax(0,1fr) 336px}
 #root.conversation-shell .header-main{height:56px;min-height:56px;padding:0 28px;gap:16px}.conversation-shell .header-context{gap:10px;min-width:0;flex:1;font-size:14px}.conversation-shell .breadcrumb-current{max-width:500px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.conversation-shell .header-main .actions{flex:none;gap:8px}.conversation-shell .rename-button{background:none;border:0;padding:5px;color:var(--text-soft);min-width:28px;min-height:28px}.conversation-shell .rename-button .ui-icon{width:16px;height:16px}.conversation-shell .detail-toggle{font-size:13px;background:none;border:0;color:var(--text-soft)}
 .conversation-shell .sidebar-brand{height:56px;margin-bottom:16px;font-size:19px;padding:0 22px;gap:9px}.conversation-shell .sidebar-brand>.ui-icon{width:23px;height:25px}.conversation-shell .sidebar-collapse{display:inline-flex;margin-left:auto;color:var(--text-soft);padding:5px;min-width:28px;min-height:28px;border:0;background:transparent}.conversation-shell .sidebar-collapse .ui-icon{width:18px;height:18px}.conversation-shell .new-project{height:40px;min-height:40px;font-size:14px;padding:0 12px;gap:10px}.conversation-shell .project-search{height:38px;padding:0 12px;margin:10px 0 16px;gap:10px}.conversation-shell .nav-caption{display:none}.conversation-shell .project-list{gap:12px}.conversation-shell .task-group-label{font-size:11px;color:var(--text-faint);padding:0 12px;margin:12px 0 6px}.conversation-shell .project-list button{height:38px;min-height:38px;padding:0 12px;gap:9px;font-size:13px}.conversation-shell .sidebar-empty{font-size:12px;line-height:1.8;padding:12px}.conversation-shell .sidebar-footer{padding:12px 0;gap:6px;font-size:11px}.conversation-shell .local-workspace{font-size:10px}.conversation-shell .sidebar-footer button{font-size:12px}.conversation-shell .sidebar-footer .ui-icon{width:16px;height:16px}
 #root.conversation-shell[data-sidebar-collapsed=true] .sidebar-brand{padding:0 12px;justify-content:center;margin-bottom:16px}#root.conversation-shell[data-sidebar-collapsed=true] .sidebar-brand>span,#root.conversation-shell[data-sidebar-collapsed=true] .sidebar-brand>.ui-icon,#root.conversation-shell[data-sidebar-collapsed=true] .new-project>span,#root.conversation-shell[data-sidebar-collapsed=true] .project-search,#root.conversation-shell[data-sidebar-collapsed=true] .task-group-label,#root.conversation-shell[data-sidebar-collapsed=true] .project-name,#root.conversation-shell[data-sidebar-collapsed=true] .sidebar-empty,#root.conversation-shell[data-sidebar-collapsed=true] .local-workspace,#root.conversation-shell[data-sidebar-collapsed=true] .sidebar-footer button>span,#root.conversation-shell[data-sidebar-collapsed=true] .more-tasks{display:none}
 #root.conversation-shell[data-sidebar-collapsed=true] .sidebar-collapse{margin:0}#root.conversation-shell[data-sidebar-collapsed=true] .project-list{scrollbar-gutter:auto;margin-top:14px}#root.conversation-shell[data-sidebar-collapsed=true] .project-list button,#root.conversation-shell[data-sidebar-collapsed=true] .new-project{padding:0;justify-content:center}#root.conversation-shell[data-sidebar-collapsed=true] .sidebar-footer{flex-direction:column}#root.conversation-shell[data-sidebar-collapsed=true] .more-menu{position:fixed;left:64px;bottom:20px;width:220px;z-index:50}
 .conversation-shell .conversation-output{padding:28px max(32px,calc((100% - var(--content-width))/2)) 20px;scrollbar-gutter:auto}.conversation-shell .conversation-output:has(>.welcome){justify-content:center}.conversation-shell .conversation-output>.welcome{margin:0 0 16px}.conversation-shell .welcome h1{font-size:30px;letter-spacing:-.4px;margin:0 0 12px}.conversation-shell .welcome>p{font-size:15px}.conversation-shell .starter-heading{margin:28px 0 10px}.conversation-shell .starter-examples{gap:10px}.conversation-shell .starter-example{padding:14px;display:grid;grid-template-columns:24px minmax(0,1fr);gap:9px;align-items:center;min-height:58px;border-radius:10px;background:#202023;border:1px solid var(--border)}.conversation-shell .starter-top{display:contents}.conversation-shell .starter-top>.ui-icon{display:none}.conversation-shell .starter-icon{width:24px;height:24px;border:0;background:none;margin:0}.conversation-shell .starter-icon .ui-icon{width:19px;height:19px}.conversation-shell .starter-example strong{font-size:13px;margin:0}.conversation-shell .starter-description{display:none}
 .conversation-shell .chat-table-scroll{overflow:auto;max-width:100%;margin:16px 0}.conversation-shell .chat-table-scroll table{font-size:14px;border-collapse:collapse;width:100%;min-width:400px}.conversation-shell .chat-table-scroll th,.conversation-shell .chat-table-scroll td{padding:10px 12px;border:1px solid var(--border);text-align:left}.conversation-shell .chat-table-scroll th{background:var(--surface-muted)}
 .conversation-shell .chat-message{padding:16px 0 24px;margin:0;max-width:100%;position:relative}.conversation-shell .chat-message p,.conversation-shell .chat-text li{font-size:16px;line-height:1.75;margin:0 0 12px}.conversation-shell .chat-text h3{font-size:19px;line-height:1.6;margin:22px 0 12px}.conversation-shell .chat-text>:first-child{margin-top:0}.conversation-shell .chat-text>:last-child{margin-bottom:0}.conversation-shell .chat-text code{font-size:13px}.conversation-shell .chat-author{font-size:12px;color:var(--text-soft);gap:8px;margin-bottom:14px}.conversation-shell .chat-user{width:fit-content;max-width:88%;margin:10px 0 22px auto;border:1px solid #35353c;padding:16px 20px;border-radius:14px;background:#27272c}.conversation-shell .chat-user p:last-child{margin-bottom:0}.conversation-shell .chat-user .chat-author{margin-bottom:6px}.conversation-shell .chat-assistant{padding-bottom:30px}.conversation-shell .message-copy{font-size:11px;padding:3px 7px;min-height:24px;margin-top:12px;color:var(--text-soft);border:0;background:none;opacity:0}.conversation-shell .chat-assistant:hover .message-copy,.conversation-shell .chat-assistant:focus-within .message-copy{opacity:1}.conversation-shell .message-files{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}.conversation-shell .message-files>span{display:inline-flex;align-items:center;gap:6px;font-size:12px;max-width:100%;overflow-wrap:anywhere;padding:4px 8px;border:1px solid var(--border);border-radius:6px}.conversation-shell .message-files .ui-icon{width:14px;height:14px;flex:none}
 .conversation-shell details.chat-progress{border:0;padding:6px 0;margin:8px 0 14px;color:var(--text-soft)}.conversation-shell details.chat-progress>summary{list-style:none;display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;min-height:30px}.conversation-shell details.chat-progress>summary::-webkit-details-marker{display:none}.conversation-shell details.chat-progress>summary>span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.conversation-shell details.chat-progress>summary>.ui-icon{width:16px;height:16px;flex:none}.conversation-shell details.chat-progress>summary>.ui-icon:last-child{margin-left:auto;transition:transform .15s}.conversation-shell details.chat-progress[open]>summary>.ui-icon:last-child{transform:rotate(180deg)}.conversation-shell details.chat-progress>.chat-text{margin:12px 0 0 24px;padding-left:14px;border-left:1px solid var(--border)}.conversation-shell details.chat-progress .chat-text p,.conversation-shell details.chat-progress .chat-text li{font-size:14px;line-height:1.8}.conversation-shell .chat-state{padding:8px 0 16px;font-size:12px}
 .conversation-shell .composer-dock{padding:8px max(32px,calc((100% - var(--content-width))/2)) 24px;max-height:55%}.conversation-shell .composer-dock .composer{padding:15px 18px 12px;border-radius:14px;border-color:#414149}.conversation-shell .composer-dock .composer textarea{height:52px;min-height:0;max-height:240px;resize:none;margin:0 0 6px;font-size:16px;line-height:1.75;overflow:auto}.conversation-shell .conversation-composer-tools{min-height:36px;gap:10px}.conversation-shell .conversation-composer-tools .primary{min-height:34px;min-width:78px;font-size:13px;border-radius:8px}.conversation-shell .conversation-mode select{width:108px;font-size:12px}.conversation-shell .attachment-add{font-size:12px!important}.conversation-shell .composer-keyboard{display:block;visibility:hidden;font-size:10px;line-height:14px;color:var(--text-faint);margin:4px 0 0}.conversation-shell .conversation-composer:focus-within .composer-keyboard{visibility:visible}.conversation-shell .composer-capability{font-size:11px;line-height:1.7;color:var(--text-faint);margin:0 0 8px;text-align:center}.conversation-shell .composer-capability button{border:0;background:none;color:var(--text-soft);padding:0 4px;min-height:24px;font-size:11px;text-decoration:underline;text-underline-offset:3px}.conversation-shell .composer-pause{font-size:12px;color:#d4b78b;margin:10px 0 0}.conversation-shell .jump-latest{display:flex;align-items:center;gap:7px;margin:0 auto 10px;border-radius:20px;padding:6px 13px;min-height:32px;font-size:12px;background:#2c2c32;box-shadow:0 4px 16px #0003}.conversation-shell .jump-latest .ui-icon{width:14px;height:14px}
 .conversation-shell .conversation-plan{margin:12px 0 24px;padding:22px;border-radius:13px;background:#222226;border:1px solid #414149}.conversation-shell .plan-heading{display:flex;align-items:center;justify-content:space-between;gap:12px}.conversation-shell .eyebrow{font-size:12px;color:var(--text-soft)}.conversation-shell .plan-version{font-size:11px;color:var(--text-faint)}.conversation-shell .conversation-plan h2{font-size:19px;margin:12px 0 16px;line-height:1.6}.conversation-shell .plan-scope{padding-left:20px;margin:0 0 16px;font-size:14px;line-height:1.8}.conversation-shell .plan-work-summary{display:flex;flex-wrap:wrap;gap:6px}.conversation-shell .plan-work-summary>span{padding:3px 9px;border:1px solid var(--border);border-radius:5px;font-size:11px;color:var(--text-soft)}.conversation-shell .plan-note{font-size:12px;line-height:1.8;color:#d4b78b;margin:14px 0}.conversation-shell .plan-actions{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-top:20px}.conversation-shell .plan-actions button{font-size:12px;min-height:34px;padding:6px 12px}.conversation-shell .plan-actions button:not(.primary){border-color:transparent;background:none;color:var(--text-soft)}.conversation-shell .plan-confirmed{font-size:12px;color:var(--success);margin-right:auto}
 #root.conversation-shell .detail-open>.detail{grid-column:3;grid-row:1 / -1;width:336px;justify-self:stretch;position:relative;z-index:31;box-shadow:none;padding:0 20px 24px}#root.conversation-shell .detail-backdrop{display:none}#root.conversation-shell[data-details-open=true][data-detail-layout=overlay] .detail-open>.detail{grid-column:2;grid-row:1 / -1;justify-self:end;box-shadow:-18px 0 50px #0005}#root.conversation-shell[data-details-open=true][data-detail-layout=overlay] .detail-backdrop:not([hidden]){display:block;grid-column:2;grid-row:1 / -1;position:relative;inset:auto;width:100%;height:100%;z-index:30;background:#0006;border:0;border-radius:0}
 .conversation-shell .detail-heading{height:56px;min-height:56px;position:sticky;top:0;background:var(--sidebar);z-index:1}.conversation-shell .detail-heading h2{font-size:14px}.conversation-shell .detail>h3{font-size:16px;line-height:1.6;margin:20px 0 10px;overflow-wrap:anywhere}.conversation-shell .detail>p{font-size:12px;color:var(--text-soft)}.conversation-shell .detail-section{border-top:1px solid var(--border);padding:18px 0;margin:16px 0 0;overflow-wrap:anywhere}.conversation-shell .detail-section h3,.conversation-shell .detail-section summary{font-size:13px;font-weight:550;color:var(--text);margin:0 0 12px}.conversation-shell .detail-section p,.conversation-shell .detail-section .chat-text p,.conversation-shell .detail-section li{font-size:13px;line-height:1.8;margin:6px 0}.conversation-shell .detail-section ul{padding-left:18px}.conversation-shell .detail-work{padding:12px 0;border-bottom:1px solid var(--border)}.conversation-shell .detail-work:last-child{border-bottom:0}.conversation-shell .detail-work .muted{font-size:11px}.conversation-shell .detail-facts{display:grid;grid-template-columns:80px 1fr;font-size:12px;gap:8px;margin:14px 0 0}.conversation-shell .detail-facts dt{color:var(--text-faint)}.conversation-shell .detail-facts dd{margin:0}.conversation-shell .detail>a{font-size:12px;color:var(--text-soft)}
}

/* Mode choice remains a draft setting; its popup is outside the scrolling composer. */
.conversation-mode-trigger{display:inline-flex;align-items:center;justify-content:center;flex:none;gap:7px;min-height:34px;padding:6px 10px;border:1px solid #45454d;border-radius:8px;background:#2c2c32;color:#efeff2;font-size:13px;line-height:20px;white-space:nowrap}
.conversation-mode-trigger:hover:not(:disabled),.conversation-mode-trigger[aria-expanded=true]{background:#35353d;border-color:#696974}.conversation-mode-trigger:disabled{opacity:.45}.conversation-mode-trigger>.ui-icon{width:15px;height:15px;color:#c1c1ca}.conversation-mode-trigger>.ui-icon:last-child{width:13px;height:13px;margin-left:2px;color:#adadb8;transition:transform .15s}.conversation-mode-trigger[aria-expanded=true]>.ui-icon:last-child{transform:rotate(180deg)}
.conversation-mode-popover{position:fixed;z-index:80;width:min(320px,calc(100vw - 24px));overflow:auto;overscroll-behavior:contain;background:#242428;border:1px solid #45454d;border-radius:12px;padding:7px;box-shadow:0 12px 40px #0007;color:#efeff2;font-family:var(--sans);font-size:13px}
.mode-menu-heading{margin:3px 9px 6px;color:#adadb8;font-size:11px;line-height:20px}.mode-menu-option{display:flex;align-items:flex-start;gap:10px;padding:11px 9px;border:1px solid transparent;border-radius:8px;cursor:pointer}.mode-menu-option.active{background:#33333b;border-color:#494952}.mode-option-icon{display:flex;align-items:center;justify-content:center;width:22px;flex:none;margin-top:2px;color:#cdCDD5}.mode-option-icon .ui-icon{width:17px;height:17px}.mode-option-content{min-width:0;flex:1}.mode-option-title{display:flex;align-items:center;flex-wrap:wrap;gap:7px;font-size:13px;font-weight:550;line-height:20px}.mode-option-content p{font-size:12px;line-height:1.7;color:#b5b5bf;margin:5px 0 0;white-space:normal}.mode-unavailable{font-size:10px;font-weight:400;line-height:18px;padding:0 5px;border:1px solid #6a593f;border-radius:4px;color:#e4c189;background:#352e24}.mode-option-content .mode-environment-note{color:#e4c189}.mode-option-check{width:16px;flex:none;margin-top:3px;color:#efeff2}.mode-option-check .ui-icon{width:16px;height:16px}.mode-menu-footnote{border-top:1px solid #3b3b43;margin:7px 5px 0;padding:9px 4px 3px;font-size:10px;line-height:1.7;color:#adadb8;white-space:normal}
@media(min-width:981px){.conversation-shell .conversation-mode-trigger{height:34px;min-width:116px}.conversation-shell .conversation-composer-tools{gap:9px}}

/* Restore the complete detail navigation in the conversation workspace. */
.conversation-detail-tabs{display:flex;gap:3px;min-width:0;margin:18px 0 16px;padding:0 0 8px;border-bottom:1px solid var(--border);background:var(--sidebar)}.conversation-detail-tabs button{flex:1;min-width:0;min-height:34px;padding:6px 4px;font-size:12px;white-space:nowrap;border:0;border-radius:6px;background:transparent;color:var(--text-soft)}.conversation-detail-tabs button[aria-selected=true]{background:var(--accent-soft);color:var(--text)}.conversation-detail-tabs .ui-icon{display:none}.conversation-detail-panel{min-width:0;padding-bottom:18px}.conversation-detail-panel h2,.conversation-detail-panel h3{font-size:15px;line-height:1.6;margin:16px 0 12px}.conversation-detail-panel h4{font-size:13px;margin:14px 0 10px}.conversation-detail-panel p,.conversation-detail-panel .chat-text p,.conversation-detail-panel li{font-size:13px;line-height:1.8}.conversation-detail-panel .detail-empty{font-size:12px;color:var(--text-soft);padding:12px 0}.conversation-detail-panel .detail-section:first-child{margin-top:0}.conversation-detail-panel .card{padding:14px;margin:12px 0;border-radius:9px}.conversation-detail-panel .hash{font-size:11px;overflow-wrap:anywhere}.conversation-detail-panel .actions{flex-direction:column;align-items:stretch;gap:7px}.conversation-detail-panel button{font-size:12px;min-height:32px;padding:6px 9px}.conversation-detail-panel a{font-size:12px;color:var(--text-soft)}.conversation-detail-records{list-style:none;margin:0;padding:0}.conversation-detail-records>li{padding:12px 0;border-bottom:1px solid var(--border)}.conversation-detail-records>li:last-child{border-bottom:0}.conversation-detail-records summary{font-size:13px;line-height:1.7;overflow-wrap:anywhere;margin-top:7px;cursor:pointer}.conversation-detail-records details[open] summary{margin-bottom:10px}.conversation-detail-records .chat-text{padding:10px 0 0 12px;border-left:1px solid var(--border)}.conversation-detail-records .muted{font-size:11px}
@media(min-width:981px){.conversation-shell .conversation-detail-tabs{position:sticky;top:56px;z-index:1;padding-top:8px}.conversation-shell .conversation-detail-tabs button{font-size:12px;min-height:34px;padding:6px 4px}}

/* Task removal is explicit; menus do not enter the sidebar's clipped flow. */
.conversation-nav-item{position:relative;min-width:0}.conversation-nav-item>button:first-child{padding-right:42px}.conversation-nav-item>.task-menu-trigger{position:absolute;right:4px;top:4px;width:28px;height:30px;min-height:30px;min-width:0;padding:4px;justify-content:center;border:0;color:var(--text-soft);background:transparent;opacity:0}.conversation-nav-item:hover>.task-menu-trigger,.conversation-nav-item:focus-within>.task-menu-trigger,.conversation-nav-item>.task-menu-trigger[aria-expanded=true]{opacity:1}.task-menu-trigger .ui-icon{width:17px;height:17px}
.task-actions-menu{position:fixed;z-index:85;width:176px;padding:5px;background:#242428;border:1px solid #45454d;border-radius:9px;box-shadow:0 10px 30px #0006}.task-actions-menu button{display:flex;align-items:center;gap:9px;width:100%;font-size:13px;min-height:36px;border:0;background:transparent;color:#ffb2b2;padding:7px 9px}.task-actions-menu button:hover,.task-actions-menu button:focus-visible{background:#3b2c30}.task-actions-menu .ui-icon{width:16px;height:16px}
.conversation-delete-dialog{width:min(440px,calc(100vw - 32px));color:var(--text);padding:24px}.conversation-delete-dialog::backdrop{background:#0009;backdrop-filter:blur(3px)}.conversation-delete-dialog h2{font-size:19px;margin:0 0 18px}.conversation-delete-dialog p{font-size:13px;line-height:1.8;color:var(--text-soft);margin:12px 0}.conversation-delete-dialog .delete-task-name{color:var(--text);font-size:15px;font-weight:550;overflow-wrap:anywhere}.conversation-delete-dialog .actions{justify-content:flex-end;gap:8px;margin-top:24px}.conversation-delete-dialog .delete-confirm{background:#e8a2a2;color:#251919;border:0}.conversation-delete-dialog .delete-confirm:disabled{opacity:.4}.task-delete-feedback{position:fixed;z-index:90;top:72px;right:24px;width:min(360px,calc(100vw - 32px));display:flex;align-items:center;gap:12px;padding:14px 16px;border:1px solid #4a4a53;border-radius:10px;background:#28282e;box-shadow:0 8px 28px #0005;color:#efeff2}.task-delete-feedback p{font-size:12px;line-height:1.7;margin:0;flex:1;overflow-wrap:anywhere}.task-delete-feedback button{font-size:12px;flex:none;min-height:30px;padding:4px 8px}
@media(min-width:981px){.conversation-shell .conversation-nav-item>button:first-child{padding-right:38px}.conversation-shell .conversation-nav-item>.task-menu-trigger{right:3px;top:4px;width:28px;height:30px;min-height:30px;padding:4px}.conversation-shell .conversation-nav-item>.task-menu-trigger:hover{background:#35353b}#root.conversation-shell[data-sidebar-collapsed=true] .conversation-nav-item>.task-menu-trigger{right:4px}#root.conversation-shell[data-sidebar-collapsed=true] .conversation-nav-item>button:first-child{padding:0}}

.workspace-footer{gap:4px;justify-content:space-between}.workspace-switch{font-size:14px!important;flex:1;min-width:0;display:flex;align-items:center;gap:8px;text-align:left}.workspace-switch span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1}.workspace-switch svg{flex-shrink:0}.workspace-menu{position:fixed;z-index:90;width:280px;max-height:70vh;overflow:auto;padding:8px;background:#232326;border:1px solid var(--border-strong);border-radius:12px;box-shadow:0 12px 40px #0007}.workspace-menu p{font-size:12px;color:var(--text-faint);padding:6px 10px;margin:0}.workspace-menu button{width:100%;display:flex;align-items:center;gap:8px;text-align:left;border:0;background:transparent;min-height:38px}.workspace-menu button span{flex:1;overflow:hidden;text-overflow:ellipsis}.workspace-menu button small{color:var(--text-faint)}.workspace-menu button:hover,.workspace-menu button[aria-checked=true]{background:var(--accent-soft)}.workspace-menu hr{border:0;border-top:1px solid var(--border);margin:6px 0}.workspace-manager{font-size:14px;max-width:640px;width:min(640px,90vw)}.workspace-manager label{display:flex;flex-direction:column;gap:8px;margin:18px 0 12px}.workspace-manager input,.workspace-manager textarea,.workspace-manager select{width:100%;padding:10px;border:1px solid var(--border-strong);background:var(--surface-muted);color:var(--text);border-radius:8px}.workspace-manager textarea{min-height:72px;height:72px;max-height:180px}.space-manage-tabs{display:flex;gap:4px;flex-wrap:wrap;border-bottom:1px solid var(--border);padding-bottom:12px}.space-manage-tabs button[aria-pressed=true]{background:var(--accent-soft);border-color:var(--text-faint)}.directory-backdrop{z-index:120}.directory-list{max-height:320px;overflow:auto;display:flex;flex-direction:column;gap:4px;margin:16px 0}.directory-list button{display:flex;align-items:center;gap:8px;text-align:left}.directory-path{overflow-wrap:anywhere;font-family:var(--mono);font-size:12px}.composer-directory{display:flex;align-items:center;gap:6px;color:var(--text-faint);font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin:0 4px 8px}.composer-directory svg{width:14px;height:14px;flex-shrink:0}#root[data-sidebar-collapsed=true] .workspace-switch span,#root[data-sidebar-collapsed=true] .workspace-switch>svg:last-child{display:none}#root[data-sidebar-collapsed=true] .workspace-footer{flex-direction:column}#root[data-sidebar-collapsed=true] .workspace-switch{flex:initial;width:40px;justify-content:center}
`;
