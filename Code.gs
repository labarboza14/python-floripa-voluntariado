/**
 * Python Floripa - Voluntariado | Web App (Apps Script vinculado à planilha)
 * Implantação: Executar como "Eu" | Acesso "Qualquer pessoa". Após editar: Implantar > Gerenciar > Nova versão.
 * Colunas: A Data/Hora | B Nome | C Email | D WhatsApp | E Perfil | F Trilhas | G Motivacao | H Disponibilidade | I Consentimento LGPD | J Observação
 */
const CFG = {
  VERSAO: '2026-09-30.5',
  SHEET_ID: '1KASZc3XRu4o-lMiRRnJu_EEuAdPNhjYCmX0f8Wld_Zc',  // abre a planilha pelo ID: não depende de o script estar vinculado a ela
  ABA: 'Inscricoes',
  MAX_POR_MINUTO: 30,         // limite global (proteção contra flood)
  TRILHAS: ['Dados & Métricas', 'Site & Git', 'Comunicação & Redes', 'Apoio no Dia do Evento'],
  DISPONIBILIDADES: ['Apenas no dia dos eventos presenciais', 'Aprox. 2 horas por semana',
                     'Aprox. 4 horas por semana', 'Mais de 4 horas por semana']
};

// Abra a URL /exec no navegador: prova qual versão está publicada e se o script alcança a aba (sem expor dados).
function doGet(e) {
  try {
    const aba = planilha_().getSheetByName(CFG.ABA);
    const r = { result: 'ok', versao: CFG.VERSAO, aba_ok: !!aba };
    if (e && e.parameter && e.parameter.diag === '1' && aba) r.linhas = Math.max(aba.getLastRow() - 1, 0);  // só contagem, usada pelo diagnostico.html
    return out_(r);
  } catch (err) {
    return out_({ result: 'error', versao: CFG.VERSAO, error: 'sem_acesso_planilha', detalhe: String(err).slice(0, 150) });
  }
}

function planilha_() {
  return CFG.SHEET_ID ? SpreadsheetApp.openById(CFG.SHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    if (!lock.tryLock(15000)) return out_({ result: 'error', error: 'busy' });
    const p = (e && e.parameter) || {};

    if (p.hp) { logErro_('honeypot'); return out_({ result: 'success' }); }
    if (!limiteOk_()) { logErro_('rate_limit'); return out_({ result: 'error', error: 'rate_limit' }); }

    const d = validar_(p);
    if (d.erro) { logErro_('campo_invalido: ' + d.erro); return out_({ result: 'error', error: d.erro }); }

    const sheet = planilha_().getSheetByName(CFG.ABA);
    if (!sheet) throw new Error('Aba "' + CFG.ABA + '" não encontrada');
    garantirCabecalho_(sheet);

    const anterior = linhaDoEmail_(sheet, d.email);   // 0 se for a primeira vez

    const linha = sheet.getLastRow() + 1;
    const obs = anterior ? 'Reenvio (e-mail já cadastrado na linha ' + anterior + ')' : '';
    // Formato texto (@) em B:J => nada digitado vira fórmula (ex.: =IMPORTXML, =HYPERLINK).
    sheet.getRange(linha, 2, 1, 9).setNumberFormat('@');
    sheet.getRange(linha, 1).setNumberFormat('dd/MM/yyyy HH:mm:ss');
    sheet.getRange(linha, 1).setValue(new Date());
    sheet.getRange(linha, 2, 1, 9).setValues([[d.nome, d.email, d.whatsapp, d.perfil, d.trilhas, d.motivacao, d.disponibilidade, 'Sim', obs]]);

    return out_({ result: 'success', info: anterior ? 'reenvio' : 'criado' });
  } catch (err) {
    console.error(err);
    try { logErro_('excecao: ' + err); } catch (_) {}
    return out_({ result: 'error', error: 'internal' });
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

function out_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// Registra só o MOTIVO (nunca dados pessoais) para facilitar o diagnóstico.
function logErro_(motivo) {
  try {                                   // o log nunca pode derrubar o fluxo principal
    const ss = planilha_();
    const aba = ss.getSheetByName('Erros') || ss.insertSheet('Erros');
    aba.appendRow([new Date(), String(motivo).slice(0, 200)]);
  } catch (e) { console.error('logErro_ falhou', e); }
}

// Rode UMA VEZ no editor (▶ testarGravacao): autoriza o script e grava/remove uma linha de teste.
function testarGravacao() {
  const r = doPost({ parameter: { nome: 'Teste Diagnostico', email: 'teste+' + Date.now() + '@exemplo.com',
    whatsapp: '48999998888', perfil: '', trilhas: CFG.TRILHAS[0], motivacao: 'Linha de teste do diagnostico do script.',
    disponibilidade: CFG.DISPONIBILIDADES[0], consentimento: 'sim', hp: '' } });
  console.log(r.getContent());
}
