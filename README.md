# Sales Behavior AI

Sistema web para analisar pedidos de venda em PDF e comparar com historico de compras do cliente para detectar comportamentos fora do padrao.

## Objetivo

Detectar automaticamente:

- pedidos inconsistentes
- produtos nunca comprados
- quantidades muito acima da media
- cenarios com historico insuficiente

Gerar um parecer com classificacao de risco:

- LOW
- MEDIUM
- HIGH
- INCONCLUSIVE

## Stack

- Next.js (App Router)
- TailwindCSS
- Prisma + PostgreSQL
- Google Gemini API

## Autenticacao

Fluxo padrao web com tela dedicada em /login:

- cadastrar
- login
- esqueci senha (codigo de 6 digitos por email)

Endpoints principais:

- POST /api/auth/register
- POST /api/auth/login
- POST /api/auth/forgot-password/request
- POST /api/auth/forgot-password/reset

Endpoints auxiliares de sessao:

- GET /api/auth/me
- POST /api/auth/logout

O endpoint de analise exige usuario autenticado.

## Arquitetura

- services: logica de negocio
- lib: integracoes externas
- components: UI
- app: paginas e API routes
- types: tipagens de dominio

## Fluxo de analise

1. Upload de PDF
2. Extracao de itens
3. Match de produtos
4. Consulta de historico
5. Aplicacao de regras
6. Geracao de parecer por IA
7. Persistencia do resultado

## Regras de negocio iniciais

- Produto nunca comprado pelo cliente
- Quantidade maior que 2.5x da media historica
- Historico insuficiente

## Endpoint principal

POST /api/analysis

Payload de exemplo:

```json
{
	"clientId": "client-demo",
	"fileName": "pedido-123.pdf",
	"persistResult": true,
	"parsedItems": [
		{
			"rawDescription": "Cafe 500g",
			"quantity": 28,
			"confidence": 0.95
		}
	]
}
```

Campos opcionais no endpoint:

- userId: vincula a analise ao usuario
- persistResult: permite desligar gravacao no banco para testes rapidos
- clientId: aceita id do cliente no banco ou codigo (ex.: client-demo)

## Endpoint de seed

POST /api/seed

Cria cliente/produtos de exemplo e historico de vendas para validar a analise localmente.

Observacao: este endpoint depende de DATABASE_URL valido.

## Configuracao de ambiente

Crie um arquivo .env com:

```bash
DATABASE_URL="postgresql://..."
GEMINI_API_KEY="..."
SMTP_HOST="smtps.uhserver.com"
SMTP_PORT="465"
SMTP_SECURE="true"
SMTP_USER="vendas1@amafil.com.br"
SMTP_PASS="..."
EMAIL_FROM="Amafil <vendas1@amafil.com.br>"
```

Sem configuracao SMTP completa, o envio de codigo funciona em modo desenvolvimento com codigo de teste retornado no frontend.

## Desenvolvimento

```bash
npm install
npm run dev
```

Abra a pagina inicial para testar o fluxo completo:

- entrar pela tela /login
- rodar seed demo
- enviar parsedItems em JSON
- enviar PDF opcional

## Gemini no projeto

Sim, o projeto usa Gemini:

- extracao de itens do PDF
- geracao de parecer final da analise

Se GEMINI_API_KEY nao estiver definido, o sistema usa fallback sem IA.

## Manual

Guia completo de uso da conferencia de pedido em [MANUAL_CONFERENCIA_PEDIDO.md](MANUAL_CONFERENCIA_PEDIDO.md).

## Roadmap

- analise por representante
- analise por regiao
- score de confiabilidade
- alertas automaticos
- integracao ERP
