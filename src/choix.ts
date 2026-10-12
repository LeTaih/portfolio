// « Deux tables » : le bouton Jouer de Cyrose ouvre le choix entre cyrose.fr
// et alt.cyrose.fr. Sans JavaScript, le lien mène simplement à cyrose.fr.

const reduit = () => matchMedia('(prefers-reduced-motion: reduce)').matches

export function monterChoix() {
  const dialogue = document.querySelector<HTMLDialogElement>('#choix-cyrose')
  if (!dialogue) return
  const bar = dialogue.querySelector<HTMLElement>('.bar')!
  const desc = dialogue.querySelector<HTMLElement>('.bar-desc')!
  const texte = desc.dataset.tape ?? desc.textContent ?? ''
  let frappe = 0

  // Le texte de la cave se tape à la machine, une fois le projecteur allumé.
  const taper = () => {
    clearInterval(frappe)
    if (reduit()) { desc.textContent = texte; return }
    let i = 0
    desc.textContent = ''
    desc.classList.add('tape')
    frappe = window.setInterval(() => {
      desc.textContent = texte.slice(0, ++i)
      if (i >= texte.length) clearInterval(frappe)
    }, 22)
  }

  document.querySelectorAll<HTMLAnchorElement>('[data-choix="cyrose"]').forEach(a => {
    a.addEventListener('click', e => {
      // Un clic du milieu ou avec modificateur garde son sens : ouvrir cyrose.fr.
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      e.preventDefault()
      dialogue.showModal()
      window.setTimeout(taper, reduit() ? 0 : 650)
    })
  })

  dialogue.querySelector('.choix-fermer')!.addEventListener('click', () => dialogue.close())
  // Un clic sur le voile (hors de la boîte) ferme.
  dialogue.addEventListener('click', e => { if (e.target === dialogue) dialogue.close() })
  dialogue.addEventListener('close', () => clearInterval(frappe))
  // Choisir une table ferme le choix derrière soi.
  dialogue.querySelectorAll('.porte').forEach(p => p.addEventListener('click', () => dialogue.close()))

  // Le projecteur suit le pointeur dans la cave.
  bar.addEventListener('pointermove', e => {
    if (reduit()) return
    const r = bar.getBoundingClientRect()
    bar.style.setProperty('--x', `${e.clientX - r.left}px`)
    bar.style.setProperty('--y', `${e.clientY - r.top}px`)
  })
}
