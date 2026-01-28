import { Client, Guild, Role as DiscordRole, GuildMember, Collection, ColorResolvable } from 'discord.js';
import { getSupabase } from '../supabase';
import { config } from '../config';

// Types for role synchronization
export interface LogifyRole {
  id: string;
  name: string;
  description: string | null;
  color: string;
  is_system_role: boolean;
  is_active: boolean;
  discord_role_id: string | null;
  discord_sync_enabled: boolean;
  discord_sync_status: 'pending' | 'synced' | 'error' | 'disabled';
}

export interface RoleSyncResult {
  success: boolean;
  discordRoleId?: string;
  error?: string;
}

export interface ProfileRoleSyncResult {
  success: boolean;
  error?: string;
}

// Store Discord client reference
let discordClient: Client | null = null;

/**
 * Initialize the role sync service with Discord client
 */
export function initRoleSyncService(client: Client): void {
  discordClient = client;
  console.log('✅ RoleSyncService initialized');
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
    const guild = await discordClient.guilds.fetch(config.discord.guildId);
    return guild;
  } catch (error) {
    console.error('❌ Error fetching guild:', error);
    return null;
  }
}

/**
 * Get all roles from the Discord guild
 */
export async function getGuildRoles(): Promise<Collection<string, DiscordRole> | null> {
  if (!discordClient) {
    console.error('❌ Discord client not initialized');
    return null;
  }
  
  try {
    // Get guild from cache first (more reliable for roles)
    let guild = discordClient.guilds.cache.get(config.discord.guildId);
    
    // If not in cache, fetch it
    if (!guild) {
      guild = await discordClient.guilds.fetch(config.discord.guildId);
    }
    
    if (!guild) {
      console.error('❌ Guild not found');
      return null;
    }
    
    // Fetch all roles from the guild
    const roles = await guild.roles.fetch();
    return roles;
  } catch (error) {
    console.error('❌ Error fetching guild roles:', error);
    return null;
  }
}

/**
 * Convert hex color to Discord ColorResolvable
 */
function hexToColorResolvable(hex: string): ColorResolvable {
  // Remove # if present and ensure it's a valid hex
  const cleanHex = hex.replace('#', '');
  return parseInt(cleanHex, 16) as ColorResolvable;
}

// ==========================================
// ROLE CRUD OPERATIONS
// ==========================================

/**
 * Create a role in Discord server
 */
export async function createDiscordRole(roleData: {
  name: string;
  color: string;
  reason?: string;
}): Promise<RoleSyncResult> {
  const guild = await getGuild();
  if (!guild) {
    return { success: false, error: 'Guild not found' };
  }

  try {
    const discordRole = await guild.roles.create({
      name: roleData.name,
      color: hexToColorResolvable(roleData.color),
      reason: roleData.reason || `Created from Logify Web`,
      mentionable: false,
      hoist: false,
    });

    console.log(`✅ Discord role created: ${discordRole.name} (${discordRole.id})`);
    
    return {
      success: true,
      discordRoleId: discordRole.id,
    };
  } catch (error: any) {
    console.error('❌ Error creating Discord role:', error);
    return {
      success: false,
      error: error.message || 'Failed to create Discord role',
    };
  }
}

/**
 * Update a role in Discord server
 */
export async function updateDiscordRole(
  discordRoleId: string,
  roleData: {
    name?: string;
    color?: string;
    reason?: string;
  }
): Promise<RoleSyncResult> {
  const guild = await getGuild();
  if (!guild) {
    return { success: false, error: 'Guild not found' };
  }

  try {
    const discordRole = await guild.roles.fetch(discordRoleId);
    if (!discordRole) {
      return { success: false, error: 'Discord role not found' };
    }

    const updateData: any = {};
    if (roleData.name) updateData.name = roleData.name;
    if (roleData.color) updateData.color = hexToColorResolvable(roleData.color);
    if (roleData.reason) updateData.reason = roleData.reason;

    await discordRole.edit(updateData);
    
    console.log(`✅ Discord role updated: ${discordRole.name}`);
    
    return {
      success: true,
      discordRoleId: discordRole.id,
    };
  } catch (error: any) {
    console.error('❌ Error updating Discord role:', error);
    return {
      success: false,
      error: error.message || 'Failed to update Discord role',
    };
  }
}

/**
 * Delete a role from Discord server
 */
export async function deleteDiscordRole(
  discordRoleId: string,
  reason?: string
): Promise<RoleSyncResult> {
  const guild = await getGuild();
  if (!guild) {
    return { success: false, error: 'Guild not found' };
  }

  try {
    const discordRole = await guild.roles.fetch(discordRoleId);
    if (!discordRole) {
      // Role doesn't exist, consider it a success
      return { success: true };
    }

    await discordRole.delete(reason || 'Deleted from Logify Web');
    
    console.log(`✅ Discord role deleted: ${discordRoleId}`);
    
    return { success: true };
  } catch (error: any) {
    console.error('❌ Error deleting Discord role:', error);
    return {
      success: false,
      error: error.message || 'Failed to delete Discord role',
    };
  }
}

// ==========================================
// MEMBER ROLE ASSIGNMENT
// ==========================================

/**
 * Assign a role to a Discord member
 */
export async function assignRoleToMember(
  discordUserId: string,
  discordRoleId: string,
  reason?: string
): Promise<ProfileRoleSyncResult> {
  const guild = await getGuild();
  if (!guild) {
    return { success: false, error: 'Guild not found' };
  }

  try {
    // Fetch the member
    const member = await guild.members.fetch(discordUserId);
    if (!member) {
      return { success: false, error: 'Member not found in guild' };
    }

    // Fetch the role
    const role = await guild.roles.fetch(discordRoleId);
    if (!role) {
      return { success: false, error: 'Role not found in guild' };
    }

    // Check if member already has the role
    if (member.roles.cache.has(discordRoleId)) {
      return { success: true }; // Already has the role
    }

    // Add the role
    await member.roles.add(role, reason || 'Assigned from Logify Web');
    
    console.log(`✅ Role ${role.name} assigned to ${member.user.tag}`);
    
    return { success: true };
  } catch (error: any) {
    console.error('❌ Error assigning role to member:', error);
    return {
      success: false,
      error: error.message || 'Failed to assign role to member',
    };
  }
}

/**
 * Remove a role from a Discord member
 */
export async function removeRoleFromMember(
  discordUserId: string,
  discordRoleId: string,
  reason?: string
): Promise<ProfileRoleSyncResult> {
  const guild = await getGuild();
  if (!guild) {
    return { success: false, error: 'Guild not found' };
  }

  try {
    // Fetch the member
    const member = await guild.members.fetch(discordUserId);
    if (!member) {
      return { success: false, error: 'Member not found in guild' };
    }

    // Check if member has the role
    if (!member.roles.cache.has(discordRoleId)) {
      return { success: true }; // Doesn't have the role anyway
    }

    // Remove the role
    await member.roles.remove(discordRoleId, reason || 'Removed from Logify Web');
    
    console.log(`✅ Role removed from ${member.user.tag}`);
    
    return { success: true };
  } catch (error: any) {
    console.error('❌ Error removing role from member:', error);
    return {
      success: false,
      error: error.message || 'Failed to remove role from member',
    };
  }
}

// ==========================================
// DISCORD → SUPABASE SYNC
// ==========================================

/**
 * Sync role changes from Discord to Supabase
 * Called when GuildMemberUpdate event is triggered
 */
export async function syncRoleChangesToSupabase(
  discordUserId: string,
  addedRoles: Collection<string, DiscordRole>,
  removedRoles: Collection<string, DiscordRole>
): Promise<void> {
  const supabase = getSupabase();

  // Process added roles
  for (const [roleId, role] of addedRoles) {
    try {
      const { data, error } = await supabase.rpc('sync_profile_role_from_discord', {
        p_discord_user_id: discordUserId,
        p_discord_role_id: roleId,
        p_action: 'add',
      });

      if (error) {
        console.error(`❌ Error syncing added role ${role.name}:`, error);
      } else if (data) {
        console.log(`✅ Synced added role ${role.name} for user ${discordUserId}`);
      }
    } catch (error) {
      console.error(`❌ Error syncing added role ${role.name}:`, error);
    }
  }

  // Process removed roles
  for (const [roleId, role] of removedRoles) {
    try {
      const { data, error } = await supabase.rpc('sync_profile_role_from_discord', {
        p_discord_user_id: discordUserId,
        p_discord_role_id: roleId,
        p_action: 'remove',
      });

      if (error) {
        console.error(`❌ Error syncing removed role ${role.name}:`, error);
      } else if (data) {
        console.log(`✅ Synced removed role ${role.name} for user ${discordUserId}`);
      }
    } catch (error) {
      console.error(`❌ Error syncing removed role ${role.name}:`, error);
    }
  }
}

// ==========================================
// INITIAL SYNC FUNCTIONS
// ==========================================

/**
 * Sync all pending roles from Supabase to Discord
 * Called on bot startup or manually
 */
export async function syncPendingRolesToDiscord(): Promise<void> {
  const supabase = getSupabase();
  
  try {
    // Get roles that need to be synced
    const { data: pendingRoles, error } = await supabase
      .rpc('get_roles_pending_discord_sync');

    if (error) {
      console.error('❌ Error fetching pending roles:', error);
      return;
    }

    if (!pendingRoles || pendingRoles.length === 0) {
      console.log('✅ No pending roles to sync');
      return;
    }

    console.log(`🔄 Syncing ${pendingRoles.length} pending roles to Discord...`);

    for (const role of pendingRoles) {
      // Skip system roles
      if (role.is_system_role) {
        console.log(`⏭️ Skipping system role: ${role.name}`);
        continue;
      }

      // Create role in Discord
      const result = await createDiscordRole({
        name: role.name,
        color: role.color || '#6B7280',
        reason: 'Initial sync from Logify',
      });

      if (result.success && result.discordRoleId) {
        // Update Supabase with Discord role ID
        await supabase.rpc('update_role_discord_id', {
          p_role_id: role.id,
          p_discord_role_id: result.discordRoleId,
        });
        
        console.log(`✅ Synced role: ${role.name} -> ${result.discordRoleId}`);
      } else {
        // Mark as error in Supabase
        await supabase
          .from('roles')
          .update({ 
            discord_sync_status: 'error',
            discord_synced_at: new Date().toISOString(),
          })
          .eq('id', role.id);
          
        console.error(`❌ Failed to sync role: ${role.name} - ${result.error}`);
      }
    }

    console.log('✅ Pending roles sync completed');
  } catch (error) {
    console.error('❌ Error in syncPendingRolesToDiscord:', error);
  }
}

/**
 * Get mapping of Discord role IDs to Logify role IDs
 */
export async function getRoleMapping(): Promise<Map<string, string>> {
  const supabase = getSupabase();
  const mapping = new Map<string, string>();

  try {
    const { data: roles, error } = await supabase
      .from('roles')
      .select('id, discord_role_id')
      .not('discord_role_id', 'is', null);

    if (error) {
      console.error('❌ Error fetching role mapping:', error);
      return mapping;
    }

    for (const role of roles || []) {
      if (role.discord_role_id) {
        mapping.set(role.discord_role_id, role.id);
      }
    }

    return mapping;
  } catch (error) {
    console.error('❌ Error getting role mapping:', error);
    return mapping;
  }
}

/**
 * Check if a Discord role is managed by Logify
 */
export async function isLogifyManagedRole(discordRoleId: string): Promise<boolean> {
  const supabase = getSupabase();

  try {
    const { data, error } = await supabase
      .from('roles')
      .select('id')
      .eq('discord_role_id', discordRoleId)
      .eq('discord_sync_enabled', true)
      .single();

    return !error && !!data;
  } catch (error) {
    return false;
  }
}
