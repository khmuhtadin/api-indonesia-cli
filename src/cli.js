import { readFile, writeFile, mkdir, rm, chmod } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { createRequire } from 'node:module';
import { printResult } from './format.js';

const require = createRequire(import.meta.url);
const pkg = require('../package.json');

export const DEFAULT_BASE_URL = 'https://use.apiindonesia.id';

export function configPath() {
  const base = process.env.XDG_CONFIG_HOME || join(homedir(), '.config');
  return join(base, 'apiindonesia', 'config.json');
}

async function readConfig() {
  try {
    return JSON.parse(await readFile(configPath(), 'utf8'));
  } catch {
    return {};
  }
}

async function resolveKey() {
  if (process.env.API_INDONESIA_KEY) return { key: process.env.API_INDONESIA_KEY, source: 'env API_INDONESIA_KEY' };
  const cfg = await readConfig();
  if (cfg.apiKey) return { key: cfg.apiKey, source: configPath() };
  return { key: null, source: null };
}

function mask(key) {
  if (!key) return '';
  return key.length > 14 ? `${key.slice(0, 12)}...${key.slice(-2)}` : '***';
}

// ---------- argument parsing ----------

export function parseArgs(argv) {
  const positional = [];
  const flags = {};
  const params = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--') { positional.push(...argv.slice(i + 1)); break; }
    if (a.startsWith('--')) {
      let name = a.slice(2);
      let value;
      const eq = name.indexOf('=');
      if (eq !== -1) { value = name.slice(eq + 1); name = name.slice(0, eq); }
      const booleans = ['json', 'help', 'version', 'upcoming', 'bi', 'raw'];
      if (value === undefined && !booleans.includes(name)) {
        const next = argv[i + 1];
        if (next !== undefined && !next.startsWith('--')) { value = next; i++; }
      }
      if (name === 'param' || name === 'p') params.push(value ?? '');
      else flags[name] = value === undefined ? true : value;
    } else if (a === '-h') {
      flags.help = true;
    } else if (a === '-v') {
      flags.version = true;
    } else if (a === '-p') {
      params.push(argv[++i] ?? '');
    } else {
      positional.push(a);
    }
  }
  return { positional, flags, params };
}

// ---------- HTTP ----------

export async function request(path, { method = 'GET', query = {}, body, key, baseUrl } = {}) {
  const base = (baseUrl || process.env.API_INDONESIA_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '');
  const url = new URL(base + (path.startsWith('/') ? path : `/${path}`));
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null && v !== '' && v !== true) url.searchParams.set(k, String(v));
  }
  const headers = { accept: 'application/json', 'user-agent': `apiindonesia-cli/${pkg.version}` };
  if (key) headers['x-api-key'] = key;
  if (body !== undefined) headers['content-type'] = 'application/json';
  const res = await fetch(url, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { ok: res.ok, status: res.status, data };
}

// ---------- help ----------

const HELP = `apiindonesia ${pkg.version}
Command-line client for API Indonesia (https://apiindonesia.id).
Indonesian public data from official sources, one API key.

Usage:
  apiindonesia <command> [args] [--json]

Auth:
  login <api-key>            Save your API key to ~/.config/apiindonesia/config.json (mode 600)
  logout                     Remove the saved key
  whoami                     Show which key is in use (masked) and where it comes from
                             (or set API_INDONESIA_KEY in your environment)

Regions (Kemendagri codes):
  wilayah provinsi
  wilayah kabupaten <provinsi_id>
  wilayah kecamatan <kabupaten_id>
  wilayah kelurahan <kecamatan_id>
  wilayah search <query>
  kodepos <query|5-digit code>

Calendar and religion:
  libur [--tahun 2026] [--bulan 06] [--upcoming]
  sholat <kabupaten_id> [--tanggal YYYY-MM-DD]

BMKG:
  gempa [terkini|dirasakan]  Latest earthquakes (default: terkini)
  cuaca <adm4 code>          Village weather forecast, e.g. 32.73.01.1001
  cuaca <place name>         Find the adm4 code for a place, e.g. cuaca bandung

Money:
  kurs [--base USD] [--target IDR]
  kurs --bi [--currencies USD,EUR,SGD]   Bank Indonesia transaction rates
  ump [province] [year]      Minimum wage (province code like 32 or name like jawa)

Directories:
  sekolah <query>            Schools (by name or NPSN)
  kampus <query>             Universities
  rs <query>                 Hospitals
  halal <query>              Halal certificates (BPJPH)
  bpom <query>               BPOM registered products
  merek <query>              DJKI registered trademarks

Validation:
  nik-check <nik>            NIK format check only (structure, region code, birth date,
                             gender). It does NOT verify the NIK against Dukcapil.

Anything else:
  get <path> [--param key=value ...]   Call any GET endpoint, e.g.
                                       apiindonesia get /api/v1/kbbi/word/rumah

Global options:
  --json                     Print the raw JSON response
  --page <n> --per-page <n>  Pagination where supported
  -h, --help                 Show help
  -v, --version              Show version

Pricing: each successful request uses 2 credits. Failed requests are not charged.
Get a key at https://dashboard.apiindonesia.id  Docs: https://docs.apiindonesia.id
`;

// ---------- commands ----------

function need(value, usage) {
  if (value === undefined || value === null || value === '') {
    throw new Error(`missing argument. Usage: apiindonesia ${usage}`);
  }
  return value;
}

function pageQuery(flags) {
  return { page: flags.page, per_page: flags['per-page'] ?? flags.per_page };
}

function routeFor(positional, flags) {
  const [cmd, ...rest] = positional;
  const pq = pageQuery(flags);
  switch (cmd) {
    case 'wilayah': {
      const [level, arg] = rest;
      switch (level) {
        case 'provinsi':
          return arg ? { path: `/api/v1/wilayah/provinsi/${enc(arg)}` } : { path: '/api/v1/wilayah/provinsi', query: { per_page: 100, ...clean(pq) } };
        case 'kabupaten':
          return { path: `/api/v1/wilayah/provinsi/${enc(need(arg, 'wilayah kabupaten <provinsi_id>'))}/kabupaten`, query: { per_page: 100, ...clean(pq) } };
        case 'kecamatan':
          return { path: `/api/v1/wilayah/kabupaten/${enc(need(arg, 'wilayah kecamatan <kabupaten_id>'))}/kecamatan`, query: { per_page: 100, ...clean(pq) } };
        case 'kelurahan':
        case 'desa':
          return { path: `/api/v1/wilayah/kecamatan/${enc(need(arg, 'wilayah kelurahan <kecamatan_id>'))}/kelurahan`, query: { per_page: 100, ...clean(pq) } };
        case 'search':
          return { path: '/api/v1/wilayah/search', query: { q: need(rest.slice(1).join(' '), 'wilayah search <query>'), ...pq } };
        default:
          throw new Error('Usage: apiindonesia wilayah <provinsi|kabupaten|kecamatan|kelurahan|search> [arg]');
      }
    }
    case 'kodepos': {
      const q = need(rest.join(' '), 'kodepos <query|kode_pos>');
      if (/^\d{5}$/.test(q)) return { path: '/api/v1/kodepos/lookup', query: { kode_pos: q, ...pq } };
      return { path: '/api/v1/kodepos/search', query: { q, ...pq } };
    }
    case 'libur':
      if (flags.upcoming) return { path: '/api/v1/libur/upcoming' };
      return { path: '/api/v1/libur', query: { tahun: flags.tahun ?? rest[0] ?? new Date().getFullYear(), bulan: flags.bulan } };
    case 'sholat':
      return { path: '/api/v1/sholat', query: { kabupaten_id: need(rest[0], 'sholat <kabupaten_id> [--tanggal YYYY-MM-DD]'), tanggal: flags.tanggal } };
    case 'gempa': {
      const kind = rest[0] || 'terkini';
      if (!['terkini', 'dirasakan'].includes(kind)) throw new Error('Usage: apiindonesia gempa [terkini|dirasakan]');
      return { path: `/api/v1/gempa/${kind}` };
    }
    case 'cuaca': {
      const arg = need(rest.join(' '), 'cuaca <adm4 code | place name>');
      if (rest[0] === 'search') return { path: '/api/v1/cuaca/search', query: { q: need(rest.slice(1).join(' '), 'cuaca search <place>') } };
      if (/^\d{2}\.?\d{2}\.?\d{2}\.?\d{4}$/.test(arg)) {
        const d = arg.replace(/\./g, '');
        return { path: '/api/v1/cuaca', query: { adm4: `${d.slice(0, 2)}.${d.slice(2, 4)}.${d.slice(4, 6)}.${d.slice(6)}` } };
      }
      if (/^\d{4}$/.test(arg)) return { path: '/api/v1/cuaca', query: { kabupaten_id: arg } };
      return { path: '/api/v1/cuaca/search', query: { q: arg } };
    }
    case 'kurs':
      if (flags.bi) return { path: '/api/v1/kurs-bi/latest', query: { currencies: flags.currencies ?? rest[0] } };
      return { path: '/api/v1/kurs/latest', query: { base: flags.base ?? rest[0], target: flags.target ?? rest[1] } };
    case 'ump': {
      const [prov, year] = rest;
      const y = flags.year ?? flags.tahun ?? year;
      if (prov && /^\d{1,2}$/.test(prov)) {
        return y ? { path: `/api/v1/ump/${enc(prov)}/${enc(y)}` } : { path: `/api/v1/ump/${enc(prov)}` };
      }
      if (prov && /^\d{4}$/.test(prov)) return { path: '/api/v1/ump', query: { year: prov } };
      return { path: '/api/v1/ump', query: { province_name: prov, year: y } };
    }
    case 'sekolah': {
      const q = need(rest.join(' '), 'sekolah <query|npsn>');
      if (/^\d{8}$/.test(q)) return { path: `/api/v1/sekolah/${q}` };
      return { path: '/api/v1/sekolah/search', query: { q } };
    }
    case 'kampus':
      return { path: '/api/v1/kampus', query: { q: need(rest.join(' '), 'kampus <query>'), ...pq } };
    case 'rs':
    case 'rumah-sakit':
      return { path: '/api/v1/rumah-sakit', query: { q: need(rest.join(' '), 'rs <query>'), ...pq } };
    case 'halal':
      return { path: '/api/v1/halal', query: { q: need(rest.join(' '), 'halal <query>'), limit: flags.limit ?? 20 } };
    case 'bpom':
      return { path: '/api/v1/bpom', query: { q: need(rest.join(' '), 'bpom <query>') } };
    case 'merek':
      return { path: '/api/v1/merek/search', query: { q: need(rest.join(' '), 'merek <query>'), page: flags.page, limit: flags.limit, owner: flags.owner, class: flags.class } };
    case 'nik-check':
    case 'nik':
      return { path: '/api/v1/validasi/nik', method: 'POST', body: { nik: need(rest[0], 'nik-check <16-digit NIK>') }, note: 'Note: this is a format check only. It does not verify the NIK against Dukcapil.' };
    default:
      return null;
  }
}

function enc(v) { return encodeURIComponent(String(v)); }
function clean(o) { return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)); }

function parseParams(params) {
  const q = {};
  for (const p of params) {
    const i = p.indexOf('=');
    if (i <= 0) throw new Error(`invalid --param "${p}", expected key=value`);
    q[p.slice(0, i)] = p.slice(i + 1);
  }
  return q;
}

export async function main(argv) {
  const { positional, flags, params } = parseArgs(argv);
  const cmd = positional[0];

  if (flags.version) { console.log(pkg.version); return 0; }
  if (!cmd || cmd === 'help' || flags.help) { process.stdout.write(HELP); return 0; }

  if (cmd === 'login') {
    const key = positional[1] || process.env.API_INDONESIA_KEY;
    if (!key) throw new Error('Usage: apiindonesia login <api-key>  (get one at https://dashboard.apiindonesia.id)');
    if (!/^aip_(live|test)_/.test(key)) process.stderr.write('Warning: key does not look like an API Indonesia key (aip_live_...). Saving anyway.\n');
    const file = configPath();
    await mkdir(dirname(file), { recursive: true, mode: 0o700 });
    const cfg = await readConfig();
    cfg.apiKey = key;
    await writeFile(file, JSON.stringify(cfg, null, 2) + '\n', { mode: 0o600 });
    await chmod(file, 0o600);
    console.log(`Saved key ${mask(key)} to ${file}`);
    return 0;
  }

  if (cmd === 'logout') {
    await rm(configPath(), { force: true });
    console.log('Removed saved key.' + (process.env.API_INDONESIA_KEY ? ' Note: API_INDONESIA_KEY is still set in your environment.' : ''));
    return 0;
  }

  if (cmd === 'whoami') {
    const { key, source } = await resolveKey();
    if (!key) { console.log('Not logged in. Run: apiindonesia login <api-key>'); return 1; }
    console.log(`Key:    ${mask(key)}\nSource: ${source}`);
    console.log('Credit balance is shown in your dashboard: https://dashboard.apiindonesia.id');
    return 0;
  }

  let route;
  if (cmd === 'get') {
    const path = need(positional[1], 'get <path> [--param key=value]');
    route = { path, query: parseParams(params) };
  } else {
    route = routeFor(positional, flags);
    if (route && params.length) route.query = { ...(route.query || {}), ...parseParams(params) };
  }
  if (!route) {
    process.stderr.write(`Unknown command "${cmd}". Run "apiindonesia --help".\n`);
    return 2;
  }

  const { key } = await resolveKey();
  if (!key) throw new Error('No API key. Run "apiindonesia login <api-key>" or set API_INDONESIA_KEY. Get a key at https://dashboard.apiindonesia.id');

  const res = await request(route.path, { method: route.method, query: route.query, body: route.body, key });
  if (flags.json || flags.raw) {
    console.log(typeof res.data === 'string' ? res.data : JSON.stringify(res.data, null, 2));
    return res.ok ? 0 : 1;
  }
  if (!res.ok || (res.data && res.data.success === false)) {
    const err = res.data && res.data.error;
    const msg = err ? `${err.code || res.status}: ${err.message || ''}` : `HTTP ${res.status}`;
    process.stderr.write(`Error ${msg}\n`);
    return 1;
  }
  printResult(res.data, cmd);
  if (route.note) console.log(`\n${route.note}`);
  return 0;
}
