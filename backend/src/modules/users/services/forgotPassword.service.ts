import { sign } from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { dataSource } from '../../../database';
import UserRepository from '../repositories/user.repository';
import EmailService from '../../../email/service';

export default class ForgotPasswordService {
  private userRepository: UserRepository;

  constructor() {
    this.userRepository = new UserRepository(dataSource);
  }

  async execute(email: string): Promise<void> {
    const user = await this.userRepository.findOneBy({ email });

    if (user) {
      const secret = process.env.JWT_RESET_SECRET || 'some-secret-key';
      const resetToken = uuidv4();
      const token = sign({ id: user.id, resetToken }, secret, { expiresIn: '15m' });

      await this.userRepository.update(user.id, { resetToken });

      const emailService = new EmailService();
      const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
      const htmlContent = emailService.renderTemplate('forgotPassword', {
        user,
        resetLink,
        expiresIn: '15m',
      });

      await emailService.sendEmail(
        { email: user.email, name: user.name },
        'Password Reset Request',
        htmlContent,
      );
    }
  }
}
