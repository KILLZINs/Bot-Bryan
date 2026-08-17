import { Interaction, Collection } from 'discord.js';
import { ExtendedClient } from '../types';
import { errorEmbed } from '../utils/embeds';
import { handleButton } from '../handlers/buttonHandler';
import { handleSelect } from '../handlers/selectHandler';
import { handleModal } from '../handlers/modalHandler';
import { isGuildAllowed, isEnforcementActive } from '../utils/allowlist';
import { prisma } from '../database/client'; // 👈 Importamos o Prisma para ler o banco!

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

      // 🛡️ ── GUARDA DO DASHBOARD (MÓDULOS) ── 🛡️
      const commandName = interaction.commandName;

      // 1. Verifica Módulos Globais (Bot Owner Panel)
      if (commandName === 'afk') {
        const globalConfig = await prisma.botConfig.findUnique({ where: { id: 'global' } });
        if (globalConfig && globalConfig.featAfk === false) {
          return interaction.reply({
            embeds: [errorEmbed('Módulo Desativado', 'O sistema AFK foi **desativado globalmente** pela administração.')],
            ephemeral: true
          });
        }
      }

      // 2. Verifica Módulos Locais do Servidor
      if (interaction.guildId) {
        // Dicionário que liga o nome do comando com o nome da coluna no Banco de Dados
        const featureMap: Record<string, string> = {
          'rpg': 'featRpg', 'rpgwipe': 'featRpg', 'perfil': 'featRpg', 'conquista': 'featRpg', 'leaderboard': 'featRpg',
          'nivel': 'featLeveling', 'rank': 'featLeveling', 'recompensa': 'featLeveling',
          'ticket': 'featTickets',
          'poll': 'featPolls',
          'giveaway': 'featGiveaways',
          'rp': 'featSocial', 'genero': 'featSocial',
          'mod': 'featMod', 'moderacao': 'featMod', 'logs': 'featMod',
          'anuncio': 'featAnnouncements', 'evento': 'featAnnouncements'
        };

        const requiredFeature = featureMap[commandName];

        if (requiredFeature) {
          const guildConfig = await prisma.guildConfig.findUnique({ where: { guildId: interaction.guildId } });
          
          // Se o servidor tem uma configuração salva e a feature específica for "false" (desligada)
          if (guildConfig && (guildConfig as any)[requiredFeature] === false) {
            return interaction.reply({
              embeds: [errorEmbed('Módulo Desativado', 'Este comando faz parte de um sistema que foi **desativado** pelos donos deste servidor no Dashboard.')],
              ephemeral: true
            });
          }
        }
      }
      // 🛡️ ── FIM DO GUARDA ── 🛡️

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
