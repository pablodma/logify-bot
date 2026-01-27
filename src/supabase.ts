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
