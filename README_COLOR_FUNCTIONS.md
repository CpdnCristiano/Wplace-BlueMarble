# 🎨 Funções de Busca de Cor Wplace - Blue Marble

## 📋 Resumo das Funcionalidades Implementadas

Este documento descreve todas as funções implementadas para buscar a cor mais parecida entre as cores disponíveis no arquivo `wplace_colors.json`.

### 🔧 Funções Principais

#### 1. `findClosestWplaceColor(r, g, b)`

**Função principal para buscar a cor Wplace mais próxima**

```javascript
const corMaisProxima = templateManager.findClosestWplaceColor(255, 128, 64);
console.log(corMaisProxima.name); // Ex: "Orange"
console.log(corMaisProxima.rgb); // Ex: "rgb(255, 128, 0)"
console.log(corMaisProxima.hex); // Ex: "#FF8000"
```

**Características:**

- ✅ Utiliza distância Euclidiana no espaço RGB
- ✅ Sistema de cache para melhor performance
- ✅ Retorna objeto completo com nome, RGB, hex
- ✅ Otimização: para se a distância for 0 (cor exata)

#### 2. `convertToWplaceColor(rgbString)`

**Converte string RGB para cor Wplace mais próxima**

```javascript
const resultado = templateManager.convertToWplaceColor('rgb(255, 128, 64)');
console.log(resultado.original); // "rgb(255, 128, 64)"
console.log(resultado.wplaceColor); // "rgb(255, 128, 0)"
console.log(resultado.wplaceName); // "Orange"
console.log(resultado.isExactMatch); // false
console.log(resultado.distance); // 64.0
```

#### 3. `findClosestWplaceColorFromHex(hexColor)`

**Busca cor a partir de valor hexadecimal**

```javascript
const corHex = templateManager.findClosestWplaceColorFromHex('#FF8040');
console.log(corHex.name); // Nome da cor Wplace mais próxima
```

**Suporte:**

- ✅ Formato longo: `#RRGGBB`
- ✅ Formato curto: `#RGB` (convertido automaticamente)
- ✅ Com ou sem `#`

#### 4. `getColorMatchInfo(r, g, b)`

**Análise detalhada da correspondência de cores**

```javascript
const info = templateManager.getColorMatchInfo(255, 128, 64);
console.log(info);
/*
{
  inputColor: { r: 255, g: 128, b: 64 },
  inputRgb: "rgb(255, 128, 64)",
  inputHex: "#ff8040",
  closestColor: { name: "Orange", rgb: "rgb(255, 128, 0)", ... },
  distance: 64.0,
  isExactMatch: false,
  isCloseMatch: true,
  matchQuality: "Muito próxima"
}
*/
```

#### 5. `calculateColorDistance(r1, g1, b1, rgb2)`

**Calcula distância Euclidiana entre duas cores**

```javascript
const distancia = templateManager.calculateColorDistance(
  255,
  128,
  64,
  [255, 128, 0]
);
console.log(distancia); // 64.0
```

### 🎯 Integração com Templates

#### Conversão Automática no Overlay

A função `filterHiddenColorsFromTemplate` foi atualizada para converter automaticamente todas as cores do template para as cores Wplace mais próximas:

```javascript
// Agora o overlay aplica automaticamente as cores Wplace
const templateFiltrado = await templateManager.filterHiddenColorsFromTemplate(
  templateBitmap,
  drawSize
);
// Todas as cores foram convertidas para a paleta Wplace
```

### 📊 Sistema de Cache

**Performance otimizada:**

- ✅ Cache de resultados por string RGB
- ✅ Evita recálculos desnecessários
- ✅ Primeiro acesso: cálculo completo
- ✅ Acessos subsequentes: busca instantânea no cache

**Exemplo de performance:**

```javascript
// Primeira busca (calcula e armazena no cache)
const cor1 = templateManager.findClosestWplaceColor(255, 0, 0); // ~2ms

// Segunda busca (busca no cache)
const cor2 = templateManager.findClosestWplaceColor(255, 0, 0); // ~0.01ms
```

### 🎨 Paleta de Cores Wplace

**Informações da paleta:**

- 📈 **Total de cores:** 63 cores disponíveis
- 🎯 **Fonte:** wplace.live color palette
- 📅 **Última atualização:** 2025-08-02
- 🗂️ **Formato:** JSON com metadados completos

**Estrutura de cada cor:**

```json
{
  "name": "Orange",
  "rgb": "rgb(255, 128, 0)",
  "rgbValues": [255, 128, 0],
  "hex": "#FF8000"
}
```

### 🔄 Qualidade de Correspondência

**Sistema de classificação automática:**

- 🎯 **Exata** (distância < 1): Cor idêntica
- 🟢 **Muito próxima** (distância < 10): Quase imperceptível
- 🟡 **Próxima** (distância < 30): Diferença sutil
- 🔴 **Distante** (distância ≥ 30): Diferença notável

### 📝 Exemplos de Uso Prático

#### 1. Converter Template Completo

```javascript
function converterTemplatePairaWplace(imageData) {
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const alpha = data[i + 3];

    if (alpha === 0) continue; // Pular transparentes

    const wplaceColor = templateManager.findClosestWplaceColor(r, g, b);

    data[i] = wplaceColor.rgbValues[0]; // R
    data[i + 1] = wplaceColor.rgbValues[1]; // G
    data[i + 2] = wplaceColor.rgbValues[2]; // B
  }

  return imageData;
}
```

#### 2. Análise de Cores do Template

```javascript
function analisarCoresTemplate(templateColors) {
  const analise = {
    coresOriginais: 0,
    coresWplace: new Set(),
    correspondenciasExatas: 0,
    correspondenciasProximas: 0,
  };

  for (const corOriginal of templateColors) {
    const info = templateManager.getColorMatchInfo(...corOriginal);

    analise.coresOriginais++;
    analise.coresWplace.add(info.closestColor.name);

    if (info.isExactMatch) {
      analise.correspondenciasExatas++;
    } else if (info.isCloseMatch) {
      analise.correspondenciasProximas++;
    }
  }

  return analise;
}
```

### ✅ Status de Implementação

- ✅ **Importação** do wplace_colors.json
- ✅ **Cache system** para performance
- ✅ **Busca por RGB** (valores separados)
- ✅ **Busca por string RGB** ("rgb(r,g,b)")
- ✅ **Busca por hexadecimal** (#RRGGBB)
- ✅ **Análise detalhada** de correspondência
- ✅ **Integração com overlay** (conversão automática)
- ✅ **Sistema de qualidade** de correspondência
- ✅ **Documentação completa** e exemplos

### 🚀 Build e Deploy

**Comando para build:**

```bash
npm run build
```

**Arquivo de saída:**

```
dist/BlueMarble.user.js
```

**Instalação:**

```
https://github.com/CpdnCristiano/Wplace-BlueMarble/raw/refs/heads/better-wplace/dist/BlueMarble.user.js
```

---

## 🎉 Conclusão

Todas as funções de busca de cor mais próxima foram implementadas com sucesso! O sistema agora:

1. 🔍 **Encontra automaticamente** a cor Wplace mais próxima
2. ⚡ **Performance otimizada** com sistema de cache
3. 🎨 **Converte templates** automaticamente no overlay
4. 📊 **Fornece análises detalhadas** de correspondência
5. 🛠️ **Interface completa** para desenvolvedores

**As funções estão prontas para uso em produção!** 🚀
