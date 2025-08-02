# 🔄 Análise: O que acontece quando você clica em "Enable"

## 📋 Fluxo Completo do Botão Enable

### 1. **Validação de Coordenadas**

Quando você clica em "Enable", primeiro o sistema valida as coordenadas:

```javascript
// Validação dos campos de coordenadas
const coordTlX = document.querySelector('#bm-input-tx'); // Top-left X
const coordTlY = document.querySelector('#bm-input-ty'); // Top-left Y
const coordPxX = document.querySelector('#bm-input-px'); // Pixel X
const coordPxY = document.querySelector('#bm-input-py'); // Pixel Y

// Verifica se cada campo é válido
if (!coordTlX.checkValidity()) {
  coordTlX.reportValidity();
  instance.handleDisplayError('Coordinates are malformed!');
  return;
}
```

### 2. **Validação do Arquivo**

Verifica se um template foi carregado:

```javascript
const input = document.querySelector('#bm-input-file-template');
if (!input?.files[0]) {
  instance.handleDisplayError(`No file selected!`);
  return;
}
```

### 3. **Preparação dos Dados**

Converte as coordenadas e salva no cache:

```javascript
const coords = [
  Number(coordTlX.value),
  Number(coordTlY.value),
  Number(coordPxX.value),
  Number(coordPxY.value),
];

// Salva no localStorage para próxima sessão
saveLastCoordinates(coords);
saveLastTemplate(input.files[0], input.files[0]?.name.replace(/\.[^/.]+$/, ''));
```

### 4. **Criação do Template** ⭐

Chama o método principal que cria o template:

```javascript
templateManager.createTemplate(
  input.files[0], // Arquivo da imagem
  input.files[0]?.name.replace(/\.[^/.]+$/, ''), // Nome sem extensão
  coords // Coordenadas [tlX, tlY, pxX, pxY]
);
```

---

## 🎨 O que acontece dentro de `createTemplate()`

### 1. **Inicialização**

```javascript
// Cria JSON se não existir
if (!this.templatesJSON) {
  this.templatesJSON = await this.createJSON();
}

// Mostra status
this.overlay.handleDisplayStatus(
  `Creating template at ${coords.join(', ')}...`
);
```

### 2. **Criação da Instância Template**

```javascript
const template = new Template({
  displayName: name,
  sortID: 0,
  authorID: numberToEncoded(this.userID || 0, this.encodingBase),
  file: blob, // Arquivo da imagem
  coords: coords, // Coordenadas
});
```

### 3. **Divisão em Tiles** 🔥

**PONTO CHAVE:** O template é dividido em "tiles" (pedaços de 1000x1000 pixels):

```javascript
template.chunked = await template.createTemplateTiles(this.tileSize);
```

Esta função (`createTemplateTiles`) no arquivo `Template.js`:

- Divide a imagem em pedaços de 1000x1000 pixels
- Cada tile é identificado por coordenadas como "1231,0047,183,593"
- Converte cada pedaço em ImageBitmap
- Armazena em `template.chunked` como objeto com chaves sendo as coordenadas

### 4. **Armazenamento**

```javascript
// Adiciona ao JSON de templates
this.templatesJSON.templates[`${template.sortID} ${template.authorID}`] = {
  name: template.displayName,
  enabled: true,
  tiles: template.chunked, // Tiles divididos
};

// Adiciona ao array de templates ativos
this.templatesArray = [];
this.templatesArray.push(template);
```

### 5. **Inicialização de Estatísticas**

```javascript
await this.initializeTemplateStats(template);

// Mostra container de estatísticas
const statsContainer = document.getElementById('bm-contain-stats');
if (statsContainer) {
  statsContainer.style.display = 'block';
  this.displayTemplateStats(this.templateStats);
}
```

---

## 🖼️ Como o Overlay é Desenhado

### **Sistema de Interceptação** 🕵️

O Blue Marble **não cria um canvas próprio**. Em vez disso, ele **intercepta** as imagens que o Wplace.live baixa!

#### 1. **Interceptação de Fetch**

No `main.js`, há código injetado que substitui o `window.fetch`:

```javascript
// Substitui o fetch original
window.fetch = async function (...args) {
  const response = await originalFetch.apply(this, args);
  const cloned = response.clone();

  // Se for uma imagem...
  if (contentType.includes('image/') && !endpointName.includes('openfreemap')) {
    // Intercepta e processa
    const blob = await cloned.blob();

    // Envia para processamento
    window.postMessage({
      source: 'blue-marble',
      endpoint: endpointName,
      blobID: blobUUID,
      blobData: blob,
    });
  }
};
```

#### 2. **Processamento no ApiManager**

O `apiManager.js` escuta essas mensagens:

```javascript
case 'tiles':
  // Extrai coordenadas do tile
  let tileCoordsTile = data.endpoint.split('/');
  tileCoordsTile = [
    parseInt(tileCoordsTile[tileCoordsTile.length - 2]),
    parseInt(tileCoordsTile[tileCoordsTile.length - 1].replace('.png', ''))
  ];

  // Processa o tile com template
  const templateBlob = await this.templateManager.drawTemplateOnTile(
    blobData,
    tileCoordsTile
  );

  // Retorna a imagem modificada
  window.postMessage({
    source: 'blue-marble',
    blobID: blobUUID,
    blobData: templateBlob,
  });
```

#### 3. **Desenho em `drawTemplateOnTile()`** 🎨

Esta é a função **PRINCIPAL** onde o overlay é desenhado:

```javascript
async drawTemplateOnTile(tileBlob, tileCoords) {
  // Cria canvas temporário
  const canvas = new OffscreenCanvas(drawSize, drawSize);
  const context = canvas.getContext('2d');

  // Desenha a imagem original do Wplace
  context.drawImage(tileBitmap, 0, 0, drawSize, drawSize);

  // Para cada template que corresponde a este tile
  for (const templateBitmap of templateBlobs) {
    // Filtra cores ocultas e converte para Wplace colors
    const filteredTemplate = await this.filterHiddenColorsFromTemplate(
      templateBitmap,
      drawSize
    );

    // AQUI É ONDE O OVERLAY É DESENHADO! 🔥
    context.drawImage(filteredTemplate, 0, 0);
  }

  // Retorna como blob para substituir a imagem original
  return await canvas.convertToBlob({ type: 'image/png' });
}
```

---

## 🔄 **Fluxo Completo de Renderização**

### 📱 **Do Clique ao Overlay Visível:**

1. **Usuário clica "Enable"** → Validações → `createTemplate()`

2. **Template é dividido em tiles** → Cada pedaço fica em `template.chunked`

3. **Wplace.live pede uma imagem** (tile) → `fetch('/api/tiles/1234/5678.png')`

4. **Blue Marble intercepta** → Recebe a imagem original

5. **`drawTemplateOnTile()` é chamado** → Verifica se tem template para esse tile

6. **Se tem template:**

   - Desenha imagem original
   - Desenha template por cima com cores Wplace
   - Aplica filtros (ocultar cores)
   - Retorna imagem modificada

7. **Wplace.live recebe** → Imagem já com overlay aplicado

8. **Usuário vê** → Template sobreposto no canvas

---

## 🎯 **Pontos Importantes**

### ✅ **O que funciona:**

- ✅ Interceptação transparente das imagens
- ✅ Conversão automática para cores Wplace
- ✅ Sistema de cache para performance
- ✅ Divisão inteligente em tiles
- ✅ Filtros de cores ocultas

### 🔧 **Arquitetura Inteligente:**

- **Não modifica DOM** do Wplace.live
- **Intercepta no nível de rede** (fetch)
- **Processa apenas tiles necessários**
- **Reutiliza sistema de tiles** do Wplace
- **Performance otimizada** com cache

### 📊 **Coordenadas:**

- **TlX, TlY:** Tile onde o template começa
- **PxX, PxY:** Pixel exato dentro do tile
- **Divisão:** 1000x1000 pixels por tile
- **Identificação:** "tlX,tlY,pxX,pxY"

---

## 🎨 **Como o Blue Marble Escolhe a Cor do Pixel no Overlay**

### 🔍 **Processo de Seleção de Cor - Passo a Passo**

Quando o Blue Marble intercepta uma imagem e precisa desenhar o overlay, ele segue um processo específico para escolher qual cor usar em cada pixel:

#### 1. **Leitura da Cor Original do Template** 📖

```javascript
// Em filterHiddenColorsFromTemplate()
const imageData = filterContext.getImageData(0, 0, drawSize, drawSize);
const data = imageData.data;

for (let i = 0; i < data.length; i += 4) {
  const r = data[i]; // Vermelho original (0-255)
  const g = data[i + 1]; // Verde original (0-255)
  const b = data[i + 2]; // Azul original (0-255)
  const alpha = data[i + 3]; // Transparência

  // Pula pixels transparentes
  if (alpha === 0) continue;
}
```

#### 2. **Verificação de Cores Ocultas** 🙈

```javascript
const colorKey = `rgb(${r},${g},${b})`;

// Se esta cor foi marcada como "oculta" pelo usuário
if (this.hiddenColors.has(colorKey)) {
  data[i + 3] = 0; // Torna o pixel transparente
  continue;         // Não desenha nada neste pixel
}
```

#### 3. **Conversão para Cor Wplace Mais Próxima** 🎯

**AQUI É O PONTO PRINCIPAL!** O Blue Marble NÃO usa a cor original do template. Em vez disso:

```javascript
// Busca a cor Wplace mais próxima da cor original
const wplaceColor = this.findClosestWplaceColor(r, g, b);

if (wplaceColor) {
  // SUBSTITUI a cor original pela cor Wplace!
  data[i] = wplaceColor.rgbValues[0]; // Novo Vermelho
  data[i + 1] = wplaceColor.rgbValues[1]; // Novo Verde
  data[i + 2] = wplaceColor.rgbValues[2]; // Novo Azul
  // Mantém a transparência original
}
```

### 🧮 **Algoritmo de Busca da Cor Mais Próxima**

#### **Distância Euclidiana no Espaço RGB:**

```javascript
findClosestWplaceColor(r, g, b) {
  let closestColor = this.wplaceColors[0];
  let minDistance = Infinity;

  // Testa todas as 63 cores da paleta Wplace
  for (const color of this.wplaceColors) {
    // Calcula a "distância" entre as cores
    const dr = r - color.rgbValues[0];  // Diferença no vermelho
    const dg = g - color.rgbValues[1];  // Diferença no verde
    const db = b - color.rgbValues[2];  // Diferença no azul

    // Distância Euclidiana: √(dr² + dg² + db²)
    const distance = Math.sqrt(dr * dr + dg * dg + db * db);

    // Se é a menor distância encontrada até agora
    if (distance < minDistance) {
      minDistance = distance;
      closestColor = color;
    }

    // Se encontrou cor exata, para de procurar
    if (distance === 0) break;
  }

  return closestColor;
}
```

### 📊 **Exemplo Prático de Conversão**

#### **Cenário:** Template tem um pixel laranja `rgb(255, 128, 64)`

1. **Leitura:** `r=255, g=128, b=64`

2. **Busca:** Testa contra todas as 63 cores Wplace:

   ```javascript
   // Algumas comparações:

   // Cor "Orange" Wplace: rgb(255, 127, 39)
   distance = √((255-255)² + (128-127)² + (64-39)²)
   distance = √(0 + 1 + 625) = √626 ≈ 25.02

   // Cor "Gold" Wplace: rgb(246, 170, 9)
   distance = √((255-246)² + (128-170)² + (64-9)²)
   distance = √(81 + 1764 + 3025) = √4870 ≈ 69.78

   // Cor "Yellow" Wplace: rgb(249, 221, 59)
   distance = √((255-249)² + (128-221)² + (64-59)²)
   distance = √(36 + 8649 + 25) = √8710 ≈ 93.33
   ```

3. **Resultado:** "Orange" tem menor distância (25.02)

4. **Aplicação:** O pixel `rgb(255, 128, 64)` vira `rgb(255, 127, 39)`

### 🎨 **Tipos de Conversão por Qualidade**

#### **🟢 Cor Exata (distância = 0):**

```javascript
// Template: rgb(255, 127, 39)
// Wplace:   rgb(255, 127, 39) ← "Orange"
// Resultado: Pixel mantém cor original (já é Wplace!)
```

#### **🟡 Cor Muito Próxima (distância < 10):**

```javascript
// Template: rgb(255, 128, 40)
// Wplace:   rgb(255, 127, 39) ← "Orange"
// Resultado: Diferença quase imperceptível
```

#### **🟠 Cor Próxima (distância < 30):**

```javascript
// Template: rgb(255, 128, 64)
// Wplace:   rgb(255, 127, 39) ← "Orange"
// Resultado: Cor similar, ligeiramente diferente
```

#### **🔴 Cor Distante (distância ≥ 30):**

```javascript
// Template: rgb(128, 64, 255) (roxo)
// Wplace:   rgb(107, 80, 246) ← "Indigo"
// Resultado: Mudança mais visível na cor
```

### 💾 **Sistema de Cache para Performance**

Para evitar recalcular a mesma cor várias vezes:

```javascript
// Cache por string RGB
const colorKey = `rgb(${r},${g},${b})`;

// Verifica cache primeiro
if (this.colorCache.has(colorKey)) {
  return this.colorCache.get(colorKey); // Retorna resultado salvo
}

// Se não está no cache, calcula e salva
const closestColor = /* cálculo da distância */;
this.colorCache.set(colorKey, closestColor);
```

### 🎯 **Resultado Visual no Overlay**

#### **O que o usuário vê:**

- ✅ **Template visível** com cores "corrigidas" para Wplace
- ✅ **Cores consistentes** com a paleta disponível
- ✅ **Overlay preciso** na posição correta
- ✅ **Performance otimizada** com cache

#### **O que NÃO acontece:**

- ❌ Cores "estranhas" que não existem no Wplace
- ❌ Recálculo desnecessário da mesma cor
- ❌ Pixels com cores inválidas
- ❌ Lag na renderização

### 🔄 **Fluxo Completo da Escolha de Cor**

```mermaid
Template Pixel (rgb(255,128,64))
    ↓
É transparente? → SIM → Pula pixel
    ↓ NÃO
Está oculto? → SIM → Torna transparente
    ↓ NÃO
Está no cache? → SIM → Usa cor do cache
    ↓ NÃO
Calcula distância para 63 cores Wplace
    ↓
Encontra cor com menor distância
    ↓
Salva no cache
    ↓
Aplica cor Wplace no pixel
    ↓
Resultado: rgb(255,127,39) ← "Orange"
```

**💡 Resumo:** O Blue Marble **sempre converte** as cores do template para as cores oficiais do Wplace, garantindo que o overlay seja visualmente compatível e que todas as cores sejam "pintáveis" no site!

---

## 🎨 **Resultado Final**

Quando você clica "Enable", o Blue Marble:

1. 📥 **Prepara** o template e divide em pedaços
2. 🕵️ **Monitora** todas as requisições de imagem do Wplace
3. 🎨 **Modifica** cada tile que corresponde ao template
4. 🔄 **Substitui** a imagem original pela modificada
5. 👁️ **Usuário vê** o template perfeitamente sobreposto

**É um sistema de "man-in-the-middle" para imagens!** 🔥
