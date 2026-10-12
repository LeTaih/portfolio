// LE FAUX SERVEUR : la base du salon, en mémoire. Les stubs de lib/supabase et
// lib/identity écrivent ici ; le harnais (entree.tsx) s'y abonne comme useRoom
// s'abonne au temps réel. Rien ne part sur le réseau.
import { useLayoutEffect, useReducer } from 'react';
import type { Player, Room } from '@cy/lib/types';

export const MOI = 'p-lea';
export const CODE = 'licorne';
const DATE = '2026-10-11T20:00:00.000Z';

type Etat = { room: Room | null; players: Player[] };
let etat: Etat = { room: null, players: [] };
const abonnes = new Set<() => void>();
const publier = () => abonnes.forEach((f) => f());

export const serveur = {
  get etat() {
    return etat;
  },
  vider() {
    etat = { room: null, players: [] };
    publier();
  },
  /** applyRoom : l'écran pose sa room, comme l'écho temps réel la reposerait. */
  poserRoom(room: Room) {
    etat = { ...etat, room };
    publier();
  },
  ajouterJoueur(p: Partial<Player> & { id: string; name: string; color: string }) {
    const joueur = {
      room_code: CODE,
      is_host: false,
      can_control: false,
      joined_at: DATE,
      is_fictional: false,
      sobre: false,
      ...p,
    } as Player;
    etat = { ...etat, players: [...etat.players.filter((x) => x.id !== p.id), joueur] };
    publier();
  },
  abonner(f: () => void) {
    abonnes.add(f);
    return () => void abonnes.delete(f);
  },
};

export function salonNeuf(hote: string): Room {
  return {
    code: CODE,
    alias: null,
    host_id: hote,
    current_question: null,
    state: 'lobby',
    stats: null,
    sips_min: 1,
    sips_max: 6,
    game: 'none',
    uc: null,
    purple: null,
    cliche: null,
    ckk: null,
    pyra: null,
    blackjack: null,
    roulette: null,
    poker: null,
    navale: null,
    menteur: null,
    updated_at: DATE,
  } as unknown as Room;
}

export function useServeur(): Etat {
  const [, maj] = useReducer((n: number) => n + 1, 0);
  useLayoutEffect(() => serveur.abonner(maj), []);
  return etat;
}
