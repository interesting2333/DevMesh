// Actual migrated control Worker/CAS/Git and local HTTP. Original accepted-image,
// source admission and human-review facts remain the explicit export fixture.
import {once} from 'node:events';
import {createRequire} from 'node:module';
import {mountInputApi} from '../../packages/input-api/dist/index.mjs';
import {releaseExportFixture} from './release-export.mjs';
const express=createRequire(new URL('../../packages/input-api/package.json',import.meta.url))('express');
export async function releaseExportEntryFixture(t,options={}){
  const f=await releaseExportFixture(t),app=express(),api=mountInputApi(app,f.exportContent(),{enabled:true,baseline:{version:'export.fixture.v1',baseCommit:'b'.repeat(40)},identityResolver:req=>{
    // Browser download requests do not inherit Playwright's injected headers.
    // Only this opt-in fixture resolver provides a trusted local browser identity;
    // production identity and cookie admission remain unchanged and disabled.
    if(options.identityMode==='trusted-browser-fixture')return {principalId:'user_1'};
    const value=req.headers.authorization;return value==='Bearer fixture_export_owner'?{principalId:'user_1'}:value==='Bearer fixture_export_viewer'?{principalId:'export.viewer'}:null;
  }}),server=app.listen(0,'127.0.0.1');await once(server,'listening');
  t.after(async()=>{await api.stop();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));});
  const origin='http://127.0.0.1:'+server.address().port,base='/api/v1/releases/'+f.publication.releaseId+'/exports';
  return {...f,origin,base,page:origin+base+'/view',api,server,headers:{authorization:'Bearer fixture_export_owner'}};
}
