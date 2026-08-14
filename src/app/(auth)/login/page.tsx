'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError('Credenciais inválidas. Verifique seu email e senha.');
      } else {
        router.push('/');
      }
    } catch (err) {
      setError('Erro ao fazer login. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 bg-[var(--color-bg-subtle)]"
      style={{ fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}
    >
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-[var(--color-border)]">
        <div className="text-center mb-8">
          <img src="/lpa-mark.png" alt="LPA Service - Manutenção Industrial" className="mx-auto h-24 mb-6 rounded-lg bg-[#0A1A2F] p-3" />
          <h1 className="text-3xl font-bold text-[#17231f]">Caixa Escolar MG</h1>
          <p className="text-[#52615a] mt-2">Portal de Fornecedores</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-[#17231f] mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 bg-white border border-[var(--color-border)] rounded-xl focus:outline-none focus:border-[var(--color-primary)] text-[#17231f]"
              placeholder="admin@caixaescolar.com.br"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-[#17231f] mb-1">
              Senha
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-3 bg-white border border-[var(--color-border)] rounded-xl focus:outline-none focus:border-[var(--color-primary)] text-[#17231f]"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-red-500 text-sm text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-[var(--color-primary)] text-[var(--color-primary-fg)] font-semibold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-70"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <p className="text-center text-xs text-[#52615a] mt-6">
          © 2026 Caixa Escolar MG - Todos os direitos reservados
        </p>
      </div>
    </div>
  );
}
