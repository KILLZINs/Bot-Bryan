import 'dotenv/config';
import { REST, Routes } from 'discord.js';
import { readdirSync } from 'fs';
import { join } from 'path';

const commands: object[] = [];
const commandsPath = join(__dirname, 'commands');
const commandFolders = readdirSync(commandsPath);

for (const folder of commandFolders) {
  const folderPath = join(commandsPath, folder);
  const commandFiles = readdirSync(folderPath).filter((f) => f.endsWith('.js') || f.endsWith('.ts'));
  for (const file of commandFiles) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const command = require(join(folderPath, file)).default;
    if (command?.data) commands.push(command.data.toJSON());
  }
}

const rest = new REST().setToken(process.env.DISCORD_TOKEN!);

(async () => {
  try {
    console.log(`🔄 Registrando ${commands.length} comandos slash...`);

    const guildId = process.env.GUILD_ID;
    if (guildId) {
      // Guild commands (instant)
      await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID!, guildId), { body: commands });
      console.log(`✅ Comandos registrados no servidor ${guildId}`);
    } else {
      // Global commands (up to 1h delay)
      await rest.put(Routes.applicationCommands(process.env.CLIENT_ID!), { body: commands });
      console.log('✅ Comandos registrados globalmente');
    }
  } catch (err) {
    console.error('❌ Erro ao registrar comandos:', err);
  }
})();
