import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { loginAdmin } from '../api';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, registrationOpen, isLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const registered = (location.state as { registered?: boolean })?.registered;
  const registrationClosed = (location.state as { registrationClosed?: boolean })?.registrationClosed;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { access_token } = await loginAdmin(email, password);
      login(access_token);
      const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/';
      navigate(from, { replace: true });
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { detail?: string } }; message?: string };
      if (!ax.response) setError('Cannot reach server. Start the backend on http://localhost:8000');
      else setError(typeof ax.response?.data?.detail === 'string' ? ax.response.data.detail : 'Incorrect email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-md mx-auto">
      <Card className="border-blue-500/20">
        <CardHeader>
          <CardTitle className="text-2xl">Admin Login</CardTitle>
          <p className="text-sm text-gray-400">Sign in with the administrator account.</p>
        </CardHeader>
        <CardContent>
          {registered && (
            <p className="text-sm text-green-400 mb-4 bg-green-500/10 p-2 rounded">
              Administrator created. Registration is now closed — please log in.
            </p>
          )}
          {registrationClosed && (
            <p className="text-sm text-amber-400 mb-4 bg-amber-500/10 p-2 rounded">
              Admin registration is closed. Only login is available.
            </p>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <Input type="email" required value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Password</label>
              <Input type="password" required value={password} onChange={e => setPassword(e.target.value)} />
            </div>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Logging in...' : 'Log In'}
            </Button>
          </form>
          {!isLoading && registrationOpen && (
            <p className="text-sm text-gray-500 mt-4 text-center">
              First time?{' '}
              <Link to="/register" className="text-blue-400 hover:underline">
                One-time admin setup
              </Link>
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
