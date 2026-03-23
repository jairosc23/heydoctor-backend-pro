import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { email: email.toLowerCase() } });
  }

  async findById(id: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id } });
  }

  /**
   * Validates email + password for login. Email is normalized to lowercase.
   */
  async validateCredentials(
    email: string,
    plainPassword: string,
  ): Promise<User | null> {
    const user = await this.findByEmail(email);
    if (!user) {
      return null;
    }
    const match = await bcrypt.compare(plainPassword, user.passwordHash);
    return match ? user : null;
  }

  /**
   * Creates a user (e.g. seeding / admin tooling). Password is hashed with bcrypt.
   */
  async create(email: string, plainPassword: string): Promise<User> {
    const passwordHash = await bcrypt.hash(plainPassword, 12);
    const entity = this.usersRepository.create({
      email: email.toLowerCase(),
      passwordHash,
    });
    return this.usersRepository.save(entity);
  }
}
