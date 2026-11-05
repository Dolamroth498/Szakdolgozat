export type StoreCategory = 'background' | 'cardBack';

export interface StoreItem {
  id: string;
  name: string;
  description: string;
  creator?: string;
  category: StoreCategory;
  price: number;
  previewClass: string;
}

export const DEFAULT_BACKGROUND_ID = 'felt-green';
export const DEFAULT_CARD_BACK_ID = 'back-red';

export const STORE_ITEMS: StoreItem[] = [
  {
    id: DEFAULT_BACKGROUND_ID,
    name: 'Klasszikus zöld asztal',
    description: 'Alapértelmezett zöld játékasztal.',
    category: 'background',
    price: 0,
    previewClass: 'preview-felt-green',
  },
  {
    id: DEFAULT_CARD_BACK_ID,
    name: 'Sötétkék mintás hátlap',
    description: 'Alapértelmezett, geometrikus mintájú hátlap a rejtett lapokhoz.',
    creator: 'designed by Freepik - Magnific.com',
    category: 'cardBack',
    price: 0,
    previewClass: 'preview-back-red',
  },
  {
    id: 'felt-blue',
    name: 'Kék posztó',
    description: 'Hűvös kék árnyalatú játékasztal.',
    category: 'background',
    price: 15,
    previewClass: 'preview-felt-blue',
  },
  {
    id: 'felt-night',
    name: 'Éjszakai asztal',
    description: 'Sötét, elegáns asztal a késői partikhoz.',
    category: 'background',
    price: 30,
    previewClass: 'preview-felt-night',
  },
  {
    id: 'back-green',
    name: 'Zöld geometrikus',
    description: 'Zöld, geometrikus mintájú hátlap a rejtett lapokhoz.',
    creator: 'designed by Freepik - Magnific.com',
    category: 'cardBack',
    price: 10,
    previewClass: 'preview-back-green',
  },
  {
    id: 'back-classic',
    name: 'Kék virágmintás',
    description: 'Világoskék, virágmintás hátlap a rejtett lapokhoz.',
    creator: 'designed by Freepik - Magnific.com',
    category: 'cardBack',
    price: 10,
    previewClass: 'preview-back-classic',
  },
  {
    id: 'back-gold',
    name: 'Piros csillagmintás',
    description: 'Piros, csillagmintás hátlap a rejtett lapokhoz.',
    creator: 'designed by Freepik - Magnific.com',
    category: 'cardBack',
    price: 10,
    previewClass: 'preview-back-gold',
  },
];
