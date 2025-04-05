import { Module } from '@nestjs/common';
import { TransactionGateway } from './transaction.gateway';
import { CoordinatorService } from './coordinator.service';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [TransactionGateway, CoordinatorService],
})
export class AppModule {}
