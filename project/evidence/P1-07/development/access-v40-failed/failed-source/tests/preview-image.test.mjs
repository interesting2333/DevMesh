import test from 'node:test';
import assert from 'node:assert/strict';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {verifyPreviewImage} from '../packages/result-verifier/dist/index.mjs';

const hash=b=>createHash('sha256').update(b).digest('hex'),digest=b=>'sha256:'+hash(b),json=v=>Buffer.from(JSON.stringify(v));
function fixture({gzip=false}={}){
 const targetCommit='a'.repeat(40),buildArtifactHash=hash('actual build fixture bytes'),unpacked=Buffer.alloc(1024),layer=gzip?gzipSync(unpacked):unpacked;
 const config={os:'linux',architecture:'amd64',config:{Labels:{'org.opencontainers.image.revision':targetCommit,'io.devmesh.build.sha256':buildArtifactHash}},rootfs:{type:'layers',diff_ids:[digest(unpacked)]}},configBytes=json(config);
 const manifest={schemaVersion:2,mediaType:'application/vnd.oci.image.manifest.v1+json',config:{mediaType:'application/vnd.oci.image.config.v1+json',digest:digest(configBytes),size:configBytes.length},layers:[{mediaType:'application/vnd.oci.image.layer.v1.tar'+(gzip?'+gzip':''),digest:digest(layer),size:layer.length}]};
 const input={targetCommit,buildArtifactHash,manifestBytes:json(manifest),blobs:new Map([[digest(configBytes),configBytes],[digest(layer),layer]])};
 const replaceConfig=value=>{const bytes=json(value);input.blobs.delete(manifest.config.digest);manifest.config.digest=digest(bytes);manifest.config.size=bytes.length;input.blobs.set(digest(bytes),bytes);input.manifestBytes=json(manifest);};
 return {input,manifest,config,layer,unpacked,replaceConfig};
}
test('preview identity uses exact OCI bytes and uncompressed layer identities',()=>{
 for(const gzip of [false,true]){const f=fixture({gzip}),result=verifyPreviewImage(f.input);assert.equal(result.imageDigest,digest(f.input.manifestBytes));assert.equal(result.configDigest,f.manifest.config.digest);assert.equal(result.layers[0].digest,digest(f.layer));assert.equal(result.layers[0].diffId,digest(f.unpacked));assert.equal(result.targetCommit,f.input.targetCommit);assert.equal(result.buildArtifactHash,f.input.buildArtifactHash);}
});
test('test environment digest, changed layer bytes and missing blobs cannot prove a generated image',()=>{
 const f=fixture();assert.throws(()=>verifyPreviewImage({...f.input,expectedDigest:'sha256:'+'c'.repeat(64)}),{code:'PREVIEW_IMAGE_DIGEST_CHANGED'});
 f.input.blobs.set(f.manifest.layers[0].digest,Buffer.alloc(f.layer.length,1));assert.throws(()=>verifyPreviewImage(f.input),{code:'PREVIEW_IMAGE_BLOB_CHANGED'});
 f.input.blobs.delete(f.manifest.layers[0].digest);assert.throws(()=>verifyPreviewImage(f.input),{code:'PREVIEW_IMAGE_BLOB_SET_CHANGED'});
});
test('two individually valid layer blobs cannot be reordered against the original rootfs',()=>{
 const f=fixture(),second=Buffer.alloc(1024,1),ref={mediaType:'application/vnd.oci.image.layer.v1.tar',digest:digest(second),size:second.length};
 f.input.blobs.set(ref.digest,second);f.manifest.layers.push(ref);f.config.rootfs.diff_ids.push(ref.digest);f.replaceConfig(f.config);
 assert.equal(verifyPreviewImage(f.input).layers.length,2);
 f.manifest.layers.reverse();f.input.manifestBytes=json(f.manifest);assert.throws(()=>verifyPreviewImage(f.input),{code:'PREVIEW_IMAGE_ROOTFS_CHANGED'});
});
test('source, build artifact, rootfs and image platform must match independently',()=>{
 for(const [mutate,code] of [
  [c=>{c.config.Labels['org.opencontainers.image.revision']='b'.repeat(40);},'PREVIEW_IMAGE_SOURCE_CHANGED'],
  [c=>{c.config.Labels['io.devmesh.build.sha256']='d'.repeat(64);},'PREVIEW_IMAGE_SOURCE_CHANGED'],
  [c=>{c.rootfs.diff_ids[0]='sha256:'+'e'.repeat(64);},'PREVIEW_IMAGE_ROOTFS_CHANGED'],
  [c=>{c.rootfs.diff_ids=[];},'PREVIEW_IMAGE_PROFILE_INVALID'],
  [c=>{c.os='windows';},'PREVIEW_IMAGE_PROFILE_INVALID'],
 ]){const f=fixture();mutate(f.config);f.replaceConfig(f.config);assert.throws(()=>verifyPreviewImage(f.input),{code});}
});
test('duplicate JSON keys, unsupported media and unindexed bytes are rejected',()=>{
 const f=fixture(),duplicate=Buffer.from(f.input.manifestBytes.toString().replace('"schemaVersion":2','"schemaVersion":2,"schemaVersion":2'));
 assert.throws(()=>verifyPreviewImage({...f.input,manifestBytes:duplicate}),{code:'REPORT_DUPLICATE_KEY'});
 f.manifest.layers[0].mediaType='application/vnd.oci.image.layer.v1.tar+zstd';assert.throws(()=>verifyPreviewImage({...f.input,manifestBytes:json(f.manifest)}),{code:'PREVIEW_IMAGE_PROFILE_INVALID'});
 f.input.blobs.set('sha256:'+'e'.repeat(64),Buffer.alloc(0));assert.throws(()=>verifyPreviewImage(f.input),{code:'PREVIEW_IMAGE_BLOB_SET_CHANGED'});
});
test('compressed layers have bounded decompression and malformed gzip is rejected',()=>{
 const f=fixture({gzip:true}),wrong=Buffer.from('not gzip');f.input.blobs.delete(f.manifest.layers[0].digest);f.manifest.layers[0].digest=digest(wrong);f.manifest.layers[0].size=wrong.length;f.input.blobs.set(digest(wrong),wrong);f.input.manifestBytes=json(f.manifest);
 assert.throws(()=>verifyPreviewImage(f.input),{code:'PREVIEW_IMAGE_LAYER_INVALID'});
 const large=fixture({gzip:true}),bomb=gzipSync(Buffer.alloc(64*1024*1024+1));large.input.blobs.delete(large.manifest.layers[0].digest);large.manifest.layers[0].digest=digest(bomb);large.manifest.layers[0].size=bomb.length;large.input.blobs.set(digest(bomb),bomb);large.input.manifestBytes=json(large.manifest);
 assert.throws(()=>verifyPreviewImage(large.input),{code:'PREVIEW_IMAGE_LAYER_INVALID'});
});
