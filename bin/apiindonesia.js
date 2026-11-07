#!/usr/bin/env node
import { main } from '../src/cli.js';

main(process.argv.slice(2)).then(
  (code) => { process.exitCode = code ?? 0; },
  (err) => {
    process.stderr.write(`Error: ${err && err.message ? err.message : err}\n`);
    process.exitCode = 1;
  }
);
