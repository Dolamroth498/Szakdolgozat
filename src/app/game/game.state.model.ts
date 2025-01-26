import { Card } from "./card.model";
import { Player } from "./game.player.model";

export interface GameState {
    players: Player[];
    discardPile: Card[]; // Dobóhalom
    currentPlayerIndex: number;
    nextCardValue: string; // Következő elvárt kártya rangja
  }