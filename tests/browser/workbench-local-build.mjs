import {build} from 'tsdown';
// Build the actual browser module; the harness is not a public application route.
await build({config:false,entry:{local:'packages/input-api/src/web/workbench-local.ts'},outDir:'.cache/workbench-local-build',format:'esm',platform:'browser',target:'es2022',clean:true,dts:false,sourcemap:true,deps:{alwaysBundle:[/^@devmesh\/contracts$/, /^zod(?:\/|$)/]},outputOptions:{entryFileNames:'[name].js'}});
