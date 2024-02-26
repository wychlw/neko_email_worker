import { pop3_server, pop3_config } from "./pop3.js";
import { SMTPServer, SMTPServerOptions } from "smtp-server";
import parser from "./parser.js";
import { find_user, auth_user, query_mail_meta, query_mail, delete_mail, send_mail } from "./handeler.js";


const email_parser = new parser.email_parser();

var pop3: pop3_server | null = null;
var smtp: SMTPServer | null = null;

export async function enable_server(server: string, host: string, pop3_port: number, smtp_port: number): Promise<void> {
    await disable_server();

    const pop3_server_conf: pop3_config = {
        onFindUser: (username) => find_user(server, username),
        onAuth: (username, password) => auth_user(server, username, password),
        onStat: async (token) => {
            const data = await query_mail_meta(server, token);
            return [data.num, data.size];
        },
        onList: async (token) => {
            const data = await query_mail_meta(server, token);
            return data.mails;
        },
        onRetr: (token, id) => query_mail(server, token, id),
        onQuit: async (token, dele) => {
            const arr = Array.from(dele);
            for (const id of arr) {
                try {
                    await delete_mail(server, token, id);
                }
                catch (e) {
                    console.log(e);
                }
            }
        }
    };

    const smtp_server_conf: SMTPServerOptions = {
        authOptional: true,
        authMethods: ['PLAIN', 'LOGIN', 'XOAUTH2'],
        disabledCommands: ['STARTTLS'],
        onAuth: (auth, session, callback) => {
            if (!auth.username || !auth.password) {
                callback(new Error("Invalid credentials"));
                return;
            }
            auth_user(server, auth.username, auth.password).then((token) => {
                callback(null, { user: token });
            }).catch((e) => {
                callback(e);
            });
        },
        onData: (stream, session, callback) => {
            stream.on("data", (chunk) => {
                const parsed = email_parser.parse(chunk);
                parsed.then((email) => {
                    if (!email.from || !email.to) {
                        callback(new Error("Invalid email"));
                    }
                    const from = email.from!.value[0].address!;
                    let to: string[] = [];
                    if (Array.isArray(email.to)) {
                        for (const t of email.to) {
                            to.push(t.value[0].address!);
                        }
                    }
                    else {
                        to.push(email.to!.value[0].address!);
                    }
                    const content_bs64 = Buffer.from(chunk).toString("base64");
                    const data = {
                        from: from,
                        to: to,
                        content: content_bs64
                    };
                    console.log(data);
                    return send_mail(server, session.user!, data);
                }).then(() => {
                    callback(null);
                }).catch((e: any) => {
                    callback(e);
                });
            });

        }
    };

    pop3 = new pop3_server(pop3_server_conf);
    smtp = new SMTPServer(smtp_server_conf);

    smtp.on("error", (e) => {
        console.log(e);
    });
    console.log("Remote server at", server);
    pop3.listen(pop3_port, host);
    smtp.listen(smtp_port, host, () => {
        console.log("SMTP server listening on port", smtp_port, " at ", host);
    });
}

export async function disable_server(): Promise<void> {
    if (pop3) {
        pop3.close();
        pop3 = null;
    }
    if (smtp) {
        smtp.close();
        smtp = null;
    }
}

export function is_server_enabled(): boolean {
    return pop3 != null && smtp != null;
}
