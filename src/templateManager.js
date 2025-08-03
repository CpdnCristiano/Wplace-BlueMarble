import Template from './Template';
import { numberToEncoded } from './utils';
import wplaceColors from './wplace_colors.json';

/** Manages the template system.
 * This class handles all external requests for modification to a Template.
 * @since 0.55.8
 * @example
 * // JSON structure for a template
 * {
 *   "whoami": "BlueMarble",
 *   "scriptVersion": "1.13.0",
 *   "schemaVersion": "2.1.0",
 *   "templates": {
 *     "0 $Z": {
 *       "name": "My Template",
 *       "enabled": true,
 *       "tiles": {
 *         "1231,0047,183,593": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA",
 *         "1231,0048,183,000": "data:image/png;AAAFCAYAAACNbyblAAAAHElEQVQI12P4"
 *       }
 *     },
 *     "1 $Z": {
 *       "name": "My Template",
 *       "URL": "https://github.com/CpdnCristiano/Wplace-BlueMarble/blob/main/dist/assets/Favicon.png",
 *       "URLType": "template",
 *       "enabled": false,
 *       "tiles": {
 *         "375,1846,276,188": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA",
 *         "376,1846,000,188": "data:image/png;AAAFCAYAAACNbyblAAAAHElEQVQI12P4"
 *       }
 *     }
 *   }
 * }
 */
export default class TemplateManager {
  /** The constructor for the {@link TemplateManager} class.
   * @since 0.55.8
   */
  constructor(name, version, overlay) {
    // Meta
    this.name = name; // Name of userscript
    this.version = version; // Version of userscript
    this.overlay = overlay; // The main instance of the Overlay class
    this.templatesVersion = '1.0.0'; // Version of JSON schema
    this.userID = null; // The ID of the current user
    this.encodingBase =
      "!#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[]^_`abcdefghijklmnopqrstuvwxyz{|}~"; // Characters to use for encoding/decoding
    this.tileSize = 1000; // The number of pixels in a tile. Assumes the tile is square
    this.drawMult = 3; // The enlarged size for each pixel. E.g. when "3", a 1x1 pixel becomes a 1x1 pixel inside a 3x3 area. MUST BE ODD

    // Template
    this.canvasTemplate = null; // Our canvas
    this.canvasTemplateZoomed = null; // The template when zoomed out
    this.canvasTemplateID = 'bm-canvas'; // Our canvas ID
    this.canvasMainID = 'div#map canvas.maplibregl-canvas'; // The selector for the main canvas
    this.template = null; // The template image.
    this.templateState = ''; // The state of the template ('blob', 'proccessing', 'template', etc.)
    this.templatesArray = []; // All Template instnaces currently loaded (Template)
    this.templatesJSON = null; // All templates currently loaded (JSON)

    // Statistics tracking
    this.templateStats = null; // Cache for template statistics
    this.processedTiles = new Set(); // Track processed tiles to avoid double counting
    this.hiddenColors = new Set(); // Track hidden colors
    this.tilePixelCache = new Map(); // Cache for pixel counts per tile
    this.tileColorCache = new Map(); // Cache for color counts per tile

    // Wplace color palette system
    this.wplaceColors = wplaceColors.colors || wplaceColors; // Support both formats
    this.colorCache = new Map(); // Cache for color matching results to improve performance
    console.log(
      `Loaded ${this.wplaceColors.length} Wplace colors for matching`
    );
  }

  /** Busca a cor Wplace mais próxima para uma determinada cor RGB
   * Utiliza a distância Euclidiana no espaço RGB para encontrar a cor mais semelhante
   * @param {number} r - Componente vermelho (0-255)
   * @param {number} g - Componente verde (0-255)
   * @param {number} b - Componente azul (0-255)
   * @returns {Object} O objeto da cor Wplace mais próxima com name, rgb, rgbValues e hex
   * @since 0.71.0
   */
  findClosestWplaceColor(r, g, b) {
    const colorKey = `rgb(${r},${g},${b})`;

    // Verifica o cache primeiro para evitar recálculos
    if (this.colorCache.has(colorKey)) {
      return this.colorCache.get(colorKey);
    }

    let closestColor = this.wplaceColors[0];
    let minDistance = Infinity;

    // Percorre todas as cores Wplace disponíveis
    for (const color of this.wplaceColors) {
      // Calcula a distância Euclidiana no espaço RGB
      const dr = r - color.rgbValues[0];
      const dg = g - color.rgbValues[1];
      const db = b - color.rgbValues[2];
      const distance = Math.sqrt(dr * dr + dg * dg + db * db);

      if (distance < minDistance) {
        minDistance = distance;
        closestColor = color;
      }

      // Se encontrou uma cor exata, não precisa continuar
      if (distance === 0) {
        break;
      }
    }

    // Armazena o resultado no cache
    this.colorCache.set(colorKey, closestColor);
    return closestColor;
  }

  /** Converte qualquer cor RGB para sua equivalente Wplace mais próxima
   * @param {string} rgbString - String RGB como "rgb(255,128,64)"
   * @returns {Object} Objeto com a cor original, correspondência mais próxima e informações da cor
   * @since 0.71.0
   */
  convertToWplaceColor(rgbString) {
    // Extrai valores RGB da string
    const match = rgbString.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (!match) {
      console.warn(`Formato de cor inválido: ${rgbString}`);
      return null;
    }

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

  /** Calcula a distância Euclidiana entre duas cores RGB
   * @param {number} r1 - Componente vermelho da primeira cor
   * @param {number} g1 - Componente verde da primeira cor
   * @param {number} b1 - Componente azul da primeira cor
   * @param {Array} rgb2 - Array com [r, g, b] da segunda cor
   * @returns {number} Distância Euclidiana entre as cores
   * @since 0.71.0
   */
  calculateColorDistance(r1, g1, b1, rgb2) {
    const dr = r1 - rgb2[0];
    const dg = g1 - rgb2[1];
    const db = b1 - rgb2[2];
    return Math.sqrt(dr * dr + dg * dg + db * db);
  }

  /** Busca a cor Wplace mais próxima utilizando valores RGB separados
   * Versão alternativa mais direta da função principal
   * @param {number} red - Valor do vermelho (0-255)
   * @param {number} green - Valor do verde (0-255)
   * @param {number} blue - Valor do azul (0-255)
   * @returns {Object} A cor Wplace mais próxima
   * @since 0.71.0
   */
  getClosestWplaceColor(red, green, blue) {
    return this.findClosestWplaceColor(red, green, blue);
  }

  /** Busca a cor Wplace mais próxima a partir de um valor hexadecimal
   * @param {string} hexColor - Cor em formato hexadecimal (#RRGGBB ou #RGB)
   * @returns {Object} A cor Wplace mais próxima
   * @since 0.71.0
   */
  findClosestWplaceColorFromHex(hexColor) {
    // Remove o # se presente
    hexColor = hexColor.replace('#', '');

    // Converte hex curto (#RGB) para hex longo (#RRGGBB)
    if (hexColor.length === 3) {
      hexColor = hexColor
        .split('')
        .map((char) => char + char)
        .join('');
    }

    if (hexColor.length !== 6) {
      console.warn(`Formato hex inválido: ${hexColor}`);
      return null;
    }

    const r = parseInt(hexColor.slice(0, 2), 16);
    const g = parseInt(hexColor.slice(2, 4), 16);
    const b = parseInt(hexColor.slice(4, 6), 16);

    return this.findClosestWplaceColor(r, g, b);
  }

  /** Obtém informações detalhadas sobre a correspondência de cores
   * @param {number} r - Componente vermelho
   * @param {number} g - Componente verde
   * @param {number} b - Componente azul
   * @returns {Object} Informações detalhadas sobre a correspondência
   * @since 0.71.0
   */
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
      isCloseMatch: distance < 10, // Considera "próximo" se distância < 10
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

  /** Retrieves the pixel art canvas.
   * If the canvas has been updated/replaced, it retrieves the new one.
   * @param {string} selector - The CSS selector to use to find the canvas.
   * @returns {HTMLCanvasElement|null} The canvas as an HTML Canvas Element, or null if the canvas does not exist
   * @since 0.58.3
   * @deprecated Not in use since 0.63.25
   */
  /* @__PURE__ */ getCanvas() {
    // If the stored canvas is "fresh", return the stored canvas
    if (document.body.contains(this.canvasTemplate)) {
      return this.canvasTemplate;
    }
    // Else, the stored canvas is "stale", get the canvas again

    // Attempt to find and destroy the "stale" canvas
    document.getElementById(this.canvasTemplateID)?.remove();

    const canvasMain = document.querySelector(this.canvasMainID);

    const canvasTemplateNew = document.createElement('canvas');
    canvasTemplateNew.id = this.canvasTemplateID;
    canvasTemplateNew.className = 'maplibregl-canvas';
    canvasTemplateNew.style.position = 'absolute';
    canvasTemplateNew.style.top = '0';
    canvasTemplateNew.style.left = '0';
    canvasTemplateNew.style.height = `${
      canvasMain?.clientHeight * (window.devicePixelRatio || 1)
    }px`;
    canvasTemplateNew.style.width = `${
      canvasMain?.clientWidth * (window.devicePixelRatio || 1)
    }px`;
    canvasTemplateNew.height =
      canvasMain?.clientHeight * (window.devicePixelRatio || 1);
    canvasTemplateNew.width =
      canvasMain?.clientWidth * (window.devicePixelRatio || 1);
    canvasTemplateNew.style.zIndex = '8999';
    canvasTemplateNew.style.pointerEvents = 'none';
    canvasMain?.parentElement?.appendChild(canvasTemplateNew); // Append the newCanvas as a child of the parent of the main canvas
    this.canvasTemplate = canvasTemplateNew; // Store the new canvas

    window.addEventListener('move', this.onMove);
    window.addEventListener('zoom', this.onZoom);
    window.addEventListener('resize', this.onResize);

    return this.canvasTemplate; // Return the new canvas
  }

  /** Creates the JSON object to store templates in
   * @returns {{ whoami: string, scriptVersion: string, schemaVersion: string, templates: Object }} The JSON object
   * @since 0.65.4
   */
  async createJSON() {
    return {
      whoami: this.name.replace(' ', ''), // Name of userscript without spaces
      scriptVersion: this.version, // Version of userscript
      schemaVersion: this.templatesVersion, // Version of JSON schema
      templates: {}, // The templates
    };
  }

  /** Creates the template from the inputed file blob
   * @param {File} blob - The file blob to create a template from
   * @param {string} name - The display name of the template
   * @param {Array<number, number, number, number>} coords - The coordinates of the top left corner of the template
   * @since 0.65.77
   */
  async createTemplate(blob, name, coords) {
    // Creates the JSON object if it does not already exist
    if (!this.templatesJSON) {
      this.templatesJSON = await this.createJSON();
      console.log(`Creating JSON...`);
    }

    this.overlay.handleDisplayStatus(
      `Creating template at ${coords.join(', ')}...`
    );

    // Creates a new template instance
    const template = new Template({
      displayName: name,
      sortID: 0, // Object.keys(this.templatesJSON.templates).length || 0, // Uncomment this to enable multiple templates (1/2)
      authorID: numberToEncoded(this.userID || 0, this.encodingBase),
      file: blob,
      coords: coords,
    });
    template.chunked = await template.createTemplateTiles(this.tileSize); // Chunks the tiles

    // Appends a child into the templates object
    // The child's name is the number of templates already in the list (sort order) plus the encoded player ID
    this.templatesJSON.templates[`${template.sortID} ${template.authorID}`] = {
      name: template.displayName, // Display name of template
      enabled: true,
      tiles: template.chunked,
    };

    this.templatesArray = []; // Remove this to enable multiple templates (2/2)
    this.templatesArray.push(template); // Pushes the Template object instance to the Template Array

    this.overlay.handleDisplayStatus(
      `Template created at ${coords.join(', ')}!`
    );

    console.log(Object.keys(this.templatesJSON.templates).length);
    console.log(this.templatesJSON);
    console.log(this.templatesArray);

    // Initialize template statistics
    await this.initializeTemplateStats(template);

    // Show statistics immediately after template creation
    const statsContainer = document.getElementById('bm-contain-stats');
    if (statsContainer) {
      statsContainer.style.display = 'block';
      this.displayTemplateStats(this.templateStats);
    }
  }

  /** Generates a {@link Template} class instance from the JSON object template
   */
  #loadTemplate() {}

  /** Deletes a template from the JSON object.
   * Also delete's the corrosponding {@link Template} class instance
   */
  deleteTemplate() {}

  /** Disables the template from view
   */
  async disableTemplate() {
    // Remove template canvas if it exists
    const templateCanvas = document.getElementById(this.canvasTemplateID);
    if (templateCanvas) {
      templateCanvas.remove();
    }

    // Clear canvas reference
    this.canvasTemplate = null;

    // Clear templates data
    this.templatesArray = [];
    this.templatesJSON = null;
    this.currentStats = null;

    // Clear caches
    this.tilePixelCache.clear();
    this.tileColorCache.clear();
    this.processedTiles.clear();

    // Clear hidden colors
    this.hiddenColors.clear();

    console.log('Template disabled and all data cleared');
  }

  /** Downloads the template with Wplace colors applied (pixel-perfect conversion)
   * @since 0.72.1
   */
  async downloadTemplate() {
    if (!this.templatesArray || this.templatesArray.length === 0) {
      this.overlay.handleDisplayError('Nenhum template carregado para baixar!');
      return;
    }

    try {
      const template = this.templatesArray[0];

      if (!template || !template.file) {
        this.overlay.handleDisplayError('Template não possui arquivo válido!');
        return;
      }

      this.overlay.handleDisplayStatus(
        'Processando template com cores Wplace...'
      );

      // Create bitmap from original template
      const bitmap = await createImageBitmap(template.file);

      // Create canvas for processing with pixel-perfect settings
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const context = canvas.getContext('2d');

      // DISABLE image smoothing to maintain pixelated appearance
      context.imageSmoothingEnabled = false;
      context.imageSmoothingQuality = 'low';

      // Draw original image without smoothing
      context.drawImage(bitmap, 0, 0);

      // Get image data for pixel processing
      const imageData = context.getImageData(0, 0, bitmap.width, bitmap.height);
      const data = imageData.data;

      // Process each pixel to convert to Wplace colors (pixel-by-pixel)
      for (let i = 0; i < data.length; i += 4) {
        const alpha = data[i + 3];

        // Skip transparent pixels
        if (alpha === 0) continue;

        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const colorKey = `rgb(${r},${g},${b})`;

        // Skip hidden colors (make them transparent)
        if (this.hiddenColors.has(colorKey)) {
          data[i + 3] = 0; // Make transparent
          continue;
        }

        // Convert to closest Wplace color (core pixel processing)
        const wplaceColor = this.findClosestWplaceColor(r, g, b);
        if (wplaceColor) {
          data[i] = wplaceColor.rgbValues[0]; // Red
          data[i + 1] = wplaceColor.rgbValues[1]; // Green
          data[i + 2] = wplaceColor.rgbValues[2]; // Blue
          // Keep original alpha
        }
      }

      // Put processed data back with pixel-perfect rendering
      context.putImageData(imageData, 0, 0);

      // Create a larger pixelated version for better visibility
      const pixelScale = 3; // Scale up by 3x to maintain pixel appearance
      const pixelCanvas = new OffscreenCanvas(
        bitmap.width * pixelScale,
        bitmap.height * pixelScale
      );
      const pixelContext = pixelCanvas.getContext('2d');

      // CRITICAL: Disable smoothing for pixelated appearance
      pixelContext.imageSmoothingEnabled = false;
      pixelContext.imageSmoothingQuality = 'low';

      // Draw the processed image scaled up with sharp pixels
      pixelContext.drawImage(
        canvas,
        0,
        0,
        bitmap.width,
        bitmap.height,
        0,
        0,
        bitmap.width * pixelScale,
        bitmap.height * pixelScale
      );

      // Convert to blob with PNG for lossless quality
      const processedBlob = await pixelCanvas.convertToBlob({
        type: 'image/png',
        quality: 1.0, // Maximum quality for PNG
      });

      // Create download
      const url = URL.createObjectURL(processedBlob);
      const downloadLink = document.createElement('a');
      downloadLink.href = url;

      const fileName = template.displayName
        ? `${template.displayName}_wplace_pixelated_3x.png`
        : 'blue_marble_wplace_pixelated_3x.png';

      downloadLink.download = fileName;
      downloadLink.style.display = 'none';

      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);

      URL.revokeObjectURL(url);

      this.overlay.handleDisplayStatus(
        `Template com cores Wplace baixado: ${fileName}`
      );
      console.log(`Wplace colors template downloaded as: ${fileName}`);
    } catch (error) {
      console.error('Erro ao baixar template com cores Wplace:', error);
      this.overlay.handleDisplayError(
        'Erro ao processar template: ' + error.message
      );
    }
  }

  /** Downloads the processed template with Wplace colors applied
   * @since 0.72.1
   * @deprecated Use downloadTemplate() instead - it now processes with Wplace colors by default
   */
  async downloadProcessedTemplate() {
    // Redirect to main download function
    return this.downloadTemplate();
  }

  /** Draws all templates on that tile
   * @param {File} tileBlob - The pixels that are placed on a tile
   * @param {[number, number]} tileCoords - The tile coordinates [x, y]
   * @since 0.65.77
   */
  async drawTemplateOnTile(tileBlob, tileCoords) {
    const drawSize = this.tileSize * this.drawMult; // Draw multiplier

    tileCoords =
      tileCoords[0].toString().padStart(4, '0') +
      ',' +
      tileCoords[1].toString().padStart(4, '0');

    console.log(`Looking for "${tileCoords}"`);

    const templateArray = this.templatesArray; // Stores a copy for sorting

    // Sorts the array of Template class instances. 0 = first = lowest draw priority
    templateArray.sort((a, b) => {
      return a.sortID - b.sortID;
    });

    console.log(templateArray);

    // Retrieves the relavent template tile blobs
    const templateBlobs = templateArray
      .map((template) => {
        const matchingTiles = Object.keys(template.chunked).filter((tile) =>
          tile.startsWith(tileCoords)
        );

        if (matchingTiles.length === 0) {
          return null;
        } // Return nothing when nothing is found

        // Retrieves the blobs of the templates for this tile
        const matchingTileBlobs = matchingTiles.map(
          (tile) => template.chunked[tile]
        );

        return matchingTileBlobs?.[0];
      })
      .filter(Boolean);

    console.log(templateBlobs);

    if (templateBlobs.length > 0) {
      this.overlay.handleDisplayStatus(
        `Displaying ${templateBlobs.length} template${
          templateBlobs.length == 1 ? '' : 's'
        }.`
      );
    }

    const tileBitmap = await createImageBitmap(tileBlob);

    const canvas = new OffscreenCanvas(drawSize, drawSize);
    const context = canvas.getContext('2d');

    context.imageSmoothingEnabled = false; // Nearest neighbor

    // Tells the canvas to ignore anything outside of this area
    context.beginPath();
    context.rect(0, 0, drawSize, drawSize);
    context.clip();

    context.clearRect(0, 0, drawSize, drawSize); // Draws transparent background
    context.drawImage(tileBitmap, 0, 0, drawSize, drawSize);

    // For each template in this tile, draw them and calculate painted pixels.
    for (const templateBitmap of templateBlobs) {
      console.log(`Template Blob is ${typeof templateBitmap}`);
      console.log(templateBitmap);

      // Filter out hidden colors from template before drawing
      const filteredTemplate = await this.filterHiddenColorsFromTemplate(
        templateBitmap,
        drawSize
      );
      context.drawImage(filteredTemplate, 0, 0);

      // Calculate painted pixels for this tile
      await this.calculateTilePaintedPixels(
        tileBitmap,
        templateBitmap,
        drawSize,
        tileCoords
      );
    }

    return await canvas.convertToBlob({ type: 'image/png' });
  }

  /** Filters out hidden colors from a template bitmap and converts colors to Wplace palette
   * @param {ImageBitmap} templateBitmap - The template bitmap to filter
   * @param {number} drawSize - The size of the drawing area
   * @returns {ImageBitmap} The filtered template bitmap with Wplace colors applied
   * @since 0.71.0
   */
  async filterHiddenColorsFromTemplate(templateBitmap, drawSize) {
    // Create temporary canvas to filter the template
    const filterCanvas = new OffscreenCanvas(drawSize, drawSize);
    const filterContext = filterCanvas.getContext('2d');

    // Draw the template onto the filter canvas
    filterContext.drawImage(templateBitmap, 0, 0);

    // Get image data to modify pixels
    const imageData = filterContext.getImageData(0, 0, drawSize, drawSize);
    const data = imageData.data;

    // Process each pixel: hide colors and convert to Wplace colors
    for (let i = 0; i < data.length; i += 4) {
      const alpha = data[i + 3];

      // Skip transparent pixels
      if (alpha === 0) continue;

      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const colorKey = `rgb(${r},${g},${b})`;

      // If this color is hidden, make the pixel transparent
      if (this.hiddenColors.has(colorKey)) {
        data[i + 3] = 0; // Set alpha to 0 (transparent)
        continue;
      }

      // Convert original color to closest Wplace color
      const wplaceColor = this.findClosestWplaceColor(r, g, b);
      if (wplaceColor) {
        data[i] = wplaceColor.rgbValues[0]; // Red
        data[i + 1] = wplaceColor.rgbValues[1]; // Green
        data[i + 2] = wplaceColor.rgbValues[2]; // Blue
        // Keep original alpha
      }
    }

    // Put the modified data back
    filterContext.putImageData(imageData, 0, 0);

    // Return as bitmap
    return await createImageBitmap(filterCanvas);
  }

  /** Calculates painted pixels for a tile
   * @param {ImageBitmap} tileBitmap - The current tile bitmap
   * @param {ImageBitmap} templateBitmap - The template bitmap
   * @param {number} drawSize - The size of the drawing area
   * @param {string} tileCoords - The tile coordinates as string
   * @since 0.67.1
   */
  async calculateTilePaintedPixels(
    tileBitmap,
    templateBitmap,
    drawSize,
    tileCoords
  ) {
    // Check if this tile is already processed and cached
    if (
      this.processedTiles.has(tileCoords) &&
      this.tilePixelCache.has(tileCoords)
    ) {
      console.log(`Using cached data for tile ${tileCoords}`);
      return;
    }

    // Remove old cached data for this tile if recalculating
    if (this.tilePixelCache.has(tileCoords)) {
      const oldPixelCount = this.tilePixelCache.get(tileCoords);
      const oldColorData = this.tileColorCache.get(tileCoords) || new Map();

      // Subtract old counts from global stats
      if (this.templateStats) {
        this.templateStats.paintedPixels -= oldPixelCount;

        // Subtract old color counts
        for (const [color, count] of oldColorData.entries()) {
          const currentCount =
            this.templateStats.paintedByColor.get(color) || 0;
          this.templateStats.paintedByColor.set(
            color,
            Math.max(0, currentCount - count)
          );
        }
      }
    }

    // Create temporary canvases for pixel comparison
    const tempCanvas = new OffscreenCanvas(drawSize, drawSize);
    const tempContext = tempCanvas.getContext('2d');

    const templateCanvas = new OffscreenCanvas(drawSize, drawSize);
    const templateContext = templateCanvas.getContext('2d');

    // Draw current tile and template on temporary canvases
    tempContext.drawImage(tileBitmap, 0, 0, drawSize, drawSize);
    templateContext.drawImage(templateBitmap, 0, 0);

    // Get image data for pixel comparison
    const tileData = tempContext.getImageData(0, 0, drawSize, drawSize);
    const templateData = templateContext.getImageData(0, 0, drawSize, drawSize);

    let paintedCount = 0;
    let totalCount = 0;
    const colorCounts = new Map(); // Track painted pixels by color for this tile

    // Compare pixels and count painted ones
    for (let i = 0; i < templateData.data.length; i += 4) {
      const templateAlpha = templateData.data[i + 3];

      // Skip transparent pixels in template
      if (templateAlpha === 0) continue;

      const templateR = templateData.data[i];
      const templateG = templateData.data[i + 1];
      const templateB = templateData.data[i + 2];
      const templateColor = `rgb(${templateR},${templateG},${templateB})`;

      // Skip hidden colors
      if (this.hiddenColors.has(templateColor)) continue;

      totalCount++;

      const tileR = tileData.data[i];
      const tileG = tileData.data[i + 1];
      const tileB = tileData.data[i + 2];

      // Check if pixel colors match (with small tolerance for compression artifacts)
      // Special handling for black pixels - require exact match or very close
      const isBlackTemplate =
        templateR === 0 && templateG === 0 && templateB === 0;
      const tolerance = isBlackTemplate ? 1 : 5; // Stricter tolerance for black pixels

      const rDiff = Math.abs(templateR - tileR);
      const gDiff = Math.abs(templateG - tileG);
      const bDiff = Math.abs(templateB - tileB);

      // If colors match, count as painted
      if (rDiff <= tolerance && gDiff <= tolerance && bDiff <= tolerance) {
        paintedCount++;

        // Track color count for this tile
        colorCounts.set(
          templateColor,
          (colorCounts.get(templateColor) || 0) + 1
        );
      }
    }

    // Cache the results for this tile
    this.tilePixelCache.set(tileCoords, paintedCount);
    this.tileColorCache.set(tileCoords, colorCounts);

    // Mark this tile as processed
    this.processedTiles.add(tileCoords);

    // Update global statistics if available
    if (this.templateStats) {
      this.templateStats.paintedPixels += paintedCount;
      this.templateStats.missingPixels =
        this.templateStats.totalPixels - this.templateStats.paintedPixels;

      // Update global color counts
      for (const [color, count] of colorCounts.entries()) {
        const currentCount = this.templateStats.paintedByColor.get(color) || 0;
        this.templateStats.paintedByColor.set(color, currentCount + count);
      }

      // Update the UI with current progress
      this.displayTemplateStats(this.templateStats);

      const tileProgress = totalCount > 0 ? paintedCount / totalCount : 0;
      console.log(
        `Tile ${tileCoords} progress: ${paintedCount}/${totalCount} (${(
          tileProgress * 100
        ).toFixed(1)}%) - CACHED`
      );
      console.log(
        `Global progress: ${this.templateStats.paintedPixels}/${
          this.templateStats.totalPixels
        } (${(
          (this.templateStats.paintedPixels / this.templateStats.totalPixels) *
          100
        ).toFixed(1)}%)`
      );
    }
  }

  /** Invalidates cache for a specific tile
   * @param {string} tileCoords - The tile coordinates to invalidate
   * @since 0.67.1
   */
  invalidateTileCache(tileCoords) {
    if (this.tilePixelCache.has(tileCoords)) {
      const oldPixelCount = this.tilePixelCache.get(tileCoords);
      const oldColorData = this.tileColorCache.get(tileCoords) || new Map();

      // Subtract old counts from global stats
      if (this.templateStats) {
        this.templateStats.paintedPixels -= oldPixelCount;

        // Subtract old color counts
        for (const [color, count] of oldColorData.entries()) {
          const currentCount =
            this.templateStats.paintedByColor.get(color) || 0;
          this.templateStats.paintedByColor.set(
            color,
            Math.max(0, currentCount - count)
          );
        }

        // Recalculate missing pixels
        this.templateStats.missingPixels =
          this.templateStats.totalPixels - this.templateStats.paintedPixels;
      }

      // Remove from caches
      this.tilePixelCache.delete(tileCoords);
      this.tileColorCache.delete(tileCoords);
      this.processedTiles.delete(tileCoords);

      console.log(`Invalidated cache for tile ${tileCoords}`);
    }
  }

  /** Displays the template statistics in the UI
   * @param {Object} stats - The calculated statistics
   * @since 0.67.1
   */
  displayTemplateStats(stats) {
    // Calculate visible (non-hidden) pixels
    let visibleTotalPixels = 0;
    let visiblePaintedPixels = 0;

    if (stats.colorCounts) {
      for (const [color, count] of stats.colorCounts.entries()) {
        if (!this.hiddenColors.has(color)) {
          visibleTotalPixels += count;
          const paintedForColor = stats.paintedByColor
            ? stats.paintedByColor.get(color) || 0
            : 0;
          visiblePaintedPixels += paintedForColor;
        }
      }
    }

    const visibleMissingPixels = visibleTotalPixels - visiblePaintedPixels;
    const paintedPercentage =
      visibleTotalPixels > 0
        ? ((visiblePaintedPixels / visibleTotalPixels) * 100).toFixed(1)
        : 0;
    const missingPercentage =
      visibleTotalPixels > 0
        ? ((visibleMissingPixels / visibleTotalPixels) * 100).toFixed(1)
        : 0;

    // Update main statistics
    this.overlay.updateInnerHTML(
      'bm-stats-total',
      `Total pixels: ${visibleTotalPixels.toLocaleString()}`
    );
    this.overlay.updateInnerHTML(
      'bm-stats-painted',
      `Painted: ${visiblePaintedPixels.toLocaleString()} (${paintedPercentage}%)`
    );
    this.overlay.updateInnerHTML(
      'bm-stats-missing',
      `Missing: ${visibleMissingPixels.toLocaleString()} (${missingPercentage}%)`
    );

    // Update colors if details are currently shown
    const colorsContainer = document.getElementById('bm-colors-container');
    if (colorsContainer && colorsContainer.style.display === 'block') {
      this.displayColorsInGrid(stats);
    }
  }

  /** Toggles the visibility of color details
   * @since 0.67.1
   */
  toggleColorDetails() {
    if (!this.templateStats || !this.templateStats.colorCounts) {
      this.overlay.handleDisplayError('No template colors available!');
      return;
    }

    const colorsContainer = document.getElementById('bm-colors-container');
    const button = document.getElementById('bm-show-details');

    if (colorsContainer && button) {
      if (
        colorsContainer.style.display === 'none' ||
        !colorsContainer.style.display
      ) {
        colorsContainer.style.display = 'block';
        button.textContent = 'Ocultar Detalhes';
        this.displayColorsInGrid(this.templateStats);
        this.overlay.handleDisplayStatus('Color details shown!');
      } else {
        colorsContainer.style.display = 'none';
        button.textContent = 'Detalhes';
        this.overlay.handleDisplayStatus('Color details hidden!');
      }
    }
  }

  /** Shows all hidden colors
   * @since 0.67.1
   */
  showAllColors() {
    const colorsGrid = document.getElementById('bm-colors-grid');
    if (colorsGrid) {
      const colorCards = colorsGrid.querySelectorAll(
        'div[style*="display: none"]'
      );

      // Clear hidden colors set
      this.hiddenColors.clear();

      // Invalidate all tile caches since showing colors affects calculations
      this.tilePixelCache.clear();
      this.tileColorCache.clear();
      this.processedTiles.clear();

      // Show all color cards
      colorCards.forEach((card) => {
        card.style.display = 'flex';
      });

      if (colorCards.length > 0) {
        // Force recalculation to include all colors
        this.forceRecalculation();

        this.overlay.handleDisplayStatus(
          `Showed ${colorCards.length} hidden color(s) and included them in calculations!`
        );
      } else {
        this.overlay.handleDisplayStatus('No hidden colors to show!');
      }
    }
  }
  /** Displays the colors in the grid container
   * @param {Object} stats - The calculated statistics
   * @since 0.67.1
   */
  displayColorsInGrid(stats) {
    const colorsGrid = document.getElementById('bm-colors-grid');
    if (!colorsGrid || !stats.colorCounts) return;

    // Clear existing colors
    colorsGrid.innerHTML = '';

    // Filter out hidden colors and sort: incomplete first (by percentage desc), then complete (100%) at the end
    const sortedColors = Array.from(stats.colorCounts.entries())
      .filter(([color]) => !this.hiddenColors.has(color)) // Filter out hidden colors
      .sort((a, b) => {
        const [colorA, countA] = a;
        const [colorB, countB] = b;

        const paintedA = stats.paintedByColor
          ? stats.paintedByColor.get(colorA) || 0
          : 0;
        const paintedB = stats.paintedByColor
          ? stats.paintedByColor.get(colorB) || 0
          : 0;

        const percentageA = countA > 0 ? (paintedA / countA) * 100 : 0;
        const percentageB = countB > 0 ? (paintedB / countB) * 100 : 0;

        // If both are 100% or both are incomplete, sort by count (most pixels first)
        if (
          (percentageA === 100 && percentageB === 100) ||
          (percentageA < 100 && percentageB < 100)
        ) {
          return countB - countA;
        }

        // Put incomplete colors first, complete colors last
        if (percentageA === 100 && percentageB < 100) return 1;
        if (percentageA < 100 && percentageB === 100) return -1;

        return 0;
      });

    // Create color cards
    sortedColors.forEach(([color, count]) => {
      const colorCard = document.createElement('div');
      colorCard.style.cssText = `
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px;
        background: var(--background-secondary);
        border-radius: var(--radius-box);
        border: 1px solid var(--border-color);
        transition: transform 0.2s ease;
        position: relative;
      `;

      // Add hover effect
      colorCard.addEventListener('mouseenter', () => {
        colorCard.style.transform = 'scale(1.02)';
      });
      colorCard.addEventListener('mouseleave', () => {
        colorCard.style.transform = 'scale(1)';
      });

      const colorBox = document.createElement('div');
      colorBox.style.cssText = `
        width: 24px;
        height: 24px;
        background-color: ${color};
        border: 1px solid var(--border-color);
        border-radius: 4px;
        flex-shrink: 0;
      `;

      const colorInfo = document.createElement('div');
      colorInfo.style.cssText = `
        font-size: 12px;
        color: var(--text-primary);
        flex: 1;
      `;

      // Calculate painted pixels for this color
      const paintedForColor = stats.paintedByColor
        ? stats.paintedByColor.get(color) || 0
        : 0;
      const percentage =
        count > 0 ? ((paintedForColor / count) * 100).toFixed(1) : 0;

      colorInfo.innerHTML = `
        <div style="font-weight: bold;">${paintedForColor}/${count.toLocaleString()} (${percentage}% painted)</div>
        <div style="font-size: 10px; color: var(--text-secondary); margin-top: 2px;">${count.toLocaleString()} total pixels</div>
      `;

      // Add hide button
      const hideButton = document.createElement('button');
      hideButton.style.cssText = `
        position: absolute;
        top: 4px;
        right: 4px;
        width: 16px;
        height: 16px;
        border: none;
        background: var(--background-primary);
        color: var(--text-secondary);
        border-radius: 50%;
        font-size: 10px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0.7;
        transition: opacity 0.2s ease;
      `;
      hideButton.textContent = '×';
      hideButton.title = 'Hide this color';

      hideButton.addEventListener('mouseenter', () => {
        hideButton.style.opacity = '1';
        hideButton.style.background = 'var(--accent-color)';
        hideButton.style.color = 'white';
      });
      hideButton.addEventListener('mouseleave', () => {
        hideButton.style.opacity = '0.7';
        hideButton.style.background = 'var(--background-primary)';
        hideButton.style.color = 'var(--text-secondary)';
      });

      hideButton.addEventListener('click', (e) => {
        e.stopPropagation();

        // Add color to hidden set
        this.hiddenColors.add(color);

        // Invalidate all tile caches since hidden colors affect calculations
        this.tilePixelCache.clear();
        this.tileColorCache.clear();
        this.processedTiles.clear();

        // Remove card from display
        colorCard.style.display = 'none';

        // Force recalculation to apply hidden color filter
        this.forceRecalculation();

        this.overlay.handleDisplayStatus(
          `Color ${color} hidden and excluded from calculations!`
        );
      });

      colorCard.appendChild(colorBox);
      colorCard.appendChild(colorInfo);
      colorCard.appendChild(hideButton);
      colorsGrid.appendChild(colorCard);
    });
  }

  /** Initializes template statistics when a template is created
   * @param {Template} template - The template instance
   * @since 0.67.1
   */
  async initializeTemplateStats(template) {
    if (!template || !template.file) {
      return;
    }

    // Create bitmap from template file
    const bitmap = await createImageBitmap(template.file);
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext('2d');

    context.drawImage(bitmap, 0, 0);
    const imageData = context.getImageData(0, 0, bitmap.width, bitmap.height);

    const stats = {
      totalPixels: 0,
      colorCounts: new Map(),
      paintedPixels: 0,
      missingPixels: 0,
      paintedByColor: new Map(), // Track painted pixels by color
      templateSize: { width: bitmap.width, height: bitmap.height },
      coords: template.coords,
    };

    // Count pixels and colors in template
    for (let i = 0; i < imageData.data.length; i += 4) {
      const alpha = imageData.data[i + 3];

      // Skip transparent pixels
      if (alpha === 0) continue;

      stats.totalPixels++;

      const r = imageData.data[i];
      const g = imageData.data[i + 1];
      const b = imageData.data[i + 2];
      const colorKey = `rgb(${r},${g},${b})`;

      stats.colorCounts.set(
        colorKey,
        (stats.colorCounts.get(colorKey) || 0) + 1
      );
    }

    stats.missingPixels = stats.totalPixels;

    // Reset processed tiles for fresh calculation
    this.processedTiles.clear();
    // Clear caches for fresh calculation
    this.tilePixelCache.clear();
    this.tileColorCache.clear();

    // Store stats but don't display initially
    this.templateStats = stats;
  }

  /** Resets painted pixels count when canvas changes detected
   * @since 0.67.1
   */
  resetPaintedPixels() {
    if (this.templateStats) {
      this.templateStats.paintedPixels = 0;
      this.templateStats.missingPixels = this.templateStats.totalPixels;

      // Reset painted pixels by color
      if (this.templateStats.paintedByColor) {
        this.templateStats.paintedByColor.clear();
      }

      this.processedTiles.clear();
      // Clear tile caches
      this.tilePixelCache.clear();
      this.tileColorCache.clear();
      // Don't clear hidden colors - they should persist across resets
      // this.hiddenColors.clear();

      // Update display if stats are currently visible
      const statsContainer = document.getElementById('bm-contain-stats');
      if (statsContainer && statsContainer.style.display === 'block') {
        this.displayTemplateStats(this.templateStats);
      }

      console.log(
        'Painted pixels reset due to canvas change - cleared all caches'
      );
    }
  }

  /** Forces a complete recalculation by clearing all processed tiles
   * This will trigger recalculation when tiles are next loaded
   * @since 0.67.1
   */
  forceRecalculation() {
    if (this.templateStats) {
      // Reset painted pixels data
      this.templateStats.paintedPixels = 0;
      this.templateStats.missingPixels = this.templateStats.totalPixels;

      // Reset painted pixels by color
      if (this.templateStats.paintedByColor) {
        this.templateStats.paintedByColor.clear();
      }

      // Clear processed tiles and caches to force recalculation
      this.processedTiles.clear();
      this.tilePixelCache.clear();
      this.tileColorCache.clear();

      // Update display immediately
      const statsContainer = document.getElementById('bm-contain-stats');
      if (statsContainer && statsContainer.style.display === 'block') {
        this.displayTemplateStats(this.templateStats);
      }

      console.log('Forced recalculation - all tiles will be reprocessed');
      this.overlay.handleDisplayStatus('Recalculating template progress...');
    }
  }

  /** Imports the JSON object, and appends it to any JSON object already loaded
   */
  importJSON() {}

  /** Parses the Blue Marble JSON object
   */
  #parseBlueMarble() {}

  /** Parses the OSU! Place JSON object
   */
  #parseOSU() {}
}
