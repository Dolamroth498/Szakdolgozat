export type StoreCategory = 'background' | 'cardBack';

export interface StoreItem {
  id: string;
  name: string;
  description: string;
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
    name: 'Klasszikus piros hátlap',
    description: 'Alapértelmezett piros hátlap a rejtett lapokhoz.',
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
    id: 'back-classic',
    name: 'Klasszikus kék',
    description: 'Kék mintás hátlap a rejtett lapokhoz.',
    category: 'cardBack',
    price: 15,
    previewClass: 'preview-back-classic',
  },
  {
    id: 'back-gold',
    name: 'Arany díszítés',
    description: 'Arany tónusú hátlap különleges mintával.',
    category: 'cardBack',
    price: 30,
    previewClass: 'preview-back-gold',
  },
];
