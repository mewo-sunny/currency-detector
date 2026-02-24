const fs = require('fs');

try {
  // Read labels file
  const labelsPath = './assets/labels.txt';
  const labels = fs.readFileSync(labelsPath, 'utf8');
  
  // Clean up labels (remove \r characters and trim)
  const cleanLabels = labels
    .split('\n')
    .map(l => l.replace('\r', '').trim())
    .filter(l => l.length > 0);
  
  // Write back cleaned labels
  fs.writeFileSync(labelsPath, cleanLabels.join('\n'));
  
  console.log('✅ Labels cleaned up:');
  cleanLabels.forEach((label, i) => console.log(`  ${i}: ${label}`));
  
} catch (error) {
  console.error('Error fixing labels:', error);
}