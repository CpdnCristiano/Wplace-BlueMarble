// Teste do sistema de matching de cores do Wplace-BlueMarble
const fs = require('fs');

// Carregar cores do Wplace
const wplaceColorsData = JSON.parse(fs.readFileSync('./wplace_colors.json', 'utf8'));
const wplace_colors = wplaceColorsData.colors;

console.log(`📊 Carregado ${wplace_colors.length} cores do Wplace`);
console.log(`📅 Extraído em: ${wplaceColorsData.extractedAt}`);
console.log(`🎨 Total de cores: ${wplaceColorsData.totalColors}\n`);

// Funções de matching de cores (copiadas do templateManager.js)
function calculateColorDistance(rgb1, rgb2) {
  const [r1, g1, b1] = rgb1;
  const [r2, g2, b2] = rgb2;
  return Math.sqrt(Math.pow(r2 - r1, 2) + Math.pow(g2 - g1, 2) + Math.pow(b2 - b1, 2));
}

function findClosestWplaceColor(rgbArray) {
  let closestColor = null;
  let minDistance = Infinity;

  for (const color of wplace_colors) {
    const distance = calculateColorDistance(rgbArray, color.rgbValues);
    if (distance < minDistance) {
      minDistance = distance;
      closestColor = color;
    }
  }

  return { color: closestColor, distance: minDistance };
}

function convertToWplaceColor(rgbString) {
  try {
    // Parse rgb string like "rgb(255, 128, 64)"
    const matches = rgbString.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (!matches) {
      console.warn(`⚠️  Formato RGB inválido: ${rgbString}`);
      return null;
    }

    const rgbArray = [
      parseInt(matches[1]),
      parseInt(matches[2]),
      parseInt(matches[3])
    ];

    const result = findClosestWplaceColor(rgbArray);
    
    return {
      original: rgbString,
      wplaceName: result.color.name,
      wplaceColor: result.color.rgb,
      wplaceHex: result.color.hex,
      distance: result.distance
    };
  } catch (error) {
    console.error(`❌ Erro ao converter cor ${rgbString}:`, error.message);
    return null;
  }
}

// Testes com cores de exemplo
console.log('🧪 TESTANDO SISTEMA DE MATCHING DE CORES\n');

const testColors = [
  'rgb(255, 0, 0)',     // Vermelho puro
  'rgb(0, 255, 0)',     // Verde puro
  'rgb(0, 0, 255)',     // Azul puro
  'rgb(255, 255, 255)', // Branco
  'rgb(0, 0, 0)',       // Preto
  'rgb(128, 128, 128)', // Cinza médio
  'rgb(255, 128, 0)',   // Laranja
  'rgb(128, 0, 128)',   // Roxo
  'rgb(255, 192, 203)', // Rosa claro
  'rgb(165, 42, 42)',   // Marrom avermelhado
  'rgb(50, 50, 50)',    // Cinza escuro
  'rgb(200, 200, 200)'  // Cinza claro
];

testColors.forEach((testColor, index) => {
  const result = convertToWplaceColor(testColor);
  
  if (result) {
    const isExactMatch = result.distance < 1;
    const matchQuality = result.distance < 10 ? '🎯 Excelente' : 
                        result.distance < 30 ? '✅ Boa' : 
                        result.distance < 60 ? '⚠️  Razoável' : '❌ Ruim';
    
    console.log(`${index + 1}. ${testColor}`);
    console.log(`   → ${result.wplaceName} (${result.wplaceColor})`);
    console.log(`   → Distância: ${result.distance.toFixed(1)} - ${matchQuality}`);
    console.log(`   → Hex: ${result.wplaceHex}`);
    if (isExactMatch) {
      console.log(`   → ✨ MATCH EXATO!`);
    }
    console.log('');
  } else {
    console.log(`${index + 1}. ❌ ERRO ao processar: ${testColor}\n`);
  }
});

// Teste de performance
console.log('⚡ TESTE DE PERFORMANCE\n');

const startTime = Date.now();
const iterations = 1000;

for (let i = 0; i < iterations; i++) {
  const randomColor = `rgb(${Math.floor(Math.random() * 256)}, ${Math.floor(Math.random() * 256)}, ${Math.floor(Math.random() * 256)})`;
  convertToWplaceColor(randomColor);
}

const endTime = Date.now();
const totalTime = endTime - startTime;
const avgTime = totalTime / iterations;

console.log(`🕐 ${iterations} conversões de cor em ${totalTime}ms`);
console.log(`📊 Tempo médio por conversão: ${avgTime.toFixed(2)}ms`);
console.log(`🚀 Taxa: ${Math.floor(iterations / (totalTime / 1000))} conversões/segundo\n`);

// Análise da paleta
console.log('🎨 ANÁLISE DA PALETA WPLACE\n');

const colorsByFamily = {};
wplace_colors.forEach(color => {
  const baseName = color.name.replace(/^(Dark|Light|Medium)\s+/, '');
  if (!colorsByFamily[baseName]) {
    colorsByFamily[baseName] = [];
  }
  colorsByFamily[baseName].push(color);
});

console.log('Famílias de cores encontradas:');
Object.entries(colorsByFamily).forEach(([family, colors]) => {
  if (colors.length > 1) {
    console.log(`  ${family}: ${colors.length} variações`);
    colors.forEach(color => {
      console.log(`    - ${color.name} (${color.hex})`);
    });
  }
});

console.log('\n✅ Teste concluído com sucesso!');
