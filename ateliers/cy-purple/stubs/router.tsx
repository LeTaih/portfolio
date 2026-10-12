// react-router-dom : la barre de Purple ne rend un <Link> que pour un joueur
// qui n'est pas l'hôte. La tuile joue l'hôte ; un <a> suffit.
import type { ReactNode } from 'react';
export function Link({ to, className, children }: { to: string; className?: string; children?: ReactNode }) {
  return <a href={to} className={className}>{children}</a>;
}
