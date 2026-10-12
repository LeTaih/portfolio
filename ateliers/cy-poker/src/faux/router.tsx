// Remplace react-router-dom : la tuile n'a qu'un écran.
import type { AnchorHTMLAttributes } from 'react';

export function Link({ to: _to, ...p }: AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) {
  return <a href="#" {...p} />;
}
export const useNavigate = () => () => {};
