// La file d'envoi durable (IndexedDB + upload) n'a rien à faire ici : la tuile
// commence au classement, quand toutes les photos sont parties.
export interface PendingView { status: 'pending' | 'uploading' | 'error'; previewUrl: string }
export interface UploadQueue {
  uploaded: Record<string, { photoId: string; url: string }>;
  pending: Record<string, PendingView>;
  enqueue: (objectId: string, blob: Blob) => void;
}
const VIDE: UploadQueue = { uploaded: {}, pending: {}, enqueue: () => {} };
export function useUploadQueue(_: unknown): UploadQueue { return VIDE; }
