import { useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  Alert,
  CircularProgress,
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import { api } from '../services/api';

export function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ updated: number } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError('Select an Excel file');
      return;
    }
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await api.documents.importExcel(file);
      setResult(res);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      const res = await api.documents.exportExcel();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'documents-metadata.xlsx';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert((err as Error).message);
    }
  };

  return (
    <Box sx={{ maxWidth: 560, mx: 'auto' }}>
      <Typography variant="h4" gutterBottom fontWeight={600}>
        Import / Export Metadata (Excel)
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Export document metadata to Excel, edit in spreadsheet view, then import to bulk update.
      </Typography>
      <Card elevation={0} variant="outlined">
        <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
          <Button
            variant="outlined"
            fullWidth
            sx={{ mb: 3 }}
            startIcon={<DownloadIcon />}
            onClick={handleExport}
          >
            Export to Excel
          </Button>
          <form onSubmit={handleSubmit}>
            <Button
              variant="contained"
              component="label"
              fullWidth
              sx={{ mb: 2, py: 2 }}
              startIcon={<UploadFileIcon />}
            >
              Choose Excel file
              <input type="file" accept=".xlsx,.xls" hidden onChange={(e) => setFile(e.target.files?.[0] ?? null)} required />
            </Button>
            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}
            {result && (
              <Alert severity="success" sx={{ mb: 2 }}>
                Updated {result.updated} document(s)
              </Alert>
            )}
            <Button
              type="submit"
              variant="contained"
              fullWidth
              disabled={loading}
              startIcon={loading ? <CircularProgress size={20} color="inherit" /> : null}
            >
              Import
            </Button>
          </form>
        </CardContent>
      </Card>
    </Box>
  );
}
