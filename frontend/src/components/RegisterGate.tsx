import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { RegisterPage } from '../pages/RegisterPage';

/** Only allows registration when no admin exists yet. */
export function RegisterGate() {
  const { isLoading, registrationOpen } = useAuth();

  useEffect(() => {
    document.title = 'Register Admin — SmartBin';
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (!registrationOpen) {
    return <Navigate to="/login" replace state={{ registrationClosed: true }} />;
  }

  return <RegisterPage />;
}
