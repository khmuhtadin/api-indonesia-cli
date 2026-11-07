// Plain-text output helpers. No dependencies.

const HIDDEN = new Set([
  'created_at', 'updated_at', 'fetched_at', 'is_active', 'source_url', 'raw', 'geometry',
]);

// Preferred columns per command (only those present in the data are shown).
const PRESETS = {
  wilayah: ['id', 'name', 'alt_name', 'lat', 'lng'],
  kodepos: ['kode_pos', 'village_name', 'district_name', 'regency_name', 'province_name', 'kelurahan', 'kecamatan', 'kabupaten', 'provinsi'],
  libur: ['date', 'name', 'type', 'is_joint_leave'],
  gempa: ['datetime', 'magnitude', 'depth_km', 'region', 'felt_areas'],
  cuaca: ['local_datetime', 'adm4', 'desa', 'kecamatan', 'kotkab', 'provinsi', 'weather_desc', 'temperature_c', 'humidity_percent', 'wind_speed'],
  kurs: ['date', 'currency', 'base', 'target', 'rate', 'buy_rate', 'sell_rate', 'mid_rate'],
  ump: ['province_code', 'province_name', 'year', 'salary'],
  sekolah: ['npsn', 'name', 'jenis', 'status', 'accreditation', 'address', 'postal_code'],
  kampus: ['id', 'name', 'jenis', 'kelompok', 'regency_name', 'province_name'],
  rs: ['code', 'name', 'jenis', 'kelas', 'beds_total', 'regency_name', 'province_name'],
  halal: ['company_name', 'cert_no', 'status', 'business_scale', 'issue_date', 'expiry_date'],
  bpom: ['nie', 'product_name', 'name', 'brand', 'company', 'registrant', 'category', 'issued_date', 'expiry_date'],
  merek: ['app_number', 'mark_name', 'class', 'owner', 'reg_date'],
};

function isScalar(v) {
  return v === null || ['string', 'number', 'boolean'].includes(typeof v);
}

function cell(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v).replace(/\s+/g, ' ');
}

function pickColumns(rows, cmd) {
  const keys = [];
  for (const r of rows.slice(0, 20)) {
    for (const [k, v] of Object.entries(r)) {
      if (!keys.includes(k) && isScalar(v) && !HIDDEN.has(k)) keys.push(k);
    }
  }
  const preset = PRESETS[cmd === 'rumah-sakit' ? 'rs' : cmd];
  if (preset) {
    const cols = preset.filter((k) => keys.includes(k));
    if (cols.length >= 2) return cols;
  }
  return keys.slice(0, 7);
}

export function table(rows, cols) {
  const termWidth = process.stdout.columns || 160;
  const maxCol = Math.max(12, Math.floor((termWidth - cols.length * 2) / Math.max(cols.length, 1)) + 10);
  const data = rows.map((r) => cols.map((c) => {
    const s = cell(r[c]);
    return s.length > maxCol ? s.slice(0, maxCol - 3) + '...' : s;
  }));
  const widths = cols.map((c, i) => Math.max(c.length, ...data.map((d) => d[i].length)));
  const line = (vals) => vals.map((v, i) => v.padEnd(widths[i])).join('  ').trimEnd();
  const out = [line(cols), line(widths.map((w) => '-'.repeat(w))), ...data.map(line)];
  return out.join('\n');
}

function keyValue(obj, indent = '') {
  const entries = Object.entries(obj).filter(([k]) => !HIDDEN.has(k));
  const w = Math.max(0, ...entries.map(([k]) => k.length));
  const lines = [];
  for (const [k, v] of entries) {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      lines.push(`${indent}${k}:`);
      lines.push(keyValue(v, indent + '  '));
    } else if (Array.isArray(v)) {
      if (v.length === 0) lines.push(`${indent}${k.padEnd(w)}  (none)`);
      else if (v.every(isScalar)) lines.push(`${indent}${k.padEnd(w)}  ${v.join(', ')}`);
      else lines.push(`${indent}${k.padEnd(w)}  ${v.length} item(s), use --json to see all`);
    } else {
      lines.push(`${indent}${k.padEnd(w)}  ${cell(v)}`);
    }
  }
  return lines.join('\n');
}

export function printResult(body, cmd) {
  if (body === null || body === undefined) { console.log('(empty response)'); return; }
  if (typeof body === 'string') { console.log(body); return; }
  const data = body && Object.prototype.hasOwnProperty.call(body, 'data') ? body.data : body;
  const meta = (body && (body.meta || body.pagination)) || null;

  if (Array.isArray(data)) {
    if (data.length === 0) {
      console.log('No results.');
    } else if (data.every(isScalar)) {
      console.log(data.join('\n'));
    } else {
      console.log(table(data, pickColumns(data, cmd)));
    }
  } else if (data && typeof data === 'object') {
    console.log(keyValue(data));
  } else {
    console.log(cell(data));
  }

  if (meta && typeof meta === 'object') {
    const bits = [];
    if (meta.total !== undefined) bits.push(`total ${meta.total}`);
    if (meta.page !== undefined && meta.total_pages !== undefined) bits.push(`page ${meta.page}/${meta.total_pages}`);
    if (meta.attribution) bits.push(meta.attribution);
    else if (meta.source) bits.push(`source: ${meta.source}`);
    if (meta.disclaimer) bits.push(meta.disclaimer);
    if (bits.length) console.log(`\n${bits.join(' | ')}`);
  }
}
