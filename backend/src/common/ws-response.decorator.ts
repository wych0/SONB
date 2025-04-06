import { SetMetadata, UseInterceptors, applyDecorators } from "@nestjs/common";
import { WsResponseInterceptor } from "./ws-response.interceptor";

export function UseWsResponse(eventName: string) {
  return applyDecorators(
    SetMetadata("eventName", eventName),
    UseInterceptors(WsResponseInterceptor),
  );
}
