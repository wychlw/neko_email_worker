import { Env } from './index';

export interface script_env_error {
    code: number;
    message: string;
};

export interface script_env_message {
    code: number;
    message: string;
};

export interface script_env_binding {
    type: string;
};

export interface script_env_binding_kv_namespace extends script_env_binding {
    name: string;
    namespace_id: string;
    type: 'kv_namespace';
};

export interface script_env_binding_service extends script_env_binding {
    environment: string;
    name: string;
    service: string;
    type: 'service';
};

export interface script_env_binding_durable_object_namespace extends script_env_binding {
    class_name: string;
    environment?: string;
    name: string;
    namespace_id?: string;
    script_name?: string;
    type: 'durable_object_namespace';
};

export interface script_env_binding_r2_bucket extends script_env_binding {
    bucket_name: string;
    name: string;
    type: 'r2_bucket';
};

export interface script_env_binding_queue extends script_env_binding {
    name: string;
    queue_name: string;
    type: 'queue';
};

export interface script_env_binding_d1 extends script_env_binding {
    binding: string;
    id: string;
    name: string;
    type: 'd1';
};

export interface script_env_binding_dispatch_namespace extends script_env_binding {
    name: string;
    namespace: string;
    outbound: {
        params: string[],
        worker: {
            environment: string;
            service: string;
        }
    },
    type: 'dispatch_namespace';
};

export interface script_env_binding_mtls_certificate extends script_env_binding {
    certificate_id?: string;
    name: string;
    type: 'mtls_certificate';
};

export interface script_env_binding_send_email extends script_env_binding {
    name: string;
    destination_address?: string;
    allowed_destination_addresses?: string[];
    type: 'send_email';
};

export interface script_env_binding_plain_text extends script_env_binding {
    name: string;
    text: string;
    type: 'plain_text';
};

export interface script_env_binding_secret_text extends script_env_binding {
    name: string;
    type: 'secret_text';
};

export interface script_env_migration_single_set {
    new_tag?: string;
    old_tag?: string;
    deleted_classes?: string[];
    new_classes?: string[];
    renamed_classes?: {
        from?: string;
        to?: string;
    }[];
    transferred_classes: {
        from?: string;
        from_script?: string;
        to?: string;
    }[];
};

export interface script_env_migration_durable_objects {
    new_tag?: string;
    old_tag?: string;
    steps?: {
        deleted_classes?: string[];
        new_classes?: string[];
        renamed_classes?: {
            from?: string;
            to?: string;
        }[];
        transferred_classes?: {
            from?: string;
            from_script?: string;
            to?: string;
        }[];
    }[];
};

export interface script_env {
    errors: script_env_error[];
    messages: script_env_message[];
    result: {
        bindings?: (
            script_env_binding_kv_namespace |
            script_env_binding_service |
            script_env_binding_durable_object_namespace |
            script_env_binding_r2_bucket |
            script_env_binding_queue |
            script_env_binding_d1 |
            script_env_binding_dispatch_namespace |
            script_env_binding_mtls_certificate |
            script_env_binding_send_email |
            script_env_binding_plain_text |
            script_env_binding_secret_text
        )[];
        compatibility_date?: string;
        compatibility_flags?: string[];
        logpush?: boolean;
        migrations?: script_env_migration_single_set | script_env_migration_durable_objects;
        placement?: {
            mode: 'smart';
        };
        tags?: string[];
        tail_consumers?: {
            environment?: string;
            namespace?: string;
            servise: string;
        };
        usage_model?: 'bundled' | 'unbound';
    };
    success: boolean;
};

export async function fetch_env(env: Env, ctx: ExecutionContext): Promise<script_env> {
    const url =
        'https://api.cloudflare.com/client/v4/accounts/'
        + env.ACCOUNT_ID +
        '/workers/scripts/'
        + env.SCRIPT_NAME +
        '/settings';

    const options = {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + env.API_TOKEN,
        },
    };

    const data = await fetch(url, options);
    if (data.status != 200) {
        throw new Error('Failed to fetch env');
    }
    const resp: script_env = await data.json();

    if (!resp.success) {
        throw new Error('Failed to fetch env');
    }

    return resp;
}

export async function update_env_mail_sender(env: Env, ctx: ExecutionContext, sender: script_env_binding_send_email, script: script_env): Promise<script_env> {
    let new_script = script;
    new_script.result = {};
    new_script.result.bindings = [];
    new_script.result.bindings.push(sender);
    return new_script;
}

export async function patch_env(env: Env, ctx: ExecutionContext, script: script_env): Promise<script_env> {
    const url =
        'https://api.cloudflare.com/client/v4/accounts/'
        + env.ACCOUNT_ID +
        '/workers/scripts/'
        + env.SCRIPT_NAME +
        '/settings';

    console.log("patching:", script);

    const form = new FormData();
    form.append('settings', JSON.stringify(script));

    const options = {
        method: 'PATCH',
        headers: {
            Authorization: 'Bearer ' + env.API_TOKEN,
        },
        body: form,
    };

    const data = await fetch(url, options);
    console.log("status: " + data.status);
    if (data.status != 200) {
        console.log(await data.text());
        throw new Error('Failed to patch env');
    }
    const resp: script_env = await data.json();

    console.log("new env:", resp);

    return resp;
}

export async function add_new_email_sender(env: Env, ctx: ExecutionContext, sender: script_env_binding_send_email): Promise<void> {
    const script = await fetch_env(env, ctx);
    const new_script = await update_env_mail_sender(env, ctx, sender, script);
    await patch_env(env, ctx, new_script);
}

export async function remove_email_sender(env: Env, ctx: ExecutionContext, sender: script_env_binding_send_email): Promise<void> {
    const script = await fetch_env(env, ctx);
    if (!script.result.bindings) {
        return;
    }
    for (let binding of script.result.bindings) {
        if (binding.type != 'send_email') {
            continue;
        }
        if (binding.name == sender.name) {
            script.result.bindings.splice(script.result.bindings.indexOf(binding), 1);
            await patch_env(env, ctx, script);
            return;
        }
    }
    return;
}