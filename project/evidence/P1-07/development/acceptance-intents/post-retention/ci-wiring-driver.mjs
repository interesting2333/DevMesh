import {readFileSync} from 'node:fs';
const pkg=JSON.parse(readFileSync('package.json')),ci=readFileSync('scripts/verify-foundation.mjs','utf8');
if(pkg.scripts['test:acceptance']!=='node --test --test-concurrency=1 --test-reporter=tap tests/acceptance*.test.mjs'||!pkg.scripts.check.includes('pnpm test:acceptance')||!ci.includes("'test:acceptance'"))throw Error('Acceptance suite missing from a verification entry');
console.log('Declared acceptance command is included in root check and Foundation step list; no full CI execution.');
