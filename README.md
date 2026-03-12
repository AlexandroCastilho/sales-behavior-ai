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
- Prisma + Supabase PostgreSQL
- Google Gemini API

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
NEXT_PUBLIC_SUPABASE_URL="https://...supabase.co"
SUPABASE_SERVICE_ROLE_KEY="..."
GEMINI_API_KEY="..."
```

## Desenvolvimento

```bash
npm install
npm run dev
```

Abra a pagina inicial para testar o fluxo completo:

- rodar seed demo
- enviar parsedItems em JSON
- enviar PDF opcional

## Roadmap

- analise por representante
- analise por regiao
- score de confiabilidade
- alertas automaticos
- integracao ERP
