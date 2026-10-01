(() => {
  'use strict';

  // ===== Configuração (único ponto a editar) =====
  const CONFIG = {
    SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbxzpGwfcoIQJWoXiqWznISKjfYqIjhq1qp9C_iVHPpteyjmD03PGYJCVfXpr6XSc2i4/exec',
    MIN_SECONDS: 3,        // envio mais rápido que isso é tratado como robô
    TIMEOUT_MS: 15000,
    DRAFT_KEY: 'pf_rascunho_v2'
  };

  const $ = (id) => document.getElementById(id);
  const form = $('volunteerForm'), btn = $('submitBtn'), statusEl = $('form-status');
  const label = btn.querySelector('.btn-label'), spinner = btn.querySelector('.spinner');
  const loadedAt = Date.now();
  let busy = false;

  // ===== Validadores: retornam mensagem de erro ou '' =====
  const clean = (v) => v.trim().replace(/\s+/g, ' ');
  const digits = (v) => v.replace(/\D/g, '');

  function normalizeUrl(v) {
    const t = v.trim();
    if (!t) return '';
    try {
      const u = new URL(/^https?:\/\//i.test(t) ? t : 'https://' + t);
      return (['http:', 'https:'].includes(u.protocol) && u.hostname.includes('.')) ? u.href : null;
    } catch { return null; }
  }

  const rules = {
    nome(v) {
      const t = clean(v);
      if (t.length < 3) return 'Informe seu nome completo.';
      if (t.split(' ').length < 2) return 'Informe nome e sobrenome.';
      if (t.length > 100) return 'Máximo de 100 caracteres.';
      if (!/^[\p{L}\p{M}' .-]+$/u.test(t)) return 'Use apenas letras, espaços, apóstrofo ou hífen.';
      return '';
    },
    email(v) {
      const t = v.trim();
      if (!t) return 'Informe seu e-mail.';
      if (t.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(t)) return 'Informe um e-mail válido (ex.: nome@dominio.com).';
      return '';
    },
    whatsapp(v) {
      const d = digits(v);
      if (!d) return 'Informe seu WhatsApp com DDD.';
      if (d.length < 10 || d.length > 11 || (d.length === 11 && d[2] !== '9')) return 'Use DDD + número, ex.: (48) 99999-9999.';
      return '';
    },
    perfil(v) { return normalizeUrl(v) === null ? 'Informe um link válido (ex.: github.com/usuario).' : ''; },
    motivacao(v) {
      const n = clean(v).length;
      if (n < 20) return `Escreva pelo menos 20 caracteres (faltam ${20 - n}).`;
      return n > 1000 ? 'Máximo de 1000 caracteres.' : '';
    },
    disponibilidade(v) { return v ? '' : 'Escolha sua disponibilidade.'; }
  };

  function setError(id, msg) {
    const input = $(id), err = $(id + '-erro');
    if (err) err.textContent = msg;
    if (input) input.setAttribute('aria-invalid', msg ? 'true' : 'false');
    return !msg;
  }

  const trilhasSel = () => [...form.querySelectorAll('input[name="trilha"]:checked')].map(c => c.value);

  function validateAll() {
    const results = [];
    for (const id of Object.keys(rules)) results.push([id, setError(id, rules[id]($(id).value))]);
    results.push(['trilhas-grupo', setError('trilhas', trilhasSel().length ? '' : 'Escolha pelo menos uma frente.')]);
    results.push(['pacto', setError('pacto', $('pacto').checked ? '' : 'Marque para confirmar o pacto.')]);
    results.push(['consentimento', setError('consentimento', $('consentimento').checked ? '' : 'O consentimento é necessário para enviar.')]);
    const firstBad = results.find(r => !r[1]);
    if (firstBad) {
      const el = $(firstBad[0]);
      (el.matches('fieldset') ? el.querySelector('input') : el).focus();
    }
    return !firstBad;
  }

  // ===== Máscara de telefone, contador e validação ao sair do campo =====
  $('whatsapp').addEventListener('input', (e) => {
    const d = digits(e.target.value).slice(0, 11);
    e.target.value = d.length > 10 ? `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`
      : d.length > 6 ? `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`
      : d.length > 2 ? `(${d.slice(0,2)}) ${d.slice(2)}` : d;
  });
  const counter = $('contador'), mot = $('motivacao');
  const upd = () => { counter.textContent = mot.value.length; };
  mot.addEventListener('input', upd);
  Object.keys(rules).forEach(id => $(id).addEventListener('blur', () => { if ($(id).value) setError(id, rules[id]($(id).value)); }));
  Object.keys(rules).forEach(id => $(id).addEventListener('input', () => { if ($(id).getAttribute('aria-invalid') === 'true') setError(id, rules[id]($(id).value)); }));
  form.addEventListener('change', (e) => {
    if (e.target.name === 'trilha' && trilhasSel().length) setError('trilhas', '');
    if (e.target.id === 'pacto' || e.target.id === 'consentimento') setError(e.target.id, e.target.checked ? '' : 'Campo obrigatório.');
  });

  // ===== Rascunho (somente nesta aba; limpo após enviar) =====
  const draftIds = ['nome', 'email', 'whatsapp', 'perfil', 'motivacao', 'disponibilidade'];
  function saveDraft() {
    try {
      const d = Object.fromEntries(draftIds.map(id => [id, $(id).value]));
      d.trilhas = trilhasSel();
      sessionStorage.setItem(CONFIG.DRAFT_KEY, JSON.stringify(d));
    } catch { /* armazenamento indisponível: segue sem rascunho */ }
  }
  function loadDraft() {
    try {
      const d = JSON.parse(sessionStorage.getItem(CONFIG.DRAFT_KEY) || 'null');
      if (!d) return;
      draftIds.forEach(id => { if (typeof d[id] === 'string') $(id).value = d[id]; });
      form.querySelectorAll('input[name="trilha"]').forEach(c => { c.checked = (d.trilhas || []).includes(c.value); });
      upd();
    } catch { /* ignora rascunho corrompido */ }
  }
  form.addEventListener('input', saveDraft);
  form.addEventListener('change', saveDraft);
  loadDraft();

  // ===== Envio =====
  const setBusy = (on, text) => { busy = on; btn.disabled = on; spinner.hidden = !on; label.textContent = text; };
  const setStatus = (msg, isErr) => { statusEl.textContent = msg; statusEl.classList.toggle('error', !!isErr); };

  function showSuccess() {
    try { sessionStorage.removeItem(CONFIG.DRAFT_KEY); } catch {}
    form.hidden = true;
    const box = $('sucesso'); box.hidden = false; box.focus();
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (busy) return;
    setStatus('');

    if (!validateAll()) { setStatus('Revise os campos destacados antes de enviar.', true); return; }
    if ((Date.now() - loadedAt) / 1000 < CONFIG.MIN_SECONDS) { setStatus('Só um instante… confira os dados e envie novamente.', true); return; }

    const body = new URLSearchParams({
      nome: clean($('nome').value),
      email: $('email').value.trim().toLowerCase(),
      whatsapp: digits($('whatsapp').value),
      perfil: normalizeUrl($('perfil').value) || '',
      trilhas: trilhasSel().join(', '),
      motivacao: clean($('motivacao').value),
      disponibilidade: $('disponibilidade').value,
      consentimento: 'sim',
      hp: $('hp_contato').value          // honeypot: vai ao servidor, que recusa e REGISTRA na aba Erros (sem falso sucesso no cliente)
    });

    setBusy(true, 'Enviando…');
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), CONFIG.TIMEOUT_MS);
    try {
      let resp = null;
      try {
        // 1ª tentativa: leitura real da resposta do Apps Script (CORS).
        const r = await fetch(CONFIG.SCRIPT_URL, { method: 'POST', body, signal: ctrl.signal });
        resp = await r.json();
      } catch (e1) {
        if (ctrl.signal.aborted) throw e1;
        // Não deu para LER a resposta. Antes de dar como enviado, confirma que o serviço está acessível ao público:
        // se o Apps Script exigir login (implantação mal configurada) ou estiver fora do ar, isto falha e o formulário avisa.
        const h = await fetch(CONFIG.SCRIPT_URL + '?ping=' + Date.now(), { signal: ctrl.signal });
        const hj = await h.json();
        if (!hj || !hj.versao) throw new Error('servico_inacessivel');
      }
      if (resp && resp.result === 'error') {
        console.error('Recusado pelo servidor:', resp.error);
        const msg = resp.error === 'rate_limit' ? 'Muitos envios no momento. Tente novamente em 1 minuto.'
          : resp.error === 'internal' || resp.error === 'busy' ? 'Erro temporário no servidor. Tente novamente em instantes.'
          : 'O servidor não aceitou o campo "' + resp.error + '". Revise os dados e tente novamente.';
        setBusy(false, 'Tentar novamente'); setStatus(msg, true);
      } else { showSuccess(); }
    } catch (err) {
      console.error(err);
      setBusy(false, 'Tentar novamente');
      setStatus('Não conseguimos confirmar o envio. Seus dados continuam aqui: tente novamente em instantes ou fale com a organização.', true);
    } finally { clearTimeout(timer); }
  });
})();
