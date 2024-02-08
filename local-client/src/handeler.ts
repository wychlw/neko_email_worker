import got from "got";
import { mail } from "./pop3";

interface resp_t {
    stat: number;
    token: string;
    data: any;
};

export async function find_user(server: string, username: string): Promise<void> {
    return got.get(
        server + "/v1/users/" + username,
    ).then((response) => {
        return;
    }).catch((e) => {
        if (e.response.statusCode == 404) {
            throw new Error("User not found");
        }
        throw e;
    });
}

export async function auth_user(server: string, username: string, password: string): Promise<string> {
    return got.get(
        server + "/v1/users/" + username + "/password",
        {
            headers: {
                Password: password,
            }
        }
    ).then((response) => {
        const body: resp_t = JSON.parse(response.body);
        return body.token;
    }).catch((e) => {
        if (e.response.statusCode == 401) {
            throw new Error("Invalid password");
        }
        throw e;
    });
}

interface mail_meta { num: number, size: number, mails: { id: number, size: number }[] };
export async function query_mail_meta(server: string, token: string): Promise<mail_meta> {
    return got.get(
        server + "/v1/mail",
        {
            headers: {
                Token: token,
            }
        }
    ).then((response) => {
        const body: resp_t = JSON.parse(response.body);
        return {
            num: body.data.num,
            size: body.data.size,
            mails: body.data.mails,
        };

    }).catch((e) => {
        if (e.response.statusCode == 401) {
            throw new Error("Invalid token");
        }
        if (e.response.statusCode == 404) {
            throw new Error("User not found");
        }
        throw e;
    });
}

export async function query_mail(server: string, token: string, id: number): Promise<mail> {
    return got.get(
        server + "/v1/mail/" + id,
        {
            headers: {
                Token: token,
            }
        }
    ).then((response) => {
        const body: resp_t = JSON.parse(response.body);
        const buff = Buffer.from(body.data.content as string, "base64");
        return {
            id: body.data.id as number,
            size: body.data.size as number,
            data: buff,
        };
    }).catch((e) => {
        if (e.response.statusCode == 401) {
            throw new Error("Invalid token");
        }
        if (e.response.statusCode == 404) {
            throw new Error("Mail not found");
        }
        throw e;
    });
}

export async function delete_mail(server: string, token: string, id: number): Promise<void> {
    return got.delete(
        server + "/v1/mail/" + id,
        {
            headers: {
                Token: token,
            }
        }
    ).then((response) => {
        return;
    }).catch((e) => {
        if (e.response.statusCode == 401) {
            throw new Error("Invalid token");
        }
        if (e.response.statusCode == 404) {
            throw new Error("Mail not found");
        }
        throw e;
    });

}

export interface send_mail {
    "from": string,
    "to": string[],
    "content": string
}
export async function send_mail(server: string, token: string, mail: send_mail): Promise<void> {
    return got.post(
        server + "/v1/mail",
        {
            headers: {
                Token: token,
            },
            body: JSON.stringify(mail),
        }
    ).then((response) => {
        return;
    }).catch((e) => {
        console.log("EEE", e);
        if (e.response.statusCode == 401) {
            throw new Error("Invalid token");
        }
        if (e.response.statusCode == 404) {
            throw new Error("User not found");
        }
        throw e;
    });
}