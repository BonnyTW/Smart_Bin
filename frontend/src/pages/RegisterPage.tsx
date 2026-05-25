import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { registerAdmin } from '../api';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';

export function RegisterPage() {
  const navigate = useNavigate();
  const { refreshRegistrationStatus } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    try {
      await registerAdmin(email, password);
      await refreshRegistrationStatus();
      navigate('/login', { state: { registered: true } });
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { detail?: string | { msg: string }[] } }; message?: string };
      const detail = ax.response?.data?.detail;
      let msg = 'Registration failed';
      if (typeof detail === 'string') msg = detail;
      else if (Array.isArray(detail) && detail[0]?.msg) msg = detail.map((d) => d.msg).join(', ');
      else if (!ax.response) msg = 'Cannot reach server. Start the backend on http://localhost:8000';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-md mx-auto">
      <Card className="border-blue-500/20">
        <CardHeader>
          <CardTitle className="text-2xl">One-Time Admin Setup</CardTitle>
          <p className="text-sm text-gray-400">
            Create the single administrator account. Registration closes automatically after this step.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <Input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@university.edu" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Password</label>
              <Input type="password" required value={password} onChange={e => setPassword(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Confirm Password</label>
              <Input type="password" required value={confirm} onChange={e => setConfirm(e.target.value)} />
            </div>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Creating admin...' : 'Create Administrator'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
