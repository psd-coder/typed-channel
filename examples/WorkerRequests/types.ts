export type NoMessages = Record<never, never>;

export type MainRequests = {
  confirm: (question: string) => boolean;
};

export type WorkerRequests = {
  compute: (params: { steps: number }) => number;
};
