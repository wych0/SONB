import {
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server } from 'socket.io';
import { Logger } from '@nestjs/common';
import { UseWsResponse } from './common/ws-response.decorator';
import { Role } from './role';
import { CoordinatorService } from './coordinator.service';
import { Socket } from 'engine.io-client';

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
  @UseWsResponse('response')
  async handleCoordinator(clinet: Socket, body: any) {
    await this.coordinatorService.requestToServer(body);
  }

  @SubscribeMessage('prepare')
  @UseWsResponse('prepare_response')
  async handleHello(clinet: Socket) {
    return this.coordinatorService.getIsActive();
  }
}
