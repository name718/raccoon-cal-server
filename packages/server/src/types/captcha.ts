export interface CaptchaResponse {
  captchaId: string;
  captchaImage: string; // base64 编码的图片
}

export interface CaptchaVerifyRequest {
  captchaId: string;
  captchaCode: string;
}
