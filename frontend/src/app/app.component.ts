import { Component, OnInit } from '@angular/core';

interface Server {
  id: string;
  name: string;
  active: boolean;
  role: string;
  value: number;
}

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnInit {
  dataToCommit: number = 0;
  readData: number = 0;

  servers: Server[] = [];
  constructor() {}

  ngOnInit(): void {
    for (let i = 0; i < 7; i++) {
      this.servers.push({
        id: i.toString(),
        name: `S${i}`,
        active: i % 2 == 0,
        role: i === 0 ? 'coordinator' : 'normal',
        value: 3,
      });
    }
  }

  changeStatus(serverId: string) {
    this.servers = this.servers.map((server) => {
      if (server.id != serverId) return server;

      server.active = !server.active;

      return server;
    });
  }

  commitData(): void {
    this.servers = this.servers.map((server) => {
      server.value = this.dataToCommit;

      return server;
    });
  }
}
