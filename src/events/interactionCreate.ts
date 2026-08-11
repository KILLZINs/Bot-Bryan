import { Interaction, Collection } from 'discord.js';
import { ExtendedClient } from '../types';
import { errorEmbed } from '../utils/embeds';
import { handleButton } from '../handlers/buttonHandler';
import { handleSelect } from '../handlers/selectHandler';
import { handleModal } from '../handlers/modalHandler';
import { isGuildAllowed, isEnforcementActive } from '../utils/allowlist';

export default {
  name: 'interactionCreate',
  once: false,
  async execute(interaction: Interaction, client: ExtendedClient) {
    // ── Allowlist guard ──────────────────────────────────────────────────────
    // /botadmin sempre passa (dono precisa usá-lo mesmo de servidores não autorizados)
    const isBotAdmin = interaction.isChatInputCommand() && interaction.commandName === 'botadmin';
    if (interaction.guildId && !isBotAdmin && !isGuildAllowed(interaction.guildId)) {
      if (interaction.isChatInputCommand()) {
        await interaction.reply({
          embeds: [errorEmbed('Servidor Não Autorizado', 'Este servidor não está na allowlist do bot.\nContacte o dono do bot para solicitar acesso.')],
          ephemeral: true,
        });
      }
      // Botões/modais/selects: silenciosamente ignorar
      return;
    }

    // ── Slash commands ───────────────────────────────────────────────────────
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;

      // Cooldown
      const { cooldowns } = client;
      if (!cooldowns.has(command.data.name)) {
        cooldowns.set(command.data.name, new Collection());
      }
      const now = Date.now();
      const timestamps = cooldowns.get(command.data.name)!;
      const cooldownMs = 3_000;
      if (timestamps.has(interaction.user.id)) {
        const expiry = timestamps.get(interaction.user.id)! + cooldownMs;
        if (now < expiry) {
          const left = ((expiry - now) / 1000).toFixed(1);
          await interaction.reply({
            embeds: [errorEmbed('Aguarde!', `Espere **${left}s** antes de usar este comando novamente.`)],
            ephemeral: true,
          });
          return;
        }
      }
      timestamps.set(interaction.user.id, now);
      setTimeout(() => timestamps.delete(interaction.user.id), cooldownMs);

      try {
        await command.execute(interaction);
      } catch (err) {
        console.error(`Erro no comando ${interaction.commandName}:`, err);
        const embed = errorEmbed('Erro Inesperado', 'Ocorreu um erro ao executar este comando.');
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ embeds: [embed], ephemeral: true }).catch(() => null);
        } else {
          await interaction.reply({ embeds: [embed], ephemeral: true }).catch(() => null);
        }
      }
      return;
    }

    // ── Buttons ──────────────────────────────────────────────────────────────
    if (interaction.isButton()) {
      await handleButton(interaction);
      return;
    }

    // ── Select menus (string, role, channel, user) ───────────────────────────
    if (interaction.isAnySelectMenu()) {
      await handleSelect(interaction as any);
      return;
    }

    // ── Modals ───────────────────────────────────────────────────────────────
    if (interaction.isModalSubmit()) {
      await handleModal(interaction);
      return;
    }
  },
};
