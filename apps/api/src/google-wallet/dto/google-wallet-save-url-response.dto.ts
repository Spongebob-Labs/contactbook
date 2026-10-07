import { ApiProperty } from '@nestjs/swagger';

export class GoogleWalletSaveUrlResponseDto {
  @ApiProperty({
    example:
      'https://pay.google.com/gp/v/save/eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJ3YWxsZXRAY29udGFjdGJvb2suaWFtLmdzZXJ2aWNlYWNjb3VudC5jb20iLCJhdWQiOiJnb29nbGUiLCJ0eXAiOiJzYXZldG93YWxsZXQifQ.c2lnbmF0dXJl',
    description:
      'Google\'s "Save to Google Wallet" link for this card. Navigate the browser to it ' +
      '(do not fetch it). The signed JWT in the path names the pass object by ID only — ' +
      'it carries no card data.',
  })
  url!: string;
}
