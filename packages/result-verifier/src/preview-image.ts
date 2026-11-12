import {gunzipSync} from 'node:zlib';
import {gitCommit,sha256 as sha256Contract,previewImageLimits,previewImageManifest,previewImageConfig} from '@devmesh/contracts';
import {parseSourceJson,reject} from './json.js';
import {sha256} from './source.js';

// Bounded delivery profile of OCI image-spec 1.1.0; does not launch an image.
// https://github.com/opencontainers/image-spec/blob/v1.1.0/manifest.md
// https://github.com/opencontainers/image-spec/blob/v1.1.0/config.md
export {previewImageLimits};
function parse<T>(schema:{safeParse(value:unknown):{success:true;data:T}|{success:false}},bytes:Uint8Array,limit:number):T{
 if(bytes.byteLength>limit)return reject('PREVIEW_IMAGE_JSON_LIMIT');const value=schema.safeParse(parseSourceJson(bytes));if(!value.success)return reject('PREVIEW_IMAGE_PROFILE_INVALID');return value.data;
}
export interface PreviewImageInput {
 targetCommit:string;buildArtifactHash:string;manifestBytes:Uint8Array;
 /** Exact raw Runner output blobs keyed by sha256: identity. */
 blobs:ReadonlyMap<string,Uint8Array>;expectedDigest?:string;
}
export interface PreviewImageIdentity {
 schemaVersion:'devmesh.preview-image-identity.v1';imageDigest:string;configDigest:string;
 targetCommit:string;buildArtifactHash:string;os:'linux';architecture:'amd64'|'arm64';
 layers:{digest:string;diffId:string;byteSize:number;expandedByteSize:number}[];
}
/** Content identity only: no extraction, process, filesystem, network or tag
 * resolution. A separate original approved build Job must prove provenance. */
export function verifyPreviewImage(input:PreviewImageInput):PreviewImageIdentity{
 if(!gitCommit.safeParse(input.targetCommit).success||!sha256Contract.safeParse(input.buildArtifactHash).success)return reject('PREVIEW_IMAGE_BASIS_INVALID');
 const imageDigest='sha256:'+sha256(input.manifestBytes);if(input.expectedDigest!==undefined&&input.expectedDigest!==imageDigest)return reject('PREVIEW_IMAGE_DIGEST_CHANGED');
 const manifest=parse(previewImageManifest,input.manifestBytes,previewImageLimits.manifestBytes),required=new Set([manifest.config.digest,...manifest.layers.map(l=>l.digest)]);
 if(input.blobs.size!==required.size||[...input.blobs.keys()].some(key=>!required.has(key)))return reject('PREVIEW_IMAGE_BLOB_SET_CHANGED');
 let bytes=input.manifestBytes.byteLength,expanded=0;
 function blob(d:{digest:string;size:number}){
  const value=input.blobs.get(d.digest);if(!value||value.byteLength!==d.size||value.byteLength>previewImageLimits.blobBytes||'sha256:'+sha256(value)!==d.digest)return reject('PREVIEW_IMAGE_BLOB_CHANGED');
  bytes+=value.byteLength;if(bytes>previewImageLimits.totalBytes)return reject('PREVIEW_IMAGE_TOTAL_LIMIT');return value;
 }
 const config=parse(previewImageConfig,blob(manifest.config),previewImageLimits.configBytes);
 if(config.config.Labels['org.opencontainers.image.revision']!==input.targetCommit||config.config.Labels['io.devmesh.build.sha256']!==input.buildArtifactHash)return reject('PREVIEW_IMAGE_SOURCE_CHANGED');
 if(config.rootfs.diff_ids.length!==manifest.layers.length)return reject('PREVIEW_IMAGE_ROOTFS_CHANGED');
 const layers=manifest.layers.map((layer,index)=>{
  const original=blob(layer);let unpacked:Uint8Array=original;
  if(layer.mediaType.endsWith('+gzip'))try{unpacked=gunzipSync(original,{maxOutputLength:previewImageLimits.blobBytes});}catch{return reject('PREVIEW_IMAGE_LAYER_INVALID');}
  expanded+=unpacked.byteLength;if(expanded>previewImageLimits.totalBytes)return reject('PREVIEW_IMAGE_EXPANDED_LIMIT');
  const diffId='sha256:'+sha256(unpacked);if(diffId!==config.rootfs.diff_ids[index])return reject('PREVIEW_IMAGE_ROOTFS_CHANGED');
  return {digest:layer.digest,diffId,byteSize:original.byteLength,expandedByteSize:unpacked.byteLength};
 });
 return {schemaVersion:'devmesh.preview-image-identity.v1',imageDigest,configDigest:manifest.config.digest,targetCommit:input.targetCommit,buildArtifactHash:input.buildArtifactHash,os:config.os,architecture:config.architecture,layers};
}
