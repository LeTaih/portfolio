import { describe, expect, it } from 'vitest'
import { copiesNecessaires, replier, trajet } from './boucle'

describe('trajet', () => {
  it('monte d\'une période à la vitesse donnée', () => {
    expect(trajet(1000, 20)).toEqual({
      images: [{ transform: 'translateY(0px)' }, { transform: 'translateY(-1000px)' }],
      duree: 50_000,
    })
  })
  it('descend en vitesse négative', () => {
    expect(trajet(1000, -25)).toEqual({
      images: [{ transform: 'translateY(-1000px)' }, { transform: 'translateY(0px)' }],
      duree: 40_000,
    })
  })
})
describe('replier', () => {
  it('ramène un défilement dans la première période', () => expect(replier(2350, 1000)).toBe(350))
  it('laisse une position déjà repliée', () => expect(replier(350, 1000)).toBe(350))
  it('ne bouge pas sans période', () => expect(replier(42, 0)).toBe(42))
})
describe('copiesNecessaires', () => {
  // Le décalage de l'animation et le défilement à la main font chacun jusqu'à une période.
  it('au moins trois copies', () => expect(copiesNecessaires(3000, 900)).toBe(3))
  it('assez de copies pour couvrir la vue plus deux périodes', () => expect(copiesNecessaires(400, 900)).toBe(5))
  it('copie vide : deux', () => expect(copiesNecessaires(0, 900)).toBe(2))
})
