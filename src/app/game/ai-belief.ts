import { Card } from './card.model';
import {
  AiCardBelief,
  AiPlayerBelief,
} from './game.state.model';
import { Player } from './game.player.model';

const UNOBSERVED_LOCATION = '__unobserved__';
const PROBABILITY_EPSILON = 1e-9;

function cardKey(card: Card): string {
  return `${card.suit}:${card.value}`;
}

function getLocationProbability(
  belief: AiCardBelief,
  playerId: string
): number {
  return belief.locations.find(location => location.playerId === playerId)
    ?.probability ?? 0;
}

function setLocationProbability(
  belief: AiCardBelief,
  playerId: string,
  probability: number
): void {
  let location = belief.locations.find(item => item.playerId === playerId);
  if (!location) {
    location = { playerId, probability: 0 };
    belief.locations.push(location);
  }
  location.probability = probability;
}

export function createAiBeliefs(
  players: Player[],
  deck: Card[],
  discardCount = 0
): AiPlayerBelief[] {
  return players
    .filter(player => player.isAI)
    .map(observer => {
      const unknownCount = deck.length - observer.cards.length;
      const locations = players
        .filter(player => player.id !== observer.id)
        .map(player => ({
          playerId: player.id,
          count: player.cards.length,
        }));
      const otherKnownCount = locations.reduce(
        (total, location) => total + location.count,
        0
      );
      const remainingDiscardCount = Math.max(
        0,
        Math.min(discardCount, unknownCount - otherKnownCount)
      );
      const unobservedCount = Math.max(
        0,
        unknownCount - otherKnownCount - remainingDiscardCount
      );
      const remainingCount =
        otherKnownCount + remainingDiscardCount + unobservedCount;

      const cards = deck.map(card => {
        const knownInOwnHand = observer.cards.some(
          ownCard => cardKey(ownCard) === cardKey(card)
        );
        if (knownInOwnHand) {
          return {
            card: { ...card },
            locations: players.map(player => ({
              playerId: player.id,
              probability: player.id === observer.id ? 1 : 0,
            })),
            discardProbability: 0,
          };
        }

        return {
          card: { ...card },
          locations: [
            ...players.map(player => {
              const location = locations.find(
                item => item.playerId === player.id
              );
              return {
                playerId: player.id,
                probability:
                  remainingCount > 0
                    ? (location?.count ?? 0) / remainingCount
                    : 0,
              };
            }),
            {
              playerId: UNOBSERVED_LOCATION,
              probability:
                remainingCount > 0 ? unobservedCount / remainingCount : 0,
            },
          ],
          discardProbability:
            remainingCount > 0 ? remainingDiscardCount / remainingCount : 0,
        };
      });

      return {
        playerId: observer.id,
        cards,
        lastMoveCardProbabilities: [],
      };
    });
}

function allocateMoveProbabilities(
  cards: AiCardBelief[],
  actorId: string,
  declaredValue: string
): number[] {
  const capacities = cards.map(card =>
    getLocationProbability(card, actorId)
  );
  const weights = cards.map((card, index) =>
    capacities[index] * (card.card.value === declaredValue ? 4 : 1)
  );
  const allocated = cards.map(() => 0);
  let remaining = 1;
  let active = cards
    .map((_, index) => index)
    .filter(index => capacities[index] > PROBABILITY_EPSILON);

  while (remaining > PROBABILITY_EPSILON && active.length > 0) {
    const totalWeight = active.reduce(
      (total, index) => total + weights[index],
      0
    );
    if (totalWeight <= PROBABILITY_EPSILON) {
      break;
    }

    const capped = active.filter(
      index =>
        (remaining * weights[index]) / totalWeight >=
        capacities[index] - allocated[index] - PROBABILITY_EPSILON
    );
    if (capped.length === 0) {
      for (const index of active) {
        allocated[index] += (remaining * weights[index]) / totalWeight;
      }
      remaining = 0;
      break;
    }

    for (const index of capped) {
      const available = capacities[index] - allocated[index];
      allocated[index] += available;
      remaining -= available;
    }
    active = active.filter(index => !capped.includes(index));
  }

  return allocated;
}

export function observeAiMove(
  beliefs: AiPlayerBelief[],
  actorId: string,
  playedCard: Card,
  declaredValue: string
): void {
  const playedKey = cardKey(playedCard);

  for (const belief of beliefs) {
    let moveProbabilities: number[];
    if (belief.playerId === actorId) {
      moveProbabilities = belief.cards.map(card =>
        cardKey(card.card) === playedKey ? 1 : 0
      );
    } else {
      moveProbabilities = allocateMoveProbabilities(
        belief.cards,
        actorId,
        declaredValue
      );
    }

    belief.lastMoveCardProbabilities = belief.cards.map((card, index) => ({
      card: card.card,
      probability: moveProbabilities[index],
    }));

    belief.cards.forEach((card, index) => {
      const movedProbability = moveProbabilities[index];
      if (movedProbability <= 0) {
        return;
      }

      const actorProbability = getLocationProbability(card, actorId);
      setLocationProbability(
        card,
        actorId,
        Math.max(0, actorProbability - movedProbability)
      );
      card.discardProbability += movedProbability;
    });
  }
}

export function revealAiMove(
  beliefs: AiPlayerBelief[],
  actorId: string,
  revealedCards: Card[]
): void {
  const revealedKeys = new Set(revealedCards.map(cardKey));

  for (const belief of beliefs) {
    for (const card of belief.cards) {
      const revealed = revealedKeys.has(cardKey(card.card));
      const moveProbability =
        belief.lastMoveCardProbabilities.find(
          move => cardKey(move.card) === cardKey(card.card)
        )?.probability ?? 0;

      if (revealed) {
        card.locations = card.locations.map(location => ({
          ...location,
          probability: 0,
        }));
        card.discardProbability = 1;
        continue;
      }

      if (moveProbability > 0) {
        const actorProbability = getLocationProbability(card, actorId);
        setLocationProbability(
          card,
          actorId,
          Math.min(1, actorProbability + moveProbability)
        );
        card.discardProbability = Math.max(
          0,
          card.discardProbability - moveProbability
        );
      }
    }

    belief.lastMoveCardProbabilities = revealedCards.map(card => ({
      card: { ...card },
      probability: 1 / revealedCards.length,
    }));
  }
}

export function transferAiDiscardBeliefs(
  beliefs: AiPlayerBelief[],
  recipientId: string
): void {
  for (const belief of beliefs) {
    for (const card of belief.cards) {
      const transferredProbability = card.discardProbability;
      if (transferredProbability <= 0) {
        continue;
      }

      const recipientProbability = getLocationProbability(card, recipientId);
      setLocationProbability(
        card,
        recipientId,
        recipientProbability + transferredProbability
      );
      card.discardProbability = 0;
    }
    belief.lastMoveCardProbabilities = [];
  }
}

export function getLastMoveBluffProbability(
  belief: AiPlayerBelief,
  declaredValue: string
): number {
  return belief.lastMoveCardProbabilities.reduce(
    (probability, move) =>
      probability +
      (move.card.value === declaredValue ? 0 : move.probability),
    0
  );
}
