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
  List,
  ListItem,
  ListItemText,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import { api } from '../services/api';

export function BulkUploadPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [companyCode, setCompanyCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ uploaded: number; failed: number; errors: string[] } | null>(null);
  const navigate = useNavigate();

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files;
    setFiles(f ? Array.from(f) : []);
    setResult(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (files.length === 0) {
      setError('Select files');
      return;
    }
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await api.documents.bulkUpload(files, companyCode || 'default');
      setResult(res);
      if (res.uploaded > 0) navigate('/documents');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 560, mx: 'auto' }}>
      <Typography variant="h4" gutterBottom fontWeight={600}>
        Bulk Upload (Admin)
      </Typography>
      <Card elevation={0} variant="outlined">
        <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
          <form onSubmit={handleSubmit}>
            <TextField
              fullWidth
              label="Company Code"
              value={companyCode}
              onChange={(e) => setCompanyCode(e.target.value)}
              placeholder="e.g. ACME001"
              required
              sx={{ mb: 2 }}
            />
            <Button
              variant="outlined"
              component="label"
              fullWidth
              sx={{ mb: 2, py: 2 }}
              startIcon={<CloudUploadIcon />}
            >
              Choose files
              <input type="file" multiple hidden onChange={handleFiles} />
            </Button>
            {files.length > 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {files.length} file(s) selected
              </Typography>
            )}
            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}
            {result && (
              <Alert severity={result.failed > 0 ? 'warning' : 'success'} sx={{ mb: 2 }}>
                Uploaded: {result.uploaded}, Failed: {result.failed}
                {result.errors.length > 0 && (
                  <List dense sx={{ mt: 1 }}>
                    {result.errors.slice(0, 5).map((e, i) => (
                      <ListItem key={i}>
                        <ListItemText primary={e} primaryTypographyProps={{ variant: 'caption' }} />
                      </ListItem>
                    ))}
                  </List>
                )}
              </Alert>
            )}
            <Button
              type="submit"
              variant="contained"
              fullWidth
              disabled={loading || files.length === 0}
              startIcon={loading ? <CircularProgress size={20} color="inherit" /> : null}
            >
              Upload {files.length} file(s)
            </Button>
          </form>
        </CardContent>
      </Card>
    </Box>
  );
}
