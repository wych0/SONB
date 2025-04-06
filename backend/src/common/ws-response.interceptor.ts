import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { Observable, catchError, tap, throwError } from "rxjs";
import { Socket } from "socket.io";
import { Reflector } from "@nestjs/core";

@Injectable()
export class WsResponseInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const eventName = this.reflector.get<string>(
      "eventName",
      context.getHandler(),
    );

    const client: Socket = context.switchToWs().getClient<Socket>();

    return next.handle().pipe(
      tap(data => {
        client.emit(eventName, data);
      }),
      catchError(err => {
        const error = err.message || "An error occurred";
        client.emit(eventName, { error: error, type: "error" });
        return throwError(() => err);
      }),
    );
  }
}
