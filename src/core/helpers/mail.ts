import { transporter } from "../../config/smtp"
import { config } from "../../config/config"

interface MailPayload {
    to: string;
    subject: string;
    text?: string;
    html?: string;
}

export class Mail {
    private async transmit(payload: MailPayload) {
        const { to, subject, text, html } = payload

        try {
            const info = await transporter.sendMail({
                from: config.mail.from,
                to,
                subject,
                text: text || (html ? "Please view this email in an HTML-compatible client." : ""),
                html,
            })
            
            console.log(`[Mail] Message sent successfully to ${to} (ID: ${info.messageId})`)
            return info
        } catch (error) {
            console.error(`[Mail] Error sending email to ${to}:`, error)
            throw new Error(`Failed to send email to ${to}: ${(error as Error).message}`)
        }
    }

    async sendText(to: string, subject: string, text: string) {
        return this.transmit({ to, subject, text })
    }

    async sendHtml(to: string, subject: string, html: string, text?: string) {
        return this.transmit({ to, subject, html, text })
    }
}

export const mail = new Mail()
export const mailHelper = mail
export default mail
