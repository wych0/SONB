import { Server } from '.';

export interface Response {
  status: string;
  errorMessage?: string;
}

export interface PrepareResponse extends Response {
  ready: boolean;
  port: number;
}

export interface CoordinatorResponse extends Response {
  inactiveServers?: number[];
}

export interface ChangeStatusResponse extends Response {
  isActive: boolean;
}

export interface ChangeDelayResponse extends Response {
  delay: number;
}

export interface ServersResponse extends Response {
  servers: Server[];
}

export interface InfoResponse extends Response, Server {}
