import { Interaction, Collection } from 'discord.js';
import { ExtendedClient } from '../types';
import { errorEmbed } from '../utils/embeds';
import { handleButton } from '../handlers/buttonHandler';
import { handleSelect } from '../handlers/selectHandler';
import { handleModal } from '../handlers/modalHandler';
import { isGuildAllowed } from '../utils/allowlist';
import { prisma } from '../database/client';

// 🗺️ MAPEAMENTO PROFISSIONAL DE MÓDULOS
const FEATURE_MAP: Record<string, string> = {
  // ⚔️ RPG & Economia
  'rpg': 'featRpg', 'rpgwipe': 'featRpg',
  'missoes': 'featMissions',
  'loja': 'featEconomy', 'daily': 'featEconomy', 'pay': 'featEconomy', 'saldo': 'featEconomy',

  // 🎯 XP e Engajamento
  'nivel': 'featLeveling', 'rank': 'featLeveling', 'recompensa': 'featLeveling', 'leaderboard': 'featLeveling',
  'perfil': 'featLeveling', 'conquista': 'featLeveling',
  'poll': 'featPolls', 
  'giveaway': 'featGiveaways',
  'rp': 'featSocial', 'genero': 'featSocial',
  
  // 🎵 Música
  'play': 'featMusic', 'stop': 'featMusic', 'skip': 'featMusic', 'volume': 'featMusic',

  // 🛡️ Administração
  'ticket': 'featTickets',
  'mod': 'featMod', 'moderacao': 'featMod', 'logs': 'featMod',
  'anuncio': 'featAnnouncements', 'evento': 'featAnnouncements'
};

export default {
  name: 'interactionCreate',
  once: false,
  async execute(interaction: Interaction, client: ExtendedClient) {
    try {
      // ── Allowlist guard ──────────────────────────────────────────────────────
      const isBotAdmin = interaction.isChatInputCommand() && interaction.commandName === 'botadmin';
      if (interaction.guildId && !isBotAdmin && !isGuildAllowed(interaction.guildId)) {
        if (interaction.isChatInputCommand()) {
          await interaction.reply({
            embeds: [errorEmbed('Servidor Não Autorizado', 'Este servidor não está na allowlist do bot.\nContacte o dono do bot para solicitar acesso.')],
            ephemeral: true,
          });
        }
        return;
      }

      // ── Slash commands ───────────────────────────────────────────────────────
      if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) return;

        const commandName = interaction.commandName;
        const requiredFeature = FEATURE_MAP[commandName];
        const isGlobalAfk = commandName === 'afk';

        // 🚀 OTIMIZAÇÃO: Busca no banco Global e Local ao mesmo tempo!
        // Se precisar de alguma checagem global (AFK ou Kill Switch de Módulos), ele já puxa.
        const fetchGlobal = isGlobalAfk || !!requiredFeature;
        const fetchGuild = interaction.guildId && !!requiredFeature;

        const [globalConfig, guildConfig] = await Promise.all([
          fetchGlobal ? prisma.botConfig.findUnique({ where: { id: 'global' } }) : Promise.resolve(null),
          fetchGuild ? prisma.guildConfig.findUnique({ where: { guildId: interaction.guildId } }) : Promise.resolve(null)
        ]);

        // 1. Bloqueios Globais (Kill Switches do Bryan)
        if (globalConfig) {
          // Trava específica do AFK
          if (isGlobalAfk && globalConfig.featAfk === false) {
            return interaction.reply({
              embeds: [errorEmbed('Módulo Desativado', 'O sistema AFK foi **desativado globalmente** pela administração.')],
              ephemeral: true
            });
          }
          // Trava de todos os outros módulos (RPG, Música, Level, etc)
          if (requiredFeature && (globalConfig as any)[requiredFeature] === false) {
            return interaction.reply({
              embeds: [errorEmbed('Manutenção Global', '🚧 Este sistema foi **desativado globalmente** pela administração para manutenção.\nVolte mais tarde!')],
              ephemeral: true
            });
          }
        }

        // 2. Bloqueios Locais (Dono do Servidor)
        if (guildConfig && requiredFeature && (guildConfig as any)[requiredFeature] === false) {
          return interaction.reply({
            embeds: [errorEmbed('Sistema Offline', 'Este comando pertence a um módulo que foi **desativado** pelos administradores deste servidor.')],
            ephemeral: true
          });
        }

        // Cooldown
        const { cooldowns } = client;
        if (!cooldowns.has(command.data.name)) cooldowns.set(command.data.name, new Collection());
        
        const now = Date.now();
        const timestamps = cooldowns.get(command.data.name)!;
        const cooldownMs = 3_000;
        
        if (timestamps.has(interaction.user.id)) {
          const expiry = timestamps.get(interaction.user.id)! + cooldownMs;
          if (now < expiry) {
            const discordTime = `<t:${Math.floor(expiry / 1000)}:R>`;
            await interaction.reply({ 
              embeds: [errorEmbed('Aguarde!', `Nossos sistemas detectaram comandos muito rápidos.\nTente usar esta função novamente ${discordTime}.`)], 
              ephemeral: true 
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
          if (interaction.replied || interaction.deferred) await interaction.followUp({ embeds: [embed], ephemeral: true }).catch(() => null);
          else await interaction.reply({ embeds: [embed], ephemeral: true }).catch(() => null);
        }
        return;
      }

      // ── Buttons, Selects, Modals ─────────────────────────────────────────────
      if (interaction.isButton()) return handleButton(interaction);
      if (interaction.isAnySelectMenu()) return handleSelect(interaction as any);
      if (interaction.isModalSubmit()) return handleModal(interaction);

    } catch (fatalError) {
      console.error('[SISTEMA] Erro Fatal ignorado para manter o bot online:', fatalError);
    }
  },
};
