#!/usr/bin/env ts-node
/**
 * CLI script to index Hoggitworld Wiki pages
 * 
 * Usage:
 *   npm run index-wiki           # Index F/A-18C (default)
 *   npm run index-wiki F-16C     # Index specific aircraft
 *   npm run index-wiki --all     # Index all known aircraft
 */

import { runIndexer, indexAllAircraft, HOGGITWORLD_AIRCRAFT_URLS } from './rag';
import { config } from './config';

async function main() {
  // Validate OpenAI key
  if (!config.openai?.apiKey) {
    console.error('❌ Error: OPENAI_API_KEY environment variable is not set');
    console.log('\nPlease add OPENAI_API_KEY to your .env file:');
    console.log('  OPENAI_API_KEY=sk-...');
    process.exit(1);
  }

  // Validate Supabase config
  if (!config.supabase.url || !config.supabase.serviceRoleKey) {
    console.error('❌ Error: Supabase configuration is missing');
    process.exit(1);
  }

  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Wiki Indexer - Index Hoggitworld Wiki pages for RAG

Usage:
  npm run index-wiki              Index F/A-18C (default)
  npm run index-wiki <aircraft>   Index specific aircraft
  npm run index-wiki --all        Index all known aircraft
  npm run index-wiki --list       List available aircraft

Available aircraft:
  ${Object.keys(HOGGITWORLD_AIRCRAFT_URLS).join(', ')}
`);
    process.exit(0);
  }

  if (args.includes('--list')) {
    console.log('Available aircraft:');
    for (const [aircraft, url] of Object.entries(HOGGITWORLD_AIRCRAFT_URLS)) {
      console.log(`  ${aircraft}: ${url}`);
    }
    process.exit(0);
  }

  if (args.includes('--all')) {
    console.log('🚀 Indexing all known aircraft...\n');
    const results = await indexAllAircraft();
    
    console.log('\n📊 Summary:');
    let totalChunks = 0;
    let totalCost = 0;
    
    for (const [aircraft, result] of results) {
      console.log(`  ${aircraft}: ${result.chunksIndexed} chunks`);
      totalChunks += result.chunksIndexed;
      totalCost += result.estimatedCost;
    }
    
    console.log(`\n  Total: ${totalChunks} chunks, ~$${totalCost.toFixed(4)}`);
    process.exit(0);
  }

  // Index specific aircraft or default to F/A-18C
  const aircraft = args[0] || 'F/A-18C';
  await runIndexer(aircraft);
}

main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
