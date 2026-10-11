#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { planAppDelivery } from './delivery.mjs';

const [flag, directory, pinFile, retainedFile] = process.argv.slice(2);
if (flag !== '--dry-run' || !directory || !pinFile || process.argv.length > 6) {
  throw new Error('Usage: node tools/release/dry-run.mjs --dry-run RELEASE_DIR PIN_JSON [RETAINED_RELEASES_JSON]');
}
const pin = JSON.parse(readFileSync(pinFile, 'utf8'));
if (pin.schemaVersion !== 2 || pin.repository !== 'UMN-VR/app') {
  throw new Error('Expected an exact Campus App assembly pin');
}
const retained = retainedFile ? JSON.parse(readFileSync(retainedFile, 'utf8')) : [];
if (!Array.isArray(retained)) throw new Error('Retained supported releases must be an explicit list');
const plan = planAppDelivery({ directory, descriptorSha256: pin.descriptorSha256, retained });
if (plan.mountPath !== pin.mountPath || plan.scene.repository !== pin.sceneRepository) throw new Error('Assembly pin route/scene differs from the release');
console.log(JSON.stringify(plan, null, 2));
