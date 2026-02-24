const fs = require('fs');

try {
  const modelPath = './assets/currency.tflite';
  const buffer = fs.readFileSync(modelPath);
  
  console.log('File size:', buffer.length, 'bytes');
  
  // Check first 100 bytes to identify file type
  const first100Bytes = buffer.slice(0, 100);
  console.log('First 100 bytes (hex):', first100Bytes.toString('hex').substring(0, 200));
  console.log('First 100 bytes (ascii):', first100Bytes.toString('ascii'));
  
  // Check for common file signatures
  if (buffer[0] === 0x1F && buffer[1] === 0x8B) {
    console.log('📦 File is GZIP compressed');
  } else if (buffer.toString('utf8', 0, 2) === 'PK') {
    console.log('📦 File is a ZIP archive');
  } else if (buffer[0] === 0xFF && buffer[1] === 0xD8) {
    console.log('🖼️ File is a JPEG image');
  } else if (buffer.toString('utf8', 0, 4) === '%PDF') {
    console.log('📄 File is a PDF');
  } else if (buffer[0] === 0x89 && buffer.toString('utf8', 1, 4) === 'PNG') {
    console.log('🖼️ File is a PNG image');
  } else if (buffer.toString('utf8', 0, 4) === 'TFL3') {
    console.log('✅ File is a valid TFLite model');
  } else {
    console.log('❓ Unknown file type');
  }
  
} catch (error) {
  console.error('Error:', error);
}