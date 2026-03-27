import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Post,
} from '@nestjs/common';
import { PaykuService } from './payku.service';

@Controller('payku')
export class PaykuController {
  constructor(private readonly paykuService: PaykuService) {}

  @Post('webhook')
  @HttpCode(200)
  async handleWebhook(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() body: Record<string, unknown>,
  ): Promise<{ ok: true }> {
    await this.paykuService.handleWebhook(headers, body);
    return { ok: true };
  }
}
