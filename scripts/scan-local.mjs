import { fileURLToPath } from 'node:url';
import { analyzePackage, SOURCE_FILE_PATTERNS } from '@n8n/scan-community-package/scanner/scanner.mjs';

const packageDir = fileURLToPath(new URL('../', import.meta.url));
for (const [label, patterns] of [
  ['source', SOURCE_FILE_PATTERNS],
  ['build', ['package.json', 'dist/**/*.js']],
]) {
  const result = await analyzePackage(packageDir, patterns);
  if (!result.passed) {
    console.error(`${label}: ${result.message}`);
    if (result.details) console.error(result.details);
    process.exitCode = 1;
  } else {
    console.log(`${label}: n8n verification checks passed`);
  }
}
