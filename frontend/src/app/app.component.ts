import { Component, OnDestroy, OnInit } from '@angular/core';
import { WebSocketService } from './web-socket.service';
import { NotifierService } from 'angular-notifier';
import { Subscription } from 'rxjs';

interface Server {
  id: number;
  name: string;
  active: boolean;
  role: string;
  delay: number;
}

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnInit, OnDestroy {
  dataToCommit: number = 0;
  readData: number = 0;
  currentCoordinator: number = 3001;
  submitted: boolean = false;
  editedServerId: number = 0;
  errorMessage: string = '';
  closingCoordinator: boolean = false;
  serversSub: Subscription = new Subscription();
  coordinatorSub: Subscription = new Subscription();
  loadingSub: Subscription = new Subscription();
  loading: boolean = false;

  servers: Server[] = [];
  constructor(
    private wsService: WebSocketService,
    private notifierService: NotifierService
  ) {}

  ngOnInit(): void {
    this.loadServers();

    this.serversSub = this.wsService.serversSubject.subscribe((servers) => {
      this.servers = servers.map((serverTemp) => ({
        id: serverTemp.port,
        name: 'S' + serverTemp.port,
        active: serverTemp.isActive,
        role: serverTemp.role,
        value: 3,
        delay: serverTemp.delay,
      }));

      this.notifierService.notify('info', 'Servers list updated');
    });

    this.coordinatorSub = this.wsService.coordinatorSubject.subscribe(
      (port) => {
        this.currentCoordinator = port;
        this.notifierService.notify(
          'warning',
          `New coordinator elected: S${port}`
        );

        this.servers = this.servers.map((server) => ({
          ...server,
          role: server.id === port ? 'Coordinator' : 'Server',
        }));
      }
    );

    this.loadingSub = this.wsService.loadingSubject.subscribe((loading) => {
      this.loading = loading;
    });
  }

  private async loadServers() {
    try {
      const response = await this.wsService.getServers();
      this.servers = response.servers.map((serverTemp) => ({
        id: serverTemp.port,
        name: 'S' + serverTemp.port,
        active: serverTemp.isActive,
        role: serverTemp.role,
        value: 3,
        delay: serverTemp.delay,
      }));

      const coordinator = response.servers.find(
        (s) => s.role === 'Coordinator'
      );
      if (coordinator) {
        this.currentCoordinator = coordinator.port;
      }
    } catch (error) {
      console.error('Error loading servers:', error);
      this.notifierService.notify('error', 'Failed to load servers');
    }
  }

  async changeStatus(serverId: number) {
    this.editedServerId = serverId;
    try {
      const response = await this.wsService.changeStatus(serverId);

      this.servers = this.servers.map((server) => {
        if (server.id !== serverId) return server;

        server.active = response.isActive;
        return server;
      });

      this.notifierService.notify('success', 'Status changed');
    } catch (err) {
      this.notifierService.notify(
        'error',
        `Failed to connect to server: ${err}`
      );

      this.servers = this.servers.filter((server) => server.id !== serverId);
    } finally {
      this.editedServerId = 0;
    }
  }

  async changeDelay(serverId: number) {
    this.editedServerId = serverId;
    try {
      const response = await this.wsService.changeDelay(serverId);

      this.servers = this.servers.map((server) => {
        if (server.id !== serverId) return server;

        server.delay = response.delay;
        return server;
      });

      this.notifierService.notify('success', 'Delay changed');
    } catch (err) {
      this.notifierService.notify(
        'error',
        `Failed to connect to server: ${err}`
      );

      this.servers = this.servers.filter((server) => server.id !== serverId);
    } finally {
      this.editedServerId = 0;
    }
  }

  closeCoordinator() {
    this.closingCoordinator = true;

    this.wsService.closeCoordinator().then(() => {
      this.closingCoordinator = false;
    });
  }

  commitData(): void {
    this.errorMessage = '';
    this.submitted = true;
    this.wsService.commitData(this.dataToCommit).then((response) => {
      if (response.status === 'COMMITTED') {
        this.notifierService.notify('success', 'Operation committed');
      } else {
        this.errorMessage = `Operation aborted: ${response.errorMessage} [${response.inactiveServers}]`;
      }
      this.submitted = false;
    });
  }

  ngOnDestroy(): void {
    if (this.serversSub) this.serversSub.unsubscribe();
    if (this.coordinatorSub) this.coordinatorSub.unsubscribe();
    if (this.loadingSub) this.loadingSub.unsubscribe();
  }
}
