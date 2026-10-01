# Arquitetura e segurança

## Fluxo
1. A pessoa preenche o formulário; `script.js` valida (nome, e-mail, WhatsApp, link, trilhas, motivação, disponibilidade, consentimento).
2. O envio é um **POST** (`fetch`, `mode: no-cors`, corpo `application/x-www-form-urlencoded`) para o Web App do Apps Script. Dados pessoais **nunca** vão na URL.
3. `Code.gs` valida tudo de novo, barra robôs e duplicados e grava uma linha na aba `Inscricoes` (colunas A–I).
4. A página lê a resposta JSON do Apps Script e mostra o erro real. Se a leitura (CORS) falhar, reenvia em `no-cors` (seguro: e-mail repetido é ignorado).

## Defesas
| Risco | Proteção |
|---|---|
| Injeção de fórmula na planilha | Colunas B:I gravadas com formato texto (`@`) |
| Spam/bots | Campo-armadilha `website`, tempo mínimo de 3 s, limite global por minuto, validação no servidor |
| Dados inválidos/enormes | Limites e listas permitidas (trilhas, disponibilidade) no servidor |
| Duplicados | E-mail repetido é ignorado |
| XSS / scripts de terceiros | CSP por `<meta>`: sem scripts/estilos inline, `connect-src` só para o Google |
| Vazamento de PII na URL/logs | Sem GET com dados; `doGet` só responde "no ar" |
| LGPD | Consentimento explícito, política em `privacidade.html`, sem cookies/fontes externas |

## Manutenção
- Após editar `Code.gs`: **Nova versão** da implantação (salvar não atualiza o `/exec`).
- Acesso: *Executar como Eu* / *Qualquer pessoa*. Para receber aviso de cada inscrição, use na planilha *Ferramentas → Regras de notificação*. Recusas e duplicados (sem dados pessoais) ficam na aba `Erros`.
- Limitações: o GitHub Pages não define cabeçalhos HTTP (HSTS, frame-ancestors); o limite por minuto é global, não por pessoa.
