import { describe, expect, it } from 'vitest'
import { repartir, TUILES } from './tuiles'

describe('repartir', () => {
  it('distribue en tourniquet', () => expect(repartir([1, 2, 3, 4, 5], 2)).toEqual([[1, 3, 5], [2, 4]]))
  it('remplit toutes les colonnes en recyclant si trop peu d’éléments', () =>
    expect(repartir(['a'], 3)).toEqual([['a'], ['a'], ['a']]))
  it('liste vide : colonnes vides', () => expect(repartir([], 2)).toEqual([[], []]))
})
describe('TUILES', () => {
  it('ids uniques', () => expect(new Set(TUILES.map(t => t.id)).size).toBe(TUILES.length))
})
