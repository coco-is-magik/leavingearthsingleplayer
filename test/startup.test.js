import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, copyFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

async function launch(t, port) {
  const directory = await mkdtemp(join(tmpdir(), 'leaving earth startup '));
  t.after(() => rm(directory, { recursive: true, force: true }));
  for (const file of ['server.js', 'package.json', 'index.html']) {
    await copyFile(new URL(`../${file}`, import.meta.url), join(directory, file));
  }
  const child = spawn(process.execPath, ['server.js'], {
    cwd: directory, env: { ...process.env, PORT: port }, stdio: ['ignore', 'pipe', 'pipe']
  });
  t.after(async () => {
    if (child.exitCode === null && child.signalCode === null) {
      const exited = once(child, 'exit');
      child.kill();
      await exited;
    }
  });
  return child;
}

test('CLI starts and serves the page from a path containing spaces', { timeout: 10000 }, async t => {
  const child = await launch(t, '0');
  const address = await new Promise((resolve, reject) => {
    let output = '';
    child.stdout.on('data', chunk => {
      output += chunk;
      const match = output.match(/http:\/\/127\.0\.0\.1:\d+/);
      if (match) resolve(match[0]);
    });
    child.once('error', reject);
    child.once('exit', code => reject(new Error(`Server exited before startup: ${code}`)));
  });
  const response = await fetch(address, { signal: AbortSignal.timeout(3000) });
  assert.equal(response.status, 200);
  assert.match(await response.text(), /Leaving Earth/);
});

test('CLI reports invalid port settings rather than silently exiting', { timeout: 10000 }, async t => {
  const child = await launch(t, 'not-a-port');
  let error = '';
  child.stderr.on('data', chunk => { error += chunk; });
  const [code] = await once(child, 'exit');
  assert.equal(code, 1);
  assert.match(error, /PORT must be an integer/);
});