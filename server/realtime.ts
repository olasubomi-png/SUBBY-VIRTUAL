export type RealtimeEvent =
  | "activation.created"
  | "activation.status.updated"
  | "inbox.created"
  | "inbox.message.received"
  | "wallet.updated";

export function canReceiveResourceEvent(input: {
  viewerId: number;
  viewerRole: string;
  ownerId: number;
  event: RealtimeEvent;
}) {
  return input.viewerRole === "admin" || input.viewerId === input.ownerId;
}

export function createRealtimeEvent<T>(
  event: RealtimeEvent,
  ownerId: number,
  payload: T
) {
  return { event, ownerId, payload, createdAt: new Date().toISOString() };
}
