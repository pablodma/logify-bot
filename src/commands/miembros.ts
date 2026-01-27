import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} from 'discord.js';
import { getAllProfiles } from '../supabase';
import { config } from '../config';

export const data = new SlashCommandBuilder()
  .setName('miembros')
  .setDescription('Lista todos los miembros registrados en Logify')
  .addBooleanOption((option) =>
    option
      .setName('activos')
      .setDescription('Mostrar solo usuarios activos')
      .setRequired(false)
  );

const ITEMS_PER_PAGE = 10;

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply();

  const showActiveOnly = interaction.options.getBoolean('activos') ?? false;
  
  let profiles = await getAllProfiles();
  
  if (showActiveOnly) {
    profiles = profiles.filter((p) => p.is_active);
  }

  if (profiles.length === 0) {
    await interaction.editReply({
      content: '📭 No hay miembros registrados.',
    });
    return;
  }

  const totalPages = Math.ceil(profiles.length / ITEMS_PER_PAGE);
  let currentPage = 0;

  const generateEmbed = (page: number): EmbedBuilder => {
    const start = page * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    const pageProfiles = profiles.slice(start, end);

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`👥 Miembros de Logify ${showActiveOnly ? '(Activos)' : ''}`)
      .setDescription(
        pageProfiles
          .map((p, i) => {
            const status = p.is_active ? '✅' : '❌';
            const discord = p.discord_id ? `<@${p.discord_id}>` : 'No vinculado';
            return `**${start + i + 1}.** ${status} ${p.full_name || p.email}\n└ ${discord}`;
          })
          .join('\n\n')
      )
      .setFooter({
        text: `Página ${page + 1}/${totalPages} • Total: ${profiles.length} miembros`,
      })
      .setTimestamp();

    return embed;
  };

  const generateButtons = (page: number): ActionRowBuilder<ButtonBuilder> => {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('first')
        .setLabel('⏮️')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page === 0),
      new ButtonBuilder()
        .setCustomId('prev')
        .setLabel('◀️')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page === 0),
      new ButtonBuilder()
        .setCustomId('next')
        .setLabel('▶️')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page === totalPages - 1),
      new ButtonBuilder()
        .setCustomId('last')
        .setLabel('⏭️')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page === totalPages - 1),
      new ButtonBuilder()
        .setCustomId('web')
        .setLabel('Ver en Web')
        .setStyle(ButtonStyle.Link)
        .setURL(`${config.app.url}/roster`)
    );
  };

  const message = await interaction.editReply({
    embeds: [generateEmbed(currentPage)],
    components: totalPages > 1 ? [generateButtons(currentPage)] : [],
  });

  if (totalPages <= 1) return;

  const collector = message.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 300000, // 5 minutes
  });

  collector.on('collect', async (buttonInteraction) => {
    if (buttonInteraction.user.id !== interaction.user.id) {
      await buttonInteraction.reply({
        content: '❌ Solo quien ejecutó el comando puede navegar.',
        ephemeral: true,
      });
      return;
    }

    switch (buttonInteraction.customId) {
      case 'first':
        currentPage = 0;
        break;
      case 'prev':
        currentPage = Math.max(0, currentPage - 1);
        break;
      case 'next':
        currentPage = Math.min(totalPages - 1, currentPage + 1);
        break;
      case 'last':
        currentPage = totalPages - 1;
        break;
    }

    await buttonInteraction.update({
      embeds: [generateEmbed(currentPage)],
      components: [generateButtons(currentPage)],
    });
  });

  collector.on('end', async () => {
    await interaction.editReply({
      components: [],
    });
  });
}
