# Ollama Setup für Zenith Finance

## 🚀 Automatische PDF-Auslesung mit KI

Ollama ermöglicht deutlich bessere und genauere Extraktion von Bankdaten aus PDFs durch lokale KI-Modelle.

### Installation

1. **Ollama herunterladen**
   ```bash
   # macOS
   curl -fsSL https://ollama.ai/install.sh | sh
   
   # Oder manuell von https://ollama.ai
   ```

2. **Modell installieren**
   ```bash
   # Empfohlenes Modell für strukturierte Daten (klein und schnell)
   ollama pull qwen2.5
   
   # Alternative: Llama 3.2 (größer, aber sehr gut)
   ollama pull llama3.2
   
   # Kleines Modell für schwächere Hardware
   ollama pull phi3
   ```

3. **Ollama starten**
   ```bash
   ollama serve
   ```

4. **App neu starten**
   - Starte `npm run dev` neu
   - Die App erkennt automatisch verfügbare Modelle

### Wie es funktioniert

- **Primär**: KI analysiert PDF-Text und extrahiert strukturierte Daten
- **Fallback**: Bei Fehlern wird der regelbasierte Parser verwendet
- **Lokal**: Alle Daten bleiben auf deinem Computer
- **Kostenlos**: Keine API-Kosten

### Vorteile

✅ **Bessere Genauigkeit** - Versteht komplexe PDF-Layouts  
✅ **Merchant-Namen** - Extrahiert saubere Geschäftsnamen  
✅ **Flexible Formate** - Funktioniert mit verschiedenen Banken  
✅ **Datenschutz** - Alles läuft lokal  
✅ **Kostenlos** - Keine API-Gebühren  

### System-Anforderungen

- **RAM**: Mindestens 8GB (16GB empfohlen)
- **Speicher**: 2-4GB für Modelle
- **CPU**: Moderne CPU (Apple Silicon ideal)

### Troubleshooting

**Ollama läuft nicht?**
```bash
# Status prüfen
ollama list

# Neu starten
ollama serve
```

**Modell nicht gefunden?**
```bash
# Verfügbare Modelle anzeigen
ollama list

# Modell neu installieren
ollama pull qwen2.5
```

**Performance-Probleme?**
- Verwende `phi3` für kleinere Hardware
- Stelle sicher, dass genug RAM verfügbar ist
- Schließe andere ressourcenintensive Apps