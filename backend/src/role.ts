export const Role = {
  Coordinator: 'Coordinator',
  Server: 'Server',
};

export type HeartbeatPayload = {
  port: number;
  timestamp: number;
};
