/**
 * Python Floripa - Voluntariado | Web App (Apps Script)
 * IMPLANTAÇÃO: Executar como "Eu" | Quem pode acessar "Qualquer pessoa". Após editar: Implantar > Gerenciar > ✏️ > Nova versão.
 * Colunas: A Data/Hora | B Nome | C Email | D WhatsApp | E Perfil | F Trilhas | G Motivacao | H Disponibilidade | I Consentimento LGPD | J Observação
 *
 * Protocolo de confirmação (não depende de ler a resposta do POST):
 *   POST  (com rid)         -> grava e registra o resultado no cache sob o rid
 *   GET ?rid=<id>           -> {estado: 'gravado' | 'erro:<campo>' | 'pendente'}   (o rid é aleatório e de uso único)
 */
const CFG = {
  VERSAO: '2026-10-01.6',
  SHEET_ID: '1KASZc3XRu4o-lMiRRnJu_EEuAdPNhjYCmX0f8Wld_Zc',
  ABA: 'Inscricoes',
  MAX_POR_MINUTO: 30,
  TRILHAS: ['Dados & Métricas', 'Site & Git', 'Comunicação & Redes', 'Apoio no Dia do Evento'],
  DISPONIBILIDADES: ['Apenas no dia dos eventos presenciais', 'Aprox. 2 horas por semana',
                     'Aprox. 4 horas por semana', 'Mais de 4 horas por semana']
};

function planilha_() { return SpreadsheetApp.openById(CFG.SHEET_ID); }
function rid_(v) { v = String(v || ''); return /^[a-f0-9-]{16,40}$/i.test(v) ? v : ''; }

function doGet(e) {
  try {
    const r = { result: 'ok', versao: CFG.VERSAO, aba_ok: !!planilha_().getSheetByName(CFG.ABA) };
    const rid = rid_(e && e.parameter && e.parameter.rid);
    if (rid) {
      const c = CacheService.getScriptCache();
      r.estado = c.get('ok_' + rid) ? 'gravado' : (c.get('err_' + rid) ? 'erro:' + c.get('err_' + rid) : 'pendente');
    }
    return out_(r);
  } catch (err) {
    return out_({ result: 'error', versao: CFG.VERSAO, error: 'sem_acesso_planilha' });
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  const p = (e && e.parameter) || {};
  const rid = rid_(p.rid), cache = CacheService.getScriptCache();
  const fim = function (obj) {                       // registra o desfecho sob o rid para o GET de confirmação
    try { if (rid) cache.put(obj.result === 'success' ? 'ok_' + rid : 'err_' + rid, obj.result === 'success' ? '1' : String(obj.error).slice(0, 30), 3600); } catch (_) {}
    return out_(obj);
  };
  try {
    if (!lock.tryLock(15000)) return out_({ result: 'error', error: 'busy' });
    if (rid && cache.get('ok_' + rid)) return out_({ result: 'success', info: 'idempotente' });   // retry do mesmo envio: não duplica
    if (p.hp) { logErro_('honeypot'); return fim({ result: 'error', error: 'rejeitado' }); }
    if (!limiteOk_()) { logErro_('rate_limit'); return fim({ result: 'error', error: 'rate_limit' }); }

    const d = validar_(p);
    if (d.erro) { logErro_('campo_invalido: ' + d.erro); return fim({ result: 'error', error: d.erro }); }

    const sheet = planilha_().getSheetByName(CFG.ABA);
    if (!sheet) throw new Error('Aba "' + CFG.ABA + '" não encontrada');
    garantirCabecalho_(sheet);

    const anterior = linhaDoEmail_(sheet, d.email);
    const linha = sheet.getLastRow() + 1;
    const obs = anterior ? 'Reenvio (e-mail já cadastrado na linha ' + anterior + ')' : '';
    // Formato texto (@): nada digitado vira fórmula (=IMPORTXML, =HYPERLINK...).
    sheet.getRange(linha, 2, 1, 9).setNumberFormat('@');
    sheet.getRange(linha, 1).setNumberFormat('dd/MM/yyyy HH:mm:ss');
    sheet.getRange(linha, 1).setValue(new Date());
    sheet.getRange(linha, 2, 1, 9).setValues([[d.nome, d.email, d.whatsapp, d.perfil, d.trilhas, d.motivacao, d.disponibilidade, 'Sim', obs]]);
    SpreadsheetApp.flush();
    return fim({ result: 'success', info: anterior ? 'reenvio' : 'criado' });
  } catch (err) {
    console.error(err);
    logErro_('excecao: ' + err);
    return fim({ result: 'error', error: 'internal' });
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

function validar_(p) {
  const t = function (v, max) { return String(v || '').replace(/\s+/g, ' ').trim().slice(0, max); };
  const nome = t(p.nome, 100), email = t(p.email, 120).toLowerCase();
  const whatsapp = String(p.whatsapp || '').replace(/\D/g, '');
  const motivacao = t(p.motivacao, 1000), perfil = t(p.perfil, 200);

  if (nome.length < 3 || nome.split(' ').length < 2) return { erro: 'nome' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return { erro: 'email' };
  if (whatsapp.length < 10 || whatsapp.length > 11) return { erro: 'whatsapp' };
  if (perfil && !/^https?:\/\/[^\s]+\.[^\s]+$/i.test(perfil)) return { erro: 'perfil' };
  if (motivacao.length < 20) return { erro: 'motivacao' };
  if (CFG.DISPONIBILIDADES.indexOf(p.disponibilidade) < 0) return { erro: 'disponibilidade' };
  if (p.consentimento !== 'sim') return { erro: 'consentimento' };
  const trilhas = String(p.trilhas || '').split(',').map(function (s) { return s.trim(); })
    .filter(function (s) { return CFG.TRILHAS.indexOf(s) >= 0; });
  if (!trilhas.length) return { erro: 'trilhas' };
  return { nome: nome, email: email, whatsapp: whatsapp, perfil: perfil, motivacao: motivacao,
           disponibilidade: p.disponibilidade, trilhas: trilhas.join(', ') };
}

function limiteOk_() {
  const cache = CacheService.getScriptCache(), k = 'rate_' + Math.floor(Date.now() / 60000);
  const n = Number(cache.get(k) || 0) + 1;
  cache.put(k, String(n), 120);
  return n <= CFG.MAX_POR_MINUTO;
}

function linhaDoEmail_(sheet, email) {
  const n = sheet.getLastRow() - 1;
  if (n < 1) return 0;
  const v = sheet.getRange(2, 3, n, 1).getValues();
  for (let i = 0; i < v.length; i++) if (String(v[i][0]).toLowerCase() === email) return i + 2;
  return 0;
}

function garantirCabecalho_(sheet) {
  if (!sheet.getRange('I1').getValue()) sheet.getRange('I1').setValue('Consentimento LGPD');
  if (!sheet.getRange('J1').getValue()) sheet.getRange('J1').setValue('Observação');
}

function logErro_(motivo) {                           // só o MOTIVO, nunca dados pessoais; nunca derruba o fluxo
  try {
    const ss = planilha_();
    (ss.getSheetByName('Erros') || ss.insertSheet('Erros')).appendRow([new Date(), String(motivo).slice(0, 200)]);
  } catch (e) { console.error('logErro_ falhou', e); }
}

function out_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// Rode UMA VEZ no editor (▶ testarGravacao): autoriza o script e grava uma linha de teste (apague depois).
function testarGravacao() {
  const r = doPost({ parameter: { nome: 'Teste Diagnostico', email: 'teste+' + Date.now() + '@exemplo.com', whatsapp: '48999998888',
    perfil: '', trilhas: CFG.TRILHAS[0], motivacao: 'Linha de teste do diagnostico do script.',
    disponibilidade: CFG.DISPONIBILIDADES[0], consentimento: 'sim', hp: '' } });
  console.log(r.getContent());
}
