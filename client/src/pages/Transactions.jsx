import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { useTheme } from '../context/ThemeContext';
import { CATEGORIES } from '../constants/categories';
import {
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  InputLabel,
  FormControl,
  IconButton,
  Alert,
  CircularProgress,
  Chip
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search,
  FilterAlt,
  Warning,
  ReceiptLong
} from '@mui/icons-material';

export default function Transactions() {
  const { theme } = useTheme();
  
  // State variables
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Filter states
  const [typeFilter, setTypeFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState('desc');

  // Modal states
  const [openDialog, setOpenDialog] = useState(false);
  const [dialogMode, setDialogMode] = useState('add'); // 'add' or 'edit'
  const [selectedTxId, setSelectedTxId] = useState(null);
  const [formFields, setFormFields] = useState({
    amount: '',
    type: 'expense',
    category: 'Food',
    description: '',
    date: new Date().toISOString().substring(0, 10)
  });
  const [formError, setFormError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // CSV/Spreadsheet Statement Import States
  const [openImportDialog, setOpenImportDialog] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importError, setImportError] = useState('');
  const [importRows, setImportRows] = useState([]);
  const [importPreviewRows, setImportPreviewRows] = useState([]);
  const [importLoading, setImportLoading] = useState(false);
  const [importPasteText, setImportPasteText] = useState('');
  const [importModeTab, setImportModeTab] = useState('file'); // 'file' or 'paste'

  // Delimiter-aware client-side CSV and tab-separated text parser
  const parseSpreadsheetData = (text) => {
    try {
      const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
      if (lines.length === 0) return [];

      const firstLine = lines[0];
      const separator = firstLine.includes('\t') ? '\t' : ',';

      const splitFields = (line) => {
        if (separator === '\t') return line.split('\t');
        
        const result = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
          } else {
            current += char;
          }
        }
        result.push(current.trim());
        return result;
      };

      const parsedLines = lines.map(splitFields);
      if (parsedLines.length < 2) {
        throw new Error('Spreadsheet has insufficient rows. Ensure you include a header row and data.');
      }

      const headers = parsedLines[0].map(h => h.toLowerCase().trim());
      
      let dateIdx = -1;
      let descIdx = -1;
      let amountIdx = -1;
      let typeIdx = -1;

      headers.forEach((h, idx) => {
        if (h.includes('date') || h.includes('time')) dateIdx = idx;
        else if (h.includes('desc') || h.includes('narr') || h.includes('remark') || h.includes('particular')) descIdx = idx;
        else if (h.includes('amount') || h.includes('amt') || h.includes('val') || h.includes('withdraw') || h.includes('credit')) amountIdx = idx;
        else if (h.includes('type') || h.includes('dr/cr') || h.includes('dir')) typeIdx = idx;
      });

      if (dateIdx === -1) dateIdx = 0;
      if (descIdx === -1) descIdx = parsedLines[0].length > 1 ? 1 : 0;
      if (amountIdx === -1) amountIdx = parsedLines[0].length > 2 ? 2 : 0;
      if (typeIdx === -1) typeIdx = parsedLines[0].length > 3 ? 3 : -1;

      const dataRows = [];
      const startRow = (headers.includes('date') || headers.includes('amount') || headers.includes('description')) ? 1 : 0;

      for (let i = startRow; i < parsedLines.length; i++) {
        const fields = parsedLines[i];
        if (fields.length <= Math.max(dateIdx, descIdx, amountIdx)) continue;

        const dateRaw = fields[dateIdx] || '';
        const descRaw = fields[descIdx] || '';
        const amtRaw = fields[amountIdx] || '';
        const typeRaw = typeIdx !== -1 ? fields[typeIdx] : '';

        let amount = parseFloat(amtRaw.replace(/[^0-9.-]/g, ''));
        if (isNaN(amount)) continue;

        let dateVal = new Date().toISOString().substring(0, 10);
        try {
          const parsedDate = new Date(dateRaw);
          if (!isNaN(parsedDate.getTime())) {
            dateVal = parsedDate.toISOString().substring(0, 10);
          }
        } catch (_) {}

        let typeVal = 'expense';
        const typeLower = typeRaw.toLowerCase();
        if (typeLower.includes('credit') || typeLower.includes('cr') || typeLower.includes('income') || typeLower.includes('dep') || amount > 0) {
          typeVal = 'income';
        }
        
        dataRows.push({
          date: dateVal,
          description: descRaw || 'Imported Transaction',
          amount: Math.abs(amount),
          type: typeVal,
          category: 'Others'
        });
      }

      if (dataRows.length === 0) {
        throw new Error('No valid transaction rows found in file.');
      }
      return dataRows;
    } catch (err) {
      console.error('Spreadsheet parse error:', err);
      throw new Error(err.message || 'Failed to parse file. Check column headers.');
    }
  };

  const handleOpenImport = () => {
    setOpenImportDialog(true);
    setImportFile(null);
    setImportError('');
    setImportRows([]);
    setImportPreviewRows([]);
    setImportPasteText('');
  };

  const handleCloseImport = () => {
    setOpenImportDialog(false);
  };

  const handleFileSelected = (file) => {
    setImportFile(file);
    setImportError('');
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      try {
        const parsed = parseSpreadsheetData(text);
        setImportRows(parsed);
        handleProcessImport(parsed);
      } catch (err) {
        setImportError(err.message);
      }
    };
    reader.onerror = () => {
      setImportError('Failed to read file content.');
    };
    reader.readAsText(file);
  };

  const handleProcessImport = async (rowsData) => {
    if (!rowsData || rowsData.length === 0) {
      setImportError('No transaction rows detected to classify.');
      return;
    }
    setImportLoading(true);
    setImportError('');
    try {
      const res = await api.post('/transactions/import-preview', { rows: rowsData });
      setImportPreviewRows(res.data);
    } catch (err) {
      console.error('Import preview classification error:', err);
      setImportError('Failed to query ML classification service. Check network/server connections.');
    } finally {
      setImportLoading(false);
    }
  };

  const handlePreviewRowChange = (index, field, value) => {
    const updated = [...importPreviewRows];
    updated[index][field] = value;
    setImportPreviewRows(updated);
  };

  const handleDeletePreviewRow = (index) => {
    const updated = [...importPreviewRows];
    updated.splice(index, 1);
    setImportPreviewRows(updated);
  };

  const handleSaveImport = async () => {
    setImportLoading(true);
    setImportError('');
    try {
      const res = await api.post('/transactions/import', { rows: importPreviewRows });
      setOpenImportDialog(false);
      fetchTransactions();
    } catch (err) {
      console.error('Submit import error:', err);
      setImportError(err.response?.data?.message || 'Failed to submit bulk imports.');
    } finally {
      setImportLoading(false);
    }
  };

  const fetchTransactions = async () => {
    setLoading(true);
    setError('');
    try {
      // Build query string
      let queryParams = [];
      if (typeFilter) queryParams.push(`type=${typeFilter}`);
      if (categoryFilter) queryParams.push(`category=${categoryFilter}`);
      if (sortBy) queryParams.push(`sortBy=${sortBy}`);
      if (sortOrder) queryParams.push(`order=${sortOrder}`);

      const url = `/transactions?${queryParams.join('&')}`;
      const res = await api.get(url);
      setTransactions(res.data);
    } catch (err) {
      console.error('Fetch transactions error:', err);
      setError('Could not retrieve transaction history.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [typeFilter, categoryFilter, sortBy, sortOrder]);

  const handleOpenAdd = () => {
    setDialogMode('add');
    setFormFields({
      amount: '',
      type: 'expense',
      category: 'Food',
      description: '',
      date: new Date().toISOString().substring(0, 10)
    });
    setFormError('');
    setOpenDialog(true);
  };

  const handleOpenEdit = (tx) => {
    setDialogMode('edit');
    setSelectedTxId(tx._id);
    setFormFields({
      amount: tx.amount,
      type: tx.type,
      category: tx.category,
      description: tx.description || '',
      date: new Date(tx.date).toISOString().substring(0, 10)
    });
    setFormError('');
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
  };

  const handleInputChange = (e) => {
    setFormFields({ ...formFields, [e.target.name]: e.target.value });
    setFormError('');
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!formFields.amount || Number(formFields.amount) <= 0) {
      setFormError('Please enter a valid amount greater than 0.');
      return;
    }
    if (!formFields.category) {
      setFormError('Category is required.');
      return;
    }

    setActionLoading(true);
    try {
      if (dialogMode === 'add') {
        await api.post('/transactions', formFields);
      } else {
        await api.put(`/transactions/${selectedTxId}`, formFields);
      }
      setOpenDialog(false);
      fetchTransactions();
    } catch (err) {
      console.error('Save transaction error:', err);
      setFormError(err.response?.data?.message || 'Failed to save transaction.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this transaction?')) return;
    
    setLoading(true);
    try {
      await api.delete(`/transactions/${id}`);
      fetchTransactions();
    } catch (err) {
      console.error('Delete transaction error:', err);
      setError('Could not remove this transaction.');
      setLoading(false);
    }
  };

  // Local client-side filtering for Search query
  const filteredTransactions = transactions.filter(t => 
    t.description?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    t.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const cardStyleClass = theme === 'dark' ? 'glass-card-dark' : 'glass-card-light';
  const textTitleColor = theme === 'dark' ? 'text-white' : 'text-gray-900';
  const textSubColor = theme === 'dark' ? 'text-gray-400' : 'text-gray-500';

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className={`text-3xl font-extrabold tracking-tight ${textTitleColor}`}>
            Transactions
          </h1>
          <p className={`text-sm mt-1 ${textSubColor}`}>
            Detailed audit log of earnings and expenditures.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button 
            variant="outlined" 
            onClick={handleOpenImport}
            style={{ 
              borderColor: '#0D9488',
              color: '#0D9488',
              textTransform: 'none',
              borderRadius: 12,
              fontWeight: 'bold',
              padding: '10px 20px'
            }}
          >
            Import Statement
          </Button>
          <Button 
            variant="contained" 
            startIcon={<AddIcon />}
            onClick={handleOpenAdd}
            style={{ 
              background: 'linear-gradient(to right, #0D9488, #4F46E5)',
              textTransform: 'none',
              borderRadius: 12,
              fontWeight: 'bold',
              padding: '10px 20px'
            }}
          >
            Add Transaction
          </Button>
        </div>
      </div>

      {error && (
        <Alert severity="error" className="rounded-xl">
          {error}
        </Alert>
      )}

      {/* Filter Controls Toolbar */}
      <div className={`p-4 rounded-2xl ${cardStyleClass} border grid grid-cols-1 md:grid-cols-4 gap-4 items-center`}>
        {/* Search Input */}
        <div className="relative col-span-1 md:col-span-1">
          <TextField
            placeholder="Search descriptions..."
            size="small"
            fullWidth
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            slotProps={{
              input: {
                startAdornment: <Search className="text-gray-400 mr-2" fontSize="small" />,
                style: { color: theme === 'dark' ? '#FFFFFF' : '#000000' }
              }
            }}
          />
        </div>

        {/* Type Filter */}
        <FormControl size="small" fullWidth>
          <InputLabel style={{ color: theme === 'dark' ? '#9CA3AF' : '#4B5563' }}>Type</InputLabel>
          <Select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            label="Type"
            style={{ color: theme === 'dark' ? '#FFFFFF' : '#000000' }}
          >
            <MenuItem value="">All Types</MenuItem>
            <MenuItem value="income">Income</MenuItem>
            <MenuItem value="expense">Expense</MenuItem>
          </Select>
        </FormControl>

        {/* Category Filter */}
        <FormControl size="small" fullWidth>
          <InputLabel style={{ color: theme === 'dark' ? '#9CA3AF' : '#4B5563' }}>Category</InputLabel>
          <Select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            label="Category"
            style={{ color: theme === 'dark' ? '#FFFFFF' : '#000000' }}
          >
            <MenuItem value="">All Categories</MenuItem>
            {CATEGORIES.map(cat => (
              <MenuItem key={cat} value={cat}>{cat}</MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Sort Controls */}
        <div className="flex gap-2 justify-end w-full">
          <FormControl size="small" className="flex-1">
            <InputLabel style={{ color: theme === 'dark' ? '#9CA3AF' : '#4B5563' }}>Sort By</InputLabel>
            <Select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              label="Sort By"
              style={{ color: theme === 'dark' ? '#FFFFFF' : '#000000' }}
            >
              <MenuItem value="date">Date</MenuItem>
              <MenuItem value="amount">Amount</MenuItem>
            </Select>
          </FormControl>
          <Button
            variant="outlined"
            onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
            className="px-4"
            style={{ textTransform: 'none' }}
          >
            {sortOrder === 'desc' ? 'Desc' : 'Asc'}
          </Button>
        </div>
      </div>

      {/* Main Transactions Grid/Table */}
      {loading ? (
        <div className="py-20 flex justify-center">
          <CircularProgress />
        </div>
      ) : filteredTransactions.length > 0 ? (
        <div
          className="rounded-2xl border overflow-hidden"
          style={{
            background: theme === 'dark' ? 'rgba(17,24,39,0.65)' : 'rgba(255,255,255,0.85)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            borderColor: theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
          }}
        >
          <div className="overflow-x-auto">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: theme === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' }}>
                  {['Date', 'Description', 'Category', 'Type', 'Amount', 'Actions'].map((h, i) => (
                    <th
                      key={h}
                      style={{
                        padding: '12px 16px',
                        textAlign: i >= 4 ? 'right' : 'left',
                        fontSize: 11,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        color: theme === 'dark' ? '#9CA3AF' : '#6B7280',
                        borderBottom: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)'}`,
                        ...(i === 5 ? { textAlign: 'center' } : {}),
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.map((tx, rowIdx) => (
                  <tr
                    key={tx._id}
                    style={{
                      borderBottom: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)'}`,
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = theme === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    {/* Date */}
                    <td style={{ padding: '13px 16px', color: theme === 'dark' ? '#D1D5DB' : '#374151', fontSize: 13 }}>
                      {new Date(tx.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                    </td>

                    {/* Description + Anomaly */}
                    <td style={{ padding: '13px 16px', color: theme === 'dark' ? '#F9FAFB' : '#111827', fontSize: 13 }}>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 500 }}>{tx.description || '-'}</span>
                        {tx.isAnomaly && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 3, fontSize: 11, color: '#f59e0b', fontWeight: 600 }}>
                            <Warning style={{ fontSize: 12 }} />
                            <span>AI: Suspicious Expense Flagged</span>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Category */}
                    <td style={{ padding: '13px 16px' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '3px 10px',
                        borderRadius: 99,
                        fontSize: 12,
                        fontWeight: 600,
                        background: 'rgba(79,70,229,0.1)',
                        color: '#4F46E5',
                      }}>
                        {tx.category}
                      </span>
                    </td>

                    {/* Type */}
                    <td style={{ padding: '13px 16px' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '3px 10px',
                        borderRadius: 99,
                        fontSize: 12,
                        fontWeight: 600,
                        textTransform: 'capitalize',
                        background: tx.type === 'income' ? 'rgba(22,163,74,0.1)' : 'rgba(239,68,68,0.1)',
                        color: tx.type === 'income' ? '#16A34A' : '#ef4444',
                      }}>
                        {tx.type}
                      </span>
                    </td>

                    {/* Amount */}
                    <td style={{ padding: '13px 16px', textAlign: 'right', fontWeight: 700, color: tx.type === 'income' ? '#16A34A' : '#ef4444', fontSize: 14 }}>
                      {tx.type === 'income' ? '+' : '-'}₹{tx.amount.toLocaleString()}
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '13px 16px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: 4 }}>
                        <IconButton size="small" color="primary" onClick={() => handleOpenEdit(tx)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" color="error" onClick={() => handleDelete(tx._id)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div
          className="p-12 text-center rounded-2xl animate-slide-up"
          style={{
            background: theme === 'dark' ? 'rgba(17,24,39,0.4)' : 'rgba(0,0,0,0.02)',
            border: `1px dashed ${theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
          }}
        >
          {transactions.length === 0 ? (
            <>
              <ReceiptLong style={{ fontSize: 56, color: '#0D9488', opacity: 0.7, marginBottom: 12 }} />
              <h3 className={`text-xl font-bold mb-2 ${textTitleColor}`}>No Transactions Yet</h3>
              <p className={`text-sm mb-6 ${textSubColor}`}>
                Start tracking your income and expenses to see them show up here.
              </p>
              <button
                onClick={handleOpenAdd}
                style={{
                  background: 'linear-gradient(135deg, #0D9488, #4F46E5)',
                  color: 'white', border: 'none', borderRadius: 12,
                  padding: '12px 28px', fontWeight: 700, fontSize: 15,
                  cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                }}
              >
                <AddIcon /> Add My First Transaction
              </button>
            </>
          ) : (
            <>
              <Search style={{ fontSize: 56, color: '#0D9488', opacity: 0.7, marginBottom: 12 }} />
              <h3 className={`text-xl font-bold mb-2 ${textTitleColor}`}>No Matches Found</h3>
              <p className={`text-sm mb-6 ${textSubColor}`}>
                No transactions match your search. Try a different keyword or clear the search.
              </p>
              <button
                onClick={() => setSearchQuery('')}
                style={{
                  background: 'transparent',
                  color: '#0D9488', border: '1px solid #0D9488', borderRadius: 12,
                  padding: '10px 24px', fontWeight: 700, fontSize: 14,
                  cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                }}
              >
                Clear Search
              </button>
            </>
          )}
        </div>
      )}

      <Dialog 
        open={openDialog} 
        onClose={handleCloseDialog}
        sx={{
          '& .MuiDialog-paper': {
            backgroundColor: theme === 'dark' ? 'rgba(19, 28, 46, 0.85)' : 'rgba(255, 255, 255, 0.85)',
            color: theme === 'dark' ? '#ffffff' : '#000000',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '450px',
            border: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(255, 255, 255, 0.45)',
            boxShadow: theme === 'dark' 
              ? '0 20px 48px 0 rgba(0, 0, 0, 0.7), inset 0 1px 1px 0 rgba(255, 255, 255, 0.15)' 
              : '0 16px 40px 0 rgba(79, 70, 229, 0.08), inset 0 1px 1px 0 rgba(255, 255, 255, 0.8)',
            backdropFilter: 'blur(28px) saturate(200%)',
          }
        }}
      >
        <form onSubmit={handleFormSubmit}>
          <DialogTitle style={{ fontFamily: 'Outfit', fontWeight: 'bold' }}>
            {dialogMode === 'add' ? 'Add Transaction' : 'Edit Transaction'}
          </DialogTitle>
          <DialogContent className="space-y-4 pt-2">
            
            {formError && (
              <Alert severity="error" className="mb-4 rounded-lg">
                {formError}
              </Alert>
            )}

            {/* Amount */}
            <TextField
              label="Amount (₹)"
              name="amount"
              type="number"
              variant="outlined"
              fullWidth
              required
              value={formFields.amount}
              onChange={handleInputChange}
              slotProps={{
                inputLabel: { style: { color: theme === 'dark' ? '#9CA3AF' : '#4B5563' } },
                input: { style: { color: theme === 'dark' ? '#FFFFFF' : '#000000' } }
              }}
              className="mt-2"
            />

            {/* Type */}
            <FormControl fullWidth className="mt-4">
              <InputLabel style={{ color: theme === 'dark' ? '#9CA3AF' : '#4B5563' }}>Type</InputLabel>
              <Select
                name="type"
                value={formFields.type}
                onChange={handleInputChange}
                label="Type"
                style={{ color: theme === 'dark' ? '#FFFFFF' : '#000000' }}
              >
                <MenuItem value="expense">Expense</MenuItem>
                <MenuItem value="income">Income</MenuItem>
              </Select>
            </FormControl>

            {/* Category */}
            <FormControl fullWidth className="mt-4">
              <InputLabel style={{ color: theme === 'dark' ? '#9CA3AF' : '#4B5563' }}>Category</InputLabel>
              <Select
                name="category"
                value={formFields.category}
                onChange={handleInputChange}
                label="Category"
                style={{ color: theme === 'dark' ? '#FFFFFF' : '#000000' }}
              >
                {CATEGORIES.map(cat => (
                  <MenuItem key={cat} value={cat}>{cat}</MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Description */}
            <TextField
              label="Description"
              name="description"
              variant="outlined"
              fullWidth
              value={formFields.description}
              onChange={handleInputChange}
              slotProps={{
                inputLabel: { style: { color: theme === 'dark' ? '#9CA3AF' : '#4B5563' } },
                input: { style: { color: theme === 'dark' ? '#FFFFFF' : '#000000' } }
              }}
              className="mt-4"
            />

            {/* Date */}
            <TextField
              label="Date"
              name="date"
              type="date"
              variant="outlined"
              fullWidth
              value={formFields.date}
              onChange={handleInputChange}
              slotProps={{
                inputLabel: { 
                  shrink: true,
                  style: { color: theme === 'dark' ? '#9CA3AF' : '#4B5563' } 
                },
                input: { style: { color: theme === 'dark' ? '#FFFFFF' : '#000000' } }
              }}
              className="mt-4"
            />

          </DialogContent>
          <DialogActions className="p-6">
            <Button 
              onClick={handleCloseDialog} 
              color="inherit"
              style={{ textTransform: 'none' }}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              variant="contained" 
              disabled={actionLoading}
              style={{ 
                background: 'linear-gradient(to right, #0D9488, #4F46E5)',
                textTransform: 'none',
                fontWeight: 'bold'
              }}
            >
              {actionLoading ? <CircularProgress size={20} color="inherit" /> : 'Save'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* 5. BANK STATEMENT IMPORT WIZARD DIALOG */}
      <Dialog 
        open={openImportDialog} 
        onClose={handleCloseImport}
        maxWidth="md"
        fullWidth
        sx={{
          '& .MuiDialog-paper': {
            backgroundColor: theme === 'dark' ? 'rgba(19, 28, 46, 0.85)' : 'rgba(255, 255, 255, 0.85)',
            color: theme === 'dark' ? '#ffffff' : '#000000',
            borderRadius: '24px',
            border: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(255, 255, 255, 0.45)',
            boxShadow: theme === 'dark' 
              ? '0 20px 48px 0 rgba(0, 0, 0, 0.7), inset 0 1px 1px 0 rgba(255, 255, 255, 0.15)' 
              : '0 16px 40px 0 rgba(79, 70, 229, 0.08), inset 0 1px 1px 0 rgba(255, 255, 255, 0.8)',
            backdropFilter: 'blur(28px) saturate(200%)',
            padding: '12px'
          }
        }}
      >
        <DialogTitle style={{ fontFamily: 'Outfit', fontWeight: 'bold', fontSize: '24px' }}>
          Import Bank Statement
        </DialogTitle>
        <DialogContent className="space-y-4">
          {importError && (
            <Alert severity="error" className="rounded-xl mt-2">{importError}</Alert>
          )}

          {importPreviewRows.length === 0 ? (
            <div className="space-y-4 mt-2">
              {/* Tab Navigation */}
              <div className="flex gap-2 p-1 rounded-xl bg-gray-500/10 max-w-[280px]">
                <button
                  type="button"
                  onClick={() => setImportModeTab('file')}
                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    importModeTab === 'file' 
                      ? 'bg-gradient-to-r from-[#0D9488] to-[#4F46E5] text-white shadow-sm'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  File Upload (.csv)
                </button>
                <button
                  type="button"
                  onClick={() => setImportModeTab('paste')}
                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    importModeTab === 'paste' 
                      ? 'bg-gradient-to-r from-[#0D9488] to-[#4F46E5] text-white shadow-sm'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Copy & Paste
                </button>
              </div>

              {importModeTab === 'file' ? (
                /* Drag and drop file select zone */
                <div 
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const file = e.dataTransfer.files[0];
                    if (file) handleFileSelected(file);
                  }}
                  className="border-2 border-dashed border-gray-500/30 rounded-2xl p-8 text-center hover:border-[#0D9488]/50 transition-all cursor-pointer bg-gray-500/5 relative overflow-hidden"
                  onClick={() => document.getElementById('csv-file-input').click()}
                >
                  <input 
                    type="file" 
                    id="csv-file-input" 
                    accept=".csv,.txt"
                    className="hidden" 
                    onChange={(e) => {
                      const file = e.target.files[0];
                      if (file) handleFileSelected(file);
                    }}
                  />
                  <div className="space-y-2">
                    <p className="text-sm font-semibold">
                      {importFile ? `Selected: ${importFile.name}` : "Drag and drop bank statement CSV here, or click to browse"}
                    </p>
                    <p className="text-xs text-gray-400">Supports standard columns (Date, Description, Amount, Type)</p>
                  </div>
                </div>
              ) : (
                /* Copy paste text area */
                <div className="space-y-4">
                  <textarea
                    rows={6}
                    value={importPasteText}
                    onChange={(e) => setImportPasteText(e.target.value)}
                    placeholder="Copy transaction rows from your bank portal or Excel sheet (e.g. columns separated by commas or tabs) and paste them here..."
                    className={`w-full p-4 rounded-2xl border text-sm font-mono focus:outline-none focus:ring-1 focus:ring-[#0D9488] ${
                      theme === 'dark' ? 'bg-black/30 border-white/10 text-white' : 'bg-white/50 border-black/10 text-black'
                    }`}
                  />
                  <Button
                    variant="outlined"
                    onClick={() => {
                      if (!importPasteText.trim()) {
                        setImportError('Please paste some statement data first.');
                        return;
                      }
                      try {
                        const parsed = parseSpreadsheetData(importPasteText);
                        setImportRows(parsed);
                        handleProcessImport(parsed);
                      } catch (err) {
                        setImportError(err.message);
                      }
                    }}
                    style={{ textTransform: 'none', borderRadius: 12, borderColor: '#0D9488', color: '#0D9488', fontWeight: 'bold' }}
                  >
                    Parse Paste Data
                  </Button>
                </div>
              )}
            </div>
          ) : (
            /* PREVIEW OF DRAFT ROWS FOR USER EDITING AND CONFIRMATION */
            <div className="space-y-4 mt-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <p className="text-xs font-semibold text-gray-400">
                  Aurelia ML has auto-categorized your statements. Please review categories and types before saving:
                </p>
                <Button 
                  size="small" 
                  color="warning" 
                  onClick={() => setImportPreviewRows([])}
                  style={{ textTransform: 'none', fontWeight: 'bold' }}
                >
                  Clear & Re-upload
                </Button>
              </div>

              {importLoading ? (
                <div className="py-12 flex flex-col items-center justify-center gap-3">
                  <CircularProgress size={32} />
                  <p className="text-xs text-gray-400 font-medium">Aurelia ML is running text classifications...</p>
                </div>
              ) : (
                <div className="overflow-x-auto max-h-[300px] border border-gray-500/10 rounded-2xl">
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: theme === 'dark' ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0,0,0,0.03)' }}>
                        {['Date', 'Description', 'Category', 'Type', 'Amount', ''].map((h, i) => (
                          <th 
                            key={h} 
                            style={{ 
                              padding: '10px 12px', 
                              textAlign: i === 4 ? 'right' : 'left', 
                              fontWeight: 'bold',
                              fontSize: '11px',
                              letterSpacing: '0.05em',
                              textTransform: 'uppercase',
                              color: theme === 'dark' ? '#9CA3AF' : '#6B7280',
                              borderBottom: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)'}`,
                              ...(i === 5 ? { textAlign: 'center' } : {})
                            }}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {importPreviewRows.map((row, idx) => (
                        <tr 
                          key={idx} 
                          style={{
                            borderBottom: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)'}`,
                          }}
                        >
                          {/* Date */}
                          <td style={{ padding: '8px 12px' }}>
                            <input
                              type="date"
                              value={row.date}
                              onChange={(e) => handlePreviewRowChange(idx, 'date', e.target.value)}
                              className={`p-1 rounded text-xs focus:outline-none border ${
                                theme === 'dark' ? 'bg-gray-800 text-white border-white/5' : 'bg-gray-100 text-black border-black/5'
                              }`}
                            />
                          </td>

                          {/* Description */}
                          <td style={{ padding: '8px 12px' }}>
                            <input
                              type="text"
                              value={row.description}
                              onChange={(e) => handlePreviewRowChange(idx, 'description', e.target.value)}
                              className={`p-1 rounded text-xs w-full focus:outline-none border ${
                                theme === 'dark' ? 'bg-gray-800 text-white border-white/5' : 'bg-gray-100 text-black border-black/5'
                              }`}
                            />
                          </td>

                          {/* Category Dropdown */}
                          <td style={{ padding: '8px 12px' }}>
                            <select
                              value={row.category}
                              onChange={(e) => handlePreviewRowChange(idx, 'category', e.target.value)}
                              className={`p-1 rounded text-xs font-semibold cursor-pointer border ${
                                theme === 'dark' ? 'bg-[#0d1f19] text-[#16A34A] border-[#16A34A]/20' : 'bg-emerald-50 text-[#16A34A] border-emerald-100'
                              }`}
                              style={{ outline: 'none', paddingRight: '20px' }}
                            >
                              {CATEGORIES.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                              ))}
                            </select>
                          </td>

                          {/* Type Select */}
                          <td style={{ padding: '8px 12px' }}>
                            <select
                              value={row.type}
                              onChange={(e) => handlePreviewRowChange(idx, 'type', e.target.value)}
                              className={`p-1 rounded text-xs font-semibold cursor-pointer border ${
                                row.type === 'income' 
                                  ? theme === 'dark' ? 'bg-[#0d1f19] text-[#16A34A] border-[#16A34A]/10' : 'bg-emerald-50 text-[#16A34A] border-emerald-100'
                                  : theme === 'dark' ? 'bg-red-950/10 text-red-400 border-red-800/10' : 'bg-red-50 text-red-500 border-red-100'
                              }`}
                              style={{ outline: 'none', paddingRight: '20px' }}
                            >
                              <option value="expense">Expense</option>
                              <option value="income">Income</option>
                            </select>
                          </td>

                          {/* Amount */}
                          <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                            <input
                              type="number"
                              value={row.amount}
                              onChange={(e) => handlePreviewRowChange(idx, 'amount', parseFloat(e.target.value) || 0)}
                              className={`p-1 rounded text-xs w-20 text-right focus:outline-none font-bold border ${
                                theme === 'dark' ? 'bg-gray-800 text-white border-white/5' : 'bg-gray-100 text-black border-black/5'
                              }`}
                            />
                          </td>

                          {/* Delete */}
                          <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                            <IconButton size="small" color="error" onClick={() => handleDeletePreviewRow(idx)}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </DialogContent>
        <DialogActions className="p-6">
          <Button onClick={handleCloseImport} color="inherit" style={{ textTransform: 'none', fontWeight: 'semibold' }}>
            Cancel
          </Button>
          {importPreviewRows.length > 0 && !importLoading && (
            <Button
              variant="contained"
              onClick={handleSaveImport}
              disabled={importLoading}
              style={{
                background: 'linear-gradient(to right, #0D9488, #4F46E5)',
                textTransform: 'none',
                fontWeight: 'bold',
                borderRadius: 12,
                padding: '8px 16px'
              }}
            >
              Import {importPreviewRows.length} Transactions
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </div>
  );
}
