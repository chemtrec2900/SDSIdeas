import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  CardContent,
  TextField,
  Typography,
  Alert,
  CircularProgress,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import { api } from '../services/api';

export function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [productName, setProductName] = useState('');
  const [department, setDepartment] = useState('');
  const [site, setSite] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError('Select a file');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      if (productName) fd.append('productName', productName);
      if (department) fd.append('department', department);
      if (site) fd.append('site', site);
      await api.documents.upload(fd);
      navigate('/documents');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 520, mx: 'auto' }}>
      <Typography variant="h4" gutterBottom fontWeight={600}>
        Upload Document
      </Typography>
      <Card elevation={0} variant="outlined">
        <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
          <form onSubmit={handleSubmit}>
            <Button
              variant="outlined"
              component="label"
              fullWidth
              sx={{ mb: 2, py: 2 }}
              startIcon={<CloudUploadIcon />}
            >
              {file ? file.name : 'Choose file'}
              <input type="file" hidden onChange={(e) => setFile(e.target.files?.[0] ?? null)} required />
            </Button>
            <TextField
              fullWidth
              label="Product Name"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="Department"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="Site"
              value={site}
              onChange={(e) => setSite(e.target.value)}
              sx={{ mb: 2 }}
            />
            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}
            <Button type="submit" variant="contained" fullWidth disabled={loading} startIcon={loading ? <CircularProgress size={20} color="inherit" /> : null}>
              Upload
            </Button>
          </form>
        </CardContent>
      </Card>
    </Box>
  );
}
