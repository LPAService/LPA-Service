import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getLoginCallbackUrl } from '@/lib/login-callback';
import { middleware } from '@/middleware';
import { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

vi.mock('next-auth/jwt', () => ({
  getToken: vi.fn(),
}));

describe('getLoginCallbackUrl', () => {
  it('retorna "/" quando valor é vazio, nulo ou indefinido', () => {
    expect(getLoginCallbackUrl(null)).toBe('/');
    expect(getLoginCallbackUrl(undefined)).toBe('/');
    expect(getLoginCallbackUrl('')).toBe('/');
  });

  it('preserva rotas internas relativas simples', () => {
    expect(getLoginCallbackUrl('/')).toBe('/');
    expect(getLoginCallbackUrl('/cotacoes')).toBe('/cotacoes');
    expect(getLoginCallbackUrl('/relatorios/pre-orcamento')).toBe('/relatorios/pre-orcamento');
  });

  it('preserva query params e hash em rotas internas', () => {
    expect(getLoginCallbackUrl('/cotacoes?cidade=Belo+Horizonte&status=ABERTO')).toBe(
      '/cotacoes?cidade=Belo+Horizonte&status=ABERTO'
    );
    expect(getLoginCallbackUrl('/itens?q=arroz&ordem=asc#lista')).toBe(
      '/itens?q=arroz&ordem=asc#lista'
    );
  });

  it('evita redirect loops para /login', () => {
    expect(getLoginCallbackUrl('/login')).toBe('/');
    expect(getLoginCallbackUrl('/login?callbackUrl=/cotacoes')).toBe('/');
  });

  it('bloqueia open redirect com protocolo explícito', () => {
    expect(getLoginCallbackUrl('https://evil.com')).toBe('/');
    expect(getLoginCallbackUrl('http://attacker.com/cotacoes')).toBe('/');
    expect(getLoginCallbackUrl('javascript:alert(1)')).toBe('/');
    expect(getLoginCallbackUrl('data:text/html,<script>alert(1)</script>')).toBe('/');
  });

  it('bloqueia open redirect com URLs relativas ao protocolo', () => {
    expect(getLoginCallbackUrl('//evil.com')).toBe('/');
    expect(getLoginCallbackUrl('//evil.com/path')).toBe('/');
    expect(getLoginCallbackUrl('///evil.com')).toBe('/');
  });

  it('bloqueia caracteres de controle e barras invertidas', () => {
    expect(getLoginCallbackUrl('/\\evil.com')).toBe('/');
    expect(getLoginCallbackUrl('/ evil.com')).toBe('/');
    expect(getLoginCallbackUrl('/\tevil.com')).toBe('/');
    expect(getLoginCallbackUrl('/path\nwith\rnewline')).toBe('/');
  });

  it('normaliza navegação relativa com pontos', () => {
    expect(getLoginCallbackUrl('/cotacoes/../relatorios')).toBe('/relatorios');
  });
});

describe('middleware redirect preserving query and pathname', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redireciona rota protegida não-autenticada preservando pathname e query params', async () => {
    vi.mocked(getToken).mockResolvedValue(null);

    const req = new NextRequest('https://app.caixaescolar.com.br/cotacoes?cidade=Belo+Horizonte&status=ABERTO');
    const res = await middleware(req);

    expect(res.status).toBe(307);
    const location = res.headers.get('location');
    expect(location).toBeDefined();

    const redirectUrl = new URL(location!);
    expect(redirectUrl.pathname).toBe('/login');
    expect(redirectUrl.searchParams.get('callbackUrl')).toBe('/cotacoes?cidade=Belo+Horizonte&status=ABERTO');
  });

  it('redireciona rota protegida sem query preservando pathname no callbackUrl', async () => {
    vi.mocked(getToken).mockResolvedValue(null);

    const req = new NextRequest('https://app.caixaescolar.com.br/relatorios');
    const res = await middleware(req);

    expect(res.status).toBe(307);
    const location = res.headers.get('location');
    const redirectUrl = new URL(location!);
    expect(redirectUrl.pathname).toBe('/login');
    expect(redirectUrl.searchParams.get('callbackUrl')).toBe('/relatorios');
  });

  it('permite acesso direto quando usuário possui token válido', async () => {
    vi.mocked(getToken).mockResolvedValue({ sub: 'user-1' });

    const req = new NextRequest('https://app.caixaescolar.com.br/cotacoes?cidade=BH');
    const res = await middleware(req);

    expect(res.status).toBe(200);
    expect(res.headers.get('location')).toBeNull();
  });
});
