export interface RegisterRequest {
  username: string;
  password: string;
  email?: string;
  phone?: string;
}

export interface RegisterResponse {
  user: {
    id: number;
    username: string;
    email?: string;
    phone?: string;
    createdAt: string;
  };
  token: string;
}

export interface LoginRequest {
  identifier: string; // 可以是用户名、邮箱或手机号
  password: string;
}

export interface LoginResponse {
  user: {
    id: number;
    username: string;
    email?: string;
    phone?: string;
    emailVerified: boolean;
    phoneVerified: boolean;
  };
  token: string;
}
