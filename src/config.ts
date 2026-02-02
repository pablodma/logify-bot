import dotenv from 'dotenv';
dotenv.config();

export const config = {
  // Discord
  discord: {
    token: process.env.DISCORD_TOKEN!,
    clientId: process.env.DISCORD_CLIENT_ID!,
    guildId: process.env.DISCORD_GUILD_ID!,
  },
  
  // Supabase
  supabase: {
    url: process.env.SUPABASE_URL!,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  },
  
  // App
  app: {
    url: process.env.APP_URL || 'https://logifyme.vercel.app',
  },

  // n8n Webhook (opcional - para integración con AI Agent)
  n8n: {
    webhookUrl: process.env.N8N_WEBHOOK_URL || '',
    enabled: !!process.env.N8N_WEBHOOK_URL,
  },

  // OpenAI (para RAG embeddings)
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
  },

  // Webhook server for Web -> Discord sync
  // Railway provides PORT env var for HTTP traffic routing
  // SECURITY: No fallback for secret - must be configured in environment
  webhook: {
    port: parseInt(process.env.PORT || process.env.WEBHOOK_PORT || '3001', 10),
    secret: process.env.WEBHOOK_SECRET!, // Required - no fallback
  },
};

// Validate required environment variables
export function validateConfig(): void {
  const required = [
    'DISCORD_TOKEN',
    'DISCORD_CLIENT_ID',
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'WEBHOOK_SECRET', // SECURITY: Webhook secret is now required
  ];

  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.error('🔴 SECURITY ERROR: Missing required environment variables');
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
  
  // SECURITY: Validate webhook secret strength
  const webhookSecret = process.env.WEBHOOK_SECRET!;
  if (webhookSecret.length < 32) {
    console.warn('⚠️ SECURITY WARNING: WEBHOOK_SECRET should be at least 32 characters for security');
  }
}
