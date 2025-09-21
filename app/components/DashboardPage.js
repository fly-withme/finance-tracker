import React, { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useLiveQuery } from 'dexie-react-hooks';
import { 
  ChevronLeft, 
  ChevronRight,
  TrendingUp, 
  Target, 
  PiggyBank,
  AlertTriangle,
  BarChart3,
  TrendingDown,
  PieChart as PieChartIcon,
  Plus,
  Upload
} from 'lucide-react';
import { Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, LineChart, Line, ComposedChart, AreaChart } from 'recharts';
import { db } from '../utils/db';
import { jonyColors } from '../theme';
import * as XLSX from 'xlsx';
import Toast from './Toast';
import { useToast } from '../hooks/useToast';

const DashboardPage = ({ setPage, currentMonth, changeMonth }) => {
  const { toasts, removeToast, success, error, warning, info } = useToast();
  
  // Tooltip state
  const [hoveredMetric, setHoveredMetric] = useState(null);

  const handleMouseEnter = (metricType, event) => {
    setHoveredMetric(metricType);
    // Fixed position at bottom-right of screen - no need to calculate position
  };

  const handleMouseMove = (event) => {
    // Keep the same position on move - no following the mouse
  };

  const handleMouseLeave = () => {
    setHoveredMetric(null);
  };

  const getTooltipContent = (metricType) => {
    switch (metricType) {
      case 'netWorth':
        return {
          title: 'Nettovermögen',
          details: 'Berechnung: Sparguthaben + Investments + verfügbares Geld - Schulden • Zeigt dein gesamtes verfügbares Vermögen'
        };
      case 'fiProgress':
        return {
          title: 'FI-Fortschritt',
          details: 'Benötigt: 25x jährliche Ausgaben • Berechnung: (25x Ausgaben - Nettovermögen) ÷ jährliche Sparrate'
        };
      case 'wealthScore':
        return {
          title: 'Vermögens-Score',
          details: 'A = Top 20% • B = Überdurchschnittlich • C = Durchschnitt • D-F = Unterdurchschnittlich'
        };
      case 'savingsRate':
        return {
          title: 'Sparquote',
          details: 'Berechnung: (Jährliche Ersparnisse ÷ Jahreseinkommen) × 100 • Optimaler Wert: 20-30% für langfristigen Vermögensaufbau'
        };
      case 'upload':
        return {
          title: 'Daten Upload',
          details: 'Kontoauszug importieren'
        };
      default:
        return null;
    }
  };
  // Smart savings detection keywords
  const SAVINGS_KEYWORDS = [
    'sparen', 'savings', 'investieren', 'investment', 'etf', 'aktien', 'stocks',
    'notgroschen', 'emergency fund', 'rücklagen', 'reserves', 'depot',
    'anlegen', 'invest', 'sparplan', 'saving plan', 'vermögensaufbau',
    'wealth building', 'altersvorsorge', 'retirement', 'pension'
  ];

  const detectSavings = (category, description, recipient) => {
    const text = `${category || ''} ${description || ''} ${recipient || ''}`.toLowerCase();
    return SAVINGS_KEYWORDS.some(keyword => text.includes(keyword));
  };

  // Hilfsfunktion zum Berechnen des anteiligen Betrags für teilweise ausgeglichene Transaktionen
  const calculateMyRemainingShare = (transaction) => {
    if (!transaction.sharedWith || !Array.isArray(transaction.sharedWith)) {
      return Math.abs(transaction.amount);
    }
    
    // NEUE LOGIK: Verwende den aktuellen Betrag der Transaktion
    // Wenn Personen bereits bezahlt haben, wurde der Betrag bereits reduziert
    return Math.abs(transaction.amount);
  };

  // Hilfsfunktion zum Filtern von Transaktionen unter Berücksichtigung geteilter Ausgaben
  const filterTransactionsWithSharedExpenseLogic = (transactionsList, dateFilter) => {
    return transactionsList.map(t => {
      const isInDateRange = dateFilter(t);
      if (!isInDateRange) return null;
      
      // Berücksichtige "mein Anteil" Transaktionen immer
      if (t.settledFromSharedExpense) {
        return t;
      }
      
      // Für geteilte Ausgaben: berechne anteiligen Betrag
      if (t.sharedWith && Array.isArray(t.sharedWith) && t.sharedWith.length > 0) {
        const settledWithPersons = t.settledWithPersons || [];
        const allPersonsSettled = t.sharedWith.every(person => 
          settledWithPersons.includes(person.name)
        );
        
        // Nicht berücksichtigen wenn mit allen Personen ausgeglichen
        if (allPersonsSettled) {
          return null;
        }
        
        // Berechne meinen anteiligen Betrag für noch nicht ausgeglichene Personen
        const myRemainingShare = calculateMyRemainingShare(t);
        
        // Erstelle eine modifizierte Kopie der Transaktion mit dem anteiligen Betrag
        return {
          ...t,
          amount: t.amount < 0 ? -myRemainingShare : myRemainingShare,
          originalAmount: t.amount
        };
      }
      
      return t;
    }).filter(t => t !== null);
  };

  // State for subscriptions
  const [showAddSubscriptionModal, setShowAddSubscriptionModal] = useState(false);
  const [newSubscription, setNewSubscription] = useState({ name: '', amount: '' });

  // File upload ref
  const fileInputRef = React.useRef(null);

  
  // Remove subscription from category (change category to something else)
  const removeFromSubscriptions = async (subscription) => {
    try {
      // Update all transactions for this subscription to remove from Abo category
      const updatePromises = subscription.transactions.map(transaction => {
        return db.transactions.update(transaction.id, {
          category: 'Sonstige Ausgaben' // Move to general expenses
        });
      });
      
      await Promise.all(updatePromises);
      success(`${subscription.name} wurde aus den Abos entfernt`, 'Abo entfernt');
    } catch (error) {
      console.error('Error removing subscription:', error);
      error('Fehler beim Entfernen des Abos', 'Fehler');
    }
  };
  
  // Add manual subscription
  const addManualSubscription = async () => {
    if (!newSubscription.name || !newSubscription.amount) {
      warning('Bitte füllen Sie alle Felder aus', 'Unvollständige Daten');
      return;
    }
    
    try {
      // Create a manual subscription transaction for current month
      const now = new Date();
      const transaction = {
        date: now.toISOString().split('T')[0],
        description: `Manuelles Abo: ${newSubscription.name}`,
        recipient: newSubscription.name,
        amount: -Math.abs(parseFloat(newSubscription.amount)),
        category: 'Abo',
        account: 'Manual',
        createdAt: now.toISOString()
      };
      
      await db.transactions.add(transaction);
      setNewSubscription({ name: '', amount: '' });
      setShowAddSubscriptionModal(false);
      success(`${newSubscription.name} wurde als Abo hinzugefügt`, 'Abo hinzugefügt');
    } catch (error) {
      console.error('Error adding manual subscription:', error);
      error('Fehler beim Hinzufügen des Abos', 'Fehler');
    }
  };

  // Excel parsing functions (same as ExcelUpload component)
  const parseExcelTransactions = (data) => {
    const transactions = [];
    
    console.log('=== DEBUGGING EXCEL PARSING ===');
    console.log('Total rows in Excel:', data.length);
    console.log('First 10 rows:', data.slice(0, 10));
    
    // Find the header row by looking for "Wertstellungsdatum"
    let headerRowIndex = -1;
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      if (row && row.some(cell => 
        cell && cell.toString().toLowerCase().includes('wertstellungsdatum')
      )) {
        headerRowIndex = i;
        console.log('Found header row at index:', i, 'Headers:', row);
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
          console.log('Found fallback header row at index:', i, 'Headers:', row);
          break;
        }
      }
    }

    if (headerRowIndex === -1) {
      console.warn('No header row found, using first row');
      headerRowIndex = 0;
    }

    const headers = data[headerRowIndex];
    console.log('Using headers:', headers);
    
    // Process data starting from the row after headers
    for (let i = headerRowIndex + 1; i < data.length; i++) {
      const row = data[i];
      console.log(`Processing row ${i}:`, row);
      
      if (!row || row.length === 0) {
        console.log(`Skipping row ${i}: empty or null`);
        continue;
      }

      // Skip rows that don't have enough data or are empty
      if (row.every(cell => !cell || cell.toString().trim() === '')) {
        console.log(`Skipping row ${i}: all cells empty`);
        continue;
      }

      const transaction = parseTransactionRow(row, headers);
      console.log(`Row ${i} parsed result:`, transaction);
      
      if (transaction) {
        transactions.push(transaction);
        console.log(`Added transaction from row ${i}:`, transaction);
      } else {
        console.log(`Failed to parse row ${i}`);
      }
    }

    console.log('Final parsed transactions:', transactions);
    console.log('=== END DEBUGGING ===');
    return transactions;
  };

  const parseTransactionRow = (row, headers) => {
    console.log('=== PARSING TRANSACTION ROW ===');
    console.log('Row:', row);
    console.log('Headers:', headers);
    
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

    console.log('Column indices:', {
      dateIndex,
      descriptionIndex,
      recipientIndex,
      amountIndex,
      accountIndex
    });

    // If we can't find essential columns, try positional parsing
    if (dateIndex === -1 || amountIndex === -1) {
      console.log('Essential columns not found, trying positional parsing');
      const result = parseByPosition(row);
      console.log('Positional parsing result:', result);
      return result;
    }

    const dateValue = row[dateIndex];
    const amountValue = row[amountIndex];

    console.log('Extracted values:', {
      dateValue,
      amountValue,
      dateIndex,
      amountIndex
    });

    if (!dateValue || amountValue === undefined || amountValue === null) {
      console.log('Missing essential values, returning null');
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
    // Clean up the date string
    const cleanDateStr = dateStr.toString().trim();
    
    // Try different German date formats
    const formats = [
      /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/, // DD.MM.YYYY
      /^(\d{4})-(\d{1,2})-(\d{1,2})$/, // YYYY-MM-DD
      /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, // DD/MM/YYYY
      /^(\d{1,2})-(\d{1,2})-(\d{4})$/, // DD-MM-YYYY
    ];

    for (let i = 0; i < formats.length; i++) {
      const format = formats[i];
      const match = cleanDateStr.match(format);
      if (match) {
        console.log('Date parsing match:', { input: cleanDateStr, format: i, match });
        
        if (i === 1) {
          // YYYY-MM-DD (already in correct format)
          const year = match[1];
          const month = match[2].padStart(2, '0');
          const day = match[3].padStart(2, '0');
          const result = `${year}-${month}-${day}`;
          console.log('YYYY-MM-DD result:', result);
          return result;
        } else {
          // DD.MM.YYYY, DD/MM/YYYY, or DD-MM-YYYY (convert to YYYY-MM-DD)
          const day = match[1].padStart(2, '0');
          const month = match[2].padStart(2, '0');
          const year = match[3];
          const result = `${year}-${month}-${day}`;
          console.log('DD.MM.YYYY conversion result:', result);
          return result;
        }
      }
    }

    // Fallback: try to parse as a JavaScript Date
    const attemptDate = new Date(cleanDateStr);
    if (!isNaN(attemptDate.getTime())) {
      const result = attemptDate.toISOString().split('T')[0];
      console.log('JavaScript Date fallback result:', result);
      return result;
    }

    // Final fallback to current date
    const fallbackResult = new Date().toISOString().split('T')[0];
    console.warn('Date parsing failed, using current date:', { input: cleanDateStr, fallback: fallbackResult });
    return fallbackResult;
  };





  // File upload handler for multiple files
  const handleFileUpload = async (event) => {
    const files = Array.from(event.target.files);
    if (!files || files.length === 0) return;

    console.log(`Processing ${files.length} file(s)...`);
    
    try {
      let allTransactions = [];
      let successfulFiles = 0;
      let failedFiles = [];

      // Process each file
      for (const file of files) {
        console.log(`Processing file: ${file.name}`);
        
        try {
          let transactions = [];

          if (file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
              file.type === 'application/vnd.ms-excel' || 
              file.name.endsWith('.xlsx') || 
              file.name.endsWith('.xls')) {
            
            // Handle Excel files
            console.log(`Processing Excel file: ${file.name}`);
            const data = new Uint8Array(await file.arrayBuffer());
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
            
            transactions = parseExcelTransactions(jsonData);
            
          } else if (file.type === 'application/pdf') {
            console.warn(`Skipping PDF file: ${file.name}`);
            failedFiles.push({ name: file.name, reason: 'PDF format not supported' });
            continue;
          } else {
            // Handle CSV/TXT files
            console.log(`Processing CSV/TXT file: ${file.name}`);
            transactions = await processCsvFile(file);
          }

          // Add file source information to each transaction
          const transactionsWithSource = transactions.map(t => ({
            ...t,
            sourceFile: file.name,
            uploadedAt: new Date().toISOString()
          }));

          allTransactions.push(...transactionsWithSource);
          successfulFiles++;
          console.log(`Successfully processed ${file.name}: ${transactions.length} transactions`);

        } catch (fileError) {
          console.error(`Error processing file ${file.name}:`, fileError);
          failedFiles.push({ name: file.name, reason: fileError.message });
        }
      }

      // Add all transactions to database
      if (allTransactions.length > 0) {
        await db.inbox.bulkAdd(allTransactions);
        
        // Show success message
        let message = `${allTransactions.length} Transaktionen aus ${successfulFiles} Datei(en) erfolgreich importiert!`;
        if (failedFiles.length > 0) {
          message += `\n\nFehlgeschlagen: ${failedFiles.map(f => `${f.name} (${f.reason})`).join(', ')}`;
        }
        
        success(message, 'Import erfolgreich');
        
        // Optionally redirect to inbox
        if (setPage) {
          setTimeout(() => setPage('inbox'), 2000);
        }
      } else {
        if (failedFiles.length > 0) {
          error(
            `Keine Dateien konnten verarbeitet werden:\n${failedFiles.map(f => `${f.name}: ${f.reason}`).join('\n')}`,
            'Import fehlgeschlagen'
          );
        } else {
          error(
            'Keine gültigen Transaktionen in den ausgewählten Dateien gefunden.',
            'Import fehlgeschlagen'
          );
        }
      }

    } catch (error) {
      console.error('Fehler beim Verarbeiten der Dateien:', error);
      error(
        'Ein unerwarteter Fehler ist beim Verarbeiten der Dateien aufgetreten.',
        'Verarbeitungsfehler'
      );
    }

    // Reset file input
    event.target.value = '';
  };

  // Helper function to process CSV files
  const processCsvFile = async (file) => {
    let transactions = [];
    
    // Handle CSV/TXT files
    const text = await file.text();
    const lines = text.split('\n').filter(line => line.trim());
        
        console.log('=== CSV PARSING DEBUG ===');
        console.log('Total lines:', lines.length);
        console.log('First 10 lines:', lines.slice(0, 10));
        
        // Find header line for ING CSV format
        let headerLineIndex = -1;
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (line.includes('Buchung;Wertstellungsdatum') || 
              line.includes('Wertstellungsdatum;Auftraggeber')) {
            headerLineIndex = i;
            console.log('Found CSV header at line:', i, line);
            break;
          }
        }
        
        if (headerLineIndex === -1) {
          console.log('No ING CSV header found, trying generic parsing');
          // Fallback for other CSV formats
          const dataLines = lines.slice(1);
          
          for (const line of dataLines) {
            const columns = line.split(';');
            if (columns.length >= 3) {
              const [dateStr, description, amount] = columns;
              
              if (dateStr && description && amount) {
                const parsedAmount = parseFloat(amount.replace(',', '.'));
                if (!isNaN(parsedAmount)) {
                  transactions.push({
                    date: dateStr,
                    description: description.trim(),
                    amount: parsedAmount,
                    uploadedAt: new Date().toISOString(),
                    processed: false
                  });
                }
              }
            }
          }
        } else {
          // Parse ING CSV format
          const headers = lines[headerLineIndex].split(';');
          console.log('CSV Headers:', headers);
          
          for (let i = headerLineIndex + 1; i < lines.length; i++) {
            const line = lines[i];
            if (!line.trim()) continue;
            
            const columns = line.split(';');
            console.log(`Processing CSV line ${i}:`, columns);
            
            if (columns.length >= 6) {
              // ING CSV format: Buchung;Wertstellungsdatum;Auftraggeber/Empfänger;Buchungstext;Verwendungszweck;Betrag;Währung
              const [buchung, wertstellungsdatum, auftraggeber, buchungstext, verwendungszweck, betrag, waehrung] = columns;
              
              if (wertstellungsdatum && betrag) {
                // Parse German date format using our enhanced parser
                const parsedDate = parseGermanDate(wertstellungsdatum);
                
                // Parse amount
                let parsedAmount = parseFloat(betrag.replace(',', '.').replace(/[^\d.-]/g, ''));
                if (!isNaN(parsedAmount)) {
                  // Combine description
                  let description = '';
                  if (buchungstext) description += buchungstext;
                  if (verwendungszweck) {
                    description += description ? ` - ${verwendungszweck}` : verwendungszweck;
                  }
                  
                  const transaction = {
                    date: parsedDate,
                    description: description.trim(),
                    recipient: auftraggeber ? auftraggeber.trim() : '',
                    amount: parsedAmount,
                    account: 'Import',
                    uploadedAt: new Date().toISOString()
                  };
                  
                  console.log('Parsed CSV transaction:', transaction);
                  transactions.push(transaction);
                }
              }
            }
          }
        }
        console.log('=== END CSV PARSING ===');
    
    return transactions;
  };

  // Trigger file upload
  const triggerFileUpload = () => {
    fileInputRef.current?.click();
  };

  // All existing state and data calculations remain the same...
  // (I'll keep all the existing data processing logic)
  
  // Placeholder data calculations - in actual implementation, use existing logic
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  const formatCurrencyNoDecimals = (amount) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  // Live data queries from database
  const transactions = useLiveQuery(() => db.transactions.toArray()) || [];
  const savingsGoals = useLiveQuery(() => db.savingsGoals.toArray()) || [];
  const debts = useLiveQuery(() => db.debts.toArray()) || [];
  const budgets = useLiveQuery(() => db.budgets.toArray()) || [];
  const userSettings = useLiveQuery(() => db.settings.get('userProfile')) || {};
  
  // Get subscription transactions from database
  const getSubscriptionTransactions = () => {
    // Find all transactions categorized as "Abo" or "Abos"
    const subscriptionTransactions = transactions.filter(t => {
      const category = (t.category || '').toLowerCase();
      return category.includes('abo') && t.amount < 0; // Only expense transactions
    });
    
    console.log('Found subscription transactions:', subscriptionTransactions.length);
    
    // Group by recipient/description to create subscription items
    const subscriptionMap = new Map();
    
    subscriptionTransactions.forEach(transaction => {
      const key = transaction.recipient || transaction.description || 'Unbekannt';
      const amount = Math.abs(transaction.amount);
      
      // Validate and log date parsing
      const transactionDate = new Date(transaction.date);
      if (isNaN(transactionDate.getTime())) {
        console.warn('Invalid transaction date:', { transaction, date: transaction.date });
        return; // Skip invalid dates
      }
      
      if (subscriptionMap.has(key)) {
        const existing = subscriptionMap.get(key);
        const existingDate = new Date(existing.lastDate);
        
        // Take the most recent amount (in case subscription cost changed)
        if (transactionDate > existingDate) {
          console.log('Updating subscription with newer transaction:', { key, oldDate: existing.lastDate, newDate: transaction.date });
          existing.amount = amount;
          existing.lastDate = transaction.date;
        }
        existing.transactionCount++;
        existing.transactions.push(transaction);
      } else {
        console.log('Creating new subscription entry:', { key, date: transaction.date, amount });
        subscriptionMap.set(key, {
          id: `sub_${key.replace(/[^a-zA-Z0-9]/g, '_')}`,
          name: key,
          amount: amount,
          isActive: true,
          lastDate: transaction.date,
          transactionCount: 1,
          transactions: [transaction]
        });
      }
    });
    
    const result = Array.from(subscriptionMap.values()).sort((a, b) => b.amount - a.amount);
    console.log('Final subscription results:', result);
    return result;
  };
  
  const subscriptions = getSubscriptionTransactions();
  
  // German wealth averages by age group (2023 Bundesbank survey data in EUR)
  // Source: Deutsche Bundesbank household wealth survey 2023
  // German wealth averages based on Bundesbank 2023 PHF survey
  // Overall median: €103,200 (2023), Mean: €324,800
  // Data source: Bundesbank Panel on Household Finances (PHF) 2023
  const germanWealthAverages = {
    '18-24': 11400,    // 2023 survey: under 25 median wealth
    '25-34': 45000,    // Estimated: significant increase from early career to family formation
    '35-44': 95000,    // Estimated: family peak accumulation phase before 45-54 range  
    '45-54': 154700,   // 2023 survey: 45-74 range peak accumulation period
    '55-64': 192000,   // 2023 survey: 45-74 range pre-retirement peak
    '65+': 175000      // 2023 survey: post-retirement decline in wealth
  };
  
  // Calculate comprehensive net worth from real data
  const calculateNetWorth = () => {
    // 1. Explicit Sparvermögen: Alle Sparziele (inkl. Notgroschen)
    const totalSavings = savingsGoals.reduce((sum, goal) => sum + (goal.currentAmount || 0), 0);
    
    // 2. Schulden: Alle aktuellen Schulden
    const totalDebt = debts.reduce((sum, debt) => sum + (debt.currentAmount || 0), 0);
    
    // 3. Liquide Mittel: Verfügbares Geld berechnet aus Transaktionen
    // Alle Einnahmen minus alle Ausgaben (ohne bereits in Sparziele eingezahlte Beträge)
    const totalIncome = transactions
      .filter(t => t.amount > 0)
      .reduce((sum, t) => sum + t.amount, 0);
    
    // Alle Ausgaben OHNE Sparbeträge (um Doppelzählung zu vermeiden)
    const nonSavingsExpenses = Math.abs(transactions
      .filter(t => t.amount < 0 && !detectSavings(t.category, t.description, t.recipient))
      .reduce((sum, t) => sum + t.amount, 0));
    
    // Verfügbares Geld = Einnahmen - Ausgaben (ohne Sparen)
    const liquidAssets = totalIncome - nonSavingsExpenses;
    
    // 4. Investment-Vermögen (placeholder - später aus investments Tabelle)
    const totalInvestments = 0; // TODO: Implement when investments table is ready
    
    // Debug-Output für Transparenz
    const finalNetWorth = totalSavings + totalInvestments + Math.max(0, liquidAssets) - totalDebt;
    console.log('Net Worth Calculation:', {
      totalSavings: `€${totalSavings.toLocaleString('de-DE')}`,
      totalDebt: `€${totalDebt.toLocaleString('de-DE')}`, 
      liquidAssets: `€${liquidAssets.toLocaleString('de-DE')}`,
      totalInvestments: `€${totalInvestments.toLocaleString('de-DE')}`,
      finalNetWorth: `€${finalNetWorth.toLocaleString('de-DE')}`
    });
    
    // Gesamtvermögen = Sparen + Investments + liquide Mittel - Schulden
    // Liquide Mittel nur wenn positiv (negative Werte bedeuten Überziehung, gehört zu Schulden)
    return totalSavings + totalInvestments + Math.max(0, liquidAssets) - totalDebt;
  };
  
  // Calculate Wealth Score based on German median wealth averages using real user age
  const calculateFinancialScore = (netWorth) => {
    const userAge = userSettings?.value?.age || 30; // Use real age from profile
    let ageGroup = '25-34';
    
    // Age group assignment based on German wealth survey brackets
    if (userAge < 25) ageGroup = '18-24';
    else if (userAge < 35) ageGroup = '25-34';
    else if (userAge < 45) ageGroup = '35-44';
    else if (userAge < 55) ageGroup = '45-54';
    else if (userAge < 65) ageGroup = '55-64';
    else ageGroup = '65+';
    
    const avgWealth = germanWealthAverages[ageGroup];
    const ratio = netWorth / avgWealth;
    
    // Score thresholds based on percentile analysis:
    // A = Top 20% (above 1.5x median)
    // B = Above average (0.8-1.5x median) 
    // C = Average range (0.4-0.8x median)
    // D = Below average (0.1-0.4x median)
    // F = Bottom 20% (below 0.1x median)
    
    let score;
    if (ratio >= 1.5) score = 'A';
    else if (ratio >= 0.8) score = 'B';
    else if (ratio >= 0.4) score = 'C';
    else if (ratio >= 0.1) score = 'D';
    else score = 'F';
    
    // Debug-Output für Transparenz
    console.log('Financial Score Calculation:', {
      userAge,
      ageGroup,
      avgWealth: `€${avgWealth.toLocaleString('de-DE')}`,
      netWorth: `€${netWorth.toLocaleString('de-DE')}`,
      ratio: ratio.toFixed(2),
      score,
      interpretation: ratio >= 1.5 ? 'Top 20% (Excellent)' : 
                     ratio >= 0.8 ? 'Above Average' : 
                     ratio >= 0.4 ? 'Average Range' : 
                     ratio >= 0.1 ? 'Below Average' : 'Bottom 20%'
    });
    
    return score;
  };
  
  // Calculate monthly income/expenses from selected month
  const calculateMonthlyMetrics = () => {
    const selectedDate = currentMonth || new Date();
    const selectedMonthIndex = selectedDate.getMonth();
    const selectedYear = selectedDate.getFullYear();
    
    const selectedMonthTransactions = transactions.filter(t => {
      const transactionDate = new Date(t.date);
      const isInMonth = transactionDate.getMonth() === selectedMonthIndex && 
                       transactionDate.getFullYear() === selectedYear;
      
      // Alle Transaktionen im Monat berücksichtigen - geteilte Ausgaben werden später anteilig berechnet
      return isInMonth;
    });
    
    const income = selectedMonthTransactions
      .filter(t => t.amount > 0)
      .reduce((sum, t) => sum + t.amount, 0);
      
    // Calculate actual savings (negative amounts that are savings-related)
    const savings = Math.abs(selectedMonthTransactions
      .filter(t => t.amount < 0 && detectSavings(t.category, t.description, t.recipient))
      .reduce((sum, t) => sum + t.amount, 0));

    // Only regular expenses (excluding savings and settlement transactions) for display
    const expenses = selectedMonthTransactions
      .filter(t => t.amount < 0 && 
                   !detectSavings(t.category, t.description, t.recipient) &&
                   !t.settledFromSharedExpense) // Ignore settlement transactions
      .reduce((sum, t) => {
        // Für geteilte Ausgaben: verwende den aktuellen (bereits reduzierten) Betrag
        return sum + Math.abs(t.amount);
      }, 0);
    
    return { income, expenses, savings };
  };
  
  // Calculate years to FI (Financial Independence) using profile data first
  const calculateYearsToFI = (currentNetWorth) => {
    // Use user's profile data for FI calculation
    const userAnnualIncome = userSettings?.value?.annualIncome;
    const userMonthlyExpensesInRetirement = userSettings?.value?.monthlyExpenses;
    
    // Priority 1: Use profile data if both income and retirement expenses are provided
    if (userAnnualIncome && userMonthlyExpensesInRetirement) {
      const annualRetirementExpenses = userMonthlyExpensesInRetirement * 12;
      const annualSavings = userAnnualIncome - annualRetirementExpenses;
      
      // Check if user can save money
      if (annualSavings <= 0) return null;
      
      // FI Target: 25x annual retirement expenses
      const fiTarget = annualRetirementExpenses * 25;
      
      // Calculate years to FI
      const yearsToFI = Math.max(0, (fiTarget - currentNetWorth) / annualSavings);
      return Math.ceil(yearsToFI);
    }
    
    // Priority 2: Partial profile data - only retirement expenses
    if (userMonthlyExpensesInRetirement) {
      const fiTarget = userMonthlyExpensesInRetirement * 12 * 25;
      
      // Try to use transaction data for income if available
      const monthlyMetrics = calculateMonthlyMetrics();
      const monthlyIncome = monthlyMetrics.income;
      
      if (monthlyIncome > 0) {
        const monthlySavings = monthlyIncome - userMonthlyExpensesInRetirement;
        if (monthlySavings <= 0) return null;
        
        const yearsToFI = Math.max(0, (fiTarget - currentNetWorth) / (monthlySavings * 12));
        return Math.ceil(yearsToFI);
      }
    }
    
    // Priority 3: Only annual income from profile
    if (userAnnualIncome) {
      // Use transaction data for expenses if available
      const monthlyMetrics = calculateMonthlyMetrics();
      const monthlyExpenses = monthlyMetrics.expenses;
      
      if (monthlyExpenses > 0) {
        const annualExpenses = monthlyExpenses * 12;
        const annualSavings = userAnnualIncome - annualExpenses;
        
        if (annualSavings <= 0) return null;
        
        const fiTarget = annualExpenses * 25;
        const yearsToFI = Math.max(0, (fiTarget - currentNetWorth) / annualSavings);
        return Math.ceil(yearsToFI);
      }
    }
    
    // Priority 4: Fallback to pure transaction-based calculation
    const monthlyMetrics = calculateMonthlyMetrics();
    const monthlyIncome = monthlyMetrics.income;
    const monthlyExpenses = monthlyMetrics.expenses;
    
    if (monthlyIncome > 0 && monthlyExpenses > 0) {
      const monthlySavings = monthlyIncome - monthlyExpenses;
      if (monthlySavings <= 0) return null;
      
      const fiTarget = monthlyExpenses * 12 * 25;
      const yearsToFI = Math.max(0, (fiTarget - currentNetWorth) / (monthlySavings * 12));
      return Math.ceil(yearsToFI);
    }
    
    // No sufficient data available
    return null;
  };
  
  // Calculate annual metrics (for the top dashboard cards)
  const calculateAnnualMetrics = () => {
    const now = new Date();
    const currentYear = now.getFullYear();
    
    const yearTransactions = transactions.filter(t => {
      const transactionDate = new Date(t.date);
      const isInYear = transactionDate.getFullYear() === currentYear;
      
      // Für geteilte Ausgaben: nur berücksichtigen wenn ich bezahlt habe oder keine geteilte Ausgabe
      if (t.sharedWith && Array.isArray(t.sharedWith) && t.sharedWith.length > 0) {
        return isInYear && t.paidByThem === true;
      }
      
      return isInYear;
    });
    
    const annualIncome = yearTransactions
      .filter(t => t.amount > 0)
      .reduce((sum, t) => sum + t.amount, 0);
    
    const annualSavings = Math.abs(yearTransactions
      .filter(t => t.amount < 0 && detectSavings(t.category, t.description, t.recipient))
      .reduce((sum, t) => sum + t.amount, 0));
    
    return { annualIncome, annualSavings };
  };

  // Real calculations with memoization for selected month
  const netWorth = calculateNetWorth();
  const monthlyMetrics = useMemo(() => calculateMonthlyMetrics(), [transactions, currentMonth]);
  const { income: monthlyIncome, expenses: monthlyExpense, savings: monthlySavings } = monthlyMetrics;
  const { annualIncome, annualSavings } = calculateAnnualMetrics();
  const fiScore = calculateFinancialScore(netWorth);
  const yearsToFI = calculateYearsToFI(netWorth);
  
  // Calculate annual savings rate in percentage (for top dashboard card)
  const annualSavingsRate = annualIncome > 0 ? (annualSavings / annualIncome * 100) : 0;
  
  // Calculate selected month savings rate in percentage (for monthly section)
  const currentMonthlySavingsRate = monthlyIncome > 0 ? (monthlySavings / monthlyIncome * 100) : 0;
  
  // Calculate realistic net cashflow for monthly display (already calculated in chart data)
  const totalMonthlyOutflow = monthlyExpense + monthlySavings;
  const monthlyNetCashflow = monthlyIncome - totalMonthlyOutflow;
  
  const dashboardMetrics = {
    netWorth,
    netWorthChange: 0, // Could be calculated by comparing with last month
    cashflowPositive: monthlyNetCashflow > 0
  };
  
  const fiMetrics = {
    finanzScore: fiScore,
    yearsToFI: yearsToFI
  };
  
  
  
  // Calculate expenses by category with percentage of total monthly expenses
  const calculateBudgetVsActual = () => {
    const selectedDate = currentMonth || new Date();
    const selectedMonthIndex = selectedDate.getMonth();
    const selectedYear = selectedDate.getFullYear();
    const selectedMonthBudget = selectedMonthIndex + 1; // Convert to 1-12 for budget comparison
    
    // Get all expense transactions for selected month (excluding settlement transactions)
    const selectedMonthTransactions = transactions.filter(t => {
      const transactionDate = new Date(t.date);
      const isInMonth = transactionDate.getMonth() === selectedMonthIndex && 
                       transactionDate.getFullYear() === selectedYear &&
                       t.amount < 0 && // Only expenses
                       !t.settledFromSharedExpense; // Exclude settlement transactions
      
      return isInMonth;
    });
    
    // Calculate total monthly expenses (use current transaction amounts)
    const totalMonthlyExpenses = selectedMonthTransactions.reduce((sum, t) => {
      return sum + Math.abs(t.amount);
    }, 0);
    
    // Group expenses by category (use current transaction amounts)
    const expensesByCategory = selectedMonthTransactions.reduce((acc, t) => {
      const category = t.category || 'Unbekannt';
      const amount = Math.abs(t.amount);
      acc[category] = (acc[category] || 0) + amount;
      return acc;
    }, {});
    
    // Create data for each category that has expenses
    return Object.entries(expensesByCategory).map(([categoryName, actual]) => {
      // Calculate percentage of total monthly expenses
      const percentageOfTotal = totalMonthlyExpenses > 0 ? (actual / totalMonthlyExpenses) * 100 : 0;
      
      // Try to find a budget for this category and month
      const budget = budgets.find(b => 
        b.categoryName === categoryName && 
        b.month === selectedMonthBudget && 
        b.year === selectedYear
      );
      
      return {
        name: categoryName,
        actual,
        budget: budget ? budget.amount : null,
        hasBudget: !!budget,
        totalMonthlyExpenses,
        progress: Math.round(percentageOfTotal * 10) / 10, // Round to 1 decimal place
        color: jonyColors.magenta,
        bgColor: jonyColors.magentaAlpha
      };
    }).sort((a, b) => b.actual - a.actual); // Sort by highest expenses first
  };
  
  const budgetVsActualData = useMemo(() => calculateBudgetVsActual(), [transactions, currentMonth, budgets]);
  
  // Use real savings goals data
  const savingsGoalsData = {
    chartData: savingsGoals.map(goal => ({
      name: goal.title,
      current: goal.currentAmount || 0,
      target: goal.targetAmount || 1,
      progressPercentage: goal.targetAmount > 0 ? 
        Math.round(((goal.currentAmount || 0) / goal.targetAmount) * 100) : 0
    }))
  };
  
  // Use real debt data
  const debtData = {
    chartData: debts.map(debt => ({
      name: debt.name,
      remaining: debt.currentAmount || 0,
      total: debt.totalAmount || 1,
      progressPercentage: debt.totalAmount > 0 ? 
        Math.round(((debt.totalAmount - (debt.currentAmount || 0)) / debt.totalAmount) * 100) : 0
    }))
  };
  
  

  // State for time period selection
  const [savingsRatePeriod, setSavingsRatePeriod] = useState('1year');
  const [cashflowPeriod, setCashflowPeriod] = useState('1year');

  // Generate daily spending data from real transactions for the selected month
  const generateDailySpendingData = (selectedMonth) => {
    const selectedDate = selectedMonth || new Date();
    const year = selectedDate.getFullYear();
    const monthIndex = selectedDate.getMonth();
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    
    // Get all expense transactions for the selected month (excluding settlement transactions)
    const monthTransactions = transactions.filter(t => {
      const transactionDate = new Date(t.date);
      const isInMonth = transactionDate.getMonth() === monthIndex && 
                       transactionDate.getFullYear() === year &&
                       t.amount < 0 && // Only expenses
                       !t.settledFromSharedExpense; // Exclude settlement transactions
      
      return isInMonth;
    });
    
    // Group expenses by day (use current transaction amounts)
    const dailyExpenses = {};
    monthTransactions.forEach(t => {
      const day = new Date(t.date).getDate();
      const amount = Math.abs(t.amount);
      dailyExpenses[day] = (dailyExpenses[day] || 0) + amount;
    });
    
    // Create daily data array
    const dailyData = [];
    for (let day = 1; day <= daysInMonth; day++) {
      dailyData.push({ 
        day, 
        expense: Math.round(dailyExpenses[day] || 0) 
      });
    }
    
    return dailyData;
  };

  const dailySpendingData = useMemo(() => generateDailySpendingData(currentMonth), [transactions, currentMonth]);


  // Calculate annual savings rate data with different views
  const calculateAnnualSavingsRateData = () => {
    const monthNames = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
    const now = new Date();
    const currentYear = now.getFullYear();
    
    // 1 Year View: All 12 months of current year
    const oneYearData = [];
    for (let month = 0; month < 12; month++) {
      const monthlyTransactions = filterTransactionsWithSharedExpenseLogic(transactions, t => {
        const transactionDate = new Date(t.date);
        return transactionDate.getMonth() === month && 
               transactionDate.getFullYear() === currentYear;
      });
      
      const income = monthlyTransactions
        .filter(t => t.amount > 0)
        .reduce((sum, t) => sum + t.amount, 0);
      
      const savingsAmount = Math.abs(monthlyTransactions
        .filter(t => t.amount < 0 && detectSavings(t.category, t.description, t.recipient))
        .reduce((sum, t) => sum + t.amount, 0));
      
      const savingsRate = income > 0 ? (savingsAmount / income * 100) : 0;
      
      oneYearData.push({
        month: monthNames[month],
        savingsRate: Math.max(0, Math.round(savingsRate * 10) / 10)
      });
    }
    
    // 5 Years View: Last 5 years (annual savings rates)
    const fiveYearsData = [];
    for (let i = 4; i >= 0; i--) {
      const year = currentYear - i;
      
      const yearTransactions = filterTransactionsWithSharedExpenseLogic(transactions, t => {
        const transactionDate = new Date(t.date);
        return transactionDate.getFullYear() === year;
      });
      
      const annualIncome = yearTransactions
        .filter(t => t.amount > 0)
        .reduce((sum, t) => sum + t.amount, 0);
      
      const annualSavings = Math.abs(yearTransactions
        .filter(t => t.amount < 0 && detectSavings(t.category, t.description, t.recipient))
        .reduce((sum, t) => sum + t.amount, 0));
      
      const annualSavingsRate = annualIncome > 0 ? (annualSavings / annualIncome * 100) : 0;
      
      fiveYearsData.push({
        month: year.toString(),
        savingsRate: Math.max(0, Math.round(annualSavingsRate * 10) / 10)
      });
    }
    
    // Max View: All years with data
    const allYears = [...new Set(transactions.map(t => new Date(t.date).getFullYear()))].sort();
    const maxData = allYears.map(year => {
      const yearTransactions = transactions.filter(t => {
        const transactionDate = new Date(t.date);
        return transactionDate.getFullYear() === year;
      });
      
      const annualIncome = yearTransactions
        .filter(t => t.amount > 0)
        .reduce((sum, t) => sum + t.amount, 0);
      
      const annualSavings = Math.abs(yearTransactions
        .filter(t => t.amount < 0 && detectSavings(t.category, t.description, t.recipient))
        .reduce((sum, t) => sum + t.amount, 0));
      
      const annualSavingsRate = annualIncome > 0 ? (annualSavings / annualIncome * 100) : 0;
      
      return {
        month: year.toString(),
        savingsRate: Math.max(0, Math.round(annualSavingsRate * 10) / 10)
      };
    });
    
    return {
      '1year': oneYearData,
      '5years': fiveYearsData,
      'max': maxData
    };
  };
  
  const annualSavingsRateData = calculateAnnualSavingsRateData();

  // Calculate cashflow data with different views
  const calculateCashflowData = () => {
    const monthNames = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
    const now = new Date();
    const currentYear = now.getFullYear();
    
    // 1 Year View: January to December of current year
    const oneYearData = [];
    for (let month = 0; month < 12; month++) {
      const monthlyTransactions = transactions.filter(t => {
        const transactionDate = new Date(t.date);
        return transactionDate.getMonth() === month && 
               transactionDate.getFullYear() === currentYear;
      });
      
      const income = monthlyTransactions
        .filter(t => t.amount > 0)
        .reduce((sum, t) => sum + t.amount, 0);
      
      // Separate savings from regular expenses  
      const savings = Math.abs(monthlyTransactions
        .filter(t => t.amount < 0 && detectSavings(t.category, t.description, t.recipient))
        .reduce((sum, t) => sum + t.amount, 0));
        
      const regularExpenses = Math.abs(monthlyTransactions
        .filter(t => t.amount < 0 && !detectSavings(t.category, t.description, t.recipient))
        .reduce((sum, t) => sum + t.amount, 0));
      
      // For cashflow chart: only show regular expenses (excluding savings)
      // Net calculation: income - regular expenses only (savings are separate positive activity)
      const netValue = Math.round(income - regularExpenses);
      
      oneYearData.push({
        month: monthNames[month],
        income: Math.round(income),
        expense: Math.round(regularExpenses),
        savings: Math.round(savings),
        regularExpenses: Math.round(regularExpenses),
        net: netValue
      });
    }
    
    // 5 Years View: Last 5 years (2021, 2022, 2023, 2024, 2025)
    const fiveYearsData = [];
    for (let i = 4; i >= 0; i--) {
      const year = currentYear - i;
      
      const yearTransactions = transactions.filter(t => {
        const transactionDate = new Date(t.date);
        return transactionDate.getFullYear() === year;
      });
      
      const income = yearTransactions
        .filter(t => t.amount > 0)
        .reduce((sum, t) => sum + t.amount, 0);
      
      // Separate savings from regular expenses  
      const savings = Math.abs(yearTransactions
        .filter(t => t.amount < 0 && detectSavings(t.category, t.description, t.recipient))
        .reduce((sum, t) => sum + t.amount, 0));
        
      const regularExpenses = Math.abs(yearTransactions
        .filter(t => t.amount < 0 && !detectSavings(t.category, t.description, t.recipient))
        .reduce((sum, t) => sum + t.amount, 0));
      
      // For cashflow chart: only show regular expenses (excluding savings)
      // Net calculation: income - regular expenses only (savings are separate positive activity)
      
      fiveYearsData.push({
        month: year.toString(),
        income: Math.round(income),
        expense: Math.round(regularExpenses), // Only regular expenses shown in chart
        savings: Math.round(savings),
        regularExpenses: Math.round(regularExpenses),
        net: Math.round(income - regularExpenses) // Net cashflow excluding savings
      });
    }
    
    // Max View: All years with data
    const allYears = [...new Set(transactions.map(t => new Date(t.date).getFullYear()))].sort();
    const maxData = allYears.map(year => {
      const yearTransactions = transactions.filter(t => {
        const transactionDate = new Date(t.date);
        return transactionDate.getFullYear() === year;
      });
      
      const income = yearTransactions
        .filter(t => t.amount > 0)
        .reduce((sum, t) => sum + t.amount, 0);
      
      // Separate savings from regular expenses  
      const savings = Math.abs(yearTransactions
        .filter(t => t.amount < 0 && detectSavings(t.category, t.description, t.recipient))
        .reduce((sum, t) => sum + t.amount, 0));
        
      const regularExpenses = Math.abs(yearTransactions
        .filter(t => t.amount < 0 && !detectSavings(t.category, t.description, t.recipient))
        .reduce((sum, t) => sum + t.amount, 0));
      
      // For cashflow chart: only show regular expenses (excluding savings)
      // Net calculation: income - regular expenses only (savings are separate positive activity)
      
      return {
        month: year.toString(),
        income: Math.round(income),
        expense: Math.round(regularExpenses), // Only regular expenses shown in chart
        savings: Math.round(savings),
        regularExpenses: Math.round(regularExpenses),
        net: Math.round(income - regularExpenses) // Net cashflow excluding savings
      };
    });
    
    return {
      '1year': oneYearData,
      '5years': fiveYearsData,
      'max': maxData
    };
  };
  
  const cashflowData = calculateCashflowData();
  

  return (
    <div className="min-h-screen font-sans" style={{ backgroundColor: jonyColors.background, color: jonyColors.textPrimary }}>
      {/* Header with Upload Button */}
      <div className="px-6 py-8 mb-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: jonyColors.accent1 }}></div>
              <h1 className="text-3xl font-bold tracking-tight" style={{ color: jonyColors.textPrimary, letterSpacing: '-0.02em' }}>
                Willkommen zurück, {userSettings?.value?.userName || 'User'}
              </h1>
            </div>
            
            <button
              onClick={triggerFileUpload}
              className="w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all duration-200 select-none"
              style={{ 
                borderColor: jonyColors.accent1,
                backgroundColor: 'transparent',
                outline: 'none',
                WebkitTapHighlightColor: 'transparent'
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = jonyColors.accent1;
                e.target.style.borderColor = jonyColors.accent1;
                e.target.style.transform = 'scale(1.05)';
                // Change icon color to black
                const icon = e.target.querySelector('.upload-icon');
                if (icon) icon.style.color = 'black';
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = 'transparent';
                e.target.style.borderColor = jonyColors.accent1;
                e.target.style.transform = 'scale(1)';
                // Change icon color back to green
                const icon = e.target.querySelector('.upload-icon');
                if (icon) icon.style.color = jonyColors.accent1;
              }}
              onFocus={(e) => {
                e.target.style.outline = 'none';
              }}
              onBlur={(e) => {
                e.target.style.outline = 'none';
              }}
            >
              <Plus 
                className="w-5 h-5 pointer-events-none select-none upload-icon" 
                style={{ 
                  color: jonyColors.accent1,
                  userSelect: 'none',
                  WebkitUserSelect: 'none',
                  MozUserSelect: 'none',
                  msUserSelect: 'none',
                  transition: 'color 0.2s ease'
                }} 
              />
            </button>

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv,.txt"
              onChange={handleFileUpload}
              multiple
              style={{ display: 'none' }}
            />
          </div>
        </div>
      </div>

      {/* 1. JAHRESÜBERSICHT & FORTSCHRITT */}
      <div className="px-6 mb-12">
        <div className="max-w-7xl mx-auto">
          
          {/* Top Row - Key Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {/* Nettovermögen */}
            <div className="p-6 rounded-2xl border flex items-center justify-center text-center h-40 select-none"
              style={{
                backgroundColor: jonyColors.surface,
                border: `1px solid ${jonyColors.border}`
              }}
              onMouseEnter={(e) => handleMouseEnter('netWorth', e)}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
            >
              <div>
                <div className="text-4xl font-bold mb-2" style={{ 
                  color: jonyColors.accent1
                }}>
                  {formatCurrencyNoDecimals(dashboardMetrics.netWorth)}
                </div>
                <div className="text-sm font-semibold" style={{ color: jonyColors.textPrimary }}>
                  Nettovermögen
                </div>
              </div>
            </div>

            {/* Years to FI */}
            <div className="p-6 rounded-2xl border flex items-center justify-center text-center h-40 select-none"
              style={{
                backgroundColor: jonyColors.surface,
                border: `1px solid ${jonyColors.border}`
              }}
              onMouseEnter={(e) => handleMouseEnter('fiProgress', e)}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
            >
              <div>
                <div className="text-5xl font-bold mb-2" style={{ 
                  color: (fiMetrics?.yearsToFI !== null && fiMetrics?.yearsToFI !== undefined) ? jonyColors.accent1 : jonyColors.textSecondary
                }}>
                  {(fiMetrics?.yearsToFI !== null && fiMetrics?.yearsToFI !== undefined) ? `${fiMetrics.yearsToFI}` : '∞'}
                </div>
                <div className="text-sm font-semibold" style={{ color: jonyColors.textPrimary }}>
                  Jahre zur FI
                </div>
              </div>
            </div>

            {/* Score */}
            <div className="p-6 rounded-2xl border flex items-center justify-center text-center h-40 select-none"
              style={{
                backgroundColor: jonyColors.surface,
                border: `1px solid ${jonyColors.border}`
              }}
              onMouseEnter={(e) => handleMouseEnter('wealthScore', e)}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
            >
              <div>
                <div className="text-5xl font-bold mb-2" style={{ 
                  color: fiMetrics?.finanzScore === 'A' ? jonyColors.accent1 : 
                         fiMetrics?.finanzScore === 'B' ? jonyColors.accent2 : 
                         fiMetrics?.finanzScore === 'C' ? jonyColors.magenta : jonyColors.magenta
                }}>
                  {fiMetrics?.finanzScore || 'C'}
                </div>
                <div className="text-sm font-semibold" style={{ color: jonyColors.textPrimary }}>
                  Score
                </div>
              </div>
            </div>

            {/* Annual Savings Rate */}
            <div className="p-6 rounded-2xl border flex items-center justify-center text-center h-40 select-none"
              style={{
                backgroundColor: jonyColors.surface,
                border: `1px solid ${jonyColors.border}`
              }}
              onMouseEnter={(e) => handleMouseEnter('savingsRate', e)}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
            >
              <div>
                <div className="text-5xl font-bold mb-2" style={{ 
                  color: jonyColors.accent1
                }}>
                  {Math.round(annualSavingsRate * 10) / 10}%
                </div>
                <div className="text-sm font-semibold" style={{ color: jonyColors.textPrimary }}>
                  Sparquote
                </div>
              </div>
            </div>
          </div>

          {/* Cashflow Entwicklung - Directly under metrics */}
          <div 
            className="p-6 rounded-2xl border mb-8"
            style={{
              backgroundColor: jonyColors.surface,
              border: `1px solid ${jonyColors.border}`
            }}
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl" style={{ backgroundColor: jonyColors.accent1Alpha }}>
                  <BarChart3 className="w-5 h-5" style={{ color: jonyColors.accent1, strokeWidth: 1.5 }} />
                </div>
                <h3 className="text-lg font-light tracking-tight" style={{ color: jonyColors.textPrimary }}>
                  Cashflow Entwicklung
                </h3>
              </div>
              <div className="flex gap-2">
                {['1year', '5years', 'max'].map((period) => (
                  <button
                    key={period}
                    onClick={() => setCashflowPeriod(period)}
                    className={`px-3 py-1 rounded-lg text-sm transition-all duration-200 ${
                      cashflowPeriod === period ? 'font-semibold' : 'hover:bg-opacity-80'
                    }`}
                    style={{
                      backgroundColor: cashflowPeriod === period ? jonyColors.accent1 : jonyColors.cardBackground,
                      color: cashflowPeriod === period ? 'black' : jonyColors.textPrimary,
                      border: `1px solid ${cashflowPeriod === period ? jonyColors.accent1 : jonyColors.border}`
                    }}
                  >
                    {period === '1year' ? '1J' : period === '5years' ? '5J' : 'Max'}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={cashflowData[cashflowPeriod]} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                  <defs>
                    <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={jonyColors.accent1} stopOpacity={0.7}/>
                      <stop offset="95%" stopColor={jonyColors.accent1} stopOpacity={0.1}/>
                    </linearGradient>
                    <linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={jonyColors.magenta} stopOpacity={0.7}/>
                      <stop offset="95%" stopColor={jonyColors.magenta} stopOpacity={0.1}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="1 1" stroke={jonyColors.textTertiary} opacity={0.2} />
                  <XAxis 
                    dataKey="month" 
                    stroke={jonyColors.textTertiary}
                    fontSize={11}
                    axisLine={false}
                    tickLine={false}
                    fontWeight={400}
                  />
                  <YAxis 
                    stroke={jonyColors.textTertiary}
                    fontSize={11}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(value) => formatCurrencyNoDecimals(value)}
                    fontWeight={400}
                  />
                  <Tooltip 
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div style={{
                            backgroundColor: jonyColors.surface,
                            border: `1px solid ${jonyColors.cardBorder}`,
                            borderRadius: '12px',
                            padding: '12px 16px',
                            boxShadow: '0 12px 40px rgba(0, 0, 0, 0.6)',
                            color: jonyColors.textPrimary,
                            fontSize: '14px',
                            fontWeight: '500'
                          }}>
                            <p style={{ 
                              color: jonyColors.textPrimary, 
                              margin: '0 0 8px 0',
                              fontWeight: '600'
                            }}>
                              {label}
                            </p>
                            {payload.map((entry, index) => (
                              <p key={index} style={{ 
                                color: jonyColors.textPrimary,
                                margin: '4px 0',
                                fontWeight: '500'
                              }}>
                                <span style={{ color: entry.color }}>●</span>{' '}
                                {entry.name === 'income' ? 'Einnahmen' : 
                                 entry.name === 'expense' ? 'Ausgaben' : 'Netto'}: {' '}
                                {formatCurrencyNoDecimals(entry.value)}
                              </p>
                            ))}
                          </div>
                        );
                      }
                      return null;
                    }}
                    cursor={{ fill: jonyColors.accent1Alpha, opacity: 0.1 }}
                  />
                  <Bar 
                    dataKey="income" 
                    fill="url(#incomeGradient)" 
                    radius={[6, 6, 0, 0]} 
                    name="income" 
                  />
                  <Bar 
                    dataKey="expense" 
                    fill="url(#expenseGradient)" 
                    radius={[6, 6, 0, 0]} 
                    name="expense" 
                  />
                  <Line 
                    type="monotone" 
                    dataKey="net" 
                    stroke={jonyColors.accent1} 
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 6, fill: jonyColors.accent1, strokeWidth: 2, stroke: 'white' }}
                    name="net"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Savings Rate Development */}
          <div 
            className="p-6 rounded-2xl border mb-8"
            style={{
              backgroundColor: jonyColors.surface,
              border: `1px solid ${jonyColors.border}`
            }}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl" style={{ backgroundColor: jonyColors.accent1Alpha }}>
                  <TrendingUp className="w-5 h-5" style={{ color: jonyColors.accent1, strokeWidth: 1.5 }} />
                </div>
                <h3 className="text-lg font-light tracking-tight" style={{ color: jonyColors.textPrimary }}>
                  Sparquote
                </h3>
              </div>
              <div className="flex gap-2">
                {['1year', '5years', 'max'].map((period) => (
                  <button
                    key={period}
                    onClick={() => setSavingsRatePeriod(period)}
                    className={`px-3 py-1 rounded-lg text-sm transition-all duration-200 ${
                      savingsRatePeriod === period ? 'font-semibold' : 'hover:bg-opacity-80'
                    }`}
                    style={{
                      backgroundColor: savingsRatePeriod === period ? jonyColors.accent1 : jonyColors.cardBackground,
                      color: savingsRatePeriod === period ? 'black' : jonyColors.textPrimary,
                      border: `1px solid ${savingsRatePeriod === period ? jonyColors.accent1 : jonyColors.border}`
                    }}
                  >
                    {period === '1year' ? '1J' : period === '5years' ? '5J' : 'Max'}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={annualSavingsRateData[savingsRatePeriod]} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                  <defs>
                    <linearGradient id="savingsGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={jonyColors.accent1} stopOpacity={0.3}/>
                      <stop offset="95%" stopColor={jonyColors.accent1} stopOpacity={0.05}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="1 1" stroke={jonyColors.textTertiary} opacity={0.2} />
                  <XAxis 
                    dataKey="month" 
                    axisLine={false} 
                    tickLine={false} 
                    fontSize={11}
                    stroke={jonyColors.textTertiary}
                    fontWeight={400}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    fontSize={11}
                    stroke={jonyColors.textTertiary}
                    tickFormatter={(value) => `${value}%`} 
                    fontWeight={400}
                  />
                  <Tooltip 
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div style={{
                            backgroundColor: jonyColors.surface,
                            border: `1px solid ${jonyColors.cardBorder}`,
                            borderRadius: '12px',
                            padding: '12px 16px',
                            boxShadow: '0 12px 40px rgba(0, 0, 0, 0.6)',
                            color: jonyColors.textPrimary,
                            fontSize: '14px',
                            fontWeight: '500'
                          }}>
                            <p style={{ 
                              color: jonyColors.textPrimary, 
                              margin: '0 0 8px 0',
                              fontWeight: '600'
                            }}>
                              {label}
                            </p>
                            {payload.map((entry, index) => (
                              <p key={index} style={{ 
                                color: jonyColors.textPrimary,
                                margin: '4px 0',
                                fontWeight: '500'
                              }}>
                                <span style={{ color: entry.color }}>●</span>{' '}
                                Sparquote: {entry.value}%
                              </p>
                            ))}
                          </div>
                        );
                      }
                      return null;
                    }}
                    cursor={{ fill: jonyColors.accent1Alpha, opacity: 0.1 }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="savingsRate" 
                    stroke={jonyColors.accent1} 
                    strokeWidth={2}
                    fill="url(#savingsGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Sparziele & Schuldenabbau - Linear Progress Bars */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* Sparziele */}
            <div 
              className="p-8 rounded-3xl  transition-all duration-300 hover:bg-opacity-90"
              style={{
                backgroundColor: jonyColors.surface,
                border: `1px solid ${jonyColors.border}`,
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)'
              }}
            >
              <div className="flex items-center gap-4 mb-6">
                <div className="p-3 rounded-xl" style={{ backgroundColor: jonyColors.accent1Alpha }}>
                  <Target className="w-5 h-5" style={{ color: jonyColors.accent1, strokeWidth: 1.5 }} />
                </div>
                <h3 className="text-lg font-light tracking-tight" style={{ color: jonyColors.textPrimary }}>
                  Sparziele
                </h3>
              </div>
              
              {savingsGoalsData && savingsGoalsData.chartData.length > 0 ? (
                <div className="space-y-4">
                  {savingsGoalsData.chartData.slice(0, 4).map((goal, index) => (
                    <div key={index} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium tracking-tight" style={{ color: jonyColors.textPrimary }}>
                          {goal.name}
                        </span>
                        <span className="text-sm font-light" style={{ color: jonyColors.accent1 }}>
                          {goal.progressPercentage.toFixed(0)}%
                        </span>
                      </div>
                      
                      {/* Progress Bar */}
                      <div className="w-full rounded-full h-3 mb-2" style={{ backgroundColor: jonyColors.accent1Alpha }}>
                        <div 
                          className="h-3 rounded-full transition-all duration-500"
                          style={{ 
                            width: `${goal.progressPercentage}%`,
                            backgroundColor: jonyColors.accent1,
                            boxShadow: '0 1px 2px rgba(34, 197, 94, 0.2)'
                          }}
                        ></div>
                      </div>
                      
                      <div className="text-xs font-light" style={{ color: jonyColors.textSecondary }}>
                        {formatCurrency(goal.current)} von {formatCurrency(goal.target)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="text-sm" style={{ color: jonyColors.textSecondary }}>
                    Keine Sparziele definiert
                  </div>
                </div>
              )}
            </div>

            {/* Schulden */}
            <div 
              className="p-8 rounded-3xl  transition-all duration-300 hover:bg-opacity-90"
              style={{
                backgroundColor: jonyColors.surface,
                border: `1px solid ${jonyColors.border}`,
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)'
              }}
            >
              <div className="flex items-center gap-4 mb-6">
                <div className="p-3 rounded-xl" style={{ backgroundColor: jonyColors.magentaAlpha }}>
                  <AlertTriangle className="w-5 h-5" style={{ color: jonyColors.magenta, strokeWidth: 1.5 }} />
                </div>
                <h3 className="text-lg font-light tracking-tight" style={{ color: jonyColors.textPrimary }}>
                  Schuldenabbau
                </h3>
              </div>
              
              {debtData && debtData.chartData.length > 0 ? (
                <div className="space-y-4">
                  {debtData.chartData.slice(0, 4).map((debt, index) => (
                    <div key={index} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium tracking-tight" style={{ color: jonyColors.textPrimary }}>
                          {debt.name}
                        </span>
                        <span className="text-sm font-light" style={{ color: jonyColors.magenta }}>
                          {debt.progressPercentage.toFixed(0)}%
                        </span>
                      </div>
                      
                      {/* Progress Bar */}
                      <div className="w-full rounded-full h-3 mb-2" style={{ backgroundColor: jonyColors.magentaAlpha }}>
                        <div 
                          className="h-3 rounded-full transition-all duration-500"
                          style={{ 
                            width: `${debt.progressPercentage}%`,
                            backgroundColor: jonyColors.magenta,
                            boxShadow: '0 1px 2px rgba(245, 158, 11, 0.2)'
                          }}
                        ></div>
                      </div>
                      
                      <div className="text-xs font-light" style={{ color: jonyColors.textSecondary }}>
                        {formatCurrency(debt.remaining)} von {formatCurrency(debt.total)} verbleibend
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="text-sm" style={{ color: jonyColors.textSecondary }}>
                    Schuldenfrei
                  </div>
                </div>
              )}
            </div>
          </div>
          {/* Subscriptions Section */}
          <div 
            className="p-8 rounded-3xl  transition-all duration-300 hover:bg-opacity-90"
            style={{
              backgroundColor: jonyColors.surface,
              border: `1px solid ${jonyColors.border}`,
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)'
            }}
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl" style={{ backgroundColor: jonyColors.magentaAlpha }}>
                  <PieChartIcon className="w-5 h-5" style={{ color: jonyColors.magenta, strokeWidth: 1.5 }} />
                </div>
                <h3 className="text-lg font-light tracking-tight" style={{ color: jonyColors.textPrimary }}>
                  Deine Abos
                </h3>
              </div>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setShowAddSubscriptionModal(true)}
                  className="p-2 rounded-lg transition-all duration-200"
                  style={{ 
                    backgroundColor: jonyColors.accent1Alpha,
                    color: jonyColors.accent1
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.backgroundColor = jonyColors.accent1;
                    e.target.style.color = 'black';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.backgroundColor = jonyColors.accent1Alpha;
                    e.target.style.color = jonyColors.accent1;
                  }}
                  title="Manuelles Abo hinzufügen"
                >
                  <Plus className="w-4 h-4" />
                </button>
                <span className="text-lg font-light tracking-tight" style={{ color: jonyColors.magenta }}>
                  {subscriptions
                    .filter(sub => sub.isActive)
                    .reduce((total, sub) => total + sub.amount, 0)
                    .toFixed(2)}€/Monat
                </span>
              </div>
            </div>
            
            {subscriptions.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {subscriptions.map((subscription) => (
                  <div 
                    key={subscription.id}
                    className="p-6 rounded-2xl text-center transition-all duration-300 relative group"
                    style={{
                      backgroundColor: jonyColors.surface,
                      border: `1px solid ${jonyColors.cardBorder}`,
                      minHeight: '140px'
                    }}
                  >
                    {/* Remove button - positioned in top right */}
                    <button
                      onClick={() => removeFromSubscriptions(subscription)}
                      className="absolute top-2 right-2 w-6 h-6 rounded-full transition-all duration-300 flex items-center justify-center opacity-0 group-hover:opacity-100"
                      style={{
                        backgroundColor: jonyColors.magentaAlpha,
                        color: jonyColors.magenta
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.backgroundColor = jonyColors.magenta;
                        e.target.style.color = 'white';
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.backgroundColor = jonyColors.magentaAlpha;
                        e.target.style.color = jonyColors.magenta;
                      }}
                      title="Aus Abos entfernen"
                    >
                      <span style={{ fontSize: '12px', fontWeight: 'bold' }}>×</span>
                    </button>

                    {/* Transaction count indicator */}
                    <div 
                      className="absolute top-2 left-2 px-2 py-1 rounded-full text-xs font-medium"
                      style={{
                        backgroundColor: jonyColors.accent1Alpha,
                        color: jonyColors.accent1
                      }}
                    >
                      {subscription.transactionCount}x
                    </div>

                    {/* Main content - centered like monthly metrics */}
                    <div className="flex flex-col items-center justify-center h-full">
                      <div 
                        className="text-4xl font-bold mb-2"
                        style={{ 
                          color: jonyColors.magenta
                        }}
                      >
                        {subscription.amount.toFixed(2)}€
                      </div>
                      <div 
                        className="text-sm font-semibold"
                        style={{ 
                          color: jonyColors.textPrimary
                        }}
                      >
                        {subscription.name}
                      </div>
                      <div 
                        className="text-xs mt-1"
                        style={{ 
                          color: jonyColors.textSecondary
                        }}
                      >
                        Letzte Zahlung: {new Date(subscription.lastDate).toLocaleDateString('de-DE')}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="text-sm" style={{ color: jonyColors.textSecondary }}>
                  Keine Abos gefunden. Kategorisiere Transaktionen als "Abo" oder füge manuell hinzu.
                </div>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* 2. MONATLICHE METRIKEN */}
      <div className="px-6 mb-12">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: jonyColors.accent1 }}></div>
              <h2 className="text-3xl font-bold tracking-tight" style={{ color: jonyColors.textPrimary, letterSpacing: '-0.02em' }}>
                Monatliche Metriken
              </h2>
            </div>
            
            {/* Monats-Umschalter */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => changeMonth(-1)}
                className="p-3 rounded-full transition-all duration-200"
                style={{ backgroundColor: jonyColors.cardBackground, color: jonyColors.textSecondary }}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = jonyColors.accent1Alpha;
                  e.target.style.color = jonyColors.accent1;
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = jonyColors.cardBackground;
                  e.target.style.color = jonyColors.textSecondary;
                }}
                title="⬅️ Previous Month | Navigate Timeline"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="font-semibold text-center" style={{ color: jonyColors.textPrimary, minWidth: '200px', fontSize: '20px' }}>
                {currentMonth ? currentMonth.toLocaleString('de-DE', { month: 'long', year: 'numeric' }) : 'September 2025'}
              </div>
              <button
                onClick={() => changeMonth(1)}
                className="p-3 rounded-full transition-all duration-200"
                style={{ backgroundColor: jonyColors.cardBackground, color: jonyColors.textSecondary }}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = jonyColors.accent1Alpha;
                  e.target.style.color = jonyColors.accent1;
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = jonyColors.cardBackground;
                  e.target.style.color = jonyColors.textSecondary;
                }}
                title="➡️ Next Month | Navigate Timeline"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
          
          {/* Three metric cards in a row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {/* Monatliche Einnahmen */}
            <div className="p-6 rounded-2xl border flex items-center justify-center text-center h-40 select-none"
              style={{
                backgroundColor: jonyColors.surface,
                border: `1px solid ${jonyColors.border}`
              }}>
              <div>
                <div className="text-4xl font-bold mb-2" style={{ 
                  color: jonyColors.accent1
                }}>
                  {formatCurrencyNoDecimals(monthlyIncome)}
                </div>
                <div className="text-sm font-semibold" style={{ color: jonyColors.textPrimary }}>
                  Monatliche Einnahmen
                </div>
              </div>
            </div>

            {/* Monatliche Ausgaben */}
            <div className="p-6 rounded-2xl border flex items-center justify-center text-center h-40 select-none"
              style={{
                backgroundColor: jonyColors.surface,
                border: `1px solid ${jonyColors.border}`
              }}>
              <div>
                <div className="text-4xl font-bold mb-2" style={{ 
                  color: jonyColors.magenta
                }}>
                  {formatCurrencyNoDecimals(monthlyExpense)}
                </div>
                <div className="text-sm font-semibold" style={{ color: jonyColors.textPrimary }}>
                  Monatliche Ausgaben
                </div>
              </div>
            </div>

            {/* Monatliche Sparquote */}
            <div className="p-6 rounded-2xl border flex items-center justify-center text-center h-40 select-none"
              style={{
                backgroundColor: jonyColors.surface,
                border: `1px solid ${jonyColors.border}`
              }}>
              <div>
                <div className="text-4xl font-bold mb-2" style={{ 
                  color: jonyColors.accent1
                }}>
                  {Math.round(currentMonthlySavingsRate * 10) / 10}%
                </div>
                <div className="text-sm font-semibold" style={{ color: jonyColors.textPrimary }}>
                  Monatliche Sparquote
                </div>
              </div>
            </div>
          </div>

          {/* Full-width card for expenses by category */}
          <div 
            className="p-8 rounded-3xl  mb-8 transition-all duration-300 hover:bg-opacity-90"
            style={{
              backgroundColor: jonyColors.surface,
              border: `1px solid ${jonyColors.border}`,
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)'
            }}
          >
            <div className="flex items-center gap-4 mb-8">
              <div 
                className="p-3 rounded-xl"
                style={{ backgroundColor: jonyColors.magentaAlpha }}
              >
                <BarChart3 className="w-5 h-5" style={{ color: jonyColors.magenta, strokeWidth: 1.5 }} />
              </div>
              <h3 className="text-lg font-light tracking-tight" style={{ color: jonyColors.textPrimary }}>
                Ausgaben pro Kategorie
              </h3>
            </div>
            
            {budgetVsActualData.length > 0 ? (
              <div className="space-y-6">
                {budgetVsActualData.map((item, index) => {
                  return (
                    <div key={index} className="space-y-3">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-medium tracking-tight" style={{ color: jonyColors.textPrimary }}>
                            {item.name}
                          </span>
                          <div 
                            className="px-2 py-1 rounded-md text-xs font-medium"
                            style={{ 
                              backgroundColor: item.bgColor,
                              color: item.color
                            }}
                          >
                            {item.progress}%
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium" style={{ 
                            color: jonyColors.textPrimary 
                          }}>
                            {item.hasBudget 
                              ? `${formatCurrencyNoDecimals(item.actual)} / ${formatCurrencyNoDecimals(item.budget)}`
                              : formatCurrency(item.actual)
                            }
                          </div>
                          {item.hasBudget && (
                            <div className="text-xs font-light" style={{ color: jonyColors.textSecondary }}>
                              Budget
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Progress Bar - shows percentage of total monthly expenses */}
                      <div className="w-full rounded-full h-3" style={{ backgroundColor: item.bgColor }}>
                        <div 
                          className="h-3 rounded-full transition-all duration-500"
                          style={{ 
                            width: `${item.progress}%`,
                            backgroundColor: item.color,
                            boxShadow: `0 1px 2px ${item.color}33`
                          }}
                        ></div>
                      </div>
                      
                      {item.hasBudget && (
                        <div className="flex justify-between text-xs font-light" style={{ color: jonyColors.textSecondary }}>
                          <span>
                            {item.actual > item.budget 
                              ? `Überschreitung: ${formatCurrency(item.actual - item.budget)}`
                              : `Verbleibend: ${formatCurrency(item.budget - item.actual)}`
                            }
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="text-sm" style={{ color: jonyColors.textSecondary }}>
                  Keine Daten verfügbar
                </div>
              </div>
            )}
          </div>

          {/* Daily Spending Behavior - Full Width */}
          <div 
            className="p-8 rounded-3xl  mb-8 transition-all duration-300 hover:bg-opacity-90"
            style={{
              backgroundColor: jonyColors.surface,
              border: `1px solid ${jonyColors.border}`,
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)'
            }}
          >
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl" style={{ backgroundColor: jonyColors.magentaAlpha }}>
                  <BarChart3 className="w-5 h-5" style={{ color: jonyColors.magenta, strokeWidth: 1.5 }} />
                </div>
                <h3 className="text-lg font-light tracking-tight" style={{ color: jonyColors.textPrimary }}>
                  Ausgabenverhalten pro Tag
                </h3>
              </div>
            </div>
            
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart 
                  data={dailySpendingData} 
                  margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                >
                  <defs>
                    <linearGradient id="dailySpendingGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={jonyColors.magenta} stopOpacity={0.3}/>
                      <stop offset="95%" stopColor={jonyColors.magenta} stopOpacity={0.05}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="1 1" stroke={jonyColors.textTertiary} opacity={0.2} />
                  <XAxis 
                    dataKey="day" 
                    stroke={jonyColors.textTertiary}
                    fontSize={11}
                    fontWeight={400}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis 
                    stroke={jonyColors.textTertiary}
                    fontSize={11}
                    tickFormatter={(value) => value + '€'}
                    fontWeight={400}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip 
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div style={{
                            backgroundColor: jonyColors.surface,
                            border: `1px solid ${jonyColors.cardBorder}`,
                            borderRadius: '12px',
                            padding: '12px 16px',
                            boxShadow: '0 12px 40px rgba(0, 0, 0, 0.6)',
                            color: jonyColors.textPrimary,
                            fontSize: '14px',
                            fontWeight: '500'
                          }}>
                            <p style={{ 
                              color: jonyColors.textPrimary, 
                              margin: '0 0 8px 0',
                              fontWeight: '600'
                            }}>
                              Tag {label}
                            </p>
                            {payload.map((entry, index) => (
                              <p key={index} style={{ 
                                color: jonyColors.textPrimary,
                                margin: '4px 0',
                                fontWeight: '500'
                              }}>
                                <span style={{ color: entry.color }}>●</span>{' '}
                                Ausgaben: {entry.value}€
                              </p>
                            ))}
                          </div>
                        );
                      }
                      return null;
                    }}
                    cursor={{ fill: jonyColors.accent1Alpha, opacity: 0.1 }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="expense" 
                    stroke={jonyColors.magenta} 
                    strokeWidth={2}
                    fill="url(#dailySpendingGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>
      </div>

      {/* Custom Cyberpunk Tooltip */}
      {hoveredMetric && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{
            bottom: '44px',
            right: '36px'
          }}
        >
          <div style={{
            backgroundColor: jonyColors.surface,
            border: `1px solid ${jonyColors.cardBorder}`,
            borderRadius: '6px',
            padding: '8px 10px',
            boxShadow: `0 4px 12px rgba(0, 0, 0, 0.4)`,
            color: jonyColors.textPrimary,
            maxWidth: '320px'
          }}>
            {(() => {
              const tooltipContent = getTooltipContent(hoveredMetric);
              return tooltipContent ? (
                <>
                  <p style={{ 
                    color: jonyColors.accent1, 
                    margin: '0 0 6px 0',
                    fontWeight: '600',
                    fontSize: '14px'
                  }}>
                    {tooltipContent.title}
                  </p>
                  <p style={{ 
                    color: jonyColors.textSecondary,
                    margin: '0',
                    fontSize: '12px',
                    fontWeight: '400'
                  }}>
                    {tooltipContent.details}
                  </p>
                </>
              ) : null;
            })()}
          </div>
        </div>
      )}

      {/* Add Subscription Modal */}
      {showAddSubscriptionModal && (
        <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 p-4" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
          <div className="rounded-2xl max-w-md w-full p-6 shadow-xl" style={{ backgroundColor: jonyColors.surface }}>
            <h2 className="text-xl font-bold mb-6" style={{ color: jonyColors.textPrimary }}>Manuelles Abo hinzufügen</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: jonyColors.textPrimary }}>
                  Name des Abos
                </label>
                <input
                  type="text"
                  value={newSubscription.name}
                  onChange={(e) => setNewSubscription(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 transition-colors"
                  style={{
                    backgroundColor: jonyColors.cardBackground,
                    color: jonyColors.textPrimary,
                    borderColor: jonyColors.border,
                    '--tw-ring-color': jonyColors.accent1
                  }}
                  placeholder="z.B. Netflix, Spotify"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: jonyColors.textPrimary }}>
                  Monatlicher Betrag
                </label>
                <input
                  type="number"
                  value={newSubscription.amount}
                  onChange={(e) => setNewSubscription(prev => ({ ...prev, amount: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 transition-colors"
                  style={{
                    backgroundColor: jonyColors.cardBackground,
                    color: jonyColors.textPrimary,
                    borderColor: jonyColors.border,
                    '--tw-ring-color': jonyColors.accent1
                  }}
                  placeholder="9.99"
                  step="0.01"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowAddSubscriptionModal(false)}
                className="flex-1 px-4 py-2 rounded-lg font-medium transition-colors"
                style={{
                  backgroundColor: jonyColors.cardBackground,
                  color: jonyColors.textSecondary
                }}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = jonyColors.border;
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = jonyColors.cardBackground;
                }}
              >
                Abbrechen
              </button>
              <button
                onClick={addManualSubscription}
                disabled={!newSubscription.name || !newSubscription.amount}
                className="flex-1 px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: jonyColors.accent1, color: jonyColors.background }}
                onMouseEnter={(e) => {
                  if (!e.target.disabled) {
                    e.target.style.backgroundColor = jonyColors.greenDark;
                  }
                }}
                onMouseLeave={(e) => {
                  if (!e.target.disabled) {
                    e.target.style.backgroundColor = jonyColors.accent1;
                  }
                }}
              >
                Hinzufügen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notifications */}
      <Toast toasts={toasts} removeToast={removeToast} />

    </div>
  );
};

export default DashboardPage;