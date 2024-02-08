import pop3 from "./pop3.js";
import smtp from "smtp-server";
import parser from "./parser.js";
import fs from "fs/promises";


import { find_user, auth_user, query_mail_meta, query_mail, delete_mail, send_mail } from "./handeler.js";

interface conf_t {
    server: string;
    host: string;
    smtp_port: number;
    pop3_port: number;
};

var conf: conf_t;

fs.readFile("conf.json", "utf-8").then((file) => {
    conf = JSON.parse(file);

    const email_parser = new parser.email_parser();

    const pop3_server = new pop3.pop3_server({
        onFindUser: (username) => find_user(conf.server, username),
        onAuth: (username, password) => auth_user(conf.server, username, password),
        onStat: async (token) => {
            const data = await query_mail_meta(conf.server, token);
            return [data.num, data.size];
        },
        onList: async (token) => {
            const data = await query_mail_meta(conf.server, token);
            return data.mails;
        },
        onRetr: (token, id) => query_mail(conf.server, token, id),
        onQuit: async (token, dele) => {
            for (const id of dele) {
                try {
                    await delete_mail(conf.server, token, id);
                }
                catch (e) {
                    console.log(e);
                }
            }
        }
    });

    const smtp_server = new smtp.SMTPServer({
        authOptional: true,
        authMethods: ['PLAIN', 'LOGIN', 'XOAUTH2'],
        disabledCommands: ['STARTTLS'],
        onAuth: (auth, session, callback) => {
            if (!auth.username || !auth.password) {
                callback(new Error("Invalid credentials"));
                return;
            }
            auth_user(conf.server, auth.username, auth.password).then((token) => {
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
                    return send_mail(conf.server, session.user!, data);
                }).then(() => {
                    callback(null);
                }).catch((e) => {
                    callback(e);
                });
            });

        }
    });
    smtp_server.on("error", (e) => {
        console.log(e);
    });

    console.log("Remote server at", conf.server);

    pop3_server.listen(conf.pop3_port, conf.host);

    smtp_server.listen(conf.smtp_port, conf.host, () => {
        console.log("SMTP server listening on port", conf.smtp_port, " at ", conf.host);
    });

}).catch((e) => {
    console.log(e);
});

