// @ts-nocheck
    /**
    * messageCommandShim — cria um objeto que imita ChatInputCommandInteraction
    * a partir de uma Message, permitindo que slash commands sejam chamados via prefix.
    */

    export function createMessageShim(message, commandName, args) {
    let sentMsg = null;
    let _deferred = false;
    let _replied   = false;

    const sanitize = (opts) => {
      if (typeof opts === 'string') return opts;
      const o = { ...opts };
      delete o.ephemeral;
      delete o.fetchReply;
      delete o.flags;
      return o;
    };

    return {
      commandName,
      commandType: 1,
      type: 2,
      id: message.id,
      token: '',
      version: 1,
      appPermissions: null,
      applicationId: message.client.user?.id ?? '',
      locale: 'pt-BR',
      guildLocale: 'pt-BR',

      guild:             message.guild,
      guildId:           message.guildId,
      channel:           message.channel,
      channelId:         message.channelId,
      user:              message.author,
      member:            message.member,
      memberPermissions: message.member?.permissions ?? null,
      client:            message.client,
      createdTimestamp:  message.createdTimestamp,
      createdAt:         message.createdAt,

      get deferred() { return _deferred; },
      get replied()  { return _replied; },

      async reply(opts) {
        const payload = sanitize(opts);
        sentMsg = await message.reply(payload).catch(() => null);
        _replied = true;
        return sentMsg;
      },

      async deferReply(_opts) {
        _deferred = true;
        await message.channel.sendTyping().catch(() => null);
      },

      async editReply(opts) {
        const payload = sanitize(opts);
        if (sentMsg) return sentMsg.edit(payload).catch(() => null);
        sentMsg = await message.reply(payload).catch(() => null);
        _replied = true;
        return sentMsg;
      },

      async followUp(opts) {
        return message.channel.send(sanitize(opts)).catch(() => null);
      },

      async fetchReply() { return sentMsg; },

      isChatInputCommand:  () => true,
      isButton:            () => false,
      isModalSubmit:       () => false,
      isAnySelectMenu:     () => false,
      isRepliable:         () => true,
      inGuild:             () => !!message.guild,
      inCachedGuild:       () => !!message.guild,
      isCommand:           () => true,

      options: {
        data: [],
        resolved: null,
        _group: null,
        _subcommand: null,
        _hoistedOptions: [],
        client: message.client,

        getString(_name, _req)  { return args[0] ?? null; },
        getInteger(_name, _req) { const n = parseInt(args[0] ?? '', 10); return isNaN(n) ? null : n; },
        getNumber(_name, _req)  { const n = parseFloat(args[0] ?? ''); return isNaN(n) ? null : n; },
        getBoolean(_name, _req) { return null; },
        getUser(_name, _req)    { return message.mentions.users.first() ?? null; },
        getMember(_name, _req)  { return message.mentions.members?.first() ?? message.member ?? null; },
        getChannel(_name, _req) { return message.mentions.channels.first() ?? null; },
        getRole(_name, _req)    { return message.mentions.roles.first() ?? null; },
        getSubcommand(_req)      { return null; },
        getSubcommandGroup(_req) { return null; },
        getAttachment(_name)     { return null; },
        getFocused()             { return ''; },
      },
    };
    }
    