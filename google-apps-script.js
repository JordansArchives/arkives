/**
 * Arkives Finance API — Google Apps Script
 * Deployed as a web app to handle expense/revenue tracking
 * 
 * SETUP: 
 * 1. Open the spreadsheet in Google Sheets
 * 2. Extensions → Apps Script
 * 3. Paste this entire file, replacing any existing code
 * 4. Click Deploy → New Deployment → Web App
 * 5. Execute as: Me, Access: Anyone
 * 6. Copy the URL and paste it into Arkives settings
 */

const SPREADSHEET_ID = '13laAHAH0ZoPvuFEoETVWj-y9AoZM33_goosc7qpPVqI';
const PERSONAL_SHEET = '(P) JOURNAL';
const BUSINESS_SHEET = '(B) JOURNAL';
const NET_INCOME_SHEET = 'NET INCOME';

// Handle GET requests (fetch data)
function doGet(e) {
  try {
    const action = e.parameter.action || 'journal';
    const type = e.parameter.type || 'all';
    const months = parseInt(e.parameter.months) || 3;
    
    let result;
    
    switch (action) {
      case 'journal':
        result = getJournalEntries(type, months);
        break;
      case 'summary':
        result = getSummary();
        break;
      case 'ping':
        result = { status: 'ok', timestamp: new Date().toISOString() };
        break;
      default:
        result = { error: 'Unknown action: ' + action };
    }
    
    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Handle POST requests (add entries)
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action || 'add';
    
    let result;
    
    switch (action) {
      case 'add':
        result = addEntry(data);
        break;
      case 'addMultiple':
        result = addMultipleEntries(data.entries);
        break;
      default:
        result = { error: 'Unknown action: ' + action };
    }
    
    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Add a single journal entry
function addEntry(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheetName = data.type === 'business' ? BUSINESS_SHEET : PERSONAL_SHEET;
  const sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) {
    return { success: false, error: 'Sheet not found: ' + sheetName };
  }
  
  // Format the date as M/D/YYYY
  const date = data.date ? new Date(data.date + 'T12:00:00') : new Date();
  const dateStr = (date.getMonth() + 1) + '/' + date.getDate() + '/' + date.getFullYear();
  
  // Format amount as " $ XX.XX " (matching sheet format)
  const amount = parseFloat(data.amount) || 0;
  let amountStr;
  if (amount < 0) {
    amountStr = ' $ (' + Math.abs(amount).toFixed(2) + ')';
  } else {
    amountStr = ' $ ' + amount.toFixed(2) + ' ';
  }
  
  const category = data.category || 'OTHER EXPENSES';
  const notes = data.notes || '';
  
  // Append row
  sheet.appendRow([dateStr, category, amountStr, notes]);
  
  return {
    success: true,
    entry: {
      date: dateStr,
      category: category,
      amount: amount,
      notes: notes,
      type: data.type || 'personal',
      sheet: sheetName
    }
  };
}

// Add multiple entries at once
function addMultipleEntries(entries) {
  if (!entries || !entries.length) {
    return { success: false, error: 'No entries provided' };
  }
  
  const results = entries.map(entry => addEntry(entry));
  return {
    success: results.every(r => r.success),
    count: results.filter(r => r.success).length,
    results: results
  };
}

// Fetch journal entries
function getJournalEntries(type, months) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const cutoffDate = new Date();
  cutoffDate.setMonth(cutoffDate.getMonth() - months);
  
  const entries = [];
  
  const sheetsToFetch = [];
  if (type === 'all' || type === 'personal') {
    sheetsToFetch.push({ name: PERSONAL_SHEET, type: 'personal' });
  }
  if (type === 'all' || type === 'business') {
    sheetsToFetch.push({ name: BUSINESS_SHEET, type: 'business' });
  }
  
  for (const sheetInfo of sheetsToFetch) {
    const sheet = ss.getSheetByName(sheetInfo.name);
    if (!sheet) continue;
    
    const lastRow = sheet.getLastRow();
    if (lastRow < 4) continue; // No data rows
    
    const data = sheet.getRange(4, 1, lastRow - 3, 4).getValues();
    
    for (const row of data) {
      const dateStr = row[0];
      if (!dateStr) continue;
      
      // Parse date
      let entryDate;
      if (dateStr instanceof Date) {
        entryDate = dateStr;
      } else {
        const parts = String(dateStr).split('/');
        if (parts.length === 3) {
          entryDate = new Date(parseInt(parts[2]), parseInt(parts[0]) - 1, parseInt(parts[1]));
        } else {
          continue;
        }
      }
      
      if (entryDate < cutoffDate) continue;
      
      // Parse amount
      const amountStr = String(row[2]).trim();
      let amount = 0;
      if (amountStr.includes('(')) {
        // Negative: $ (XX.XX)
        const match = amountStr.match(/\(([\d,]+\.?\d*)\)/);
        if (match) amount = -parseFloat(match[1].replace(/,/g, ''));
      } else {
        const match = amountStr.match(/\$\s*([\d,]+\.?\d*)/);
        if (match) amount = parseFloat(match[1].replace(/,/g, ''));
      }
      
      const category = String(row[1] || '').trim();
      const isRevenue = category.includes('REVENUE');
      
      entries.push({
        date: (entryDate.getMonth() + 1) + '/' + entryDate.getDate() + '/' + entryDate.getFullYear(),
        dateISO: entryDate.toISOString().split('T')[0],
        category: category,
        amount: amount,
        notes: String(row[3] || '').trim(),
        type: sheetInfo.type,
        isRevenue: isRevenue
      });
    }
  }
  
  // Sort by date descending (most recent first)
  entries.sort((a, b) => new Date(b.dateISO) - new Date(a.dateISO));
  
  return {
    success: true,
    count: entries.length,
    entries: entries
  };
}

// Get summary data
function getSummary() {
  const journal = getJournalEntries('all', 12);
  const entries = journal.entries;
  
  // Group by month
  const months = {};
  for (const e of entries) {
    const d = new Date(e.dateISO);
    const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    const monthName = d.toLocaleString('en-US', { month: 'long' });
    
    if (!months[key]) {
      months[key] = {
        month: monthName,
        year: d.getFullYear(),
        key: key,
        personalRev: 0, businessRev: 0,
        personalExp: 0, businessExp: 0,
        totalRev: 0, totalExp: 0, totalPL: 0
      };
    }
    
    const m = months[key];
    if (e.isRevenue) {
      if (e.type === 'personal') m.personalRev += e.amount;
      else m.businessRev += e.amount;
      m.totalRev += e.amount;
    } else {
      if (e.type === 'personal') m.personalExp += Math.abs(e.amount);
      else m.businessExp += Math.abs(e.amount);
      m.totalExp += Math.abs(e.amount);
    }
    m.totalPL = m.totalRev - m.totalExp;
  }
  
  // Category breakdown
  const categories = {};
  for (const e of entries) {
    if (e.isRevenue) continue;
    const key = e.type + ':' + e.category;
    if (!categories[key]) {
      categories[key] = { category: e.category, type: e.type, total: 0, count: 0 };
    }
    categories[key].total += Math.abs(e.amount);
    categories[key].count++;
  }
  
  return {
    success: true,
    months: Object.values(months).sort((a, b) => b.key.localeCompare(a.key)),
    categories: Object.values(categories).sort((a, b) => b.total - a.total),
    totalEntries: entries.length
  };
}
