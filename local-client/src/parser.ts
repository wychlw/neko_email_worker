import * as mailparser from 'mailparser';
import * as smtp from "smtp-server";

class email_parser {

    mail_parser: mailparser.MailParser;

    parser_conf: mailparser.MailParserOptions = {
        skipHtmlToText: false,
        skipTextToHtml: false,
        skipImageLinks: false,
        keepCidLinks: true,
    };

    constructor() {
        this.mail_parser = new mailparser.MailParser(this.parser_conf);
    }

    async parse(buffer: Buffer) {
        const parsed = await mailparser.simpleParser(buffer, this.parser_conf);
        return parsed;
    }
}

export default { email_parser };