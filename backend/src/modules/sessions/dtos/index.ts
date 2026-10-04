export interface CreateSessionDto {
  username: string;
  password: string;
}

export interface SessionResponseDto {
  token: string;
  refreshToken: string; // returned by services internally; set as httpOnly cookie, never sent in JSON
  user: {
    id: string;
    name: string;
    username: string;
    email: string;
  };
}
