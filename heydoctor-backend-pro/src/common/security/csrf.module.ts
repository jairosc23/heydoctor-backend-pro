import { Global, Module } from '@nestjs/common';
import { CsrfMiddleware } from './csrf.middleware';
import { CsrfService } from './csrf.service';

@Global()
@Module({
  providers: [CsrfService, CsrfMiddleware],
  exports: [CsrfService],
})
export class CsrfModule {}
