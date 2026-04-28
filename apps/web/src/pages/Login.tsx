import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuthStore } from '../store/authStore';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [captchaRequired, setCaptchaRequired] = useState(false);
  const [captchaSvg, setCaptchaSvg] = useState('');
  const [captchaId, setCaptchaId] = useState('');
  const [captchaAnswer, setCaptchaAnswer] = useState('');
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  // Check if captcha is needed when username changes
  useEffect(() => {
    if (username.length >= 2) {
      const timer = setTimeout(async () => {
        try {
          const res = await api.checkCaptchaRequired(username);
          if (res.required) {
            fetchCaptcha();
          }
        } catch {
          // ignore
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [username]);

  async function fetchCaptcha() {
    try {
      const res = await api.getCaptcha(username);
      setCaptchaRequired(true);
      setCaptchaSvg(res.svg);
      setCaptchaId(res.captcha_id);
    } catch {
      // ignore
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    try {
      if (captchaRequired && captchaId) {
        const capRes = await api.verifyCaptcha(captchaId, username, captchaAnswer);
        if (!capRes.valid) {
          setError('Captcha answer is incorrect');
          fetchCaptcha();
          return;
        }
      }

      const res = await api.login(username, password);
      setAuth(res.token, res.user);
      navigate('/');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      // Check if captcha is now required
      if (msg.includes('captchaRequired') || msg.includes('Captcha required')) {
        setCaptchaRequired(true);
        fetchCaptcha();
        setError('Too many failed attempts. Please complete the captcha.');
      } else {
        setError(msg.replace('API error 401: ', '').replace('API error 409: ', ''));
      }
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <div className="w-full max-w-sm p-8 bg-gray-900 rounded-xl shadow-lg">
        <h1 className="text-2xl font-bold text-white mb-6 text-center">
          TaskTree
        </h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
              required
              minLength={2}
              autoComplete="username"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
              required
              minLength={4}
              autoComplete="current-password"
            />
          </div>

          {captchaRequired && captchaSvg && (
            <div>
              <label className="block text-sm text-gray-400 mb-1">Captcha</label>
              <div className="flex items-center gap-3">
                <div
                  className="bg-white rounded"
                  dangerouslySetInnerHTML={{ __html: captchaSvg }}
                />
                <input
                  type="text"
                  value={captchaAnswer}
                  onChange={(e) => setCaptchaAnswer(e.target.value)}
                  className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  placeholder="Answer"
                  required
                />
              </div>
            </div>
          )}

          {error && (
            <div className="text-red-400 text-sm bg-red-900/30 border border-red-800 rounded-lg p-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="w-full py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition"
          >
            Login
          </button>
        </form>
      </div>
    </div>
  );
}
