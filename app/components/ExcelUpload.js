import React, { useState, useCallback } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle, X } from 'lucide-react';
import { jonyColors } from '../theme';
import { db } from '../utils/db';
import * as XLSX from 'xlsx';

const ExcelUpload = ({ onTransactionsParsed, onClose }) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(null);
  const [parsedData, setParsedData] = useState(null);

  const processExcelFile = useCallback((file) => {
    setIsProcessing(true);
    setUploadStatus(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        
        // Take the first sheet
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convert to JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        if (jsonData.length === 0) {
          setUploadStatus({ type: 'error', message: 'Die Excel-Datei ist leer.' });
          setIsProcessing(false);
          return;
        }

        // Parse transactions from the Excel data
        const transactions = parseTransactionsFromExcel(jsonData);
        
        if (transactions.length === 0) {
          setUploadStatus({ type: 'error', message: 'Keine gültigen Transaktionen gefunden.' });
          setIsProcessing(false);
          return;
        }

        setParsedData(transactions);
        setUploadStatus({ 
          type: 'success', 
          message: `${transactions.length} Transaktionen erfolgreich geparst.` 
        });
        setIsProcessing(false);

      } catch (error) {
        console.error('Error parsing Excel file:', error);
        setUploadStatus({ type: 'error', message: 'Fehler beim Parsen der Excel-Datei.' });
        setIsProcessing(false);
      }
    };

    reader.readAsArrayBuffer(file);
  }, []);

  const parseTransactionsFromExcel = (data) => {
    const transactions = [];
    
    // Find the header row by looking for "Wertstellungsdatum"
    let headerRowIndex = -1;
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      if (row && row.some(cell => 
        cell && cell.toString().toLowerCase().includes('wertstellungsdatum')
      )) {
        headerRowIndex = i;
        break;
      }
    }

    if (headerRowIndex === -1) {
      // Fallback: look for any date-like header
      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        if (row && row.some(cell => 
          cell && (cell.toString().toLowerCase().includes('datum') || 
                  cell.toString().toLowerCase().includes('date'))
        )) {
          headerRowIndex = i;
          break;
        }
      }
    }

    if (headerRowIndex === -1) {
      console.warn('No header row found, using first row');
      headerRowIndex = 0;
    }

    const headers = data[headerRowIndex];
    
    // Process data starting from the row after headers
    for (let i = headerRowIndex + 1; i < data.length; i++) {
      const row = data[i];
      if (!row || row.length === 0) continue;

      // Skip rows that don't have enough data or are empty
      if (row.every(cell => !cell || cell.toString().trim() === '')) continue;

      const transaction = parseTransactionRow(row, headers);
      if (transaction) {
        transactions.push(transaction);
      }
    }

    return transactions;
  };

  const parseTransactionRow = (row, headers) => {
    // German bank statement column patterns based on the provided image
    const patterns = {
      date: ['datum', 'date', 'buchungstag', 'wertstellung', 'wertstellungsdatum'],
      description: ['beschreibung', 'verwendungszweck', 'description', 'zweck', 'details', 'buchungstext'],
      recipient: ['empfänger', 'begünstigter', 'recipient', 'zahlungsempfänger', 'auftraggeber', 'auftraggeber/empfänger'],
      amount: ['betrag', 'amount', 'umsatz', 'summe'],
      account: ['konto', 'account', 'kontonummer', 'buchung'],
      currency: ['währung', 'currency', 'whr']
    };

    const findColumnIndex = (pattern) => {
      if (!headers) return -1;
      return headers.findIndex(header => 
        pattern.some(p => 
          header && header.toString().toLowerCase().includes(p.toLowerCase())
        )
      );
    };

    const dateIndex = findColumnIndex(patterns.date);
    const descriptionIndex = findColumnIndex(patterns.description);
    const recipientIndex = findColumnIndex(patterns.recipient);
    const amountIndex = findColumnIndex(patterns.amount);
    const accountIndex = findColumnIndex(patterns.account);
    const currencyIndex = findColumnIndex(patterns.currency);

    // If we can't find essential columns, try positional parsing
    if (dateIndex === -1 || amountIndex === -1) {
      return parseByPosition(row);
    }

    const dateValue = row[dateIndex];
    const amountValue = row[amountIndex];

    if (!dateValue || amountValue === undefined || amountValue === null) {
      return null;
    }

    // Parse date
    let parsedDate;
    if (typeof dateValue === 'number') {
      // Excel serial date
      parsedDate = XLSX.SSF.parse_date_code(dateValue);
      parsedDate = new Date(parsedDate.y, parsedDate.m - 1, parsedDate.d).toISOString().split('T')[0];
    } else {
      // String date
      const dateStr = dateValue.toString();
      parsedDate = parseGermanDate(dateStr);
    }

    // Parse amount - handle German number format and negative values
    let amountStr = amountValue.toString().trim();
    
    // Handle negative amounts in German format (sometimes with trailing minus)
    let isNegative = amountStr.includes('-') || amountStr.startsWith('(') || amountStr.endsWith(')');
    
    // Clean the amount string
    amountStr = amountStr.replace(/[^\d,.-]/g, ''); // Remove everything except digits, comma, dot, minus
    amountStr = amountStr.replace(',', '.'); // Replace German decimal comma with dot
    
    let parsedAmount = parseFloat(amountStr);
    if (isNaN(parsedAmount)) {
      return null;
    }
    
    // Apply negative sign if detected
    if (isNegative && parsedAmount > 0) {
      parsedAmount = -parsedAmount;
    }

    // Combine description and Verwendungszweck if both exist
    let description = '';
    if (descriptionIndex !== -1 && row[descriptionIndex]) {
      description = row[descriptionIndex].toString();
    }
    
    // Look for "Verwendungszweck" column
    const verwendungszweckIndex = headers.findIndex(header => 
      header && header.toString().toLowerCase().includes('verwendungszweck')
    );
    if (verwendungszweckIndex !== -1 && row[verwendungszweckIndex]) {
      const verwendungszweck = row[verwendungszweckIndex].toString();
      if (description && verwendungszweck) {
        description = `${description} - ${verwendungszweck}`;
      } else if (verwendungszweck) {
        description = verwendungszweck;
      }
    }

    return {
      date: parsedDate,
      description: description,
      recipient: recipientIndex !== -1 ? (row[recipientIndex] || '').toString() : '',
      amount: parsedAmount,
      account: accountIndex !== -1 ? (row[accountIndex] || '').toString() : 'Import',
      uploadedAt: new Date().toISOString()
    };
  };

  const parseByPosition = (row) => {
    // Common positional formats: Date, Description, Amount or Date, Description, Recipient, Amount
    if (row.length < 3) return null;

    const dateValue = row[0];
    const amountValue = row[row.length - 1]; // Amount usually last
    
    if (!dateValue || amountValue === undefined) return null;

    let parsedDate;
    if (typeof dateValue === 'number') {
      parsedDate = XLSX.SSF.parse_date_code(dateValue);
      parsedDate = new Date(parsedDate.y, parsedDate.m - 1, parsedDate.d).toISOString().split('T')[0];
    } else {
      parsedDate = parseGermanDate(dateValue.toString());
    }

    let parsedAmount = parseFloat(amountValue.toString().replace(',', '.').replace(/[^\d.-]/g, ''));
    if (isNaN(parsedAmount)) return null;

    return {
      date: parsedDate,
      description: row.length > 2 ? (row[1] || '').toString() : '',
      recipient: row.length > 3 ? (row[2] || '').toString() : '',
      amount: parsedAmount,
      account: 'Import',
      uploadedAt: new Date().toISOString()
    };
  };

  const parseGermanDate = (dateStr) => {
    // Try different German date formats
    const formats = [
      /(\d{1,2})\.(\d{1,2})\.(\d{4})/, // DD.MM.YYYY
      /(\d{4})-(\d{1,2})-(\d{1,2})/, // YYYY-MM-DD
      /(\d{1,2})\/(\d{1,2})\/(\d{4})/, // DD/MM/YYYY
    ];

    for (const format of formats) {
      const match = dateStr.match(format);
      if (match) {
        if (format === formats[1]) {
          // YYYY-MM-DD
          return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
        } else {
          // DD.MM.YYYY or DD/MM/YYYY
          return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
        }
      }
    }

    // Fallback to current date
    return new Date().toISOString().split('T')[0];
  };

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    const excelFile = files.find(file => 
      file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.type === 'application/vnd.ms-excel' ||
      file.name.endsWith('.xlsx') ||
      file.name.endsWith('.xls')
    );

    if (excelFile) {
      processExcelFile(excelFile);
    } else {
      setUploadStatus({ type: 'error', message: 'Bitte laden Sie eine Excel-Datei hoch (.xlsx oder .xls).' });
    }
  }, [processExcelFile]);

  const handleFileInput = useCallback((e) => {
    const file = e.target.files[0];
    if (file) {
      processExcelFile(file);
    }
  }, [processExcelFile]);

  const handleConfirm = async () => {
    if (parsedData && parsedData.length > 0) {
      try {
        // Add transactions directly to inbox using bulkAdd like the dashboard does
        await db.inbox.bulkAdd(parsedData);
        console.log(`${parsedData.length} Transaktionen wurden erfolgreich hochgeladen`);
        
        // Call the parent handler if provided (for compatibility)
        if (onTransactionsParsed) {
          onTransactionsParsed(parsedData);
        }
        
        onClose();
      } catch (error) {
        console.error('Fehler beim Speichern der Transaktionen:', error);
        setUploadStatus({ 
          type: 'error', 
          message: 'Fehler beim Speichern der Transaktionen in die Datenbank.' 
        });
      }
    }
  };

  return (
    <div className="fixed inset-0 backdrop-blur-lg flex items-center justify-center z-50 p-4" 
         style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}>
      <div className="rounded-3xl shadow-2xl w-full max-w-2xl border" 
           style={{
             backgroundColor: jonyColors.surface,
             border: `1px solid ${jonyColors.border}`
           }}>
        <div className="p-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg" 
                   style={{ backgroundColor: jonyColors.accent1 }}>
                <FileText className="w-8 h-8" style={{ color: jonyColors.background }} />
              </div>
              <div>
                <h2 className="text-2xl font-bold" style={{ color: jonyColors.textPrimary }}>
                  Excel Upload
                </h2>
                <p style={{ color: jonyColors.textSecondary }}>
                  Kontoauszüge im Excel-Format hochladen
                </p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-3 rounded-xl transition-all duration-300 shadow-sm hover:shadow-lg"
              style={{
                backgroundColor: jonyColors.cardBackground,
                color: jonyColors.textSecondary,
                border: `1px solid ${jonyColors.cardBorder}`
              }}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Upload Area */}
          <div 
            className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all duration-300 ${
              isDragOver ? 'scale-105' : ''
            }`}
            style={{
              borderColor: isDragOver ? jonyColors.accent1 : jonyColors.cardBorder,
              backgroundColor: isDragOver ? jonyColors.accent1Alpha : jonyColors.cardBackground
            }}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="w-20 h-20 rounded-3xl mx-auto mb-6 flex items-center justify-center shadow-xl" 
                 style={{
                   backgroundColor: isDragOver ? jonyColors.accent1 : jonyColors.surface
                 }}>
              <Upload className="w-10 h-10" 
                      style={{ 
                        color: isDragOver ? jonyColors.background : jonyColors.textSecondary 
                      }} />
            </div>
            
            <h3 className="text-xl font-bold mb-2" style={{ color: jonyColors.textPrimary }}>
              Excel-Datei hier ablegen
            </h3>
            <p className="mb-6" style={{ color: jonyColors.textSecondary }}>
              Oder klicken Sie hier, um eine Datei auszuwählen
            </p>
            
            <input 
              type="file" 
              accept=".xlsx,.xls" 
              onChange={handleFileInput}
              className="hidden" 
              id="excel-upload" 
            />
            <label 
              htmlFor="excel-upload"
              className="inline-flex items-center space-x-2 px-6 py-3 rounded-xl transition-all duration-200 font-bold shadow-lg hover:shadow-xl cursor-pointer"
              style={{
                backgroundColor: jonyColors.accent1,
                color: jonyColors.background
              }}
            >
              <FileText className="w-5 h-5" />
              <span>Datei auswählen</span>
            </label>
          </div>

          {/* Status Messages */}
          {isProcessing && (
            <div className="mt-6 p-4 rounded-xl flex items-center space-x-3" 
                 style={{ backgroundColor: jonyColors.cardBackground }}>
              <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              <span style={{ color: jonyColors.textPrimary }}>Verarbeite Excel-Datei...</span>
            </div>
          )}

          {uploadStatus && (
            <div className={`mt-6 p-4 rounded-xl flex items-center space-x-3`} 
                 style={{
                   backgroundColor: uploadStatus.type === 'success' ? jonyColors.accent1Alpha : jonyColors.redAlpha,
                   border: `1px solid ${uploadStatus.type === 'success' ? jonyColors.accent1 : jonyColors.red}33`
                 }}>
              {uploadStatus.type === 'success' ? (
                <CheckCircle className="w-6 h-6" style={{ color: jonyColors.accent1 }} />
              ) : (
                <AlertCircle className="w-6 h-6" style={{ color: jonyColors.red }} />
              )}
              <span style={{ 
                color: uploadStatus.type === 'success' ? jonyColors.accent1 : jonyColors.red 
              }}>
                {uploadStatus.message}
              </span>
            </div>
          )}

          {/* Preview */}
          {parsedData && parsedData.length > 0 && (
            <div className="mt-6">
              <h4 className="text-lg font-bold mb-4" style={{ color: jonyColors.textPrimary }}>
                Vorschau ({parsedData.length} Transaktionen)
              </h4>
              <div className="max-h-60 overflow-y-auto rounded-xl border" 
                   style={{ backgroundColor: jonyColors.cardBackground, border: `1px solid ${jonyColors.cardBorder}` }}>
                {parsedData.slice(0, 5).map((transaction, index) => (
                  <div key={index} className="p-3 flex items-center justify-between" 
                       style={{ borderBottom: index < 4 ? `1px solid ${jonyColors.cardBorder}` : 'none' }}>
                    <div>
                      <div className="font-medium" style={{ color: jonyColors.textPrimary }}>
                        {transaction.recipient || transaction.description || 'Unbekannt'}
                      </div>
                      <div className="text-sm" style={{ color: jonyColors.textSecondary }}>
                        {transaction.date}
                      </div>
                    </div>
                    <div className="font-bold" 
                         style={{ 
                           color: transaction.amount > 0 ? jonyColors.accent1 : jonyColors.magenta 
                         }}>
                      {new Intl.NumberFormat('de-DE', { 
                        style: 'currency', 
                        currency: 'EUR' 
                      }).format(Math.abs(transaction.amount))}
                    </div>
                  </div>
                ))}
                {parsedData.length > 5 && (
                  <div className="p-3 text-center text-sm" style={{ color: jonyColors.textSecondary }}>
                    ... und {parsedData.length - 5} weitere Transaktionen
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex space-x-4 mt-8">
            <button 
              onClick={onClose}
              className="flex-1 py-4 px-6 rounded-2xl transition-all duration-200 font-semibold shadow-sm hover:shadow-md"
              style={{
                backgroundColor: jonyColors.cardBackground,
                color: jonyColors.textSecondary,
                border: `1px solid ${jonyColors.cardBorder}`
              }}
            >
              Abbrechen
            </button>
            {parsedData && parsedData.length > 0 && (
              <button 
                onClick={handleConfirm}
                className="flex-1 py-4 px-6 rounded-2xl transition-all duration-200 font-bold shadow-lg hover:shadow-xl"
                style={{
                  backgroundColor: jonyColors.accent1,
                  color: jonyColors.background
                }}
              >
                {parsedData.length} Transaktionen importieren
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExcelUpload;