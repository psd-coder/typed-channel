/**
 * Function that will be called on unsubscribing from a message type.
 */
export type CleanupFunction = VoidFunction;

/**
 * Represents a typed message with a payload.
 * @template Type - The string literal type of the message.
 * @template Payload - The type of the payload data.
 */
export type Message<Type extends string, Payload> = {
  type: Type;
  payload: [Payload] extends [never] ? undefined : Payload;
};

/**
 * Utility type for extending real messages map from it in generics.
 */
export type AnyMessages = Record<string, unknown>;

/**
 * Utility type that extracts all possible message types from a message map.
 * @template T - The message map type.
 */
export type AnyMessageOf<T extends AnyMessages> = {
  [K in keyof T & string]: Message<K, T[K]>;
}[keyof T & string];

/**
 * The main TypedChannel interface for communication between components.
 * @template InboundMessages - The message types this channel can receive.
 * @template OutboundMessages - The message types this channel can send.
 */
export type TypedChannel<
  InboundMessages extends AnyMessages,
  OutboundMessages extends AnyMessages,
> = {
  /**
   * Starts listening for incoming messages on all transports
   */
  listen: () => void;
  /**
   * Stops listening for incoming messages and cleans up all transport subscriptions
   */
  unlisten: () => void;
  /**
   * Sends a message through all transports
   *
   * @param type - The message type identifier
   * @param payload - The optional payload (omitted if the message type has no payload)
   */
  emit: <Type extends keyof OutboundMessages & string>(
    ...[type, payload]: OutboundMessages[Type] extends never
      ? [Type]
      : [Type, OutboundMessages[Type]]
  ) => void;
  /**
   * Registers a handler for a specific message type
   *
   * @param type - The message type identifier
   * @param handler - The function to call when a message of this type is received
   * @returns A cleanup function that, when called, will unregister the handler
   */
  on: <Type extends keyof InboundMessages>(
    type: Type,
    handler: (payload: InboundMessages[Type]) => void,
  ) => CleanupFunction;
};

/**
 * Interface for a transport mechanism that can send and receive messages.
 * @template InboundMessages - The message types this transport can receive.
 * @template OutboundMessages - The message types this transport can send.
 */
export type TypedChannelTransport<
  InboundMessages extends AnyMessages,
  OutboundMessages extends AnyMessages,
> = {
  /**
   * Register a handler for incoming messages.
   * @param handler - The function to call when a message is received.
   * @returns A function that, when called, will unregister the handler.
   */
  on: (handler: (message: AnyMessageOf<InboundMessages>) => void) => CleanupFunction;
  /**
   * Send a message through the transport.
   * @param message - The message to send.
   */
  emit: (message: AnyMessageOf<OutboundMessages>) => void;
};
