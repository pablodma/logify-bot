import { GuildMember, Role } from 'discord.js';
import { getSupabase, getProfileByDiscordId } from '../supabase';

// Types
export interface OnboardingSettings {
  rules_confirmation_phrase: string;
  onboarding_role_id: string | null;
  onboarding_channel_id: string | null;
  onboarding_enabled: boolean;
  rules_text: string | null;
}

export interface OnboardingProgress {
  id: string;
  user_id: string;
  terms_accepted: boolean;
  privacy_accepted: boolean;
  callsign_set: boolean;
  aircraft_selected: boolean;
  maps_selected: boolean;
  rules_confirmed: boolean;
  rules_confirmed_at: string | null;
  rules_confirmed_by_bot: boolean;
  current_step: number;
  completed_at: string | null;
}

/**
 * Get onboarding settings from Discord settings
 */
export async function getOnboardingSettings(): Promise<OnboardingSettings | null> {
  const supabase = getSupabase();
  
  const { data, error } = await supabase
    .from('discord_settings')
    .select('rules_confirmation_phrase, onboarding_role_id, onboarding_channel_id, onboarding_enabled, rules_text')
    .limit(1)
    .single();

  if (error) {
    console.error('Error fetching onboarding settings:', error);
    return null;
  }

  return data;
}

/**
 * Check if message contains the confirmation phrase
 */
export function containsConfirmationPhrase(message: string, phrase: string): boolean {
  // Normalize both strings for comparison
  const normalizedMessage = message.toLowerCase().trim();
  const normalizedPhrase = phrase.toLowerCase().trim();
  
  return normalizedMessage.includes(normalizedPhrase);
}

/**
 * Get user's onboarding progress
 */
export async function getOnboardingProgress(discordId: string): Promise<OnboardingProgress | null> {
  const supabase = getSupabase();
  
  // First get the profile ID
  const profile = await getProfileByDiscordId(discordId);
  if (!profile) {
    return null;
  }

  const { data, error } = await supabase
    .from('onboarding_progress')
    .select('*')
    .eq('user_id', profile.id)
    .single();

  if (error) {
    console.error('Error fetching onboarding progress:', error);
    return null;
  }

  return data;
}

/**
 * Complete the rules confirmation step
 */
export async function completeRulesConfirmation(discordId: string): Promise<{
  success: boolean;
  completed: boolean;
  error?: string;
}> {
  const supabase = getSupabase();
  
  // Get profile
  const profile = await getProfileByDiscordId(discordId);
  if (!profile) {
    return { 
      success: false, 
      completed: false,
      error: 'Tu cuenta de Discord no está vinculada a Logify. Primero debes iniciar sesión en la web.' 
    };
  }

  // Get current onboarding progress
  const { data: progress, error: progressError } = await supabase
    .from('onboarding_progress')
    .select('*')
    .eq('user_id', profile.id)
    .single();

  if (progressError) {
    // Progress might not exist yet
    if (progressError.code === 'PGRST116') {
      return { 
        success: false, 
        completed: false,
        error: 'Primero debes completar los pasos anteriores del onboarding en la web.' 
      };
    }
    console.error('Error fetching progress:', progressError);
    return { success: false, completed: false, error: 'Error al verificar tu progreso.' };
  }

  // Check if already confirmed
  if (progress.rules_confirmed) {
    return { 
      success: true, 
      completed: progress.completed_at !== null,
      error: undefined 
    };
  }

  // Check if all previous steps are complete
  const previousStepsComplete = 
    progress.terms_accepted &&
    progress.privacy_accepted &&
    progress.callsign_set &&
    progress.aircraft_selected &&
    progress.maps_selected;

  if (!previousStepsComplete) {
    return { 
      success: false, 
      completed: false,
      error: 'Debes completar los pasos anteriores en la web antes de confirmar las reglas.' 
    };
  }

  // Update rules confirmation
  const now = new Date().toISOString();
  const allStepsComplete = previousStepsComplete; // Already checked above

  const { error: updateError } = await supabase
    .from('onboarding_progress')
    .update({
      rules_confirmed: true,
      rules_confirmed_at: now,
      rules_confirmed_by_bot: true,
      current_step: allStepsComplete ? 6 : progress.current_step,
      completed_at: allStepsComplete ? now : null
    })
    .eq('user_id', profile.id);

  if (updateError) {
    console.error('Error updating onboarding progress:', updateError);
    return { success: false, completed: false, error: 'Error al actualizar tu progreso.' };
  }

  return { success: true, completed: allStepsComplete };
}

/**
 * Assign onboarding role to member
 */
export async function assignOnboardingRole(
  member: GuildMember, 
  roleId: string
): Promise<boolean> {
  try {
    const role = member.guild.roles.cache.get(roleId);
    if (!role) {
      console.error(`Onboarding role ${roleId} not found in guild`);
      return false;
    }

    await member.roles.add(role, 'Onboarding completed');
    console.log(`✅ Assigned onboarding role to ${member.user.tag}`);
    return true;
  } catch (error) {
    console.error(`Error assigning onboarding role to ${member.user.tag}:`, error);
    return false;
  }
}

/**
 * Handle onboarding confirmation message
 */
export async function handleOnboardingConfirmation(
  member: GuildMember,
  message: string
): Promise<{
  matched: boolean;
  success: boolean;
  message: string;
}> {
  // Get settings
  const settings = await getOnboardingSettings();
  if (!settings || !settings.onboarding_enabled) {
    return { matched: false, success: false, message: '' };
  }

  // Check if message contains confirmation phrase
  if (!containsConfirmationPhrase(message, settings.rules_confirmation_phrase)) {
    return { matched: false, success: false, message: '' };
  }

  // Phrase matched - process confirmation
  console.log(`🔵 Onboarding confirmation phrase detected from ${member.user.tag}`);

  const result = await completeRulesConfirmation(member.id);

  if (!result.success) {
    return {
      matched: true,
      success: false,
      message: result.error || 'Error al procesar la confirmación.'
    };
  }

  // Assign role if configured
  if (settings.onboarding_role_id) {
    await assignOnboardingRole(member, settings.onboarding_role_id);
  }

  if (result.completed) {
    return {
      matched: true,
      success: true,
      message: `¡Bienvenido a bordo, ${member.displayName}! 🎉\n\nHas completado el proceso de onboarding exitosamente. Ahora tienes acceso completo a la web y al servidor de Discord.\n\n¡Nos vemos en el cielo! ✈️`
    };
  } else {
    return {
      matched: true,
      success: true,
      message: `¡Reglas confirmadas, ${member.displayName}! ✅\n\nHemos registrado que leíste las reglas. Tu progreso ha sido actualizado en la web.`
    };
  }
}
