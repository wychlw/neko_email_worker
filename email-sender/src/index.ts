import { EmailMessage } from "cloudflare:email";
import { d1_database } from "./d1_database";
import { auth_user, delete_user, find_user, insert_user, update_user, query_mail_meta, query_mail, delete_mail, recv_email, send_email } from "./handelers";
import { createMimeMessage } from "mimetext";
import { Buffer } from "node:buffer";

export interface Env{
	"tester@wcytest.xyz": SendEmail,
	"DB": D1Database,
	// vars
	SCRIPT_NAME: string,
	// secrets
	"ACCOUNT_ID": string,
	"API_TOKEN": string,
	// any
	[key: string]: any
}

interface resp_t {
	stat: number;
	token: string;
	data: string;
};

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {

		const path = new URL(request.url).pathname.split("/");
		const method = request.method;
		const database = new d1_database(env.DB);

		if (path[1] != "v1") {
			return new Response("URL Error", { status: 500 });
		}

		// users oper begin
		if (method == "GET" && path[2] == "users" && path.length == 4) {
			return find_user(request, env, ctx, database);
		}
		else if (method == "GET" && path[2] == "users" && path.length == 5 && path[4] == "password") {
			return auth_user(request, env, ctx, database);
		}
		else if (method == "POST" && path[2] == "users" && path.length == 5 && path[4] == "password") {
			return insert_user(request, env, ctx, database);
		}
		else if (method == "PUT" && path[2] == "users" && path.length == 5 && path[4] == "password") {
			return update_user(request, env, ctx, database);
		}
		else if (method == "DELETE" && path[2] == "users" && path.length == 5 && path[4] == "password") {
			return delete_user(request, env, ctx, database);
		}
		// users oper end
		// mail oper begin
		else if (method == "GET" && path[2] == "mail" && path.length == 3) {
			return query_mail_meta(request, env, ctx, database);
		}
		else if (method == "GET" && path[2] == "mail" && path.length == 4) {
			return query_mail(request, env, ctx, database);
		}
		else if (method == "DELETE" && path[2] == "mail" && path.length == 4) {
			return delete_mail(request, env, ctx, database);
		}
		else if (method == "POST" && path[2] == "mail" && path.length == 3) {
			return send_email(request, env, ctx, database);
		}
		// mail oper end
		else {
			return new Response("URL Error", { status: 500 });
		}
	},
	async email(message: ForwardableEmailMessage, env: Env, ctx: ExecutionContext): Promise<void> {
		const database = new d1_database(env.DB);

		const to_user = message.to;

		const decoder = new TextDecoder('utf-8');
		let chunks: Uint8Array[] = [];
		for await (const chunk of message.raw) {
			chunks.push(chunk);
		}
		let data = "";
		for (const chunk of chunks) {
			data += decoder.decode(chunk);
		}

		const bs64_data = Buffer.from(data).toString('base64');

		await recv_email(to_user, bs64_data, database);
	}
};