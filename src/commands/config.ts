import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  ChannelSelectMenuBuilder,
  RoleSelectMenuBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ChannelType,
  GuildMember,
  InteractionCollector,
  MessageComponentInteraction
} from 'discord.js';
import { PrismaClient, GuildConfig } from '@prisma/client';
import { Command } from '../types';
import { errorEmbed } from '../utils/embeds';

// Singleton do Prisma embutido para evitar estouro de pool de conexões
declare global {
  var prismaInstance: PrismaClient | undefined;
}
const prisma = globalThis.prismaInstance ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalThis.prismaInstance = prisma;

export default {
  category: 'sistema',
  data: new SlashCommandBuilder()
    .setName('config')
    .setDescription('⚙️ Painel de configuração das funções e módulos do servidor')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false),

  async execute(interaction: ChatInputCommandInteraction) {
    // 1. Camada de Segurança: Validação de Servidor
    if (!interaction.guild || !interaction.guildId || !interaction.member) {
      return interaction.reply({
        embeds: [errorEmbed('Comando Inválido', 'Este comando só pode ser utilizado dentro de servidores.')],
        ephemeral: true,
      });
    }

    // 2. Camada de Segurança: Validação de Permissão de Administrador
    const member = interaction.member as GuildMember;
    if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({
        embeds: [errorEmbed('Acesso Negado', 'Apenas Administradores do servidor podem alterar as configurações.')],
        ephemeral: true,
      });
    }

    const guildId = interaction.guildId;
    const guildName = interaction.guild.name;

    await interaction.deferReply({ ephemeral: true });

    // 3. Camada de Persistência: Carrega ou Cria configuração no Banco
    let cfg: GuildConfig;
    try {
      cfg = await prisma.guildConfig.upsert({
        where: { guildId },
        update: {},
        create: { guildId },
      });
    } catch (err) {
      console.error('[ERRO BANCO /config]:', err);
      return interaction.editReply({
        embeds: [errorEmbed('Erro no Banco', 'Não foi possível carregar as configurações do servidor.')],
      });
    }

    // Embed Principal do Dashboard
    const buildMainEmbed = (c: GuildConfig): EmbedBuilder => {
      const formatChan = (id: string | null) => (id ? `<#${id}>` : '`Não definido`');
      const formatRole = (id: string | null) => (id ? `<@&${id}>` : '`Não definido`');
      const formatBool = (val: boolean) => (val ? '🟢 `Ativo`' : '🔴 `Desativado`');

      return new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(`⚙️ Painel de Controle — ${guildName}`)
        .setDescription('Configure todos os canais, cargos e módulos funcionais do bot para este servidor.')
        .addFields(
          {
            name: '📢 Canais Principais',
            value: `**Boas-Vindas:** ${formatChan(c.welcomeChannelId)}\n**Anúncios:** ${formatChan(c.announcementChannelId)}\n**Logs Gerais:** ${formatChan(c.logChannelId)}\n**Logs Tickets:** ${formatChan(c.ticketLogChannelId)}\n**Level Up:** ${formatChan(c.levelUpChannelId)}\n**Sugestões:** ${formatChan(c.suggestionChannelId)}\n**Feedback:** ${formatChan(c.feedbackChannelId)}`,
            inline: false,
          },
          {
            name: '🛡️ Cargos do Sistema',
            value: `**Admin:** ${formatRole(c.adminRoleId)}\n**Moderador:** ${formatRole(c.modRoleId)}\n**Membro:** ${formatRole(c.memberRoleId)}\n**Silenciado:** ${formatRole(c.mutedRoleId)}\n**Auto-Role:** ${formatRole(c.autoRoleId)}`,
            inline: false,
          },
          {
            name: '🔒 Segurança & Auto-Mod',
            value: `**Anti-Spam:** ${formatBool(c.antiSpam)} | **Anti-Links:** ${formatBool(c.antiLinks)}`,
            inline: false,
          },
          {
            name: '🧩 Módulos do Bot',
            value: 
              `Leveling: ${formatBool(c.featLeveling)} | RPG: ${formatBool(c.featRpg)} | Tickets: ${formatBool(c.featTickets)}\n` +
              `Sorteios: ${formatBool(c.featGiveaways)} | Enquetes: ${formatBool(c.featPolls)} | Auto-Cargos: ${formatBool(c.featSelfRole)}\n` +
              `Missões: ${formatBool(c.featMissions)} | Social: ${formatBool(c.featSocial)} | Economia: ${formatBool(c.featEconomy)}\n` +
              `Moderação: ${formatBool(c.featMod)} | Anúncios: ${formatBool(c.featAnnouncements)} | Música: ${formatBool(c.featMusic)}`,
            inline: false,
          }
        )
        .setFooter({ text: 'Painel seguro • Expira após 3 minutos de inatividade' })
        .setTimestamp();
    };

    // Menu Principal de Categorias
    const buildMainMenuRow = (): ActionRowBuilder<StringSelectMenuBuilder> => {
      return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('cfg_menu_category')
          .setPlaceholder('Escolha a categoria que deseja configurar...')
          .addOptions(
            new StringSelectMenuOptionBuilder()
              .setLabel('Canais do Servidor')
              .setDescription('Configurar canais de boas-vindas, logs, anúncios, sugestões, etc.')
              .setEmoji('📢')
              .setValue('cat_channels'),
            new StringSelectMenuOptionBuilder()
              .setLabel('Cargos do Servidor')
              .setDescription('Configurar cargos de staff, auto-role, membros e silenciados')
              .setEmoji('🛡️')
              .setValue('cat_roles'),
            new StringSelectMenuOptionBuilder()
              .setLabel('Segurança & Auto-Mod')
              .setDescription('Ativar/Desativar Anti-Spam e Anti-Links')
              .setEmoji('🔒')
              .setValue('cat_security'),
            new StringSelectMenuOptionBuilder()
              .setLabel('Módulos & Sistemas')
              .setDescription('Ativar ou desativar sistemas (RPG, Leveling, Tickets, Sorteios, etc.)')
              .setEmoji('🧩')
              .setValue('cat_features')
          )
      );
    };

    const replyMsg = await interaction.editReply({
      embeds: [buildMainEmbed(cfg)],
      components: [buildMainMenuRow()],
    });

    const collector: InteractionCollector<MessageComponentInteraction> = replyMsg.createMessageComponentCollector({
      time: 180000,
    });

    collector.on('collect', async (i) => {
      // 4. Camada de Segurança: Isolamento do painel por usuário
      if (i.user.id !== interaction.user.id) {
        await i.reply({
          embeds: [errorEmbed('Ação Não Permitida', 'Apenas o autor do comando pode interagir com este painel.')],
          ephemeral: true,
        });
        return;
      }

      try {
        // ==========================================
        // 1. NAVEGAÇÃO DE CATEGORIAS
        // ==========================================
        if (i.customId === 'cfg_menu_category' && i.isStringSelectMenu()) {
          const selectedCategory = i.values[0];

          // --- Categoria 1: Canais ---
          if (selectedCategory === 'cat_channels') {
            const channelTypeMenu = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
              new StringSelectMenuBuilder()
                .setCustomId('cfg_select_chan_type')
                .setPlaceholder('Qual canal você deseja definir?')
                .addOptions(
                  { label: 'Boas-Vindas', value: 'welcomeChannelId', emoji: '👋' },
                  { label: 'Anúncios', value: 'announcementChannelId', emoji: '📢' },
                  { label: 'Logs Gerais', value: 'logChannelId', emoji: '📋' },
                  { label: 'Logs de Tickets', value: 'ticketLogChannelId', emoji: '🎫' },
                  { label: 'Canal de Level Up', value: 'levelUpChannelId', emoji: '⭐' },
                  { label: 'Canal de Sugestões', value: 'suggestionChannelId', emoji: '💡' },
                  { label: 'Canal de Feedback', value: 'feedbackChannelId', emoji: '📝' }
                )
            );

            const backRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
              new ButtonBuilder().setCustomId('cfg_btn_back').setLabel('Voltar ao Painel').setStyle(ButtonStyle.Secondary)
            );

            await i.update({
              content: '📢 **Configuração de Canais:** Escolha qual canal deseja alterar:',
              embeds: [],
              components: [channelTypeMenu, backRow],
            });
            return;
          }

          // --- Categoria 2: Cargos ---
          if (selectedCategory === 'cat_roles') {
            const roleTypeMenu = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
              new StringSelectMenuBuilder()
                .setCustomId('cfg_select_role_type')
                .setPlaceholder('Qual cargo você deseja definir?')
                .addOptions(
                  { label: 'Cargo de Administrador', value: 'adminRoleId', emoji: '👑' },
                  { label: 'Cargo de Moderador', value: 'modRoleId', emoji: '🛡️' },
                  { label: 'Cargo de Membro Padrão', value: 'memberRoleId', emoji: '👤' },
                  { label: 'Cargo de Silenciado (Muted)', value: 'mutedRoleId', emoji: '🔇' },
                  { label: 'Cargo Automático (Auto-Role)', value: 'autoRoleId', emoji: '✨' }
                )
            );

            const backRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
              new ButtonBuilder().setCustomId('cfg_btn_back').setLabel('Voltar ao Painel').setStyle(ButtonStyle.Secondary)
            );

            await i.update({
              content: '🛡️ **Configuração de Cargos:** Escolha qual cargo deseja alterar:',
              embeds: [],
              components: [roleTypeMenu, backRow],
            });
            return;
          }

          // --- Categoria 3: Segurança & Auto-Mod ---
          if (selectedCategory === 'cat_security') {
            const toggleButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
              new ButtonBuilder()
                .setCustomId('cfg_toggle_antiSpam')
                .setLabel(`Anti-Spam: ${cfg.antiSpam ? 'ATIVADO' : 'DESATIVADO'}`)
                .setStyle(cfg.antiSpam ? ButtonStyle.Success : ButtonStyle.Danger),
              new ButtonBuilder()
                .setCustomId('cfg_toggle_antiLinks')
                .setLabel(`Anti-Links: ${cfg.antiLinks ? 'ATIVADO' : 'DESATIVADO'}`)
                .setStyle(cfg.antiLinks ? ButtonStyle.Success : ButtonStyle.Danger),
              new ButtonBuilder().setCustomId('cfg_btn_back').setLabel('Voltar').setStyle(ButtonStyle.Secondary)
            );

            await i.update({
              content: '🔒 **Configuração de Segurança:** Clique nos botões para ativar ou desativar proteções:',
              embeds: [],
              components: [toggleButtons],
            });
            return;
          }

          // --- Categoria 4: Módulos & Sistemas ---
          if (selectedCategory === 'cat_features') {
            const moduleSelect = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
              new StringSelectMenuBuilder()
                .setCustomId('cfg_select_feature_toggle')
                .setPlaceholder('Escolha um módulo para alternar (Ativar/Desativar)...')
                .addOptions(
                  { label: `Leveling: ${cfg.featLeveling ? 'Ativo' : 'Desativado'}`, value: 'featLeveling', emoji: '⭐' },
                  { label: `RPG: ${cfg.featRpg ? 'Ativo' : 'Desativado'}`, value: 'featRpg', emoji: '⚔️' },
                  { label: `Tickets: ${cfg.featTickets ? 'Ativo' : 'Desativado'}`, value: 'featTickets', emoji: '🎫' },
                  { label: `Sorteios: ${cfg.featGiveaways ? 'Ativo' : 'Desativado'}`, value: 'featGiveaways', emoji: '🎉' },
                  { label: `Enquetes: ${cfg.featPolls ? 'Ativo' : 'Desativado'}`, value: 'featPolls', emoji: '📊' },
                  { label: `Auto-Cargos: ${cfg.featSelfRole ? 'Ativo' : 'Desativado'}`, value: 'featSelfRole', emoji: '📋' },
                  { label: `Missões: ${cfg.featMissions ? 'Ativo' : 'Desativado'}`, value: 'featMissions', emoji: '🎯' },
                  { label: `Social/Casamento: ${cfg.featSocial ? 'Ativo' : 'Desativado'}`, value: 'featSocial', emoji: '💍' },
                  { label: `Economia: ${cfg.featEconomy ? 'Ativo' : 'Desativado'}`, value: 'featEconomy', emoji: '💰' },
                  { label: `Moderação: ${cfg.featMod ? 'Ativo' : 'Desativado'}`, value: 'featMod', emoji: '🔨' },
                  { label: `Anúncios: ${cfg.featAnnouncements ? 'Ativo' : 'Desativado'}`, value: 'featAnnouncements', emoji: '📢' },
                  { label: `Música: ${cfg.featMusic ? 'Ativo' : 'Desativado'}`, value: 'featMusic', emoji: '🎵' }
                )
            );

            const backRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
              new ButtonBuilder().setCustomId('cfg_btn_back').setLabel('Voltar ao Painel').setStyle(ButtonStyle.Secondary)
            );

            await i.update({
              content: '🧩 **Ativação de Módulos:** Selecione um sistema para alternar o estado:',
              embeds: [],
              components: [moduleSelect, backRow],
            });
            return;
          }
        }

        // ==========================================
        // 2. EXIBIR SELETOR DE CANAL ESPECÍFICO
        // ==========================================
        if (i.customId === 'cfg_select_chan_type' && i.isStringSelectMenu()) {
          const channelKey = i.values[0];

          const channelPicker = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
            new ChannelSelectMenuBuilder()
              .setCustomId(`cfg_apply_chan_${channelKey}`)
              .setPlaceholder('Selecione o canal no servidor...')
              .setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
          );

          const controls = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId(`cfg_reset_field_${channelKey}`)
              .setLabel('Remover/Desativar Canal')
              .setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('cfg_btn_back').setLabel('Voltar').setStyle(ButtonStyle.Secondary)
          );

          await i.update({
            content: `📢 Selecione o novo canal para o campo **${channelKey}**:`,
            components: [channelPicker, controls],
          });
          return;
        }

        // ==========================================
        // 3. EXIBIR SELETOR DE CARGO ESPECÍFICO
        // ==========================================
        if (i.customId === 'cfg_select_role_type' && i.isStringSelectMenu()) {
          const roleKey = i.values[0];

          const rolePicker = new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(
            new RoleSelectMenuBuilder()
              .setCustomId(`cfg_apply_role_${roleKey}`)
              .setPlaceholder('Selecione o cargo no servidor...')
          );

          const controls = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId(`cfg_reset_field_${roleKey}`)
              .setLabel('Remover/Desativar Cargo')
              .setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('cfg_btn_back').setLabel('Voltar').setStyle(ButtonStyle.Secondary)
          );

          await i.update({
            content: `🛡️ Selecione o novo cargo para o campo **${roleKey}**:`,
            components: [rolePicker, controls],
          });
          return;
        }

        // ==========================================
        // 4. APLICAÇÃO E SEGURANÇA DE CANAL
        // ==========================================
        if (i.customId.startsWith('cfg_apply_chan_') && i.isChannelSelectMenu()) {
          const channelField = i.customId.replace('cfg_apply_chan_', '');
          const chosenChannelId = i.values[0];

          // Segurança: Verifica permissão do bot no canal escolhido
          const targetChannel = interaction.guild?.channels.cache.get(chosenChannelId);
          const botMember = interaction.guild?.members.me;

          if (targetChannel && botMember && targetChannel.isTextBased()) {
            const permissions = targetChannel.permissionsFor(botMember);
            if (!permissions?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks])) {
              await i.reply({
                embeds: [errorEmbed('Permissão Insuficiente', `O bot precisa das permissões de **Ver Canal**, **Enviar Mensagens** e **Inserir Links** em <#${chosenChannelId}>.`)],
                ephemeral: true,
              });
              return;
            }
          }

          cfg = await prisma.guildConfig.update({
            where: { guildId },
            data: { [channelField]: chosenChannelId },
          });

          await i.update({
            content: null,
            embeds: [buildMainEmbed(cfg)],
            components: [buildMainMenuRow()],
          });
          return;
        }

        // ==========================================
        // 5. APLICAÇÃO E SEGURANÇA DE CARGO
        // ==========================================
        if (i.customId.startsWith('cfg_apply_role_') && i.isRoleSelectMenu()) {
          const roleField = i.customId.replace('cfg_apply_role_', '');
          const chosenRoleId = i.values[0];
          const targetRole = interaction.guild?.roles.cache.get(chosenRoleId);
          const botMember = interaction.guild?.members.me;

          if (!targetRole || !botMember) {
            await i.reply({
              embeds: [errorEmbed('Cargo Inválido', 'Não foi possível encontrar as informações do cargo.')],
              ephemeral: true,
            });
            return;
          }

          // Segurança: Impede @everyone e cargos gerenciados por integrações
          if (targetRole.id === interaction.guild?.id || targetRole.managed) {
            await i.reply({
              embeds: [errorEmbed('Cargo Inválido', 'Não é possível utilizar o cargo `@everyone` ou cargos automáticos de bots/Nitro.')],
              ephemeral: true,
            });
            return;
          }

          // Segurança: Validação de Hierarquia de Cargos
          if (botMember.roles.highest.position <= targetRole.position) {
            await i.reply({
              embeds: [errorEmbed('Hierarquia Insuficiente', `O cargo <@&${chosenRoleId}> está na mesma posição ou acima do cargo mais alto do bot.`)],
              ephemeral: true,
            });
            return;
          }

          cfg = await prisma.guildConfig.update({
            where: { guildId },
            data: { [roleField]: chosenRoleId },
          });

          await i.update({
            content: null,
            embeds: [buildMainEmbed(cfg)],
            components: [buildMainMenuRow()],
          });
          return;
        }

        // ==========================================
        // 6. ALTERNAÇÃO DE MÓDULOS (FEATURES)
        // ==========================================
        if (i.customId === 'cfg_select_feature_toggle' && i.isStringSelectMenu()) {
          const featureField = i.values[0] as keyof GuildConfig;
          const currentVal = Boolean(cfg[featureField]);

          cfg = await prisma.guildConfig.update({
            where: { guildId },
            data: { [featureField]: !currentVal },
          });

          await i.update({
            content: null,
            embeds: [buildMainEmbed(cfg)],
            components: [buildMainMenuRow()],
          });
          return;
        }

        // ==========================================
        // 7. TOGGLES DE SEGURANÇA (Anti-Spam / Anti-Links)
        // ==========================================
        if (i.customId === 'cfg_toggle_antiSpam' && i.isButton()) {
          cfg = await prisma.guildConfig.update({
            where: { guildId },
            data: { antiSpam: !cfg.antiSpam },
          });

          const toggleButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId('cfg_toggle_antiSpam')
              .setLabel(`Anti-Spam: ${cfg.antiSpam ? 'ATIVADO' : 'DESATIVADO'}`)
              .setStyle(cfg.antiSpam ? ButtonStyle.Success : ButtonStyle.Danger),
            new ButtonBuilder()
              .setCustomId('cfg_toggle_antiLinks')
              .setLabel(`Anti-Links: ${cfg.antiLinks ? 'ATIVADO' : 'DESATIVADO'}`)
              .setStyle(cfg.antiLinks ? ButtonStyle.Success : ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('cfg_btn_back').setLabel('Voltar').setStyle(ButtonStyle.Secondary)
          );

          await i.update({
            content: '🔒 **Configuração de Segurança:** Clique nos botões para ativar ou desativar proteções:',
            components: [toggleButtons],
          });
          return;
        }

        if (i.customId === 'cfg_toggle_antiLinks' && i.isButton()) {
          cfg = await prisma.guildConfig.update({
            where: { guildId },
            data: { antiLinks: !cfg.antiLinks },
          });

          const toggleButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId('cfg_toggle_antiSpam')
              .setLabel(`Anti-Spam: ${cfg.antiSpam ? 'ATIVADO' : 'DESATIVADO'}`)
              .setStyle(cfg.antiSpam ? ButtonStyle.Success : ButtonStyle.Danger),
            new ButtonBuilder()
              .setCustomId('cfg_toggle_antiLinks')
              .setLabel(`Anti-Links: ${cfg.antiLinks ? 'ATIVADO' : 'DESATIVADO'}`)
              .setStyle(cfg.antiLinks ? ButtonStyle.Success : ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('cfg_btn_back').setLabel('Voltar').setStyle(ButtonStyle.Secondary)
          );

          await i.update({
            content: '🔒 **Configuração de Segurança:** Clique nos botões para ativar ou desativar proteções:',
            components: [toggleButtons],
          });
          return;
        }

        // ==========================================
        // 8. RESETAR / LIMPAR CAMPO
        // ==========================================
        if (i.customId.startsWith('cfg_reset_field_') && i.isButton()) {
          const fieldToReset = i.customId.replace('cfg_reset_field_', '');

          cfg = await prisma.guildConfig.update({
            where: { guildId },
            data: { [fieldToReset]: null },
          });

          await i.update({
            content: null,
            embeds: [buildMainEmbed(cfg)],
            components: [buildMainMenuRow()],
          });
          return;
        }

        // ==========================================
        // 9. VOLTAR AO MENU PRINCIPAL
        // ==========================================
        if (i.customId === 'cfg_btn_back' && i.isButton()) {
          await i.update({
            content: null,
            embeds: [buildMainEmbed(cfg)],
            components: [buildMainMenuRow()],
          });
          return;
        }
      } catch (err) {
        console.error('[ERRO COLLECTOR /config]:', err);
        if (!i.replied && !i.deferred) {
          await i.reply({
            embeds: [errorEmbed('Erro Interno', 'Ocorreu um erro ao processar a ação.')],
            ephemeral: true,
          });
        }
      }
    });

    collector.on('end', async () => {
      try {
        await interaction.editReply({ components: [] });
      } catch {
        // Ignora erro se a mensagem já tiver sido deletada
      }
    });
  },
} satisfies Command;
