export interface CreateUserDto {
  name: string;
  email: string;
  username: string;
  password: string;
  confirmPassword: string;
}

export interface UpdateUserDto {
  id: string;
  name?: string;
  username?: string;
  password?: string;
  confirmPassword?: string;
  newPassword?: string;
}

export interface UserChangePasswordDto {
  token: string;
  password: string;
  confirmPassword: string;
}

export interface UserResponseDto {
  id: string;
  name: string;
  email: string;
  username: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}
