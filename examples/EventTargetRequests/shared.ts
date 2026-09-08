export type NoMessages = Record<never, never>;

export type User = { id: string; name: string };

export type UserRequests = {
  loadUser: (id: string) => User;
};

// One EventTarget shared by both modules: each of them builds its own channel on top of it.
export const sharedTarget = new EventTarget();
