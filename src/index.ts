import { Client, GatewayIntentBits, Events, Interaction, Message, TextChannel } from 'discord.js';

// Tipo para la respuesta de n8n
interface N8nResponse {
  response?: string;
  output?: string;
  message?: string;
}
import { config, validateConfig } from './config';
import { commands } from './commands';

// Validate environment variables
validateConfig();

// Create Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent, // Necesario para leer contenido de mensajes
  ],
});

// Ready event
client.once(Events.ClientReady, (readyClient) => {
  console.log(`✅ Bot conectado como ${readyClient.user.tag} (v1.1.0)`);
  console.log(`📊 Conectado a ${readyClient.guilds.cache.size} servidor(es)`);
  console.log(`🔗 n8n webhook: ${config.n8n.enabled ? 'HABILITADO' : 'DESHABILITADO'}`);
  
  // Set bot status
  readyClient.user.setPresence({
    activities: [{ name: 'Logify | /usuario', type: 3 }], // 3 = Watching
    status: 'online',
  });
});

// Interaction handler
client.on(Events.InteractionCreate, async (interaction: Interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = commands.get(interaction.commandName);

  if (!command) {
    console.warn(`⚠️ Comando no encontrado: ${interaction.commandName}`);
    return;
  }

  try {
    console.log(
      `📝 ${interaction.user.tag} ejecutó /${interaction.commandName} en ${interaction.guild?.name || 'DM'}`
    );
    await command.execute(interaction);
  } catch (error) {
    console.error(`❌ Error ejecutando /${interaction.commandName}:`, error);

    const errorMessage = '❌ Ocurrió un error al ejecutar el comando.';

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: errorMessage, ephemeral: true });
    } else {
      await interaction.reply({ content: errorMessage, ephemeral: true });
    }
  }
});

// Message handler para n8n webhook (AI Agent)
client.on(Events.MessageCreate, async (message: Message) => {
  // Ignorar mensajes del propio bot
  if (message.author.bot) return;

  // Solo procesar si n8n está habilitado
  if (!config.n8n.enabled) return;

  // Solo procesar si el bot es mencionado o es un DM
  const isMentioned = message.mentions.has(client.user!.id);
  const isDM = !message.guild;
  
  if (!isMentioned && !isDM) return;

  // Limpiar el mensaje (quitar la mención del bot)
  const cleanMessage = message.content
    .replace(new RegExp(`<@!?${client.user!.id}>`, 'g'), '')
    .trim();

  // Ignorar mensajes vacíos después de quitar la mención
  if (!cleanMessage) return;

  console.log(`💬 Mensaje recibido de ${message.author.tag}: ${cleanMessage.substring(0, 50)}...`);

  try {
    // Indicar que el bot está "escribiendo" (solo en canales que lo soporten)
    if ('sendTyping' in message.channel) {
      await (message.channel as TextChannel).sendTyping();
    }

    // Enviar a n8n webhook
    const response = await fetch(config.n8n.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: 'discord',
        userId: message.author.id,
        userName: message.author.username,
        userTag: message.author.tag,
        message: cleanMessage,
        channelId: message.channel.id,
        messageId: message.id,
        guildId: message.guild?.id || null,
        guildName: message.guild?.name || 'DM',
        timestamp: message.createdTimestamp,
      }),
    });

    if (!response.ok) {
      console.error(`❌ Error de n8n webhook: ${response.status} ${response.statusText}`);
      await message.reply('❌ Error al procesar tu mensaje. Intenta de nuevo más tarde.');
      return;
    }

    // Si n8n devuelve una respuesta, enviarla
    const data = await response.json() as N8nResponse;
    
    if (data.response || data.output || data.message) {
      const aiResponse = data.response || data.output || data.message || '';
      
      // Dividir respuestas largas (Discord tiene límite de 2000 caracteres)
      if (aiResponse.length > 2000) {
        const chunks = aiResponse.match(/.{1,1900}/gs) || [];
        for (const chunk of chunks) {
          await message.reply(chunk);
        }
      } else {
        await message.reply(aiResponse);
      }
      
      console.log(`✅ Respuesta enviada a ${message.author.tag}`);
    }
  } catch (error) {
    console.error('❌ Error enviando a n8n:', error);
    await message.reply('❌ Error de conexión con el agente. Intenta de nuevo más tarde.');
  }
});

// Error handling
client.on(Events.Error, (error) => {
  console.error('❌ Error del cliente Discord:', error);
});

process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled promise rejection:', error);
});

// Login
client.login(config.discord.token);
