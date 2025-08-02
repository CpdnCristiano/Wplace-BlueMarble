/** Sanitizes HTML to display as plain-text.
 * This prevents some Cross Site Scripting (XSS).
 * This is handy when you are displaying user-made data, and you *must* use innerHTML.
 * @param {string} text - The text to sanitize
 * @returns {string} HTML escaped string
 * @since 0.44.2
 * @example
 * const paragraph = document.createElement('p');
 * paragraph.innerHTML = escapeHTML('<u>Foobar.</u>');
 * // Output:
 * // (Does not include the paragraph element)
 * // (Output is not HTML formatted)
 * <p>
 *   "<u>Foobar.</u>"
 * </p>
 */
export function escapeHTML(text) {
  const div = document.createElement('div'); // Creates a div
  div.textContent = text; // Puts the text in a PLAIN-TEXT property
  return div.innerHTML; // Returns the HTML property of the div
}

/** Converts the server tile-pixel coordinate system to the displayed tile-pixel coordinate system.
 * @param {string[]} tile - The tile to convert (as an array like ["12", "124"])
 * @param {string[]} pixel - The pixel to convert (as an array like ["12", "124"])
 * @returns {number[]} [tile, pixel]
 * @since 0.42.4
 * @example
 * console.log(serverTPtoDisplayTP(['12', '123'], ['34', '567'])); // [34, 3567]
 */
export function serverTPtoDisplayTP(tile, pixel) {
  return [
    (parseInt(tile[0]) % 4) * 1000 + parseInt(pixel[0]),
    (parseInt(tile[1]) % 4) * 1000 + parseInt(pixel[1]),
  ];
}

/** Negative-Safe Modulo. You can pass negative numbers into this.
 * @param {number} a - The first number
 * @param {number} b - The second number
 * @returns {number} Result
 * @author osuplace
 * @since 0.55.8
 */
export function negativeSafeModulo(a, b) {
  return ((a % b) + b) % b;
}

/** Bypasses terser's stripping of console function calls.
 * This is so the non-obfuscated code will contain debugging console calls, but the distributed version won't.
 * However, the distributed version needs to call the console somehow, so this wrapper function is how.
 * This is the same as `console.log()`.
 * @param {...any} args - Arguments to be passed into the `log()` function of the Console
 * @since 0.58.9
 */
export function consoleLog(...args) {
  ((consoleLog) => consoleLog(...args))(console.log);
}

/** Bypasses terser's stripping of console function calls.
 * This is so the non-obfuscated code will contain debugging console calls, but the distributed version won't.
 * However, the distributed version needs to call the console somehow, so this wrapper function is how.
 * This is the same as `console.error()`.
 * @param {...any} args - Arguments to be passed into the `error()` function of the Console
 * @since 0.58.13
 */
export function consoleError(...args) {
  ((consoleError) => consoleError(...args))(console.error);
}

/** Bypasses terser's stripping of console function calls.
 * This is so the non-obfuscated code will contain debugging console calls, but the distributed version won't.
 * However, the distributed version needs to call the console somehow, so this wrapper function is how.
 * This is the same as `console.warn()`.
 * @param {...any} args - Arguments to be passed into the `warn()` function of the Console
 * @since 0.58.13
 */
export function consoleWarn(...args) {
  ((consoleWarn) => consoleWarn(...args))(console.warn);
}

/** Encodes a number into a custom encoded string.
 * @param {number} number - The number to encode
 * @param {string} encoding - The characters to use when encoding
 * @since 0.65.2
 * @returns {string} Encoded string
 * @example
 * const encode = '012abcABC'; // Base 9
 * console.log(numberToEncoded(0, encode)); // 0
 * console.log(numberToEncoded(5, encode)); // c
 * console.log(numberToEncoded(15, encode)); // 1A
 * console.log(numberToEncoded(12345, encode)); // 1BCaA
 */
export function numberToEncoded(number, encoding) {
  if (number === 0) return encoding[0]; // End quickly if number equals 0. No special calculation needed

  let result = ''; // The encoded string
  const base = encoding.length; // The number of characters used, which determines the base

  // Base conversion algorithm
  while (number > 0) {
    result = encoding[number % base] + result; // Find's the character's encoded value determined by the modulo of the base
    number = Math.floor(number / base); // Divides the number by the base so the next iteration can find the next modulo character
  }

  return result; // The final encoded string
}

/** Salva as coordenadas no localStorage para cache
 * @param {number[]} coords - Array com as coordenadas [tlX, tlY, pxX, pxY]
 * @since 0.67.0
 */
export function saveLastCoordinates(coords) {
  try {
    localStorage.setItem('bm-last-coordinates', JSON.stringify(coords));
    consoleLog('Coordenadas salvas no cache:', coords);
  } catch (error) {
    consoleWarn('Erro ao salvar coordenadas no cache:', error);
  }
}

/** Carrega as últimas coordenadas salvas do localStorage
 * @returns {number[]|null} Array com as coordenadas [tlX, tlY, pxX, pxY] ou null se não houver
 * @since 0.67.0
 */
export function loadLastCoordinates() {
  try {
    const saved = localStorage.getItem('bm-last-coordinates');
    if (saved) {
      const coords = JSON.parse(saved);
      consoleLog('Coordenadas carregadas do cache:', coords);
      return coords;
    }
  } catch (error) {
    consoleWarn('Erro ao carregar coordenadas do cache:', error);
  }
  return null;
}

/** Limpa as coordenadas salvas do localStorage
 * @since 0.67.0
 */
export function clearLastCoordinates() {
  try {
    localStorage.removeItem('bm-last-coordinates');
    consoleLog('Cache de coordenadas limpo');
  } catch (error) {
    consoleWarn('Erro ao limpar cache de coordenadas:', error);
  }
}

/** Salva a última imagem de template no localStorage
 * @param {File} file - Arquivo da imagem
 * @param {string} fileName - Nome do arquivo
 * @since 0.67.0
 */
export function saveLastTemplate(file, fileName) {
  try {
    const reader = new FileReader();
    reader.onload = function (e) {
      const imageData = {
        data: e.target.result,
        name: fileName,
        type: file.type,
        size: file.size,
        lastModified: file.lastModified,
      };
      localStorage.setItem('bm-last-template', JSON.stringify(imageData));
      consoleLog('Template salvo no cache:', fileName);
    };
    reader.readAsDataURL(file);
  } catch (error) {
    consoleWarn('Erro ao salvar template no cache:', error);
  }
}

/** Carrega a última imagem de template salva do localStorage
 * @returns {Promise<File|null>} Arquivo da imagem ou null se não houver
 * @since 0.67.0
 */
export function loadLastTemplate() {
  try {
    const saved = localStorage.getItem('bm-last-template');
    if (saved) {
      const imageData = JSON.parse(saved);
      consoleLog('Template carregado do cache:', imageData.name);

      // Converte base64 de volta para File
      return new Promise((resolve) => {
        fetch(imageData.data)
          .then((res) => res.blob())
          .then((blob) => {
            const file = new File([blob], imageData.name, {
              type: imageData.type,
              lastModified: imageData.lastModified,
            });
            resolve(file);
          })
          .catch((error) => {
            consoleWarn('Erro ao converter template do cache:', error);
            resolve(null);
          });
      });
    }
  } catch (error) {
    consoleWarn('Erro ao carregar template do cache:', error);
  }
  return Promise.resolve(null);
}

/** Limpa o template salvo do localStorage
 * @since 0.67.0
 */
export function clearLastTemplate() {
  try {
    localStorage.removeItem('bm-last-template');
    consoleLog('Cache de template limpo');
  } catch (error) {
    consoleWarn('Erro ao limpar cache de template:', error);
  }
}
