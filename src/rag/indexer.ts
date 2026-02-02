import { getSupabase } from '../supabase';
import { scrapeHoggitworld, WikiDocument, HOGGITWORLD_AIRCRAFT_URLS } from './scraper';
import { chunkDocument, getChunkStats, TextChunk, estimateTokens } from './chunker';
import { generateEmbeddings, estimateEmbeddingCost } from './embeddings';

export interface IndexResult {
  documentId: string;
  chunksIndexed: number;
  estimatedCost: number;
  sections: string[];
}

/**
 * Index a wiki document into Supabase
 */
export async function indexWikiDocument(document: WikiDocument): Promise<IndexResult> {
  const supabase = getSupabase();
  
  console.log(`\n🔄 Indexing: ${document.title} (${document.aircraft})`);

  // 1. Check if document already exists
  const { data: existingDoc } = await supabase
    .from('wiki_documents')
    .select('id')
    .eq('url', document.url)
    .single();

  let documentId: string;

  if (existingDoc) {
    console.log(`📝 Document exists, updating...`);
    documentId = existingDoc.id;

    // Delete existing chunks
    await supabase
      .from('wiki_chunks')
      .delete()
      .eq('document_id', documentId);

    // Update document
    await supabase
      .from('wiki_documents')
      .update({
        title: document.title,
        aircraft: document.aircraft,
        last_scraped: new Date().toISOString(),
      })
      .eq('id', documentId);
  } else {
    console.log(`📝 Creating new document...`);
    
    const { data: newDoc, error } = await supabase
      .from('wiki_documents')
      .insert({
        source: 'hoggitworld',
        url: document.url,
        title: document.title,
        aircraft: document.aircraft,
        last_scraped: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (error || !newDoc) {
      throw new Error(`Failed to create document: ${error?.message}`);
    }

    documentId = newDoc.id;
  }

  // 2. Chunk the document
  const chunks = await chunkDocument(document);
  const stats = getChunkStats(chunks);
  
  console.log(`📊 Stats: ${stats.totalChunks} chunks, ~${stats.estimatedTokens} tokens`);
  console.log(`💰 Estimated embedding cost: $${estimateEmbeddingCost(stats.estimatedTokens).toFixed(4)}`);

  if (chunks.length === 0) {
    console.log(`⚠️ No chunks created for ${document.title}`);
    return {
      documentId,
      chunksIndexed: 0,
      estimatedCost: 0,
      sections: [],
    };
  }

  // 3. Generate embeddings
  console.log(`🧠 Generating embeddings...`);
  const texts = chunks.map(c => c.content);
  const embeddings = await generateEmbeddings(texts, (current, total) => {
    process.stdout.write(`\r   Progress: ${current}/${total} chunks`);
  });
  console.log(''); // New line after progress

  // 4. Insert chunks with embeddings
  console.log(`💾 Saving to database...`);
  const chunkRecords = chunks.map((chunk, index) => ({
    document_id: documentId,
    content: chunk.content,
    section: chunk.section,
    chunk_index: chunk.chunkIndex,
    embedding: JSON.stringify(embeddings[index]),
    metadata: chunk.metadata,
  }));

  // Insert in batches of 100
  const batchSize = 100;
  for (let i = 0; i < chunkRecords.length; i += batchSize) {
    const batch = chunkRecords.slice(i, i + batchSize);
    const { error } = await supabase
      .from('wiki_chunks')
      .insert(batch);

    if (error) {
      throw new Error(`Failed to insert chunks: ${error.message}`);
    }
  }

  console.log(`✅ Indexed ${chunks.length} chunks for "${document.title}"`);

  return {
    documentId,
    chunksIndexed: chunks.length,
    estimatedCost: estimateEmbeddingCost(stats.estimatedTokens),
    sections: stats.sections,
  };
}

/**
 * Index a wiki page by URL
 */
export async function indexWikiUrl(url: string, aircraft: string): Promise<IndexResult> {
  const document = await scrapeHoggitworld(url, aircraft);
  return indexWikiDocument(document);
}

/**
 * Index all known aircraft
 */
export async function indexAllAircraft(): Promise<Map<string, IndexResult>> {
  const results = new Map<string, IndexResult>();

  for (const [aircraft, url] of Object.entries(HOGGITWORLD_AIRCRAFT_URLS)) {
    try {
      const result = await indexWikiUrl(url, aircraft);
      results.set(aircraft, result);
    } catch (error) {
      console.error(`❌ Failed to index ${aircraft}:`, error);
    }
  }

  return results;
}

/**
 * Re-index a specific aircraft
 */
export async function reindexAircraft(aircraft: string): Promise<IndexResult | null> {
  const url = HOGGITWORLD_AIRCRAFT_URLS[aircraft];
  
  if (!url) {
    console.error(`❌ Unknown aircraft: ${aircraft}`);
    console.log(`Available aircraft: ${Object.keys(HOGGITWORLD_AIRCRAFT_URLS).join(', ')}`);
    return null;
  }

  return indexWikiUrl(url, aircraft);
}

/**
 * CLI entry point for indexing
 */
export async function runIndexer(aircraft?: string): Promise<void> {
  console.log('🚀 Starting Wiki Indexer\n');

  if (aircraft) {
    const result = await reindexAircraft(aircraft);
    if (result) {
      console.log(`\n✅ Done! Indexed ${result.chunksIndexed} chunks`);
      console.log(`   Sections: ${result.sections.join(', ')}`);
      console.log(`   Cost: $${result.estimatedCost.toFixed(4)}`);
    }
  } else {
    console.log('Indexing F/A-18C only (default)...\n');
    const result = await reindexAircraft('F/A-18C');
    if (result) {
      console.log(`\n✅ Done! Indexed ${result.chunksIndexed} chunks`);
      console.log(`   Sections: ${result.sections.join(', ')}`);
      console.log(`   Cost: $${result.estimatedCost.toFixed(4)}`);
    }
  }
}
