import { describe, expect, it } from 'vitest'
import { avancer, copiesNecessaires, doitAvancer } from './boucle'

describe('avancer', () => {
  it('avance proportionnellement au temps', () => expect(avancer(10, 20, 0.5, 1000)).toBe(20))
  it('replie au-delà de la période', () => expect(avancer(990, 20, 1, 1000)).toBe(10))
  it('replie en marche arrière', () => expect(avancer(5, -20, 1, 1000)).toBe(985))
  it('encaisse un grand saut de temps', () => expect(avancer(0, 30, 100, 1000)).toBe(0))
  it('ne bouge pas sans période', () => expect(avancer(42, 20, 1, 0)).toBe(42))
})
describe('copiesNecessaires', () => {
  it('au moins deux copies', () => expect(copiesNecessaires(3000, 900)).toBe(2))
  it('assez de copies pour couvrir la vue plus une', () => expect(copiesNecessaires(400, 900)).toBe(4))
  it('copie vide : deux', () => expect(copiesNecessaires(0, 900)).toBe(2))
})
describe('doitAvancer', () => {
  it('suspend pendant un geste', () => expect(doitAvancer(1000, 1500)).toBe(false))
  it('reprend après le geste', () => expect(doitAvancer(1600, 1500)).toBe(true))
})
