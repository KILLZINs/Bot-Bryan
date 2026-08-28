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
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ModalSubmitInteraction,
} from 'discord.js';
import { PrismaClient, GuildConfig } from '@prisma/client';
import { Command } from '../types';
import { errorEmbed } from '../utils/embeds';
import { getBotConfig, intToHex, BotConfigData } from '../utils/botConfig';

// Singleton do Prisma embutido para controle seguro de conexões
declare global {
  var prismaInstance: PrismaClient | undefined;
}
const prisma = globalThis.prismaInstance ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalThis.prismaInstance = prisma;

export default {
  category: 'sistema',
  data: new SlashCommandBuilder()
    .setName('config')
    .setDescription('⚙️ Painel Central: configure canais, tickets, RPG, cargos e módulos do servidor')
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

    // Função de Renderização da Embed do Painel Geral
    const buildMainEmbed = (c: GuildConfig): EmbedBuilder => {
      const formatChan = (id: string | null) => (id ? `<#${id}>` : '`Não definido`');
      const formatRole = (id: string | null) => (id ? `<@&${id}>` : '`Não definido`');
      const formatBool = (val: boolean) => (val ? '🟢 `Ativo`' : '🔴 `Desativado`');

      return new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(`⚙️ Painel de Controle Geral — ${guildName}`)
        .setDescription('Configure e gerencie todas as funções, sistemas e módulos ativos neste servidor.')
        .addFields(
          {
            name: '🎫 Sistema de Suporte & Tickets',
            value: `**Categoria dos Tickets:** ${formatChan(c.ticketCategoryId)}\n**Canal de Logs de Tickets:** ${formatChan(c.ticketLogChannelId)}`,
            inline: false,
          },
          {
            name: '📢 Canais Principais',
            value: `**Boas-Vindas:** ${formatChan(c.welcomeChannelId)}\n**Anúncios:** ${formatChan(c.announcementChannelId)}\n**Logs Gerais:** ${formatChan(c.logChannelId)}\n**Sugestões:** ${formatChan(c.suggestionChannelId)}\n**Feedback:** ${formatChan(c.feedbackChannelId)}`,
            inline: true,
          },
          {
            name: '🛡️ Cargos do Sistema',
            value: `**Admin:** ${formatRole(c.adminRoleId)}\n**Moderador:** ${formatRole(c.modRoleId)}\n**Membro:** ${formatRole(c.memberRoleId)}\n**Silenciado:** ${formatRole(c.mutedRoleId)}\n**Auto-Role:** ${formatRole(c.autoRoleId)}`,
            inline: true,
          },
          {
            name: '⚔️ RPG & Leveling (XP)',
            value: `**Canal de Level Up:** ${formatChan(c.levelUpChannelId)}\n**Taxa de XP:** \`${c.xpMin} ~ ${c.xpMax} XP\` (Cooldown: \`${c.xpCooldown}s\`)`,
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
          .setPlaceholder('Escolha o módulo que deseja configurar...')
          .addOptions(
            new StringSelectMenuOptionBuilder()
              .setLabel('Sistema de Tickets')
              .setDescription('Configurar Categoria onde abrem os tickets e canal de logs')
              .setEmoji('🎫')
              .setValue('cat_tickets'),
            new StringSelectMenuOptionBuilder()
              .setLabel('RPG & Leveling (XP)')
              .setDescription('Configurar canal de Level Up, XP mínimo/máximo e Cooldown')
              .setEmoji('⚔️')
              .setValue('cat_rpg_leveling'),
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
              .setDescription('Ativar ou desativar proteções de Anti-Spam e Anti-Links')
              .setEmoji('🔒')
              .setValue('cat_security'),
            new StringSelectMenuOptionBuilder()
              .setLabel('Módulos & Sistemas')
              .setDescription('Ligar ou desligar os 12 sistemas funcionais do bot')
              .setEmoji('🧩')
              .setValue('cat_features')
          )
      );
    };

    const replyMsg = await interaction.editReply({
      embeds: [buildMainEmbed(cfg)],
      components: [buildMainMenuRow()],
    });

    const collector = replyMsg.createMessageComponentCollector({
      time: 180000,
    });

    collector.on('collect', async (i) => {
      // 4. Camada de Segurança: Isolamento de Sessão por Usuário
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

          // --- Categoria: Tickets ---
          if (selectedCategory === 'cat_tickets') {
            const catSelect = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
              new ChannelSelectMenuBuilder()
                .setCustomId('cfg_set_chan_ticketCategoryId')
                .setPlaceholder('Selecione a Categoria onde os tickets serão criados...')
                .setChannelTypes(ChannelType.GuildCategory)
            );

            const logSelect = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
              new ChannelSelectMenuBuilder()
                .setCustomId('cfg_set_chan_ticketLogChannelId')
                .setPlaceholder('Selecione o Canal de Logs de Tickets...')
                .setChannelTypes(ChannelType.GuildText)
            );

            const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
              new ButtonBuilder()
                .setCustomId('cfg_reset_field_ticketCategoryId')
                .setLabel('Limpar Categoria')
                .setStyle(ButtonStyle.Danger),
              new ButtonBuilder()
                .setCustomId('cfg_reset_field_ticketLogChannelId')
                .setLabel('Limpar Logs')
                .setStyle(ButtonStyle.Danger),
              new ButtonBuilder().setCustomId('cfg_btn_back').setLabel('Voltar ao Painel').setStyle(ButtonStyle.Secondary)
            );

            await i.update({
              content: '🎫 **Configuração do Sistema de Tickets:**\nEscolha a categoria das salas e o canal de histórico:',
              embeds: [],
              components: [catSelect, logSelect, buttons],
            });
            return;
          }

          // --- Categoria: RPG & Leveling (XP) ---
          if (selectedCategory === 'cat_rpg_leveling') {
            const levelUpChan = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
              new ChannelSelectMenuBuilder()
                .setCustomId('cfg_set_chan_levelUpChannelId')
                .setPlaceholder('Selecione o Canal de Anúncios de Level Up...')
                .setChannelTypes(ChannelType.GuildText)
            );

            const xpControls = new ActionRowBuilder<ButtonBuilder>().addComponents(
              new ButtonBuilder()
                .setCustomId('cfg_btn_edit_xp_modal')
                .setLabel(`Editar Taxa de XP (${cfg.xpMin}-${cfg.xpMax} XP / ${cfg.xpCooldown}s)`)
                .setEmoji('⚡')
                .setStyle(ButtonStyle.Primary),
              new ButtonBuilder()
                .setCustomId('cfg_reset_field_levelUpChannelId')
                .setLabel('Limpar Canal Level Up')
                .setStyle(ButtonStyle.Danger),
              new ButtonBuilder().setCustomId('cfg_btn_back').setLabel('Voltar').setStyle(ButtonStyle.Secondary)
            );

            await i.update({
              content: `⚔️ **Configurações de RPG & Leveling:**\n• XP por Mensagem: **${cfg.xpMin} a ${cfg.xpMax} XP**\n• Intervalo (Cooldown): **${cfg.xpCooldown} segundos**\n• Canal de Level Up: ${cfg.levelUpChannelId ? `<#${cfg.levelUpChannelId}>` : '`Não definido`'}`,
              embeds: [],
              components: [levelUpChan, xpControls],
            });
            return;
          }

          // --- Categoria: Canais Gerais ---
          if (selectedCategory === 'cat_channels') {
            const channelTypeMenu = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
              new StringSelectMenuBuilder()
                .setCustomId('cfg_select_chan_type')
                .setPlaceholder('Qual canal você deseja definir?')
                .addOptions(
                  { label: 'Boas-Vindas', value: 'welcomeChannelId', emoji: '👋' },
                  { label: 'Anúncios', value: 'announcementChannelId', emoji: '📢' },
                  { label: 'Logs Gerais', value: 'logChannelId', emoji: '📋' },
                  { label: 'Canal de Sugestões', value: 'suggestionChannelId', emoji: '💡' },
                  { label: 'Canal de Feedback', value: 'feedbackChannelId', emoji: '📝' }
                )
            );

            const welcomeMsgBtn = new ActionRowBuilder<ButtonBuilder>().addComponents(
              new ButtonBuilder()
                .setCustomId('cfg_btn_edit_welcome_msg')
                .setLabel('Editar Mensagem de Boas-Vindas')
                .setEmoji('💬')
                .setStyle(ButtonStyle.Primary),
              new ButtonBuilder().setCustomId('cfg_btn_back').setLabel('Voltar ao Painel').setStyle(ButtonStyle.Secondary)
            );

            await i.update({
              content: '📢 **Configuração de Canais Gerais:** Escolha qual canal deseja alterar:',
              embeds: [],
              components: [channelTypeMenu, welcomeMsgBtn],
            });
            return;
          }

          // --- Categoria: Cargos ---
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

          // --- Categoria: Segurança & Auto-Mod ---
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
              content: '🔒 **Configuração de Segurança:** Clique nos botões para ligar ou desligar as proteções:',
              embeds: [],
              components: [toggleButtons],
            });
            return;
          }

          // --- Categoria: Módulos do Bot ---
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
              content: '🧩 **Ativação de Módulos:** Selecione um sistema para alternar seu estado:',
              embeds: [],
              components: [moduleSelect, backRow],
            });
            return;
          }
        }

        // ==========================================
        // 2. MODAL DE XP (Leveling / RPG)
        // ==========================================
        if (i.customId === 'cfg_btn_edit_xp_modal' && i.isButton()) {
          const modal = new ModalBuilder()
            .setCustomId('modal_set_xp_values')
            .setTitle('⚙️ Configuração de XP do Servidor');

          const minInput = new TextInputBuilder()
            .setCustomId('xp_min_val')
            .setLabel('XP Mínimo por Mensagem')
            .setValue(String(cfg.xpMin))
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          const maxInput = new TextInputBuilder()
            .setCustomId('xp_max_val')
            .setLabel('XP Máximo por Mensagem')
            .setValue(String(cfg.xpMax))
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          const cooldownInput = new TextInputBuilder()
            .setCustomId('xp_cooldown_val')
            .setLabel('Tempo de Cooldown em Segundos')
            .setValue(String(cfg.xpCooldown))
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          modal.addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(minInput),
            new ActionRowBuilder<TextInputBuilder>().addComponents(maxInput),
            new ActionRowBuilder<TextInputBuilder>().addComponents(cooldownInput)
          );

          await i.showModal(modal);

          const submitted = await i.awaitModalSubmit({
            time: 60000,
            filter: (sub) => sub.customId === 'modal_set_xp_values' && sub.user.id === interaction.user.id,
          }).catch(() => null);

          if (submitted) {
            const min = parseInt(submitted.fields.getTextInputValue('xp_min_val'), 10) || 15;
            const max = parseInt(submitted.fields.getTextInputValue('xp_max_val'), 10) || 25;
            const cd = parseInt(submitted.fields.getTextInputValue('xp_cooldown_val'), 10) || 60;

            cfg = await prisma.guildConfig.update({
              where: { guildId },
              data: { xpMin: min, xpMax: max, xpCooldown: cd },
            });

            await submitted.update({
              content: `✅ Valores de XP atualizados: **${min}~${max} XP** a cada **${cd}s**.`,
              embeds: [buildMainEmbed(cfg)],
              components: [buildMainMenuRow()],
            });
          }
          return;
        }

        // ==========================================
        // 3. MODAL DE BOAS-VINDAS
        // ==========================================
        if (i.customId === 'cfg_btn_edit_welcome_msg' && i.isButton()) {
          const modal = new ModalBuilder()
            .setCustomId('modal_set_welcome_msg')
            .setTitle('👋 Mensagem de Boas-Vindas');

          const textInput = new TextInputBuilder()
            .setCustomId('welcome_text_val')
            .setLabel('Mensagem (Use {user} e {guild})')
            .setValue(cfg.welcomeMessage || 'Olá {user}, seja muito bem-vindo(a) ao {guild}!')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true);

          modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(textInput));

          await i.showModal(modal);

          const submitted = await i.awaitModalSubmit({
            time: 60000,
            filter: (sub) => sub.customId === 'modal_set_welcome_msg' && sub.user.id === interaction.user.id,
          }).catch(() => null);

          if (submitted) {
            const msg = submitted.fields.getTextInputValue('welcome_text_val');

            cfg = await prisma.guildConfig.update({
              where: { guildId },
              data: { welcomeMessage: msg },
            });

            await submitted.update({
              content: '✅ Mensagem de boas-vindas atualizada com sucesso!',
              embeds: [buildMainEmbed(cfg)],
              components: [buildMainMenuRow()],
            });
          }
          return;
        }

        // ==========================================
        // 4. EXIBIR SELETOR DE CANAIS
        // ==========================================
        if (i.customId === 'cfg_select_chan_type' && i.isStringSelectMenu()) {
          const channelKey = i.values[0];

          const channelPicker = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
            new ChannelSelectMenuBuilder()
              .setCustomId(`cfg_set_chan_${channelKey}`)
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
        // 5. EXIBIR SELETOR DE CARGOS
        // ==========================================
        if (i.customId === 'cfg_select_role_type' && i.isStringSelectMenu()) {
          const roleKey = i.values[0];

          const rolePicker = new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(
            new RoleSelectMenuBuilder()
              .setCustomId(`cfg_set_role_${roleKey}`)
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
        // 6. APLICAÇÃO E SEGURANÇA DE CANAIS / CATEGORIAS
        // ==========================================
        if (i.customId.startsWith('cfg_set_chan_') && i.isChannelSelectMenu()) {
          const channelField = i.customId.replace('cfg_set_chan_', '');
          const chosenChannelId = i.values[0];

          // Segurança: Verifica permissão do bot no canal de texto selecionado
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
        // 7. APLICAÇÃO E SEGURANÇA DE CARGOS
        // ==========================================
        if (i.customId.startsWith('cfg_set_role_') && i.isRoleSelectMenu()) {
          const roleField = i.customId.replace('cfg_set_role_', '');
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
        // 8. ALTERNAÇÃO DE MÓDULOS (FEATURES)
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
        // 9. TOGGLES DE SEGURANÇA (Anti-Spam / Anti-Links)
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
            content: '🔒 **Configuração de Segurança:** Clique nos botões para ligar ou desligar as proteções:',
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
            content: '🔒 **Configuração de Segurança:** Clique nos botões para ligar ou desligar as proteções:',
            components: [toggleButtons],
          });
          return;
        }

        // ==========================================
        // 10. RESETAR / LIMPAR CAMPO
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
        // 11. VOLTAR AO MENU PRINCIPAL
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
        // Ignora se a mensagem já foi apagada
      }
    });
  },
} satisfies Command;

// ─── Helpers exportados para compatibilidade com o configHandler.ts ─────────

export function buildConfigEmbed(cfg: BotConfigData, editor?: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(cfg.primaryColor)
    .setTitle('⚙️ Configuração de Embeds')
    .setDescription(
      'Personalize a aparência dos embeds do bot em todos os servidores.\n' +
      'As mudanças valem imediatamente para novos embeds gerados.',
    )
    .addFields(
      { name: '📝 Rodapé Padrão',  value: `\`${cfg.footerText}\``,            inline: false },
      { name: '🎨 Cor Principal',  value: `\`${intToHex(cfg.primaryColor)}\``, inline: true  },
      { name: '🖼️ Ícone do Bot',   value: cfg.botIconUrl ? `[Ver link](${cfg.botIconUrl})` : '_Não definido_', inline: true },
      { name: '📜 Rodapé do /rp',  value: `\`${cfg.rpFooterText}\``,           inline: false },
    )
    .setThumbnail(cfg.botIconUrl ?? null)
    .setFooter({ text: editor ? `Última edição por ${editor}` : cfg.footerText })
    .setTimestamp();
}

export function buildConfigRows(): ActionRowBuilder<ButtonBuilder>[] {
  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('embedcfg:footer')  .setLabel('Rodapé Padrão').setEmoji('📝').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('embedcfg:color')   .setLabel('Cor Principal') .setEmoji('🎨').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('embedcfg:icon')    .setLabel('Ícone do Bot')  .setEmoji('🖼️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('embedcfg:rpfooter').setLabel('Rodapé /rp')    .setEmoji('📜').setStyle(ButtonStyle.Secondary),
  );
  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('embedcfg:reset')  .setLabel('Restaurar Padrões').setEmoji('↩️').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('embedcfg:refresh').setLabel('Atualizar')         .setEmoji('🔄').setStyle(ButtonStyle.Primary),
  );
  return [row1, row2];
}
