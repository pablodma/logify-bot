import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from './config';

let supabaseInstance: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!supabaseInstance) {
    supabaseInstance = createClient(
      config.supabase.url,
      config.supabase.serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );
  }
  return supabaseInstance;
}

// Profile types
export interface Profile {
  id: string;
  email: string;
  full_name: string;
  discord_id: string | null;
  discord_username: string | null;
  role_id: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Role {
  id: string;
  name: string;
  display_name: string;
  level: number;
}

// Extended Role interface with Discord sync fields
export interface RoleWithDiscord {
  id: string;
  name: string;
  description: string | null;
  color: string;
  is_system_role: boolean;
  is_active: boolean;
  discord_role_id: string | null;
  discord_sync_enabled: boolean;
  discord_sync_status: 'pending' | 'synced' | 'error' | 'disabled';
  discord_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

// Profile role assignment
export interface ProfileRole {
  id: string;
  profile_id: string;
  role_id: string;
  assigned_by: string | null;
  assigned_at: string;
  expires_at: string | null;
  is_active: boolean;
}

// Database operations
export async function getProfileByDiscordId(discordId: string): Promise<Profile | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('discord_id', discordId)
    .single();

  if (error) {
    console.error('Error fetching profile:', error);
    return null;
  }
  return data;
}

export async function getAllProfiles(): Promise<Profile[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching profiles:', error);
    return [];
  }
  return data || [];
}

export async function getRoles(): Promise<Role[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('roles')
    .select('*')
    .order('level', { ascending: false });

  if (error) {
    console.error('Error fetching roles:', error);
    return [];
  }
  return data || [];
}

export async function updateProfileRole(profileId: string, roleId: string): Promise<boolean> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('profiles')
    .update({ role_id: roleId, updated_at: new Date().toISOString() })
    .eq('id', profileId);

  if (error) {
    console.error('Error updating profile role:', error);
    return false;
  }
  return true;
}

export async function setProfileActive(profileId: string, isActive: boolean): Promise<boolean> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('profiles')
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq('id', profileId);

  if (error) {
    console.error('Error updating profile status:', error);
    return false;
  }
  return true;
}

// ==========================================
// ROLE DISCORD SYNC FUNCTIONS
// ==========================================

/**
 * Get all roles with Discord sync info
 */
export async function getRolesWithDiscord(): Promise<RoleWithDiscord[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('roles')
    .select('*')
    .eq('is_active', true)
    .order('name');

  if (error) {
    console.error('Error fetching roles with Discord info:', error);
    return [];
  }
  return data || [];
}

/**
 * Get role by Discord role ID
 */
export async function getRoleByDiscordId(discordRoleId: string): Promise<RoleWithDiscord | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('roles')
    .select('*')
    .eq('discord_role_id', discordRoleId)
    .single();

  if (error) {
    console.error('Error fetching role by Discord ID:', error);
    return null;
  }
  return data;
}

/**
 * Get role by Logify role ID
 */
export async function getRoleById(roleId: string): Promise<RoleWithDiscord | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('roles')
    .select('*')
    .eq('id', roleId)
    .single();

  if (error) {
    console.error('Error fetching role by ID:', error);
    return null;
  }
  return data;
}

/**
 * Update role's Discord role ID after sync
 */
export async function updateRoleDiscordId(
  roleId: string, 
  discordRoleId: string
): Promise<boolean> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('roles')
    .update({ 
      discord_role_id: discordRoleId,
      discord_sync_status: 'synced',
      discord_synced_at: new Date().toISOString()
    })
    .eq('id', roleId);

  if (error) {
    console.error('Error updating role Discord ID:', error);
    return false;
  }
  return true;
}

/**
 * Update role's sync status
 */
export async function updateRoleSyncStatus(
  roleId: string, 
  status: 'pending' | 'synced' | 'error' | 'disabled'
): Promise<boolean> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('roles')
    .update({ 
      discord_sync_status: status,
      discord_synced_at: new Date().toISOString()
    })
    .eq('id', roleId);

  if (error) {
    console.error('Error updating role sync status:', error);
    return false;
  }
  return true;
}

/**
 * Clear role's Discord role ID (for when role is deleted from Discord)
 */
export async function clearRoleDiscordId(roleId: string): Promise<boolean> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('roles')
    .update({ 
      discord_role_id: null,
      discord_sync_status: 'pending',
      discord_synced_at: new Date().toISOString()
    })
    .eq('id', roleId);

  if (error) {
    console.error('Error clearing role Discord ID:', error);
    return false;
  }
  return true;
}

/**
 * Get roles that need to be synced to Discord
 */
export async function getPendingSyncRoles(): Promise<RoleWithDiscord[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('roles')
    .select('*')
    .eq('discord_sync_enabled', true)
    .eq('is_active', true)
    .or('discord_role_id.is.null,discord_sync_status.eq.pending')
    .order('created_at');

  if (error) {
    console.error('Error fetching pending sync roles:', error);
    return [];
  }
  return data || [];
}

// ==========================================
// PROFILE ROLE SYNC FUNCTIONS
// ==========================================

/**
 * Get profile roles with role details
 */
export async function getProfileRolesWithDetails(profileId: string): Promise<(ProfileRole & { role: RoleWithDiscord })[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('profile_roles')
    .select(`
      *,
      role:roles(*)
    `)
    .eq('profile_id', profileId)
    .eq('is_active', true);

  if (error) {
    console.error('Error fetching profile roles:', error);
    return [];
  }
  return data || [];
}

/**
 * Add role to profile (used for Discord -> Supabase sync)
 */
export async function addRoleToProfile(
  profileId: string, 
  roleId: string
): Promise<boolean> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('profile_roles')
    .upsert({
      profile_id: profileId,
      role_id: roleId,
      is_active: true,
      assigned_at: new Date().toISOString()
    }, {
      onConflict: 'profile_id,role_id'
    });

  if (error) {
    console.error('Error adding role to profile:', error);
    return false;
  }
  return true;
}

/**
 * Remove role from profile (used for Discord -> Supabase sync)
 */
export async function removeRoleFromProfile(
  profileId: string, 
  roleId: string
): Promise<boolean> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('profile_roles')
    .update({ is_active: false })
    .eq('profile_id', profileId)
    .eq('role_id', roleId);

  if (error) {
    console.error('Error removing role from profile:', error);
    return false;
  }
  return true;
}

/**
 * Get profile by Discord user ID (helper for role sync)
 */
export async function getProfileIdByDiscordId(discordId: string): Promise<string | null> {
  const profile = await getProfileByDiscordId(discordId);
  return profile?.id || null;
}
