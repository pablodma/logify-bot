import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { 
  createDiscordRole, 
  updateDiscordRole, 
  deleteDiscordRole,
  assignRoleToMember,
  removeRoleFromMember 
} from './services/roleSyncService';
import { getSupabase, getProfileByDiscordId } from './supabase';
import { config } from './config';

const app = express();

// CORS configuration - allow requests from Vercel frontend
const allowedOrigins = [
  'https://logifyme.vercel.app',
  'https://logify.me',
  'http://localhost:3000',
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Allow exact matches
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    // Allow all Vercel preview deployments
    if (origin.endsWith('.vercel.app')) {
      return callback(null, true);
    }
    
    console.warn(`⚠️ CORS blocked request from: ${origin}`);
    callback(null, false);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Handle preflight requests explicitly
app.options('*', cors());

app.use(express.json());

// Webhook secret for authentication
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'logify-webhook-secret';

/**
 * Middleware to verify webhook secret
 */
function verifyWebhookSecret(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || authHeader !== `Bearer ${WEBHOOK_SECRET}`) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  
  next();
}

/**
 * Health check endpoint
 */
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'logify-bot-webhook' });
});

// ==========================================
// DISCORD ROLES LIST ENDPOINT
// ==========================================

/**
 * Get all Discord roles from the server
 * GET /discord/roles
 */
app.get('/discord/roles', verifyWebhookSecret, async (req: Request, res: Response) => {
  try {
    const { Client } = await import('discord.js');
    const { config } = await import('./config');
    
    // Get the guild from the initialized client
    const { getGuildRoles } = await import('./services/roleSyncService');
    const roles = await getGuildRoles();
    
    if (!roles) {
      res.status(500).json({ error: 'Could not fetch Discord roles' });
      return;
    }
    
    // Return roles sorted by position (highest first)
    const rolesArray = roles
      .filter(role => !role.managed && role.name !== '@everyone') // Exclude bot roles and @everyone
      .sort((a, b) => b.position - a.position)
      .map(role => ({
        id: role.id,
        name: role.name,
        color: role.hexColor,
        position: role.position,
        memberCount: role.members.size
      }));
    
    res.json({ roles: rolesArray });
  } catch (error: any) {
    console.error('❌ Error fetching Discord roles:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch Discord roles' });
  }
});

// ==========================================
// ROLE SYNC ENDPOINTS
// ==========================================

/**
 * Create a new Discord role
 * POST /sync/role/create
 */
app.post('/sync/role/create', verifyWebhookSecret, async (req: Request, res: Response) => {
  try {
    const { roleId, name, color, description } = req.body;
    
    if (!roleId || !name) {
      res.status(400).json({ error: 'roleId and name are required' });
      return;
    }
    
    console.log(`📥 Webhook: Create role request - ${name}`);
    
    const result = await createDiscordRole({
      name,
      color: color || '#6B7280',
      reason: description || 'Created from Logify Web',
    });
    
    if (result.success && result.discordRoleId) {
      // Update Supabase with the new Discord role ID
      const supabase = getSupabase();
      await supabase.rpc('update_role_discord_id', {
        p_role_id: roleId,
        p_discord_role_id: result.discordRoleId,
      });
      
      res.json({ 
        success: true, 
        discordRoleId: result.discordRoleId,
        message: `Role ${name} created successfully` 
      });
    } else {
      res.status(500).json({ 
        success: false, 
        error: result.error || 'Failed to create Discord role' 
      });
    }
  } catch (error: any) {
    console.error('❌ Error in /sync/role/create:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

/**
 * Update an existing Discord role
 * POST /sync/role/update
 */
app.post('/sync/role/update', verifyWebhookSecret, async (req: Request, res: Response) => {
  try {
    const { discordRoleId, name, color } = req.body;
    
    if (!discordRoleId) {
      res.status(400).json({ error: 'discordRoleId is required' });
      return;
    }
    
    console.log(`📥 Webhook: Update role request - ${discordRoleId}`);
    
    const result = await updateDiscordRole(discordRoleId, {
      name,
      color,
      reason: 'Updated from Logify Web',
    });
    
    if (result.success) {
      res.json({ 
        success: true, 
        message: 'Role updated successfully' 
      });
    } else {
      res.status(500).json({ 
        success: false, 
        error: result.error || 'Failed to update Discord role' 
      });
    }
  } catch (error: any) {
    console.error('❌ Error in /sync/role/update:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

/**
 * Delete a Discord role
 * POST /sync/role/delete
 */
app.post('/sync/role/delete', verifyWebhookSecret, async (req: Request, res: Response) => {
  try {
    const { discordRoleId } = req.body;
    
    if (!discordRoleId) {
      res.status(400).json({ error: 'discordRoleId is required' });
      return;
    }
    
    console.log(`📥 Webhook: Delete role request - ${discordRoleId}`);
    
    const result = await deleteDiscordRole(discordRoleId, 'Deleted from Logify Web');
    
    if (result.success) {
      res.json({ 
        success: true, 
        message: 'Role deleted successfully' 
      });
    } else {
      res.status(500).json({ 
        success: false, 
        error: result.error || 'Failed to delete Discord role' 
      });
    }
  } catch (error: any) {
    console.error('❌ Error in /sync/role/delete:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// ==========================================
// PROFILE ROLE ASSIGNMENT ENDPOINTS
// ==========================================

/**
 * Assign a role to a profile/member
 * POST /sync/profile-role/assign
 */
app.post('/sync/profile-role/assign', verifyWebhookSecret, async (req: Request, res: Response) => {
  try {
    const { profileId, discordRoleId } = req.body;
    
    if (!profileId || !discordRoleId) {
      res.status(400).json({ error: 'profileId and discordRoleId are required' });
      return;
    }
    
    console.log(`📥 Webhook: Assign role to profile - ${profileId} -> ${discordRoleId}`);
    
    // Get profile's Discord ID from Supabase
    const supabase = getSupabase();
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('discord_id')
      .eq('id', profileId)
      .single();
    
    if (profileError || !profile?.discord_id) {
      res.status(400).json({ 
        success: false, 
        error: 'Profile not found or Discord not linked' 
      });
      return;
    }
    
    const result = await assignRoleToMember(
      profile.discord_id,
      discordRoleId,
      'Assigned from Logify Web'
    );
    
    if (result.success) {
      res.json({ 
        success: true, 
        message: 'Role assigned successfully' 
      });
    } else {
      res.status(500).json({ 
        success: false, 
        error: result.error || 'Failed to assign role' 
      });
    }
  } catch (error: any) {
    console.error('❌ Error in /sync/profile-role/assign:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

/**
 * Remove a role from a profile/member
 * POST /sync/profile-role/remove
 */
app.post('/sync/profile-role/remove', verifyWebhookSecret, async (req: Request, res: Response) => {
  try {
    const { profileId, discordRoleId } = req.body;
    
    if (!profileId || !discordRoleId) {
      res.status(400).json({ error: 'profileId and discordRoleId are required' });
      return;
    }
    
    console.log(`📥 Webhook: Remove role from profile - ${profileId} -> ${discordRoleId}`);
    
    // Get profile's Discord ID from Supabase
    const supabase = getSupabase();
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('discord_id')
      .eq('id', profileId)
      .single();
    
    if (profileError || !profile?.discord_id) {
      res.status(400).json({ 
        success: false, 
        error: 'Profile not found or Discord not linked' 
      });
      return;
    }
    
    const result = await removeRoleFromMember(
      profile.discord_id,
      discordRoleId,
      'Removed from Logify Web'
    );
    
    if (result.success) {
      res.json({ 
        success: true, 
        message: 'Role removed successfully' 
      });
    } else {
      res.status(500).json({ 
        success: false, 
        error: result.error || 'Failed to remove role' 
      });
    }
  } catch (error: any) {
    console.error('❌ Error in /sync/profile-role/remove:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// ==========================================
// SERVER START
// ==========================================

// Railway assigns PORT automatically - use it for external access
const PORT = parseInt(process.env.PORT || process.env.WEBHOOK_PORT || '3001', 10);

export function startWebhookServer(): void {
  app.listen(PORT, () => {
    console.log(`🌐 Webhook server running on port ${PORT}`);
  });
}

export { app };
