import {defineConfig} from 'tsdown';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {dirname,join} from 'node:path';
const require=createRequire(import.meta.url),domRequire=createRequire(require.resolve('react-dom/package.json'));
const notices=[['react',require],['react-dom',require],['scheduler',domRequire],['zod',require]] as const;
const license=notices.map(([name,resolve])=>name+'\n'+readFileSync(join(dirname(resolve.resolve(name+'/package.json')),'LICENSE'),'utf8')).join('\n\n');
export default defineConfig({
  entry: {'export-client':'src/web/export-client.tsx'},
  outDir:'dist/web',format:'iife',platform:'browser',target:'es2022',
  clean:true,minify:true,sourcemap:true,dts:false,
  deps:{alwaysBundle:[/^react(?:-dom)?(?:\/|$)/,/^scheduler(?:\/|$)/,/^@devmesh\/contracts$/,/^zod(?:\/|$)/]},
  define:{'process.env.NODE_ENV':'"production"'},
  outputOptions:{entryFileNames:'export-client.js'},
  banner:'/*! Third-party notices\n'+license+'\n*/',
});
