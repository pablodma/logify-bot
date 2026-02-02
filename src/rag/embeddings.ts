import OpenAI from 'openai';
import { config } from '../config';

let openaiClient: OpenAI | null = null;

/**
 * Get or create OpenAI client
 */
function getOpenAI(): OpenAI {
  if (!openaiClient) {
    if (!config.openai?.apiKey) {
      throw new Error('OPENAI_API_KEY is not configured');
    }
    openaiClient = new OpenAI({
      apiKey: config.openai.apiKey,
    });
  }
  return openaiClient;
}

/**
 * Embedding model configuration
 */
export const EMBEDDING_MODEL = 'text-embedding-3-small';
export const EMBEDDING_DIMENSIONS = 1536;

/**
 * Generate embedding for a single text
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const openai = getOpenAI();
  
  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text,
    dimensions: EMBEDDING_DIMENSIONS,
  });

  return response.data[0].embedding;
}

/**
 * Generate embeddings for multiple texts (batched)
 */
export async function generateEmbeddings(
  texts: string[],
  onProgress?: (current: number, total: number) => void
): Promise<number[][]> {
  const openai = getOpenAI();
  const embeddings: number[][] = [];
  
  // OpenAI allows up to 2048 inputs per request, but we batch in smaller chunks
  // to avoid timeouts and provide progress updates
  const batchSize = 100;
  
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    
    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: batch,
      dimensions: EMBEDDING_DIMENSIONS,
    });

    for (const item of response.data) {
      embeddings.push(item.embedding);
    }

    if (onProgress) {
      onProgress(Math.min(i + batchSize, texts.length), texts.length);
    }
  }

  return embeddings;
}

/**
 * Estimate cost for embedding generation
 * text-embedding-3-small: $0.00002 per 1K tokens
 */
export function estimateEmbeddingCost(tokenCount: number): number {
  const costPer1kTokens = 0.00002;
  return (tokenCount / 1000) * costPer1kTokens;
}
