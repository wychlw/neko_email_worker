import { database, user } from "./database";

async function find_user(username: string, db: database): Promise<user> {
    const data = await db.query_user(username);
    return data;
}

async function auth_user(username: string, password: string, db: database): Promise<string> {

    const data = await find_user(username, db);

    if (data.username == username && data.password == password) {
        return data.token;
    }
    throw new Error("User auth failed");
}

export default {
    find_user,
    auth_user
};