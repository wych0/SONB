import { Socket } from 'socket.io-client';

export interface Client {
  port: number;
  socket: Socket;
}
