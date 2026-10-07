export function friendlyError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  if (/User rejected|User denied|rejected the request/i.test(raw)) return 'Transaction rejected in wallet. No funds moved.';
  if (/insufficient funds/i.test(raw)) return 'Insufficient MON for funding or network gas.';
  if (/NotCharacterOwner|owner mismatch/i.test(raw)) return 'This character is not controlled by the connected wallet.';
  if (/AlreadyRegistered|CharacterAlreadyBound/i.test(raw)) return 'This wallet or character is already registered.';
  if (/NotComplete/i.test(raw)) return 'Keep playing: the canonical best level is below your target.';
  if (/RewardsExhausted/i.test(raw)) return 'All reward slots have been claimed.';
  if (/Expired|deadline/i.test(raw)) return 'This challenge has expired.';
  if (/AlreadyClaimed/i.test(raw)) return 'This reward has already been claimed.';
  if (/MissingCharacter|GameReadFailed|MalformedGameReturn/i.test(raw)) return 'The game could not return valid character state.';
  if (/network|fetch|HTTP request failed/i.test(raw)) return 'RPC is unavailable. Check your connection and try again.';
  return raw.split('\n')[0].slice(0, 240);
}
