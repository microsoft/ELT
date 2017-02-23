import * as electron from 'electron';

// Module to control application life.
const app = electron.app;

interface ExpectedEnv {
    NODE_ENV: string;
}

const debugging = process.argv.some(a => a === '--debugging');
if (!debugging) { (<ExpectedEnv>process.env).NODE_ENV = 'production'; }
(global as any).debugging = debugging;

// Module to create native browser window.
const window = electron.BrowserWindow;

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow = null;

function createWindow(): void {
    // Create the browser window.
    mainWindow = new window({
        width: 1200,
        height: 800,
        webPreferences: {
            // overlayScrollbars: true
        }
    });

    if (!debugging) {
        mainWindow.setMenu(null);
    }

    // and load the index.html of the app.
    mainWindow.loadURL('file://' + __dirname + '/index.html');
    (global as any).rootDir = __dirname;

    // To open the DevTools at the beginning, comment in the following call:
    // mainWindow.webContents.openDevTools();

    // Emitted when the window is closed.
    mainWindow.on('closed', () => {
        // Dereference the window object, usually you would store windows
        // in an array if your app supports multi windows, this is the time
        // when you should delete the corresponding element.
        mainWindow = null;
    });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.on('ready', createWindow);

// Quit when all windows are closed.
app.on('window-all-closed', () => {
    // On OS X it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (mainWindow === null) {
        createWindow();
    }
});
