import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createBin, changePassword } from '../api';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';

export function AdminPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [maxDepth, setMaxDepth] = useState('100');
  const [threshold, setThreshold] = useState('80');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');

  const createMutation = useMutation({
    mutationFn: createBin,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bins'] });
      setName('');
      setLocation('');
      setMaxDepth('100');
      setThreshold('80');
    },
  });

  const passwordMutation = useMutation({
    mutationFn: () => changePassword(currentPassword, newPassword),
    onSuccess: () => {
      setPwSuccess('Password updated successfully.');
      setPwError('');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    },
    onError: (err: unknown) => {
      const ax = err as { response?: { data?: { detail?: string } } };
      setPwError(ax.response?.data?.detail || 'Failed to update password');
      setPwSuccess('');
    },
  });

  const handleBinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      name,
      location,
      max_depth_cm: parseInt(maxDepth, 10),
      threshold_pct: parseInt(threshold, 10),
    });
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPwError('');
    setPwSuccess('');
    if (newPassword !== confirmPassword) {
      setPwError('New passwords do not match');
      return;
    }
    if (newPassword.length < 6) {
      setPwError('New password must be at least 6 characters');
      return;
    }
    passwordMutation.mutate();
  };

  return (
    <div className="p-8 max-w-2xl mx-auto space-y-8">
      <h1 className="text-4xl font-bold">Admin Console</h1>
      <p className="text-gray-400">Signed in as {user?.email}</p>

      <Card className="border-amber-500/20">
        <CardHeader>
          <CardTitle>Change password</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Current password</label>
              <Input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">New password</label>
              <Input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Confirm new password</label>
              <Input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
            {pwError && <p className="text-sm text-red-400">{pwError}</p>}
            {pwSuccess && <p className="text-sm text-green-400">{pwSuccess}</p>}
            <Button type="submit" disabled={passwordMutation.isPending}>
              {passwordMutation.isPending ? 'Updating...' : 'Update password'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Register new bin</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleBinSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Bin name</label>
              <Input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Main Lobby Bin" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Location</label>
              <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Ground floor" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Max depth (cm)</label>
                <Input type="number" required min={10} value={maxDepth} onChange={(e) => setMaxDepth(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Fill alert threshold (%)</label>
                <Input type="number" required min={10} max={100} value={threshold} onChange={(e) => setThreshold(e.target.value)} />
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Saving...' : 'Register bin'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
