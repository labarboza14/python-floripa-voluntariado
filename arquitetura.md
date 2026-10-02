# Arquitetura e segurança

## Fluxo de envio (com confirmação real)
1. `script.js` valida o formulário e gera um `rid` aleatório (uso único).
2. **GET** `…/exec?rid=<id>` (lido por CORS): confirma que o Apps Script está público. Se falhar, **nada é enviado** e o formulário avisa (nunca finge sucesso).
3. **POST** `no-cors` com os dados + `rid` (não depende de ler a resposta).
4. O servidor valida de novo, grava na aba `Inscricoes` e registra o desfecho no cache sob o `rid`.
5. O navegador consulta **GET** `?rid=<id>` a cada 1 s (até 12×): `gravado` → sucesso; `erro:<campo>` → mostra o motivo; sem resposta → erro com os dados preservados. Reenviar usa o mesmo `rid`, então **não duplica**.

## Implantação do Apps Script (obrigatório)
`Implantar → Gerenciar implantações → ✏️`: **Executar como: Eu** | **Quem pode acessar: Qualquer pessoa** | **Versão: Nova versão**.
Teste em **janela anônima**: a URL `/exec` deve mostrar `{"result":"ok","versao":"2026-10-01.6","aba_ok":true}`. Tela de login = acesso errado (nada grava). Editar a implantação existente mantém a URL; "Nova implantação" cria URL nova (atualize `SCRIPT_URL` em `script.js`).

## Defesas
| Risco | Proteção |
|---|---|
| Injeção de fórmula | Colunas B:J em formato texto (`@`) |
| Spam/bots | Campo-armadilha `hp_contato` (recusado e registrado), tempo mínimo de 3 s, limite global por minuto, validação no servidor |
| Dados inválidos/enormes | Limites e listas permitidas no servidor |
| Duplicidade | `rid` idempotente; e-mail repetido vira linha marcada "Reenvio" (nunca descarta nem sobrescreve) |
| XSS / terceiros | CSP por `<meta>`: sem inline, `connect-src` só Google, sem fontes/CDN externos |
| PII em URL/logs | Dados só no corpo do POST; a aba `Erros` guarda apenas motivos |
| Exposição pública | `GET` expõe só versão, `aba_ok` e estado de um `rid` aleatório; sem contagem nem dados |
| LGPD | Consentimento explícito, `privacidade.html`, sem cookies |

## Limites conhecidos
GitHub Pages não define cabeçalhos HTTP (HSTS, frame-ancestors). O limite por minuto é global. A planilha contém dados pessoais: mantenha o acesso restrito aos organizadores.
