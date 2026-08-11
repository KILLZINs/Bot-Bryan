import { Message, EmbedBuilder } from 'discord.js';
    import { COLORS } from '../utils/embeds';
    import { ExtendedClient } from '../types';

    export default {
    name: 'ajuda',
    description: 'Lista os comandos disponíveis via prefix',
    async execute(message: Message, _args: string[]) {
      const extClient = message.client as ExtendedClient;

      // Coleta os nomes de todos os slash commands registrados
      const slashCmds = [...(extClient.commands?.keys() ?? [])].sort();

      const embed = new EmbedBuilder()
        .setColor(COLORS.PRIMARY)
        .setTitle('📖 Comandos — Aliança Skyline')
        .setDescription(
          'Use **b** + espaço + nome do comando.\n' +
          'Todos os slash commands também funcionam com prefix!\n' +
          'Ex: `b perfil`, `b servidor`, `b ping`'
        )
        .addFields(
          {
            name: '⚡ Slash Commands disponíveis via prefix',
            value: slashCmds.length
              ? slashCmds.map(n => `\`${n}\``).join('  ')
              : 'Nenhum comando registrado ainda.',
          },
          {
            name: '🧠 Bryan (I.A.)',
            value:
              'Comece a mensagem com **Bryan** para falar com a I.A.\n' +
              'Ex: `Bryan, como entrar na aliança?`',
          },
        )
        .setFooter({ text: '⚔️ Aliança Skyline' })
        .setTimestamp();

      await message.reply({ embeds: [embed] });
    },
    };
    