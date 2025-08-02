/**
 * Exemplo prático de uso das funções de busca de cor Wplace
 *
 * Este arquivo mostra como usar as funções implementadas no TemplateManager
 * para encontrar a cor Wplace mais próxima de qualquer cor dada.
 */

// ============================================
// EXEMPLO DE USO DAS FUNÇÕES
// ============================================

console.log('🎨 Demonstração das Funções de Busca de Cor Wplace\n');

// Simulando que temos acesso ao templateManager
// (Em uso real, seria: const templateManager = new TemplateManager(...))

// ============================================
// 1. BUSCAR COR MAIS PRÓXIMA POR RGB
// ============================================

/**
 * Exemplo: Encontrar a cor Wplace mais próxima de RGB(255, 128, 64)
 */
function exemploRGB() {
  console.log('📋 1. Busca por valores RGB separados:');

  // Cores de exemplo
  const coresExemplo = [
    { r: 255, g: 0, b: 0, nome: 'Vermelho puro' },
    { r: 255, g: 128, b: 64, nome: 'Laranja' },
    { r: 64, g: 128, b: 255, nome: 'Azul claro' },
    { r: 34, g: 139, b: 34, nome: 'Verde floresta' },
  ];

  coresExemplo.forEach((cor) => {
    console.log(
      `\n🎯 Buscando cor mais próxima para ${cor.nome}: RGB(${cor.r}, ${cor.g}, ${cor.b})`
    );
    console.log(
      `   Uso: templateManager.findClosestWplaceColor(${cor.r}, ${cor.g}, ${cor.b})`
    );
    console.log(
      `   Resultado esperado: Objeto com {name, rgb, rgbValues, hex}`
    );
  });
}

// ============================================
// 2. CONVERSÃO DE STRING RGB
// ============================================

function exemploStringRGB() {
  console.log('\n📋 2. Conversão de strings RGB:');

  const stringsRGB = [
    'rgb(255, 0, 0)',
    'rgb(255, 128, 64)',
    'rgb(64, 128, 255)',
    'rgb(128, 255, 64)',
  ];

  stringsRGB.forEach((rgbString) => {
    console.log(`\n🎯 Convertendo: ${rgbString}`);
    console.log(`   Uso: templateManager.convertToWplaceColor("${rgbString}")`);
    console.log(
      `   Resultado esperado: {original, wplaceColor, wplaceName, wplaceHex, distance, isExactMatch}`
    );
  });
}

// ============================================
// 3. BUSCA POR COR HEXADECIMAL
// ============================================

function exemploHex() {
  console.log('\n📋 3. Busca por cores hexadecimais:');

  const coresHex = [
    '#FF0000', // Vermelho
    '#FF8040', // Laranja
    '#4080FF', // Azul claro
    '#228B22', // Verde floresta
    '#800080', // Roxo
  ];

  coresHex.forEach((hex) => {
    console.log(`\n🎯 Buscando cor para: ${hex}`);
    console.log(
      `   Uso: templateManager.findClosestWplaceColorFromHex("${hex}")`
    );
    console.log(`   Resultado esperado: Objeto da cor Wplace mais próxima`);
  });
}

// ============================================
// 4. INFORMAÇÕES DETALHADAS DE CORRESPONDÊNCIA
// ============================================

function exemploInformacoesDetalhadas() {
  console.log('\n📋 4. Obter informações detalhadas:');

  const cor = { r: 255, g: 128, b: 64 };

  console.log(`\n🎯 Análise detalhada para RGB(${cor.r}, ${cor.g}, ${cor.b}):`);
  console.log(
    `   Uso: templateManager.getColorMatchInfo(${cor.r}, ${cor.g}, ${cor.b})`
  );
  console.log(`   Resultado esperado:`);
  console.log(`   {`);
  console.log(`     inputColor: { r: ${cor.r}, g: ${cor.g}, b: ${cor.b} },`);
  console.log(`     inputRgb: "rgb(${cor.r}, ${cor.g}, ${cor.b})",`);
  console.log(`     inputHex: "#ff8040",`);
  console.log(`     closestColor: { name: "Orange", rgb: "rgb(...)", ... },`);
  console.log(`     distance: 15.23,`);
  console.log(`     isExactMatch: false,`);
  console.log(`     isCloseMatch: true,`);
  console.log(`     matchQuality: "Muito próxima"`);
  console.log(`   }`);
}

// ============================================
// 5. CÓDIGO COMPLETO DE EXEMPLO
// ============================================

function codigoCompletoExemplo() {
  console.log('\n📋 5. Código completo de exemplo:');

  console.log(`
// ============================================
// EXEMPLO COMPLETO DE USO REAL
// ============================================

// Assumindo que você tem acesso ao templateManager
const templateManager = // ... sua instância do TemplateManager

// 1. Buscar cor mais próxima por RGB
const corMaisProxima = templateManager.findClosestWplaceColor(255, 128, 64);
console.log('Cor encontrada:', corMaisProxima.name); // Ex: "Orange"
console.log('RGB Wplace:', corMaisProxima.rgb);       // Ex: "rgb(255, 128, 0)"
console.log('Hex Wplace:', corMaisProxima.hex);       // Ex: "#FF8000"

// 2. Converter string RGB
const conversao = templateManager.convertToWplaceColor('rgb(255, 128, 64)');
if (conversao) {
  console.log('Original:', conversao.original);      // "rgb(255, 128, 64)"
  console.log('Wplace:', conversao.wplaceColor);     // "rgb(255, 128, 0)"
  console.log('Nome:', conversao.wplaceName);        // "Orange"
  console.log('É exata?', conversao.isExactMatch);   // false
}

// 3. Buscar por hexadecimal
const corHex = templateManager.findClosestWplaceColorFromHex('#FF8040');
console.log('Cor por hex:', corHex.name);

// 4. Informações detalhadas
const info = templateManager.getColorMatchInfo(255, 128, 64);
console.log('Qualidade da correspondência:', info.matchQuality);
console.log('Distância:', info.distance);

// 5. Verificar cache (melhor performance)
const cor1 = templateManager.findClosestWplaceColor(255, 0, 0); // Primeira busca
const cor2 = templateManager.findClosestWplaceColor(255, 0, 0); // Usa cache (mais rápido)

// ============================================
// USO EM TEMPLATES (EXEMPLO PRÁTICO)
// ============================================

// Converter todas as cores de um template para cores Wplace
function converterCoresTemplate(templateImageData) {
  const data = templateImageData.data;
  
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const alpha = data[i + 3];
    
    // Pular pixels transparentes
    if (alpha === 0) continue;
    
    // Encontrar cor Wplace mais próxima
    const wplaceColor = templateManager.findClosestWplaceColor(r, g, b);
    
    // Aplicar a cor Wplace
    data[i] = wplaceColor.rgbValues[0];     // R
    data[i + 1] = wplaceColor.rgbValues[1]; // G
    data[i + 2] = wplaceColor.rgbValues[2]; // B
    // Alpha permanece o mesmo
  }
  
  return templateImageData;
}
`);
}

// ============================================
// EXECUTAR EXEMPLOS
// ============================================

exemploRGB();
exemploStringRGB();
exemploHex();
exemploInformacoesDetalhadas();
codigoCompletoExemplo();

console.log('\n✨ Funções implementadas com sucesso no TemplateManager!');
console.log(
  '📚 Use este arquivo como referência para implementar as funcionalidades.'
);
console.log(
  '🎯 As funções estão prontas para uso em templates e conversão de cores.\n'
);
