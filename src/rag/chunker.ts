import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { WikiDocument, WikiSection } from './scraper';

export interface TextChunk {
  content: string;
  section: string;
  chunkIndex: number;
  metadata: {
    documentTitle: string;
    aircraft: string;
    sectionLevel: number;
    charCount: number;
  };
}

/**
 * Configuration for text chunking
 */
export interface ChunkerConfig {
  chunkSize: number;
  chunkOverlap: number;
  separators?: string[];
}

const DEFAULT_CONFIG: ChunkerConfig = {
  chunkSize: 1000, // ~250 tokens (4 chars per token approx)
  chunkOverlap: 200, // 20% overlap for context continuity
  separators: ['\n\n', '\n', '. ', ', ', ' ', ''],
};

/**
 * Chunks a wiki document into smaller pieces for embedding
 */
export async function chunkDocument(
  document: WikiDocument,
  config: ChunkerConfig = DEFAULT_CONFIG
): Promise<TextChunk[]> {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: config.chunkSize,
    chunkOverlap: config.chunkOverlap,
    separators: config.separators,
  });

  const allChunks: TextChunk[] = [];
  let globalChunkIndex = 0;

  for (const section of document.sections) {
    // Skip empty sections
    if (!section.content.trim()) {
      continue;
    }

    // Prepend section context to content for better retrieval
    const contextualContent = `[${document.aircraft}] ${section.title}\n\n${section.content}`;
    
    // Split section content
    const texts = await splitter.splitText(contextualContent);

    for (const text of texts) {
      allChunks.push({
        content: text,
        section: section.title,
        chunkIndex: globalChunkIndex++,
        metadata: {
          documentTitle: document.title,
          aircraft: document.aircraft,
          sectionLevel: section.level,
          charCount: text.length,
        },
      });
    }
  }

  console.log(`📦 Created ${allChunks.length} chunks from "${document.title}"`);
  
  return allChunks;
}

/**
 * Estimates token count (rough approximation)
 */
export function estimateTokens(text: string): number {
  // Rough estimate: 1 token ≈ 4 characters for English text
  return Math.ceil(text.length / 4);
}

/**
 * Gets statistics about the chunks
 */
export function getChunkStats(chunks: TextChunk[]): {
  totalChunks: number;
  totalCharacters: number;
  estimatedTokens: number;
  avgChunkSize: number;
  sections: string[];
} {
  const totalCharacters = chunks.reduce((sum, c) => sum + c.content.length, 0);
  const sections = [...new Set(chunks.map(c => c.section))];
  
  return {
    totalChunks: chunks.length,
    totalCharacters,
    estimatedTokens: estimateTokens(chunks.map(c => c.content).join('')),
    avgChunkSize: Math.round(totalCharacters / chunks.length),
    sections,
  };
}
