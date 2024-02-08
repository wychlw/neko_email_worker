export interface user {
    username: string;
    password: string;
    token: string;
};

export interface meta {
    token: string;
    is_admin: boolean;
    mail_num: number;
    mail_size: number;
};

export interface mail_meta {
    mail_id: number;
    mail_size: number;
};

export interface mail extends mail_meta {
    mail_content: string; // base64 encoded
};

export interface database {
    query_user(username: string): Promise<user | null>;
    query_meta(token: string): Promise<meta | null>;
    insert_user(username: string, password: string, is_admin?: boolean): Promise<void>;
    update_user(username: string, password?: string, is_admin?: boolean): Promise<void>;
    delete_user(username: string, token: string): Promise<void>;

    query_mail_id(token: string): Promise<number[]>;
    query_mail_size(token: string): Promise<number[]>;
    query_mail_meta(token: string): Promise<mail_meta[]>
    update_mail_meta(token: string, mail_num: number, mail_size: number): Promise<void>;
    query_mail(token: string, mail_id: number): Promise<mail | null>;
    /**
     * Add a mail to the mail table
     * 
     * @param token 
     * @param mail_content The mail_id field is ignored
     */
    insert_mail(token: string, mail_content: mail): Promise<void>;
    delete_mail(token: string, mail_id: number): Promise<void>;
};

export default {};