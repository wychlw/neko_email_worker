import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
import electron from "electron";
import { enable_server, disable_server, is_server_enabled } from "./backend.js";
const { app, BrowserWindow, Menu, Tray, ipcMain, dialog } = electron;


export interface conf_t {
    server: string;
    host: string;
    smtp_port: number;
    pop3_port: number;
    default_enable_server: boolean;
    default_show_window: boolean;
};

async function load_conf(): Promise<conf_t> {
    const conf_template: conf_t = {
        server: "http://localhost:8080",
        host: "localhost",
        smtp_port: 25,
        pop3_port: 110,
        default_enable_server: true,
        default_show_window: true,
    };
    // check if conf.json exists
    try {
        await fs.access("conf.json");
    } catch (e) {
        console.warn("conf.json not found");
        // if not, create it

        const file = JSON.stringify(conf_template);
        await fs.writeFile("conf.json", file, "utf-8");
    }

    const file = await fs.readFile("conf.json", "utf-8");
    const data = JSON.parse(file);

    // check if the file is valid, check key by key
    let conf: any = conf_template;
    for (const [key, template_value] of Object.entries(conf_template)) {
        if (key in data) {
            conf[key] = data[key];
        } else {
            console.warn(`conf.json missing key ${key}, using default value ${template_value}`);
        }
    }
    return conf as conf_t;
}

async function save_conf(conf: conf_t): Promise<void> {
    const file = JSON.stringify(conf);
    await fs.writeFile("conf.json", file, "utf-8");
}

var win: electron.BrowserWindow | null = null;
async function create_window() {
    if (win != null) {
        win.focus();
        return;
    }

    win = new BrowserWindow({
        width: 1200,
        height: 600,
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: true,
            preload: path.join(__dirname, 'preload.mjs'),
        },
    });

    win.loadFile(path.join(__dirname, '..', 'assets', 'index.html'));
    win.webContents.openDevTools();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            create_window();
        }
    });

    app.on('window-all-closed', () => {
        if (process.platform !== 'darwin') {
            destroy_window();
        }
    });
}

async function destroy_window() {
    if (win != null) {
        win.destroy();
        win = null;
    }
}

var app_tray: electron.Tray | null = null;
async function enable_tray() {
    if (app_tray != null) {
        return;
    }
    const tray_menu: (electron.MenuItemConstructorOptions | electron.MenuItem)[] = [
        {
            label: "Show",
            click: () => {
                create_window();
            }
        }, {
            label: "Exit",
            click: () => {
                app.quit();
            }
        }
    ];
    const icon_path = path.join(__dirname, '..', 'assets', 'email.png');
    app_tray = new Tray(icon_path);
    const context_menu = Menu.buildFromTemplate(tray_menu);
    app_tray.setToolTip("Neko Email Worker");
    app_tray.setContextMenu(context_menu);
    app_tray.on("click", () => {
        create_window();
    });
}

async function handel_get_conf(): Promise<conf_t> {
    const conf = await load_conf();
    return conf;
}

async function handel_set_conf(event: electron.IpcMainInvokeEvent, conf: conf_t): Promise<void> {
    await save_conf(conf);
}

async function handel_enable_server(event: electron.IpcMainInvokeEvent): Promise<void> {
    const conf = await load_conf();
    await enable_server(conf.server, conf.host, conf.pop3_port, conf.smtp_port);
}

async function handel_disable_server(event: electron.IpcMainInvokeEvent): Promise<void> {
    await disable_server();
}

async function handel_get_local_status(event: electron.IpcMainInvokeEvent): Promise<boolean> {
    return is_server_enabled();
}

async function main() {
    await app.whenReady();
    let conf: conf_t = await load_conf();

    enable_tray();

    if (conf.default_enable_server) {
        await enable_server(conf.server, conf.host, conf.pop3_port, conf.smtp_port);
    }

    ipcMain.handle("dialog:get_conf", handel_get_conf);
    ipcMain.handle("dialog:set_conf", handel_set_conf);
    ipcMain.handle("dialog:enable_server", handel_enable_server);
    ipcMain.handle("dialog:disable_server", handel_disable_server);
    ipcMain.handle("dialog:get_local_status", handel_get_local_status);
    ipcMain.on('set-title', handel_set_conf);

    if (conf.default_show_window) {
        create_window();
    }
}

main().catch((e) => {
    console.error(e);
});