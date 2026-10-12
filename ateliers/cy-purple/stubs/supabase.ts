// Faux serveur : la tuile n'écrit jamais. La table reçoit un écrivain local
// (prop `ecrire`) ; seuls ces deux appels restent importés par la barre et
// l'aide de Purple, et ne sont jamais déclenchés par le scénario.
export async function setPurpleState(): Promise<void> {}
export async function removePlayer(): Promise<void> {}
