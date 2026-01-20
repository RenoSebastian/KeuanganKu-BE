import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const GetUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    // Jika minta field spesifik (misal @GetUser('email')), return email aja
    if (data) {
      return request.user[data];
    }
    // Return full user object
    return request.user;
  },
);