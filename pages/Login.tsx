import React, { useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { Bot, Mail, Lock, Loader2, ArrowRight } from 'lucide-react';

export const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        alert('Cadastro realizado! Verifique seu email para confirmar.');
        setMode('signin');
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }
    } catch (err: any) {
      console.error("Login Error Details:", err);
      let msg = err.message || 'Erro de autenticação';
      if (err.message === 'Invalid login credentials') msg = 'Email ou senha incorretos.';
      if (err.message.includes('Email not confirmed')) msg = 'Email não confirmado. Verifique sua caixa de entrada.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-surface border border-border rounded-2xl p-8 shadow-2xl">

        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center text-emerald-500 mb-4">
            <Bot size={28} />
          </div>
          <h1 className="text-2xl font-bold text-white">TecHub Agent</h1>
          <p className="text-zinc-400 text-sm mt-1">Sua força de vendas autônoma.</p>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase">Email Profissional</label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 text-zinc-500" size={18} />
              <input
                type="email"
                name="email"
                autoComplete="username"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-background border border-border text-white rounded-lg py-2.5 pl-10 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
                placeholder="nome@empresa.com"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase">Senha</label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 text-zinc-500" size={18} />
              <input
                type="password"
                name="password"
                autoComplete="current-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-background border border-border text-white rounded-lg py-2.5 pl-10 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-xs">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary-gradient hover:opacity-90 text-white font-bold py-3 rounded-lg transition-all flex items-center justify-center gap-2 mt-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(16,185,129,0.3)]"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : (
              mode === 'signin' ? 'Entrar no Sistema' : 'Criar Conta'
            )}
            {!loading && <ArrowRight size={18} />}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-zinc-500 text-xs">
            {mode === 'signin' ? 'Ainda não tem conta?' : 'Já tem uma conta?'}
            <button
              onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(null); }}
              className="text-emerald-500 hover:text-emerald-400 ml-1 font-medium transition-colors"
            >
              {mode === 'signin' ? 'Cadastre-se' : 'Fazer Login'}
            </button>
          </p>
        </div>

        <div className="mt-8 pt-6 border-t border-[#27272a] text-center">
          <p className="text-[10px] text-zinc-600">
            Protegido por criptografia de ponta a ponta.
            <br />Powered by Supabase Auth & Gemini AI.
          </p>
        </div>

      </div>
    </div>
  );
};
