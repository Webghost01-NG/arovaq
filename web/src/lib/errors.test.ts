import { describe, expect, it } from 'vitest';
import { friendlyError } from './errors';

describe('wallet and contract errors', () => {
  it.each([
    ['User rejected request', 'Transaction rejected in wallet. No funds moved.'],
    ['NotCharacterOwner()', 'This character is not controlled by the connected wallet.'],
    ['AlreadyRegistered()', 'This wallet or character is already registered.'],
    ['NotComplete()', 'Keep playing: the canonical best level is below your target.'],
    ['RewardsExhausted()', 'All reward slots have been claimed.'],
    ['MissingCharacter()', 'The game could not return valid character state.'],
  ])('maps %s to a useful message', (raw, message) => {
    expect(friendlyError(new Error(raw))).toBe(message);
  });
});
