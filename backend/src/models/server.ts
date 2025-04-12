export interface Server {
  port: number;
  isActive: boolean;
  role: string;
  delay: number;
}

export enum Role {
  'COORDINATOR' = 'Coordinator',
  'SERVER' = 'Server',
}
