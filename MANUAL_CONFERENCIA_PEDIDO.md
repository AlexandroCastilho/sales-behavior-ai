# Manual de Uso - Conferencia de Pedido

Este manual mostra como usar o sistema web para validar pedidos com regras de negocio e IA.

## 1. Pre-requisitos

- Node.js 20+
- Banco PostgreSQL acessivel em DATABASE_URL
- Dependencias instaladas com npm install

## 2. Configuracao de ambiente

No arquivo .env, configure pelo menos:

```bash
DATABASE_URL="postgresql://..."
GEMINI_API_KEY="..."
```

Para envio real de codigo por email (opcional em dev):

```bash
RESEND_API_KEY="..."
EMAIL_FROM="no-reply@suaempresa.com"
```

## 3. Iniciar o sistema web

```bash
npm run dev
```

Abra o navegador em http://localhost:3000.

## 4. Acesso padrao (login/cadastro/esqueci senha)

1. Abra http://localhost:3000/login.
2. Se for primeiro acesso, use Cadastrar com nome, email e senha.
3. Para entrar, use Login com email e senha.
4. Se esquecer a senha:
   - abra Esqueci senha
   - clique em Enviar codigo
   - informe o codigo de 6 digitos e a nova senha
5. Apos autenticar, o sistema abre a ferramenta de conferencia.

Observacao sobre envio de codigo:

- Producao: codigo chega no email (com RESEND_API_KEY e EMAIL_FROM).
- Desenvolvimento: codigo pode ser exibido como dica no frontend.

## 5. Conferencia de pedido (fluxo principal)

1. (Opcional) Clique em Rodar seed demo para gerar dados base.
2. Informe Cliente (id ou codigo), por exemplo client-demo.
3. Informe Nome do arquivo.
4. Escolha uma das entradas:
   - parsedItems em JSON (mais rapido para teste).
   - Upload de PDF (opcional), para extracao automatica.
5. Marque/desmarque Persistir resultado no banco.
6. Clique em Analisar pedido.
7. Leia o Resultado da analise:
   - risco geral
   - parecer textual da IA
   - findings por item

## 6. Regras aplicadas

- NEW_PRODUCT_FOR_CLIENT
- QUANTITY_SPIKE (acima de 2.5x da media historica)
- INSUFFICIENT_HISTORY

## 7. Como a IA Gemini e usada

A IA Gemini participa em dois pontos:

1. Extracao de itens do PDF (quando pdfBase64 e enviado).
2. Geracao de parecer curto final com base nos achados.

Se GEMINI_API_KEY nao estiver configurado, o sistema usa fallback sem IA para manter o fluxo operacional.

## 8. Endpoints de autenticacao

- POST /api/auth/register
   - body: { "name": "Usuario", "email": "usuario@empresa.com", "password": "********" }
- POST /api/auth/login
   - body: { "email": "usuario@empresa.com", "password": "********" }
- POST /api/auth/forgot-password/request
   - body: { "email": "usuario@empresa.com" }
- POST /api/auth/forgot-password/reset
   - body: { "email": "usuario@empresa.com", "code": "123456", "newPassword": "********" }
- GET /api/auth/me
- POST /api/auth/logout

## 9. Solucao de problemas

- 401 Nao autenticado: faca login antes de chamar /api/analysis.
- 503 em auth/seed: confira DATABASE_URL e conectividade do banco.
- Sem email em dev: use o codigo de teste retornado no frontend.
