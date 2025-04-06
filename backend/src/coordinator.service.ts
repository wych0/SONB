import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { io, Socket } from 'socket.io-client';
import { Role } from './role';

type IClientInfo = { port: number; socket: Socket };

@Injectable()
export class CoordinatorService implements OnModuleInit {
  private readonly logger = new Logger(CoordinatorService.name);
  private readonly myPort = parseInt(process.env.PORT!, 10);
  private readonly allPorts = [3001, 3002, 3003, 3004, 3005, 3006, 3007];

  private role: string = this.myPort === 3001 ? Role.Coordinator : Role.Server;
  private coordinatorPort: number | null = this.myPort === 3001 ? 3001 : null;
  private isActive: boolean = true;

  private coordinatorSocket: Socket | null = null;
  private coordinatorClients: IClientInfo[] = [];

  onModuleInit() {
    this.logger.log(`Initialized on port ${this.myPort}`);

    if (this.myPort === 3001) {
      setTimeout(() => {
        this.connectToOthersIfCoordinator();
      }, 1000);
    } else {
      if (this.myPort === 3002 || this.myPort === 3006) {
        this.isActive = false;
      }
      this.connectToCoordinatorIfServer(3001);
    }
  }

  private async electCoordinator() {
    const activePorts = await this.getActivePorts();
    const electedPort = Math.min(...activePorts);
    const newRole =
      this.myPort === electedPort ? Role.Coordinator : Role.Server;

    if (this.coordinatorPort !== electedPort) {
      this.logger.warn(
        `New coordinator elected: ${electedPort} (was: ${this.coordinatorPort})`,
      );
    }

    if (this.role !== newRole) {
      this.role = newRole;
      this.logger.warn(`Role changed to: ${this.role}`);

      if (this.role === Role.Coordinator) {
        this.connectToOthersIfCoordinator();
        this.coordinatorSocket?.disconnect();
      }
    }

    this.coordinatorPort = electedPort;
  }

  @Cron(CronExpression.EVERY_5_SECONDS)
  heartbeatCheck() {
    this.checkIfCoordinatorIsAlive();
  }

  private async checkIfCoordinatorIsAlive(): Promise<void> {
    if (!this.coordinatorPort) {
      this.electCoordinator();
      return;
    }
    if (this.coordinatorPort === this.myPort) return;

    const isCoordinatorAlive = await this.ping(this.coordinatorPort);

    if (!isCoordinatorAlive) {
      this.electCoordinator();
    }
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
    });
  }

  getRole(): string {
    return this.role;
  }

  getIsActive(): boolean {
    return this.isActive;
  }

  getCoordinatorPort(): number | null {
    return this.coordinatorPort;
  }

  async requestToServer(body: any): Promise<void> {
    if (this.role !== Role.Coordinator) return;

    const results = await Promise.all(
      this.coordinatorClients.map(
        ({ socket, port }: IClientInfo) =>
          new Promise<boolean>((resolve) => {
            socket.emit('prepare', (response: boolean) => {
              resolve(response);
            });
          }),
      ),
    );

    this.logger.log(results);
    const resultsEvery = results.every((res) => res);
    if (resultsEvery) this.logger.log('wszystkie maja true');
    else this.logger.log('nie wszystkie');
  }
}
