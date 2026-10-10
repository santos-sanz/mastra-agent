import 'dotenv/config';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { suite, type TestResult } from './suite';
import { renderReport } from './report';

const results: TestResult[] = [];
let currentCategory = '';

console.log('🧪 Suite intensiva de tests — mastra-agent\n');

for (const test of suite) {
  if (test.category !== currentCategory) {
    currentCategory = test.category;
    console.log(`\n━━━ ${currentCategory} ━━━`);
  }
  const t0 = Date.now();
  process.stdout.write(`  ▶ ${test.name} ... `);
  try {
    const { details, artifacts } = await test.fn();
    const durationMs = Date.now() - t0;
    results.push({ ...test, status: 'pass', durationMs, details, artifacts });
    console.log(`✓ pass (${(durationMs / 1000).toFixed(1)}s)`);
  } catch (e) {
    const durationMs = Date.now() - t0;
    const msg = e instanceof Error ? e.message : String(e);
    results.push({ ...test, status: 'fail', durationMs, details: '', error: msg });
    console.log(`✗ FAIL (${(durationMs / 1000).toFixed(1)}s): ${msg.slice(0, 120)}`);
  }
}

const passed = results.filter(r => r.status === 'pass').length;
console.log(`\n━━━ Resumen: ${passed}/${results.length} tests en ${results.reduce((a, r) => a + r.durationMs, 0) / 1000}s ━━━`);

const { version: mastraVersion } = JSON.parse(
  await readFile(join(process.cwd(), 'node_modules/@mastra/core/package.json'), 'utf8'),
);
const html = renderReport(results, { mastraVersion, nodeVersion: process.version });
await writeFile(join(process.cwd(), 'test-report.html'), html);
console.log('📄 Informe HTML generado en test-report.html');
