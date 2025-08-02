/**
 * Teste das funções de busca de cor mais próxima do Wplace
 * Este arquivo demonstra como usar as funções implementadas
 */

// Simulação da classe TemplateManager para teste
import wplaceColors from './src/wplace_colors.json' assert { type: 'json' };

class ColorFinder {
  constructor() {
    this.wplaceColors = wplaceColors.colors || wplaceColors;
    this.colorCache = new Map();
    console.log(
      `🎨 Carregadas ${this.wplaceColors.length} cores do Wplace para correspondência`
    );
  }

  /** Busca a cor Wplace mais próxima para uma determinada cor RGB */
  findClosestWplaceColor(r, g, b) {
    const colorKey = `rgb(${r},${g},${b})`;

    if (this.colorCache.has(colorKey)) {
      return this.colorCache.get(colorKey);
    }

    let closestColor = this.wplaceColors[0];
    let minDistance = Infinity;

    for (const color of this.wplaceColors) {
      const dr = r - color.rgbValues[0];
      const dg = g - color.rgbValues[1];
      const db = b - color.rgbValues[2];
      const distance = Math.sqrt(dr * dr + dg * dg + db * db);

      if (distance < minDistance) {
        minDistance = distance;
        closestColor = color;
      }

      if (distance === 0) break;
    }

    this.colorCache.set(colorKey, closestColor);
    return closestColor;
  }

  /** Converte cor RGB para Wplace mais próxima com informações detalhadas */
  convertToWplaceColor(rgbString) {
    const match = rgbString.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (!match) return null;

    const r = parseInt(match[1]);
    const g = parseInt(match[2]);
    const b = parseInt(match[3]);

    const closestColor = this.findClosestWplaceColor(r, g, b);

    return {
      original: rgbString,
      wplaceColor: closestColor.rgb,
      wplaceName: closestColor.name,
      wplaceHex: closestColor.hex,
      distance: this.calculateColorDistance(r, g, b, closestColor.rgbValues),
      isExactMatch:
        this.calculateColorDistance(r, g, b, closestColor.rgbValues) < 1,
    };
  }

  /** Calcula distância Euclidiana entre duas cores */
  calculateColorDistance(r1, g1, b1, rgb2) {
    const dr = r1 - rgb2[0];
    const dg = g1 - rgb2[1];
    const db = b1 - rgb2[2];
    return Math.sqrt(dr * dr + dg * dg + db * db);
  }

  /** Busca cor por hex */
  findClosestWplaceColorFromHex(hexColor) {
    hexColor = hexColor.replace('#', '');

    if (hexColor.length === 3) {
      hexColor = hexColor
        .split('')
        .map((char) => char + char)
        .join('');
    }

    if (hexColor.length !== 6) return null;

    const r = parseInt(hexColor.slice(0, 2), 16);
    const g = parseInt(hexColor.slice(2, 4), 16);
    const b = parseInt(hexColor.slice(4, 6), 16);

    return this.findClosestWplaceColor(r, g, b);
  }

  /** Obtém informações detalhadas da correspondência */
  getColorMatchInfo(r, g, b) {
    const closestColor = this.findClosestWplaceColor(r, g, b);
    const distance = this.calculateColorDistance(
      r,
      g,
      b,
      closestColor.rgbValues
    );

    return {
      inputColor: { r, g, b },
      inputRgb: `rgb(${r}, ${g}, ${b})`,
      inputHex: `#${r.toString(16).padStart(2, '0')}${g
        .toString(16)
        .padStart(2, '0')}${b.toString(16).padStart(2, '0')}`,
      closestColor: closestColor,
      distance: distance,
      isExactMatch: distance < 1,
      isCloseMatch: distance < 10,
      matchQuality:
        distance < 1
          ? 'Exata'
          : distance < 10
          ? 'Muito próxima'
          : distance < 30
          ? 'Próxima'
          : 'Distante',
    };
  }

  /** Demonstra o uso das funções */
  runTests() {
    console.log('\n🧪 === TESTE DAS FUNÇÕES DE BUSCA DE COR ===\n');

    // Teste 1: Cores básicas
    console.log('📋 Teste 1: Cores básicas');
    const basicColors = [
      [255, 0, 0], // Vermelho puro
      [0, 255, 0], // Verde puro
      [0, 0, 255], // Azul puro
      [255, 255, 255], // Branco
      [0, 0, 0], // Preto
      [128, 128, 128], // Cinza
    ];

    basicColors.forEach(([r, g, b]) => {
      const result = this.getColorMatchInfo(r, g, b);
      console.log(
        `🎯 ${result.inputRgb} → ${result.closestColor.name} (${result.closestColor.rgb})`
      );
      console.log(
        `   Distância: ${result.distance.toFixed(2)} | Qualidade: ${
          result.matchQuality
        }`
      );
    });

    // Teste 2: Cores em string RGB
    console.log('\n📋 Teste 2: Conversão de strings RGB');
    const rgbStrings = [
      'rgb(255, 128, 64)',
      'rgb(64, 128, 255)',
      'rgb(128, 255, 64)',
    ];

    rgbStrings.forEach((rgbString) => {
      const result = this.convertToWplaceColor(rgbString);
      if (result) {
        console.log(
          `🎯 ${result.original} → ${result.wplaceName} (${result.wplaceColor})`
        );
        console.log(
          `   Hex: ${result.wplaceHex} | Exata: ${
            result.isExactMatch ? '✅' : '❌'
          }`
        );
      }
    });

    // Teste 3: Cores em hex
    console.log('\n📋 Teste 3: Conversão de cores hexadecimais');
    const hexColors = ['#FF0000', '#00FF00', '#0000FF', '#FFA500', '#800080'];

    hexColors.forEach((hex) => {
      const result = this.findClosestWplaceColorFromHex(hex);
      if (result) {
        console.log(`🎯 ${hex} → ${result.name} (${result.rgb})`);
      }
    });

    // Teste 4: Performance com cache
    console.log('\n📋 Teste 4: Performance com cache');
    const testColor = [123, 45, 67];

    console.time('Primeira busca (sem cache)');
    this.findClosestWplaceColor(...testColor);
    console.timeEnd('Primeira busca (sem cache)');

    console.time('Segunda busca (com cache)');
    this.findClosestWplaceColor(...testColor);
    console.timeEnd('Segunda busca (com cache)');

    // Teste 5: Listagem de algumas cores Wplace disponíveis
    console.log('\n📋 Teste 5: Algumas cores Wplace disponíveis');
    console.log('🎨 Primeiras 10 cores da paleta:');
    this.wplaceColors.slice(0, 10).forEach((color, index) => {
      console.log(
        `   ${index + 1}. ${color.name} - ${color.rgb} (${color.hex})`
      );
    });

    console.log(`\n✨ Total de cores disponíveis: ${this.wplaceColors.length}`);
    console.log('✅ Todos os testes concluídos com sucesso!\n');
  }
}

// Executa os testes se o arquivo for executado diretamente
if (import.meta.url === `file://${process.argv[1]}`) {
  const colorFinder = new ColorFinder();
  colorFinder.runTests();
}

export default ColorFinder;
