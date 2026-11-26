/**
 * Headless Blender 5.2+ asset build runner (`npm run blender:build`).
 *
 * Usage:
 *   node tools/blender/export_all.mjs              # Run all available Blender asset scripts
 *   node tools/blender/export_all.mjs --only hdri  # Run only matching job(s)
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');

const JOBS = [
  {
    id: 'hdri',
    script: path.join(__dirname, 'render_hdri.py'),
    outputs: ['public/env/switchroom_studio.hdr', 'assets-src/blender/switchroom_hdri.blend'],
  },
  {
    id: 'engineer',
    script: path.join(__dirname, 'build_engineer.py'),
    outputs: ['public/models/engineer.glb', 'assets-src/blender/engineer.blend'],
  },
  {
    id: 'room-props',
    script: path.join(__dirname, 'build_room_props.py'),
    outputs: [
      'public/models/ppe-locker.glb',
      'public/models/permit-desk.glb',
      'public/models/test-bench.glb',
      'public/models/key-board.glb',
      'public/models/vcb-workbench.glb',
      'public/models/room-architecture.glb',
      'assets-src/blender/room_props.blend',
    ],
  },
  {
    id: 'trolley-and-tools',
    script: path.join(__dirname, 'build_trolley_and_tools.py'),
    outputs: [
      'public/models/vcb-trolley.glb',
      'public/models/workbench-tools.glb',
      'public/models/watertight-door.glb',
      'public/models/co2-extinguisher.glb',
      'public/models/rescue-hook.glb',
      'assets-src/blender/trolley_and_tools.blend',
    ],
  },
];

export function resolveBlenderBinary() {
  const candidates = [
    process.env.BLENDER_BIN,
    'D:\\Blender\\blender.exe',
    'C:\\Program Files\\Blender Foundation\\Blender 5.2\\blender.exe',
    'C:\\Program Files\\Blender Foundation\\Blender 5.0\\blender.exe',
    'C:\\Program Files\\Blender Foundation\\Blender 4.3\\blender.exe',
    '/Applications/Blender.app/Contents/MacOS/Blender',
    '/usr/bin/blender',
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return 'blender';
}

function parseOnlyFilter(argv) {
  const onlyIdx = argv.indexOf('--only');
  if (onlyIdx !== -1 && argv[onlyIdx + 1]) {
    return new Set(argv[onlyIdx + 1].split(',').map((s) => s.trim()).filter(Boolean));
  }
  return null;
}

function run() {
  const blenderBin = resolveBlenderBinary();
  const filter = parseOnlyFilter(process.argv.slice(2));

  const versionCheck = spawnSync(blenderBin, ['--version'], { encoding: 'utf8' });
  if (versionCheck.error || versionCheck.status !== 0) {
    console.error(
      `[blender:build] Unable to invoke Blender binary "${blenderBin}". ` +
        'Set BLENDER_BIN to your blender executable path and retry.'
    );
    if (versionCheck.stderr) console.error(versionCheck.stderr.trim());
    process.exit(1);
  }
  const firstLine = (versionCheck.stdout || '').split(/\r?\n/)[0] || blenderBin;
  console.log(`[blender:build] Using ${firstLine} (${blenderBin})`);

  const activeJobs = JOBS.filter((job) => {
    if (filter && !filter.has(job.id)) return false;
    return fs.existsSync(job.script);
  });

  if (activeJobs.length === 0) {
    console.log('[blender:build] No matching Blender build scripts found.');
    return;
  }

  for (const job of activeJobs) {
    const start = Date.now();
    console.log(`[blender:build] Running "${job.id}" (${path.relative(REPO_ROOT, job.script)})...`);
    const res = spawnSync(blenderBin, ['-b', '--factory-startup', '--python-exit-code', '1', '-P', job.script], {
      cwd: REPO_ROOT,
      stdio: 'inherit',
    });
    if (res.status !== 0) {
      console.error(`[blender:build] Job "${job.id}" failed with exit code ${res.status}`);
      process.exit(res.status || 1);
    }

    const elapsedSec = ((Date.now() - start) / 1000).toFixed(1);
    for (const relOut of job.outputs) {
      const absOut = path.join(REPO_ROOT, relOut);
      if (!fs.existsSync(absOut)) {
        console.error(`[blender:build] Expected output missing after "${job.id}": ${relOut}`);
        process.exit(1);
      }
      const sizeKb = (fs.statSync(absOut).size / 1024).toFixed(1);
      console.log(`[blender:build]   OK ${relOut} (${sizeKb} KB)`);
    }
    console.log(`[blender:build] Finished "${job.id}" in ${elapsedSec}s`);
  }
}

run();
