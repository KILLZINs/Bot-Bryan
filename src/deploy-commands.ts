import 'dotenv/config';
import { REST, Routes, ApplicationCommandType } from 'discord.js';
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
    const listRoute = guildId
      ? Routes.applicationGuildCommands(process.env.CLIENT_ID!, guildId)
      : Routes.applicationCommands(process.env.CLIENT_ID!);

    // Apps com uma Activity (o bot tem — o dashboard/atividades embutidas)
    // ganham um comando "Entry Point" automático do próprio Discord (tipo 4).
    // Um PUT em massa (bulk overwrite) que não inclui esse comando é
    // interpretado como "apagar o Entry Point", e o Discord recusa a
    // atualização inteira com o erro 50240 — nenhum comando é atualizado.
    // Então buscamos os comandos já registrados, achamos o Entry Point (se
    // existir) e incluímos ele de volta na lista antes de mandar o PUT.
    const existing = (await rest.get(listRoute)) as { type?: number }[];
    const entryPoint = existing.find((c) => c.type === ApplicationCommandType.PrimaryEntryPoint);
    const body = entryPoint ? [...commands, entryPoint] : commands;

    if (guildId) {
      await rest.put(listRoute, { body });
      console.log(`✅ Comandos registrados no servidor ${guildId}`);
    } else {
      await rest.put(listRoute, { body });
      console.log('✅ Comandos registrados globalmente — pode demorar até 1h para propagar no Discord');
    }
  } catch (err) {
    console.error('❌ Erro ao registrar comandos:', err);
  }
})();
