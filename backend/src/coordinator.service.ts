import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { io, Socket } from 'socket.io-client';
import {
  Client,
  ChangeStatusResponse,
  Server,
  ServersResponse,
  PrepareResponse,
  CoordinatorResponse,
  Role,
  InfoResponse,
  ChangeDelayResponse,
} from './models/index';

@Injectable()
export class CoordinatorService implements OnModuleInit {
  private readonly logger = new Logger(CoordinatorService.name);
  private readonly myPort = parseInt(process.env.PORT!, 10);
  private readonly allPorts = [3001, 3002, 3003, 3004, 3005, 3006, 3007];

  private role: string = this.myPort === 3001 ? Role.COORDINATOR : Role.SERVER;
  private isActive: boolean = true;

  private coordinatorPort: number | null = 3001;
  private coordinatorSocket: Socket | null = null;
  private coordinatorClients: Client[] = [];

  private value: any = 0;
  private delay: number = 0;

  onModuleInit() {
    this.logger.log(`Initialized on port ${this.myPort}`);

    if (this.myPort === 3001) {
      setTimeout(() => {
        this.connectToOthersIfCoordinator();
      }, 1000);
    } else {
      this.connectToCoordinatorIfServer(3001);
    }
  }

  private async electCoordinator() {
    const activePorts = await this.getActivePorts();
    const electedPort = Math.min(...activePorts);
    const newRole =
      this.myPort === electedPort ? Role.COORDINATOR : Role.SERVER;

    if (this.role !== newRole) {
      this.role = newRole;
      this.logger.warn(`Role changed to: ${this.role}`);

      if (this.role === Role.COORDINATOR) {
        this.connectToOthersIfCoordinator();
        this.coordinatorSocket?.disconnect();
      }
    } else {
      this.logger.warn(`New coordinator elected: ${electedPort}`);
      this.connectToCoordinatorIfServer(electedPort);
    }

    this.coordinatorPort = electedPort;
  }

  private async getActivePorts(): Promise<number[]> {
    const result: number[] = [this.myPort];

    for (const port of this.allPorts) {
      if (port === this.myPort) continue;

      const ok = await this.ping(port);
      if (ok) result.push(port);
    }

    return result;
  }

  private async ping(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = io(`ws://localhost:${port}`, {
        reconnection: false,
        timeout: 1000,
      });

      socket.on('connect', () => {
        socket.disconnect();
        resolve(true);
      });

      socket.on('connect_error', () => resolve(false));
    });
  }

  private connectToOthersIfCoordinator() {
    for (const port of this.allPorts) {
      if (port === this.myPort) continue;

      const socket = io(`ws://localhost:${port}`, {
        reconnection: true,
        timeout: 1000,
      });

      socket.on('connect', () => {
        this.logger.log(`[COORDINATOR] Connected to ${port}`);
        this.coordinatorClients.push({ port, socket });
      });

      socket.on('disconnect', () => {
        this.logger.warn(`[COORDINATOR] Disconnected from ${port}`);
        this.coordinatorClients = this.coordinatorClients.filter(
          (clientInfo) => clientInfo.port !== port,
        );
      });
    }
  }

  private connectToCoordinatorIfServer(port: number) {
    this.coordinatorSocket?.disconnect();

    const socket = io(`ws://localhost:${port}`, {
      reconnection: true,
      timeout: 1000,
    });

    socket.on('connect', () => {
      this.logger.log(`[SERVER] Connected to coordinator ${port}`);
      this.coordinatorSocket = socket;
    });

    socket.on('disconnect', () => {
      this.logger.warn(`[SERVER] Disconnected from coordinator ${port}`);
      this.coordinatorSocket = null;
      this.coordinatorPort = null;
      this.electCoordinator();
    });
  }

  changeStatus(): ChangeStatusResponse {
    this.isActive = !this.isActive;

    const response: ChangeStatusResponse = {
      status: 'ok',
      isActive: this.isActive,
    };

    return response;
  }

  closeCoordinator() {
    if (!this.isCoordinator()) {
      return;
    }

    process.exit(0);
  }

  changeDelay(): ChangeDelayResponse {
    this.delay = this.delay === 0 ? 5000 : 0;

    const response: ChangeDelayResponse = {
      status: 'ok',
      delay: this.delay,
    };

    return response;
  }

  getInfo(): InfoResponse {
    const response: InfoResponse = {
      status: 'ok',
      port: this.myPort,
      isActive: this.isActive,
      role: this.role,
      delay: this.delay,
    };

    return response;
  }

  async getAvailableServers(): Promise<ServersResponse> {
    if (!this.isCoordinator()) {
      return {
        status: 'ERROR',
        errorMessage: 'Not coordinator',
        servers: [],
      };
    }

    const serversInfo: InfoResponse[] = await Promise.all(
      this.coordinatorClients.map((client) => this.sendStatusRequest(client)),
    );

    const servers: Server[] = serversInfo.map((serverInfo) => {
      const server: Server = {
        port: serverInfo.port,
        isActive: serverInfo.isActive,
        role: serverInfo.role,
        delay: serverInfo.delay,
      };

      return server;
    });

    const thisServer: Server = {
      port: this.myPort,
      isActive: this.isActive,
      role: this.role,
      delay: this.delay,
    };
    servers.unshift(thisServer);

    const response: ServersResponse = {
      status: 'ok',
      servers,
    };

    return response;
  }

  private isCoordinator(): boolean {
    return this.role === Role.COORDINATOR;
  }

  onAbort(): void {
    this.logger.warn(`[SERVER] 2PC Aborted`);
  }

  onCommit(body: any): void {
    this.value = body;
    this.logger.log(`[SERVER] 2PC Committed ${body}`);
  }

  async onPrepare(): Promise<PrepareResponse> {
    return new Promise((resolve) => {
      setTimeout(() => {
        const prepareResponse: PrepareResponse = {
          status: 'ok',
          ready: this.isActive,
          port: this.myPort,
        };
        resolve(prepareResponse);
      }, this.delay);
    });
  }

  async requestToServer(body: any): Promise<CoordinatorResponse> {
    if (!this.isCoordinator()) {
      return {
        status: 'ERROR',
        errorMessage: 'Not coordinator',
      };
    }

    this.logger.log(`[COORDINATOR] Start 2PC`);

    const prepareResponses: PrepareResponse[] = await Promise.all(
      this.coordinatorClients.map((client) => this.sendPrepareRequest(client)),
    );

    if (prepareResponses.every((res) => res.ready)) {
      this.logger.log(`[COORDINATOR] Every participant is ready, committing.`);
      for (const client of this.coordinatorClients) {
        await this.sendCommitRequest(client, body);
      }
      return {
        status: 'COMMITTED',
      };
    } else {
      this.logger.warn(
        `[COORDINATOR] Not every participant is ready, aborting.`,
      );
      for (const client of this.coordinatorClients) {
        await this.sendAbortRequest(client);
      }
      const inactiveServers: number[] = prepareResponses
        .filter((res) => !res.ready)
        .map((res) => res.port);
      return {
        status: 'ABORTED',
        inactiveServers: inactiveServers,
        errorMessage: 'One or more participants rejected the prepare phase',
      };
    }
  }

  private sendPrepareRequest(client: Client): Promise<PrepareResponse> {
    return new Promise<PrepareResponse>((resolve) => {
      client.socket.emit('prepare', (response: PrepareResponse) => {
        resolve(response);
      });
    });
  }

  private sendStatusRequest(client: Client): Promise<InfoResponse> {
    return new Promise<InfoResponse>((resolve) => {
      client.socket.emit('status', (response: InfoResponse) => {
        resolve(response);
      });
    });
  }

  private sendAbortRequest(client: Client): void {
    client.socket.emit('abort');
  }

  private sendCommitRequest(client: Client, value: number): void {
    client.socket.emit('commit', value);
  }

  getRole(): string {
    return this.role;
  }

  getCoordinatorPort(): number | null {
    return this.coordinatorPort;
  }
}
