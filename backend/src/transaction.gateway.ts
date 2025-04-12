import {
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { CoordinatorService } from './coordinator.service';

@WebSocketGateway()
export class TransactionGateway implements OnGatewayInit {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger('TransactionGateway');

  constructor(private readonly coordinatorService: CoordinatorService) {}

  afterInit() {
    const role = this.coordinatorService.getRole();
    this.logger.log(`[${process.env.PORT}] ROLE: ${role}`);
  }

  @SubscribeMessage('coordinator')
  async handleCoordinator(client: Socket, body: any) {
    return await this.coordinatorService.requestToServer(body);
  }

  @SubscribeMessage('closeCoordinator')
  async handleCloseCoordinator() {
    return await this.coordinatorService.closeCoordinator();
  }

  @SubscribeMessage('servers')
  async handleServers(client: Socket) {
    return await this.coordinatorService.getAvailableServers();
  }

  @SubscribeMessage('status')
  async handleStatus() {
    return await this.coordinatorService.getInfo();
  }

  @SubscribeMessage('changeStatus')
  async handleChangeStatus() {
    return await this.coordinatorService.changeStatus();
  }

  @SubscribeMessage('changeDelay')
  async handleChangeDelay() {
    return await this.coordinatorService.changeDelay();
  }

  @SubscribeMessage('prepare')
  async handlePrepare(client: Socket) {
    return await this.coordinatorService.onPrepare();
  }

  @SubscribeMessage('abort')
  async handleAbort(client: Socket) {
    return this.coordinatorService.onAbort();
  }

  @SubscribeMessage('commit')
  async handleCommit(client: Socket, body: any) {
    return this.coordinatorService.onCommit(body);
  }
}
