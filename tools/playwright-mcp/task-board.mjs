import assert from 'node:assert/strict';
import { join } from 'node:path';
import { startTaskBoardMcp, runTaskBoardCheck } from './session.mjs';

const workspace = process.cwd();
const browser = process.argv[2] ?? 'chromium';
assert.ok(['chromium', 'msedge', 'chrome'].includes(browser), 'Use a supported Chromium channel');
const session = await startTaskBoardMcp({ workspace, browser, headless: true });
try {
  await runTaskBoardCheck(session, join(workspace, 'playwright-mcp-results'));
  console.log('Playwright MCP task board check passed');
} finally {
  await session.close();
}
