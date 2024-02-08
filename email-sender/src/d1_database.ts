import { database, user, meta, mail, mail_meta } from "./database";
import { SHA256 } from "crypto-js";

export class d1_database implements database {

    private database: D1Database;

    constructor(database: D1Database) {
        this.database = database;
    }

    async query_user(username: string): Promise<user | null> {
        const data = await this.database.prepare(
            "SELECT * FROM users WHERE username = ?"
        ).bind(username)
            .first();

        return data as unknown as user;
    }

    async query_meta(token: string): Promise<meta | null> {
        const data = await this.database.prepare(
            "SELECT * FROM meta WHERE token = ?"
        ).bind(token)
            .first();

        return data as unknown as meta;
    }

    async insert_user(username: string, password: string, is_admin: boolean = false): Promise<void> {
        // use username + time with sha256 to generate token
        const sha_str = username + Date.now().toString();
        const token = SHA256(sha_str).toString();
        await this.database.prepare(
            "INSERT INTO users (username, password, token) VALUES (?, ?, ?)"
        ).bind(username, password, token)
            .all();
        const is_admin_bind = is_admin ? 1 : 0;
        await this.database.prepare(
            "INSERT INTO meta (token, is_admin, mail_num, mail_size) VALUES (?, ?, ?, ?)"
        ).bind(token, is_admin_bind, 0, 0).all();
        await this.database.prepare(
            "CREATE TABLE IF NOT EXISTS mail_" + token +
            "(mail_id integer primary key autoincrement, mail_size integer not null, mail_content blob not null);"
        ).all();
        return;
    }

    async update_user(username: string, password?: string, is_admin?: boolean): Promise<void> {
        if (password && is_admin) {
            await this.database.prepare(
                "UPDATE users SET password = ?, is_admin = ? WHERE username = ?"
            ).bind(password, is_admin, username).all();
        }
        else if (password) {
            await this.database.prepare(
                "UPDATE users SET password = ? WHERE username = ?"
            ).bind(password, username).all();
        }
        else if (is_admin) {
            await this.database.prepare(
                "UPDATE users SET is_admin = ? WHERE username = ?"
            ).bind(is_admin, username).all();
        }
        return;
    }

    async delete_user(username: string, token: string): Promise<void> {
        await this.database.prepare(
            "DELETE FROM users WHERE username = ?"
        ).bind(username).all();
        await this.database.prepare(
            "DELETE FROM meta WHERE token = ?"
        ).bind(token).all();
        await this.database.prepare(
            "DROP TABLE mail_" + token
        ).all();
        return;
    }

    async query_mail_id(token: string): Promise<number[]> {
        const res = await this.database.prepare(
            "SELECT mail_id FROM mail_" + token + " ORDER BY mail_id"
        ).all();
        const ids = res.results.map((x) => x.mail_id as number);
        return ids;
    }

    async query_mail_size(token: string): Promise<number[]> {
        const res = await this.database.prepare(
            "SELECT mail_size FROM mail_" + token + " ORDER BY mail_id"
        ).all();
        const sizes = res.results.map((x) => x.mail_size as number);
        return sizes;
    }

    async query_mail_meta(token: string): Promise<mail_meta[]> {
        const res = await this.database.prepare(
            "SELECT mail_id, mail_size FROM mail_" + token + " ORDER BY mail_id"
        ).all();
        const database = res.results.map((x) => { return { mail_id: x.mail_id, mail_size: x.mail_size } as mail_meta; });
        return database;
    }

    async update_mail_meta(token: string, mail_num: number, mail_size: number): Promise<void> {
        await this.database.prepare(
            "UPDATE meta SET mail_num = ?, mail_size = ? WHERE token = ?"
        ).bind(mail_num, mail_size, token).all();
        return;
    }

    async query_mail(token: string, mail_id: number): Promise<mail | null> {
        const res = await this.database.prepare(
            "SELECT * FROM mail_" + token + " WHERE mail_id = ?"
        ).bind(mail_id).first();

        return res as unknown as mail;
    }

    async insert_mail(token: string, mail_content: mail): Promise<void> {
        await this.database.prepare(
            "INSERT INTO mail_" + token + " (mail_size, mail_content) VALUES (?, ?)"
        ).bind(mail_content.mail_size, mail_content.mail_content).all();
        return;
    }

    async delete_mail(token: string, mail_id: number): Promise<void> {
        await this.database.prepare(
            "DELETE FROM mail_" + token + " WHERE mail_id = ?"
        ).bind(mail_id).all();
        return;
    }

}