(async () => {
  const out = document.getElementById('log'); const L = [];
  const say = (m) => { L.push(m); out.textContent = L.join('\n'); };
  const get = async (u) => { const r = await fetch(u, { cache: 'no-store' }); const t = await r.text(); try { return JSON.parse(t); } catch { return { _naoJSON: t.slice(0, 120) }; } };
  say('Navegador: ' + navigator.userAgent.slice(0, 90));
  let url;
  try { url = (await (await fetch('script.js?x=' + Date.now(), { cache: 'no-store' })).text()).match(/SCRIPT_URL:\s*'([^']+)'/)[1]; }
  catch (e) { say('✗ 1) Não consegui ler o SCRIPT_URL de script.js: ' + e); return; }
  say('1) URL usada pelo site: ' + url.slice(0, 60) + '…' + url.slice(-12));

  let a;
  try { a = await get(url + '?diag=1&t=' + Date.now()); }
  catch (e) { say('✗ 2) GET bloqueado (' + e.name + '). Causa provável: implantação NÃO está como "Executar como: Eu" + "Qualquer pessoa" (o Google devolve tela de login), ou URL errada.'); return; }
  say('2) GET: ' + JSON.stringify(a));
  if (a._naoJSON) { say('✗ O Google devolveu HTML, não JSON → login exigido ou URL errada.'); return; }
  if (!a.versao) { say('✗ Sem "versao": código ANTIGO publicado (falta "Nova versão" nesta implantação).'); return; }
  if (!a.aba_ok) { say('✗ Código novo, mas não acha a aba "Inscricoes".'); return; }

  const antes = a.linhas;
  const b = new URLSearchParams({ nome: 'Teste Diagnostico Auto', email: 'diag+' + Date.now() + '@exemplo.com', whatsapp: '48999998888', perfil: '',
    trilhas: 'Dados & Métricas', motivacao: 'Linha de teste gerada pela pagina de diagnostico.', disponibilidade: 'Aprox. 2 horas por semana', consentimento: 'sim', hp: '' });
  try { const r = await fetch(url, { method: 'POST', body: b }); say('3) POST (leitura CORS): ' + JSON.stringify(await r.json())); }
  catch (e) { say('3) POST (leitura CORS) falhou: ' + e.name + ' (pode ser só a leitura; o teste 4 diz se gravou)'); }
  await new Promise(r => setTimeout(r, 2500));
  const c = await get(url + '?diag=1&t=' + Date.now());
  say('4) Linhas antes/depois: ' + antes + ' → ' + c.linhas);
  say(c.linhas > antes ? '\n✔ RESULTADO: o site GRAVA na planilha. Se o formulário real não grava, o problema está no formulário/cache (cole aqui o Console F12).'
    : '\n✗ RESULTADO: GET funciona mas o POST não grava. Veja a aba aba "Erros" da planilha e Apps Script → Execuções (doPost) para o motivo.');
})();
