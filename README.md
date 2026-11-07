# apiindonesia

Command-line client for [API Indonesia](https://apiindonesia.id): Indonesian public data from official sources, right in your terminal.

Regions (Kemendagri codes), postal codes, public holidays and cuti bersama, prayer times, BMKG earthquakes and weather, exchange rates (including Bank Indonesia), minimum wage (UMP), schools, universities, hospitals, halal certificates, BPOM products, DJKI trademarks and NIK format checks. Any other endpoint is reachable with `apiindonesia get`.

- Zero dependencies, Node.js 18 or newer
- Pretty tables by default, raw JSON with `--json`
- MIT licensed

## Install

```bash
npm install -g apiindonesia
# or run without installing
npx apiindonesia --help
```

The package installs two command names: `apiindonesia` and `api-indonesia`.

## Get an API key

Sign up at [dashboard.apiindonesia.id](https://dashboard.apiindonesia.id/register). New accounts get a one-time bonus of 3,000 credits (no card needed). Each successful request uses 2 credits; failed requests are not charged.

```bash
apiindonesia login aip_live_xxxxxxxx
# or
export API_INDONESIA_KEY=aip_live_xxxxxxxx
```

`login` saves the key to `~/.config/apiindonesia/config.json` with file mode 600. `API_INDONESIA_KEY` takes priority when set. `apiindonesia whoami` shows which key is in use (masked) and `apiindonesia logout` removes the saved key.

## Examples

```bash
# Regions
apiindonesia wilayah provinsi
apiindonesia wilayah kabupaten 61          # regencies in Kalimantan Barat
apiindonesia wilayah kecamatan 6171        # districts in Kota Pontianak
apiindonesia wilayah kelurahan 617101
apiindonesia wilayah search pontianak

# Postal codes
apiindonesia kodepos 78124
apiindonesia kodepos tegal

# Holidays and prayer times
apiindonesia libur --upcoming
apiindonesia libur --tahun 2027 --bulan 01
apiindonesia sholat 6171 --tanggal 2026-12-01

# BMKG
apiindonesia gempa                         # latest earthquakes
apiindonesia gempa dirasakan               # felt earthquakes
apiindonesia cuaca bandung                 # find a village adm4 code
apiindonesia cuaca 32.73.01.1001           # forecast for that village

# Money
apiindonesia kurs                          # USD to IDR
apiindonesia kurs --base SGD --target IDR
apiindonesia kurs --bi --currencies USD,EUR,SGD
apiindonesia ump jawa 2025
apiindonesia ump 32 2025

# Directories
apiindonesia sekolah "sma negeri 1 pontianak"
apiindonesia sekolah 30105210              # by NPSN
apiindonesia kampus tanjungpura
apiindonesia rs pontianak
apiindonesia halal indomie
apiindonesia bpom indomie
apiindonesia merek garuda

# NIK format check
apiindonesia nik-check 3201010101900001
```

`nik-check` only checks the structure of a NIK (length, region code, birth date, gender). It does not look the number up in Dukcapil or any official database.

### Any endpoint

```bash
apiindonesia get /api/v1/kbbi/word/rumah
apiindonesia get /api/v1/hijriah/konversi --param tanggal=2026-11-08
apiindonesia get /api/v1/geo/negara --param q=malaysia --json
```

The full list of endpoints is in the [OpenAPI spec](https://apiindonesia.id/openapi.json) and the [docs](https://docs.apiindonesia.id).

### JSON output

Add `--json` to any command to print the raw API response, which works well with `jq`:

```bash
apiindonesia libur --upcoming --json | jq '.data[0]'
```

## Configuration

| Variable | Purpose |
| --- | --- |
| `API_INDONESIA_KEY` | API key (overrides the saved key) |
| `API_INDONESIA_BASE_URL` | Base URL, defaults to `https://use.apiindonesia.id` |
| `XDG_CONFIG_HOME` | Config directory root, defaults to `~/.config` |

## Related

- Website: [apiindonesia.id](https://apiindonesia.id)
- Docs: [docs.apiindonesia.id](https://docs.apiindonesia.id)
- MCP server for AI agents: `https://mcp.apiindonesia.id/mcp`
- n8n node: [n8n-nodes-api-indonesia](https://www.npmjs.com/package/n8n-nodes-api-indonesia)
- Examples, agent skill and MCP config: [khmuhtadin/api-indonesia-examples](https://github.com/khmuhtadin/api-indonesia-examples)

## License

MIT. Built by Khaisa Studio.
