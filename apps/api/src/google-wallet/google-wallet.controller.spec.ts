import 'reflect-metadata';
import type { Request } from 'express';
import { GoogleWalletController } from './google-wallet.controller';
import type { GoogleWalletService } from './google-wallet.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiError } from '../common/errors/api-error';
import { ApiErrorResponseDto } from '../common/errors/api-error-response.dto';
import { GoogleWalletSaveUrlResponseDto } from './dto/google-wallet-save-url-response.dto';

const SAVE_URL = 'https://pay.google.com/gp/v/save/header.claims.signature';

function controllerWith(getSaveUrl: jest.Mock) {
  return new GoogleWalletController({
    getSaveUrl,
  } as unknown as GoogleWalletService);
}

const requestAs = (id: string) =>
  ({ user: { id, phoneE164: '+15555550100' } }) as unknown as Request;

describe('GoogleWalletController', () => {
  it("returns { url } for the caller's own id and the card in the path", async () => {
    const getSaveUrl = jest.fn().mockResolvedValue(SAVE_URL);
    const body = await controllerWith(getSaveUrl).getSaveUrl(
      requestAs('user-1'),
      'card-1',
    );
    expect(body).toEqual({ url: SAVE_URL });
    // The user comes from the verified session, never from the request body or path.
    expect(getSaveUrl).toHaveBeenCalledWith('user-1', 'card-1');
  });

  it.each([
    [
      'GOOGLE_WALLET_NOT_CONFIGURED',
      409,
      (code: string) => ApiError.conflict(code, 'x'),
    ],
    ['CARD_NOT_FOUND', 404, (code: string) => ApiError.notFound(code, 'x')],
  ] as const)(
    'lets %s through untouched for the global filter to shape',
    async (code, status, make) => {
      const thrown = make(code);
      const getSaveUrl = jest.fn().mockRejectedValue(thrown);
      const call = controllerWith(getSaveUrl).getSaveUrl(
        requestAs('user-1'),
        'card-1',
      );
      await expect(call).rejects.toBe(thrown);
      expect(thrown.getStatus()).toBe(status);
    },
  );

  it('is mounted at GET /v1/cards/:id/google-wallet-pass behind the session guard', () => {
    expect(Reflect.getMetadata('path', GoogleWalletController)).toBe('cards');
    expect(Reflect.getMetadata('__version__', GoogleWalletController)).toBe(
      '1',
    );
    const handler = Object.getOwnPropertyDescriptor(
      GoogleWalletController.prototype,
      'getSaveUrl',
    )!.value as object;
    expect(Reflect.getMetadata('path', handler)).toBe(':id/google-wallet-pass');
    expect(Reflect.getMetadata('__guards__', GoogleWalletController)).toEqual([
      JwtAuthGuard,
    ]);
  });

  it('documents one response per status: 200 with the DTO, 401/404/409 with the shared error DTO', () => {
    const handler = Object.getOwnPropertyDescriptor(
      GoogleWalletController.prototype,
      'getSaveUrl',
    )!.value as object;
    const responses = Reflect.getMetadata(
      'swagger/apiResponse',
      handler,
    ) as Record<string, { type?: unknown }>;
    expect(Object.keys(responses).sort()).toEqual(['200', '401', '404', '409']);
    expect(responses['200'].type).toBe(GoogleWalletSaveUrlResponseDto);
    for (const status of ['401', '404', '409']) {
      expect(responses[status].type).toBe(ApiErrorResponseDto);
    }
  });
});
