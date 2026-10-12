// react-router-dom — pas de navigation dans une tuile.
export function Link({ to: _to, children, ...rest }: any) {
  return <a href="#" {...rest}>{children}</a>;
}
export function useNavigate() {
  return () => {};
}
