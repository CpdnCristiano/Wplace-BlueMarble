/** ApiManager class for handling API requests, responses, and interactions.
 * Note: Fetch spying is done in main.js, not here.
 * @since 0.11.1
 */

import TemplateManager from './templateManager.js';
import { escapeHTML, numberToEncoded, serverTPtoDisplayTP } from './utils.js';

export default class ApiManager {
  /** Constructor for ApiManager class
   * @param {TemplateManager} templateManager
   * @since 0.11.34
   */
  constructor(templateManager) {
    this.templateManager = templateManager;
    this.disableAll = false; // Should the entire userscript be disabled?
    this.coordsTilePixel = []; // Contains the last detected tile/pixel coordinate pair requested
    this.templateCoordsTilePixel = []; // Contains the last "enabled" template coords
  }

  /** Determines if the spontaneously recieved response is something we want.
   * Otherwise, we can ignore it.
   * Note: Due to aggressive compression, make your calls like `data['jsonData']['name']` instead of `data.jsonData.name`
   *
   * @param {Overlay} overlay - The Overlay class instance
   * @since 0.11.1
   */
  spontaneousResponseListener(overlay) {
    // Triggers whenever a message is sent
    window.addEventListener('message', async (event) => {
      const data = event.data; // The data of the message
      const dataJSON = data['jsonData']; // The JSON response, if any
      const method = data['method'] || 'GET'; // HTTP method

      // Kills itself if the message was not intended for Blue Marble
      if (!(data && data['source'] === 'blue-marble')) {
        return;
      }

      // Kills itself if the message has no endpoint (intended for Blue Marble, but not this function)
      if (!data['endpoint']) {
        return;
      }

      // Check for potential pixel painting operations (PUT/POST requests)
      if (
        (method === 'PUT' || method === 'POST') &&
        data['endpoint'].includes('pixel')
      ) {
        console.log('Detected potential pixel painting operation');

        // Extract tile coordinates from pixel endpoint if possible
        try {
          const parts = data['endpoint'].split('/');
          const tileX = parseInt(parts[parts.length - 2]);
          const tileY = parseInt(parts[parts.length - 1].split('?')[0]);
          const tileKey = `${tileX},${tileY}`;

          // Invalidate cache for the specific tile where pixel was painted
          setTimeout(() => {
            this.templateManager.invalidateTileCache(tileKey);
            console.log(
              `Invalidated cache for painted pixel at tile ${tileKey}`
            );
          }, 1000);
        } catch (e) {
          // If we can't determine the tile, do a minimal recalculation
          setTimeout(() => {
            this.templateManager.forceRecalculation();
          }, 1000);
        }
      }

      // Trims endpoint to the second to last non-number, non-null directoy.
      // E.g. "wplace.live/api/pixel/0/0?payload" -> "pixel"
      // E.g. "wplace.live/api/files/s0/tiles/0/0/0.png" -> "tiles"
      const endpointText = data['endpoint']
        ?.split('?')[0]
        .split('/')
        .filter((s) => s && isNaN(Number(s)))
        .filter((s) => s && !s.includes('.'))
        .pop();

      console.log(
        `%cBlue Marble%c: Recieved message about "%s"`,
        'color: cornflowerblue;',
        '',
        endpointText
      );

      // Each case is something that Blue Marble can use from the fetch.
      // For instance, if the fetch was for "me", we can update the overlay stats
      switch (endpointText) {
        case 'me': // Request to retrieve user data
          // If the game can not retrieve the userdata...
          if (dataJSON['status'] && dataJSON['status']?.toString()[0] != '2') {
            // The server is probably down (NOT a 2xx status)

            overlay.handleDisplayError(
              `You are not logged in!\nCould not fetch userdata.`
            );
            return; // Kills itself before attempting to display null userdata
          }

          const nextLevelPixels = Math.ceil(
            Math.pow(
              Math.floor(dataJSON['level']) * Math.pow(30, 0.65),
              1 / 0.65
            ) - dataJSON['pixelsPainted']
          ); // Calculates pixels to the next level

          console.log(dataJSON['id']);
          if (!!dataJSON['id'] || dataJSON['id'] === 0) {
            console.log(
              numberToEncoded(
                dataJSON['id'],
                "!#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[]^_`abcdefghijklmnopqrstuvwxyz{|}~"
              )
            );
          }
          this.templateManager.userID = dataJSON['id'];

          overlay.updateInnerHTML(
            'bm-user-name',
            `Username: <b>${escapeHTML(dataJSON['name'])}</b>`
          ); // Updates the text content of the username field
          overlay.updateInnerHTML(
            'bm-user-droplets',
            `Droplets: <b>${new Intl.NumberFormat().format(
              dataJSON['droplets']
            )}</b>`
          ); // Updates the text content of the droplets field
          overlay.updateInnerHTML(
            'bm-user-nextlevel',
            `Next level in <b>${new Intl.NumberFormat().format(
              nextLevelPixels
            )}</b> pixel${nextLevelPixels == 1 ? '' : 's'}`
          ); // Updates the text content of the next level field
          break;

        case 'pixel': // Request to retrieve pixel data
          const coordsTile = data['endpoint']
            .split('?')[0]
            .split('/')
            .filter((s) => s && !isNaN(Number(s))); // Retrieves the tile coords as [x, y]
          const payloadExtractor = new URLSearchParams(
            data['endpoint'].split('?')[1]
          ); // Declares a new payload deconstructor and passes in the fetch request payload
          const coordsPixel = [
            payloadExtractor.get('x'),
            payloadExtractor.get('y'),
          ]; // Retrieves the deconstructed pixel coords from the payload

          // Don't save the coords if there are previous coords that could be used
          if (
            this.coordsTilePixel.length &&
            (!coordsTile.length || !coordsPixel.length)
          ) {
            overlay.handleDisplayError(
              `Coordinates are malformed!\nDid you try clicking the canvas first?`
            );
            return; // Kills itself
          }

          this.coordsTilePixel = [...coordsTile, ...coordsPixel]; // Combines the two arrays such that [x, y, x, y]
          const displayTP = serverTPtoDisplayTP(coordsTile, coordsPixel);

          const spanElements = document.querySelectorAll('span'); // Retrieves all span elements

          // For every span element, find the one we want (pixel numbers when canvas clicked)
          for (const element of spanElements) {
            if (
              element.textContent
                .trim()
                .includes(`${displayTP[0]}, ${displayTP[1]}`)
            ) {
              let displayCoords = document.querySelector('#bm-display-coords'); // Find the additional pixel coords span

              const text = `(Tl X: ${coordsTile[0]}, Tl Y: ${coordsTile[1]}, Px X: ${coordsPixel[0]}, Px Y: ${coordsPixel[1]})`;

              // Obtém a cor do template nas coordenadas específicas
              let templateColorInfo = '';
              try {
                // Converte coordenadas tile/pixel para coordenadas do mundo
                const worldX =
                  parseInt(coordsTile[0]) * 1000 + parseInt(coordsPixel[0]);
                const worldY =
                  parseInt(coordsTile[1]) * 1000 + parseInt(coordsPixel[1]);

                // Usa o método do templateManager para obter a cor do template
                this.templateManager
                  .getTemplateColorAtPixel(worldX, worldY)
                  .then((templatePixel) => {
                    if (templatePixel) {
                      const hexColor = `#${templatePixel.r
                        .toString(16)
                        .padStart(2, '0')}${templatePixel.g
                        .toString(16)
                        .padStart(2, '0')}${templatePixel.b
                        .toString(16)
                        .padStart(2, '0')}`;
                      if (this.templateManager.convertToWplaceColors) {
                        const wplaceColor = this.templateManager.findClosestWplaceColor(
                          templatePixel.r,
                          templatePixel.g,
                          templatePixel.b
                        );
                        if (wplaceColor) {
                          templateColorInfo = ` -> ${wplaceColor.name}`;
                        } else {
                          templateColorInfo = ` -> ${templatePixel.rgb} (${hexColor})`;
                        }
                      } else {
                        templateColorInfo = ` -> ${templatePixel.rgb} (${hexColor})`;
                      }

                      // Atualiza o texto com a informação da cor
                      const updatedText = text + templateColorInfo;
                      if (displayCoords) {
                        displayCoords.textContent = updatedText;
                      }
                    }
                  })
                  .catch((error) => {
                    console.warn('Erro ao obter cor do template:', error);
                  });
              } catch (error) {
                console.warn(
                  'Erro ao processar coordenadas do template:',
                  error
                );
              }
              // If we could not find the addition coord span, we make it then update the textContent with the new coords
              if (!displayCoords) {
                displayCoords = document.createElement('span');
                displayCoords.id = 'bm-display-coords';
                displayCoords.textContent = text;
                displayCoords.style =
                  'margin-left: calc(var(--spacing)*3); font-size: small;';
                element.parentNode.parentNode.parentNode.insertAdjacentElement(
                  'afterend',
                  displayCoords
                );
              } else {
                displayCoords.textContent = text;
              }
            }
          }
          break;

        case 'tiles':
          // Runs only if the tile has the template
          let tileCoordsTile = data['endpoint'].split('/');
          tileCoordsTile = [
            parseInt(tileCoordsTile[tileCoordsTile.length - 2]),
            parseInt(
              tileCoordsTile[tileCoordsTile.length - 1].replace('.png', '')
            ),
          ];

          const blobUUID = data['blobID'];
          const blobData = data['blobData'];

          // Track tile loads for change detection
          const tileKey = `${tileCoordsTile[0]},${tileCoordsTile[1]}`;
          if (!this.loadedTiles) {
            this.loadedTiles = new Set();
          }
          if (!this.tileLoadTimes) {
            this.tileLoadTimes = new Map();
          }

          const now = Date.now();
          const lastLoadTime = this.tileLoadTimes.get(tileKey);

          // If this tile wasn't loaded before, or if it was reloaded recently (indicating changes)
          if (!this.loadedTiles.has(tileKey)) {
            this.loadedTiles.add(tileKey);
            this.tileLoadTimes.set(tileKey, now);
            // New tile - no need to force full recalculation, just let it calculate naturally
            console.log(`New tile detected: ${tileKey}`);
          } else if (lastLoadTime && now - lastLoadTime < 30000) {
            // If tile was reloaded within 30 seconds, likely indicates canvas changes
            this.tileLoadTimes.set(tileKey, now);
            // Invalidate cache for this specific tile only
            this.templateManager.invalidateTileCache(tileKey);
            console.log(`Tile ${tileKey} reloaded, invalidated cache`);
          } else {
            // Update load time for existing tiles
            this.tileLoadTimes.set(tileKey, now);
          }

          const templateBlob = await this.templateManager.drawTemplateOnTile(
            blobData,
            tileCoordsTile
          );

          window.postMessage({
            source: 'blue-marble',
            blobID: blobUUID,
            blobData: templateBlob,
            blink: data['blink'],
          });
          break;

        case 'robots': // Request to retrieve what script types are allowed
          this.disableAll =
            dataJSON['userscript']?.toString().toLowerCase() == 'false'; // Disables Blue Marble if site owner wants userscripts disabled
          break;
      }
    });
  }
}
