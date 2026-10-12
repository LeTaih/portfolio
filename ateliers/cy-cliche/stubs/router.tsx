import type { ReactNode } from 'react';
export function Link({ children, to: _to, ...rest }: { children?: ReactNode; to: string; [k: string]: unknown }) { return <a href="#" {...rest}>{children}</a>; }
export function useNavigate() { return () => {}; }
