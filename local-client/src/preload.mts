import { contextBridge, ipcRenderer } from 'electron';
import { conf_t } from "./main.js";
import { enable_server, disable_server } from './backend.js';

contextBridge.exposeInMainWorld('electronAPI', {
    get_conf: (): Promise<conf_t> => ipcRenderer.invoke('dialog:get_conf'),
    set_conf: (conf: conf_t): Promise<void> => ipcRenderer.invoke('dialog:set_conf', conf),
    enable_server: (): Promise<void> => ipcRenderer.invoke('dialog:enable_server'),
    disable_server: (): Promise<void> => ipcRenderer.invoke('dialog:disable_server'),
    get_local_status: (): Promise<boolean> => ipcRenderer.invoke('dialog:get_local_status'),
});