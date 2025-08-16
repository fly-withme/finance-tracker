import React, { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Users, DollarSign, Send, Download, UserPlus, MessageCircle, Calculator } from 'lucide-react';
import Card from './ui/Card';
import PageHeader from './ui/PageHeader';
import { db } from '../utils/db';

const formatCurrency = (amount) => amount.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });

const SharedExpensesPage = () => {
  const transactions = useLiveQuery(() => db.transactions.toArray(), []) || [];
  const contacts = useLiveQuery(() => db.contacts.toArray(), []) || [];
  
  const [selectedContact, setSelectedContact] = useState(null);

  // Berechnung der geteilten Ausgaben pro Person
  const expensesByPerson = useMemo(() => {
    const personData = {};
    
    transactions.forEach(tx => {
      if (tx.sharedWith && tx.sharedWith.length > 0 && tx.amount < 0) {
        tx.sharedWith.forEach(person => {
          if (!personData[person.name]) {
            personData[person.name] = {
              name: person.name,
              color: person.color || '#64748B',
              totalShared: 0,
              yourShare: 0,
              theirDebt: 0,
              transactions: []
            };
          }
          
          const personShare = person.amount || 0;
          const yourPaidAmount = Math.abs(tx.amount);
          
          personData[person.name].totalShared += yourPaidAmount;
          personData[person.name].yourShare += personShare;
          personData[person.name].theirDebt += (yourPaidAmount - personShare);
          personData[person.name].transactions.push({
            ...tx,
            yourPaid: yourPaidAmount,
            theirShare: personShare,
            theirOwes: yourPaidAmount - personShare
          });
        });
      }
    });
    
    return Object.values(personData).sort((a, b) => b.theirDebt - a.theirDebt);
  }, [transactions]);

  const totalOwed = expensesByPerson.reduce((sum, person) => sum + person.theirDebt, 0);

  const handleSettleDebt = async (personName, amount) => {
    // Hier könntest du eine Settlement-Transaktion erstellen
    console.log(`Schuld von ${personName} über ${formatCurrency(amount)} als beglichen markieren`);
  };

  const generateWhatsAppMessage = (person) => {
    const message = `Hey ${person.name}! 👋\n\nHier ist unsere Abrechnung:\n\n` +
      person.transactions.map(tx => 
        `📅 ${new Date(tx.date).toLocaleDateString('de-DE')}\n` +
        `💰 ${tx.recipient}: ${formatCurrency(tx.theirShare)}\n`
      ).join('\n') +
      `\n💸 Gesamt: ${formatCurrency(person.theirDebt)}\n\n` +
      `Kannst du mir das überweisen? 😊`;
    
    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/?text=${encodedMessage}`, '_blank');
  };

  const PersonDetailModal = ({ person, onClose }) => {
    if (!person) return null;
    
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
          <div className="p-6 border-b border-slate-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div 
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                  style={{ backgroundColor: person.color }}
                >
                  {person.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-800">{person.name}</h2>
                  <p className="text-sm text-slate-500">Geteilte Ausgaben Details</p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="text-slate-400 hover:text-slate-600 text-2xl"
              >
                ×
              </button>
            </div>
          </div>
          
          <div className="p-6 max-h-96 overflow-y-auto">
            <div className="space-y-3">
              {person.transactions.map((tx, index) => (
                <div key={index} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                  <div>
                    <div className="font-medium text-slate-800">{tx.recipient}</div>
                    <div className="text-sm text-slate-500">
                      {new Date(tx.date).toLocaleDateString('de-DE')} • {tx.category}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-slate-800">
                      {formatCurrency(tx.theirShare)}
                    </div>
                    <div className="text-xs text-slate-500">
                      von {formatCurrency(tx.yourPaid)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          <div className="p-6 bg-slate-50 border-t border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <span className="text-lg font-semibold text-slate-800">Gesamtschuld:</span>
              <span className="text-2xl font-bold text-indigo-600">
                {formatCurrency(person.theirDebt)}
              </span>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => generateWhatsAppMessage(person)}
                className="btn flex-1 flex items-center justify-center gap-2 bg-green-500 text-white hover:bg-green-600 transition-colors"
              >
                <MessageCircle className="w-5 h-5" />
                WhatsApp senden
              </button>
              <button
                onClick={() => handleSettleDebt(person.name, person.theirDebt)}
                className="btn flex-1 flex items-center justify-center gap-2 bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
              >
                <Calculator className="w-5 h-5" />
                Als bezahlt markieren
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-8 bg-slate-50 min-h-screen">
      <PageHeader title={
        <div className="flex items-center gap-3">
          <Users className="w-8 h-8 text-indigo-600" />
          <div>
            <h1 className="text-4xl font-extrabold text-slate-800 tracking-tight">
              Geteilte Ausgaben
            </h1>
            <p className="text-slate-500 mt-1">Wer schuldet dir wie viel?</p>
          </div>
        </div>
      } />

      {/* Summary Cards */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-100 rounded-lg">
              <DollarSign className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-slate-500">Dir wird geschuldet</h3>
              <p className="text-2xl font-bold text-slate-800">{formatCurrency(totalOwed)}</p>
            </div>
          </div>
        </Card>
        
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-100 rounded-lg">
              <Users className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-slate-500">Aktive Schuldner</h3>
              <p className="text-2xl font-bold text-slate-800">
                {expensesByPerson.filter(p => p.theirDebt > 0).length}
              </p>
            </div>
          </div>
        </Card>
        
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-100 rounded-lg">
              <Calculator className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-slate-500">Geteilte Transaktionen</h3>
              <p className="text-2xl font-bold text-slate-800">
                {transactions.filter(tx => tx.sharedWith && tx.sharedWith.length > 0).length}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Personen Übersicht */}
      <Card className="mt-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-slate-800">Schulden pro Person</h2>
          {expensesByPerson.length === 0 && (
            <span className="text-sm text-slate-500">Noch keine geteilten Ausgaben</span>
          )}
        </div>

        {expensesByPerson.length > 0 ? (
          <div className="space-y-4">
            {expensesByPerson.map((person, index) => (
              <div 
                key={person.name}
                className="group p-4 bg-gradient-to-r from-white to-slate-50 border border-slate-200 rounded-xl hover:shadow-lg hover:scale-[1.01] transition-all duration-300 cursor-pointer"
                onClick={() => setSelectedContact(person)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div 
                      className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg"
                      style={{ backgroundColor: person.color }}
                    >
                      {person.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-800 text-lg">{person.name}</h3>
                      <p className="text-sm text-slate-500">
                        {person.transactions.length} geteilte Ausgabe{person.transactions.length !== 1 ? 'n' : ''}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-2xl font-bold text-slate-800">
                        {formatCurrency(person.theirDebt)}
                      </div>
                      <div className="text-sm text-slate-500">
                        von {formatCurrency(person.totalShared)} gesamt
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          generateWhatsAppMessage(person);
                        }}
                        className="btn-icon bg-green-100 text-green-600 hover:bg-green-200 transition-colors"
                        title="WhatsApp senden"
                      >
                        <MessageCircle className="w-5 h-5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSettleDebt(person.name, person.theirDebt);
                        }}
                        className="btn-icon bg-indigo-100 text-indigo-600 hover:bg-indigo-200 transition-colors"
                        title="Als bezahlt markieren"
                      >
                        <Calculator className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
                
                {/* Progress Bar für Schuldenanteil */}
                <div className="mt-4">
                  <div className="flex justify-between text-xs text-slate-500 mb-1">
                    <span>Ihr Anteil</span>
                    <span>{Math.round((person.theirDebt / person.totalShared) * 100)}% ausstehend</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2">
                    <div 
                      className="h-2 rounded-full transition-all duration-300"
                      style={{ 
                        width: `${(person.theirDebt / person.totalShared) * 100}%`,
                        backgroundColor: person.color
                      }}
                    ></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="p-4 bg-slate-100 rounded-full w-20 h-20 mx-auto mb-4 flex items-center justify-center">
              <Users className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-800 mb-2">Noch keine geteilten Ausgaben</h3>
            <p className="text-slate-500 mb-4">
              Füge bei Transaktionen Personen hinzu, um geteilte Ausgaben zu tracken
            </p>
          </div>
        )}
      </Card>

      {/* Detail Modal */}
      {selectedContact && (
        <PersonDetailModal 
          person={selectedContact} 
          onClose={() => setSelectedContact(null)} 
        />
      )}
    </div>
  );
};

export default SharedExpensesPage;