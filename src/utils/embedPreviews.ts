// ════════════════════════════════════════════════════════════════════════════════
// PREVIEWS DOS EMBEDS — base estática para o painel de edição (/embeds)
//
// Cada função buildBaseEmbed(key) retorna o embed como ele aparece no bot,
// usando dados de exemplo onde há conteúdo dinâmico (avatar, membros, etc.)
// O painel de edição aplica os overrides do template por cima desta base.
// ════════════════════════════════════════════════════════════════════════════════

import { EmbedBuilder } from 'discord.js';
import { COLORS } from './embeds';

const SKYLINE_PURPLE = 0x470F78;

/**
 * Retorna o embed base (com dados de exemplo) para a chave fornecida.
 * Retorna null para chaves que não possuem applyTemplate() no código real —
 * nesses casos o painel usa o label/desc do catálogo como fallback.
 */
export function buildBaseEmbed(key: string): EmbedBuilder | null {
  switch (key) {

    // ─── Geral ──────────────────────────────────────────────────────────────────

    case 'painel':
      return new EmbedBuilder()
        .setColor(SKYLINE_PURPLE)
        .setTitle('👾 Aliança Skyline — Painel do Membro')
        .setDescription('Consulte seu perfil, progresso, economia e atividades do servidor.')
        .addFields(
          { name: '🕶️ Perfil',     value: 'Seu perfil, XP e moedas',          inline: true },
          { name: '🎚️ Nível',      value: 'Seu progresso e recompensas',        inline: true },
          { name: '♟️ Ranking',    value: 'Ranking de XP e moedas',             inline: true },
          { name: '💿 Conquistas', value: 'Suas conquistas desbloqueadas',       inline: true },
          { name: '🍙 Economia',   value: 'Saldo e transferências',             inline: true },
          { name: '🗄️ Loja',       value: 'Itens disponíveis neste servidor',   inline: true },
          { name: '🌪️ Missões',    value: 'Missões diárias e resgates',          inline: true },
          { name: '✉️ Suporte',    value: 'Ticket, sugestão e feedback',         inline: true },
          { name: '🎱 Sorteios',   value: 'Sorteios ativos',                    inline: true },
          { name: '📹 Eventos',    value: 'Eventos ativos',                     inline: true },
        )
        .setFooter({ text: '💜 Aliança Skyline • painel pessoal' })
        .setTimestamp();

    case 'welcome.channel':
      return new EmbedBuilder()
        .setColor(COLORS.PRIMARY)
        .setTitle('✨ Bem-vindo(a) à Aliança Skyline!')
        .setDescription(
          'Olá! Estamos felizes em ter você conosco. 💜\n\n' +
          '🛡️ **Aliança Skyline** — Unidos somos mais fortes.\n\n' +
          'Use `/painel` para ver tudo que o bot oferece!'
        )
        .addFields(
          { name: '👥 Membro nº',    value: '**#1.000**',           inline: true },
          { name: '📅 Conta criada', value: '*(data de criação)*',  inline: true },
        )
        .setFooter({ text: '⚔️ Aliança Skyline' })
        .setTimestamp();

    case 'welcome.dm':
      return new EmbedBuilder()
        .setColor(COLORS.PRIMARY)
        .setTitle('🌌 Bem-vindo(a) à Aliança Skyline!')
        .setDescription(
          'Olá! Você acaba de entrar em um servidor membro oficial da **Aliança Skyline**! 💜\n\n' +
          'Aqui estão todos os servidores da nossa aliança — sinta-se à vontade para conhecer cada um deles:'
        )
        .setFooter({ text: '⚔️ Aliança Skyline — Unidos somos mais fortes' })
        .setTimestamp();

    case 'levelup':
      return new EmbedBuilder()
        .setColor(COLORS.PRIMARY)
        .setTitle('🎯 Level Up!')
        .setDescription(
          'Parabéns @Usuário! Você subiu para o **Nível 10**! 🎉\n\n' +
          '`████████░░` 80 / 100 XP para o próximo nível'
        )
        .setFooter({ text: '⚔️ Aliança Skyline' })
        .setTimestamp();

    case 'rp':
      return new EmbedBuilder()
        .setColor(COLORS.PRIMARY)
        .setDescription('**@Usuário** abraçou **@Outro Usuário**!')
        .setImage('https://media.tenor.com/GCpA2vTg06IAAAAC/anime-hug.gif')
        .setFooter({ text: '⚔️ Aliança Skyline' })
        .setTimestamp();

    // ─── Aliança ────────────────────────────────────────────────────────────────

    case 'alliance.official':
      return new EmbedBuilder()
        .setColor(COLORS.PRIMARY)
        .setTitle('🌌 Aliança Skyline — Servidores Oficiais')
        .setDescription(
          '**⭐ STARLIGHT** *(1.000+ membros)*\n' +
          '┣ [Servidor Exemplo](https://discord.gg/exemplo) — 1.246 membros\n\n' +
          '*(Lista completa gerada em tempo real)*'
        )
        .addFields({
          name:  '📊 Resumo',
          value: '**1** servidor(es) • **1.246** membros totais',
          inline: false,
        })
        .setFooter({ text: '⚔️ Aliança Skyline — Unidos somos mais fortes' })
        .setTimestamp();

    // ─── Boss Mundial ────────────────────────────────────────────────────────────

    case 'worldboss.spawn':
      return new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('🐉 Boss Mundial — Dragão Ancestral [Nv.50]')
        .setDescription(
          '*Um dragão ancestral desperto das trevas profundas...*\n\n' +
          '❤️ HP: `██████████` 100.000 / 100.000\n\n' +
          '⚡ **Habilidades:** Fogo Caótico, Rugido Devastador\n\n' +
          '⏰ Expira em: <t:9999999999:R>\n' +
          '👥 Participantes: 0'
        )
        .setFooter({ text: '⚔️ Aliança Skyline • Boss Mundial' })
        .setTimestamp();

    case 'worldboss.defeated':
      return new EmbedBuilder()
        .setColor(COLORS.SUCCESS)
        .setTitle('🏆 Boss Mundial Derrotado!')
        .setDescription(
          '**Dragão Ancestral** [Nv.50] foi derrotado!\n\n' +
          '🏅 **Top Heróis** receberão recompensas bônus!\n\n' +
          '💎 Recompensas distribuídas aos **8** participantes!'
        )
        .setFooter({ text: '⚔️ Aliança Skyline • Boss Mundial' })
        .setTimestamp();

    case 'worldboss.expired':
      return new EmbedBuilder()
        .setColor(0x636E72)
        .setTitle('💨 🐉 Boss Mundial Escapou!')
        .setDescription(
          '**Dragão Ancestral** [Nv.50] escapou sem ser derrotado!\n\n' +
          '❤️ HP Restante: 50.000\n\n' +
          '*O boss retornará em breve, mais forte do que antes...*'
        )
        .setTimestamp();

    // ─── Casamento ───────────────────────────────────────────────────────────────

    case 'marriage.proposal':
      return new EmbedBuilder()
        .setColor(0xFF69B4)
        .setTitle('💍 Proposta de Casamento')
        .setDescription(
          '**@Usuário** enviou uma proposta de casamento para **@Outro Usuário**!\n\n' +
          '💌 Aceite ou recuse a proposta...'
        )
        .setFooter({ text: '⚔️ Aliança Skyline — RPG' })
        .setTimestamp();

    case 'marriage.married':
      return new EmbedBuilder()
        .setColor(0xFF69B4)
        .setTitle('💍 Sistema de Casamento')
        .setDescription(
          '💕 Casado(a) com **@Parceiro(a)**\n' +
          '📅 Unidos desde: *(data)*\n' +
          '💜 *Unidos somos mais fortes*'
        )
        .setFooter({ text: '⚔️ Aliança Skyline — RPG' })
        .setTimestamp();

    case 'marriage.divorced':
      return new EmbedBuilder()
        .setColor(0xE74C3C)
        .setTitle('💔 Confirmar Divórcio')
        .setDescription(
          '⚠️ Esta ação é **irreversível**!\n\n' +
          'Você perderá todos os benefícios do casamento.'
        )
        .setTimestamp();

    // ─── Missões ─────────────────────────────────────────────────────────────────

    case 'mission.daily.complete':
      return new EmbedBuilder()
        .setColor(COLORS.SUCCESS)
        .setTitle('📋 Missão Diária Concluída!')
        .setDescription(
          '✅ Você completou sua missão diária!\n\n' +
          '🎁 **Recompensa:** 100 moedas + 50 XP'
        )
        .setFooter({ text: '⚔️ Aliança Skyline' })
        .setTimestamp();

    case 'mission.weekly.complete':
      return new EmbedBuilder()
        .setColor(COLORS.GOLD)
        .setTitle('📆 Missão Semanal Concluída!')
        .setDescription(
          '🏆 Você completou sua missão semanal!\n\n' +
          '🎁 **Recompensa:** 500 moedas + 200 XP'
        )
        .setFooter({ text: '⚔️ Aliança Skyline' })
        .setTimestamp();

    // ─── RPG ─────────────────────────────────────────────────────────────────────

    case 'combat.victory':
      return new EmbedBuilder()
        .setColor(COLORS.SUCCESS)
        .setTitle('🏆 Vitória no Combate!')
        .setDescription(
          '**@Vencedor** derrotou **@Adversário**!\n\n' +
          '💜 +50 XP • +20 moedas'
        )
        .setFooter({ text: '⚔️ Aliança Skyline — RPG' })
        .setTimestamp();

    case 'combat.defeat':
      return new EmbedBuilder()
        .setColor(COLORS.ERROR)
        .setTitle('💀 Derrota no Combate!')
        .setDescription(
          '**@Usuário** foi derrotado em combate!\n\n' +
          '💔 Melhor sorte na próxima vez...'
        )
        .setFooter({ text: '⚔️ Aliança Skyline — RPG' })
        .setTimestamp();

    case 'combat.draw':
      return new EmbedBuilder()
        .setColor(COLORS.WARNING)
        .setTitle('💥 Empate no Combate!')
        .setDescription(
          'Combate empatado entre **@Usuário** e **@Adversário**!\n\n' +
          '⚡ Nenhum dos lados venceu...'
        )
        .setFooter({ text: '⚔️ Aliança Skyline — RPG' })
        .setTimestamp();

    case 'rpg.levelup':
      return new EmbedBuilder()
        .setColor(COLORS.PRIMARY)
        .setTitle('🌟 Level Up — RPG!')
        .setDescription(
          '⚔️ Seu personagem subiu para o **Nível 10**!\n\n' +
          '💪 Novos poderes desbloqueados!'
        )
        .setFooter({ text: '⚔️ Aliança Skyline — RPG' })
        .setTimestamp();

    case 'rpg.reincarnation':
      return new EmbedBuilder()
        .setColor(COLORS.PRIMARY)
        .setTitle('✨ Reencarnação RPG')
        .setDescription(
          '🔄 Seu personagem renasceu!\n\n' +
          '💜 Uma nova jornada começa...'
        )
        .setFooter({ text: '⚔️ Aliança Skyline — RPG' })
        .setTimestamp();

    case 'rpg.marriage.proposal':
      return new EmbedBuilder()
        .setColor(0xFF69B4)
        .setTitle('💍 Proposta de Casamento RPG')
        .setDescription(
          '**@Personagem** fez uma proposta de casamento para **@Outro**!\n\n' +
          '💌 Aceite ou recuse...'
        )
        .setFooter({ text: '⚔️ Aliança Skyline — RPG' })
        .setTimestamp();

    // ─── Tickets ─────────────────────────────────────────────────────────────────

    case 'ticket.create':
      return new EmbedBuilder()
        .setColor(COLORS.PRIMARY)
        .setTitle('🎫 Sistema de Tickets — Aliança Skyline')
        .setDescription(
          '**Precisa de ajuda ou quer falar com a equipe?**\n\n' +
          'Clique no botão abaixo para abrir um ticket. Um membro da equipe irá atendê-lo em breve.\n\n' +
          '📋 Tenha em mãos as informações necessárias para agilizar o atendimento.'
        )
        .addFields(
          { name: '🛠️ Suporte Geral', value: 'Dúvidas e problemas gerais', inline: true },
          { name: '🤝 Parceria',       value: 'Pedidos de parceria',          inline: true },
        )
        .setFooter({ text: '⚔️ Aliança Skyline • Abra apenas um ticket por vez' })
        .setTimestamp();

    case 'ticket.close':
      return new EmbedBuilder()
        .setColor(COLORS.ERROR)
        .setTitle('🔒 Ticket Fechado')
        .setDescription('Este ticket foi fechado. Obrigado pelo contato!\n\n*Transcript gerado e enviado.*')
        .setFooter({ text: '⚔️ Aliança Skyline' })
        .setTimestamp();

    case 'ticket.claim':
      return new EmbedBuilder()
        .setColor(COLORS.SUCCESS)
        .setTitle('🛡️ Ticket Assumido')
        .setDescription('**@Moderador** assumiu o atendimento deste ticket.')
        .setFooter({ text: '⚔️ Aliança Skyline' })
        .setTimestamp();

    // ─── Sorteios ────────────────────────────────────────────────────────────────

    case 'giveaway.start':
      return new EmbedBuilder()
        .setColor(COLORS.GOLD)
        .setTitle('🎁 Sorteio — Nitro Discord')
        .addFields(
          { name: '🏆 Vencedores', value: '**1**',          inline: true },
          { name: '⏰ Encerra',    value: 'em 1 hora',      inline: true },
          { name: '👑 Criado por', value: '@Organizador',   inline: true },
        )
        .setFooter({ text: '0 participantes • ⚔️ Aliança Skyline' })
        .setTimestamp();

    case 'giveaway.win':
      return new EmbedBuilder()
        .setColor(COLORS.GOLD)
        .setTitle('🎁 Sorteio Encerrado!')
        .setDescription(
          '🏆 **Prêmio:** Nitro Discord\n\n' +
          '🎉 **Vencedor(es):** @Vencedor'
        )
        .setFooter({ text: '⚔️ Aliança Skyline' })
        .setTimestamp();

    // ─── Moderação ───────────────────────────────────────────────────────────────

    case 'mod.warn':
      return new EmbedBuilder()
        .setColor(COLORS.WARNING)
        .setTitle('⚠️ Membro Advertido')
        .addFields(
          { name: 'Usuário',         value: '@Usuário (ID)',                 inline: true },
          { name: 'Moderador',       value: '@Moderador',                   inline: true },
          { name: 'Total de avisos', value: '1',                            inline: true },
          { name: 'Motivo',          value: 'Violação das regras do servidor' },
        )
        .setTimestamp();

    case 'mod.ban':
      return new EmbedBuilder()
        .setColor(COLORS.ERROR)
        .setTitle('🔨 Membro Banido')
        .addFields(
          { name: 'Usuário',   value: '@Usuário (ID)',          inline: true },
          { name: 'Moderador', value: '@Moderador',             inline: true },
          { name: 'Motivo',    value: 'Violação grave das regras' },
        )
        .setTimestamp();

    case 'mod.kick':
      return new EmbedBuilder()
        .setColor(COLORS.WARNING)
        .setTitle('🥾 Membro Expulso')
        .addFields(
          { name: 'Usuário',   value: '@Usuário (ID)',                 inline: true },
          { name: 'Moderador', value: '@Moderador',                   inline: true },
          { name: 'Motivo',    value: 'Violação das regras do servidor' },
        )
        .setTimestamp();

    // ─── Registro de Cargos ──────────────────────────────────────────────────────

    case 'selfrole.add':
      return new EmbedBuilder()
        .setColor(COLORS.SUCCESS)
        .setTitle('✅ Cargo Adicionado')
        .setDescription('O cargo **@NomeDoCargo** foi adicionado ao seu perfil!')
        .setTimestamp();

    case 'selfrole.remove':
      return new EmbedBuilder()
        .setColor(COLORS.ERROR)
        .setTitle('❌ Cargo Removido')
        .setDescription('O cargo **@NomeDoCargo** foi removido do seu perfil.')
        .setTimestamp();

    default:
      return null;
  }
}
