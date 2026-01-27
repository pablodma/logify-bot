import { REST, Routes } from 'discord.js';
import { config, validateConfig } from './config';
import { commands } from './commands';

async function deployCommands(): Promise<void> {
  validateConfig();

  const rest = new REST().setToken(config.discord.token);

  const commandsData = Array.from(commands.values()).map((cmd) => cmd.data.toJSON());

  console.log(`🔄 Desplegando ${commandsData.length} comandos...`);

  try {
    if (config.discord.guildId) {
      // Deploy to specific guild (faster for development)
      await rest.put(
        Routes.applicationGuildCommands(config.discord.clientId, config.discord.guildId),
        { body: commandsData }
      );
      console.log(`✅ Comandos desplegados en el servidor ${config.discord.guildId}`);
    } else {
      // Deploy globally (takes up to 1 hour to propagate)
      await rest.put(Routes.applicationCommands(config.discord.clientId), {
        body: commandsData,
      });
      console.log('✅ Comandos desplegados globalmente');
    }
  } catch (error) {
    console.error('❌ Error desplegando comandos:', error);
    process.exit(1);
  }
}

deployCommands();
