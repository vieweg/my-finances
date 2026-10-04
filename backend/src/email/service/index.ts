import fs from 'fs';
import path from 'path';
import { render } from 'pug';
import axios, { AxiosInstance } from 'axios';
import AppError from '../../errors/AppError';

export default class EmailService {
  private axiosInstance: AxiosInstance;
  private fromName: string;
  private fromEmail: string;
  private templatePath: string = path.join(__dirname, '..', 'views');

  constructor() {
    // https://app.brevo.com/
    const API_KEY = process.env.BREVO_API_KEY || '';
    this.fromName = process.env.BREVO_FROM_NAME || 'Controle Caixa';
    this.fromEmail = process.env.BREVO_FROM_EMAIL || '';
    this.axiosInstance = axios.create({
      baseURL: 'https://api.brevo.com/v3/smtp/email/',
      headers: { 'api-key': API_KEY, 'Content-Type': 'application/json' },
    });
  }

  async sendEmail(to: { email: string; name: string }, subject: string, htmlContent: string) {
    try {
      const result = await this.axiosInstance.post('', {
        sender: { name: this.fromName, email: this.fromEmail },
        to: [to],
        htmlContent,
        subject,
      });

      if (result.status !== 201) {
        throw new Error();
      }

      return result;
    } catch (error) {
      console.log(error);
      throw new AppError('Failed to send email');
    }
  }

  renderTemplate(templateName: string, params: any): string {
    const templateFile = path.join(this.templatePath, `${templateName}.pug`);
    if (!fs.existsSync(templateFile)) {
      throw new Error(`Template file not found: ${templateFile}`);
    }
    const template = fs.readFileSync(templateFile, 'utf-8');
    const compiledTemplate = render(template, params);
    return compiledTemplate;
  }
}
