import net from "net";

interface mail_meta { id: number, size: number };
export interface mail extends mail_meta { data: Buffer };

export interface pop3_config {
    onFindUser?: (name: string) => Promise<void>,
    onAuth?: (name: string, password: string) => Promise<string>,
    onStat?: (token: string) => Promise<[number, number]>,
    /**
     * @param name username
     * @param id the id of the message, if not provided, return all messages
     *          if provided, return zero(if not exist) or one message
     * @returns 
     */
    onList?: (token: string) => Promise<mail_meta[]>,
    onRetr?: (token: string, id: number) => Promise<mail>,
    onQuit?: (token: string, dele: Set<number>) => Promise<void>,
}

export interface pop3_info {
    username?: string,
    password?: string,
    token?: string,
    state: "estab" | "authorization" | "transaction" | "update" | "quit",
    dele: Set<number>,
    last: number,
}


export class pop3_server {

    conf: pop3_config
    server?: net.Server

    constructor(config: pop3_config) {
        this.conf = config;
    }

    async doAgreement(socket: net.Socket): Promise<pop3_info> {
        socket.write("+OK local POP3 server ready (dev: Ling Wang, ver: v0.0.1 )\r\n");
        return {
            state: "estab",
            dele: new Set(),
            last: 0,
        };
    }

    async doUser(info: pop3_info, socket: net.Socket, username: string): Promise<pop3_info> {
        info.username = username;

        if (info.state != "authorization") {
            socket.write("-ERR bad state\r\n");
            return info;
        }

        if (!this.conf.onFindUser) {
            socket.write("+OK no user find needed\r\n");
            return info;
        }

        try {
            await this.conf.onFindUser(username);
        } catch (e) {
            socket.write("-ERR no such user\r\n");
            return info;
        }

        socket.write("+OK user find\r\n");
        return info;
    }

    async doPass(info: pop3_info, socket: net.Socket, password: string): Promise<pop3_info> {
        info.password = password;

        if (!info.username) {
            socket.write("-ERR no username\r\n");
            return info;
        }

        if (info.state != "authorization") {
            socket.write("-ERR bad state\r\n");
            return info;
        }

        if (!this.conf.onAuth) {
            socket.write("+OK no auth needed\r\n");
            info.state = "transaction";
            return info;
        }

        try {
            info.token = await this.conf.onAuth(info.username!, info.password!);
        } catch (e) {
            socket.write("-ERR auth failed\r\n");
            return info;
        }

        socket.write("+OK auth success\r\n");
        info.state = "transaction";
        return info;
    }

    async doQuit(info: pop3_info, socket: net.Socket): Promise<pop3_info> {
        if (info.state == "authorization") {
            socket.write("+OK bye\r\n");
            info.state = "quit";
            return info;
        }

        if (info.state == "transaction") {
            socket.write("+OK sign off\r\n");
            info.state = "update";
            if (this.conf.onQuit) {
                this.conf.onQuit(info.token!, info.dele);
            }
            info.state = "quit";
            return info;
        }

        return info;
    }

    async doStat(info: pop3_info, socket: net.Socket): Promise<pop3_info> {
        if (info.state != "transaction") {
            socket.write("-ERR bad state\r\n");
            return info;
        }

        if (!this.conf.onStat) {
            socket.write("+OK 0 0\r\n");
            info.last = Math.max(info.last, 1);
            return info;
        }

        const [count, size] = await this.conf.onStat(info.token!);
        socket.write("+OK " + count + " " + size + "\r\n");
        info.last = Math.max(info.last, 1);
        return info;
    }

    async doList(info: pop3_info, socket: net.Socket, id?: number): Promise<pop3_info> {
        if (info.state != "transaction") {
            socket.write("-ERR bad state\r\n");
            return info;
        }

        if (!this.conf.onList) {
            if (id) {
                socket.write("-ERR no such message\r\n");
                return info;
            }
            socket.write("+OK 0 messages (0 octets)\r\n");
            socket.write(".\r\n");
            info.last = Math.max(info.last, 1);
            return info;
        }

        const list = await this.conf.onList(info.token!);

        if (id) {
            if (info.dele.has(id)) {
                socket.write("-ERR no such message\r\n");
                return info;
            }
            for (const mail_info of list) {
                if (mail_info.id != id) {
                    continue;
                }
                socket.write("+OK " + mail_info.id + " " + mail_info.size + "\r\n");
                info.last = Math.max(info.last, mail_info.id);
                return info;
            }

            socket.write("-ERR no such message\r\n");
            return info;
        }
        var tot_size = 0;
        for (const mail_info of list) {
            if (info.dele.has(mail_info.id)) {
                continue;
            }
            tot_size += mail_info.size;
        }
        socket.write("+OK " + list.length + " messages (" + tot_size + " octets)\r\n");
        for (const mail_info of list) {
            if (info.dele.has(mail_info.id)) {
                continue;
            }
            socket.write(mail_info.id + " " + mail_info.size + "\r\n");
        }
        socket.write(".\r\n");
        info.last = Math.max(info.last, 1);
        return info;
    }

    async doRetr(info: pop3_info, socket: net.Socket, id: number): Promise<pop3_info> {
        if (info.state != "transaction") {
            socket.write("-ERR bad state\r\n");
            return info;
        }

        if (!this.conf.onList || !this.conf.onRetr) {
            socket.write("-ERR no such message\r\n");
            return info;
        }

        if (info.dele.has(id)) {
            socket.write("-ERR no such message\r\n");
            return info;
        }

        try {
            const data = await this.conf.onRetr(info.token!, id);
            socket.write("+OK " + data.size + " octets\r\n");

            socket.write(data.data);
            socket.write(".\r\n");
            info.last = Math.max(info.last, id);
            return info;
        }
        catch (e) {
            socket.write("-ERR no such message\r\n");
            return info;
        }
    }

    async doDele(info: pop3_info, socket: net.Socket, id: number): Promise<pop3_info> {
        if (info.state != "transaction") {
            socket.write("-ERR bad state\r\n");
            return info;
        }

        if (!this.conf.onList) {
            socket.write("-ERR no such message\r\n");
            return info;
        }

        if (info.dele.has(id)) {
            socket.write("-ERR message already deleted\r\n");
            return info;
        }

        const list = await this.conf.onList(info.token!);

        let found = false;
        for (const mail_info of list) {
            if (mail_info.id != id) {
                continue;
            }
            found = true;
            break;
        }
        if (!found) {
            socket.write("-ERR message already deleted\r\n");
            return info;
        }

        info.dele.add(id);

        socket.write("+OK message deleted\r\n");
        info.last = Math.max(info.last, id);
        return info;
    }

    async doNoop(info: pop3_info, socket: net.Socket): Promise<pop3_info> {
        if (info.state != "transaction") {
            socket.write("-ERR bad state\r\n");
            return info;
        }

        socket.write("+OK\r\n");
        return info;
    }

    async doLast(info: pop3_info, socket: net.Socket): Promise<pop3_info> {
        if (info.state != "transaction") {
            socket.write("-ERR bad state\r\n");
            return info;
        }

        socket.write("+OK " + info.last + " messages\r\n");
        return info;
    }

    async doRset(info: pop3_info, socket: net.Socket): Promise<pop3_info> {
        if (info.state != "transaction") {
            socket.write("-ERR bad state\r\n");
            return info;
        }

        info.dele.clear();
        info.last = 1;
        socket.write("+OK\r\n");
        return info;
    }

    async doCapa(info: pop3_info, socket: net.Socket): Promise<pop3_info> {
        socket.write("+OK Capability list follows\r\n");
        socket.write("USER\r\n");
        socket.write("IMPLEMENTATION Ling Wang\r\n");
        socket.write(".\r\n");
        return info;
    }

    async handelCommand(info: pop3_info, socket: net.Socket, data: Buffer): Promise<pop3_info> {
        if (info.state == "estab") {
            // if you wonder why this is needed...
            // some client (like microsoft!) will send 
            // some garbage and break the whole thing in
            // the first connection...
            // I don't know why, this is too dumb though...
            if (!((data[0] >= 0x41 && data[0] <= 0x5a) || (data[0] >= 0x61 && data[0] <= 0x7a))) {
                info.state = "quit";
                return info;
            }
            info.state = "authorization";
            // return info;
        }
        const str = data.toString();
        console.log("str: " + str);
        let [cmd, ...args] = str.split(/\r\n|\r|\n| |\t/);
        cmd = cmd.trim();
        console.log("cmd: " + cmd);
        if (cmd == "CAPA") {
            return this.doCapa(info, socket);
        }
        if (cmd == "USER") {
            return this.doUser(info, socket, args[0]);
        }
        if (cmd == "PASS") {
            return this.doPass(info, socket, args[0]);
        }
        if (cmd == "QUIT") {
            return this.doQuit(info, socket);
        }
        if (cmd == "STAT") {
            return this.doStat(info, socket);
        }
        if (cmd == "LIST") {
            return this.doList(info, socket, args.length > 0 ? parseInt(args[0]) : undefined);
        }
        if (cmd == "RETR") {
            return this.doRetr(info, socket, parseInt(args[0]));
        }
        if (cmd == "DELE") {
            return this.doDele(info, socket, parseInt(args[0]));
        }
        if (cmd == "NOOP") {
            return this.doNoop(info, socket);
        }
        if (cmd == "LAST") {
            return this.doLast(info, socket);
        }
        if (cmd == "RSET") {
            return this.doRset(info, socket);
        }
        socket.write("-ERR unknown command\r\n");
        return info;
    }

    listen(port: number, host?: string) {

        this.server = net.createServer((socket) => {
            var info: pop3_info;
            this.doAgreement(socket).then((i) => {
                info = i;
                console.log("new connection");
                socket.on("error", (err) => {
                    console.log("socket error: " + err);
                });
                socket.on("data", (data) => {
                    this.handelCommand(info, socket, data).then((i) => {
                        info = i;
                        if (info.state == "quit") {
                            socket.end();
                        }
                    });
                });
            });
        });

        this.server.on("error", (err) => {
            console.log("server error: " + err);
        });
        console.log("POP3 server listening on port", port, " at ", host);
        this.server.listen(port, host);
    }
}

export default { pop3_server };