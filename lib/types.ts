// lib/types.ts
// Roadmap type used across client and server.
// _id is optional because client-created objects may not have a MongoDB _id yet.
// `id` is the canonical string id we use in the UI (derived from _id when present).

export type Roadmap = {
  // MongoDB raw id when document comes from DB (optional for client-created items)
  _id?: unknown;

  // canonical id used by frontend (string)
  id: string;

  name: string;
  skills: string[];
  payload: {
    roadmap: any[];
    resources: any[];
    progress?: any;
    [k: string]: any;
  };
  createdAt: string;

  // allow any extra fields (like userEmail, clientId, updatedAt)
  [k: string]: any;
};
