# Sample Bank Statement Format

This document shows examples of transaction formats that the PDF parser can handle:

## Common German Bank Statement Format:
```
Datum       Beschreibung                    Betrag
15.08.2025  SEPA-Lastschrift Netflix       -15,99 EUR
14.08.2025  Gehalt August                   +2500,00 EUR
12.08.2025  Kartenzahlung REWE              -78,45 EUR
10.08.2025  Überweisung Miete               -800,00 EUR
```

## Common English Bank Statement Format:
```
Date        Description                     Amount
2025-08-15  Direct Debit Netflix           -$15.99
2025-08-14  Salary Deposit                 +$2500.00
2025-08-12  Card Payment REWE              -$78.45
2025-08-10  Transfer Rent                  -$800.00
```

## US Bank Format:
```
08/15/2025  Netflix Subscription           -15.99
08/14/2025  Payroll Deposit               +2500.00
08/12/2025  Debit Purchase GROCERY         -78.45
08/10/2025  Online Transfer RENT           -800.00
```

The parser can handle:
- Multiple date formats (DD.MM.YYYY, YYYY-MM-DD, MM/DD/YYYY)
- Various currency symbols (€, $, £, ¥)
- Different decimal separators (, and .)
- Positive/negative amount indicators
- Multi-line transaction descriptions
- Common German and English banking terms

## Testing Instructions:

1. Create a PDF with similar transaction data
2. Upload it using the "Upload Statement" button
3. Review AI predictions and make corrections
4. The system learns from your corrections for future uploads