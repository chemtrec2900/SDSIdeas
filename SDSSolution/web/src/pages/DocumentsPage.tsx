import { useState, useEffect } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  IconButton,
  InputAdornment,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Alert,
  Pagination,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import DownloadIcon from '@mui/icons-material/Download';
import ShareIcon from '@mui/icons-material/Share';
import { api, type Document } from '../services/api';

export function DocumentsPage() {
  const [query, setQuery] = useState('');
  const [department, setDepartment] = useState('');
  const [site, setSite] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ items: Document[]; total: number; page: number; limit: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const search = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.documents.search({
        q: query || undefined,
        department: department || undefined,
        site: site || undefined,
        page,
        limit: 20,
      });
      setData(res);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    search();
  }, [page]);

  const handleDownload = async (id: string) => {
    try {
      const { url } = await api.documents.download(id);
      window.open(url, '_blank');
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const handleShare = async (id: string) => {
    try {
      const { shareUrl } = await api.documents.share(id, 7);
      await navigator.clipboard.writeText(shareUrl);
      alert('Share link copied to clipboard (7 days expiry)');
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const totalPages = data ? Math.ceil(data.total / 20) : 0;

  return (
    <Box>
      <Typography variant="h4" gutterBottom fontWeight={600}>
        Search Documents
      </Typography>

      <Paper sx={{ p: 2, mb: 3 }} elevation={0} variant="outlined">
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 2,
            alignItems: { xs: 'stretch', sm: 'center' },
          }}
        >
          <TextField
            placeholder="Full text search..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            size="small"
            sx={{ minWidth: { xs: '100%', sm: 220 } }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon color="action" />
                </InputAdornment>
              ),
            }}
          />
          <TextField
            placeholder="Department"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            size="small"
            sx={{ minWidth: { xs: '100%', sm: 120 } }}
          />
          <TextField
            placeholder="Site"
            value={site}
            onChange={(e) => setSite(e.target.value)}
            size="small"
            sx={{ minWidth: { xs: '100%', sm: 120 } }}
          />
          <Button
            variant="contained"
            onClick={() => {
              setPage(1);
              search();
            }}
            disabled={loading}
            startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <SearchIcon />}
          >
            Search
          </Button>
        </Box>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {loading && !data && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {data && (
        <>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {data.total} document(s) found
          </Typography>
          <TableContainer component={Paper} elevation={0} variant="outlined" sx={{ overflowX: 'auto' }}>
            <Table size={isMobile ? 'small' : 'medium'}>
              <TableHead>
                <TableRow sx={{ bgcolor: 'action.hover' }}>
                  <TableCell>Product / Filename</TableCell>
                  <TableCell>Company</TableCell>
                  <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>Department</TableCell>
                  <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>Site</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.items.map((d) => (
                  <TableRow key={d.id} hover>
                    <TableCell>{d.productName ?? d.filename}</TableCell>
                    <TableCell>{d.companyCode}</TableCell>
                    <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>
                      {d.department ?? '-'}
                    </TableCell>
                    <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>
                      {d.site ?? '-'}
                    </TableCell>
                    <TableCell align="right">
                      <IconButton size="small" onClick={() => handleDownload(d.id)} title="Download">
                        <DownloadIcon fontSize="small" />
                      </IconButton>
                      <IconButton size="small" onClick={() => handleShare(d.id)} title="Share">
                        <ShareIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          {totalPages > 1 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
              <Pagination
                count={totalPages}
                page={page}
                onChange={(_, p) => setPage(p)}
                color="primary"
                showFirstButton
                showLastButton
              />
            </Box>
          )}
        </>
      )}
    </Box>
  );
}
