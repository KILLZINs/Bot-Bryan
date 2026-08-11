// Stub de compatibilidade — templates ainda não implementados nesta versão
import { EmbedBuilder } from 'discord.js';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function applyTemplate(_embed: EmbedBuilder, _key: string): void {
  // no-op: embed template system not yet active
}

export function buildEmbedsHome(): { embed: EmbedBuilder; rows: never[] } {
  const embed = new EmbedBuilder()
    .setTitle('🎨 Customização de Embeds')
    .setDescription('Funcionalidade em desenvolvimento. Use `/alianca` para embeds da aliança.');
  return { embed, rows: [] };
}
