import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../utils/db';
import { jonyColors } from '../theme';
import * as XLSX from 'xlsx';

// Unified icon system
import { 
  CheckCircle, Trash2, ArrowLeft, Plus, X, Building, Calendar, 
  Wallet, SkipForward, Tag, Users, Sparkles, Clock, TrendingUp,
  AlertCircle, Search, Brain, Send, Target, Receipt, User, Crown, 
  Flame, CreditCard, ChevronRight, Zap, Upload
} from 'lucide-react';

import AutocompleteCategorySelector from './AutocompleteCategorySelector';

const formatCurrency = (amount) => 
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount);

const InboxPage = ({ categories, classifier, enhancedClassifier, useEnhancedML }) => {
  const [isClient, setIsClient] = useState(false);
  const [currentTransactionIndex, setCurrentTransactionIndex] = useState(0);
  const [processingIds, setProcessingIds] = useState(new Set());
  const [sharedExpenseData, setSharedExpenseData] = useState(null);
  const [showClearConfirmation, setShowClearConfirmation] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [personSearch, setPersonSearch] = useState('');
  const [showPersonSuggestions, setShowPersonSuggestions] = useState(false);
  const [isExcelProcessing, setIsExcelProcessing] = useState(false);
  const fileInputRef = useRef(null);

  // Load contacts
  const allContacts = useLiveQuery(() => 
    isClient ? db.contacts?.toArray() : [], [isClient]
  ) || [];
  const frequentContacts = allContacts.slice(0, 4);
  const personSuggestions = allContacts.filter(c => 
    c.name.toLowerCase().includes(personSearch.toLowerCase()) &&
    !sharedExpenseData?.sharedWith?.some(s => s.name === c.name)
  );
  
  useEffect(() => { setIsClient(true); }, []);

  const allInboxTransactions = useLiveQuery(() => 
    isClient ? db.inbox.orderBy('uploadedAt').reverse().toArray() : [], [isClient]
  );
  
  const inboxTransactions = allInboxTransactions?.filter(tx => !tx.skipped) || [];
  const currentTx = inboxTransactions?.[currentTransactionIndex];

  // Enhanced ML suggestions with unified styling
  const getMLSuggestions = (transaction) => {
    if (!transaction) return [];
    const suggestions = [];
    const classifierSuggestions = useEnhancedML && enhancedClassifier 
      ? enhancedClassifier.getCategorySuggestions(transaction, categories || [])
      : classifier?.getCategorySuggestions(transaction.description, categories || [], 3) || [];
    
    classifierSuggestions.forEach(suggestion => {
      const categoryName = useEnhancedML ? suggestion.category?.name : 
        typeof suggestion === 'string' ? suggestion : suggestion.category?.name || suggestion.category || suggestion.name;
      if (categoryName) {
        const confidence = useEnhancedML ? suggestion.confidence : (suggestion.confidence || 0.7);
        suggestions.push({
          name: categoryName,
          confidence,
          ...getConfidenceStyle(confidence)
        });
      }
    });
    return suggestions.slice(0, 3);
  };

  const getConfidenceStyle = (confidence) => {
    if (confidence >= 0.9) return { 
      icon: Crown, 
      iconColor: 'text-amber-500', 
      bgColor: 'bg-amber-50 dark:bg-amber-950/30',
      borderColor: 'border-amber-200 dark:border-amber-800',
      textColor: 'text-amber-900 dark:text-amber-100'
    };
    if (confidence >= 0.75) return { 
      icon: Flame, 
      iconColor: 'text-orange-500', 
      bgColor: 'bg-orange-50 dark:bg-orange-950/30',
      borderColor: 'border-orange-200 dark:border-orange-800',
      textColor: 'text-orange-900 dark:text-orange-100'
    };
    return { 
      icon: Target, 
      iconColor: 'text-blue-500', 
      bgColor: 'bg-blue-50 dark:bg-blue-950/30',
      borderColor: 'border-blue-200 dark:border-blue-800',
      textColor: 'text-blue-900 dark:text-blue-100'
    };
  };

  const handleCreateCategory = async (categoryName) => {
    try {
      const newCategory = { 
        name: categoryName, 
        color: `#${Math.floor(Math.random()*16777215).toString(16).padStart(6, '0')}`,
        createdAt: new Date().toISOString()
      };
      await db.categories.add(newCategory);
      return categoryName;
    } catch (error) { 
      console.error('Error creating category:', error); 
      return categoryName; 
    }
  };
  
  const handleProcessTransaction = async () => {
    if (!currentTx || !selectedCategory.trim()) return;
    const categoryName = selectedCategory.trim();
    
    setProcessingIds(prev => new Set(prev).add(currentTx.id));
    
    try {
      if (!categories?.find(cat => cat.name.toLowerCase() === categoryName.toLowerCase())) {
        await handleCreateCategory(categoryName);
      }

      const finalTransaction = {
        date: currentTx.date, 
        description: currentTx.description, 
        recipient: currentTx.recipient,
        amount: currentTx.amount, 
        account: currentTx.account, 
        category: categoryName,
        processedAt: new Date().toISOString(),
        ...(sharedExpenseData && {
          sharedWith: sharedExpenseData.sharedWith, 
          splitType: sharedExpenseData.splitType
        })
      };
      
      await db.transactions.add(finalTransaction);
      
      if (sharedExpenseData && sharedExpenseData.sharedWith.length > 0) {
        const expense = {
          description: currentTx.description,
          totalAmount: Math.abs(currentTx.amount),
          date: currentTx.date,
          paidBy: 'Me',
          settledAmount: 0,
          createdAt: new Date().toISOString(),
          sharedWith: sharedExpenseData.sharedWith.map(p => ({
            ...p,
            amount: sharedExpenseData.splitType === 'equal' 
              ? Math.abs(currentTx.amount) / (sharedExpenseData.sharedWith.length + 1)
              : p.amount
          })),
          splitType: sharedExpenseData.splitType
        };
        await db.sharedExpenses.add(expense);
      }
      
      if (classifier && typeof classifier.getModel === 'function' && currentTx.description) {
        classifier.learn(currentTx.description, categoryName);
        await db.settings.put({ key: 'mlModel', model: classifier.getModel() });
      }
      
      if (enhancedClassifier && typeof enhancedClassifier.getEnhancedModel === 'function' && useEnhancedML) {
        enhancedClassifier.learn(finalTransaction, categoryName);
        await db.settings.put({ key: 'enhancedMLModel', model: enhancedClassifier.getEnhancedModel() });
      }
      
      await db.inbox.delete(currentTx.id);
      
      setSharedExpenseData(null);
      setSelectedCategory('');
      
      const newLength = inboxTransactions.length - 1;
      if (newLength === 0) {
        setCurrentTransactionIndex(0);
      } else if (currentTransactionIndex >= newLength) {
        setCurrentTransactionIndex(newLength - 1);
      }

    } catch (error) {
      console.error('Error processing transaction:', error);
    } finally {
      setProcessingIds(prev => { 
        const newSet = new Set(prev); 
        newSet.delete(currentTx.id); 
        return newSet; 
      });
    }
  };

  const handleDeleteTransaction = async (transactionId) => {
    try {
      await db.inbox.delete(transactionId);
      const newLength = inboxTransactions.length - 1;
      if (newLength === 0) {
        setCurrentTransactionIndex(0);
      } else if (currentTransactionIndex >= newLength) {
        setCurrentTransactionIndex(newLength - 1);
      }
      setSelectedCategory('');
      setSharedExpenseData(null);
    } catch (error) { 
      console.error('Error deleting transaction:', error); 
    }
  };

  const handleSkipTransaction = () => {
    setSelectedCategory('');
    setSharedExpenseData(null);
    
    if (currentTransactionIndex < inboxTransactions.length - 1) {
      setCurrentTransactionIndex(prev => prev + 1);
    } else {
      setCurrentTransactionIndex(0);
    }
  };

  const handleClearInbox = async () => {
    setIsClearing(true);
    try {
      await db.inbox.clear();
      setShowClearConfirmation(false);
    } catch (error) { 
      console.error('Error clearing inbox:', error); 
    } finally { 
      setIsClearing(false); 
    }
  };

  const toggleContactInShare = (contact) => {
    const existingContacts = sharedExpenseData?.sharedWith || [];
    const isSelected = existingContacts.some(c => c.name === contact.name);
    let newSharedWith = isSelected
      ? existingContacts.filter(c => c.name !== contact.name)
      : [...existingContacts, contact];

    if (!isSelected && newSharedWith.length > 3) {
      return;
    }

    if (newSharedWith.length === 0) {
      setSharedExpenseData(null);
      return;
    }

    const splitAmount = Math.abs(currentTx.amount) / (newSharedWith.length + 1);
    setSharedExpenseData({
      splitType: 'equal',
      sharedWith: newSharedWith.map(c => ({...c, amount: splitAmount}))
    });
  };

  const handleAddPerson = async (name) => {
    const trimmedName = name.trim();
    if (!trimmedName || sharedExpenseData?.sharedWith?.some(c => c.name === trimmedName)) {
      setPersonSearch('');
      return;
    }
    
    if (sharedExpenseData?.sharedWith?.length >= 3) {
      setPersonSearch('');
      return;
    }
    
    let contact = allContacts.find(c => c.name.toLowerCase() === trimmedName.toLowerCase());
    
    if (!contact) {
      const colors = ['#3B82F6', '#8B5CF6', '#EC4899', '#10B981', '#F59E0B', '#EF4444'];
      contact = { 
        name: trimmedName, 
        color: colors[Math.floor(Math.random() * colors.length)],
        createdAt: new Date().toISOString()
      };
      
      try {
        await db.contacts.add(contact);
      } catch (error) {
        console.error('Error adding contact:', error);
      }
    }
        
    toggleContactInShare(contact);
    setPersonSearch('');
    setShowPersonSuggestions(false);
  };

  // Excel processing functions - synchronized with Dashboard
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


  const handleFileSelect = useCallback((e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsExcelProcessing(true);
    
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        let transactions = [];
        
        if (file.name.endsWith('.csv') || file.name.endsWith('.txt')) {
          // Handle CSV/TXT files - use Dashboard CSV parsing logic
          const text = e.target.result;
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
                  // Parse German date format DD.MM.YYYY
                  const dateParts = wertstellungsdatum.split('.');
                  let parsedDate = wertstellungsdatum;
                  if (dateParts.length === 3) {
                    parsedDate = `${dateParts[2]}-${dateParts[1].padStart(2, '0')}-${dateParts[0].padStart(2, '0')}`;
                  }
                  
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
        } else {
          // Handle Excel files
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
          
          if (jsonData.length === 0) {
            alert('Die Excel-Datei ist leer.');
            setIsExcelProcessing(false);
            return;
          }

          transactions = parseExcelTransactions(jsonData);
        }
        
        // Add transactions to inbox
        if (transactions.length > 0) {
          await db.inbox.bulkAdd(transactions);
          console.log(`${transactions.length} Transaktionen wurden erfolgreich hochgeladen`);
          alert(`✅ ${transactions.length} Transaktionen erfolgreich hochgeladen und im Posteingang verfügbar!`);
          
          setIsExcelProcessing(false);
        } else {
          alert('❌ Keine Transaktionen gefunden. Für Excel: Verwenden Sie ING-Bank Format. Für CSV: Format "Datum;Beschreibung;Betrag".');
          setIsExcelProcessing(false);
        }
        
      } catch (error) {
        console.error('Error processing file:', error);
        alert('Fehler beim Verarbeiten der Datei.');
        setIsExcelProcessing(false);
      }
    };

    // Read CSV/TXT as text, Excel as ArrayBuffer
    if (file.name.endsWith('.csv') || file.name.endsWith('.txt')) {
      reader.readAsText(file, 'UTF-8');
    } else {
      reader.readAsArrayBuffer(file);
    }
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const triggerFileUpload = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };
  
  const isActionable = selectedCategory.trim() !== '';

  useEffect(() => {
    setSharedExpenseData(null);
    setPersonSearch('');
    setSelectedCategory('');
  }, [currentTransactionIndex, currentTx?.id]);

  if (!isClient || !allInboxTransactions) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: jonyColors.background }}>
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p style={{ color: jonyColors.textSecondary }}>Lade Transaktionen...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen font-sans" style={{ backgroundColor: jonyColors.background, color: jonyColors.textPrimary }}>
      {/* Header */}
      <div className="px-6 py-8 mb-8">
        <div className="max-w-7xl mx-auto">
          <div className="relative flex items-center">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: jonyColors.accent1 }}></div>
              <h1 className="text-3xl font-bold tracking-tight" style={{ color: jonyColors.textPrimary, letterSpacing: '-0.02em' }}>
                Posteingang
              </h1>
            </div>
            
            {inboxTransactions.length > 0 && currentTx && (
              <>
                <div className="absolute left-1/2 transform -translate-x-1/2 flex items-center space-x-3">
                  <div className="w-[360px] h-2 rounded-full overflow-hidden" style={{ backgroundColor: jonyColors.cardBorder }}>
                    <div
                      className="h-full transition-all duration-700 ease-out rounded-full"
                      style={{ 
                        backgroundColor: jonyColors.accent1,
                        width: `${((currentTransactionIndex + 1) / inboxTransactions.length) * 100}%`
                      }}
                    />
                  </div>
                  <span className="text-sm font-medium whitespace-nowrap" style={{ color: jonyColors.textSecondary }}>
                    {currentTransactionIndex + 1} / {inboxTransactions.length}
                  </span>
                </div>
                
                <div className="ml-auto flex items-center space-x-3">
                  <button
                    onClick={triggerFileUpload}
                    disabled={isExcelProcessing}
                    className="px-4 py-2.5 rounded-xl transition-all duration-200 font-semibold shadow-sm hover:shadow-md text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                      backgroundColor: jonyColors.accent1Alpha,
                      color: jonyColors.accent1,
                      border: `1px solid ${jonyColors.accent1}33`
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.backgroundColor = jonyColors.accent1 + '22';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.backgroundColor = jonyColors.accent1Alpha;
                    }}
                  >
                    {isExcelProcessing ? (
                      <div className="relative w-4 h-4 inline mr-2">
                        <div className="absolute inset-0 rounded-full border border-transparent animate-spin" style={{ borderTopColor: jonyColors.accent1, borderRightColor: jonyColors.accent1 }}></div>
                      </div>
                    ) : (
                      <Upload className="w-4 h-4 inline mr-2" />
                    )}
                    {isExcelProcessing ? 'Verarbeitung...' : 'Datei Upload'}
                  </button>
                  <button
                    onClick={() => setShowClearConfirmation(true)}
                    className="px-4 py-2.5 rounded-xl transition-all duration-200 font-semibold shadow-sm hover:shadow-md text-sm"
                    style={{
                      backgroundColor: jonyColors.redAlpha,
                      color: jonyColors.red,
                      border: `1px solid ${jonyColors.red}33`
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.backgroundColor = jonyColors.red + '22';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.backgroundColor = jonyColors.redAlpha;
                    }}
                  >
                    <Trash2 className="w-4 h-4 inline mr-2" />
                    Alle löschen
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="px-6 mb-12">
        <div className="max-w-7xl mx-auto">
        
        {inboxTransactions.length === 0 || !currentTx ? (
          <div className="flex items-center justify-center" style={{ minHeight: '500px' }}>
            <div className="text-center p-12 rounded-3xl border-2 max-w-md" style={{
              backgroundColor: jonyColors.surface,
              border: `2px solid ${jonyColors.border}`
            }}>
              <div className="w-24 h-24 rounded-3xl mx-auto mb-8 flex items-center justify-center shadow-xl" style={{
                backgroundColor: jonyColors.accent1
              }}>
                <CheckCircle className="w-12 h-12" style={{ color: jonyColors.background }} />
              </div>
              <h2 className="text-3xl font-black mb-4" style={{ color: jonyColors.textPrimary }}>
                Perfekt organisiert!
              </h2>
              <p className="text-lg leading-relaxed mb-6" style={{ color: jonyColors.textSecondary }}>
                Alle Transaktionen wurden erfolgreich kategorisiert. Dein Posteingang ist leer!
              </p>
              <button
                onClick={triggerFileUpload}
                disabled={isExcelProcessing}
                className="inline-flex items-center space-x-2 px-6 py-3 rounded-xl transition-all duration-200 font-bold shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  backgroundColor: jonyColors.accent1,
                  color: jonyColors.background
                }}
              >
                {isExcelProcessing ? (
                  <div className="relative w-5 h-5">
                    <div className="absolute inset-0 rounded-full border border-transparent animate-spin" style={{ borderTopColor: jonyColors.background, borderRightColor: jonyColors.background }}></div>
                  </div>
                ) : (
                  <Upload className="w-5 h-5" />
                )}
                <span>{isExcelProcessing ? 'Verarbeitung...' : 'Datei hochladen'}</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
            <div className="lg:col-span-2">
              <div className="p-6 rounded-2xl border flex flex-col" style={{ 
                height: '580px',
                backgroundColor: jonyColors.surface,
                border: `1px solid ${jonyColors.border}`
              }}>
                
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2 px-3 py-2 rounded-lg border" style={{
                      backgroundColor: jonyColors.cardBackground,
                      border: `1px solid ${jonyColors.cardBorder}`
                    }}>
                      <Calendar className="w-4 h-4" style={{ color: jonyColors.textSecondary }} />
                      <span className="text-sm" style={{ color: jonyColors.textPrimary }}>
                        {new Date(currentTx.date).toLocaleDateString('de-DE', { 
                          day: '2-digit', month: 'short', year: 'numeric' 
                        })}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2 px-3 py-2 rounded-lg border" style={{
                      backgroundColor: jonyColors.cardBackground,
                      border: `1px solid ${jonyColors.cardBorder}`
                    }}>
                      <CreditCard className="w-4 h-4" style={{ color: jonyColors.textSecondary }} />
                      <span className="text-sm" style={{ color: jonyColors.textPrimary }}>
                        {currentTx.account || 'Import'}
                      </span>
                    </div>
                  </div>
                  <button 
                    onClick={() => handleDeleteTransaction(currentTx.id)}
                    className="p-3 rounded-xl transition-all duration-300 shadow-sm hover:shadow-lg group"
                    style={{
                      backgroundColor: jonyColors.cardBackground,
                      color: jonyColors.textSecondary,
                      border: `1px solid ${jonyColors.cardBorder}`
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.backgroundColor = jonyColors.redAlpha;
                      e.target.style.color = jonyColors.red;
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.backgroundColor = jonyColors.cardBackground;
                      e.target.style.color = jonyColors.textSecondary;
                    }}
                    title="Transaktion löschen"
                  >
                    <Trash2 className="w-5 h-5 group-hover:scale-110 transition-transform" />
                  </button>
                </div>

                <div className="text-center flex-1 flex flex-col justify-center py-8">
                  <div className="text-7xl font-black tracking-tight mb-4" style={{
                    color: currentTx.amount > 0 ? jonyColors.accent1 : jonyColors.magenta
                  }}>
                    {formatCurrency(Math.abs(currentTx.amount))}
                  </div>
                  <h3 className="text-lg font-black mb-2" style={{ color: jonyColors.textPrimary }}>
                    {currentTx.recipient || 'Unbekannter Empfänger'}
                  </h3>
                  <p className="leading-relaxed text-sm max-w-md mx-auto" style={{ color: jonyColors.textSecondary }}>
                    {currentTx.description || 'Keine Beschreibung verfügbar'}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-4 mt-auto" style={{ borderTop: `1px solid ${jonyColors.border}` }}>
                  <button 
                    onClick={() => setCurrentTransactionIndex(prev => prev - 1)} 
                    disabled={currentTransactionIndex === 0}
                    className="flex items-center space-x-2 px-5 py-3 rounded-2xl border transition-all duration-200 shadow-sm hover:shadow-md font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                      backgroundColor: jonyColors.cardBackground,
                      color: jonyColors.textPrimary,
                      border: `1px solid ${jonyColors.cardBorder}`
                    }}
                    onMouseEnter={(e) => {
                      if (currentTransactionIndex !== 0) {
                        e.target.style.backgroundColor = jonyColors.surface;
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.backgroundColor = jonyColors.cardBackground;
                    }}
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Zurück</span>
                  </button>
                  
                  {isActionable ? (
                    <button
                      onClick={handleProcessTransaction}
                      className="flex items-center space-x-2 px-6 py-3 rounded-2xl transition-all duration-200 font-bold shadow-lg hover:shadow-xl text-sm"
                      style={{
                        backgroundColor: jonyColors.accent1,
                        color: jonyColors.background
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.backgroundColor = jonyColors.greenDark;
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.backgroundColor = jonyColors.accent1;
                      }}
                    >
                      <span>Verarbeiten</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  ) : (
                    <button 
                      onClick={handleSkipTransaction}
                      className="flex items-center space-x-2 px-5 py-3 rounded-2xl transition-all duration-200 shadow-sm hover:shadow-md font-bold text-sm"
                      style={{
                        backgroundColor: jonyColors.cardBackground,
                        color: jonyColors.textPrimary,
                        border: `1px solid ${jonyColors.cardBorder}`
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.backgroundColor = jonyColors.surface;
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.backgroundColor = jonyColors.cardBackground;
                      }}
                    >
                      <span>Überspringen</span>
                      <SkipForward className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-6">
              <div className="p-4 rounded-2xl border flex flex-col" style={{ 
                height: '280px',
                backgroundColor: jonyColors.surface,
                border: `1px solid ${jonyColors.border}`
              }}>
                <div className="flex items-center space-x-2 mb-4 flex-shrink-0">
                  <Tag className="w-4 h-4" style={{ color: jonyColors.textSecondary }} />
                  <h4 className="text-sm font-semibold" style={{ color: jonyColors.textPrimary }}>Kategorie</h4>
                </div>
                
                <div className="flex-1 flex flex-col min-h-0">
                  <div className="flex-shrink-0">
                    <AutocompleteCategorySelector
                      key={currentTx.id} 
                      categories={categories || []}
                      suggestions={getMLSuggestions(currentTx).map(s => s.name)}
                      defaultValue={selectedCategory || currentTx.category || ''}
                      onSelect={(categoryName) => setSelectedCategory(categoryName)}
                      onCreateCategory={(categoryName) => setSelectedCategory(categoryName)} 
                    />
                  </div>
                  
                  {getMLSuggestions(currentTx).length > 0 && (
                    <div className="mt-4 flex-1 min-h-0 overflow-y-auto">
                      <div className="space-y-1">
                        {getMLSuggestions(currentTx).map((suggestion, idx) => (
                          <button 
                            key={idx}
                            onClick={() => setSelectedCategory(suggestion.name)}
                            className="w-full group flex items-center justify-between p-2 rounded-lg transition-all duration-200"
                            style={{
                              backgroundColor: selectedCategory === suggestion.name ? jonyColors.accent1Alpha : 'transparent',
                              color: selectedCategory === suggestion.name ? jonyColors.accent1 : jonyColors.textSecondary
                            }}
                            onMouseEnter={(e) => {
                              if (selectedCategory !== suggestion.name) {
                                e.target.style.backgroundColor = jonyColors.cardBackground;
                                e.target.style.color = jonyColors.textPrimary;
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (selectedCategory !== suggestion.name) {
                                e.target.style.backgroundColor = 'transparent';
                                e.target.style.color = jonyColors.textSecondary;
                              }
                            }}
                          >
                            <span className="text-sm text-left">{suggestion.name}</span>
                            <span className="text-xs" style={{ color: jonyColors.textTertiary }}>
                              {Math.round(suggestion.confidence * 100)}%
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="p-6 rounded-2xl border flex flex-col" style={{ 
                height: '280px',
                backgroundColor: jonyColors.surface,
                border: `1px solid ${jonyColors.border}`
              }}>
                {currentTx.amount < 0 ? (
                  <>
                    <div className="flex items-center space-x-3 mb-4 flex-shrink-0">
                      <Users className="w-5 h-5" style={{ color: jonyColors.textSecondary }} />
                      <h3 className="text-lg font-bold" style={{ color: jonyColors.textPrimary }}>Teilen</h3>
                    </div>
                    
                    <div className="flex-1 flex flex-col">
                      <div className="mb-4">
                        <div className="relative">
                          <input 
                            type="text" 
                            value={personSearch} 
                            onChange={(e) => setPersonSearch(e.target.value)} 
                            onFocus={() => setShowPersonSuggestions(true)} 
                            onBlur={() => setTimeout(() => setShowPersonSuggestions(false), 150)} 
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                if (personSearch.trim()) {
                                  handleAddPerson(personSearch.trim());
                                }
                              }
                            }}
                            placeholder="Person hinzufügen..." 
                            className="w-full px-4 py-3 text-base border rounded-lg focus:outline-none focus:ring-2 transition-colors duration-200"
                            style={{
                              backgroundColor: jonyColors.cardBackground,
                              color: jonyColors.textPrimary,
                              borderColor: jonyColors.cardBorder,
                              focusRingColor: jonyColors.accent1
                            }} 
                          />
                          {showPersonSuggestions && personSearch && (
                            <div className="absolute z-30 w-full mt-1 rounded-xl shadow-xl overflow-hidden max-h-60 overflow-y-auto" style={{
                              backgroundColor: jonyColors.surface,
                              border: `1px solid ${jonyColors.border}`
                            }}>
                              {frequentContacts.filter(p => 
                                p.name.toLowerCase().includes(personSearch.toLowerCase()) && 
                                !sharedExpenseData?.sharedWith?.some(s => s.name === p.name)
                              ).slice(0, 5).map(person => (
                                <button 
                                  key={person.name} 
                                  onClick={() => {
                                    toggleContactInShare(person);
                                    setPersonSearch('');
                                  }} 
                                  className="w-full text-left px-3 py-2 text-sm flex items-center space-x-3 transition-colors duration-200"
                                  style={{ color: jonyColors.textPrimary }}
                                  onMouseEnter={(e) => {
                                    e.target.style.backgroundColor = jonyColors.cardBackground;
                                  }}
                                  onMouseLeave={(e) => {
                                    e.target.style.backgroundColor = 'transparent';
                                  }}
                                >
                                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold text-white" style={{backgroundColor: person.color}}>
                                    {person.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                                  </div>
                                  <span>{person.name}</span>
                                </button>
                              ))}
                              {personSearch && !allContacts.some(c => c.name.toLowerCase() === personSearch.toLowerCase()) && (
                                <div style={{ borderTop: `1px solid ${jonyColors.border}` }}>
                                  <button 
                                    onClick={() => {
                                      handleAddPerson(personSearch.trim());
                                      setPersonSearch('');
                                    }} 
                                    className="w-full text-left px-3 py-2 text-sm flex items-center space-x-2 transition-colors duration-200"
                                    style={{ color: jonyColors.accent1 }}
                                    onMouseEnter={(e) => {
                                      e.target.style.backgroundColor = jonyColors.accent1Alpha;
                                    }}
                                    onMouseLeave={(e) => {
                                      e.target.style.backgroundColor = 'transparent';
                                    }}
                                  >
                                    <Plus className="w-4 h-4" />
                                    <span>Person "{personSearch}" erstellen</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {sharedExpenseData && sharedExpenseData.sharedWith.length > 0 ? (
                        <div className="flex-1">
                          <div className="text-xs font-medium mb-3 uppercase tracking-wide" style={{ color: jonyColors.textSecondary }}>
                            Geteilt mit {sharedExpenseData.sharedWith.length} Person{sharedExpenseData.sharedWith.length > 1 ? 'en' : ''}
                          </div>
                          <div className="space-y-2 mb-4">
                            {sharedExpenseData.sharedWith.map(person => (
                              <div 
                                key={person.name} 
                                className="flex items-center justify-between p-3 rounded-lg"
                                style={{ backgroundColor: jonyColors.cardBackground }}
                              >
                                <div className="flex items-center space-x-3">
                                  <div 
                                    className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold text-white"
                                    style={{backgroundColor: person.color}}
                                  >
                                    {person.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                                  </div>
                                  <div>
                                    <span className="text-sm font-medium" style={{ color: jonyColors.textPrimary }}>{person.name}</span>
                                    <div className="text-xs" style={{ color: jonyColors.textSecondary }}>{formatCurrency(person.amount)}</div>
                                  </div>
                                </div>
                                <button 
                                  onClick={() => toggleContactInShare(person)} 
                                  className="p-1 rounded transition-colors"
                                  style={{ color: jonyColors.textSecondary }}
                                  onMouseEnter={(e) => {
                                    e.target.style.color = jonyColors.red;
                                  }}
                                  onMouseLeave={(e) => {
                                    e.target.style.color = jonyColors.textSecondary;
                                  }}
                                  title="Person entfernen"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            ))}
                          </div>
                          <div className="mt-auto pt-3" style={{ borderTop: `1px solid ${jonyColors.border}` }}>
                            <div className="flex items-center justify-between text-sm">
                              <span style={{ color: jonyColors.textSecondary }}>Dein Anteil:</span>
                              <span className="font-semibold" style={{ color: jonyColors.textPrimary }}>
                                {formatCurrency(Math.abs(currentTx.amount) / (sharedExpenseData.sharedWith.length + 1))}
                              </span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex-1 flex flex-col justify-center">
                          <div className="text-center mb-4">
                            <p style={{ color: jonyColors.textSecondary }}>Häufige Kontakte:</p>
                          </div>
                          <div className="space-y-2">
                            {frequentContacts.slice(0, 4).map((person) => (
                              <button 
                                key={person.name} 
                                onClick={() => toggleContactInShare(person)} 
                                className="w-full flex items-center space-x-3 p-2 rounded-lg transition-all duration-200"
                                style={{ color: jonyColors.textSecondary }}
                                onMouseEnter={(e) => {
                                  e.target.style.backgroundColor = jonyColors.cardBackground;
                                  e.target.style.color = jonyColors.textPrimary;
                                }}
                                onMouseLeave={(e) => {
                                  e.target.style.backgroundColor = 'transparent';
                                  e.target.style.color = jonyColors.textSecondary;
                                }}
                              >
                                <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold text-white" style={{backgroundColor: person.color}}>
                                  {person.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                                </div>
                                <span className="text-sm">{person.name}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-center h-full" style={{ color: jonyColors.textSecondary }}>
                    <div className="text-center p-6">
                      <div className="w-10 h-10 rounded-2xl mx-auto mb-3 flex items-center justify-center" style={{
                        backgroundColor: jonyColors.cardBackground
                      }}>
                        <Users className="w-5 h-5 opacity-50" />
                      </div>
                      <p className="text-sm font-bold">Nur bei Ausgaben verfügbar</p>
                      <p className="text-xs mt-1" style={{ color: jonyColors.textTertiary }}>Diese Transaktion ist eine Einnahme</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        </div>
      </div>

      {showClearConfirmation && (
        <div className="fixed inset-0 backdrop-blur-lg flex items-center justify-center z-50 p-4" style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}>
          <div className="rounded-3xl shadow-2xl w-full max-w-md border" style={{
            backgroundColor: jonyColors.surface,
            border: `1px solid ${jonyColors.border}`
          }}>
            <div className="p-8">
              <div className="flex items-center space-x-4 mb-6">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg" style={{
                  backgroundColor: jonyColors.red
                }}>
                  <AlertCircle className="w-8 h-8" style={{ color: jonyColors.background }} />
                </div>
                <div>
                  <h3 className="text-xl font-bold" style={{ color: jonyColors.textPrimary }}>Alle löschen?</h3>
                  <p style={{ color: jonyColors.textSecondary }}>Unwiderrufliche Aktion</p>
                </div>
              </div>
              <div className="p-6 rounded-2xl mb-6 border" style={{
                backgroundColor: jonyColors.redAlpha,
                border: `1px solid ${jonyColors.red}33`
              }}>
                <p className="font-medium" style={{ color: jonyColors.textPrimary }}>
                  Alle <span className="font-bold" style={{ color: jonyColors.red }}>{inboxTransactions.length} Transaktionen</span> werden permanent gelöscht.
                </p>
              </div>
              <div className="flex space-x-4">
                <button 
                  onClick={() => setShowClearConfirmation(false)}
                  className="flex-1 py-4 px-6 rounded-2xl transition-all duration-200 font-semibold shadow-sm hover:shadow-md"
                  style={{
                    backgroundColor: jonyColors.cardBackground,
                    color: jonyColors.textSecondary,
                    border: `1px solid ${jonyColors.cardBorder}`
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.backgroundColor = jonyColors.surface;
                    e.target.style.color = jonyColors.textPrimary;
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.backgroundColor = jonyColors.cardBackground;
                    e.target.style.color = jonyColors.textSecondary;
                  }}
                >
                  Abbrechen
                </button>
                <button 
                  onClick={handleClearInbox}
                  disabled={isClearing}
                  className="flex-1 py-4 px-6 rounded-2xl transition-all duration-200 flex items-center justify-center space-x-3 font-bold shadow-lg hover:shadow-2xl"
                  style={{
                    backgroundColor: jonyColors.red,
                    color: jonyColors.background,
                    opacity: isClearing ? 0.7 : 1
                  }}
                  onMouseEnter={(e) => {
                    if (!isClearing) {
                      e.target.style.backgroundColor = jonyColors.magenta;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isClearing) {
                      e.target.style.backgroundColor = jonyColors.red;
                    }
                  }}
                >
                  {isClearing ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Lösche...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-5 h-5" />
                      <span>Löschen</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hidden file input for Excel upload */}
      <input 
        ref={fileInputRef}
        type="file" 
        accept=".xlsx,.xls,.csv,.txt" 
        onChange={handleFileSelect}
        className="hidden" 
      />
    </div>
  );
};

export default InboxPage;