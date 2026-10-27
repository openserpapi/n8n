import { analyzePackageByName, resolvePackage } from '@n8n/scan-community-package/scanner/scanner.mjs';

const spec = process.argv[2];
if (!spec) throw new Error('Pass the npm package name and version to scan');
const { packageName, version } = resolvePackage(spec);
const result = await analyzePackageByName(packageName, version);
if (!result.passed) {
  console.error(result.message);
  if (result.details) console.error(result.details);
  process.exitCode = 1;
} else {
  console.log(`${spec}: n8n published-package checks passed`);
}
