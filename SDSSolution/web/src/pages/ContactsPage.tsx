import { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControlLabel,
  Checkbox,
  Chip,
  Alert,
  CircularProgress,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import PeopleIcon from '@mui/icons-material/People';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const ROLE_LABELS: Record<string, string> = {
  CFBAdminContact: 'Admin',
  chem_msdscontributor: 'Contributor',
  chemtrec_sdsauthoring: 'SDS Authoring',
  chemtrec_sdsaccess: 'SDS Access (Viewer)',
};

function getRoleLabel(key: string): string {
  return ROLE_LABELS[key] ?? key;
}

export function ContactsPage() {
  const { hasRole } = useAuth();
  const [contacts, setContacts] = useState<
    {
      contactId: string;
      firstName: string;
      lastName: string;
      email: string;
      roles: string[];
      d365Roles: Record<string, boolean>;
      account?: { name?: string; accountnumber?: string };
    }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editContact, setEditContact] = useState<{
    contactId: string;
    firstName: string;
    lastName: string;
    d365Roles: Record<string, boolean>;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [editRoles, setEditRoles] = useState<Record<string, boolean>>({});

  const loadContacts = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.users.list();
      setContacts(data.contacts);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const isAdmin = hasRole('Admin');
  useEffect(() => {
    if (isAdmin) loadContacts();
  }, [isAdmin]);

  const openEdit = (c: (typeof contacts)[0]) => {
    setEditContact({
      contactId: c.contactId,
      firstName: c.firstName,
      lastName: c.lastName,
      d365Roles: { ...c.d365Roles },
    });
    setEditRoles({ ...c.d365Roles });
  };

  const closeEdit = () => {
    setEditContact(null);
  };

  const saveRoles = async () => {
    if (!editContact) return;
    setSaving(true);
    try {
      await api.users.updateRoles(editContact.contactId, editRoles);
      await loadContacts();
      closeEdit();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const roleKeys = Object.keys(ROLE_LABELS);

  if (!hasRole('Admin')) {
    return (
      <Box>
        <Typography variant="h4" gutterBottom fontWeight={600}>
          Contacts
        </Typography>
        <Alert severity="info">Admin access required to manage contacts and roles.</Alert>
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
        <PeopleIcon color="primary" />
        <Typography variant="h4" fontWeight={600}>
          Account Contacts
        </Typography>
      </Box>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
        View and manage roles for contacts in your account.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Card>
          <CardContent>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell><strong>First Name</strong></TableCell>
                    <TableCell><strong>Last Name</strong></TableCell>
                    <TableCell><strong>Email</strong></TableCell>
                    <TableCell><strong>App Roles</strong></TableCell>
                    <TableCell><strong>D365 Role Flags</strong></TableCell>
                    <TableCell align="right"><strong>Actions</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {contacts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                        No contacts found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    contacts.map((c) => (
                      <TableRow key={c.contactId}>
                        <TableCell>{c.firstName}</TableCell>
                        <TableCell>{c.lastName}</TableCell>
                        <TableCell>{c.email}</TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                            {c.roles.map((r) => (
                              <Chip key={r} label={r} size="small" variant="outlined" />
                            ))}
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                            {roleKeys.filter((k) => c.d365Roles[k]).map((k) => (
                              <Chip key={k} label={getRoleLabel(k)} size="small" color="primary" variant="filled" />
                            ))}
                            {roleKeys.every((k) => !c.d365Roles[k]) && (
                              <Typography variant="caption" color="text.secondary">Viewer</Typography>
                            )}
                          </Box>
                        </TableCell>
                        <TableCell align="right">
                          <Button size="small" startIcon={<EditIcon />} onClick={() => openEdit(c)}>
                            Edit Roles
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!editContact} onClose={closeEdit} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Roles – {editContact ? `${editContact.firstName} ${editContact.lastName}` : ''}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Toggle D365 role flags. Changes are saved to Dynamics 365.
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {roleKeys.map((key) => (
              <FormControlLabel
                key={key}
                control={
                  <Checkbox
                    checked={editRoles[key] ?? false}
                    onChange={(_, checked) => setEditRoles((prev) => ({ ...prev, [key]: checked }))}
                  />
                }
                label={getRoleLabel(key)}
              />
            ))}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeEdit}>Cancel</Button>
          <Button variant="contained" onClick={saveRoles} disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
