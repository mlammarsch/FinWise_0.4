// Performance-Test für Bulk-Operationen in FinWise
// Dieses Skript kann in der Browser-Konsole ausgeführt werden

console.log('🚀 FinWise Bulk-Operations Performance Test');

// Test-Daten generieren
function generateTestTransactions(count) {
  const transactions = [];
  for (let i = 0; i < count; i++) {
    transactions.push({
      id: `test-tx-${i}`,
      date: new Date(2024, 0, i + 1).toISOString().split('T')[0],
      valueDate: new Date(2024, 0, i + 1).toISOString().split('T')[0],
      accountId: 'test-account-1',
      amount: Math.random() * 1000 - 500,
      note: `Test Transaction ${i}`,
      description: `Test Transaction ${i}`,
      payee: `Test Payee ${i % 10}`,
      type: Math.random() > 0.5 ? 'EXPENSE' : 'INCOME',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }
  return transactions;
}

function generateTestRecipients(count) {
  const recipients = [];
  for (let i = 0; i < count; i++) {
    recipients.push({
      id: `test-recipient-${i}`,
      name: `Test Recipient ${i}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }
  return recipients;
}

function generateTestTags(count) {
  const tags = [];
  for (let i = 0; i < count; i++) {
    tags.push({
      id: `test-tag-${i}`,
      name: `Test Tag ${i}`,
      parentTagId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }
  return tags;
}

// Performance-Test-Funktion
async function performanceTest() {
  console.log('📊 Starte Performance-Tests...');

  try {
    // Zugriff auf FinWise Stores (falls verfügbar)
    const transactionStore = window.finwiseStores?.transactionStore;
    const recipientStore = window.finwiseStores?.recipientStore;
    const tagStore = window.finwiseStores?.tagStore;

    if (!transactionStore) {
      console.warn('⚠️ FinWise Stores nicht verfügbar. Test kann nur in der FinWise-App ausgeführt werden.');
      return;
    }

    // Test 1: Bulk Transaction Import
    console.log('🔄 Test 1: Bulk Transaction Import (100 Transaktionen)');
    const testTransactions = generateTestTransactions(100);

    const startTime1 = performance.now();
    await transactionStore.addMultipleTransactions(testTransactions, true); // fromSync = true
    const endTime1 = performance.now();

    console.log(`✅ Bulk Transaction Import: ${(endTime1 - startTime1).toFixed(2)}ms für 100 Transaktionen`);
    console.log(`📈 Durchschnitt: ${((endTime1 - startTime1) / 100).toFixed(2)}ms pro Transaktion`);

    // Test 2: Bulk Recipient Import
    console.log('🔄 Test 2: Bulk Recipient Import (50 Empfänger)');
    const testRecipients = generateTestRecipients(50);

    const startTime2 = performance.now();
    await recipientStore.addMultipleRecipients(testRecipients, true); // fromSync = true
    const endTime2 = performance.now();

    console.log(`✅ Bulk Recipient Import: ${(endTime2 - startTime2).toFixed(2)}ms für 50 Empfänger`);
    console.log(`📈 Durchschnitt: ${((endTime2 - startTime2) / 50).toFixed(2)}ms pro Empfänger`);

    // Test 3: Bulk Tag Import
    console.log('🔄 Test 3: Bulk Tag Import (30 Tags)');
    const testTags = generateTestTags(30);

    const startTime3 = performance.now();
    await tagStore.addMultipleTags(testTags, true); // fromSync = true
    const endTime3 = performance.now();

    console.log(`✅ Bulk Tag Import: ${(endTime3 - startTime3).toFixed(2)}ms für 30 Tags`);
    console.log(`📈 Durchschnitt: ${((endTime3 - startTime3) / 30).toFixed(2)}ms pro Tag`);

    // Gesamtstatistik
    const totalTime = (endTime1 - startTime1) + (endTime2 - startTime2) + (endTime3 - startTime3);
    const totalItems = 100 + 50 + 30;

    console.log('📊 Gesamtstatistik:');
    console.log(`⏱️ Gesamtzeit: ${totalTime.toFixed(2)}ms`);
    console.log(`📦 Gesamte Elemente: ${totalItems}`);
    console.log(`⚡ Durchschnitt: ${(totalTime / totalItems).toFixed(2)}ms pro Element`);

    // IndexedDB-Statistiken (falls verfügbar)
    if (window.finwiseDebug?.indexedDB) {
      console.log('💾 IndexedDB-Status:', await window.finwiseDebug.indexedDB.state());
    }

  } catch (error) {
    console.error('❌ Fehler beim Performance-Test:', error);
  }
}

// Validierungstest
async function validationTest() {
  console.log('🔍 Starte Validierungstests...');

  try {
    const tenantDbService = window.finwiseServices?.tenantDbService;

    if (!tenantDbService) {
      console.warn('⚠️ TenantDbService nicht verfügbar.');
      return;
    }

    // Test: Bulk vs. Einzeloperationen Konsistenz
    console.log('🔄 Teste Konsistenz zwischen Bulk- und Einzeloperationen...');

    const testData = [
      { id: 'validation-1', name: 'Validation Test 1', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: 'validation-2', name: 'Validation Test 2', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
    ];

    // Bulk-Operation
    await tenantDbService.addRecipientsBatch(testData);

    // Verifikation
    const recipient1 = await tenantDbService.getRecipientById('validation-1');
    const recipient2 = await tenantDbService.getRecipientById('validation-2');

    if (recipient1 && recipient2) {
      console.log('✅ Bulk-Operation erfolgreich - Daten korrekt gespeichert');
      console.log('📋 Recipient 1:', recipient1.name);
      console.log('📋 Recipient 2:', recipient2.name);
    } else {
      console.error('❌ Validierung fehlgeschlagen - Daten nicht gefunden');
    }

  } catch (error) {
    console.error('❌ Fehler beim Validierungstest:', error);
  }
}

// Haupttest-Funktion
async function runTests() {
  console.log('🎯 FinWise Bulk-Operations Test Suite');
  console.log('=====================================');

  await performanceTest();
  console.log('');
  await validationTest();

  console.log('');
  console.log('✨ Tests abgeschlossen!');
  console.log('💡 Tipp: Überprüfe die Browser-Entwicklertools für detaillierte IndexedDB-Informationen');
}

// Test automatisch starten, wenn im Browser ausgeführt
if (typeof window !== 'undefined') {
  console.log('🌐 Browser-Umgebung erkannt - Tests können mit runTests() gestartet werden');
  console.log('📝 Verwendung: runTests()');

  // Globale Funktion verfügbar machen
  window.runFinWiseBulkTests = runTests;
} else {
  console.log('📦 Node.js-Umgebung erkannt - Tests nicht verfügbar');
}
