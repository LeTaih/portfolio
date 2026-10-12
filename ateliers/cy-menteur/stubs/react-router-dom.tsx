// Le seul usage dans la salle : le lien « Accueil » de la barre du salon.
import type { ReactNode } from 'react';
export function Link({ to, className, children }: { to: string; className?: string; children?: ReactNode }) {
  return (
    <a href={typeof to === 'string' ? to : '#'} className={className} onClick={(e) => e.preventDefault()}>
      {children}
    </a>
  );
}
