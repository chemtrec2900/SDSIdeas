import { useState } from 'react';
import {
  Box,
  Button,
  Paper,
  TextField,
  Typography,
  Alert,
} from '@mui/material';
import PrintIcon from '@mui/icons-material/Print';
import LabelIcon from '@mui/icons-material/Label';
import { api } from '../services/api';

interface LabelData {
  productName: string;
  companyCode: string;
  department?: string;
  site?: string;
  filename: string;
}

export function LabelsPage() {
  const [docId, setDocId] = useState('');
  const [label, setLabel] = useState<LabelData | null>(null);
  const [error, setError] = useState('');

  const fetchLabel = async () => {
    if (!docId.trim()) return;
    setError('');
    try {
      const data = await api.documents.getLabel(docId);
      setLabel(data);
    } catch (err) {
      setError((err as Error).message);
      setLabel(null);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <Box sx={{ maxWidth: 560, mx: 'auto' }}>
      <Typography variant="h4" gutterBottom fontWeight={600}>
        Print Safety Data Sheet Labels
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Enter a document ID to load label data, then print.
      </Typography>
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <TextField
          placeholder="Document ID"
          value={docId}
          onChange={(e) => setDocId(e.target.value)}
          size="small"
          sx={{ flex: 1, minWidth: 200 }}
        />
        <Button variant="contained" onClick={fetchLabel} startIcon={<LabelIcon />}>
          Load Label
        </Button>
      </Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {label && (
        <Paper className="print-label" variant="outlined" sx={{ p: 3, mb: 2 }}>
          <Typography variant="h6" gutterBottom fontWeight={600}>
            {label.productName}
          </Typography>
          <Typography variant="body2">
            <strong>Company:</strong> {label.companyCode}
          </Typography>
          {label.department && (
            <Typography variant="body2">
              <strong>Department:</strong> {label.department}
            </Typography>
          )}
          {label.site && (
            <Typography variant="body2">
              <strong>Site:</strong> {label.site}
            </Typography>
          )}
          <Typography variant="body2">
            <strong>Document:</strong> {label.filename}
          </Typography>
          <Button
            variant="contained"
            startIcon={<PrintIcon />}
            onClick={handlePrint}
            sx={{ mt: 2 }}
            className="no-print"
          >
            Print Label
          </Button>
        </Paper>
      )}
    </Box>
  );
}
