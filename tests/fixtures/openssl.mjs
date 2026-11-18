import {execFileSync} from 'node:child_process';
import {dirname,join} from 'node:path';
import {existsSync} from 'node:fs';

export function testOpenSsl(){
 if(process.env.DEVMESH_TEST_OPENSSL)return process.env.DEVMESH_TEST_OPENSSL;
 if(process.platform==='win32'){
  const gitCore=execFileSync('git',['--exec-path'],{encoding:'utf8',windowsHide:true}).trim();
  const bundled=join(dirname(dirname(dirname(gitCore))),'usr','bin','openssl.exe');
  if(existsSync(bundled))return bundled;
 }
 return 'openssl';
}
