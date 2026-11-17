import {randomBytes} from 'node:crypto';
import {workbenchStyles as css} from './workbench-styles.js';
import type {WorkbenchBoot} from './web/workbench-context.js';


export function workbenchPage(value:WorkbenchBoot){
 const nonce=randomBytes(18).toString('base64url'),json=JSON.stringify(value).replaceAll('<','\\u003c').replaceAll('>','\\u003e').replaceAll('&','\\u0026').replaceAll('\u2028','\\u2028').replaceAll('\u2029','\\u2029');
 return {policy:`default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; connect-src 'self'; frame-src 'none'; frame-ancestors 'self'; base-uri 'none'; object-src 'none'; worker-src 'none'; form-action 'none'`,html:`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light dark"><title>工作台 · DevMesh</title><style nonce="${nonce}">${css}</style></head><body><div id="root"><main class="conversation"><h1>DevMesh 工作台</h1><p>正在加载工作台…</p><noscript>请启用JavaScript进入工作台。</noscript></main></div><script id="workbench-data" type="application/json" nonce="${nonce}">${json}</script><script defer nonce="${nonce}" src="/api/v1/workbench/client.js"></script></body></html>`};
}