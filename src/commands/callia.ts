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
import { askBryan } from '../ai/bryan';
import { askSuki } from '../ai/suki';
import {
  CalliaPersona,
  startCalliaSession,
  stopCalliaSession,
} from '../voice/calliaVoice';

export const data = new SlashCommandBuilder()
  .setName('callia')
  .setDescription('Entra na call com Bryan ou Suki');

export async function execute(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const member = interaction.member as GuildMember;
  const channel = member.voice.channel;

  if (!channel) {
    await interaction.reply({
      content: 'Você precisa estar em um canal de voz primeiro.',
      ephemeral: true,
    });
    return;
  }

  await interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(0x8b5cf6)
        .setTitle('Escolha quem vai entrar na call')
        .setDescription(
          'Escolha uma personalidade. Você pode trocar depois sem sair da call.',
        ),
    ],
    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('callia:choose:bryan')
          .setLabel('Chamar Bryan')
          .setEmoji('♂️')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('callia:choose:suki')
          .setLabel('Chamar Suki')
          .setEmoji('♀️')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('callia:stop')
          .setLabel('Encerrar')
          .setStyle(ButtonStyle.Danger),
      ),
    ],
  });
}

export async function handleCalliaButton(
  interaction: ButtonInteraction,
): Promise<boolean> {
  if (!interaction.customId.startsWith('callia:')) {
    return false;
  }

  const [, action, persona] = interaction.customId.split(':');

  if (!interaction.guildId) {
    await interaction.reply({
      content: 'Este comando só funciona dentro de um servidor.',
      ephemeral: true,
    });
    return true;
  }

  if (action === 'stop') {
    const stopped = stopCalliaSession(interaction.guildId);
    await interaction.update({
      content: stopped
        ? 'Call de IA encerrada.'
        : 'Não havia uma call de IA ativa.',
      embeds: [],
      components: [],
    });
    return true;
  }

  if (action !== 'choose' || (persona !== 'bryan' && persona !== 'suki')) {
    return true;
  }

  const member = interaction.member as GuildMember;
  const channel = member.voice.channel;

  if (!channel) {
    await interaction.reply({
      content: 'Entre em um canal de voz para chamar a IA.',
      ephemeral: true,
    });
    return true;
  }

  const selected = persona as CalliaPersona;
  const label = selected === 'bryan' ? 'Bryan' : 'Suki';

  const musicQueue = useQueue(interaction.guildId);
  musicQueue?.delete();

  startCalliaSession({
    member,
    channel,
    persona: selected,
    ai: { askBryan, askSuki },
    onStatus: async (message) => {
      await interaction
        .editReply({ content: `**${label}:** ${message}` })
        .catch(() => {});
    },
  });

  await interaction.update({
    content: `**${label}** entrou na call. Fale normalmente; só vou processar a sua voz.`,
    embeds: [],
    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('callia:choose:bryan')
          .setLabel('Trocar para Bryan')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('callia:choose:suki')
          .setLabel('Trocar para Suki')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('callia:stop')
          .setLabel('Encerrar')
          .setStyle(ButtonStyle.Danger),
      ),
    ],
  });

  return true;
}
