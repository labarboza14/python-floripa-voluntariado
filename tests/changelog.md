# Changelog
Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/). A versão do servidor consta em `Code.gs → CFG.VERSAO`.

## [1.0.0] — 2026-10-02
Primeira versão de produção.
### Adicionado
- Confirmação real de gravação por `rid` (`GET ?rid` com polling); idempotência no reenvio.
- Validação dupla (cliente e servidor), máscara de WhatsApp, contador, rascunho em `sessionStorage`.
- Anti-bot: honeypot `hp_contato`, tempo mínimo, limite de 30 envios/min.
- Aba `Erros` (apenas motivos, sem dados pessoais) e colunas I (consentimento) e J (observação).
- Política de Privacidade (LGPD), consentimento dedicado, CSP restritiva, acessibilidade e layout responsivo.
- Botão "Voltar para a Python Floripa" na tela de confirmação.
- Suíte `tests/run.js` (48 testes), `package.json`, documentação técnica.
### Alterado
- Reenvio com o mesmo e-mail gera nova linha marcada "Reenvio" (antes: ignorado).
- Colunas B–J gravadas como texto (neutraliza injeção de fórmulas).
### Removido
- Envio por GET/`Image`, páginas de diagnóstico (`diagnostico.*`), Google Fonts, `MailApp`, contagem de linhas no `GET` público.
### Segurança
- `GET` público expõe apenas `versao`, `aba_ok` e o estado de um `rid` aleatório.

## [0.x] — 2026-09-30
Protótipos: envio por GET sem `doGet` no servidor; POST `no-cors` que exibia sucesso sem confirmação; implantações do Apps Script sem acesso público.
