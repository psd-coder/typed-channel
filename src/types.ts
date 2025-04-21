export type CleanupFunction = VoidFunction;

export type EmptyMessage<Type extends string> = {
  type: Type;
};

export type Message<Type extends string, Payload> = {
  type: Type;
  payload: [Payload] extends [never] ? undefined : Payload;
};

export type AnyMessages = Record<string, unknown>;

export type AnyMessageOf<T extends AnyMessages> = {
  [K in keyof T & string]: Message<K, T[K]>;
}[keyof T & string];

export type TypedChannel<
  InboundMessages extends AnyMessages,
  OutboundMessages extends AnyMessages,
> = {
  listen: () => void;
  unlisten: () => void;
  emit: <Type extends keyof OutboundMessages & string>(
    ...[type, payload]: OutboundMessages[Type] extends never
      ? [Type]
      : [Type, OutboundMessages[Type]]
  ) => void;
  on: <Type extends keyof InboundMessages>(
    type: Type,
    handler: (payload: InboundMessages[Type]) => void,
  ) => CleanupFunction;
};

export type TypedChannelTransport<
  InboundMessages extends AnyMessages,
  OutboundMessages extends AnyMessages,
> = {
  on: (handler: (message: AnyMessageOf<InboundMessages>) => void) => CleanupFunction;
  emit: (message: AnyMessageOf<OutboundMessages>) => void;
};
