import Fastify, { type FastifyInstance } from "fastify";
import type { ScanService } from "../../domain/scan-service";

// Delivery adapter: translates HTTP <-> the ScanService. No DB, no queue here.
export function buildServer(scanService: ScanService): FastifyInstance {
  const app = Fastify({ logger: false });

  app.post("/scans", async (req, reply) => {
    const target = (req.body as { target?: string } | undefined)?.target?.trim();
    if (!target) return reply.code(400).send({ error: "target is required" });
    const id = await scanService.requestScan(target);
    return reply.code(202).send({ id, status: "queued" });
  });

  app.get("/scans", async () => scanService.listScans());

  app.get("/scans/:id", async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    const scan = await scanService.getScan(id);
    if (!scan) return reply.code(404).send({ error: "not found" });
    return scan;
  });

  app.get("/", async (_req, reply) => reply.type("text/html").send(PAGE));

  return app;
}

const PAGE = `<!doctype html>
<html><head><meta charset="utf-8"><title>demon scanner</title>
<style>body{font-family:system-ui;margin:2rem;max-width:720px}li{cursor:pointer;padding:2px 0}pre{background:#f4f4f4;padding:1rem;overflow:auto}</style>
</head><body>
<h1>Scans</h1>
<form id="f"><input id="t" placeholder="http://localhost" size="40"><button>Scan</button></form>
<ul id="list"></ul>
<div id="detail"></div>
<script>
async function load(){
  var scans = await (await fetch('/scans')).json();
  document.getElementById('list').innerHTML = scans.map(function(s){
    return '<li data-id="'+s.id+'">#'+s.id+' ['+s.status+'] '+s.target+'</li>';
  }).join('');
}
async function show(id){
  var s = await (await fetch('/scans/'+id)).json();
  document.getElementById('detail').innerHTML =
    '<h2>Scan #'+s.id+' &mdash; '+s.status+'</h2>'+
    (s.failureReason ? '<p>failure: '+s.failureReason+'</p>' : '')+
    '<pre>'+JSON.stringify(s.findings,null,2)+'</pre>';
}
document.getElementById('list').addEventListener('click',function(e){
  var id = e.target.getAttribute('data-id'); if(id) show(id);
});
document.getElementById('f').addEventListener('submit',async function(e){
  e.preventDefault();
  await fetch('/scans',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({target:document.getElementById('t').value})});
  document.getElementById('t').value=''; setTimeout(load,300);
});
load(); setInterval(load,2000);
</script>
</body></html>`;
