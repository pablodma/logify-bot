# RAG System - Hoggitworld Wiki

Sistema de Retrieval-Augmented Generation (RAG) para documentación de DCS World.

## Arquitectura

```
Usuario Discord → Bot → n8n webhook → Edge Function (wiki-search) → Supabase pgvector
                                              ↓
                                    Contexto relevante
                                              ↓
                                    n8n AI Agent → Respuesta
```

## Componentes

1. **Indexador** (`src/rag/`) - Scraper y procesador de wiki
2. **Edge Function** (`wiki-search`) - API de búsqueda semántica
3. **Supabase pgvector** - Base de datos vectorial

## Setup

### 1. Variables de entorno (logify-bot)

Agregar a `.env`:

```env
OPENAI_API_KEY=sk-...
```

### 2. Configurar Edge Function Secret

En el dashboard de Supabase:

1. Ir a **Edge Functions** → **wiki-search** → **Secrets**
2. Agregar: `OPENAI_API_KEY` con tu API key de OpenAI

O via CLI:
```bash
supabase secrets set OPENAI_API_KEY=sk-...
```

### 3. Indexar el contenido

```bash
cd logify-bot
npm run index-wiki
```

Esto scrapea la wiki del F/A-18C y genera embeddings (~$0.02 USD).

### 4. Configurar n8n AI Agent

#### Paso 1: Crear el Workflow

1. En n8n, crea un nuevo workflow
2. Agrega los siguientes nodos:

```
[Webhook] → [AI Agent] → [Respond to Webhook]
```

#### Paso 2: Configurar el Webhook (Trigger)

- **HTTP Method:** POST
- **Path:** `discord-agent` (o el que prefieras)
- **Response Mode:** `Last Node`

Este es el webhook que el bot de Discord llama.

#### Paso 3: Configurar el AI Agent

1. **Model:** OpenAI GPT-4 (o GPT-3.5-turbo)
2. **System Prompt:**

```
Eres un asistente experto en DCS World, especializado en los sistemas de aeronaves de combate.

INSTRUCCIONES:
- Cuando el usuario pregunte sobre sistemas, procedimientos o características de aeronaves, USA LA HERRAMIENTA wiki_search para obtener información precisa.
- Responde SIEMPRE en español.
- Sé conciso pero completo.
- Si la wiki no tiene información, indícalo claramente.
- Cita la fuente cuando uses información de la wiki.

AERONAVES DISPONIBLES:
- F/A-18C Hornet
- (más próximamente)
```

3. **Input:** `{{ $json.message }}`

#### Paso 4: Agregar la Herramienta wiki_search

En el AI Agent, agrega una **Tool** de tipo **HTTP Request**:

**Configuración de la Tool:**

| Campo | Valor |
|-------|-------|
| **Name** | `wiki_search` |
| **Description** | `Busca información en la documentación de DCS World. Usa esta herramienta cuando el usuario pregunte sobre sistemas de aviones, procedimientos, armas, o cualquier tema técnico de DCS.` |
| **Method** | POST |
| **URL** | `https://sjajpvjypxkiarsurtqz.supabase.co/functions/v1/wiki-search` |
| **Headers** | `Content-Type: application/json` |

**Body (JSON):**
```json
{
  "query": "{{ query }}",
  "aircraft": "F/A-18C",
  "limit": 5,
  "threshold": 0.4
}
```

**Parámetros de la Tool:**

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `query` | string | La pregunta o tema a buscar en la documentación |

#### Paso 5: Configurar la Respuesta

El nodo **Respond to Webhook** debe devolver:

```json
{
  "response": "{{ $json.output }}"
}
```

#### Diagrama del Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│                         n8n Workflow                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────┐    ┌───────────────────────┐    ┌──────────────┐ │
│  │ Webhook  │───▶│      AI Agent         │───▶│  Respond to  │ │
│  │ (POST)   │    │                       │    │   Webhook    │ │
│  └──────────┘    │  ┌─────────────────┐  │    └──────────────┘ │
│                  │  │ Tool:           │  │                     │
│                  │  │ wiki_search     │──┼──▶ Supabase Edge   │
│                  │  │                 │  │    Function         │
│                  │  └─────────────────┘  │                     │
│                  └───────────────────────┘                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### Ejemplo de Flujo

1. Usuario en Discord: `@bot ¿Cómo lanzo un JDAM en el F-18?`
2. Bot envía a n8n webhook:
   ```json
   {
     "message": "¿Cómo lanzo un JDAM en el F-18?",
     "userId": "123456789",
     "userName": "Piloto"
   }
   ```
3. AI Agent decide usar `wiki_search` con query `"JDAM F-18 lanzamiento"`
4. Edge Function devuelve contexto relevante
5. AI Agent genera respuesta usando el contexto
6. Bot responde al usuario en Discord

### Respuesta de la API

```json
{
  "query": "como lanzo un JDAM",
  "results": [
    {
      "content": "[F/A-18C] GPS-Guided Bombs...",
      "section": "GPS-Guided Bombs",
      "similarity": 0.85,
      "documentTitle": "F/A-18C",
      "documentUrl": "https://wiki.hoggitworld.com/view/F/A-18C",
      "aircraft": "F/A-18C"
    }
  ],
  "context": "[1] F/A-18C - GPS-Guided Bombs (relevance: 85%)\n...",
  "resultCount": 5,
  "aircraft": "F/A-18C"
}
```

El campo `context` está pre-formateado para pasar directamente al LLM.

## Comandos disponibles

```bash
# Indexar F/A-18C (default)
npm run index-wiki

# Indexar otro avión
npm run index-wiki F-16C

# Ver aviones disponibles
npm run index-wiki --list

# Indexar todos
npm run index-wiki --all
```

## Aviones soportados

- F/A-18C
- F-16C
- A-10C
- F-14
- AH-64D
- AV-8B

## Costos estimados

- **Indexación inicial:** ~$0.02 USD por avión
- **Consultas:** ~$0.0001 USD por query
- **Supabase:** Incluido en tier gratuito

## Troubleshooting

### "OPENAI_API_KEY is not configured"
Asegúrate de agregar el secret en Supabase Edge Functions.

### "Database query failed"
Verifica que las tablas `wiki_documents` y `wiki_chunks` existan.

### No results returned
1. Verifica que el contenido esté indexado: `SELECT COUNT(*) FROM wiki_chunks;`
2. Reduce el threshold: `"threshold": 0.3`
