// Uso:  node scripts/diagnostico-glpi.mjs [ID_DO_CHAMADO]
// Lê URL/tokens de glpi-scheduler-data.json (os mesmos salvos na tela "Conexão GLPI").
import fs from 'fs';

const cfg = JSON.parse(fs.readFileSync(new URL('../glpi-scheduler-data.json', import.meta.url), 'utf-8')).glpiConfig || {};
const base = String(cfg.url || '').trim().replace(/\/+$/, '');
if (!base) { console.error('URL do GLPI não configurada.'); process.exit(1); }

const sp = (d) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'medium' }).format(d);
console.log('=== RELÓGIO DESTE COMPUTADOR ===');
console.log('Agora em UTC.............:', new Date().toISOString());
console.log('Agora em America/Sao_Paulo:', sp(new Date()), '<- é isto que o app envia ao GLPI');
console.log('Fuso do Windows/Node.....:', Intl.DateTimeFormat().resolvedOptions().timeZone);

const h = (t) => ({ 'Content-Type': 'application/json', 'App-Token': cfg.appToken, ...(t ? { 'Session-Token': t } : { Authorization: `user_token ${cfg.userToken}` }) });
const get = async (p, t) => { const r = await fetch(`${base}/${p}`, { headers: h(t) }); return { ok: r.ok, status: r.status, body: await r.json().catch(() => null) }; };

const init = await get('initSession');
if (!init.ok) { console.error('Falha no initSession:', init.status, init.body); process.exit(1); }
const tk = init.body.session_token;
try {
  const fs_ = await get('getFullSession', tk);
  const sess = fs_.body?.session || {};
  console.log('\n=== RELÓGIO/FUSO DO GLPI ===');
  console.log('glpi_currenttime (servidor GLPI):', sess.glpi_currenttime);
  for (const [k, v] of Object.entries(sess)) if (/zone|tz|timezone/i.test(k)) console.log(`${k}:`, v);

  const id = process.argv[2];
  if (id) {
    const t = await get(`Ticket/${id}`, tk);
    const x = t.body || {};
    console.log(`\n=== CHAMADO #${id} (como a API enxerga) ===`);
    console.log('date (abertura).:', x.date);
    console.log('date_creation...:', x.date_creation);
    console.log('entities_id.....:', x.entities_id);
    console.log('itilcategories_id:', x.itilcategories_id);
    console.log('locations_id....:', x.locations_id, Number(x.locations_id) > 0
      ? '<- A LOCALIZAÇÃO ESTÁ GRAVADA. Se não aparece na tela, o modelo de chamado da entidade/categoria a esconde.'
      : '<- localização VAZIA no banco (não foi gravada).');
    console.log('requesttypes_id.:', x.requesttypes_id, '| type:', x.type, '| status:', x.status);
  } else {
    console.log('\n(Passe o ID de um chamado para ver data e localização: node scripts/diagnostico-glpi.mjs 123)');
  }
} finally {
  await get('killSession', tk);
}
