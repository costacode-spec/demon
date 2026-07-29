# Manual testing guide

How to exercise the whole scanner by hand, end to end. Every command here was
run during development and works as written.

## 0. Prerequisites (one-time)

```sh
node --version          # need 20.12+
docker --version        # colima: `colima start` first if `docker` errors
nmap --version          # brew install nmap
nuclei -version         # brew install nuclei
npm install
cp .env.example .env
```

First `nuclei` run downloads ~13k templates (a few minutes). Trigger it once now
so later scans are fast:

```sh
nuclei -update-templates
```

## 1. Start the stack

```sh
docker-compose up -d          # Postgres on :5432
npm run dev                   # API + worker on :3000  (leave running)
```

You should see `scanner up on :3000`. If it instead throws
`Required tool 'nmap'/'nuclei' not found`, fix PATH — that check is intentional.

## 2. Stand up a target you own

Never scan anything you don't control. Spin up a throwaway local server:

```sh
python3 -m http.server 8080   # in a second terminal, leave running
```

## 3. Test via the web page

1. Open <http://localhost:3000>.
2. Type `http://localhost:8080` in the box, click **Scan**.
3. The list shows the scan; it flips `queued → running → succeeded` (the page
   auto-refreshes every 2s).
4. Click the scan row — findings render as JSON below.

> A full scan runs the entire template set and takes ~2–3 minutes. That's
> expected. To watch a fast one, see step 5's `NUCLEI_EXTRA_ARGS` trick.

## 4. Test via the API

```sh
# submit a scan -> returns {"id":N,"status":"queued"}
curl -s -XPOST localhost:3000/scans \
  -H 'content-type: application/json' \
  -d '{"target":"http://localhost:8080"}'

# list all scans
curl -s localhost:3000/scans | jq

# poll one scan + its findings (replace 1 with the id above)
curl -s localhost:3000/scans/1 | jq
```

Checks to eyeball:
- Status advances to `succeeded` (or `failed` with a `failure_reason` — never
  vanishes).
- `findings[]` carries `template_id`, `severity`, `matched_at`.
- Bad input is rejected: `curl -s -XPOST localhost:3000/scans -H 'content-type: application/json' -d '{}'` → `400`.
- Unknown id 404s: `curl -s -o /dev/null -w '%{http_code}\n' localhost:3000/scans/999999` → `404`.

## 5. Make a scan finish in ~1s (optional)

Full scans are slow. To sanity-check the pipeline fast, restart the server with
nuclei scoped to a single template:

```sh
# stop `npm run dev`, then:
NUCLEI_EXTRA_ARGS="-t http/miscellaneous/robots-txt.yaml -timeout 5" npm run dev
```

Now every scan finishes in about a second. Unset it to return to full scans.

## 6. Inspect the database directly (optional)

```sh
docker exec -it demon-db-1 psql -U scanner -c "select id,status,failure_reason from scans order by id desc;"
docker exec -it demon-db-1 psql -U scanner -c "select scan_id,template_id,severity,matched_at from findings order by id desc limit 20;"
docker exec -it demon-db-1 psql -U scanner -c "select spec,verification_status from targets;"
```

## 7. Run the automated tests

```sh
npm test          # fast: real Postgres, faked tools, no network
npm run test:live # one real nmap+nuclei scan of LIVE_TARGET (default http://localhost)
```

`test:live` needs the target from step 2 running and `RUN_LIVE=1` (the script
sets it). Point it elsewhere with `LIVE_TARGET=http://localhost:8080`.

## 8. Teardown

```sh
# Ctrl-C the `npm run dev` and `python3` terminals
docker-compose down          # add -v to also wipe the database volume
```

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Scan stuck on `queued` forever | Worker not running — is `npm run dev` up? Old jobs backed up: `docker exec demon-db-1 psql -U scanner -c "delete from pgboss.job where name='scan';"` |
| Scan stuck on `running` for minutes | Normal for a full template scan (~2–3 min). For a quick check use step 5. |
| `Required tool not found` at startup | `nmap`/`nuclei` not on PATH. |
| Every scan hangs far longer than 3 min | nuclei phoning home / reading stdin. The scanner already passes `-no-stdin -auth=false -duc`; if you edited it, put them back (see `src/adapters/scanner/nuclei-scanner.ts`). |
| `relation "targets" does not exist` | Migrations didn't run. They apply automatically on `npm run dev`/tests; for a clean slate `docker-compose down -v && docker-compose up -d`. |
| `docker` command not found | colima not started: `colima start`. |
