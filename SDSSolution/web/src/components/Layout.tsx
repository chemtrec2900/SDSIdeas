import { useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import {
  AppBar,
  Box,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import DashboardIcon from '@mui/icons-material/Dashboard';
import SearchIcon from '@mui/icons-material/Search';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import TableChartIcon from '@mui/icons-material/TableChart';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import PeopleIcon from '@mui/icons-material/People';
import LogoutIcon from '@mui/icons-material/Logout';
import { useAuth } from '../contexts/AuthContext';

const DRAWER_WIDTH = 260;

const navItems = [
  { to: '/', label: 'Dashboard', icon: <DashboardIcon /> },
  { to: '/documents', label: 'Documents', icon: <SearchIcon /> },
  { to: '/upload', label: 'Upload', icon: <UploadFileIcon />, roles: ['Admin', 'DocumentEditor'] },
  { to: '/bulk-upload', label: 'Bulk Upload', icon: <CloudUploadIcon />, roles: ['Admin', 'DocumentEditor'] },
  { to: '/import', label: 'Import Excel', icon: <TableChartIcon />, roles: ['Admin', 'DocumentEditor'] },
  { to: '/labels', label: 'Labels', icon: <LocalOfferIcon /> },
  { to: '/contacts', label: 'Contacts', icon: <PeopleIcon />, roles: ['Admin'] },
];

export function Layout() {
  const { user, logout, hasRole } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();

  const filteredNavItems = navItems.filter(
    (item) => !item.roles || item.roles.some((r) => hasRole(r))
  );

  const accountLabel = [user?.accountName, user?.accountNumber].filter(Boolean).join(' • ') || null;

  const drawerContent = (
    <Box sx={{ width: DRAWER_WIDTH, pt: 2 }}>
      {accountLabel && (
        <Box sx={{ px: 2, mb: 2, pb: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'primary.main', lineHeight: 1.3 }}>
            {user?.accountName}
          </Typography>
          {user?.accountNumber && (
            <Typography variant="caption" color="text.secondary">
              {user.accountNumber}
            </Typography>
          )}
        </Box>
      )}
      <Typography variant="h6" sx={{ px: 2, mb: 2, fontWeight: 600, color: 'primary.main' }}>
        SDS Manager
      </Typography>
      <List>
        {filteredNavItems.map((item) => (
          <ListItem key={item.to} disablePadding>
            <ListItemButton
              component={Link}
              to={item.to}
              selected={location.pathname === item.to}
              onClick={() => isMobile && setDrawerOpen(false)}
              sx={{
                mx: 1,
                borderRadius: 1,
                '&.Mui-selected': { bgcolor: 'action.selected' },
              }}
            >
              <ListItemIcon sx={{ minWidth: 40 }}>{item.icon}</ListItemIcon>
              <ListItemText primary={item.label} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <AppBar
        position="fixed"
        sx={{
          width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
          ml: { md: `${DRAWER_WIDTH}px` },
        }}
      >
        <Toolbar>
          {accountLabel && (
            <Box
              sx={{
                display: { xs: 'flex', md: 'none' },
                mr: 1,
                flexDirection: 'column',
                alignItems: 'flex-start',
                minWidth: 0,
                maxWidth: 120,
              }}
            >
              <Typography variant="caption" noWrap sx={{ fontWeight: 600, lineHeight: 1.2 }}>
                {user?.accountName}
              </Typography>
              {user?.accountNumber && (
                <Typography variant="caption" sx={{ opacity: 0.9, fontSize: '0.7rem' }} noWrap>
                  {user.accountNumber}
                </Typography>
              )}
            </Box>
          )}
          <IconButton
            color="inherit"
            edge="start"
            onClick={() => setDrawerOpen(!drawerOpen)}
            sx={{ mr: { xs: 1, md: 2 }, display: { md: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1, display: { xs: 'none', sm: 'block' } }}>
            Safety Document Management
          </Typography>
          <Typography variant="body2" sx={{ display: { xs: 'none', sm: 'block' }, mr: 2 }}>
            {[user?.lastName, user?.firstName].filter(Boolean).join(', ') || user?.email}
          </Typography>
          <IconButton color="inherit" onClick={logout} title="Sign out">
            <LogoutIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      {/* Mobile drawer */}
      <Drawer
        variant="temporary"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box', mt: '64px' },
        }}
      >
        {drawerContent}
      </Drawer>

      {/* Desktop drawer */}
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: 'none', md: 'block' },
          '& .MuiDrawer-paper': {
            width: DRAWER_WIDTH,
            boxSizing: 'border-box',
            mt: '64px',
            borderRight: 1,
            borderColor: 'divider',
          },
        }}
        open
      >
        {drawerContent}
      </Drawer>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 2, sm: 3 },
          mt: '64px',
          ml: { xs: 0, md: `${DRAWER_WIDTH}px` },
          width: { xs: '100%', md: `calc(100% - ${DRAWER_WIDTH}px)` },
          minHeight: 'calc(100vh - 64px)',
          bgcolor: 'background.default',
        }}
      >
        <Outlet />
      </Box>
    </Box>
  );
}
