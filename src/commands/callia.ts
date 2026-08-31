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
import { askCustomAi } from '../ai/customAi';
import { startCalliaSession, stopCalliaSession } from '../voice/calliaVoice';

const data = new SlashCommandBuilder()
  .setName('callia')
  .setDescription('Entra na call com o Bryan ou a IA exclusiva deste servidor');

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const member = interaction.member as GuildMember;
  const channel = member.voice.channel;

  if (!channel) {
    await interaction.reply({
      content: '❌ Você precisa estar em um canal de voz primeiro.',
      ephemeral: true,
    });
    return;
  }

  // Busca o nome do Bot Local configurado no painel
  const cfg = await prisma.guildConfig.findUnique({ where: { guildId: interaction.guildId! } });
  const customBotName = cfg?.aiCustomName || 'Assistente Local';

  await interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('🎙️ Escolha quem vai entrar na call')
        .setDescription('O Bryan é global. A segunda opção é a inteligência exclusiva configurada no painel deste servidor!'),
    ],
    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('callia:choose:bryan')
          .setLabel('Chamar Bryan')
          .setEmoji('🌌')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('callia:choose:custom')
          .setLabel(`Chamar ${customBotName}`)
          .setEmoji('🤖')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('callia:stop')
          .setLabel('Encerrar Call')
          .setStyle(ButtonStyle.Danger),
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

  // Busca os dados da IA local no painel
  const cfg = await prisma.guildConfig.findUnique({ where: { guildId: interaction.guildId } });
  const customBotName = cfg?.aiCustomName || 'Assistente Local';
  
  // O "persona" no handler da sessão de voz ('bryan' ou 'custom')
  const selectedPersona = persona === 'bryan' ? 'bryan' : 'custom';
  const label = selectedPersona === 'bryan' ? 'Bryan' : customBotName;

  startCalliaSession({
    member,
    channel,
    persona: selectedPersona,
    ai: { askBryan, askCustomAi },
    onStatus: async (message) => {
      await interaction.editReply({ content: `**${label}:** ${message}` }).catch(() => {});
    },
  });

  await interaction.update({
    content: `🎙️ **${label}** conectou na call! Fale normalmente.`,
    embeds: [],
    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('callia:choose:bryan')
          .setLabel('Trocar para Bryan')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('callia:choose:custom')
          .setLabel(`Trocar para ${customBotName}`)
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('callia:stop')
          .setLabel('Encerrar Call')
          .setStyle(ButtonStyle.Danger),
      ),
    ],
  });

  return true;
}

export default {
  data,
  execute,
};
