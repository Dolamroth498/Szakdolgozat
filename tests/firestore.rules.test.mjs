import { readFile } from 'node:fs/promises';
import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';

const projectId = 'demo-svindli-rules';
const profilePath = uid => `users/${uid}`;
let testEnvironment;

const profile = email => ({
  name: 'Test Player',
  email,
  backgrounds: ['felt-green'],
  cardBacks: ['back-red'],
  coins: 0,
  points: 0,
  wins: 0,
  draws: 0,
  gamesPlayed: 0,
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
});

before(async () => {
  const rules = await readFile(new URL('../firestore.rules', import.meta.url), 'utf8');
  testEnvironment = await initializeTestEnvironment({
    projectId,
    firestore: {
      host: '127.0.0.1',
      port: 8080,
      rules,
    },
  });
});

beforeEach(async () => {
  await testEnvironment.clearFirestore();
});

after(async () => {
  await testEnvironment?.cleanup();
});

describe('Firestore user profile rules', () => {
  it('allows an authenticated user to create their own valid profile', async () => {
    const db = testEnvironment.authenticatedContext('alice', {
      email: 'alice@example.com',
    }).firestore();

    await assertSucceeds(setDoc(doc(db, profilePath('alice')), profile('alice@example.com')));
  });

  it('denies creating a profile under another user ID', async () => {
    const db = testEnvironment.authenticatedContext('bob', {
      email: 'bob@example.com',
    }).firestore();

    await assertFails(setDoc(doc(db, profilePath('alice')), profile('bob@example.com')));
  });

  it('denies invalid profiles and fields outside the allowed schema', async () => {
    const db = testEnvironment.authenticatedContext('alice', {
      email: 'alice@example.com',
    }).firestore();

    await assertFails(setDoc(
      doc(db, profilePath('alice')),
      profile('someone-else@example.com')
    ));
    await assertFails(setDoc(doc(db, profilePath('alice')), {
      ...profile('alice@example.com'),
      backgrounds: ['winter'],
    }));
    await assertFails(setDoc(doc(db, profilePath('alice')), {
      ...profile('alice@example.com'),
      balance: 1000,
    }));
    await assertFails(setDoc(doc(db, profilePath('alice')), {
      ...profile('alice@example.com'),
      name: '',
    }));
    await assertFails(setDoc(doc(db, profilePath('alice')), {
      ...profile('alice@example.com'),
      name: 'A'.repeat(51),
    }));
  });

  it('allows a user to read their own profile', async () => {
    await testEnvironment.withSecurityRulesDisabled(async context => {
      await setDoc(doc(context.firestore(), profilePath('alice')), {
        name: 'Alice',
        email: 'alice@example.com',
        backgrounds: [],
        cardBacks: [],
        coins: 0,
        points: 0,
        wins: 0,
        draws: 0,
        gamesPlayed: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });

    const db = testEnvironment.authenticatedContext('alice', {
      email: 'alice@example.com',
    }).firestore();
    await assertSucceeds(getDoc(doc(db, profilePath('alice'))));
  });

  it('denies reading another user profile', async () => {
    await testEnvironment.withSecurityRulesDisabled(async context => {
      await setDoc(doc(context.firestore(), profilePath('alice')), {
        name: 'Alice',
        email: 'alice@example.com',
        backgrounds: [],
        cardBacks: [],
        coins: 0,
        points: 0,
        wins: 0,
        draws: 0,
        gamesPlayed: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });

    const db = testEnvironment.authenticatedContext('bob', {
      email: 'bob@example.com',
    }).firestore();
    await assertFails(getDoc(doc(db, profilePath('alice'))));
  });

  it('denies another user from updating a profile', async () => {
    await testEnvironment.withSecurityRulesDisabled(async context => {
      await setDoc(doc(context.firestore(), profilePath('alice')), {
        name: 'Alice',
        email: 'alice@example.com',
        backgrounds: [],
        cardBacks: [],
        coins: 0,
        points: 0,
        wins: 0,
        draws: 0,
        gamesPlayed: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });

    const db = testEnvironment.authenticatedContext('bob', {
      email: 'bob@example.com',
    }).firestore();
    await assertFails(updateDoc(doc(db, profilePath('alice')), {
      name: 'Changed by Bob',
      updatedAt: serverTimestamp(),
    }));
  });

  it('denies unauthenticated profile reads and writes', async () => {
    const db = testEnvironment.unauthenticatedContext().firestore();

    await assertFails(getDoc(doc(db, profilePath('alice'))));
    await assertFails(setDoc(doc(db, profilePath('alice')), profile('alice@example.com')));
  });

  it('denies profile listing', async () => {
    const db = testEnvironment.authenticatedContext('alice', {
      email: 'alice@example.com',
    }).firestore();

    await assertFails(getDocs(collection(db, 'users')));
  });

  it('allows the owner to update their name only', async () => {
    await testEnvironment.withSecurityRulesDisabled(async context => {
      await setDoc(doc(context.firestore(), profilePath('alice')), {
        name: 'Alice',
        email: 'alice@example.com',
        backgrounds: [],
        cardBacks: [],
        coins: 0,
        points: 0,
        wins: 0,
        draws: 0,
        gamesPlayed: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });

    const db = testEnvironment.authenticatedContext('alice', {
      email: 'alice@example.com',
    }).firestore();
    await assertSucceeds(updateDoc(doc(db, profilePath('alice')), {
      name: 'Alice Player',
      updatedAt: serverTimestamp(),
    }));
  });

  it('allows the owner to update game statistics and cosmetic inventory, but not identity', async () => {
    await testEnvironment.withSecurityRulesDisabled(async context => {
      await setDoc(doc(context.firestore(), profilePath('alice')), {
        name: 'Alice',
        email: 'alice@example.com',
        backgrounds: [],
        cardBacks: [],
        coins: 0,
        points: 0,
        wins: 0,
        draws: 0,
        gamesPlayed: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });

    const db = testEnvironment.authenticatedContext('alice', {
      email: 'alice@example.com',
    }).firestore();
    const ref = doc(db, profilePath('alice'));

    await assertSucceeds(updateDoc(ref, {
      backgrounds: ['winter'],
      cardBacks: ['back-classic'],
      selectedBackground: 'winter',
      selectedCardBack: 'back-classic',
      updatedAt: serverTimestamp(),
    }));
    await assertFails(updateDoc(ref, {
      balance: 1000,
      updatedAt: serverTimestamp(),
    }));
    await assertSucceeds(updateDoc(ref, {
      coins: 15,
      points: 1000,
      wins: 1,
      gamesPlayed: 1,
      updatedAt: serverTimestamp(),
    }));
    await assertFails(updateDoc(ref, {
      coins: -1,
      updatedAt: serverTimestamp(),
    }));
    await assertFails(updateDoc(ref, {
      email: 'attacker@example.com',
      updatedAt: serverTimestamp(),
    }));
  });

  it('denies profile deletion', async () => {
    await testEnvironment.withSecurityRulesDisabled(async context => {
      await setDoc(doc(context.firestore(), profilePath('alice')), {
        name: 'Alice',
        email: 'alice@example.com',
        backgrounds: [],
        cardBacks: [],
        coins: 0,
        points: 0,
        wins: 0,
        draws: 0,
        gamesPlayed: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });

    const db = testEnvironment.authenticatedContext('alice', {
      email: 'alice@example.com',
    }).firestore();
    await assertFails(deleteDoc(doc(db, profilePath('alice'))));
  });
});
