import {build} from 'tsdown';
await build({config:false,entry:{task:'tests/fixtures/workbench-task-entry.ts'},outDir:'.cache/workbench-task-build',format:'esm',platform:'browser',target:'es2022',clean:true,dts:false,sourcemap:true,deps:{alwaysBundle:[/^@devmesh\/contracts$/, /^zod(?:\/|$)/,/^react(?:\/|$)/]},outputOptions:{entryFileNames:'[name].js'}});
