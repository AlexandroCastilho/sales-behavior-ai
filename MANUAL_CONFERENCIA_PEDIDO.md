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
SMTP_HOST="smtps.uhserver.com"
SMTP_PORT="465"
SMTP_SECURE="true"
SMTP_USER="vendas1@amafil.com.br"
SMTP_PASS="..."
EMAIL_FROM="Amafil <vendas1@amafil.com.br>"
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

- Producao: codigo chega no email (com SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS e EMAIL_FROM).
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

## 8.1 Carga de dados reais de historico (base para analise)

Use este endpoint para inserir/atualizar clientes, produtos e historico de compras reais.

- POST /api/seed/history
   - body exemplo:

```json
{
   "client": {
      "code": "cliente-real-001",
      "name": "Mercado Central Matriz",
      "region": "SP"
   },
   "products": [
      {
         "sku": "CAFE-500",
         "name": "Cafe Torrado 500g",
         "aliases": ["cafe 500", "cafe tradicional 500g"]
      },
      {
         "sku": "ACUCAR-1K",
         "name": "Acucar Cristal 1kg",
         "aliases": ["acucar 1kg", "acucar cristal 1kg"]
      }
   ],
   "purchases": [
      { "sku": "CAFE-500", "quantity": 22, "soldAt": "2026-01-05" },
      { "sku": "CAFE-500", "quantity": 24, "soldAt": "2026-02-09" },
      { "sku": "ACUCAR-1K", "quantity": 10, "soldAt": "2026-01-28" }
   ],
   "replaceHistory": true
}
```

Observacoes:

- `replaceHistory=true` substitui historico antigo daquele cliente+produtos informados.
- A analise cruza o pedido com esse historico para calcular media, picos e risco.
- O parecer da IA recebe o resultado desse cruzamento (findings + contexto historico).

### Carga via CSV

Tambem e possivel importar via CSV no endpoint:

- POST /api/seed/history/csv
   - form-data:
      - `csvFile`: arquivo .csv
      - `replaceHistory`: `true` ou `false` (opcional, padrao `true`)

Cabecalho esperado no CSV:

```csv
clientCode,clientName,region,sku,productName,aliases,quantity,soldAt
```

Exemplo:

```csv
clientCode,clientName,region,sku,productName,aliases,quantity,soldAt
cliente-real-001,Mercado Central Matriz,SP,CAFE-500,Cafe Torrado 500g,"cafe 500|cafe tradicional 500g",22,2026-01-05
cliente-real-001,Mercado Central Matriz,SP,CAFE-500,Cafe Torrado 500g,"cafe 500|cafe tradicional 500g",24,2026-02-09
cliente-real-001,Mercado Central Matriz,SP,ACUCAR-1K,Acucar Cristal 1kg,"acucar 1kg|acucar cristal 1kg",10,2026-01-28
```

Observacoes CSV:

- O arquivo deve conter apenas um cliente por importacao (`clientCode` unico).
- `aliases` e opcional e aceita multiplos valores separados por `|`.
- `quantity` deve ser numero positivo.
- `soldAt` deve ser data valida (`YYYY-MM-DD` recomendado).

Modelo tambem suportado (planilha de parceiros):

- Cabecalhos com campos como `CODIGO PARCEIRO`, `NOME PARCEIRO`, `COD. PRODUTO`, `DESC. PRODUTO`, `Date (dtUltCompra)` e colunas repetidas de `PESO TOTAL FAT`.
- Nesse formato, cada coluna `PESO TOTAL FAT` e tratada como historico de compra por periodo para o produto.
- O sistema aceita multiplos clientes no mesmo arquivo CSV.

## 9. Solucao de problemas

- 401 Nao autenticado: faca login antes de chamar /api/analysis.
- 503 em auth/seed: confira DATABASE_URL e conectividade do banco.
- Sem email em dev: use o codigo de teste retornado no frontend.
