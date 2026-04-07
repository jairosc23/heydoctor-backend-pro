/* eslint-disable @typescript-eslint/no-explicit-any */
declare module 'socket.io-client' {
  export interface Socket {
    readonly connected: boolean;
    connect(): this;
    disconnect(): this;
    on(ev: string, fn: (...args: any[]) => void): this;
    once(ev: string, fn: (...args: any[]) => void): this;
    off(ev: string, fn?: (...args: any[]) => void): this;
    emit(ev: string, ...args: any[]): void;
  }
  export function io(uri: string, opts?: Record<string, unknown>): Socket;
}
