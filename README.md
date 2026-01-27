# Logify Bot

Bot de Discord para gestionar usuarios y eventos de Logify.

## Comandos disponibles

| Comando | Descripción |
|---------|-------------|
| `/usuario info @miembro` | Ver información de un usuario |
| `/usuario rol @miembro` | Cambiar el rol de un usuario |
| `/usuario activar @miembro` | Activar un usuario |
| `/usuario desactivar @miembro` | Desactivar un usuario |
| `/miembros` | Lista todos los miembros registrados |
| `/miembros activos:true` | Lista solo miembros activos |

## Configuración

### 1. Crear Bot en Discord Developer Portal

1. Ve a [Discord Developer Portal](https://discord.com/developers/applications)
2. Selecciona tu aplicación "Logify"
3. Ve a la sección **Bot**
4. Haz clic en **Reset Token** para generar un nuevo token
5. **Copia el token** (solo se muestra una vez)
6. En **Privileged Gateway Intents**, activa:
   - `SERVER MEMBERS INTENT`
   - `MESSAGE CONTENT INTENT`

### 2. Invitar el Bot a tu servidor

1. Ve a **OAuth2** → **URL Generator**
2. En **Scopes**, selecciona:
   - `bot`
   - `applications.commands`
3. En **Bot Permissions**, selecciona:
   - `Send Messages`
   - `Embed Links`
   - `Read Message History`
   - `Use Slash Commands`
4. Copia la URL generada y ábrela en tu navegador
5. Selecciona tu servidor y autoriza

### 3. Variables de Entorno

```env
# Discord Bot Configuration
DISCORD_TOKEN=tu_token_del_bot
DISCORD_CLIENT_ID=1465751026253697064
DISCORD_GUILD_ID=id_de_tu_servidor_discord

# Supabase Configuration  
SUPABASE_URL=https://sjajpvjypxkiarsurtqz.supabase.co
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key

# App Configuration
APP_URL=https://logifyme.vercel.app
```

Para obtener el `DISCORD_GUILD_ID`:
1. Activa el modo desarrollador en Discord (Configuración → Avanzado → Modo desarrollador)
2. Haz clic derecho en tu servidor y selecciona "Copiar ID del servidor"

Para obtener el `SUPABASE_SERVICE_ROLE_KEY`:
1. Ve a [Supabase Dashboard](https://supabase.com/dashboard/project/sjajpvjypxkiarsurtqz/settings/api)
2. Copia el `service_role` key (¡NO la anon key!)

## Deploy en Railway

### Paso 1: Crear cuenta en Railway

1. Ve a [railway.app](https://railway.app/)
2. Crea una cuenta (puedes usar GitHub)

### Paso 2: Crear nuevo proyecto

1. Haz clic en **New Project**
2. Selecciona **Deploy from GitHub repo**
3. Conecta tu repositorio de GitHub
4. Selecciona el repositorio `logify-bot`

### Paso 3: Configurar variables de entorno

1. Ve a la pestaña **Variables**
2. Agrega todas las variables de entorno listadas arriba
3. Railway las cargará automáticamente

### Paso 4: Deploy

1. Railway desplegará automáticamente cuando detecte cambios
2. Revisa los logs para verificar que el bot se conectó correctamente

## Desarrollo local

```bash
# Instalar dependencias
npm install

# Crear archivo .env con las variables
# Edita .env con tus valores

# Desplegar comandos al servidor de Discord
npm run deploy-commands

# Ejecutar en modo desarrollo
npm run dev

# Build y ejecutar en producción
npm run build
npm start
```

## Estructura del proyecto

```
logify-bot/
├── src/
│   ├── commands/
│   │   ├── index.ts        # Registro de comandos
│   │   ├── usuario.ts      # Comando /usuario
│   │   └── miembros.ts     # Comando /miembros
│   ├── config.ts           # Configuración
│   ├── supabase.ts         # Cliente de Supabase
│   ├── deploy-commands.ts  # Script para desplegar comandos
│   └── index.ts            # Punto de entrada
├── package.json
├── tsconfig.json
└── README.md
```

## Agregar nuevos comandos

1. Crea un nuevo archivo en `src/commands/`
2. Exporta `data` (SlashCommandBuilder) y `execute` (función)
3. Importa y registra en `src/commands/index.ts`
4. Ejecuta `npm run deploy-commands` para actualizar Discord
