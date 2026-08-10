const SEEN_KEY = 'dread-majesty:tour-seen';

/**
 * Whether the first-run tour has already been walked or dismissed.
 *
 * `localStorage` rather than the save, on purpose. This is not game state: it survives
 * abdication, it has no place in a save blob, and putting it there would mean a
 * migration and a field the engine has to carry and ignore for ever. It is a note about
 * the person, not about the realm.
 *
 * A blocked or absent store reports "seen". That is the safer way to be wrong: a
 * returning player whose browser refuses storage gets no tour rather than the same tour
 * on every single visit, which is the failure they would actually notice.
 */
export function hasSeenTour(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) !== null;
  } catch {
    return true;
  }
}

export function markTourSeen(): void {
  try {
    localStorage.setItem(SEEN_KEY, '1');
  } catch {
    // Nothing to do and nothing worth saying. The tour showed; it may show again.
  }
}

/** Only the tests need this. Nothing in the game forgets a tour on purpose. */
export function forgetTour(): void {
  try {
    localStorage.removeItem(SEEN_KEY);
  } catch {
    // As above.
  }
}
