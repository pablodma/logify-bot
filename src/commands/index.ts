import { Collection, SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';

// Import commands
import * as usuario from './usuario';
import * as miembros from './miembros';

export interface Command {
  data: SlashCommandBuilder;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}

export const commands = new Collection<string, Command>();

// Register commands
commands.set(usuario.data.name, usuario as Command);
commands.set(miembros.data.name, miembros as Command);
