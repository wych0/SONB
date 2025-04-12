import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { io, Socket } from 'socket.io-client';

interface SocketIoConfig {
  url: string;
  options: {
    transports?: string[];
    upgrade?: boolean;
    forceNew?: boolean;
    withCredentials?: boolean;
    extraHeaders?: { [header: string]: string };
  };
}

interface Response {
  status: string;
  errorMessage?: string;
}

export interface Server {
  port: number;
  isActive: boolean;
  role: string;
  delay: number;
}

export interface CoordinatorResponse extends Response {
  inactiveServers?: number[];
}

export interface ChangeStatusResponse extends Response {
  isActive: boolean;
}

export interface ServersResponse extends Response {
  servers: Server[];
}

export interface ChangeDelayResponse extends Response {
  delay: number;
}

@Injectable({
  providedIn: 'root',
})
export class WebSocketService {
  private coordinatorSocket: Socket;
  private knownServers: Server[] = [];
  private config: SocketIoConfig = {
    url: `ws://localhost:3001`,
    options: {
      transports: ['websocket'],
      upgrade: false,
      forceNew: true,
      withCredentials: true,
      extraHeaders: {
        'Access-Control-Allow-Origin': 'http://localhost:4200',
      },
    },
  };

  coordinatorSubject = new BehaviorSubject<number>(this.getCoordinatorPort());
  serversSubject = new BehaviorSubject<Server[]>([]);
  loadingSubject = new BehaviorSubject<boolean>(false);

  constructor() {
    this.coordinatorSocket = io(this.config.url, this.config.options);
    this.initServers();
    this.listenOnCoordinatorDisconnect();
  }

  private getCoordinatorPort(): number {
    return parseInt(this.config.url.split(':').pop() || '3001');
  }

  private async initServers() {
    try {
      const response = await this.getServers();

      this.knownServers = response.servers;
      this.serversSubject.next([...this.knownServers]);
    } catch (error) {
      console.error('Error initializing servers:', error);
    }
  }

  async listenOnCoordinatorDisconnect() {
    const setupDisconnectListener = (socket: Socket) => {
      socket.on('disconnect', async () => {
        this.loadingSubject.next(true);
        console.log(
          `Coordinator on port ${this.getCoordinatorPort()} disconnected`
        );

        const activeServers = this.knownServers
          .filter((server) => server.isActive)
          .sort((a, b) => a.port - b.port);

        for (const server of activeServers) {
          try {
            const newSocket: Socket = io(
              `ws://localhost:${server.port}`,
              this.config.options
            );

            const isAvailable = await new Promise<boolean>((resolve) => {
              newSocket.on('connect', () => {
                resolve(true);
              });

              newSocket.on('connect_error', () => {
                resolve(false);
              });

              setTimeout(() => resolve(false), 2000);
            });

            if (isAvailable) {
              console.log(
                `Successfully connected to new coordinator on port ${server.port}`
              );

              this.coordinatorSocket.off('disconnect');

              this.coordinatorSocket.disconnect();
              this.coordinatorSocket = newSocket;
              this.config.url = `ws://localhost:${server.port}`;

              this.coordinatorSubject.next(server.port);

              setupDisconnectListener(newSocket);

              await this.initServers();
              this.loadingSubject.next(false);
              return;
            } else {
              newSocket.disconnect();
            }
          } catch (error) {
            console.error(
              `Failed to connect to server on port ${server.port}:`,
              error
            );
          }
        }
      });
    };

    setupDisconnectListener(this.coordinatorSocket);
  }

  async commitData(value: number) {
    const response: CoordinatorResponse =
      await new Promise<CoordinatorResponse>((resolve) => {
        this.coordinatorSocket.emit('coordinator', value, (response: any) => {
          resolve(response);
        });
      });

    return response;
  }

  async getServers(): Promise<ServersResponse> {
    const response: ServersResponse = await new Promise<ServersResponse>(
      (resolve) => {
        this.coordinatorSocket.emit('servers', (response: ServersResponse) => {
          resolve(response);
        });
      }
    );

    return response;
  }

  async changeStatus(serverId: number): Promise<ChangeStatusResponse> {
    const socket: Socket = io(
      `ws://localhost:${serverId}`,
      this.config.options
    );

    try {
      const response = await new Promise<ChangeStatusResponse>(
        (resolve, reject) => {
          const connectionTimeout = setTimeout(() => {
            reject(new Error('Connection timeout'));
          }, 2000);

          socket.on('connect', () => {
            clearTimeout(connectionTimeout);
            socket.emit('changeStatus', (response: ChangeStatusResponse) => {
              socket.disconnect();
              resolve(response);
            });
          });

          socket.on('connect_error', (error) => {
            clearTimeout(connectionTimeout);
            socket.disconnect();
            reject(new Error(`Connection error: ${error.message}`));
          });
        }
      );

      return response;
    } catch (error) {
      socket.disconnect();
      throw error;
    }
  }

  async changeDelay(serverId: number): Promise<ChangeDelayResponse> {
    const socket: Socket = io(
      `ws://localhost:${serverId}`,
      this.config.options
    );

    try {
      const response = await new Promise<ChangeDelayResponse>(
        (resolve, reject) => {
          const connectionTimeout = setTimeout(() => {
            reject(new Error('Connection timeout'));
          }, 2000);

          socket.on('connect', () => {
            clearTimeout(connectionTimeout);
            socket.emit('changeDelay', (response: ChangeDelayResponse) => {
              socket.disconnect();
              resolve(response);
            });
          });

          socket.on('connect_error', (error) => {
            clearTimeout(connectionTimeout);
            socket.disconnect();
            reject(new Error(`Connection error: ${error.message}`));
          });
        }
      );

      return response;
    } catch (error) {
      socket.disconnect();
      throw error;
    }
  }

  async closeCoordinator(): Promise<void> {
    await this.coordinatorSocket.emit('closeCoordinator');
  }
}
