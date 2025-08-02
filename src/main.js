/** The main file. Everything in the userscript is executed from here.
 * @since 0.0.0
 */

import Overlay from './Overlay.js';
import Observers from './observers.js';
import ApiManager from './apiManager.js';
import TemplateManager from './templateManager.js';
import {
  consoleLog,
  consoleWarn,
  saveLastCoordinates,
  loadLastCoordinates,
  saveLastTemplate,
  loadLastTemplate,
} from './utils.js';

const name = GM_info.script.name.toString(); // Name of userscript
const version = GM_info.script.version.toString(); // Version of userscript
const consoleStyle = 'color: cornflowerblue;'; // The styling for the console logs

/** Injects code into the client
 * This code will execute outside of TamperMonkey's sandbox
 * @param {*} callback - The code to execute
 * @since 0.11.15
 */
function inject(callback) {
  const script = document.createElement('script');
  script.setAttribute('bm-name', name); // Passes in the name value
  script.setAttribute('bm-cStyle', consoleStyle); // Passes in the console style value
  script.textContent = `(${callback})();`;
  document.documentElement.appendChild(script);
  script.remove();
}

/** What code to execute instantly in the client (webpage) to spy on fetch calls.
 * This code will execute outside of TamperMonkey's sandbox.
 * @since 0.11.15
 */
inject(() => {
  const script = document.currentScript; // Gets the current script HTML Script Element
  const name = script?.getAttribute('bm-name') || 'Blue Marble'; // Gets the name value that was passed in. Defaults to "Blue Marble" if nothing was found
  const consoleStyle = script?.getAttribute('bm-cStyle') || ''; // Gets the console style value that was passed in. Defaults to no styling if nothing was found
  const fetchedBlobQueue = new Map(); // Blobs being processed

  window.addEventListener('message', (event) => {
    const { source, endpoint, blobID, blobData, blink } = event.data;

    const elapsed = Date.now() - blink;

    // Since this code does not run in the userscript, we can't use consoleLog().
    console.groupCollapsed(
      `%c${name}%c: ${fetchedBlobQueue.size} Recieved IMAGE message about blob "${blobID}"`,
      consoleStyle,
      ''
    );
    console.log(
      `Blob fetch took %c${String(Math.floor(elapsed / 60000)).padStart(
        2,
        '0'
      )}:${String(Math.floor(elapsed / 1000) % 60).padStart(2, '0')}.${String(
        elapsed % 1000
      ).padStart(3, '0')}%c MM:SS.mmm`,
      consoleStyle,
      ''
    );
    console.log(fetchedBlobQueue);
    console.groupEnd();

    // The modified blob won't have an endpoint, so we ignore any message without one.
    if (source == 'blue-marble' && !!blobID && !!blobData && !endpoint) {
      const callback = fetchedBlobQueue.get(blobID); // Retrieves the blob based on the UUID

      // If the blobID is a valid function...
      if (typeof callback === 'function') {
        callback(blobData); // ...Retrieve the blob data from the blobID function
      } else {
        // ...else the blobID is unexpected. We don't know what it is, but we know for sure it is not a blob. This means we ignore it.

        consoleWarn(
          `%c${name}%c: Attempted to retrieve a blob (%s) from queue, but the blobID was not a function! Skipping...`,
          consoleStyle,
          '',
          blobID
        );
      }

      fetchedBlobQueue.delete(blobID); // Delete the blob from the queue, because we don't need to process it again
    }
  });

  // Spys on "spontaneous" fetch requests made by the client
  const originalFetch = window.fetch; // Saves a copy of the original fetch

  // Overrides fetch
  window.fetch = async function (...args) {
    const response = await originalFetch.apply(this, args); // Sends a fetch
    const cloned = response.clone(); // Makes a copy of the response

    // Retrieves the endpoint name. Unknown endpoint = "ignore"
    const endpointName =
      (args[0] instanceof Request ? args[0]?.url : args[0]) || 'ignore';

    // Get HTTP method for detecting pixel painting
    const method =
      args[0] instanceof Request ? args[0].method : args[1]?.method || 'GET';

    // Check Content-Type to only process JSON
    const contentType = cloned.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      // Since this code does not run in the userscript, we can't use consoleLog().
      console.log(
        `%c${name}%c: Sending JSON message about endpoint "${endpointName}"`,
        consoleStyle,
        ''
      );

      // Sends a message about the endpoint it spied on
      cloned
        .json()
        .then((jsonData) => {
          window.postMessage(
            {
              source: 'blue-marble',
              endpoint: endpointName,
              jsonData: jsonData,
              method: method,
            },
            '*'
          );
        })
        .catch((err) => {
          console.error(
            `%c${name}%c: Failed to parse JSON: `,
            consoleStyle,
            '',
            err
          );
        });
    } else if (
      contentType.includes('image/') &&
      !endpointName.includes('openfreemap')
    ) {
      // Fetch custom for all images but opensourcemap

      const blink = Date.now(); // Current time

      const blob = await cloned.blob(); // The original blob

      // Since this code does not run in the userscript, we can't use consoleLog().
      console.log(
        `%c${name}%c: ${fetchedBlobQueue.size} Sending IMAGE message about endpoint "${endpointName}"`,
        consoleStyle,
        ''
      );

      // Returns the manipulated blob
      return new Promise((resolve) => {
        const blobUUID = crypto.randomUUID(); // Generates a random UUID

        // Store the blob while we wait for processing
        fetchedBlobQueue.set(blobUUID, (blobProcessed) => {
          // The response that triggers when the blob is finished processing

          // Creates a new response
          resolve(
            new Response(blobProcessed, {
              headers: cloned.headers,
              status: cloned.status,
              statusText: cloned.statusText,
            })
          );

          // Since this code does not run in the userscript, we can't use consoleLog().
          console.log(
            `%c${name}%c: ${fetchedBlobQueue.size} Processed blob "${blobUUID}"`,
            consoleStyle,
            ''
          );
        });

        window.postMessage({
          source: 'blue-marble',
          endpoint: endpointName,
          blobID: blobUUID,
          blobData: blob,
          blink: blink,
        });
      }).catch((exception) => {
        const elapsed = Date.now();
        console.error(`%c${name}%c: Failed to Promise blob!`, consoleStyle, '');
        console.groupCollapsed(
          `%c${name}%c: Details of failed blob Promise:`,
          consoleStyle,
          ''
        );
        console.log(
          `Endpoint: ${endpointName}\nThere are ${
            fetchedBlobQueue.size
          } blobs processing...\nBlink: ${blink.toLocaleString()}\nTime Since Blink: ${String(
            Math.floor(elapsed / 60000)
          ).padStart(2, '0')}:${String(
            Math.floor(elapsed / 1000) % 60
          ).padStart(2, '0')}.${String(elapsed % 1000).padStart(
            3,
            '0'
          )} MM:SS.mmm`
        );
        console.error(`Exception stack:`, exception);
        console.groupEnd();
      });

      // cloned.blob().then(blob => {
      //   window.postMessage({
      //     source: 'blue-marble',
      //     endpoint: endpointName,
      //     blobData: blob
      //   }, '*');
      // });
    }

    return response; // Returns the original response
  };
});

// Imports the CSS file from dist folder on github
const cssOverlay = GM_getResourceText('CSS-BM-File');
GM_addStyle(cssOverlay);

// Imports the Roboto Mono font family
var stylesheetLink = document.createElement('link');
stylesheetLink.href =
  'https://fonts.googleapis.com/css2?family=Roboto+Mono:ital,wght@0,100..700;1,100..700&display=swap';
stylesheetLink.rel = 'preload';
stylesheetLink.as = 'style';
stylesheetLink.onload = function () {
  this.onload = null;
  this.rel = 'stylesheet';
};
document.head.appendChild(stylesheetLink);

// Função para criar botão de restore quando o overlay está oculto
function createRestoreButton() {
  // Remove botão existente se houver
  const existingButton = document.getElementById('bm-restore-button');
  if (existingButton) {
    existingButton.remove();
  }

  const restoreButton = document.createElement('button');
  restoreButton.id = 'bm-restore-button';
  restoreButton.innerHTML = '🔵'; // Ícone do Blue Marble
  restoreButton.title = 'Show Blue Marble';
  restoreButton.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    width: 40px;
    height: 40px;
    border: none;
    border-radius: 50%;
    background: #4a90e2;
    color: white;
    font-size: 20px;
    cursor: pointer;
    z-index: 999999;
    box-shadow: 0 2px 10px rgba(0,0,0,0.3);
    transition: all 0.3s ease;
  `;

  restoreButton.addEventListener('click', () => {
    const overlay = document.getElementById('bm-overlay');
    const toggleButton = document.getElementById('bm-button-toggle-visibility');
    if (overlay && toggleButton) {
      overlay.style.display = 'block';
      toggleButton.innerHTML = '👁';
      toggleButton.title = 'Hide Blue Marble';
      restoreButton.remove();
      // Usar a instância do overlay para mostrar status se disponível
      const overlayInstance = window.overlayInstance;
      if (
        overlayInstance &&
        typeof overlayInstance.handleDisplayStatus === 'function'
      ) {
        overlayInstance.handleDisplayStatus('Blue Marble shown!');
      }
    }
  });

  restoreButton.addEventListener('mouseenter', () => {
    restoreButton.style.transform = 'scale(1.1)';
    restoreButton.style.background = '#357abd';
  });

  restoreButton.addEventListener('mouseleave', () => {
    restoreButton.style.transform = 'scale(1)';
    restoreButton.style.background = '#4a90e2';
  });

  document.body.appendChild(restoreButton);
}

// CONSTRUCTORS
const observers = new Observers(); // Constructs a new Observers object
const overlay = new Overlay(name, version); // Constructs a new Overlay object
const templateManager = new TemplateManager(name, version, overlay); // Constructs a new TemplateManager object
const apiManager = new ApiManager(templateManager); // Constructs a new ApiManager object

// Disponibilizar overlay globalmente para o botão de restore
window.overlayInstance = overlay;

overlay.setApiManager(apiManager); // Sets the API manager

buildOverlayMain(); // Builds the main overlay

overlay.handleDrag('#bm-overlay', '#bm-bar-drag'); // Creates dragging capability on the drag bar for dragging the overlay

apiManager.spontaneousResponseListener(overlay); // Reads spontaneous fetch responces

observeBlack(); // Observes the black palette color

consoleLog(
  `%c${name}%c (${version}) userscript has loaded!`,
  'color: cornflowerblue;',
  ''
);

/** Observe the black color, and add the "Move" button.
 * @since 0.66.3
 */
function observeBlack() {
  const observer = new MutationObserver((mutations, observer) => {
    const black = document.querySelector('#color-1'); // Attempt to retrieve the black color element for anchoring

    if (!black) {
      return;
    } // Black color does not exist yet. Kills iteself

    let move = document.querySelector('#bm-button-move'); // Tries to find the move button

    // If the move button does not exist, we make a new one
    if (!move) {
      move = document.createElement('button');
      move.id = 'bm-button-move';
      move.textContent = 'Move ↑';
      move.className = 'btn btn-soft';
      move.onclick = function () {
        const roundedBox = this.parentNode.parentNode.parentNode.parentNode; // Obtains the rounded box
        const shouldMoveUp = this.textContent == 'Move ↑';
        roundedBox.parentNode.className =
          roundedBox.parentNode.className.replace(
            shouldMoveUp ? 'bottom' : 'top',
            shouldMoveUp ? 'top' : 'bottom'
          ); // Moves the rounded box to the top
        roundedBox.style.borderTopLeftRadius = shouldMoveUp
          ? '0px'
          : 'var(--radius-box)';
        roundedBox.style.borderTopRightRadius = shouldMoveUp
          ? '0px'
          : 'var(--radius-box)';
        roundedBox.style.borderBottomLeftRadius = shouldMoveUp
          ? 'var(--radius-box)'
          : '0px';
        roundedBox.style.borderBottomRightRadius = shouldMoveUp
          ? 'var(--radius-box)'
          : '0px';
        this.textContent = shouldMoveUp ? 'Move ↓' : 'Move ↑';
      };

      // Attempts to find the "Paint Pixel" element for anchoring
      const paintPixel =
        black.parentNode.parentNode.parentNode.parentNode.querySelector('h2');

      paintPixel.parentNode.appendChild(move); // Adds the move button
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
}

/** Deploys the overlay to the page.
 * Parent/child relationships in the DOM structure below are indicated by indentation.
 * @since 0.58.3
 */
function buildOverlayMain() {
  overlay
    .addDiv({ id: 'bm-overlay', style: 'top: 10px; right: 75px;' })
    .addDiv({ id: 'bm-contain-header' })
    .addDiv({ id: 'bm-bar-drag' })
    .buildElement()
    .addImg({
      alt: 'Blue Marble Icon',
      src: 'https://raw.githubusercontent.com/CpdnCristiano/Wplace-BlueMarble/better-wplace/dist/assets/Favicon.png',
    })
    .buildElement()
    .addHeader(1, { textContent: name })
    .buildElement()
    .buildElement()

    .addHr()
    .buildElement()

    .addDiv({ id: 'bm-contain-userinfo' })
    .addP({ id: 'bm-user-name', textContent: 'Username:' })
    .buildElement()
    .addP({ id: 'bm-user-droplets', textContent: 'Droplets:' })
    .buildElement()
    .addP({ id: 'bm-user-nextlevel', textContent: 'Next level in...' })
    .buildElement()
    .buildElement()

    .addHr()
    .buildElement()

    .addDiv({ id: 'bm-contain-automation' })
    // .addCheckbox({'id': 'bm-input-stealth', 'textContent': 'Stealth', 'checked': true}).buildElement()
    // .addButtonHelp({'title': 'Waits for the website to make requests, instead of sending requests.'}).buildElement()
    // .addBr().buildElement()
    // .addCheckbox({'id': 'bm-input-possessed', 'textContent': 'Possessed', 'checked': true}).buildElement()
    // .addButtonHelp({'title': 'Controls the website as if it were possessed.'}).buildElement()
    // .addBr().buildElement()
    .addDiv({ id: 'bm-contain-coords' })
    .addButton(
      {
        id: 'bm-button-coords',
        className: 'bm-help',
        style: 'margin-top: 0;',
        innerHTML:
          '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 6"><circle cx="2" cy="2" r="2"></circle><path d="M2 6 L3.7 3 L0.3 3 Z"></path><circle cx="2" cy="2" r="0.7" fill="white"></circle></svg></svg>',
      },
      (instance, button) => {
        button.onclick = () => {
          const coords = instance.apiManager?.coordsTilePixel; // Retrieves the coords from the API manager
          if (!coords?.[0]) {
            instance.handleDisplayError(
              'Coordinates are malformed! Did you try clicking on the canvas first?'
            );
            return;
          }
          // Salva as coordenadas no cache
          saveLastCoordinates(coords);

          instance.updateInnerHTML('bm-input-tx', coords?.[0] || '');
          instance.updateInnerHTML('bm-input-ty', coords?.[1] || '');
          instance.updateInnerHTML('bm-input-px', coords?.[2] || '');
          instance.updateInnerHTML('bm-input-py', coords?.[3] || '');
        };
      }
    )
    .buildElement()
    .addInput(
      {
        type: 'number',
        id: 'bm-input-tx',
        placeholder: 'Tl X',
        min: 0,
        max: 2047,
        step: 1,
        required: true,
      },
      (instance, input) => {
        // Carrega as coordenadas salvas quando o input é criado
        const savedCoords = loadLastCoordinates();
        if (savedCoords && savedCoords[0] !== undefined) {
          input.value = savedCoords[0];
        }
      }
    )
    .buildElement()
    .addInput(
      {
        type: 'number',
        id: 'bm-input-ty',
        placeholder: 'Tl Y',
        min: 0,
        max: 2047,
        step: 1,
        required: true,
      },
      (instance, input) => {
        // Carrega as coordenadas salvas quando o input é criado
        const savedCoords = loadLastCoordinates();
        if (savedCoords && savedCoords[1] !== undefined) {
          input.value = savedCoords[1];
        }
      }
    )
    .buildElement()
    .addInput(
      {
        type: 'number',
        id: 'bm-input-px',
        placeholder: 'Px X',
        min: 0,
        max: 2047,
        step: 1,
        required: true,
      },
      (instance, input) => {
        // Carrega as coordenadas salvas quando o input é criado
        const savedCoords = loadLastCoordinates();
        if (savedCoords && savedCoords[2] !== undefined) {
          input.value = savedCoords[2];
        }
      }
    )
    .buildElement()
    .addInput(
      {
        type: 'number',
        id: 'bm-input-py',
        placeholder: 'Px Y',
        min: 0,
        max: 2047,
        step: 1,
        required: true,
      },
      (instance, input) => {
        // Carrega as coordenadas salvas quando o input é criado
        const savedCoords = loadLastCoordinates();
        if (savedCoords && savedCoords[3] !== undefined) {
          input.value = savedCoords[3];
        }
      }
    )
    .buildElement()
    .buildElement()
    .addInputFile(
      {
        id: 'bm-input-file-template',
        textContent: 'Upload Template',
        accept: 'image/png, image/jpeg, image/webp, image/bmp, image/gif',
      },
      async (instance, container, input, button) => {
        // Carrega a última imagem salva quando o input é criado
        try {
          const savedTemplate = await loadLastTemplate();
          if (savedTemplate) {
            // Cria um novo FileList com o arquivo salvo
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(savedTemplate);
            input.files = dataTransfer.files;

            // Atualiza o texto do botão
            button.style.maxWidth = `${button.offsetWidth}px`;
            button.textContent = savedTemplate.name;

            // Adiciona um indicador visual de que foi carregado do cache
            const cacheIndicator = document.createElement('span');
            cacheIndicator.textContent = ' 💾';
            cacheIndicator.title = 'Carregado do cache';
            cacheIndicator.style.cssText = 'opacity: 0.7; font-size: 0.8em;';
            button.appendChild(cacheIndicator);

            instance.handleDisplayStatus(
              `Template "${savedTemplate.name}" carregado do cache!`
            );
          }
        } catch (error) {
          consoleWarn('Erro ao carregar template do cache:', error);
        }
      }
    )
    .buildElement()
    .addDiv({ id: 'bm-contain-buttons-template' })
    .addButton(
      { id: 'bm-button-enable', textContent: 'Enable' },
      (instance, button) => {
        button.onclick = () => {
          const input = document.querySelector('#bm-input-file-template');

          const coordTlX = document.querySelector('#bm-input-tx');
          if (!coordTlX.checkValidity()) {
            coordTlX.reportValidity();
            instance.handleDisplayError(
              'Coordinates are malformed! Did you try clicking on the canvas first?'
            );
            return;
          }
          const coordTlY = document.querySelector('#bm-input-ty');
          if (!coordTlY.checkValidity()) {
            coordTlY.reportValidity();
            instance.handleDisplayError(
              'Coordinates are malformed! Did you try clicking on the canvas first?'
            );
            return;
          }
          const coordPxX = document.querySelector('#bm-input-px');
          if (!coordPxX.checkValidity()) {
            coordPxX.reportValidity();
            instance.handleDisplayError(
              'Coordinates are malformed! Did you try clicking on the canvas first?'
            );
            return;
          }
          const coordPxY = document.querySelector('#bm-input-py');
          if (!coordPxY.checkValidity()) {
            coordPxY.reportValidity();
            instance.handleDisplayError(
              'Coordinates are malformed! Did you try clicking on the canvas first?'
            );
            return;
          }

          // Kills itself if there is no file
          if (!input?.files[0]) {
            instance.handleDisplayError(`No file selected!`);
            return;
          }

          const coords = [
            Number(coordTlX.value),
            Number(coordTlY.value),
            Number(coordPxX.value),
            Number(coordPxY.value),
          ];

          // Salva as coordenadas e o template no cache quando o template é habilitado
          saveLastCoordinates(coords);
          saveLastTemplate(
            input.files[0],
            input.files[0]?.name.replace(/\.[^/.]+$/, '')
          );

          templateManager.createTemplate(
            input.files[0],
            input.files[0]?.name.replace(/\.[^/.]+$/, ''),
            coords
          );

          // console.log(`TCoords: ${apiManager.templateCoordsTilePixel}\nCoords: ${apiManager.coordsTilePixel}`);
          // apiManager.templateCoordsTilePixel = apiManager.coordsTilePixel; // Update template coords
          // console.log(`TCoords: ${apiManager.templateCoordsTilePixel}\nCoords: ${apiManager.coordsTilePixel}`);
          // templateManager.setTemplateImage(input.files[0]);

          instance.handleDisplayStatus(`Drew to canvas!`);
        };
      }
    )
    .buildElement()
    .addButton(
      { id: 'bm-button-disable', textContent: 'Disable' },
      (instance, button) => {
        button.onclick = () => {
          // Remove template overlay
          templateManager.disableTemplate();

          // Clear stats display
          const statsContainer = document.getElementById('bm-contain-stats');
          if (statsContainer) {
            statsContainer.style.display = 'none';
          }

          instance.handleDisplayStatus('Template disabled!');
        };
      }
    )
    .buildElement()
    .buildElement()
    .addDiv({ id: 'bm-contain-stats', style: 'display: none;' })
    .addHeader(3, { textContent: 'Template Statistics' })
    .buildElement()
    .addP({ id: 'bm-stats-total', textContent: 'Total pixels: 0' })
    .buildElement()
    .addP({ id: 'bm-stats-painted', textContent: 'Painted: 0 (0%)' })
    .buildElement()
    .addP({ id: 'bm-stats-missing', textContent: 'Missing: 0 (0%)' })
    .buildElement()
    .addButton(
      {
        id: 'bm-button-recalculate',
        textContent: 'Recalcular',
        style: 'margin-top: 5px; font-size: 11px; padding: 3px 8px;',
      },
      (builder, element) => {
        element.onclick = () => {
          templateManager.forceRecalculation();
        };
      }
    )
    .buildElement()
    .addButton(
      {
        id: 'bm-show-details',
        textContent: 'Detalhes',
        style: 'margin-top: 10px;',
      },
      (builder, element) => {
        element.onclick = () => {
          templateManager.toggleColorDetails();
        };
      }
    )
    .buildElement()
    .addDiv({
      id: 'bm-colors-container',
      style: 'display: none; margin-top: 15px;',
    })
    .addDiv({
      style:
        'display: flex; justify-content: space-between; align-items: center;',
    })
    .addHeader(4, { textContent: 'Colors to Paint' })
    .buildElement()
    .addButton(
      {
        id: 'bm-show-all-colors',
        textContent: 'Show All',
        style: 'font-size: 10px; padding: 4px 8px; margin-left: 10px;',
      },
      (builder, element) => {
        element.onclick = () => {
          templateManager.showAllColors();
        };
      }
    )
    .buildElement()
    .buildElement()
    .addDiv({
      id: 'bm-colors-grid',
      style:
        'display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin-top: 10px; max-height: 300px; overflow-y: auto; padding-right: 5px;',
    })
    .buildElement()
    .buildElement()
    .buildElement()
    .addTextarea({
      id: overlay.outputStatusId,
      placeholder: `Status: Sleeping...\nVersion: ${version}`,
      readOnly: true,
    })
    .buildElement()
    .addDiv({ id: 'bm-contain-buttons-action' })
    .addDiv()
    .addButton(
      {
        id: 'bm-button-toggle-visibility',
        className: 'bm-help',
        innerHTML: '👁',
        title: 'Hide/Show Blue Marble',
      },
      (instance, button) => {
        button.addEventListener('click', () => {
          const overlay = document.getElementById('bm-overlay');
          if (overlay) {
            if (overlay.style.display === 'none') {
              overlay.style.display = 'block';
              button.innerHTML = '👁';
              button.title = 'Hide Blue Marble';
              instance.handleDisplayStatus('Blue Marble shown!');
              // Remove o botão de restore se existir
              const restoreButton =
                document.getElementById('bm-restore-button');
              if (restoreButton) {
                restoreButton.remove();
              }
            } else {
              overlay.style.display = 'none';
              button.innerHTML = '🙈';
              button.title = 'Show Blue Marble';
              // Criar botão de restore quando ocultar
              createRestoreButton();
            }
          }
        });
      }
    )
    .buildElement()
    // .addButton({'id': 'bm-button-teleport', 'className': 'bm-help', 'textContent': '✈'}).buildElement()
    // .addButton({'id': 'bm-button-favorite', 'className': 'bm-help', 'innerHTML': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><polygon points="10,2 12,7.5 18,7.5 13.5,11.5 15.5,18 10,14 4.5,18 6.5,11.5 2,7.5 8,7.5" fill="white"></polygon></svg>'}).buildElement()
    // .addButton({'id': 'bm-button-templates', 'className': 'bm-help', 'innerHTML': '🖌'}).buildElement()
    .addButton(
      {
        id: 'bm-button-convert',
        className: 'bm-help',
        innerHTML: '🎨',
        title: 'Template Color Converter',
      },
      (instance, button) => {
        button.addEventListener('click', () => {
          window.open(
            'https://pepoafonso.github.io/color_converter_wplace/',
            '_blank',
            'noopener noreferrer'
          );
        });
      }
    )
    .buildElement()
    .buildElement()
    .addSmall({
      textContent: 'Made by CpdnCristiano',
      style: 'margin-top: auto;',
    })
    .buildElement()
    .buildElement()
    .buildElement()
    .buildOverlay(document.body);
}
