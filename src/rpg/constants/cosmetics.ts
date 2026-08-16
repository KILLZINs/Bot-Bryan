export interface CosmeticTitle {
  id: string;
  label: string;
  price: number;
}

export interface CosmeticBackground {
  id: string;
  name: string;
  url: string; // Pode ser um link de imagem ou um gradiente/cor base que vamos programar no Canvas
  price: number;
}

export const COSMETIC_TITLES: Record<string, CosmeticTitle> = {
  // Títulos Épicos de RPG
  'matador_de_deuses': { id: 'matador_de_deuses', label: 'Matador de Deuses', price: 15000 },
  'lenda_viva': { id: 'lenda_viva', label: 'Lenda Viva', price: 10000 },
  'o_inflexivel': { id: 'o_inflexivel', label: 'O Inflexível', price: 5000 },
  'senhor_do_abismo': { id: 'senhor_do_abismo', label: 'Senhor do Abismo', price: 8000 },

  // Títulos Minimalistas / Modernos (Vibe Estética)
  'vida_surreal': { id: 'vida_surreal', label: 'A vida é surreal', price: 3000 },
  'faz_sentir': { id: 'faz_sentir', label: 'Se faz sentir, faz sentido', price: 3500 },
  'cafe_coragem': { id: 'cafe_coragem', label: 'Café & coragem', price: 2000 },
  'va_viva_volte': { id: 'va_viva_volte', label: 'Vá, viva e volte', price: 4000 },
  'menos_juizo': { id: 'menos_juizo', label: 'Mais Vegas, Menos Juízo', price: 7777 },
};

export const COSMETIC_BACKGROUNDS: Record<string, CosmeticBackground> = {
  // Fundos de Fantasia Clássica
  'taverna': { id: 'taverna', name: 'Taverna Aconchegante', url: 'https://i.imgur.com/taverna.png', price: 5000 },
  'castelo': { id: 'castelo', name: 'Salão do Castelo', url: 'https://i.imgur.com/castelo.png', price: 8000 },
  
  // Paletas Minimalistas e Tons Terrosos (Sem imagem, o Canvas vai desenhar a cor)
  'terracota': { id: 'terracota', name: 'Terracota Sombria', url: 'color:#8B4513', price: 4000 },
  'areia_bege': { id: 'areia_bege', name: 'Areia & Bege', url: 'color:#D2B48C', price: 4000 },
  'off_white': { id: 'off_white', name: 'Off-White Clássico', url: 'color:#FAF9F6', price: 6000 },
};

export const TITLE_LIST = Object.values(COSMETIC_TITLES);
export const BACKGROUND_LIST = Object.values(COSMETIC_BACKGROUNDS);
