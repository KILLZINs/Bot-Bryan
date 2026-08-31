import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChatInputCommandInteraction,
  EmbedBuilder,
  GuildMember,
  SlashCommandBuilder,
} from 'discord.js';
import { useQueue } from 'discord-player';
import { prisma } from '../database/client';
import { askBryan } from '../ai/bryan';
import { askSuki, isSukiAllowed } from '../ai/suki';
import { askCustomAi } from '../ai/customAi';
import { startCalliaSession, stopCalliaSession, CalliaPersona } from '../voice/calliaVoice';

const data = new SlashCommandBuilder()
  .setName('callia')
  .setDescription('Entra na call com a IA (Bryan, Suki ou Assistente do Servidor)');

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const member = interaction.member as GuildMember;
  const channel = member.voice.channel;

  if (!channel) {
    await interaction.reply({ content: '❌ Você precisa estar em um canal de voz primeiro.', ephemeral: true });
    return;
  }

  const isSuki = isSukiAllowed(interaction.guildId!);
  
  let customBotName = 'Assistente Local';
  if (!isSuki) {
    const cfg = await prisma.guildConfig.findUnique({ where: { guildId: interaction.guildId! } });
    if (cfg?.aiCustomName) customBotName = cfg.aiCustomName;
  }

  const aiButton = isSuki
    ? new ButtonBuilder().setCustomId('callia:choose:suki').setLabel('Chamar Suki').setEmoji('♀️').setStyle(ButtonStyle.Success)
    : new ButtonBuilder().setCustomId('callia:choose:custom').setLabel(`Chamar ${customBotName}`).setEmoji('🤖').setStyle(ButtonStyle.Success);

  await interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('🎙️ Escolha quem vai entrar na call')
        .setDescription('Escolha a personalidade da IA. O Bryan é o guia global da aliança.'),
    ],
    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('callia:choose:bryan').setLabel('Chamar Bryan').setEmoji('🌌').setStyle(ButtonStyle.Primary),
        aiButton,
        new ButtonBuilder().setCustomId('callia:stop').setLabel('Encerrar').setStyle(ButtonStyle.Danger),
      ),
    ],
  });
}

export async function handleCalliaButton(interaction: ButtonInteraction): Promise<boolean> {
  if (!interaction.customId.startsWith('callia:')) return false;

  const [, action, persona] = interaction.customId.split(':');

  if (!interaction.guildId) {
    await interaction.reply({ content: 'Este comando só funciona dentro de um servidor.', ephemeral: true });
    return true;
  }

  if (action === 'stop') {
    const stopped = stopCalliaSession(interaction.guildId);
    await interaction.update({
      content: stopped ? '✅ Call de IA encerrada.' : '❌ Não havia uma call de IA ativa.',
      embeds: [],
      components: [],
    });
    return true;
  }

  if (action !== 'choose') return true;

  const member = interaction.member as GuildMember;
  const channel = member.voice.channel;

  if (!channel) {
    await interaction.reply({ content: '❌ Entre em um canal de voz para chamar a IA.', ephemeral: true });
    return true;
  }

  const musicQueue = useQueue(interaction.guildId);
  musicQueue?.delete();

  const isSuki = isSukiAllowed(interaction.guildId);
  const selectedPersona = persona as CalliaPersona;
  
  let label = 'Bryan';
  if (selectedPersona === 'suki') {
    label = 'Suki';
  } else if (selectedPersona === 'custom') {
    const cfg = await prisma.guildConfig.findUnique({ where: { guildId: interaction.guildId } });
    label = cfg?.aiCustomName || 'Assistente Local';
  }

  startCalliaSession({
    member,
    channel,
    persona: selectedPersona,
    ai: { askBryan, askSuki, askCustomAi },
    onStatus: async (message) => {
      await interaction.editReply({ content: `**${label}:** ${message}` }).catch(() => {});
    },
  });

  const aiButton = isSuki
    ? new ButtonBuilder().setCustomId('callia:choose:suki').setLabel('Trocar para Suki').setStyle(ButtonStyle.Success)
    : new ButtonBuilder().setCustomId('callia:choose:custom').setLabel(`Trocar para ${label}`).setStyle(ButtonStyle.Success);

  await interaction.update({
    content: `🎙️ **${label}** entrou na call! Fale normalmente.`,
    embeds: [],
    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('callia:choose:bryan').setLabel('Trocar para Bryan').setStyle(ButtonStyle.Primary),
        aiButton,
        new ButtonBuilder().setCustomId('callia:stop').setLabel('Encerrar Call').setStyle(ButtonStyle.Danger),
      ),
    ],
  });

  return true;
}

export default {
  data,
  execute,
};
