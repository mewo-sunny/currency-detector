const fs = require('fs');

try {
  const modelPath = './assets/currency.tflite';
  const buffer = fs.readFileSync(modelPath);
  
  console.log('Model file size:', buffer.length, 'bytes');
  
  // Check first 4 bytes for TFLite magic number
  const magicNumber = buffer.readUInt32LE(0).toString(16);
  console.log('First 4 bytes (hex):', magicNumber);
  
  // TFLite magic number should be 0x54464C33 which is 'TFL3' in ASCII
  const header = buffer.toString('utf8', 0, 4);
  console.log('Header string:', header);
  
  if (header === 'TFL3') {
    console.log('✅ Valid TFLite model format');
    
    // Check model version (byte 4)
    const version = buffer.readUInt32LE(4);
    console.log('Model version:', version);
    
    // Check model size from header
    const modelSize = buffer.readUInt32LE(8);
    console.log('Model size from header:', modelSize, 'bytes');
    
  } else {
    console.log('❌ Invalid model format. Expected "TFL3", got:', header);
    
    // If it's not TFLite, what is it?
    if (buffer[0] === 0x1F && buffer[1] === 0x8B) {
      console.log('📦 File appears to be gzipped. Try extracting it first.');
    } else if (buffer.toString('utf8', 0, 2) === 'PK') {
      console.log('📦 File appears to be a ZIP archive.');
    } else if (buffer[0] === 0xFF && buffer[1] === 0xD8) {
      console.log('🖼️ File appears to be a JPEG image.');
    }
  }
  
} catch (error) {
  console.error('Error checking model:', error);
}