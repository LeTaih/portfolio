// react-router-dom, réduit à ce que la table importe : un lien qui ne mène nulle part.
export function Link({ to: _to, children, ...rest }: any) { return <a href="#" {...rest}>{children}</a>; }
export function useNavigate() { return () => {}; }
