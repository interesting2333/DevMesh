import {randomBytes} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import type {Router,Request,Response,RequestHandler} from 'express';
import {z} from 'zod';
import {opaqueKey,parseContract,releaseExportEntryView,releaseExportListView} from '@devmesh/contracts';
import type {LocalContentStore} from '@devmesh/blob-store';
import type {Identity} from './index.js';

type Route=(handler:(request:Request,response:Response,identity:Identity)=>Promise<void>)=>RequestHandler;
const empty=z.strictObject({});
const styles=`
:root{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:#1d302f;background:#f4f3ef;font-synthesis:none}*{box-sizing:border-box}body{margin:0}main{max-width:1000px;margin:auto;padding:36px 24px 64px}a{color:#155b4d;text-underline-offset:3px}button,.download{font:inherit;min-height:44px;border-radius:10px;padding:10px 16px;cursor:pointer;border:1px solid #b5c9c2;background:#fff;color:#204a40}button:disabled{cursor:default;opacity:.5}button:focus-visible,a:focus-visible{outline:3px solid #d99127;outline-offset:3px}.primary,.download{background:#205a4d;color:#fff;border-color:#205a4d}.download{display:inline-flex;align-items:center;text-decoration:none}.topline{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:36px}.brand{font-weight:750;letter-spacing:.06em}.eyebrow{font-size:13px;letter-spacing:.1em;color:#496a5e}h1{font-size:clamp(30px,5vw,42px);letter-spacing:-.04em;margin:12px 0 14px}h2{font-size:20px;margin:0}p{line-height:1.7}.muted{color:#536b64;font-size:14px}.version{background:#e8eee6;border:1px solid #cfdbcd;border-radius:16px;padding:20px 24px;margin:24px 0}.version-head{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap}.commit{font-family:ui-monospace,Consolas,monospace;overflow-wrap:anywhere}.toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:28px 0 18px}.actions{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.notice{padding:14px 18px;border-radius:12px;background:#fff6dc;border:1px solid #e7d398;line-height:1.7}.error{background:#fff0ea;border-color:#edbdad}.jobs{display:grid;gap:14px}.job{border:1px solid #d7dfd9;border-radius:16px;background:#fff;padding:22px}.job-head{display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap}.job h3{font-size:16px;margin:0}.badge{font-size:13px;font-weight:650;border-radius:100px;padding:5px 11px;background:#edf1f0;color:#36544b}.badge.READY{background:#e4f1e6;color:#235334}.badge.FAILED{background:#ffece7;color:#8d3a24}.badge.PACKING{background:#e6eff8;color:#295776}.job-details{display:grid;gap:8px;grid-template-columns:repeat(2,minmax(0,1fr));margin:16px 0;font-size:14px}.job-details div{display:grid;gap:4px}.job-details dt{color:#67786e}.job-details dd{margin:0;overflow-wrap:anywhere}.job details{margin-top:14px;color:#546c64;font-size:13px}.job summary{cursor:pointer;padding:4px 0}.empty{border:1px dashed #bdcdc2;border-radius:16px;padding:36px 24px;text-align:center;background:#fafbf8}.pager{display:flex;justify-content:space-between;align-items:center;margin:22px 0}.footer{margin-top:28px;color:#63746b;font-size:13px}.section-label{margin:20px 0 10px;color:#536d62;font-size:13px}@media(max-width:600px){main{padding:24px 16px 40px}.topline{margin-bottom:26px}.version{padding:18px}.job{padding:18px}.job-details{grid-template-columns:1fr}.toolbar .actions{width:100%}.primary{flex:1}}
`;

export function mountExportPages(router:Router,content:LocalContentStore,route:Route):void {
  const entry=async(request:Request,identity:Identity)=>{
    empty.parse(request.query);
    const releaseId=parseContract(opaqueKey,request.params.releaseId);
    return parseContract(releaseExportEntryView,await content.storage.request('getReleaseExportEntry',{principalId:identity.principalId,releaseId}));
  };
  router.get('/releases/:releaseId/exports/view',route(async(request,response,identity)=>{
    const release=await entry(request,identity),list=parseContract(releaseExportListView,await content.storage.request('listReleaseExports',{principalId:identity.principalId,releaseId:release.releaseId,limit:20})),nonce=randomBytes(18).toString('base64url');
    const json=JSON.stringify({entry:release,list}).replaceAll('<','\\u003c').replaceAll('>','\\u003e').replaceAll('&','\\u0026').replaceAll('\u2028','\\u2028').replaceAll('\u2029','\\u2029');
    response.setHeader('Referrer-Policy','no-referrer');
    response.setHeader('Content-Security-Policy',`default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; connect-src 'self'; frame-src 'none'; frame-ancestors 'self'; base-uri 'none'; object-src 'none'; worker-src 'none'; form-action 'none'`);
    response.type('text/html; charset=utf-8').send(`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>交付包 · DevMesh</title><style nonce="${nonce}">${styles}</style></head><body><div id="root"><main><h1>交付包</h1><p role="status">正在加载交付记录…</p><noscript>请启用 JavaScript 查看和创建交付包。</noscript></main></div><script id="export-data" type="application/json" nonce="${nonce}">${json}</script><script defer nonce="${nonce}" src="/api/v1/releases/${encodeURIComponent(release.releaseId)}/exports/client.js"></script></body></html>`);
  }));
  router.get('/releases/:releaseId/exports/client.js',route(async(request,response,identity)=>{
    await entry(request,identity);
    const bytes=await readFile(new URL('./web/export/export-client.js',import.meta.url));
    await entry(request,identity);
    response.type('application/javascript; charset=utf-8').send(bytes);
  }));
}
