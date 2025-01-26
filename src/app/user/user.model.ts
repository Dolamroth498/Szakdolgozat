export interface User {
    id: string; // Egyedi azonosító
    name: string; // Felhasználó neve
    email: string; // Felhasználó email címe
    password: string; // Jelszó (jelszó tárolásakor sose tárold simán, mindig hash-eld)
    balance: number; // Pénz
    backgrounds: string[]; // Vásárolt háttér képek
    cardBacks: string[]; // Vásárolt kártya hátlapok
    leaderboardPosition: number; // Ranglista hely
    points: number; // Pontok
  }
  