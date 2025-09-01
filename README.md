# Personal Finance App

A modern, privacy-focused personal finance management application built with Next.js and React.

## Features

### 🔒 Security & Privacy
- **Local Data Storage**: All your financial data stays on your device using IndexedDB
- **Password Protection**: Secure your app with a password and reset code system
- **No Cloud Sync**: Complete privacy - no data leaves your device

### 📊 Financial Management
- **Dashboard**: Overview of your financial health with interactive charts
- **Transaction Management**: Import and categorize your banking transactions
- **Budget Planning**: Set and track budgets across different categories
- **Savings Goals**: Track progress toward your financial goals
- **Debt Management**: Monitor and plan debt payoff strategies
- **Expense Sharing**: Track shared expenses with friends and family

### 🎨 User Experience
- **Modern UI**: Clean, responsive design with dark mode support
- **Customizable**: Personalize categories, app name, and user settings
- **German Localization**: Interface in German with Euro currency support
- **PWA Ready**: Install as a Progressive Web App

### 🤖 Smart Features
- **AI-Powered Categorization**: Automatic transaction classification
- **PDF Import**: Upload bank statements and extract transactions
- **Smart Suggestions**: ML-powered category suggestions
- **Subscription Tracking**: Automatic detection of recurring payments

## Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/personal-finance-app.git
cd personal-finance-app
```

2. Install dependencies:
```bash
npm install
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

### First Setup
1. Open the app and set up your password
2. **Important**: Save your reset code securely - you'll need it to recover access
3. Start by adding your first transactions or importing a bank statement

## Deployment

### Vercel (Recommended)
1. Push your code to GitHub
2. Connect your repository to Vercel
3. Deploy with default settings - the app will work out of the box

### Other Platforms
The app is a standard Next.js application and can be deployed to any platform that supports Node.js:
- Netlify
- Railway
- DigitalOcean App Platform
- Your own server

## Data Management

### Backup & Export
- Export all your data as JSON from Settings > Data
- Keep regular backups for data security
- Import/restore functionality coming soon

### Privacy Notes
- All data is stored locally in your browser's IndexedDB
- No analytics or tracking
- No third-party data sharing
- Password is hashed and stored locally

## Tech Stack

- **Frontend**: Next.js 15, React 19, Tailwind CSS
- **Database**: Dexie.js (IndexedDB wrapper)
- **Charts**: Recharts
- **Icons**: Lucide React
- **PDF Processing**: PDF.js
- **Authentication**: Local password-based system

## Contributing

We welcome contributions! Please feel free to submit a Pull Request.

### Development Guidelines
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

### Adding Features
- Keep privacy-first approach
- Maintain German localization
- Follow existing code patterns
- Add appropriate error handling

## License

MIT License - see [LICENSE](LICENSE) file for details

## Support

If you encounter any issues:
1. Check the browser console for errors
2. Try clearing browser data (this will reset the app)
3. Create an issue on GitHub with details

## Roadmap

- [ ] Mobile app (React Native)
- [ ] Multi-currency support
- [ ] Advanced reporting
- [ ] Data import from more banks
- [ ] Enhanced AI categorization
- [ ] Goal automation

---

**Note**: This app stores all data locally. Make sure to backup your data regularly using the export feature.