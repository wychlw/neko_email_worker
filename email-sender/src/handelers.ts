import { EmailMessage } from "cloudflare:email";
import { Env } from ".";
import { database } from "./database";
import { Buffer } from "node:buffer";
import user from "./user";
import { add_new_email_sender, remove_email_sender } from "./change_env";

interface resp_t {
    stat: number;
    token: string;
    data: any;
};

const resp_200: resp_t = {
    stat: 200,
    token: "",
    data: ""
};

const resp_401: resp_t = {
    stat: 401,
    token: "",
    data: ""
};

const resp_403: resp_t = {
    stat: 403,
    token: "",
    data: ""
};

const resp_404: resp_t = {
    stat: 404,
    token: "",
    data: ""
};

const resp_406: resp_t = {
    stat: 406,
    token: "",
    data: ""
};

const resp_409: resp_t = {
    stat: 409,
    token: "",
    data: ""
};

const resp_500: resp_t = {
    stat: 500,
    token: "",
    data: ""
};

export async function find_user(request: Request, env: Env, ctx: ExecutionContext, db: database): Promise<Response> {
    const path = new URL(request.url).pathname.split("/");
    const method = request.method;

    if (method != "GET" || path[2] != "users" || path.length != 4) {
        throw new Error("Wrong handeler.");
    }

    const username = path[3];
    return user.find_user(username, db).then(() => {
        return new Response(JSON.stringify(resp_200), { status: 200 });
    }).catch((err) => {
        return new Response(JSON.stringify(resp_404), { status: 404 });
    });
}

export async function auth_user(request: Request, env: Env, ctx: ExecutionContext, db: database): Promise<Response> {
    const path = new URL(request.url).pathname.split("/");
    const method = request.method;

    if (method != "GET" || path[2] != "users" || path.length != 5 || path[4] != "password") {
        throw new Error("Wrong handeler.");
    }

    const username = path[3];
    const password = request.headers.get("Password");

    if (!password) {
        return new Response(JSON.stringify(resp_401), { status: 401 });
    }

    return user.auth_user(username, password, db).then((token) => {
        const resp: resp_t = {
            stat: 200,
            token: token,
            data: ""
        };
        return new Response(JSON.stringify(resp), { status: 200 });
    }).catch((err) => {
        return new Response(JSON.stringify(resp_401), { status: 401 });
    });
}

export async function insert_user(request: Request, env: Env, ctx: ExecutionContext, db: database): Promise<Response> {
    const path = new URL(request.url).pathname.split("/");
    const method = request.method;

    if (method != "POST" || path[2] != "users" || path.length != 5 || path[4] != "password") {
        throw new Error("Wrong handeler.");
    }

    const new_username = path[3];
    const new_password = request.headers.get("Password");

    if (!new_password) {
        return new Response(JSON.stringify(resp_401), { status: 401 });
    }

    const is_admin = request.headers.get("Admin") == "1" ? true : false;
    const admin_token = request.headers.get("Token");

    if (!admin_token) {
        return new Response(JSON.stringify(resp_401), { status: 401 });
    }

    const admin_meta = await db.query_meta(admin_token);
    if (!admin_meta) {
        return new Response(JSON.stringify(resp_401), { status: 401 });
    }
    if (admin_meta.is_admin == false) {
        return new Response(JSON.stringify(resp_403), { status: 403 });
    }

    const exist = await db.query_user(new_username);
    if (exist) {
        return new Response(JSON.stringify(resp_409), { status: 409 });
    }

    // await add_new_email_sender(env, ctx, { name: new_username, type: "send_email" });

    return db.insert_user(new_username, new_password, is_admin).then(() => {
        return new Response(JSON.stringify(resp_200), { status: 200 });
    }).catch((err) => {
        return new Response(JSON.stringify(resp_401), { status: 401 });
    });
}

export async function update_user(request: Request, env: Env, ctx: ExecutionContext, db: database): Promise<Response> {
    const path = new URL(request.url).pathname.split("/");
    const method = request.method;

    if (method != "PUT" || path[2] != "users" || path.length != 5 || path[4] != "password") {
        throw new Error("Wrong handeler.");
    }

    const username = path[3];
    const old_password = request.headers.get("Oldpass");
    const new_password = request.headers.get("Newpass");
    const token = request.headers.get("Token");
    const is_admin = request.headers.get("Admin");

    if (!old_password && !token) {
        return new Response(JSON.stringify(resp_401), { status: 401 });
    }

    const old_user = await db.query_user(username);
    if (!old_user) {
        return new Response(JSON.stringify(resp_404), { status: 404 });
    }

    let admin_priv = false;
    if (token) {
        const meta = await db.query_meta(token);
        if (meta) {
            admin_priv ||= meta.is_admin;
        }
    }
    {
        const meta = await db.query_meta(old_user.token);
        if (meta) {
            admin_priv ||= meta.is_admin;
        }
    }

    if (admin_priv == false && is_admin) {
        return new Response(JSON.stringify(resp_403), { status: 403 });
    }

    let priv = admin_priv || (old_user.password == old_password);

    if (!admin_priv && !priv) {
        return new Response(JSON.stringify(resp_403), { status: 403 });
    }

    if (new_password && is_admin) {
        return db.update_user(username, new_password, is_admin == "1").then(() => {
            return new Response(JSON.stringify(resp_200), { status: 200 });
        }).catch((err) => {
            return new Response(JSON.stringify(resp_401), { status: 401 });
        });
    }
    else if (new_password) {
        return db.update_user(username, new_password).then(() => {
            return new Response(JSON.stringify(resp_200), { status: 200 });
        }).catch((err) => {
            return new Response(JSON.stringify(resp_401), { status: 401 });
        });
    }
    else if (is_admin) {
        return db.update_user(username, undefined, is_admin == "1").then(() => {
            return new Response(JSON.stringify(resp_200), { status: 200 });
        }).catch((err) => {
            return new Response(JSON.stringify(resp_401), { status: 401 });
        });
    }
    else {
        const resp: resp_t = {
            stat: 200,
            token: "",
            data: ""
        };
        return new Response(JSON.stringify(resp), { status: 200 });
    }
}

export async function delete_user(request: Request, env: Env, ctx: ExecutionContext, db: database): Promise<Response> {
    const path = new URL(request.url).pathname.split("/");
    const method = request.method;

    if (method != "DELETE" || path[2] != "users" || path.length != 5) {
        throw new Error("Wrong handeler.");
    }

    const username = path[3];
    const token = request.headers.get("Token");
    const password = request.headers.get("Password");

    if (!token || !password) {
        return new Response(JSON.stringify(resp_401), { status: 401 });
    }

    let priv = false;

    const user = await db.query_user(username);
    if (!user) {
        return new Response(JSON.stringify(resp_404), { status: 404 });
    }

    if (password) {
        priv ||= (user.password == password);
    }

    if (token) {
        const meta = await db.query_meta(token);
        if (meta) {
            priv ||= meta.is_admin;
        }
    }

    if (!priv) {
        return new Response(JSON.stringify(resp_403), { status: 403 });
    }

    // await remove_email_sender(env, ctx, { name: username, type: "send_email" });

    return db.delete_user(username, user.token).then(() => {
        return new Response(JSON.stringify(resp_200), { status: 200 });
    }).catch((err) => {
        return new Response(JSON.stringify(resp_500), { status: 500 });
    });
}

export async function query_mail_meta(request: Request, env: Env, ctx: ExecutionContext, db: database): Promise<Response> {
    const path = new URL(request.url).pathname.split("/");
    const method = request.method;

    if (method != "GET" || path[2] != "mail" || path.length != 3) {
        throw new Error("Wrong handeler.");
    }

    const token = request.headers.get("Token");
    if (!token) {
        return new Response(JSON.stringify(resp_401), { status: 401 });
    }

    const meta = await db.query_meta(token);
    if (!meta) {
        return new Response(JSON.stringify(resp_404), { status: 404 });
    }

    const mail_meta = await db.query_mail_meta(token);
    const data = mail_meta.map((mail) => {
        return {
            id: mail.mail_id,
            size: mail.mail_size
        };
    });

    const resp: resp_t = {
        stat: 200,
        token: "",
        data: {
            num: meta.mail_num,
            size: meta.mail_size,
            mails: data
        }
    };
    return new Response(JSON.stringify(resp), { status: 200 });
}

export async function query_mail(request: Request, env: Env, ctx: ExecutionContext, db: database): Promise<Response> {
    const path = new URL(request.url).pathname.split("/");
    const method = request.method;

    if (method != "GET" || path[2] != "mail" || path.length != 4) {
        throw new Error("Wrong handeler.");
    }

    const mail_id = parseInt(path[3]);

    const token = request.headers.get("Token");
    if (!token) {
        return new Response(JSON.stringify(resp_401), { status: 401 });
    }

    const mail = await db.query_mail(token, mail_id);
    if (!mail) {
        return new Response(JSON.stringify(resp_404), { status: 404 });
    }

    const resp: resp_t = {
        stat: 200,
        token: "",
        data: {
            id: mail.mail_id,
            size: mail.mail_size,
            content: mail.mail_content
        }
    };

    return new Response(JSON.stringify(resp), { status: 200 });
}

export async function delete_mail(request: Request, env: Env, ctx: ExecutionContext, db: database): Promise<Response> {
    const path = new URL(request.url).pathname.split("/");
    const method = request.method;

    if (method != "DELETE" || path[2] != "mail" || path.length != 4) {
        throw new Error("Wrong handeler.");
    }

    const mail_id = parseInt(path[3]);

    const token = request.headers.get("Token");
    if (!token) {
        return new Response(JSON.stringify(resp_401), { status: 401 });
    }

    const mail = await db.query_mail(token, mail_id);
    if (!mail) {
        return new Response(JSON.stringify(resp_404), { status: 404 });
    }

    let meta = await db.query_meta(token);
    if (!meta) {
        return new Response(JSON.stringify(resp_404), { status: 404 });
    }

    return db.delete_mail(token, mail_id).then(() => {
        meta!.mail_num -= 1;
        meta!.mail_size -= mail.mail_size;
        return db.update_mail_meta(token, meta!.mail_num, meta!.mail_size);
    }).then(() => {
        return new Response(JSON.stringify(resp_200), { status: 200 });
    }).catch((err) => {
        return new Response(JSON.stringify(resp_500), { status: 500 });
    });
}

interface send_email_data {
    "from": string;
    "to": string[];
    "content"?: string;
}
export async function send_email(request: Request, env: Env, ctx: ExecutionContext, db: database): Promise<Response> {
    const path = new URL(request.url).pathname.split("/");
    const method = request.method;

    if (method != "POST" || path[2] != "mail" || path.length != 3) {
        throw new Error("Wrong handeler.");
    }

    const token = request.headers.get("Token");
    if (!token) {
        return new Response(JSON.stringify(resp_401), { status: 401 });
    }

    const mail = await db.query_mail_meta(token);
    if (!mail) {
        return new Response(JSON.stringify(resp_404), { status: 404 });
    }

    const data: send_email_data = await request.json();
    if (!data.content) {
        return new Response(JSON.stringify(resp_406), { status: 406 });
    }
    if (!data.to) {
        return new Response(JSON.stringify(resp_406), { status: 406 });
    }
    if (!data.from) {
        return new Response(JSON.stringify(resp_406), { status: 406 });
    }

    const content_bs64 = data.content;
    const content = Buffer.from(content_bs64, "base64").toString("utf-8");

    for (const to of data.to) {

        const message = new EmailMessage(
            data.from,
            to,
            content
        );

        if (env[data.from] == undefined) {
            return new Response(JSON.stringify(resp_404), { status: 404 });
        }

        try {
            await (env[data.from] as SendEmail).send(message);
        }
        catch (err) {
            let resp = resp_500;
            console.log("send email error:", err);
            resp.data = (err as Error).message;
            console.log("resp:", resp);
            return new Response(JSON.stringify(resp), { status: 500 });
        }
    }

    return new Response(JSON.stringify(resp_200), { status: 200 });
}

export async function recv_email(user: string, content: string, db: database): Promise<void> {
    const token = await db.query_user(user);
    console.log("token:", token);
    if (!token) {
        throw new Error("User not found");
    }
    const meta = await db.query_meta(token.token);
    console.log("meta:", meta);
    if (!meta) {
        throw new Error("Token not found");
    }
    meta.mail_num += 1;
    meta.mail_size += content.length;
    const insert = {
        mail_id: -1,
        mail_size: content.length,
        mail_content: content
    };

    await db.insert_mail(token.token, insert);
    await db.update_mail_meta(token.token, meta.mail_num, meta.mail_size);

}