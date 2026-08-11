import {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder,
  TextInputBuilder, TextInputStyle,
} from 'discord.js';
import { prisma } from '../../database/client';
import { FullCharacter } from '../services/character';

export function buildGuildMenuEmbed(char: FullCharacter): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0x9B59B6)
    .setTitle('🏛️ Sistema de Guilda RPG')
    .setDescription('Junte-se a uma guilda para batalhar junto, compartilhar recursos e dominar as dungeons!')
    .addFields(
      { name: '🆕 Criar Guilda', value: 'Funde sua própria guilda com tag e emblema únicos', inline: true },
      { name: '🔍 Buscar Guilda', value: 'Procure e entre em uma guilda existente', inline: true },
      { name: '📋 Minha Guilda', value: 'Veja info e gerencie sua guilda atual', inline: true },
    )
    .setFooter({ text: '⚔️ Aliança Skyline RPG — Guilds' });
}

export function buildGuildMenuButtons(hasMembership: boolean): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    ...(hasMembership ? [
      new ButtonBuilder().setCustomId('rpg:guild_info').setLabel('📋 Minha Guilda').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('rpg:guild_sair').setLabel('🚪 Sair da Guilda').setStyle(ButtonStyle.Danger),
    ] : [
      new ButtonBuilder().setCustomId('rpg:guild_criar').setLabel('🆕 Criar Guilda').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('rpg:guild_buscar').setLabel('🔍 Buscar Guilds').setStyle(ButtonStyle.Primary),
    ]),
    new ButtonBuilder().setCustomId('rpg:cidade').setLabel('◀ Voltar à Cidade').setStyle(ButtonStyle.Secondary),
  );
}

/** Botões exibidos na tela de info da guilda — líderes/vice-líderes veem botões de gestão e alternador Aberta/Fechada */
export function buildGuildInfoButtons(role: string, isOpen: boolean = true): ActionRowBuilder<ButtonBuilder>[] {
  const isManager = role === 'Líder' || role === 'Vice-Líder';
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];

  if (isManager) {
    rows.push(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('rpg:guild_config').setLabel('⚙️ Configurar').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('rpg:guild_anuncio').setLabel('📢 Aviso').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('rpg:guild_depositar').setLabel('💰 Depositar Ouro').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('rpg:guild_convidar').setLabel('✉️ Convidar').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('rpg:guild_toggle_open').setLabel(isOpen ? '🔓 Aberta' : '🔒 Fechada').setStyle(isOpen ? ButtonStyle.Success : ButtonStyle.Danger),
      ),
    );
  }

  rows.push(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('rpg:guild_info').setLabel('🔄 Atualizar').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('rpg:guild_sair').setLabel('🚪 Sair da Guilda').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('rpg:guild').setLabel('◀ Voltar').setStyle(ButtonStyle.Secondary),
    ),
  );

  return rows;
}

export function guildConfigModal(): ModalBuilder {
  const modal = new ModalBuilder().setCustomId('rpg_modal:guild_config').setTitle('Configurar Guilda');
  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId('nome').setLabel('Novo Nome (deixe em branco para manter)').setStyle(TextInputStyle.Short).setRequired(false).setMinLength(3).setMaxLength(30),
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId('descricao').setLabel('Nova Descrição').setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(200),
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId('emblema').setLabel('Novo Emblema (1 emoji)').setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(4),
    ),
  );
  return modal;
}

export function guildConvidarModal(): ModalBuilder {
  const modal = new ModalBuilder().setCustomId('rpg_modal:guild_convidar').setTitle('Convidar para a Guilda');
  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId('alvo_id')
        .setLabel('ID ou Menção do Usuário no Discord')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setPlaceholder('Ex: 123456789012345678'),
    ),
  );
  return modal;
}

export function guildDepositarModal(): ModalBuilder {
  const modal = new ModalBuilder().setCustomId('rpg_modal:guild_depositar').setTitle('Depositar Ouro na Guilda');
  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId('quantidade')
        .setLabel('Quantidade de Ouro a Depositar')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setPlaceholder('Ex: 500'),
    ),
  );
  return modal;
}

export function guildAnuncioModal(): ModalBuilder {
  const modal = new ModalBuilder().setCustomId('rpg_modal:guild_anuncio').setTitle('Definir Aviso da Guilda');
  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId('aviso')
        .setLabel('Mensagem de Aviso (deixe em branco para limpar)')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(false)
        .setMaxLength(300),
    ),
  );
  return modal;
}

export async function buildGuildInfoEmbed(guildId: string): Promise<EmbedBuilder> {
  const guild = await prisma.rpgGuild.findUnique({
    where: { id: guildId },
    include: { members: { include: { character: true } } },
  });

  if (!guild) {
    return new EmbedBuilder().setColor(0xE74C3C).setDescription('Guilda não encontrada.');
  }

  const memberLines = guild.members
    .sort((a, b) => {
      const order = ['Líder', 'Vice-Líder', 'Oficial', 'Membro'];
      return order.indexOf(a.role) - order.indexOf(b.role);
    })
    .slice(0, 15)
    .map(m => {
      if (!m.character) return null;
      const roleEmoji = m.role === 'Líder' ? '👑' : m.role === 'Vice-Líder' ? '⭐' : m.role === 'Oficial' ? '🛡️' : '👤';
      return `${roleEmoji} **${m.character.username}** — Lv.${m.character.level} ${m.character.class}`;
    })
    .filter(Boolean)
    .join('\n');

  const isOpen = (guild as any).isOpen ?? true;

  return new EmbedBuilder()
    .setColor(0x9B59B6)
    .setTitle(`${guild.emblem} Guilda: ${guild.name} [${guild.tag}]`)
    .setDescription(guild.description ?? '*Sem descrição.*')
    .addFields(
      { name: '📊 Nível da Guilda', value: `**${guild.level}**`, inline: true },
      { name: '💰 Ouro da Guilda', value: `**${guild.gold.toLocaleString('pt-BR')}**`, inline: true },
      { name: '👥 Membros', value: `**${guild.members.length}/${guild.maxMembers}**`, inline: true },
      { name: '🚪 Tipo de Entrada', value: isOpen ? '🔓 **Aberta** (qualquer um pode entrar)' : '🔒 **Fechada** (requer convite)', inline: true },
      { name: '📋 Membros', value: memberLines || '*Sem membros*', inline: false },
      ...(guild.announcement ? [{ name: '📢 Aviso', value: guild.announcement, inline: false }] : []),
    )
    .setFooter({ text: `⚔️ Fundada por ${guild.members.find(m => m.role === 'Líder')?.character?.username ?? '?'}` });
}

export async function buildGuildListEmbed(): Promise<EmbedBuilder> {
  const guilds = await prisma.rpgGuild.findMany({
    include: { members: true },
    orderBy: { level: 'desc' },
    take: 10,
  });

  const lines = guilds.map((g, i) => {
    const isOpen = (g as any).isOpen ?? true;
    const statusTag = isOpen ? '🔓 Aberta' : '🔒 Fechada';
    return `**${i + 1}.** ${g.emblem} **${g.name}** [${g.tag}] — Nv.${g.level} | ${g.members.length}/${g.maxMembers} membros | ${statusTag}`;
  }).join('\n') || '*Nenhuma guilda criada ainda. Seja o primeiro!*';

  return new EmbedBuilder()
    .setColor(0x9B59B6)
    .setTitle('🏛️ Top Guilds')
    .setDescription(lines)
    .setFooter({ text: 'Guildas Abertas permitem entrada direta pelo menu!' });
}

export function criarGuildaModal(): ModalBuilder {
  const modal = new ModalBuilder().setCustomId('rpg_modal:guild_criar').setTitle('Criar Guilda');
  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId('nome').setLabel('Nome da Guilda').setStyle(TextInputStyle.Short).setRequired(true).setMinLength(3).setMaxLength(30),
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId('tag').setLabel('Tag (3-5 letras)').setStyle(TextInputStyle.Short).setRequired(true).setMinLength(2).setMaxLength(5),
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId('descricao').setLabel('Descrição').setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(200),
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId('emblema').setLabel('Emblema (1 emoji)').setStyle(TextInputStyle.Short).setRequired(false).setPlaceholder('⚔️').setMaxLength(4),
    ),
  );
  return modal;
}

export async function createGuild(
  discordId: string, nome: string, tag: string, descricao: string, emblema: string,
): Promise<{ success: boolean; message: string }> {
  const existing = await prisma.rpgGuildMember.findUnique({ where: { characterId: discordId } });
  if (existing) return { success: false, message: 'Você já faz parte de uma guilda. Saia primeiro.' };

  const tagUpper = tag.toUpperCase();
  const nameExists = await prisma.rpgGuild.findFirst({ where: { OR: [{ name: nome }, { tag: tagUpper }] } });
  if (nameExists) return { success: false, message: 'Já existe uma guilda com esse nome ou tag.' };

  await prisma.rpgGuild.create({
    data: {
      name: nome, tag: tagUpper,
      description: descricao || null,
      leaderId: discordId,
      emblem: emblema || '⚔️',
      members: { create: { characterId: discordId, role: 'Líder' } },
    },
  });
  return { success: true, message: `${emblema || '⚔️'} Guilda **${nome}** [${tagUpper}] criada com sucesso!` };
}

export async function toggleGuildOpen(discordId: string): Promise<{ success: boolean; message: string; isOpen?: boolean }> {
  const membership = await prisma.rpgGuildMember.findUnique({ where: { characterId: discordId }, include: { guild: true } });
  if (!membership || (membership.role !== 'Líder' && membership.role !== 'Vice-Líder')) {
    return { success: false, message: 'Apenas Líderes ou Vice-Líderes podem alterar as permissões de entrada.' };
  }

  const currentStatus = (membership.guild as any).isOpen ?? true;
  const newStatus = !currentStatus;

  await prisma.rpgGuild.update({
    where: { id: membership.guildId },
    data: { isOpen: newStatus } as any,
  });

  return {
    success: true,
    isOpen: newStatus,
    message: newStatus ? '🔓 Sua guilda agora está **ABERTA** para novos membros.' : '🔒 Sua guilda agora está **FECHADA** (somente via convite).',
  };
}

export async function inviteToGuild(inviterId: string, targetId: string): Promise<{ success: boolean; message: string }> {
  const membership = await prisma.rpgGuildMember.findUnique({ where: { characterId: inviterId }, include: { guild: true } });
  if (!membership || (membership.role !== 'Líder' && membership.role !== 'Vice-Líder')) {
    return { success: false, message: 'Apenas Líderes ou Vice-Líderes podem convidar jogadores.' };
  }

  const targetMembership = await prisma.rpgGuildMember.findUnique({ where: { characterId: targetId } });
  if (targetMembership) {
    return { success: false, message: 'Este jogador já faz parte de uma guilda.' };
  }

  const guild = await prisma.rpgGuild.findUnique({ where: { id: membership.guildId }, include: { members: true } });
  if (!guild) return { success: false, message: 'Guilda não encontrada.' };
  if (guild.members.length >= guild.maxMembers) return { success: false, message: 'A guilda atingiu o limite de membros!' };

  await prisma.rpgGuildMember.create({ data: { characterId: targetId, guildId: membership.guildId, role: 'Membro' } });
  return { success: true, message: `✉️ <@${targetId}> foi convidado e adicionado à guilda **${guild.emblem} ${guild.name}** com sucesso!` };
}

export async function joinGuild(discordId: string, guildId: string): Promise<{ success: boolean; message: string }> {
  const existing = await prisma.rpgGuildMember.findUnique({ where: { characterId: discordId } });
  if (existing) return { success: false, message: 'Você já faz parte de uma guilda.' };

  const guild = await prisma.rpgGuild.findUnique({ where: { id: guildId }, include: { members: true } });
  if (!guild) return { success: false, message: 'Guilda não encontrada.' };
  if (guild.members.length >= guild.maxMembers) return { success: false, message: 'Guilda está cheia!' };

  const isOpen = (guild as any).isOpen ?? true;
  if (!isOpen) {
    return { success: false, message: '🔒 Esta guilda é **FECHADA** e requer um convite de um Líder ou Vice-Líder para entrar.' };
  }

  await prisma.rpgGuildMember.create({ data: { characterId: discordId, guildId } });
  return { success: true, message: `✅ Você entrou na guilda **${guild.emblem} ${guild.name}**!` };
}

export async function leaveGuild(discordId: string): Promise<{ success: boolean; message: string }> {
  const membership = await prisma.rpgGuildMember.findUnique({ where: { characterId: discordId }, include: { guild: true } });
  if (!membership) return { success: false, message: 'Você não faz parte de nenhuma guilda.' };

  if (membership.role === 'Líder') {
    const others = await prisma.rpgGuildMember.findMany({ where: { guildId: membership.guildId, characterId: { not: discordId } } });
    if (others.length > 0) {
      await prisma.rpgGuildMember.update({ where: { id: others[0].id }, data: { role: 'Líder' } });
    } else {
      await prisma.rpgGuild.delete({ where: { id: membership.guildId } });
      return { success: true, message: '✅ Guilda dissolvida (você era o único membro).' };
    }
  }

  await prisma.rpgGuildMember.delete({ where: { characterId: discordId } });
  return { success: true, message: `✅ Você saiu da guilda **${membership.guild.name}**.` };
}
