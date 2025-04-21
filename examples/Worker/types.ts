export type ClientMessages = {
  startTimer: never;
  stopTimer: never;
};

export type WorkerMessages = {
  notify: { message: string };
};
