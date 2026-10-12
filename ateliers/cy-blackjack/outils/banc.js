// Injected into the real app page (labo-salons, invite view). Drives Scene state via fiber.
window.__cyInit = async function () {
  const engine = await import('/src/lib/blackjack/engine.ts');
  const game = await import('/src/lib/blackjack/game.ts');
  const session = await import('/src/lib/casino/session.ts');
  const round = await import('/src/lib/casino/round.ts');
  const el = document.querySelector('#banc-scene').firstElementChild;
  const key = Object.keys(el).find((k) => k.startsWith('__reactFiber$'));
  let f = el[key];
  while (f && !(f.type && f.type.name === 'Scene')) f = f.return;
  if (!f) throw new Error('no Scene fiber');
  const setRoom = f.memoizedState.queue.dispatch;
  const cas = f.memoizedProps.cas;
  const C = (rank, suit) => ({ rank, suit });
  window.__cy = { engine, game, session, round, setRoom, cas, C, room: cas.room };
  return true;
};
window.__cyApply = function (roomPatch, playerPatches) {
  const cy = window.__cy;
  if (playerPatches) {
    cy.cas.players.forEach((p, i) => {
      const patch = playerPatches[p.id];
      if (patch) cy.cas.players[i] = { ...p, ...patch };
    });
  }
  cy.room = { ...cy.room, ...roomPatch };
  cy.setRoom(cy.room);
};
