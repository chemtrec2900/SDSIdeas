import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Alert, Box, Button, Card, CardContent, CircularProgress, Typography } from '@mui/material';
import { useAuth } from '../contexts/AuthContext';

export function AuthCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const message = searchParams.get('message');
  const hasError = searchParams.get('error');
  const [error, setError] = useState(token ? '' : message ?? (hasError ? 'Microsoft sign-in failed.' : 'Missing sign-in token.'));
  const { loginWithToken } = useAuth();

  useEffect(() => {
    if (!token) return;

    loginWithToken(token)
      .then(() => navigate('/', { replace: true }))
      .catch((err: Error) => {
        setError(err.message || 'Unable to complete sign-in.');
      });
  }, [loginWithToken, navigate, token]);

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 2,
        bgcolor: 'background.default',
      }}
    >
      <Card sx={{ maxWidth: 480, width: '100%' }} elevation={2}>
        <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
          <Typography variant="h6" component="h1" gutterBottom fontWeight={600}>
            Microsoft Sign-In
          </Typography>
          {error ? (
            <>
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
              <Button component={Link} to="/register" variant="contained" fullWidth sx={{ mb: 1 }}>
                Register
              </Button>
              <Button component={Link} to="/login" variant="text" fullWidth>
                Back to login
              </Button>
            </>
          ) : (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CircularProgress size={20} />
              <Typography variant="body2" color="text.secondary">
                Completing sign-in...
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
