// ═══════════════════════════════════════════════════════════════════════
      // DUNGEON CRAWLER (A Mágica da Expedição)
      // ═══════════════════════════════════════════════════════════════════════
      case 'crawl': {
        await i.deferUpdate();
        const crawlAction = param1; 
        let char = await getOrCreateCharacter(discordId, username);

        const { activeExpeditions, buildDungeonCrawlerEmbed, processRandomDungeonEvent, startExpedition, finishExpedition, doBattleRandom, doBattleEnemy, buildDungeonEmbed, buildDungeonButtons } = await import('../panels/dungeon');

        if (crawlAction === 'start') {
          const res = await startExpedition(char, char.currentLocation);
          if (!res.success) {
            await i.editReply({ embeds: [errorEmbed('Expedição Bloqueada', res.error!)], files: [], components: [] });
            return;
          }
          const { embeds, components } = buildDungeonCrawlerEmbed(char, res.run!);
          await i.editReply({ embeds, files: [], components });
          return;
        }

        const run = activeExpeditions.get(discordId);
        if (!run) {
          await i.editReply({ embeds: [errorEmbed('Expedição Perdida', 'Sua expedição acabou ou foi cancelada.')], files: [], components: [buildDungeonButtons(char)] });
          return;
        }

        if (crawlAction === 'flee') {
          activeExpeditions.delete(discordId);
          await i.editReply({ embeds: [buildDungeonEmbed(char)], files: [], components: [buildDungeonButtons(char)] });
          return;
        }

        if (crawlAction === 'continue') {
          const { embeds, components } = buildDungeonCrawlerEmbed(char, run);
          await i.editReply({ embeds, files: [], components });
          return;
        }

        if (crawlAction === 'event') {
          await processRandomDungeonEvent(char, run);
          char = await getOrCreateCharacter(discordId, username); 
          const { embeds, components } = buildDungeonCrawlerEmbed(char, run);
          await i.editReply({ embeds, files: [], components });
          return;
        }

        if (crawlAction === 'fight') {
          const { embed, rows } = await doBattleRandom(char, i.guildId ?? '', 'dungeon');
          await i.editReply({ embeds: [embed], files: [], components: rows });
          return;
        }

        if (crawlAction === 'boss') {
          const { getBossesForLocation } = await import('../constants/enemies');
          const bosses = getBossesForLocation(run.locationId, char.level);
          if (bosses.length === 0) {
            const { embed, rows } = await finishExpedition(char, run);
            activeExpeditions.delete(discordId);
            await i.editReply({ embeds: [embed], components: rows });
            return;
          }
          const boss = bosses[Math.floor(Math.random() * bosses.length)];
          const { embed, rows } = await doBattleEnemy(char, boss.id, i.guildId ?? '', 'dungeon');
          await i.editReply({ embeds: [embed], files: [], components: rows });
          return;
        }

        if (crawlAction === 'finish') {
          const { embed, rows } = await finishExpedition(char, run);
          activeExpeditions.delete(discordId);
          await i.editReply({ embeds: [embed], files: [], components: rows });
          return;
        }
        break;
      }
