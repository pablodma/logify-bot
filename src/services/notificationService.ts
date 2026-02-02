import { 
  Client, 
  Guild, 
  TextChannel, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle,
  ChannelType,
  Collection,
  GuildBasedChannel
} from 'discord.js';
import { config } from '../config';

// Store Discord client reference
let discordClient: Client | null = null;

/**
 * Initialize the notification service with Discord client
 */
export function initNotificationService(client: Client): void {
  discordClient = client;
  console.log('✅ NotificationService initialized');
}

/**
 * Get Discord client
 */
export function getDiscordClient(): Client | null {
  return discordClient;
}

/**
 * Get the Discord guild
 */
async function getGuild(): Promise<Guild | null> {
  if (!discordClient) {
    console.error('❌ Discord client not initialized');
    return null;
  }
  
  try {
    const guild = discordClient.guilds.cache.get(config.discord.guildId);
    return guild || null;
  } catch (error) {
    console.error('❌ Error fetching guild:', error);
    return null;
  }
}

// ==========================================
// STATUS & INFO
// ==========================================

export interface DiscordStatus {
  online: boolean;
  guild: {
    id: string;
    name: string;
    memberCount: number;
    iconUrl: string | null;
  } | null;
  bot: {
    id: string;
    username: string;
    avatarUrl: string | null;
  } | null;
  stats: {
    linkedUsers: number;
    syncedRoles: number;
  };
}

/**
 * Get bot status and server info
 */
export async function getDiscordStatus(linkedUsers: number, syncedRoles: number): Promise<DiscordStatus> {
  if (!discordClient || !discordClient.isReady()) {
    return {
      online: false,
      guild: null,
      bot: null,
      stats: { linkedUsers, syncedRoles }
    };
  }

  const guild = await getGuild();
  
  return {
    online: true,
    guild: guild ? {
      id: guild.id,
      name: guild.name,
      memberCount: guild.memberCount,
      iconUrl: guild.iconURL({ size: 128 })
    } : null,
    bot: {
      id: discordClient.user!.id,
      username: discordClient.user!.username,
      avatarUrl: discordClient.user!.displayAvatarURL({ size: 128 })
    },
    stats: { linkedUsers, syncedRoles }
  };
}

// ==========================================
// CHANNELS
// ==========================================

export interface DiscordChannel {
  id: string;
  name: string;
  category: string | null;
  position: number;
}

/**
 * Get text channels where bot can send messages
 */
export async function getTextChannels(): Promise<DiscordChannel[]> {
  const guild = await getGuild();
  if (!guild) {
    return [];
  }

  try {
    const channels = guild.channels.cache
      .filter((channel): channel is TextChannel => 
        channel.type === ChannelType.GuildText &&
        channel.permissionsFor(guild.members.me!)?.has('SendMessages') === true
      )
      .sort((a, b) => a.position - b.position)
      .map(channel => ({
        id: channel.id,
        name: channel.name,
        category: channel.parent?.name || null,
        position: channel.position
      }));

    return channels;
  } catch (error) {
    console.error('❌ Error fetching channels:', error);
    return [];
  }
}

// ==========================================
// EVENT NOTIFICATIONS
// ==========================================

export interface EventNotificationData {
  id: string;
  title: string;
  description?: string;
  start_date: string;
  slots_available: number;
  slots_total: number;
  groups?: { callsign: string; available: number }[];
}

export interface NotifyEventRequest {
  channel_id: string;
  mention_role_id?: string;
  event: EventNotificationData;
}

export interface NotifyResult {
  success: boolean;
  message_id?: string;
  error?: string;
}

/**
 * Send event notification to Discord channel
 */
export async function sendEventNotification(data: NotifyEventRequest): Promise<NotifyResult> {
  const guild = await getGuild();
  if (!guild) {
    return { success: false, error: 'Guild not found' };
  }

  try {
    const channel = guild.channels.cache.get(data.channel_id) as TextChannel;
    if (!channel || channel.type !== ChannelType.GuildText) {
      return { success: false, error: 'Channel not found or not a text channel' };
    }

    // Format date
    const eventDate = new Date(data.event.start_date);
    const dateOptions: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    };
    const formattedDate = eventDate.toLocaleDateString('es-ES', dateOptions);

    // Build groups info
    let groupsInfo = '';
    if (data.event.groups && data.event.groups.length > 0) {
      groupsInfo = data.event.groups
        .map(g => `• **${g.callsign}**: ${g.available} disponible${g.available !== 1 ? 's' : ''}`)
        .join('\n');
    }

    // Build embed
    const embed = new EmbedBuilder()
      .setColor(0x3B82F6) // Blue
      .setTitle('🛫 NUEVO EVENTO')
      .addFields(
        { name: data.event.title, value: '\u200B' },
        { name: '📅 Fecha', value: formattedDate, inline: false }
      );

    if (data.event.description) {
      embed.addFields({ name: '📝 Descripción', value: data.event.description.substring(0, 1024), inline: false });
    }

    embed.addFields({
      name: `✈️ Slots Disponibles: ${data.event.slots_available}/${data.event.slots_total}`,
      value: groupsInfo || 'Sin información de grupos',
      inline: false
    });

    embed.setTimestamp()
      .setFooter({ text: 'Logify - Gestión de Eventos' });

    // Build action row with button
    const appUrl = process.env.APP_URL || 'https://logifyme.vercel.app';
    const eventUrl = `${appUrl}/calendar?event=${data.event.id}`;
    
    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setLabel('Reservar Slot')
          .setStyle(ButtonStyle.Link)
          .setURL(eventUrl)
          .setEmoji('🎯')
      );

    // Build message content with optional mention
    let content = '';
    if (data.mention_role_id) {
      content = `<@&${data.mention_role_id}>`;
    }

    // Send message
    const message = await channel.send({
      content: content || undefined,
      embeds: [embed],
      components: [row]
    });

    console.log(`✅ Event notification sent: ${data.event.title} -> #${channel.name}`);
    
    return { success: true, message_id: message.id };
  } catch (error: any) {
    console.error('❌ Error sending event notification:', error);
    return { success: false, error: error.message || 'Failed to send notification' };
  }
}

// ==========================================
// REMINDER NOTIFICATIONS
// ==========================================

export interface ReminderNotificationData {
  id: string;
  title: string;
  start_date: string;
  slots_available: number;
  slots_total: number;
  hours_until: number;
}

export interface NotifyReminderRequest {
  channel_id: string;
  mention_role_id?: string;
  event: ReminderNotificationData;
}

/**
 * Send reminder notification to Discord channel
 */
export async function sendReminderNotification(data: NotifyReminderRequest): Promise<NotifyResult> {
  const guild = await getGuild();
  if (!guild) {
    return { success: false, error: 'Guild not found' };
  }

  try {
    const channel = guild.channels.cache.get(data.channel_id) as TextChannel;
    if (!channel || channel.type !== ChannelType.GuildText) {
      return { success: false, error: 'Channel not found or not a text channel' };
    }

    // Format time until event
    let timeUntil = '';
    if (data.event.hours_until < 1) {
      timeUntil = 'menos de 1 hora';
    } else if (data.event.hours_until === 1) {
      timeUntil = '1 hora';
    } else if (data.event.hours_until < 24) {
      timeUntil = `${data.event.hours_until} horas`;
    } else {
      const days = Math.floor(data.event.hours_until / 24);
      timeUntil = days === 1 ? '1 día' : `${days} días`;
    }

    // Format date
    const eventDate = new Date(data.event.start_date);
    const timeOptions: Intl.DateTimeFormatOptions = {
      hour: '2-digit',
      minute: '2-digit'
    };
    const formattedTime = eventDate.toLocaleTimeString('es-ES', timeOptions);

    // Build embed
    const embed = new EmbedBuilder()
      .setColor(0xF59E0B) // Yellow/Amber
      .setTitle(`⏰ RECORDATORIO - Evento en ${timeUntil}`)
      .addFields(
        { name: data.event.title, value: '\u200B' },
        { name: '🕐 Hora', value: `Hoy a las ${formattedTime}`, inline: true },
        { name: '✈️ Slots', value: `${data.event.slots_available}/${data.event.slots_total} disponibles`, inline: true }
      )
      .setTimestamp()
      .setFooter({ text: 'Logify - Gestión de Eventos' });

    // Build action row with button
    const appUrl = process.env.APP_URL || 'https://logifyme.vercel.app';
    const eventUrl = `${appUrl}/calendar?event=${data.event.id}`;
    
    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setLabel('Ver Evento')
          .setStyle(ButtonStyle.Link)
          .setURL(eventUrl)
          .setEmoji('📅')
      );

    // Build message content with optional mention
    let content = '';
    if (data.mention_role_id) {
      content = `<@&${data.mention_role_id}>`;
    }

    // Send message
    const message = await channel.send({
      content: content || undefined,
      embeds: [embed],
      components: [row]
    });

    console.log(`✅ Reminder notification sent: ${data.event.title} -> #${channel.name}`);
    
    return { success: true, message_id: message.id };
  } catch (error: any) {
    console.error('❌ Error sending reminder notification:', error);
    return { success: false, error: error.message || 'Failed to send reminder' };
  }
}

// ==========================================
// LOG NOTIFICATIONS
// ==========================================

export type LogAction = 
  | 'slot_reserved' 
  | 'slot_released' 
  | 'event_created' 
  | 'event_updated'
  | 'event_cancelled'
  | 'role_assigned' 
  | 'role_removed'
  | 'user_linked'
  | 'error';

export interface LogNotificationRequest {
  channel_id: string;
  action: LogAction;
  actor: {
    name: string;
    avatar_url?: string;
  };
  details: string;
  event_name?: string;
  error_message?: string;
}

const LOG_COLORS: Record<LogAction, number> = {
  slot_reserved: 0x22C55E,   // Green
  slot_released: 0xF97316,   // Orange
  event_created: 0x3B82F6,   // Blue
  event_updated: 0x8B5CF6,   // Purple
  event_cancelled: 0xEF4444, // Red
  role_assigned: 0x06B6D4,   // Cyan
  role_removed: 0xF59E0B,    // Yellow
  user_linked: 0x10B981,     // Emerald
  error: 0xDC2626,           // Red
};

const LOG_ICONS: Record<LogAction, string> = {
  slot_reserved: '✅',
  slot_released: '🔓',
  event_created: '📅',
  event_updated: '📝',
  event_cancelled: '❌',
  role_assigned: '🏷️',
  role_removed: '🏷️',
  user_linked: '🔗',
  error: '⚠️',
};

const LOG_TITLES: Record<LogAction, string> = {
  slot_reserved: 'Slot Reservado',
  slot_released: 'Slot Liberado',
  event_created: 'Evento Creado',
  event_updated: 'Evento Actualizado',
  event_cancelled: 'Evento Cancelado',
  role_assigned: 'Rol Asignado',
  role_removed: 'Rol Removido',
  user_linked: 'Usuario Vinculado',
  error: 'Error',
};

/**
 * Send log notification to Discord channel
 */
export async function sendLogNotification(data: LogNotificationRequest): Promise<NotifyResult> {
  const guild = await getGuild();
  if (!guild) {
    return { success: false, error: 'Guild not found' };
  }

  try {
    const channel = guild.channels.cache.get(data.channel_id) as TextChannel;
    if (!channel || channel.type !== ChannelType.GuildText) {
      return { success: false, error: 'Channel not found or not a text channel' };
    }

    // Build embed
    const embed = new EmbedBuilder()
      .setColor(LOG_COLORS[data.action])
      .setTitle(`${LOG_ICONS[data.action]} ${LOG_TITLES[data.action]}`)
      .setDescription(data.details)
      .setTimestamp();

    if (data.actor.avatar_url) {
      embed.setThumbnail(data.actor.avatar_url);
    }

    embed.addFields({ name: 'Usuario', value: data.actor.name, inline: true });

    if (data.event_name) {
      embed.addFields({ name: 'Evento', value: data.event_name, inline: true });
    }

    if (data.error_message) {
      embed.addFields({ name: 'Error', value: `\`\`\`${data.error_message}\`\`\``, inline: false });
    }

    embed.setFooter({ text: 'Logify Logs' });

    // Send message
    const message = await channel.send({ embeds: [embed] });

    return { success: true, message_id: message.id };
  } catch (error: any) {
    console.error('❌ Error sending log notification:', error);
    return { success: false, error: error.message || 'Failed to send log' };
  }
}
