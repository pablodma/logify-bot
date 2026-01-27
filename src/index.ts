import { Client, GatewayIntentBits, Events, Interaction } from 'discord.js';
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
  ],
});

// Ready event
client.once(Events.ClientReady, (readyClient) => {
  console.log(`✅ Bot conectado como ${readyClient.user.tag}`);
  console.log(`📊 Conectado a ${readyClient.guilds.cache.size} servidor(es)`);
  
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

// Error handling
client.on(Events.Error, (error) => {
  console.error('❌ Error del cliente Discord:', error);
});

process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled promise rejection:', error);
});

// Login
client.login(config.discord.token);
