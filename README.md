# Previsão do Tempo + SkyBot (Portfolio)

App de previsão do tempo com mapa, gráfico e um chatbot (SkyBot) que reage de forma proativa quando você pesquisa uma cidade.

## O que tem aqui

- Frontend estático (HTML/CSS/JS) consumindo OpenWeather.
- Função serverless em `api/chat.js` (compatível com Vercel) para o SkyBot.
- IA via Hugging Face Router (OpenAI-compatible endpoint) com fallback seguro (sem vazar chave no frontend).

## Rodar localmente

### Pré-requisitos

- Node.js 18+

### Passos

1. Instale as dependências:

```bash
npm install
```

2. Crie um `.env` baseado no `.env.example`:

```bash
copy .env.example .env
```

3. Rode com o emulador da Vercel (recomendado, pois executa `api/chat.js` localmente):

```bash
npx vercel dev
```

Abra o endereço que o comando mostrar.

## Variáveis de ambiente

- `HF_API_KEY` (obrigatória para IA): token do Hugging Face com permissão de Inference Providers.

Observação: o arquivo `.env` é ignorado pelo git.

## Deploy (Vercel)

1. Importe o repositório no Vercel.
2. Configure `HF_API_KEY` em **Project Settings → Environment Variables** (Production e Preview).
3. Faça o redeploy.

## Notas de segurança

- Nunca coloque chaves no frontend.
- Se alguma chave tiver sido exposta, revogue/rotacione e atualize no Vercel.
