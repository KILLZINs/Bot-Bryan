import 'dotenv/config';
import { REST, Routes } from 'discord.js';
import { readdirSync } from 'fs';
import { join } from 'path';

const commands: object[] = [];
const commandNames: string[] = [];
const commandsPath = join(__dirname, 'commands');

for (const entry of readdirSync(commandsPath, { withFileTypes: true })) {
  if (entry.isDirectory()) {
    const folderPath = join(commandsPath, entry.name);
    for (const file of readdirSync(folderPath).filter(f => f.endsWith('.js') || f.endsWith('.ts'))) {
      const command = require(join(folderPath, file)).default;
      if (command?.data) {
        commands.push(command.data.toJSON());
        commandNames.push(command.data.name);
      }
    }
  } else if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.ts'))) {
    const command = require(join(commandsPath, entry.name)).default;
    if (command?.data) {
      commands.push(command.data.toJSON());
      commandNames.push(command.data.name);
    }
  }
}

console.log(`🔍 Comandos encontrados em dist/commands/ (${commands.length}):`);
commandNames.sort().forEach(n => console.log(`   • /${n}`));

const rest = new REST().setToken(process.env.DISCORD_TOKEN!);

(async () => {
  try {
    const guildId = process.env.GUILD_ID;
    if (guildId) {
      await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID!, guildId), { body: commands });
      console.log(`✅ Comandos registrados no servidor ${guildId}`);
    } else {
      await rest.put(Routes.applicationCommands(process.env.CLIENT_ID!), { body: commands });
      console.log('✅ Comandos registrados globalmente — pode demorar até 1h para propagar no Discord');
    }
  } catch (err) {
    console.error('❌ Erro ao registrar comandos:', err);
  }
})();
