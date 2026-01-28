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
  webhook: {
    port: parseInt(process.env.PORT || process.env.WEBHOOK_PORT || '3001', 10),
    secret: process.env.WEBHOOK_SECRET || 'logify-webhook-secret',
  },
};

// Validate required environment variables
export function validateConfig(): void {
  const required = [
    'DISCORD_TOKEN',
    'DISCORD_CLIENT_ID',
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
  ];

  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}
