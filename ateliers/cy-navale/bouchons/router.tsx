// Bouchon de react-router-dom : RoomTopBar n'en prend que `Link`, qui ne sert
// pas ici (la barre reçoit sa sortie « Salon » comme en partie).
import type { ReactNode } from 'react';
export function Link({ children, className }: { to: string; className?: string; children?: ReactNode }) {
  return <a className={className}>{children}</a>;
}
