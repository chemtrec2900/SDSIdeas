import { Box, Card, CardContent, Typography } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import TableChartIcon from '@mui/icons-material/TableChart';
import ShareIcon from '@mui/icons-material/Share';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';

const features = [
  {
    icon: <SearchIcon fontSize="large" color="primary" />,
    title: 'Search documents',
    desc: 'Search by metadata and full text',
  },
  {
    icon: <FilterListIcon fontSize="large" color="primary" />,
    title: 'Filter by tags',
    desc: 'Filter by company, department, or site',
  },
  {
    icon: <CloudUploadIcon fontSize="large" color="primary" />,
    title: 'Upload & metadata',
    desc: 'Upload documents and apply metadata',
  },
  {
    icon: <TableChartIcon fontSize="large" color="primary" />,
    title: 'Export/Import Excel',
    desc: 'Bulk metadata via spreadsheet',
  },
  {
    icon: <ShareIcon fontSize="large" color="primary" />,
    title: 'Anonymous sharing',
    desc: 'Share documents with time-limited links',
  },
  {
    icon: <LocalOfferIcon fontSize="large" color="primary" />,
    title: 'Print labels',
    desc: 'Print Safety Data Sheet labels',
  },
];

export function DashboardPage() {
  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom fontWeight={600}>
          Dashboard
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Welcome to the Safety Document Management system. Use the sidebar to search, upload, or
          manage documents.
        </Typography>
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' }, gap: 2 }}>
        {features.map((f, i) => (
          <Box key={i}>
            <Card sx={{ height: '100%' }} elevation={0} variant="outlined">
              <CardContent sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                <Box sx={{ mt: 0.5 }}>{f.icon}</Box>
                <Box>
                  <Typography variant="subtitle1" fontWeight={600}>
                    {f.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {f.desc}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
