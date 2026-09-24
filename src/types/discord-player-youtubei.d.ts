// O pacote `discord-player-youtubei` só publica seus tipos via um "exports"
// condicional (require/import) que o resolvedor de módulos "node" clássico
// (usado neste projeto, module: "commonjs") não sabe ler — o require em
// runtime funciona normalmente, só a checagem de tipos que não encontrava o
// arquivo .d.ts certo. Declarando o módulo aqui, soltinho (sem tipar cada
// membro), resolve isso sem precisar trocar a resolução de módulos do
// projeto inteiro (o que afetaria import/require de tudo mais).
declare module 'discord-player-youtubei' {
  import { BaseExtractor } from 'discord-player';

  export class YoutubeExtractor extends BaseExtractor<any> {
    static identifier: string;
  }
}
