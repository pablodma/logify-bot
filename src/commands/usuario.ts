import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
  ComponentType,
} from 'discord.js';
import {
  getProfileByDiscordId,
  getRoles,
  updateProfileRole,
  setProfileActive,
  Profile,
} from '../supabase';
import { config } from '../config';

export const data = new SlashCommandBuilder()
  .setName('usuario')
  .setDescription('Gestiona usuarios de Logify')
  .addSubcommand((subcommand) =>
    subcommand
      .setName('info')
      .setDescription('Ver información de un usuario')
      .addUserOption((option) =>
        option
          .setName('miembro')
          .setDescription('El usuario de Discord')
          .setRequired(true)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('rol')
      .setDescription('Cambiar el rol de un usuario')
      .addUserOption((option) =>
        option
          .setName('miembro')
          .setDescription('El usuario de Discord')
          .setRequired(true)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('activar')
      .setDescription('Activar un usuario')
      .addUserOption((option) =>
        option
          .setName('miembro')
          .setDescription('El usuario de Discord')
          .setRequired(true)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('desactivar')
      .setDescription('Desactivar un usuario')
      .addUserOption((option) =>
        option
          .setName('miembro')
          .setDescription('El usuario de Discord')
          .setRequired(true)
      )
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const subcommand = interaction.options.getSubcommand();
  const targetUser = interaction.options.getUser('miembro', true);

  // Get profile from database
  const profile = await getProfileByDiscordId(targetUser.id);

  if (!profile) {
    await interaction.reply({
      content: `❌ El usuario **${targetUser.username}** no está registrado en Logify.`,
      ephemeral: true,
    });
    return;
  }

  switch (subcommand) {
    case 'info':
      await handleInfo(interaction, profile, targetUser);
      break;
    case 'rol':
      await handleRol(interaction, profile, targetUser);
      break;
    case 'activar':
      await handleActivar(interaction, profile, targetUser);
      break;
    case 'desactivar':
      await handleDesactivar(interaction, profile, targetUser);
      break;
  }
}

async function handleInfo(
  interaction: ChatInputCommandInteraction,
  profile: Profile,
  targetUser: any
): Promise<void> {
  const embed = new EmbedBuilder()
    .setColor(profile.is_active ? 0x00ff00 : 0xff0000)
    .setTitle(`👤 ${profile.full_name || targetUser.username}`)
    .setThumbnail(targetUser.displayAvatarURL())
    .addFields(
      { name: '📧 Email', value: profile.email || 'No disponible', inline: true },
      { name: '🎮 Discord', value: `<@${targetUser.id}>`, inline: true },
      { name: '📊 Estado', value: profile.is_active ? '✅ Activo' : '❌ Inactivo', inline: true },
      {
        name: '📅 Registrado',
        value: new Date(profile.created_at).toLocaleDateString('es-ES'),
        inline: true,
      }
    )
    .setFooter({ text: `ID: ${profile.id}` })
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}

async function handleRol(
  interaction: ChatInputCommandInteraction,
  profile: Profile,
  targetUser: any
): Promise<void> {
  const roles = await getRoles();

  if (roles.length === 0) {
    await interaction.reply({
      content: '❌ No hay roles disponibles en el sistema.',
      ephemeral: true,
    });
    return;
  }

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`role_select_${profile.id}`)
    .setPlaceholder('Selecciona un rol')
    .addOptions(
      roles.map((role) => ({
        label: role.display_name || role.name,
        value: role.id,
        description: `Nivel: ${role.level}`,
        default: role.id === profile.role_id,
      }))
    );

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

  const response = await interaction.reply({
    content: `Selecciona el nuevo rol para **${profile.full_name || targetUser.username}**:`,
    components: [row],
    ephemeral: true,
  });

  // Wait for selection
  try {
    const selectInteraction = await response.awaitMessageComponent({
      componentType: ComponentType.StringSelect,
      time: 60000,
    }) as StringSelectMenuInteraction;

    const selectedRoleId = selectInteraction.values[0];
    const success = await updateProfileRole(profile.id, selectedRoleId);

    if (success) {
      const selectedRole = roles.find((r) => r.id === selectedRoleId);
      await selectInteraction.update({
        content: `✅ Rol de **${profile.full_name}** actualizado a **${selectedRole?.display_name || selectedRole?.name}**`,
        components: [],
      });
    } else {
      await selectInteraction.update({
        content: '❌ Error al actualizar el rol.',
        components: [],
      });
    }
  } catch (error) {
    await interaction.editReply({
      content: '⏰ Tiempo agotado. Intenta de nuevo.',
      components: [],
    });
  }
}

async function handleActivar(
  interaction: ChatInputCommandInteraction,
  profile: Profile,
  targetUser: any
): Promise<void> {
  if (profile.is_active) {
    await interaction.reply({
      content: `ℹ️ **${profile.full_name || targetUser.username}** ya está activo.`,
      ephemeral: true,
    });
    return;
  }

  const success = await setProfileActive(profile.id, true);

  if (success) {
    await interaction.reply({
      content: `✅ **${profile.full_name || targetUser.username}** ha sido activado.`,
    });
  } else {
    await interaction.reply({
      content: '❌ Error al activar el usuario.',
      ephemeral: true,
    });
  }
}

async function handleDesactivar(
  interaction: ChatInputCommandInteraction,
  profile: Profile,
  targetUser: any
): Promise<void> {
  if (!profile.is_active) {
    await interaction.reply({
      content: `ℹ️ **${profile.full_name || targetUser.username}** ya está inactivo.`,
      ephemeral: true,
    });
    return;
  }

  const success = await setProfileActive(profile.id, false);

  if (success) {
    await interaction.reply({
      content: `✅ **${profile.full_name || targetUser.username}** ha sido desactivado.`,
    });
  } else {
    await interaction.reply({
      content: '❌ Error al desactivar el usuario.',
      ephemeral: true,
    });
  }
}
