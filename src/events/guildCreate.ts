import { Guild } from 'discord.js';
import { isEnforcementActive, isGuildAllowed, getOwnerIds } from '../utils/allowlist';
import { COLORS, EMOJIS } from '../utils/embeds';
import { EmbedBuilder } from 'discord.js';

export default {
  name: 'guildCreate',
  once: false,
  async execute(guild: Guild) {
    const active  = isEnforcementActive();
    const allowed = isGuildAllowed(guild.id);

    if (active && !allowed) {
      // ─── Deixar o servidor não autorizado ─────────────────────────────────
      console.log(`[allowlist] Saindo de servidor não autorizado: ${guild.name} (${guild.id})`);

      // DM para todos os donos/managers
      const ownerIds = getOwnerIds();
      const embed = new EmbedBuilder()
        .setColor(COLORS.WARNING)
        .setTitle(`${EMOJIS.WARNING} Servidor Não Autorizado`)
        .setDescription(
          `O bot entrou em um servidor **não autorizado** e saiu automaticamente.\n\n` +
          `**Servidor:** ${guild.name}\n**ID:** \`${guild.id}\`\n**Membros:** ${guild.memberCount}\n\n` +
          `Para autorizar este servidor:\n\`\`\`/botadmin servidor adicionar guild_id:${guild.id}\`\`\``
        )
        .setThumbnail(guild.iconURL() ?? null)
        .setTimestamp();

      for (const ownerId of ownerIds) {
        try {
          const user = await guild.client.users.fetch(ownerId);
          await user.send({ embeds: [embed] });
        } catch { /* DMs fechadas */ }
      }

      await guild.leave().catch(console.error);
      return;
    }

    // ─── Servidor permitido (ou enforcement inativo) ───────────────────────
    const ownerIds = getOwnerIds();
    const embed = new EmbedBuilder()
      .setColor(COLORS.SUCCESS)
      .setTitle(`${EMOJIS.SPARKLES} Bot Entrou em Novo Servidor`)
      .setDescription(
        `**Servidor:** ${guild.name}\n**ID:** \`${guild.id}\`\n**Membros:** ${guild.memberCount}\n\n` +
        (!active
          ? `⚠️ **Modo bootstrap ativo** — a allowlist está vazia, então qualquer servidor pode usar o bot.\nUse \`/botadmin servidor adicionar\` para ativar o controle de acesso.`
          : `✅ Servidor já está na allowlist.`)
      )
      .setThumbnail(guild.iconURL() ?? null)
      .setTimestamp();

    for (const ownerId of ownerIds) {
      try {
        const user = await guild.client.users.fetch(ownerId);
        await user.send({ embeds: [embed] });
      } catch { /* DMs fechadas */ }
    }
  },
};
